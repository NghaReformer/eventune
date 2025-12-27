/**
 * API: Update Testimonial
 * POST /api/admin/content/testimonials/update
 *
 * Security: Admin auth, content:update permission, rate limiting, audit logging
 */

import type { APIRoute } from 'astro';
import { getAdminSession, hasPermission } from '../../../../../lib/auth/admin-session';
import { validateCSRFToken } from '../../../../../lib/auth/session';
import { updateTestimonial } from '../../../../../services/admin.service';
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
    const { id, csrf_token, ...testimonialData } = body;

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
        JSON.stringify({ error: 'Valid testimonial ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Update testimonial
    const updateData: any = {};

    if (testimonialData.customer_name) updateData.customer_name = testimonialData.customer_name;
    if (testimonialData.customer_location !== undefined) updateData.customer_location = testimonialData.customer_location || null;
    if (testimonialData.quote) updateData.quote = testimonialData.quote;
    if (testimonialData.occasion) updateData.occasion = testimonialData.occasion;
    if (testimonialData.rating !== undefined) updateData.rating = parseInt(testimonialData.rating);
    if (testimonialData.image_url !== undefined) updateData.image_url = testimonialData.image_url || null;
    if (testimonialData.video_url !== undefined) updateData.video_url = testimonialData.video_url || null;
    if (testimonialData.video_source_type !== undefined) updateData.video_source_type = testimonialData.video_source_type || 'youtube';
    if (testimonialData.is_featured !== undefined) updateData.is_featured = testimonialData.is_featured === true;
    if (testimonialData.is_active !== undefined) updateData.is_active = testimonialData.is_active === true;
    if (testimonialData.display_order !== undefined) updateData.display_order = parseInt(testimonialData.display_order);

    const result = await updateTestimonial(id, updateData);

    if (!result.success) {
      return new Response(
        JSON.stringify({ error: result.error || 'Failed to update testimonial' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Audit log
    await logAdminAction({
      admin_id: adminSession.data.user.id,
      admin_email: adminSession.data.user.email,
      admin_role: adminSession.data.adminRole,
      action: 'testimonial.update',
      resource_type: 'testimonial',
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
    console.error('[ADMIN] Testimonial update error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
