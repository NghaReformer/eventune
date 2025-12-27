/**
 * API: Create Package
 * POST /api/admin/content/packages/create
 *
 * Security: Admin auth, content:update permission, rate limiting, audit logging
 */

import type { APIRoute } from 'astro';
import { getAdminSession, hasPermission } from '../../../../../lib/auth/admin-session';
import { validateCSRFToken } from '../../../../../lib/auth/session';
import { createPackage } from '../../../../../services/admin.service';
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
    const { csrf_token, ...packageData } = body;

    // CSRF validation
    if (!validateCSRFToken(cookies, csrf_token || null)) {
      return new Response(
        JSON.stringify({ error: 'Invalid security token. Please refresh and try again.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate required fields
    if (!packageData.slug || !packageData.name || !packageData.price_usd || !packageData.price_xaf) {
      return new Response(
        JSON.stringify({ error: 'Slug, name, and prices are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create package
    const result = await createPackage({
      slug: packageData.slug,
      name: packageData.name,
      description: packageData.description || null,
      price_usd: parseFloat(packageData.price_usd),
      price_xaf: parseFloat(packageData.price_xaf),
      song_length_min: parseInt(packageData.song_length_min) || 2,
      song_length_max: parseInt(packageData.song_length_max) || 4,
      delivery_days_min: parseInt(packageData.delivery_days_min) || 7,
      delivery_days_max: parseInt(packageData.delivery_days_max) || 14,
      revision_count: parseInt(packageData.revision_count) || 0,
      includes_discovery_call: packageData.includes_discovery_call === true,
      includes_instrumental: packageData.includes_instrumental === true,
      includes_full_rights: packageData.includes_full_rights === true,
      is_popular: packageData.is_popular === true,
      is_active: packageData.is_active !== false,
      display_order: parseInt(packageData.display_order) || 10,
    });

    if (!result.success) {
      return new Response(
        JSON.stringify({ error: result.error || 'Failed to create package' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Audit log
    await logAdminAction({
      admin_id: adminSession.data.user.id,
      admin_email: adminSession.data.user.email,
      admin_role: adminSession.data.adminRole,
      action: 'package.create',
      resource_type: 'package',
      resource_id: result.id,
      metadata: { slug: packageData.slug, name: packageData.name },
      ip_address: clientAddress,
      user_agent: request.headers.get('user-agent') || undefined,
    });

    return new Response(
      JSON.stringify({ success: true, id: result.id }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[ADMIN] Package create error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
