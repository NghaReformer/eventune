/**
 * API: Create Questionnaire Field
 * POST /api/admin/content/questionnaire/create
 *
 * Security: Admin auth, content:update permission, CSRF protection
 */

import type { APIRoute } from 'astro';
import { getAdminSession, hasPermission } from '../../../../../lib/auth/admin-session';
import { validateCSRFToken } from '../../../../../lib/auth/session';
import { createQuestionnaireField } from '../../../../../services/admin.service';
import { logAdminAction } from '../../../../../lib/audit/logger';
import { checkRateLimit } from '../../../../../lib/security/validation';
import { ADMIN_CONFIG } from '../../../../../config/admin.constants';

export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  // Rate limiting
  const rateLimit = checkRateLimit(
    clientAddress,
    'admin-content-create',
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
    const { csrf_token, ...fieldData } = body;

    // CSRF validation
    if (!validateCSRFToken(cookies, csrf_token || null)) {
      return new Response(
        JSON.stringify({ error: 'Invalid security token. Please refresh and try again.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate required fields
    if (!fieldData.field_name || !fieldData.field_label || !fieldData.field_type) {
      return new Response(
        JSON.stringify({ error: 'Field name, label, and type are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create field
    const result = await createQuestionnaireField({
      occasion_slug: fieldData.occasion_slug || null,
      field_name: fieldData.field_name,
      field_type: fieldData.field_type,
      field_label: fieldData.field_label,
      placeholder: fieldData.placeholder || null,
      help_text: fieldData.help_text || null,
      required: fieldData.required !== false,
      display_order: fieldData.display_order || 10,
      options: fieldData.options || null,
      field_group: fieldData.field_group || 'additional',
      validation_rules: fieldData.validation_rules || null,
      is_active: fieldData.is_active !== false,
    });

    if (!result.success) {
      return new Response(
        JSON.stringify({ error: result.error || 'Failed to create field' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Audit log
    await logAdminAction({
      admin_id: adminSession.data.user.id,
      admin_email: adminSession.data.user.email,
      admin_role: adminSession.data.adminRole,
      action: 'questionnaire_field.create',
      resource_type: 'questionnaire_field',
      resource_id: result.id,
      metadata: { field_name: fieldData.field_name, occasion_slug: fieldData.occasion_slug },
      ip_address: clientAddress,
      user_agent: request.headers.get('user-agent') || undefined,
    });

    return new Response(
      JSON.stringify({ success: true, id: result.id }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[ADMIN] Questionnaire field create error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
