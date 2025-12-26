/**
 * API: Add Order Note
 * POST /api/admin/orders/add-note
 *
 * Security: CSRF validation, admin auth, rate limiting, audit logging
 */

import type { APIRoute } from 'astro';
import { getAdminSession, hasPermission } from '../../../../lib/auth/admin-session';
import { validateCSRFToken } from '../../../../lib/auth/session';
import { addOrderNote } from '../../../../services/admin.service';
import { logAdminAction } from '../../../../lib/audit/logger';
import { checkRateLimit, isValidUUID } from '../../../../lib/security/validation';
import { ADMIN_CONFIG } from '../../../../config/admin.constants';

export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  // Rate limiting
  const rateLimit = checkRateLimit(
    clientAddress,
    'admin-note-add',
    ADMIN_CONFIG.RATE_LIMITS.NOTES_ADD.requests,
    ADMIN_CONFIG.RATE_LIMITS.NOTES_ADD.window
  );

  if (!rateLimit.allowed) {
    return new Response(
      JSON.stringify({ error: 'Too many requests. Please wait before trying again.' }),
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

  // Permission check - all admin roles can add notes
  if (!hasPermission(adminSession.data.permissions, 'orders:view')) {
    return new Response(
      JSON.stringify({ error: 'Insufficient permissions' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Parse form data
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid request body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // CSRF validation
  const csrfToken = formData.get('csrf_token')?.toString();
  if (!validateCSRFToken(cookies, csrfToken || null)) {
    return new Response(
      JSON.stringify({ error: 'Invalid security token. Please refresh and try again.' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Validate inputs
  const orderId = formData.get('order_id')?.toString();
  const content = formData.get('content')?.toString();

  if (!orderId || !isValidUUID(orderId)) {
    return new Response(
      JSON.stringify({ error: 'Invalid order ID' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!content || content.trim().length === 0) {
    return new Response(
      JSON.stringify({ error: 'Note content is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (content.length > ADMIN_CONFIG.SECURITY.MAX_NOTE_LENGTH) {
    return new Response(
      JSON.stringify({ error: `Note too long (max ${ADMIN_CONFIG.SECURITY.MAX_NOTE_LENGTH} characters)` }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Add note
  const result = await addOrderNote(
    orderId,
    adminSession.data.user.id,
    adminSession.data.user.email,
    content
  );

  if (!result.success) {
    return new Response(
      JSON.stringify({ error: result.error }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Audit log
  await logAdminAction({
    admin_id: adminSession.data.user.id,
    admin_email: adminSession.data.user.email,
    admin_role: adminSession.data.adminRole,
    action: 'order.note_add',
    resource_type: 'order',
    resource_id: orderId,
    metadata: { content_length: content.length },
    ip_address: clientAddress,
    user_agent: request.headers.get('user-agent') || undefined,
  });

  return new Response(
    JSON.stringify({ success: true, message: 'Note added successfully' }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};
