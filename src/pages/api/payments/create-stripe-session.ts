/**
 * Create Stripe Checkout Session API
 * Initiates a Stripe payment for USD orders
 */

import type { APIRoute } from 'astro';
import { createServerClientWithToken, getServerClient } from '@/lib/supabase/server';
import { enforceRateLimit } from '@/lib/security/rate-limiter';
import { getProviderForCurrency } from '@/lib/payments/provider-factory';

interface CreateSessionRequest {
  orderId: string;
}

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // Rate limiting
    const rateLimitResponse = await enforceRateLimit('payment', request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

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
    const body: CreateSessionRequest = await request.json();
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

    // Verify order is pending payment
    if (order.payment_status !== 'pending') {
      return new Response(
        JSON.stringify({ error: 'Order is not pending payment' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify currency is USD
    if (order.currency !== 'USD') {
      return new Response(
        JSON.stringify({ error: 'Stripe only supports USD payments' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get Stripe provider
    const provider = getProviderForCurrency('USD');
    const baseUrl = new URL(request.url).origin;

    // Initiate payment
    const result = await provider.initiatePayment({
      orderId: order.id,
      orderNumber: order.order_number,
      amount: order.amount_expected,
      currency: 'USD',
      customerEmail: order.customer_email,
      customerName: order.customer_name ?? '',
      methodType: 'card',
      successUrl: `${baseUrl}/order/success?order_id=${order.id}`,
      cancelUrl: `${baseUrl}/order/checkout?order_id=${order.id}&cancelled=true`,
      metadata: {
        orderId: order.id,
        packageSlug: order.package_slug ?? '',
        occasionSlug: order.occasion_slug ?? '',
      },
    });

    if (!result.success) {
      console.error('Stripe session creation failed:', result.error);
      return new Response(
        JSON.stringify({ error: result.error ?? 'Failed to create payment session' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Update order with Stripe session ID
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        stripe_checkout_session: result.sessionId,
        payment_provider: 'stripe',
        payment_method: 'card',
        payment_status: 'processing',
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (updateError) {
      console.error('Failed to update order with session:', updateError);
    }

    // Log payment event
    await supabase.from('payment_events').insert({
      order_id: orderId,
      provider: 'stripe',
      event_type: 'session_created',
      reference: result.sessionId,
      metadata: { expiresAt: result.expiresAt.toISOString() },
    });

    return new Response(
      JSON.stringify({
        success: true,
        sessionId: result.sessionId,
        checkoutUrl: result.checkoutUrl,
        expiresAt: result.expiresAt.toISOString(),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Create Stripe session error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
