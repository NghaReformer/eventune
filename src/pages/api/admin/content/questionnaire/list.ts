/**
 * API: List Questionnaire Fields
 * GET /api/admin/content/questionnaire/list?occasion=slug
 *
 * Security: Admin auth, content:view permission
 */

import type { APIRoute } from 'astro';
import { getAdminSession, hasPermission } from '../../../../../lib/auth/admin-session';
import { getAllQuestionnaireFields } from '../../../../../services/admin.service';

export const GET: APIRoute = async ({ url, cookies }) => {
  // Admin authentication
  const adminSession = await getAdminSession(cookies);
  if (!adminSession.success) {
    return new Response(
      JSON.stringify({ error: 'Authentication required' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Permission check
  if (!hasPermission(adminSession.data.permissions, 'content:view')) {
    return new Response(
      JSON.stringify({ error: 'Content view permission required' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const occasionSlug = url.searchParams.get('occasion') || null;
    const fields = await getAllQuestionnaireFields(occasionSlug === 'common' ? null : occasionSlug);

    return new Response(
      JSON.stringify({ success: true, fields }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[ADMIN] Questionnaire list error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
