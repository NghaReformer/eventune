/**
 * GET /api/referrals/validate/[code]
 * Check if referral code is valid and active
 */

import type { APIRoute } from 'astro';
import { getServerClient } from '../../../../lib/supabase/server';

export const GET: APIRoute = async ({ params }) => {
  const { code } = params;

  if (!code) {
    return new Response(
      JSON.stringify({ error: 'Code parameter is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabase = getServerClient();

    // Look up referral code
    const { data: profile, error } = await supabase
      .from('referral_profiles')
      .select(`
        id,
        referral_code,
        status,
        program:referral_programs(name, is_active)
      `)
      .eq('referral_code', code)
      .single();

    if (error || !profile) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: 'Referral code not found',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if profile is active
    if (profile.status !== 'active') {
      return new Response(
        JSON.stringify({
          valid: false,
          error: 'This referral code is no longer active',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if program is active
    const program = profile.program as any;
    if (!program || !program.is_active) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: 'This referral program is no longer active',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        valid: true,
        program_name: program.name,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[GET /api/referrals/validate/:code] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
