/**
 * Notification Preferences API Endpoint
 * Handles notification settings updates with CSRF validation
 */
import type { APIRoute } from 'astro';
import { getServerClient } from '../../../lib/supabase/server';
import { getSession, validateCSRFToken } from '../../../lib/auth/session';

export const POST: APIRoute = async ({ request, cookies }) => {
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

    // Parse notification preferences (checkboxes send 'on' when checked)
    const emailNotifications = formData.get('email_notifications') === 'on';
    const smsNotifications = formData.get('sms_notifications') === 'on';
    const marketingConsent = formData.get('marketing_consent') === 'on';

    // Update profile using server client
    const supabase = getServerClient();
    const { error } = await supabase
      .from('profiles')
      .update({
        notification_preferences: {
          email: emailNotifications,
          sms: smsNotifications,
        },
        marketing_consent: marketingConsent,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (error) {
      console.error('Notification preferences update error:', error);
      return new Response(JSON.stringify({ error: 'Failed to update preferences' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, message: 'Preferences saved successfully' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Notification preferences error:', error);
    return new Response(JSON.stringify({ error: 'An unexpected error occurred' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
