/**
 * API: Approve/Reject Commission
 * PATCH /api/admin/referrals/commissions/[id]
 *
 * Security: Admin auth, referrals:manage permission, rate limiting, audit logging
 */

import type { APIRoute } from 'astro';
import { getAdminSession, hasPermission } from '../../../../../lib/auth/admin-session';
import { validateCSRFToken } from '../../../../../lib/auth/session';
import { approveCommission, rejectCommission } from '../../../../../services/admin-referral.service';
import { logAdminAction } from '../../../../../lib/audit/logger';
import { checkRateLimit } from '../../../../../lib/security/validation';

export const PATCH: APIRoute = async ({ params, request, cookies, clientAddress }) => {
  // Rate limiting
  const rateLimit = checkRateLimit(clientAddress, 'admin-commission-action', 20, 60000);

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
    const { id } = params;
    if (!id) {
      return new Response(JSON.stringify({ error: 'Commission ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { csrf_token, action, reason } = body;

    // CSRF validation
    if (!validateCSRFToken(cookies, csrf_token || null)) {
      return new Response(
        JSON.stringify({ error: 'Invalid security token. Please refresh and try again.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!action || !['approve', 'reject'].includes(action)) {
      return new Response(JSON.stringify({ error: 'Valid action (approve or reject) required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let result;
    if (action === 'approve') {
      result = await approveCommission(id, adminSession.data.user.id);
    } else {
      if (!reason) {
        return new Response(JSON.stringify({ error: 'Rejection reason required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      result = await rejectCommission(id, adminSession.data.user.id, reason);
    }

    if (!result.success) {
      return new Response(JSON.stringify({ error: result.error || 'Failed to update commission' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Audit log
    await logAdminAction({
      admin_id: adminSession.data.user.id,
      admin_email: adminSession.data.user.email,
      admin_role: adminSession.data.adminRole,
      action: `referral.commission_${action}` as any,
      resource_type: 'referral' as any,
      resource_id: id,
      metadata: action === 'reject' ? { reason } : {},
      ip_address: clientAddress,
      user_agent: request.headers.get('user-agent') || undefined,
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[ADMIN API] Error updating commission:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
