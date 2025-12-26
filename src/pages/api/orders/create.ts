/**
 * Create Order API
 * Creates a new order and returns checkout session
 */

import type { APIRoute } from 'astro';
import { getServerClient, createServerClientWithToken } from '@/lib/supabase/server';
import { enforceRateLimit } from '@/lib/security/rate-limiter';
import { encrypt } from '@/lib/security/encryption';
import { getPackageBySlug, getOccasionBySlug, hasCapacity } from '@/services/config.service';

interface CreateOrderRequest {
  package_slug: string;
  occasion_slug: string;
  questionnaire: {
    recipient_name: string;
    recipient_relationship: string;
    occasion_date?: string;
    story: string;
    music_preferences?: string;
    special_requests?: string;
  };
  currency: 'USD' | 'XAF';
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
    const body: CreateOrderRequest = await request.json();
    const { package_slug, occasion_slug, questionnaire, currency } = body;

    // Validate required fields
    if (!package_slug || !occasion_slug || !questionnaire || !currency) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate currency
    if (!['USD', 'XAF'].includes(currency)) {
      return new Response(
        JSON.stringify({ error: 'Invalid currency' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get package and occasion
    const [pkg, occasion] = await Promise.all([
      getPackageBySlug(package_slug),
      getOccasionBySlug(occasion_slug),
    ]);

    if (!pkg) {
      return new Response(
        JSON.stringify({ error: 'Invalid package' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!occasion) {
      return new Response(
        JSON.stringify({ error: 'Invalid occasion' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check capacity for delivery date if specified
    if (questionnaire.occasion_date) {
      const deliveryDate = new Date(questionnaire.occasion_date);
      const capacityAvailable = await hasCapacity(deliveryDate.toISOString().split('T')[0]);
      if (!capacityAvailable) {
        return new Response(
          JSON.stringify({
            error: 'No availability for the requested date. Please choose a different date.',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Calculate price
    const price = currency === 'USD' ? pkg.price_usd : pkg.price_xaf;

    // Encrypt sensitive questionnaire data
    const encryptedQuestionnaire = await encrypt(JSON.stringify(questionnaire));

    // Use server client for order creation
    const supabase = getServerClient();

    // Create order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        customer_id: user.id,
        customer_email: user.email!,
        customer_name: questionnaire.recipient_name,
        package_slug: package_slug,
        occasion_slug: occasion_slug,
        status: 'pending_payment',
        payment_status: 'pending',
        currency,
        amount_expected: price,
        due_date: questionnaire.occasion_date || null,
      })
      .select()
      .single();

    if (orderError) {
      console.error('Order creation error:', orderError);
      return new Response(
        JSON.stringify({ error: 'Failed to create order' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create questionnaire record
    const { error: questionnaireError } = await supabase
      .from('questionnaires')
      .insert({
        order_id: order.id,
        encrypted_data: encryptedQuestionnaire,
        recipient_name: questionnaire.recipient_name,
      });

    if (questionnaireError) {
      console.error('Questionnaire creation error:', questionnaireError);
      // Clean up order on failure
      await supabase.from('orders').delete().eq('id', order.id);
      return new Response(
        JSON.stringify({ error: 'Failed to save questionnaire' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Log order creation
    await supabase.from('order_status_history').insert({
      order_id: order.id,
      status: 'pending_payment',
      notes: 'Order created',
    });

    return new Response(
      JSON.stringify({
        success: true,
        order_id: order.id,
        amount: price,
        currency,
        package_name: pkg.name,
        occasion_name: occasion.name,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Create order error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
