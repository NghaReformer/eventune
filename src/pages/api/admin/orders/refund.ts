/**
 * API: Process Order Refund
 * POST /api/admin/orders/refund
 *
 * Security: Super admin only, CSRF validation, rate limiting, audit logging
 */

import type { APIRoute } from 'astro';
import { getAdminSession } from '../../../../lib/auth/admin-session';
import { validateCSRFToken } from '../../../../lib/auth/session';
import { StripeProvider } from '../../../../lib/payments/stripe-provider';
import { getServerClient } from '../../../../lib/supabase/server';
import { logAdminAction } from '../../../../lib/audit/logger';
import { checkRateLimit, isValidUUID } from '../../../../lib/security/validation';
import { sendEmail, renderTemplate } from '../../../../lib/email/client';
import { ADMIN_CONFIG } from '../../../../config/admin.constants';

export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  // Rate limiting (strict for refunds)
  const rateLimit = checkRateLimit(
    clientAddress,
    'admin-refund',
    5, // Max 5 refunds per window
    ADMIN_CONFIG.RATE_LIMITS.STATUS_UPDATE.window
  );

  if (!rateLimit.allowed) {
    return new Response(
      JSON.stringify({ error: 'Too many refund attempts. Please wait.' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(Math.ceil(rateLimit.resetIn / 1000)),
        },
      }
    );
  }

  // Admin authentication
  const adminSession = await getAdminSession(cookies);
  if (!adminSession.success) {
    return new Response(
      JSON.stringify({ error: 'Authentication required' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Super admin only for refunds
  if (adminSession.data.adminRole !== 'super_admin') {
    return new Response(
      JSON.stringify({ error: 'Super admin access required for refunds' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await request.json();
    const { order_id, reason, amount, csrf_token } = body;

    // CSRF validation
    if (!validateCSRFToken(cookies, csrf_token || null)) {
      return new Response(
        JSON.stringify({ error: 'Invalid security token. Please refresh and try again.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate order ID
    if (!order_id || !isValidUUID(order_id)) {
      return new Response(
        JSON.stringify({ error: 'Invalid order ID' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate reason
    if (!reason || typeof reason !== 'string' || reason.length < 10) {
      return new Response(
        JSON.stringify({ error: 'Refund reason must be at least 10 characters' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = getServerClient();

    // Fetch the order
    const { data: orderData, error: fetchError } = await supabase
      .from('orders')
      .select('*, profiles(full_name, email)')
      .eq('id', order_id)
      .single();

    if (fetchError || !orderData) {
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Cast to expected shape
    const order = orderData as {
      id: string;
      order_number: string;
      payment_status: 'pending' | 'paid' | 'failed' | 'refunded' | 'partially_refunded';
      status: string;
      amount_paid: number;
      currency: 'USD' | 'XAF';
      payment_provider: 'stripe' | 'campay';
      payment_reference: string;
      profiles: { full_name: string | null; email: string } | null;
    };

    // Validate order can be refunded (only 'paid' orders can be refunded)
    // This also covers 'refunded' orders since they won't have status 'paid'
    if (order.payment_status !== 'paid') {
      const message = order.payment_status === 'refunded'
        ? 'Order has already been refunded'
        : 'Only paid orders can be refunded';
      return new Response(
        JSON.stringify({ error: message }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Determine refund amount
    const refundAmount = amount && typeof amount === 'number' && amount > 0
      ? Math.min(amount, order.amount_paid)
      : order.amount_paid;

    const isFullRefund = refundAmount >= order.amount_paid;

    // Process refund based on payment provider
    let refundResult: { success: boolean; refundId?: string; error?: string };

    if (order.payment_provider === 'stripe') {
      // Process Stripe refund
      // Use deterministic idempotency key based on order_id and amount
      // This ensures retry safety while allowing multiple partial refunds
      const idempotencyKey = `refund-${order_id}-${refundAmount}`;
      const stripeProvider = new StripeProvider();
      refundResult = await stripeProvider.refund({
        paymentReference: order.payment_reference,
        amount: refundAmount,
        currency: order.currency,
        reason: reason.substring(0, 500),
        idempotencyKey,
      });
    } else if (order.payment_provider === 'campay') {
      // CamPay requires manual refund
      refundResult = {
        success: false,
        error: 'CamPay refunds must be processed manually via the CamPay dashboard. Please note the order details and process the refund there.',
      };
    } else {
      refundResult = {
        success: false,
        error: `Unknown payment provider: ${order.payment_provider}`,
      };
    }

    if (!refundResult.success) {
      // Log failed attempt
      await logAdminAction({
        admin_id: adminSession.data.user.id,
        admin_email: adminSession.data.user.email,
        admin_role: adminSession.data.adminRole,
        action: 'order.refund',
        resource_type: 'order',
        resource_id: order_id,
        metadata: {
          status: 'failed',
          error: refundResult.error,
          amount: refundAmount,
          provider: order.payment_provider,
        },
        ip_address: clientAddress,
        user_agent: request.headers.get('user-agent') || undefined,
      });

      return new Response(
        JSON.stringify({
          error: refundResult.error,
          manual_required: order.payment_provider === 'campay',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Update order status
    const newPaymentStatus = isFullRefund ? 'refunded' : 'partially_refunded';
    const newStatus = isFullRefund ? 'cancelled' : order.status;

    await supabase
      .from('orders')
      .update({
        payment_status: newPaymentStatus,
        status: newStatus,
        refund_amount: refundAmount,
        refund_reason: reason,
        refund_reference: refundResult.refundId,
        refunded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', order_id);

    // Record status history
    await supabase.from('order_status_history').insert({
      order_id: order_id,
      old_status: order.payment_status,
      new_status: newPaymentStatus,
      changed_by: adminSession.data.user.id,
      notes: `Refund processed: ${order.currency} ${refundAmount} - ${reason}`,
      created_at: new Date().toISOString(),
    });

    // Send cancellation email
    const profile = order.profiles as { full_name: string | null; email: string } | null;
    if (profile?.email) {
      const template = renderTemplate('cancellation', {
        orderNumber: order.order_number,
        customerName: profile.full_name || 'Valued Customer',
        refundAmount: `${order.currency} ${refundAmount}`,
        reason: reason,
      });

      await sendEmail({
        to: profile.email,
        subject: template.subject,
        html: template.html,
        text: template.text,
        tags: [
          { name: 'type', value: 'refund' },
          { name: 'order', value: order.order_number },
        ],
      });
    }

    // Audit log success
    await logAdminAction({
      admin_id: adminSession.data.user.id,
      admin_email: adminSession.data.user.email,
      admin_role: adminSession.data.adminRole,
      action: 'order.refund',
      resource_type: 'order',
      resource_id: order_id,
      metadata: {
        status: 'success',
        refund_id: refundResult.refundId,
        amount: refundAmount,
        full_refund: isFullRefund,
        provider: order.payment_provider,
        reason: reason.substring(0, 200),
      },
      ip_address: clientAddress,
      user_agent: request.headers.get('user-agent') || undefined,
    });

    return new Response(
      JSON.stringify({
        success: true,
        refund_id: refundResult.refundId,
        amount: refundAmount,
        full_refund: isFullRefund,
        message: isFullRefund
          ? 'Full refund processed successfully'
          : `Partial refund of ${order.currency} ${refundAmount} processed successfully`,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[ADMIN] Refund error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
