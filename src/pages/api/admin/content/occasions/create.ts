/**
 * API: Create Occasion
 * POST /api/admin/content/occasions/create
 *
 * Security: Admin auth, content:update permission, rate limiting, audit logging
 */

import type { APIRoute } from 'astro';
import { getAdminSession, hasPermission } from '../../../../../lib/auth/admin-session';
import { validateCSRFToken } from '../../../../../lib/auth/session';
import { createOccasion } from '../../../../../services/admin.service';
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
    const { csrf_token, ...occasionData } = body;

    // CSRF validation
    if (!validateCSRFToken(cookies, csrf_token || null)) {
      return new Response(
        JSON.stringify({ error: 'Invalid security token. Please refresh and try again.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate required fields
    if (!occasionData.slug || !occasionData.name) {
      return new Response(
        JSON.stringify({ error: 'Slug and name are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create occasion
    const result = await createOccasion({
      slug: occasionData.slug,
      name: occasionData.name,
      description: occasionData.description || null,
      tagline: occasionData.tagline || null,
      icon: occasionData.icon || null,
      meta_title: occasionData.meta_title || null,
      meta_description: occasionData.meta_description || null,
      display_order: occasionData.display_order || 10,
      is_active: occasionData.is_active !== false,
    });

    if (!result.success) {
      return new Response(
        JSON.stringify({ error: result.error || 'Failed to create occasion' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Audit log
    await logAdminAction({
      admin_id: adminSession.data.user.id,
      admin_email: adminSession.data.user.email,
      admin_role: adminSession.data.adminRole,
      action: 'occasion.create',
      resource_type: 'occasion',
      resource_id: result.id,
      metadata: { slug: occasionData.slug, name: occasionData.name },
      ip_address: clientAddress,
      user_agent: request.headers.get('user-agent') || undefined,
    });

    return new Response(
      JSON.stringify({ success: true, id: result.id }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[ADMIN] Occasion create error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
