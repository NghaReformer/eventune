/**
 * API: List Fraud Signals
 * GET /api/admin/referrals/fraud
 *
 * Security: Admin auth, referrals:view permission, rate limiting
 */

import type { APIRoute } from 'astro';
import { getAdminSession, hasPermission } from '../../../../../lib/auth/admin-session';
import { getFraudSignals } from '../../../../../services/admin-referral.service';
import { checkRateLimit } from '../../../../../lib/security/validation';

export const GET: APIRoute = async ({ url, cookies, clientAddress }) => {
  // Rate limiting
  const rateLimit = checkRateLimit(clientAddress, 'admin-fraud-list', 30, 60000);

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
    // Check if resolved filter is provided
    const searchParams = url.searchParams;
    const resolvedParam = searchParams.get('resolved');
    const resolved = resolvedParam !== null ? resolvedParam === 'true' : undefined;

    const signals = await getFraudSignals(resolved);

    return new Response(JSON.stringify({ success: true, signals }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[ADMIN API] Error fetching fraud signals:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
