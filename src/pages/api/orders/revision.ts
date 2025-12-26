/**
 * Order Revision Request API Endpoint
 * Handles revision requests with CSRF, ownership validation, and input sanitization
 */
import type { APIRoute } from 'astro';
import { getServerClient } from '../../../lib/supabase/server';
import { getSession, validateCSRFToken } from '../../../lib/auth/session';
import {
  sanitizeRevisionNotes,
  isValidUUID,
  validateOrderOwnership,
  checkRateLimit,
} from '../../../lib/security/validation';

export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  // Rate limiting for revision requests
  const rateLimitKey = clientAddress || 'unknown';
  const rateLimit = checkRateLimit(rateLimitKey, 'revision-request', 5, 300000); // 5 per 5 minutes

  if (!rateLimit.allowed) {
    return new Response(
      JSON.stringify({
        error: 'Too many revision requests. Please wait before trying again.',
        resetIn: Math.ceil(rateLimit.resetIn / 1000),
      }),
      {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Validate session
  const sessionResult = await getSession(cookies);
  if (!sessionResult.success) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { user } = sessionResult.data;

  try {
    const formData = await request.formData();

    // Validate CSRF token
    const csrfToken = formData.get('csrf_token') as string;
    if (!validateCSRFToken(cookies, csrfToken)) {
      return new Response(JSON.stringify({ error: 'Invalid security token. Please refresh and try again.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const orderId = formData.get('order_id') as string;
    const notes = formData.get('notes') as string;

    // Validate order ID format
    if (!orderId || !isValidUUID(orderId)) {
      return new Response(JSON.stringify({ error: 'Invalid order ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Sanitize notes
    const sanitizedNotes = sanitizeRevisionNotes(notes);
    if (!sanitizedNotes || sanitizedNotes.length < 10) {
      return new Response(JSON.stringify({ error: 'Please provide more details about the changes you want (minimum 10 characters)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verify order ownership
    const supabase = getServerClient();
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, customer_id, status')
      .eq('id', orderId)
      .single();

    if (orderError || !validateOrderOwnership(order, user.id)) {
      console.warn(`Revision IDOR attempt: User ${user.id} tried to revise order ${orderId}`);
      return new Response(JSON.stringify({ error: 'Order not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if order status allows revision
    const revisionAllowedStatuses = ['completed', 'delivered'];
    if (!revisionAllowedStatuses.includes(order.status)) {
      return new Response(
        JSON.stringify({
          error: 'Revisions can only be requested for completed or delivered orders',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Create revision request
    const { error: insertError } = await supabase.from('revision_requests').insert({
      order_id: orderId,
      customer_id: user.id,
      notes: sanitizedNotes,
      status: 'pending',
      created_at: new Date().toISOString(),
    });

    if (insertError) {
      // If table doesn't exist yet, log but don't fail
      console.error('Revision request insert error:', insertError);

      // Fallback: Update order status to revision and add to status history
      await supabase.from('order_status_history').insert({
        order_id: orderId,
        status: 'revision',
        note: `Revision requested: ${sanitizedNotes}`,
        created_at: new Date().toISOString(),
      });

      await supabase
        .from('orders')
        .update({
          status: 'revision',
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Revision request submitted successfully. Our team will review it shortly.',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Revision request error:', error);
    return new Response(JSON.stringify({ error: 'An unexpected error occurred' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
