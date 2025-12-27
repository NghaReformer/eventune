/**
 * GET /api/referrals/me
 * Returns agent profile, stats, and referral link
 */

import type { APIRoute } from 'astro';
import { getSession } from '../../../lib/auth/session';
import { getAgentDashboardStats } from '../../../services/referral.service';

export const GET: APIRoute = async ({ request, cookies, url }) => {
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
    // Get base URL for referral link generation
    const baseUrl = `${url.protocol}//${url.host}`;

    const stats = await getAgentDashboardStats(userId, baseUrl);

    if (!stats) {
      return new Response(
        JSON.stringify({ error: 'Agent profile not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(stats),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[GET /api/referrals/me] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
