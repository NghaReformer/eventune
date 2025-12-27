/**
 * API: Sync Session to Cookies
 * POST /api/auth/session
 *
 * After client-side authentication (magic link, OAuth),
 * this endpoint syncs the session to HTTP-only cookies
 * for server-side authentication.
 */

import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  console.log('[Session API] POST request received');

  try {
    const body = await request.json();
    const { access_token, refresh_token } = body;

    console.log('[Session API] Tokens received - access:', access_token ? `${access_token.substring(0, 20)}...` : 'missing');

    if (!access_token || !refresh_token) {
      console.log('[Session API] Missing tokens');
      return new Response(
        JSON.stringify({ error: 'Missing tokens' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Build cookie options
    const isProduction = import.meta.env.PROD;
    const cookieOptions = [
      'Path=/',
      `Max-Age=${60 * 60 * 24 * 7}`, // 7 days
      'HttpOnly',
      'SameSite=Lax',
    ];

    if (isProduction) {
      cookieOptions.push('Secure');
    }

    const cookieString = cookieOptions.join('; ');

    // Create response with Set-Cookie headers
    const response = new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );

    // Add cookies directly to response headers
    response.headers.append('Set-Cookie', `sb-access-token=${access_token}; ${cookieString}`);
    response.headers.append('Set-Cookie', `sb-refresh-token=${refresh_token}; ${cookieString}`);

    console.log('[Session API] Cookies set successfully');
    return response;
  } catch (error) {
    console.error('Session sync error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to sync session' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const DELETE: APIRoute = async () => {
  // Clear session cookies by setting them to expire immediately
  const expiredCookie = 'Path=/; Max-Age=0; HttpOnly; SameSite=Lax';

  const response = new Response(
    JSON.stringify({ success: true }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      }
    }
  );

  response.headers.append('Set-Cookie', `sb-access-token=; ${expiredCookie}`);
  response.headers.append('Set-Cookie', `sb-refresh-token=; ${expiredCookie}`);

  return response;
};
