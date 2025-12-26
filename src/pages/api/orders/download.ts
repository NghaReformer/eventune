/**
 * API: Download Order Deliverable
 * GET /api/orders/download?order_id={id}
 *
 * Generates a secure signed URL for downloading the finished song.
 * Security: Customer auth, order ownership verification, rate limiting
 */

import type { APIRoute } from 'astro';
import { getSession } from '../../../lib/auth/session';
import { getServerClient } from '../../../lib/supabase/server';
import { checkRateLimit, isValidUUID } from '../../../lib/security/validation';
import { getSignedDownloadUrl } from '../../../lib/storage/r2-client';

export const GET: APIRoute = async ({ request, cookies, clientAddress }) => {
  // Rate limiting
  const rateLimit = checkRateLimit(clientAddress, 'download', 20, 60000);

  if (!rateLimit.allowed) {
    return new Response(
      JSON.stringify({ error: 'Too many download attempts. Please wait.' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(Math.ceil(rateLimit.resetIn / 1000)),
        },
      }
    );
  }

  // Authentication
  const sessionResult = await getSession(cookies);
  if (!sessionResult.success) {
    return new Response(
      JSON.stringify({ error: 'Authentication required' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }
  const session = sessionResult.data;

  try {
    // Get order ID from query params
    const url = new URL(request.url);
    const orderId = url.searchParams.get('order_id');

    if (!orderId || !isValidUUID(orderId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid order ID' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = getServerClient();

    // Fetch order and verify ownership
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('id, customer_id, deliverable_key, deliverable_filename, status, payment_status')
      .eq('id', orderId)
      .single();

    if (fetchError || !order) {
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify ownership (IDOR protection)
    if (order.customer_id !== session.user.id) {
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify order is paid (or partially refunded - customer still deserves access)
    const allowedPaymentStatuses = ['paid', 'partially_refunded'];
    if (!allowedPaymentStatuses.includes(order.payment_status)) {
      return new Response(
        JSON.stringify({ error: 'Order not paid' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify deliverable exists
    if (!order.deliverable_key) {
      return new Response(
        JSON.stringify({ error: 'Deliverable not yet available' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Generate signed download URL (valid for 1 hour)
    const result = await getSignedDownloadUrl(
      order.deliverable_key,
      3600, // 1 hour
      order.deliverable_filename || 'eventune-song.mp3'
    );

    if (!result.success) {
      return new Response(
        JSON.stringify({ error: result.error || 'Failed to generate download URL' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Record download in audit
    await supabase.from('order_downloads').insert({
      order_id: orderId,
      customer_id: session.user.id,
      ip_address: clientAddress,
      user_agent: request.headers.get('user-agent') || null,
      created_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        url: result.url,
        filename: order.deliverable_filename,
        expiresAt: result.expiresAt?.toISOString(),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[DOWNLOAD] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
