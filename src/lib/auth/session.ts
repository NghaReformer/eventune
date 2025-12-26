/**
 * Server-side Session Management
 * Centralizes auth logic, eliminates duplicate queries, adds security
 */

import type { AstroCookies } from 'astro';
import { getServerClient } from '../supabase/server';
import type { Database } from '../../types/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];

export interface SessionData {
  user: {
    id: string;
    email: string;
    created_at: string;
  };
  profile: Profile | null;
  accessToken: string;
}

export interface SessionError {
  code: 'NO_SESSION' | 'INVALID_SESSION' | 'SESSION_EXPIRED' | 'PROFILE_ERROR';
  message: string;
}

export type SessionResult =
  | { success: true; data: SessionData }
  | { success: false; error: SessionError };

/**
 * Get and validate session from cookies
 * Returns user and profile data, or error if invalid
 */
export async function getSession(cookies: AstroCookies): Promise<SessionResult> {
  const accessToken = cookies.get('sb-access-token')?.value;
  const refreshToken = cookies.get('sb-refresh-token')?.value;

  // Check if tokens exist
  if (!accessToken || !refreshToken) {
    return {
      success: false,
      error: {
        code: 'NO_SESSION',
        message: 'No session tokens found',
      },
    };
  }

  try {
    const supabase = getServerClient();

    // Validate session with Supabase
    const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (sessionError || !sessionData?.user) {
      // Clear invalid cookies
      cookies.delete('sb-access-token', { path: '/' });
      cookies.delete('sb-refresh-token', { path: '/' });

      return {
        success: false,
        error: {
          code: sessionError?.message?.includes('expired') ? 'SESSION_EXPIRED' : 'INVALID_SESSION',
          message: sessionError?.message || 'Invalid session',
        },
      };
    }

    // Fetch profile data
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', sessionData.user.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('Profile fetch error:', profileError);
    }

    return {
      success: true,
      data: {
        user: {
          id: sessionData.user.id,
          email: sessionData.user.email || '',
          created_at: sessionData.user.created_at,
        },
        profile: profileData,
        accessToken,
      },
    };
  } catch (error) {
    console.error('Session validation error:', error);
    return {
      success: false,
      error: {
        code: 'INVALID_SESSION',
        message: 'Failed to validate session',
      },
    };
  }
}

/**
 * Require authenticated session, redirect if not
 */
export async function requireSession(
  cookies: AstroCookies,
  redirectTo: string = '/auth/login'
): Promise<SessionData | null> {
  const result = await getSession(cookies);

  if (!result.success) {
    return null;
  }

  return result.data;
}

/**
 * Get first name from profile
 */
export function getFirstName(profile: Profile | null): string {
  if (!profile?.full_name) return 'there';
  return profile.full_name.split(' ')[0];
}

/**
 * Generate CSRF token
 */
export function generateCSRFToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Validate CSRF token from form submission
 */
export function validateCSRFToken(cookies: AstroCookies, formToken: string | null): boolean {
  const cookieToken = cookies.get('csrf-token')?.value;

  if (!cookieToken || !formToken) {
    return false;
  }

  // Constant-time comparison to prevent timing attacks
  if (cookieToken.length !== formToken.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < cookieToken.length; i++) {
    result |= cookieToken.charCodeAt(i) ^ formToken.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Set CSRF token cookie
 */
export function setCSRFToken(cookies: AstroCookies): string {
  const token = generateCSRFToken();

  cookies.set('csrf-token', token, {
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'strict',
    path: '/',
    maxAge: 3600, // 1 hour
  });

  return token;
}
