/**
 * Security Configuration
 * Session, encryption, and security settings
 * Changes require code deploy
 */

export const securityConfig = {
  session: {
    accessTokenLifetime: 3600, // 1 hour in seconds
    refreshTokenLifetime: 604800, // 7 days in seconds
    sensitiveActionTimeout: 300, // 5 minutes - require re-auth for sensitive actions
    maxConcurrentSessions: 5,
  },

  encryption: {
    algorithm: 'aes-256-gcm' as const,
    keyLength: 32,
    ivLength: 16,
    authTagLength: 16,
    sensitiveFields: ['questionnaire', 'phone'] as const,
  },

  password: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumber: true,
    requireSpecialChar: false,
    maxLength: 128,
  },

  admin: {
    require2FA: true,
    sessionTimeout: 3600, // 1 hour
    auditAllActions: true,
    ipWhitelist: [] as string[], // Empty = allow all
    allowedRoles: ['super_admin', 'order_manager', 'support'] as const,
  },

  headers: {
    csp: {
      'default-src': ["'self'"],
      'script-src': ["'self'", "'unsafe-inline'", 'https://js.stripe.com'],
      'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      'font-src': ["'self'", 'https://fonts.gstatic.com'],
      'img-src': ["'self'", 'data:', 'https:'],
      'connect-src': ["'self'", 'https://*.supabase.co', 'https://api.stripe.com'],
      'frame-src': ["'self'", 'https://js.stripe.com'],
    },
    frameOptions: 'DENY' as const,
    contentTypeOptions: 'nosniff' as const,
    xssProtection: '1; mode=block' as const,
    referrerPolicy: 'strict-origin-when-cross-origin' as const,
  },

  cors: {
    allowedOrigins: [
      'https://eventunestudios.com',
      'https://www.eventunestudios.com',
    ],
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    maxAge: 86400, // 24 hours
  },
} as const;

export type SecurityConfig = typeof securityConfig;
export type AdminRole = (typeof securityConfig.admin.allowedRoles)[number];
