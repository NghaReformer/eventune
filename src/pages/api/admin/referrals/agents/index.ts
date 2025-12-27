/**
 * API: List Referral Agents
 * GET /api/admin/referrals/agents
 *
 * Security: Admin auth, referrals:view permission, rate limiting
 */

import type { APIRoute } from 'astro';
import { getAdminSession, hasPermission } from '../../../../../lib/auth/admin-session';
import { getAgentsList } from '../../../../../services/admin-referral.service';
import { checkRateLimit } from '../../../../../lib/security/validation';

export const GET: APIRoute = async ({ url, cookies, clientAddress }) => {
  // Rate limiting
  const rateLimit = checkRateLimit(clientAddress, 'admin-referral-list', 30, 60000);

  if (!rateLimit.allowed) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(Math.ceil(rateLimit.resetIn / 1000)),
      },
    });
  }

  // Admin authentication
  const adminSession = await getAdminSession(cookies);
  if (!adminSession.success) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Permission check
  if (!hasPermission(adminSession.data.permissions, 'referrals:view')) {
    return new Response(JSON.stringify({ error: 'Referrals view permission required' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Extract filters from query params
    const searchParams = url.searchParams;
    const filters: any = {};

    if (searchParams.get('program')) filters.program = searchParams.get('program');
    if (searchParams.get('status')) filters.status = searchParams.get('status');
    if (searchParams.get('tier')) filters.tier = parseInt(searchParams.get('tier')!);
    if (searchParams.get('search')) filters.search = searchParams.get('search');
    if (searchParams.get('has_earnings') !== null) {
      filters.has_earnings = searchParams.get('has_earnings') === 'true';
    }
    if (searchParams.get('page')) filters.page = parseInt(searchParams.get('page')!);
    if (searchParams.get('limit')) filters.limit = parseInt(searchParams.get('limit')!);
    if (searchParams.get('sort_by')) filters.sort_by = searchParams.get('sort_by');
    if (searchParams.get('sort_order')) filters.sort_order = searchParams.get('sort_order');

    const result = await getAgentsList(filters);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[ADMIN API] Error fetching agents:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
