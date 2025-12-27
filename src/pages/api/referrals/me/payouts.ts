/**
 * GET /api/referrals/me/payouts - List payout history
 * POST /api/referrals/me/payouts - Request new payout
 */

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { getSession } from '../../../../lib/auth/session';
import { getAgentPayouts, requestPayout, getAgentProfile } from '../../../../services/referral.service';

const payoutRequestSchema = z.object({
  amount: z.number().positive(),
  currency: z.enum(['USD', 'XAF']),
});

export const GET: APIRoute = async ({ request, cookies }) => {
  // Authenticate user
  const session = await getSession(cookies);
  if (!session.success) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const userId = session.data.user.id;

  try {
    const payouts = await getAgentPayouts(userId);

    return new Response(
      JSON.stringify({ payouts }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[GET /api/referrals/me/payouts] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const POST: APIRoute = async ({ request, cookies }) => {
  // Authenticate user
  const session = await getSession(cookies);
  if (!session.success) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const userId = session.data.user.id;

  try {
    // Parse and validate request body
    const body = await request.json();
    const validation = payoutRequestSchema.safeParse(body);

    if (!validation.success) {
      return new Response(
        JSON.stringify({
          error: 'Invalid request body',
          details: validation.error.flatten().fieldErrors,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { amount, currency } = validation.data;

    // Verify agent profile exists
    const profile = await getAgentProfile(userId);
    if (!profile) {
      return new Response(
        JSON.stringify({ error: 'Agent profile not found. Please join the referral program first.' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if agent is active
    if (profile.status !== 'active') {
      return new Response(
        JSON.stringify({ error: `Your account is ${profile.status}. Please contact support.` }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Request payout
    const result = await requestPayout(userId, amount, currency);

    if (!result.success) {
      return new Response(
        JSON.stringify({ error: result.error }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        payout: result.data,
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[POST /api/referrals/me/payouts] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
