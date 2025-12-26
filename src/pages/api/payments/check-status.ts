/**
 * Check Payment Status API
 * Polls payment status for mobile money and other async payments
 */

import type { APIRoute } from 'astro';
import { createServerClientWithToken, getServerClient } from '@/lib/supabase/server';
import { getProviderById } from '@/lib/payments/provider-factory';

interface CheckStatusRequest {
  orderId: string;
}

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // Get auth token
    const accessToken = cookies.get('sb-access-token')?.value;
    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get authenticated user
    const supabaseAuth = createServerClientWithToken(accessToken);
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid session' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: CheckStatusRequest = await request.json();
    const { orderId } = body;

    if (!orderId) {
      return new Response(
        JSON.stringify({ error: 'Order ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get order details
    const supabase = getServerClient();
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify order belongs to user
    if (order.customer_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // If payment is already completed or failed, return current status
    if (['completed', 'failed', 'refunded'].includes(order.payment_status)) {
      return new Response(
        JSON.stringify({
          status: order.payment_status,
          paidAt: order.paid_at,
          amount: order.amount_paid,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Get provider reference
    const providerName = order.payment_provider;
    const reference = providerName === 'stripe'
      ? order.stripe_checkout_session
      : order.campay_reference;

    if (!providerName || !reference) {
      return new Response(
        JSON.stringify({
          status: 'pending',
          message: 'Payment not yet initiated',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Get provider
    const provider = getProviderById(providerName);
    if (!provider) {
      return new Response(
        JSON.stringify({ error: 'Invalid payment provider' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check payment status with provider
    const statusResult = await provider.verifyPayment({
      sessionId: reference,
      orderId: order.id,
    });

    // Update order if status changed
    if (statusResult.status !== order.payment_status) {
      const updateData: Record<string, unknown> = {
        payment_status: statusResult.status,
        updated_at: new Date().toISOString(),
      };

      if (statusResult.status === 'completed') {
        updateData.paid_at = statusResult.paidAt?.toISOString() ?? new Date().toISOString();
        updateData.amount_paid = statusResult.paidAmount ?? order.amount_expected;
        updateData.status = 'paid';

        if (providerName === 'stripe' && statusResult.transactionId) {
          updateData.stripe_payment_intent = statusResult.transactionId;
        }
      }

      await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId);

      // Log status change
      await supabase.from('payment_events').insert({
        order_id: orderId,
        provider: providerName,
        event_type: `status_${statusResult.status}`,
        reference,
        amount: statusResult.paidAmount,
        metadata: statusResult.rawResponse,
      });

      // Log order status change if payment completed
      if (statusResult.status === 'completed') {
        await supabase.from('order_status_history').insert({
          order_id: orderId,
          status: 'paid',
          notes: `Payment completed via ${providerName}`,
        });
      }
    }

    return new Response(
      JSON.stringify({
        status: statusResult.status,
        paidAt: statusResult.paidAt?.toISOString(),
        amount: statusResult.paidAmount,
        transactionId: statusResult.transactionId,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Check payment status error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
