/**
 * Referral Apply API Endpoint
 * Applies a referral code to the authenticated user
 */

import type { APIRoute } from 'astro';
import { createServerClient } from '@/lib/supabase/server';

interface ApplyReferralRequest {
  referral_code: string;
}

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // Parse request body
    const body = (await request.json()) as ApplyReferralRequest;
    const { referral_code } = body;

    if (!referral_code || typeof referral_code !== 'string') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Referral code is required',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Get authenticated user
    const supabase = createServerClient(request, cookies);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Unauthorized - please log in first',
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate referral code format (4-20 alphanumeric characters, hyphens, underscores)
    const codePattern = /^[a-zA-Z0-9_-]{4,20}$/;
    if (!codePattern.test(referral_code)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid referral code format',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Check if user already has a referrer
    const { data: existingReferral } = await supabase
      .from('referrals')
      .select('id, referrer_id')
      .eq('referee_id', user.id)
      .single();

    if (existingReferral) {
      console.log(
        `[Referral Apply] User ${user.id} already has a referrer, skipping attribution`
      );
      return new Response(
        JSON.stringify({
          success: false,
          message: 'You already have a referrer assigned',
          already_attributed: true,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Apply referral code using database function
    const { data: result, error: applyError } = await supabase.rpc('apply_referral_code', {
      code: referral_code.toLowerCase().trim(),
    });

    if (applyError) {
      console.error('[Referral Apply] Database error:', applyError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to apply referral code',
          details: applyError.message,
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Check if application was successful
    if (result === false) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid referral code or self-referral not allowed',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`[Referral Apply] Successfully applied referral code ${referral_code} to user ${user.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Referral code applied successfully',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[Referral Apply] Unexpected error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
