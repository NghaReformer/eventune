/**
 * API: Get/Update Referral Agent
 * GET/PATCH /api/admin/referrals/agents/[id]
 *
 * Security: Admin auth, referrals permissions, rate limiting, audit logging
 */

import type { APIRoute } from 'astro';
import { getAdminSession, hasPermission } from '../../../../../lib/auth/admin-session';
import { validateCSRFToken } from '../../../../../lib/auth/session';
import { getAgentById, updateAgent } from '../../../../../services/admin-referral.service';
import { logAdminAction } from '../../../../../lib/audit/logger';
import { checkRateLimit } from '../../../../../lib/security/validation';

export const GET: APIRoute = async ({ params, cookies, clientAddress }) => {
  // Rate limiting
  const rateLimit = checkRateLimit(clientAddress, 'admin-referral-view', 60, 60000);

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
    const { id } = params;
    if (!id) {
      return new Response(JSON.stringify({ error: 'Agent ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const agent = await getAgentById(id);

    if (!agent) {
      return new Response(JSON.stringify({ error: 'Agent not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, agent }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[ADMIN API] Error fetching agent:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const PATCH: APIRoute = async ({ params, request, cookies, clientAddress }) => {
  // Rate limiting
  const rateLimit = checkRateLimit(clientAddress, 'admin-referral-update', 20, 60000);

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
      return new Response(JSON.stringify({ error: 'Agent ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json();
    const { csrf_token, ...updates } = body;

    // CSRF validation
    if (!validateCSRFToken(cookies, csrf_token || null)) {
      return new Response(
        JSON.stringify({ error: 'Invalid security token. Please refresh and try again.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const result = await updateAgent(id, updates);

    if (!result.success) {
      return new Response(JSON.stringify({ error: result.error || 'Failed to update agent' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Audit log
    await logAdminAction({
      admin_id: adminSession.data.user.id,
      admin_email: adminSession.data.user.email,
      admin_role: adminSession.data.adminRole,
      action: 'referral.agent_update' as any,
      resource_type: 'referral' as any,
      resource_id: id,
      metadata: updates,
      ip_address: clientAddress,
      user_agent: request.headers.get('user-agent') || undefined,
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[ADMIN API] Error updating agent:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
