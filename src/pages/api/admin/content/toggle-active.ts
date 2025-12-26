/**
 * API: Toggle Content Active Status
 * POST /api/admin/content/toggle-active
 *
 * Security: Admin auth, content:update permission, rate limiting, audit logging
 */

import type { APIRoute } from 'astro';
import { getAdminSession, hasPermission } from '../../../../lib/auth/admin-session';
import { validateCSRFToken } from '../../../../lib/auth/session';
import { toggleContentActive } from '../../../../services/admin.service';
import { logAdminAction } from '../../../../lib/audit/logger';
import { checkRateLimit } from '../../../../lib/security/validation';
import { ADMIN_CONFIG } from '../../../../config/admin.constants';

const VALID_TABLES = ['config_packages', 'config_occasions', 'config_faq', 'config_testimonials'] as const;
type ValidTable = typeof VALID_TABLES[number];

export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  // Rate limiting
  const rateLimit = checkRateLimit(
    clientAddress,
    'admin-content-toggle',
    ADMIN_CONFIG.RATE_LIMITS.STATUS_UPDATE.requests,
    ADMIN_CONFIG.RATE_LIMITS.STATUS_UPDATE.window
  );

  if (!rateLimit.allowed) {
    return new Response(
      JSON.stringify({ error: 'Too many requests. Please wait.' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(Math.ceil(rateLimit.resetIn / 1000)),
        },
      }
    );
  }

  // Admin authentication
  const adminSession = await getAdminSession(cookies);
  if (!adminSession.success) {
    return new Response(
      JSON.stringify({ error: 'Authentication required' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Permission check
  if (!hasPermission(adminSession.data.permissions, 'content:update')) {
    return new Response(
      JSON.stringify({ error: 'Content update permission required' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await request.json();
    const { id, table, is_active, csrf_token } = body;

    // CSRF validation
    if (!validateCSRFToken(cookies, csrf_token || null)) {
      return new Response(
        JSON.stringify({ error: 'Invalid security token. Please refresh and try again.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate inputs
    if (!id || typeof id !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Invalid ID' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!VALID_TABLES.includes(table)) {
      return new Response(
        JSON.stringify({ error: 'Invalid table' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (typeof is_active !== 'boolean') {
      return new Response(
        JSON.stringify({ error: 'Invalid active status' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Toggle active status
    const result = await toggleContentActive(table as ValidTable, id, is_active);

    if (!result.success) {
      return new Response(
        JSON.stringify({ error: result.error || 'Failed to update' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Audit log
    await logAdminAction({
      admin_id: adminSession.data.user.id,
      admin_email: adminSession.data.user.email,
      admin_role: adminSession.data.adminRole,
      action: 'content.toggle_active',
      resource_type: 'content',
      resource_id: id,
      metadata: { table, is_active },
      ip_address: clientAddress,
      user_agent: request.headers.get('user-agent') || undefined,
    });

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[ADMIN] Content toggle error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
