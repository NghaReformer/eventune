/**
 * API: Update Package
 * POST /api/admin/content/packages/update
 *
 * Security: Admin auth, content:update permission, rate limiting, audit logging
 */

import type { APIRoute } from 'astro';
import { getAdminSession, hasPermission } from '../../../../../lib/auth/admin-session';
import { validateCSRFToken } from '../../../../../lib/auth/session';
import { updatePackage } from '../../../../../services/admin.service';
import { logAdminAction } from '../../../../../lib/audit/logger';
import { checkRateLimit, isValidUUID } from '../../../../../lib/security/validation';
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
    const { id, csrf_token, ...packageData } = body;

    // CSRF validation
    if (!validateCSRFToken(cookies, csrf_token || null)) {
      return new Response(
        JSON.stringify({ error: 'Invalid security token. Please refresh and try again.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate ID
    if (!id || !isValidUUID(id)) {
      return new Response(
        JSON.stringify({ error: 'Valid package ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Update package
    const updateData: any = {};

    if (packageData.slug) updateData.slug = packageData.slug;
    if (packageData.name) updateData.name = packageData.name;
    if (packageData.description !== undefined) updateData.description = packageData.description || null;
    if (packageData.price_usd) updateData.price_usd = parseFloat(packageData.price_usd);
    if (packageData.price_xaf) updateData.price_xaf = parseFloat(packageData.price_xaf);
    if (packageData.song_length_min) updateData.song_length_min = parseInt(packageData.song_length_min);
    if (packageData.song_length_max) updateData.song_length_max = parseInt(packageData.song_length_max);
    if (packageData.delivery_days_min) updateData.delivery_days_min = parseInt(packageData.delivery_days_min);
    if (packageData.delivery_days_max) updateData.delivery_days_max = parseInt(packageData.delivery_days_max);
    if (packageData.revision_count !== undefined) updateData.revision_count = parseInt(packageData.revision_count);
    if (packageData.includes_discovery_call !== undefined) updateData.includes_discovery_call = packageData.includes_discovery_call === true;
    if (packageData.includes_instrumental !== undefined) updateData.includes_instrumental = packageData.includes_instrumental === true;
    if (packageData.includes_full_rights !== undefined) updateData.includes_full_rights = packageData.includes_full_rights === true;
    if (packageData.is_popular !== undefined) updateData.is_popular = packageData.is_popular === true;
    if (packageData.is_active !== undefined) updateData.is_active = packageData.is_active === true;
    if (packageData.display_order !== undefined) updateData.display_order = parseInt(packageData.display_order);

    const result = await updatePackage(id, updateData);

    if (!result.success) {
      return new Response(
        JSON.stringify({ error: result.error || 'Failed to update package' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Audit log
    await logAdminAction({
      admin_id: adminSession.data.user.id,
      admin_email: adminSession.data.user.email,
      admin_role: adminSession.data.adminRole,
      action: 'package.update',
      resource_type: 'package',
      resource_id: id,
      metadata: updateData,
      ip_address: clientAddress,
      user_agent: request.headers.get('user-agent') || undefined,
    });

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[ADMIN] Package update error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
