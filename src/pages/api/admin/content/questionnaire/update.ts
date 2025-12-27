/**
 * API: Update Questionnaire Field
 * POST /api/admin/content/questionnaire/update
 *
 * Security: Admin auth, content:update permission, CSRF protection
 */

import type { APIRoute } from 'astro';
import { getAdminSession, hasPermission } from '../../../../../lib/auth/admin-session';
import { validateCSRFToken } from '../../../../../lib/auth/session';
import { updateQuestionnaireField } from '../../../../../services/admin.service';
import { logAdminAction } from '../../../../../lib/audit/logger';
import { checkRateLimit } from '../../../../../lib/security/validation';
import { ADMIN_CONFIG } from '../../../../../config/admin.constants';

export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  // Rate limiting
  const rateLimit = checkRateLimit(
    clientAddress,
    'admin-content-update',
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
    const { csrf_token, id, ...fieldData } = body;

    // CSRF validation
    if (!validateCSRFToken(cookies, csrf_token || null)) {
      return new Response(
        JSON.stringify({ error: 'Invalid security token. Please refresh and try again.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!id) {
      return new Response(
        JSON.stringify({ error: 'Field ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Update field
    const result = await updateQuestionnaireField(id, fieldData);

    if (!result.success) {
      return new Response(
        JSON.stringify({ error: result.error || 'Failed to update field' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Audit log
    await logAdminAction({
      admin_id: adminSession.data.user.id,
      admin_email: adminSession.data.user.email,
      admin_role: adminSession.data.adminRole,
      action: 'questionnaire_field.update',
      resource_type: 'questionnaire_field',
      resource_id: id,
      metadata: { updates: Object.keys(fieldData) },
      ip_address: clientAddress,
      user_agent: request.headers.get('user-agent') || undefined,
    });

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[ADMIN] Questionnaire field update error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
