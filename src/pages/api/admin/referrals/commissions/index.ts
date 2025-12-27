/**
 * API: List/Bulk Approve Commissions
 * GET/POST /api/admin/referrals/commissions
 *
 * Security: Admin auth, referrals permissions, rate limiting, audit logging
 */

import type { APIRoute } from 'astro';
import { getAdminSession, hasPermission } from '../../../../../lib/auth/admin-session';
import { validateCSRFToken } from '../../../../../lib/auth/session';
import { getCommissionsList, bulkApproveCommissions } from '../../../../../services/admin-referral.service';
import { logAdminAction } from '../../../../../lib/audit/logger';
import { checkRateLimit } from '../../../../../lib/security/validation';

export const GET: APIRoute = async ({ url, cookies, clientAddress }) => {
  // Rate limiting
  const rateLimit = checkRateLimit(clientAddress, 'admin-commission-list', 30, 60000);

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

    if (searchParams.get('status')) filters.status = searchParams.get('status');
    if (searchParams.get('currency')) filters.currency = searchParams.get('currency');
    if (searchParams.get('referrer_id')) filters.referrer_id = searchParams.get('referrer_id');
    if (searchParams.get('order_id')) filters.order_id = searchParams.get('order_id');
    if (searchParams.get('level')) filters.level = parseInt(searchParams.get('level')!);
    if (searchParams.get('min_amount')) filters.min_amount = parseFloat(searchParams.get('min_amount')!);
    if (searchParams.get('max_amount')) filters.max_amount = parseFloat(searchParams.get('max_amount')!);
    if (searchParams.get('date_from')) filters.date_from = searchParams.get('date_from');
    if (searchParams.get('date_to')) filters.date_to = searchParams.get('date_to');
    if (searchParams.get('page')) filters.page = parseInt(searchParams.get('page')!);
    if (searchParams.get('limit')) filters.limit = parseInt(searchParams.get('limit')!);
    if (searchParams.get('sort_by')) filters.sort_by = searchParams.get('sort_by');
    if (searchParams.get('sort_order')) filters.sort_order = searchParams.get('sort_order');

    const result = await getCommissionsList(filters);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[ADMIN API] Error fetching commissions:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  // Rate limiting
  const rateLimit = checkRateLimit(clientAddress, 'admin-commission-bulk', 10, 60000);

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
  if (!hasPermission(adminSession.data.permissions, 'referrals:manage')) {
    return new Response(JSON.stringify({ error: 'Referrals manage permission required' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();
    const { csrf_token, ids, action } = body;

    // CSRF validation
    if (!validateCSRFToken(cookies, csrf_token || null)) {
      return new Response(
        JSON.stringify({ error: 'Invalid security token. Please refresh and try again.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return new Response(JSON.stringify({ error: 'Commission IDs array required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (action !== 'approve') {
      return new Response(JSON.stringify({ error: 'Only approve action is supported for bulk operations' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await bulkApproveCommissions(ids, adminSession.data.user.id);

    if (!result.success) {
      return new Response(JSON.stringify({ error: result.error || 'Failed to approve commissions' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Audit log
    await logAdminAction({
      admin_id: adminSession.data.user.id,
      admin_email: adminSession.data.user.email,
      admin_role: adminSession.data.adminRole,
      action: 'referral.commission_bulk_approve' as any,
      resource_type: 'referral' as any,
      resource_id: ids[0] || '',
      metadata: { count: result.approved, total_requested: ids.length },
      ip_address: clientAddress,
      user_agent: request.headers.get('user-agent') || undefined,
    });

    return new Response(JSON.stringify({ success: true, approved: result.approved }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[ADMIN API] Error bulk approving commissions:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
