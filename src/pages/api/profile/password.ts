/**
 * Password Change API Endpoint
 * Handles password updates with CSRF validation and current password verification
 */
import type { APIRoute } from 'astro';
import { getServerClient } from '../../../lib/supabase/server';
import { getSession, validateCSRFToken } from '../../../lib/auth/session';
import { validatePassword, checkRateLimit } from '../../../lib/security/validation';

export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  // Rate limiting for password changes
  const rateLimitKey = clientAddress || 'unknown';
  const rateLimit = checkRateLimit(rateLimitKey, 'password-change', 3, 300000); // 3 attempts per 5 minutes

  if (!rateLimit.allowed) {
    return new Response(
      JSON.stringify({
        error: 'Too many password change attempts. Please wait before trying again.',
        resetIn: Math.ceil(rateLimit.resetIn / 1000),
      }),
      {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Validate session
  const sessionResult = await getSession(cookies);
  if (!sessionResult.success) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { user, accessToken } = sessionResult.data;

  try {
    const formData = await request.formData();

    // Validate CSRF token
    const csrfToken = formData.get('csrf_token') as string;
    if (!validateCSRFToken(cookies, csrfToken)) {
      return new Response(JSON.stringify({ error: 'Invalid security token. Please refresh and try again.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const currentPassword = formData.get('current_password') as string;
    const newPassword = formData.get('new_password') as string;
    const confirmPassword = formData.get('confirm_password') as string;

    // Validate required fields
    if (!currentPassword || !newPassword || !confirmPassword) {
      return new Response(JSON.stringify({ error: 'All password fields are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check passwords match
    if (newPassword !== confirmPassword) {
      return new Response(JSON.stringify({ error: 'New passwords do not match' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate password strength
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return new Response(
        JSON.stringify({
          error: 'Password does not meet requirements',
          details: passwordValidation.errors,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Verify current password by attempting to sign in
    const supabase = getServerClient();

    // First, verify current password
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });

    if (signInError) {
      return new Response(JSON.stringify({ error: 'Current password is incorrect' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Re-establish session and update password
    const refreshToken = cookies.get('sb-refresh-token')?.value;
    if (accessToken && refreshToken) {
      await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      console.error('Password update error:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to update password' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, message: 'Password updated successfully' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Password change error:', error);
    return new Response(JSON.stringify({ error: 'An unexpected error occurred' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
