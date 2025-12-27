/**
 * Astro Middleware
 * Handles authentication, security headers, rate limiting, and CSRF tokens
 */

import { defineMiddleware, sequence } from 'astro:middleware';
import { createServerClientWithToken } from '@/lib/supabase/server';
import { setCSRFToken, generateCSRFToken } from '@/lib/auth/session';

// Routes that require authentication
const protectedRoutes = [
  '/dashboard',
  '/admin',
];

// Routes that should redirect authenticated users
const authRoutes = [
  '/auth/login',
  '/auth/signup',
];

// Admin-only routes
const adminRoutes = [
  '/admin',
];

/**
 * Auth Middleware
 * Checks authentication and redirects as needed
 */
const authMiddleware = defineMiddleware(async ({ request, cookies, redirect, locals }, next) => {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Get access token from cookie
  const accessToken = cookies.get('sb-access-token')?.value;
  const refreshToken = cookies.get('sb-refresh-token')?.value;

  console.log(`[Middleware] ${pathname} - accessToken: ${accessToken ? 'present' : 'missing'}, refreshToken: ${refreshToken ? 'present' : 'missing'}`);

  let user = null;
  let session = null;

  // Try to get user from access token
  if (accessToken) {
    try {
      const supabase = createServerClientWithToken(accessToken);
      const { data: { user: authUser }, error } = await supabase.auth.getUser();

      console.log(`[Middleware] getUser result - user: ${authUser?.id || 'null'}, error: ${error?.message || 'none'}`);

      if (!error && authUser) {
        user = authUser;

        // Fetch user profile for role info
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .single();

        if (profile) {
          user = { ...authUser, profile };
        }

        // Set session data for pages/layouts
        session = {
          user: {
            id: authUser.id,
            email: authUser.email || '',
            created_at: authUser.created_at,
          },
          profile: profile,
          accessToken: accessToken,
        };
      }
    } catch (error) {
      console.error('Auth middleware error:', error);
    }
  }

  // Store user and session in locals for use in pages
  locals.user = user;
  locals.session = session;

  // Generate CSRF token for authenticated users
  if (user) {
    // Check if token already exists and is valid
    const existingToken = cookies.get('csrf-token')?.value;
    if (!existingToken || existingToken.length !== 64) {
      // Generate new token if missing or invalid
      const token = setCSRFToken(cookies);
      locals.csrfToken = token;
      console.log(`[Middleware] Generated new CSRF token for user ${(user as any).id}: ${token.substring(0, 8)}... (length: ${token.length})`);
    } else {
      locals.csrfToken = existingToken;
      console.log(`[Middleware] Using existing CSRF token: ${existingToken.substring(0, 8)}... (length: ${existingToken.length})`);
    }
  } else {
    // Clear any stale CSRF token for unauthenticated requests
    locals.csrfToken = '';
  }

  // Check protected routes
  const isProtectedRoute = protectedRoutes.some((route) => pathname.startsWith(route));
  if (isProtectedRoute && !user) {
    const redirectTo = encodeURIComponent(pathname);
    return redirect(`/auth/login?redirectTo=${redirectTo}`);
  }

  // Check admin routes
  const isAdminRoute = adminRoutes.some((route) => pathname.startsWith(route));
  if (isAdminRoute) {
    const adminRole = (user as any)?.profile?.admin_role;
    if (!adminRole) {
      return redirect('/dashboard');
    }
  }

  // Redirect authenticated users away from auth pages
  const isAuthRoute = authRoutes.some((route) => pathname === route);
  if (isAuthRoute && user) {
    return redirect('/dashboard');
  }

  return next();
});

/**
 * Security Headers Middleware
 * Adds security headers to all responses
 */
const securityHeadersMiddleware = defineMiddleware(async (context, next) => {
  const response = await next();

  // Add security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions Policy
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=()'
  );

  return response;
});

// Combine middlewares
export const onRequest = sequence(securityHeadersMiddleware, authMiddleware);
