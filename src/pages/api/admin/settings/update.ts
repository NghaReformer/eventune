/**
 * API: Update Site Settings
 * POST /api/admin/settings/update
 *
 * Security: Super admin auth only, CSRF validation, rate limiting, audit logging
 */

import type { APIRoute } from 'astro';
import { getAdminSession } from '../../../../lib/auth/admin-session';
import { validateCSRFToken } from '../../../../lib/auth/session';
import { updateSiteSetting } from '../../../../services/admin.service';
import { logAdminAction } from '../../../../lib/audit/logger';
import { checkRateLimit, sanitizeString } from '../../../../lib/security/validation';
import { ADMIN_CONFIG } from '../../../../config/admin.constants';

// Allowed settings keys (whitelist for security)
const ALLOWED_SETTINGS = [
  'booking_enabled',
  'default_capacity',
  'maintenance_mode',
  'whatsapp_number',
] as const;

type AllowedSetting = typeof ALLOWED_SETTINGS[number];

// Value validators and transformers for each setting
interface SettingConfig {
  validate: (value: unknown) => boolean;
  transform?: (value: unknown) => unknown;
}

const SETTING_CONFIG: Record<AllowedSetting, SettingConfig> = {
  booking_enabled: {
    validate: (v) => typeof v === 'boolean',
  },
  default_capacity: {
    validate: (v) => {
      const num = typeof v === 'string' ? parseInt(v, 10) : v;
      return typeof num === 'number' && !isNaN(num) && num >= 0 && num <= 100;
    },
    transform: (v) => typeof v === 'string' ? parseInt(v, 10) : v,
  },
  maintenance_mode: {
    validate: (v) => typeof v === 'boolean',
  },
  whatsapp_number: {
    validate: (v) => typeof v === 'string' && v.length <= 50,
    transform: (v) => sanitizeString(String(v), 50),
  },
};

export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  // Rate limiting (strict for settings changes)
  const rateLimit = checkRateLimit(
    clientAddress,
    'admin-settings-update',
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

  // Super admin only for settings changes
  if (adminSession.data.adminRole !== 'super_admin') {
    return new Response(
      JSON.stringify({ error: 'Super admin access required' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await request.json();
    const { csrf_token, ...settings } = body;

    // CSRF validation
    if (!validateCSRFToken(cookies, csrf_token || null)) {
      return new Response(
        JSON.stringify({ error: 'Invalid security token. Please refresh and try again.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!settings || typeof settings !== 'object' || Object.keys(settings).length === 0) {
      return new Response(
        JSON.stringify({ error: 'No settings provided' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate and update each setting
    const updates: { key: string; value: unknown; success: boolean }[] = [];
    const errors: string[] = [];

    for (const [key, value] of Object.entries(settings)) {
      // Check if key is allowed
      if (!ALLOWED_SETTINGS.includes(key as AllowedSetting)) {
        errors.push(`Invalid setting key: ${key}`);
        continue;
      }

      const config = SETTING_CONFIG[key as AllowedSetting];

      // Validate value
      if (!config.validate(value)) {
        errors.push(`Invalid value for ${key}`);
        continue;
      }

      // Transform value if needed
      const finalValue = config.transform ? config.transform(value) : value;

      // Update setting
      const result = await updateSiteSetting(
        key,
        finalValue,
        adminSession.data.user.id
      );

      updates.push({
        key,
        value: finalValue,
        success: result.success,
      });

      if (!result.success) {
        errors.push(result.error || `Failed to update ${key}`);
      }
    }

    // Audit log all changes
    if (updates.some((u) => u.success)) {
      await logAdminAction({
        admin_id: adminSession.data.user.id,
        admin_email: adminSession.data.user.email,
        admin_role: adminSession.data.adminRole,
        action: 'settings.update',
        resource_type: 'settings',
        resource_id: 'site_settings',
        metadata: {
          updates: updates.filter((u) => u.success),
        },
        ip_address: clientAddress,
        user_agent: request.headers.get('user-agent') || undefined,
      });
    }

    // Return result
    if (errors.length > 0 && updates.filter((u) => u.success).length === 0) {
      return new Response(
        JSON.stringify({ error: errors.join(', ') }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        updated: updates.filter((u) => u.success).length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[ADMIN] Settings update error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
