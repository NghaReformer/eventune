/**
 * Profile Update API Endpoint
 * Handles profile information updates with CSRF and input validation
 */
import type { APIRoute } from 'astro';
import { getServerClient } from '../../../lib/supabase/server';
import { getSession, validateCSRFToken } from '../../../lib/auth/session';
import { sanitizeString, isValidPhone } from '../../../lib/security/validation';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  // Validate session
  const sessionResult = await getSession(cookies);
  if (!sessionResult.success) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { user } = sessionResult.data;

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

    // Sanitize and validate inputs
    const fullName = sanitizeString(formData.get('full_name'), 100);
    const phone = sanitizeString(formData.get('phone'), 20);
    const phoneCountryCode = formData.get('phone_country_code') as string;
    const preferredLanguage = formData.get('preferred_language') as string;

    // Validate phone if provided
    if (phone && !isValidPhone(phone, phoneCountryCode || '+1')) {
      return new Response(JSON.stringify({ error: 'Invalid phone number format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate language
    const validLanguages = ['en', 'fr'];
    const language = validLanguages.includes(preferredLanguage) ? preferredLanguage : 'en';

    // Validate country code
    const validCountryCodes = ['+1', '+237', '+44', '+33'];
    const countryCode = validCountryCodes.includes(phoneCountryCode) ? phoneCountryCode : '+1';

    // Update profile using server client
    const supabase = getServerClient();
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        phone: phone || null,
        phone_country_code: countryCode,
        preferred_language: language,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (error) {
      console.error('Profile update error:', error);
      return new Response(JSON.stringify({ error: 'Failed to update profile' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Return success - client will handle redirect/update
    return new Response(JSON.stringify({ success: true, message: 'Profile updated successfully' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Profile update error:', error);
    return new Response(JSON.stringify({ error: 'An unexpected error occurred' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
