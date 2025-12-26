/**
 * Create CamPay Mobile Money Session API
 * Initiates a mobile money payment for XAF orders
 */

import type { APIRoute } from 'astro';
import { createServerClientWithToken, getServerClient } from '@/lib/supabase/server';
import { enforceRateLimit } from '@/lib/security/rate-limiter';
import { getProviderForCurrency } from '@/lib/payments/provider-factory';
import { normalizePhoneNumber, getCarrier } from '@/lib/utils/phone';
import type { PaymentMethodType } from '@/lib/payments/types';

interface CreateSessionRequest {
  orderId: string;
  phoneNumber: string;
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
    const { orderId, phoneNumber } = body;

    if (!orderId) {
      return new Response(
        JSON.stringify({ error: 'Order ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!phoneNumber) {
      return new Response(
        JSON.stringify({ error: 'Phone number is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate and normalize phone number
    const phoneResult = normalizePhoneNumber(phoneNumber, 'CM');
    if (!phoneResult.valid || !phoneResult.phone) {
      return new Response(
        JSON.stringify({ error: phoneResult.error ?? 'Invalid phone number' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Determine carrier/operator
    const carrier = getCarrier(phoneNumber);
    if (!carrier || carrier === 'unknown') {
      return new Response(
        JSON.stringify({ error: 'Unable to detect mobile carrier. Please use an MTN or Orange number.' }),
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

    // Verify currency is XAF
    if (order.currency !== 'XAF') {
      return new Response(
        JSON.stringify({ error: 'CamPay only supports XAF payments' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get CamPay provider
    const provider = getProviderForCurrency('XAF');
    const baseUrl = new URL(request.url).origin;

    // Determine payment method type
    const methodType: PaymentMethodType = carrier === 'mtn' ? 'mtn_momo' : 'orange_money';

    // Initiate payment
    const result = await provider.initiatePayment({
      orderId: order.id,
      orderNumber: order.order_number,
      amount: order.amount_expected,
      currency: 'XAF',
      customerEmail: order.customer_email,
      customerName: order.customer_name ?? '',
      customerPhone: phoneResult.phone.e164,
      methodType,
      successUrl: `${baseUrl}/order/success?order_id=${order.id}`,
      cancelUrl: `${baseUrl}/order/checkout?order_id=${order.id}&cancelled=true`,
      metadata: {
        orderId: order.id,
        packageSlug: order.package_slug ?? '',
        occasionSlug: order.occasion_slug ?? '',
        carrier,
      },
    });

    if (!result.success) {
      console.error('CamPay session creation failed:', result.error);
      return new Response(
        JSON.stringify({ error: result.error ?? 'Failed to create payment session' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Update order with CamPay reference
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        campay_reference: result.sessionId,
        campay_operator: carrier.toUpperCase(),
        payment_provider: 'campay',
        payment_method: methodType,
        payment_status: 'processing',
        customer_phone: phoneResult.phone.e164,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (updateError) {
      console.error('Failed to update order with reference:', updateError);
    }

    // Log payment event
    await supabase.from('payment_events').insert({
      order_id: orderId,
      provider: 'campay',
      event_type: 'session_created',
      reference: result.sessionId,
      metadata: {
        operator: carrier.toUpperCase(),
        phone: phoneResult.phone.e164,
        expiresAt: result.expiresAt.toISOString(),
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        reference: result.sessionId,
        ussdCode: result.ussdCode,
        operator: carrier.toUpperCase(),
        expiresAt: result.expiresAt.toISOString(),
        instructions: carrier === 'mtn'
          ? 'Dial *126# to approve the payment prompt on your phone'
          : 'Dial #150*50# to approve the payment prompt on your phone',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Create CamPay session error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
