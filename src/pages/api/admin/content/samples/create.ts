/**
 * API: Create Sample
 * POST /api/admin/content/samples/create
 *
 * Security: Admin auth, content:update permission, rate limiting, audit logging
 */

import type { APIRoute } from 'astro';
import { getAdminSession, hasPermission } from '../../../../../lib/auth/admin-session';
import { validateCSRFToken } from '../../../../../lib/auth/session';
import { createSample } from '../../../../../services/admin.service';
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
    const { csrf_token, ...sampleData } = body;

    // CSRF validation
    if (!validateCSRFToken(cookies, csrf_token || null)) {
      return new Response(
        JSON.stringify({ error: 'Invalid security token. Please refresh and try again.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate required fields
    if (!sampleData.title || !sampleData.audio_url) {
      return new Response(
        JSON.stringify({ error: 'Title and audio/video URL are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create sample
    const result = await createSample({
      title: sampleData.title,
      description: sampleData.description || null,
      occasion_slug: sampleData.occasion_slug || null,
      genre: sampleData.genre || null,
      audio_url: sampleData.audio_url,
      audio_source_type: sampleData.audio_source_type || 'url',
      video_url: sampleData.video_url || null,
      media_type: sampleData.media_type || 'audio',
      cover_image_url: sampleData.cover_image_url || null,
      duration_seconds: sampleData.duration_seconds || 0,
      is_featured: sampleData.is_featured !== false,
      is_active: sampleData.is_active !== false,
      display_order: sampleData.display_order || 10,
    });

    if (!result.success) {
      return new Response(
        JSON.stringify({ error: result.error || 'Failed to create sample' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Audit log
    await logAdminAction({
      admin_id: adminSession.data.user.id,
      admin_email: adminSession.data.user.email,
      admin_role: adminSession.data.adminRole,
      action: 'sample.create',
      resource_type: 'sample',
      resource_id: result.id,
      metadata: { title: sampleData.title, occasion_slug: sampleData.occasion_slug, media_type: sampleData.media_type },
      ip_address: clientAddress,
      user_agent: request.headers.get('user-agent') || undefined,
    });

    return new Response(
      JSON.stringify({ success: true, id: result.id }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[ADMIN] Sample create error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
