/**
 * CamPay Webhook Handler
 * POST /api/webhooks/campay
 *
 * Receives payment events from CamPay (MTN/Orange Mobile Money) and updates order status.
 * Security: Signature verification, idempotency, audit logging
 */

import type { APIRoute } from 'astro';
import { CamPayProvider } from '../../../lib/payments/campay-provider';
import { getServerClient } from '../../../lib/supabase/server';
import { sendEmail, renderTemplate } from '../../../lib/email/client';
import { siteConfig } from '../../../config';

// Idempotency cache (in production, use Redis)
const processedEvents = new Map<string, { processedAt: number }>();

// Clean up old entries every hour
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of processedEvents) {
    if (now - value.processedAt > CACHE_TTL) {
      processedEvents.delete(key);
    }
  }
}, 60 * 60 * 1000);

export const POST: APIRoute = async ({ request }) => {
  const startTime = Date.now();

  try {
    // Get raw body for signature verification
    const rawBody = await request.text();

    // CamPay signature from header
    const signature = request.headers.get('x-campay-signature') || '';

    // Verify webhook signature
    const campayProvider = new CamPayProvider();
    const verification = await campayProvider.verifyWebhook({
      rawBody,
      signature,
      headers: Object.fromEntries(request.headers.entries()),
    });

    if (!verification.valid) {
      console.error('[WEBHOOK:CAMPAY] Invalid signature:', verification.error);
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Extract event data
    const { eventType, orderId, paymentStatus, amount, data } = verification;
    const reference = (data as Record<string, unknown>)?.reference as string;

    console.log(`[WEBHOOK:CAMPAY] Event: ${eventType}, Order: ${orderId}, Ref: ${reference}`);

    // Idempotency check using reference
    if (reference && processedEvents.has(reference)) {
      console.log(`[WEBHOOK:CAMPAY] Duplicate event ignored: ${reference}`);
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!orderId) {
      console.log(`[WEBHOOK:CAMPAY] No order ID in event ${eventType}`);
      return new Response(JSON.stringify({ received: true, skipped: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = getServerClient();

    // Fetch the order - CamPay uses external_reference which is the order ID
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('*, profiles(full_name, email)')
      .eq('id', orderId)
      .single();

    if (fetchError || !order) {
      console.error(`[WEBHOOK:CAMPAY] Order not found: ${orderId}`);
      return new Response(JSON.stringify({ error: 'Order not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Process based on payment status
    if (paymentStatus === 'completed') {
      // Update order to paid status
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          payment_status: 'paid',
          status: 'paid',
          amount_paid: amount || order.amount_expected,
          payment_provider: 'campay',
          payment_reference: reference,
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId);

      if (updateError) {
        console.error('[WEBHOOK:CAMPAY] Update error:', updateError);
        throw updateError;
      }

      // Record status history
      await supabase.from('order_status_history').insert({
        order_id: orderId,
        old_status: order.status,
        new_status: 'paid',
        changed_by: 'system',
        notes: `Payment confirmed via CamPay Mobile Money (${(data as Record<string, unknown>)?.operator || 'Unknown'})`,
        created_at: new Date().toISOString(),
      });

      // Send confirmation email
      const profile = order.profiles as { full_name: string | null; email: string } | null;
      if (profile?.email) {
        const template = renderTemplate('order-confirmation', {
          orderNumber: order.order_number,
          customerName: profile.full_name || 'Valued Customer',
          packageName: formatPackageName(order.package_slug),
          amount: String(amount || order.amount_expected),
          currency: 'XAF',
          occasionName: formatOccasionName(order.occasion_slug),
          estimatedDelivery: calculateDeliveryDate(order.package_slug),
          portalUrl: `${siteConfig.url}/dashboard/orders/${orderId}`,
        });

        await sendEmail({
          to: profile.email,
          subject: template.subject,
          html: template.html,
          text: template.text,
          tags: [
            { name: 'type', value: 'order-confirmation' },
            { name: 'order', value: order.order_number },
            { name: 'provider', value: 'campay' },
          ],
        });
      }

      console.log(`[WEBHOOK:CAMPAY] Order ${orderId} marked as paid`);
    } else if (paymentStatus === 'failed') {
      // Update order status
      await supabase
        .from('orders')
        .update({
          payment_status: 'failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId);

      // Record status history
      await supabase.from('order_status_history').insert({
        order_id: orderId,
        old_status: order.payment_status,
        new_status: 'failed',
        changed_by: 'system',
        notes: 'Payment failed via CamPay Mobile Money',
        created_at: new Date().toISOString(),
      });

      console.log(`[WEBHOOK:CAMPAY] Order ${orderId} payment failed`);
    }

    // Mark as processed AFTER successful database operations
    if (reference) {
      processedEvents.set(reference, { processedAt: Date.now() });
    }

    const processingTime = Date.now() - startTime;
    console.log(`[WEBHOOK:CAMPAY] Processed in ${processingTime}ms`);

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[WEBHOOK:CAMPAY] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

// Helper functions
function formatPackageName(slug: string): string {
  const names: Record<string, string> = {
    express: 'Express Package',
    classic: 'Classic Package',
    signature: 'Signature Package',
    legacy: 'Legacy Package',
  };
  return names[slug] || slug;
}

function formatOccasionName(slug: string): string {
  return (slug || 'custom')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function calculateDeliveryDate(packageSlug: string): string {
  const deliveryDays: Record<string, number> = {
    express: 3,
    classic: 7,
    signature: 10,
    legacy: 14,
  };
  const days = deliveryDays[packageSlug] || 7;
  const deliveryDate = new Date();
  deliveryDate.setDate(deliveryDate.getDate() + days);
  return deliveryDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
