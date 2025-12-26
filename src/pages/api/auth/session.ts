/**
 * API: Sync Session to Cookies
 * POST /api/auth/session
 *
 * After client-side authentication (magic link, OAuth),
 * this endpoint syncs the session to HTTP-only cookies
 * for server-side authentication.
 */

import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await request.json();
    const { access_token, refresh_token } = body;

    if (!access_token || !refresh_token) {
      return new Response(
        JSON.stringify({ error: 'Missing tokens' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Set HTTP-only cookies for server-side auth
    const isProduction = import.meta.env.PROD;
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    };

    cookies.set('sb-access-token', access_token, cookieOptions);
    cookies.set('sb-refresh-token', refresh_token, cookieOptions);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Session sync error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to sync session' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const DELETE: APIRoute = async ({ cookies }) => {
  // Clear session cookies
  cookies.delete('sb-access-token', { path: '/' });
  cookies.delete('sb-refresh-token', { path: '/' });

  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};
