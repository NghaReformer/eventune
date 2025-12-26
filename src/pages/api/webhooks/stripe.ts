/**
 * Stripe Webhook Handler
 * POST /api/webhooks/stripe
 *
 * Receives payment events from Stripe and updates order status.
 * Security: Signature verification, idempotency, audit logging
 */

import type { APIRoute } from 'astro';
import { StripeProvider } from '../../../lib/payments/stripe-provider';
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
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      console.error('[WEBHOOK:STRIPE] Missing signature header');
      return new Response(JSON.stringify({ error: 'Missing signature' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verify webhook signature
    const stripeProvider = new StripeProvider();
    const verification = await stripeProvider.verifyWebhook({
      rawBody,
      signature,
      headers: Object.fromEntries(request.headers.entries()),
    });

    if (!verification.valid) {
      console.error('[WEBHOOK:STRIPE] Invalid signature:', verification.error);
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Extract event data
    const { eventType, orderId, paymentStatus, amount, data } = verification;
    const eventId = (data as Record<string, unknown>)?.id as string;

    console.log(`[WEBHOOK:STRIPE] Event: ${eventType}, Order: ${orderId}`);

    // Idempotency check
    if (eventId && processedEvents.has(eventId)) {
      console.log(`[WEBHOOK:STRIPE] Duplicate event ignored: ${eventId}`);
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Handle different event types
    if (!orderId) {
      console.log(`[WEBHOOK:STRIPE] No order ID in event ${eventType}`);
      return new Response(JSON.stringify({ received: true, skipped: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = getServerClient();

    // Fetch the order
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('*, profiles(full_name, email)')
      .eq('id', orderId)
      .single();

    if (fetchError || !order) {
      console.error(`[WEBHOOK:STRIPE] Order not found: ${orderId}`);
      return new Response(JSON.stringify({ error: 'Order not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Process based on event type
    switch (eventType) {
      case 'checkout.session.completed': {
        if (paymentStatus === 'completed') {
          // Update order to paid status
          const { error: updateError } = await supabase
            .from('orders')
            .update({
              payment_status: 'paid',
              status: 'paid',
              amount_paid: amount || order.amount_expected,
              payment_provider: 'stripe',
              payment_reference: eventId,
              paid_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', orderId);

          if (updateError) {
            console.error('[WEBHOOK:STRIPE] Update error:', updateError);
            throw updateError;
          }

          // Record status history
          await supabase.from('order_status_history').insert({
            order_id: orderId,
            old_status: order.status,
            new_status: 'paid',
            changed_by: 'system',
            notes: 'Payment confirmed via Stripe webhook',
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
              currency: order.currency,
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
              ],
            });
          }

          console.log(`[WEBHOOK:STRIPE] Order ${orderId} marked as paid`);
        }
        break;
      }

      case 'payment_intent.payment_failed': {
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
          notes: 'Payment failed via Stripe',
          created_at: new Date().toISOString(),
        });

        console.log(`[WEBHOOK:STRIPE] Order ${orderId} payment failed`);
        break;
      }

      case 'charge.refunded': {
        const isFullRefund = paymentStatus === 'refunded';

        await supabase
          .from('orders')
          .update({
            payment_status: isFullRefund ? 'refunded' : 'partially_refunded',
            status: isFullRefund ? 'cancelled' : order.status,
            updated_at: new Date().toISOString(),
          })
          .eq('id', orderId);

        // Record status history
        await supabase.from('order_status_history').insert({
          order_id: orderId,
          old_status: order.payment_status,
          new_status: isFullRefund ? 'refunded' : 'partially_refunded',
          changed_by: 'system',
          notes: `Refund processed via Stripe (${isFullRefund ? 'full' : 'partial'})`,
          created_at: new Date().toISOString(),
        });

        console.log(`[WEBHOOK:STRIPE] Order ${orderId} refund processed`);
        break;
      }

      default:
        console.log(`[WEBHOOK:STRIPE] Unhandled event type: ${eventType}`);
    }

    // Mark as processed AFTER successful database operations
    if (eventId) {
      processedEvents.set(eventId, { processedAt: Date.now() });
    }

    const processingTime = Date.now() - startTime;
    console.log(`[WEBHOOK:STRIPE] Processed in ${processingTime}ms`);

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[WEBHOOK:STRIPE] Error:', error);
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
