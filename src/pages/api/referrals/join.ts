/**
 * POST /api/referrals/join
 * Join the referral program and become an agent
 */

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { getSession } from '../../../lib/auth/session';
import { getServerClient } from '../../../lib/supabase/server';

const joinSchema = z.object({
  program_slug: z.string().default('standard'),
  parent_code: z.string().optional(),
});

export const POST: APIRoute = async ({ request, cookies }) => {
  // Authenticate user
  const session = await getSession(cookies);
  if (!session.success) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Parse and validate request body
    const body = await request.json().catch(() => ({}));
    const validation = joinSchema.safeParse(body);

    if (!validation.success) {
      return new Response(
        JSON.stringify({
          error: 'Invalid request body',
          details: validation.error.flatten().fieldErrors,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { program_slug, parent_code } = validation.data;

    // Call the enhanced RPC function
    const supabase = getServerClient();
    const { data, error } = await supabase.rpc('join_referral_program_v2', {
      program_slug,
      parent_code: parent_code || null,
    });

    if (error) {
      console.error('[POST /api/referrals/join] RPC error:', error);

      // Provide user-friendly error messages
      if (error.message.includes('already has a referral profile')) {
        return new Response(
          JSON.stringify({ error: 'You are already enrolled in the referral program' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (error.message.includes('does not allow self-signup')) {
        return new Response(
          JSON.stringify({ error: 'This program requires an invitation to join' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        user_id: data,
        message: 'Successfully joined the referral program',
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[POST /api/referrals/join] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
