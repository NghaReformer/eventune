/**
 * Astro Middleware
 * Handles authentication, security headers, and rate limiting
 */

import { defineMiddleware, sequence } from 'astro:middleware';
import { createServerClientWithToken } from '@/lib/supabase/server';

// Routes that require authentication
const protectedRoutes = [
  '/portal',
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

  let user = null;
  let session = null;

  // Try to get user from access token
  if (accessToken) {
    try {
      const supabase = createServerClientWithToken(accessToken);
      const { data: { user: authUser }, error } = await supabase.auth.getUser();

      if (!error && authUser) {
        user = authUser;

        // Fetch user profile for role info
        const { data: profile } = await supabase
          .from('profiles')
          .select('admin_role, first_name, last_name')
          .eq('id', authUser.id)
          .single();

        if (profile) {
          user = { ...authUser, profile };
        }
      }
    } catch (error) {
      console.error('Auth middleware error:', error);
    }
  }

  // Store user in locals for use in pages
  locals.user = user;

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
      return redirect('/portal');
    }
  }

  // Redirect authenticated users away from auth pages
  const isAuthRoute = authRoutes.some((route) => pathname === route);
  if (isAuthRoute && user) {
    return redirect('/portal');
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
