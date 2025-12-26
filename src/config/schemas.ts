/**
 * Configuration Validation Schemas
 * Zod schemas for runtime validation of all configuration
 */

import { z } from 'zod';

// ============================================
// Brand Config Schema
// ============================================

const hexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color');

const colorPaletteSchema = z.object({
  primary: z.object({
    black: hexColorSchema,
    cardBlack: hexColorSchema,
    hoverBlack: hexColorSchema,
  }),
  accent: z.object({
    gold: hexColorSchema,
    goldHover: hexColorSchema,
    goldMuted: hexColorSchema,
  }),
  text: z.object({
    primary: hexColorSchema,
    secondary: hexColorSchema,
    muted: hexColorSchema,
  }),
  status: z.object({
    success: hexColorSchema,
    warning: hexColorSchema,
    error: hexColorSchema,
    info: hexColorSchema,
  }),
});

const fontSchema = z.object({
  family: z.string().min(1),
  weights: z.array(z.string()),
});

export const brandConfigSchema = z.object({
  name: z.string().min(1).max(100),
  tagline: z.string().min(1).max(200),
  domain: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}$/),
  colors: colorPaletteSchema,
  fonts: z.object({
    heading: fontSchema,
    body: fontSchema,
  }),
  logo: z.object({
    full: z.string().startsWith('/'),
    icon: z.string().startsWith('/'),
    favicon: z.string().startsWith('/'),
  }),
  images: z.object({
    ogDefault: z.string().startsWith('/'),
    heroBackground: z.string().startsWith('/'),
  }),
});

// ============================================
// Site Config Schema
// ============================================

const urlSchema = z.string().url();
const emailSchema = z.string().email();

export const siteConfigSchema = z.object({
  url: urlSchema,
  domain: z.string().optional(),
  social: z.object({
    instagram: urlSchema.optional(),
    tiktok: urlSchema.optional(),
    twitter: urlSchema.optional(),
    youtube: urlSchema.optional(),
    facebook: urlSchema.optional(),
    whatsapp: z.string().optional(),
  }),
  contact: z.object({
    email: emailSchema.optional(),
    general: emailSchema.optional(),
    orders: emailSchema.optional(),
    support: emailSchema.optional(),
    privacy: emailSchema.optional(),
    legal: emailSchema.optional(),
  }),
  seo: z.object({
    defaultTitle: z.string().min(1).max(100),
    titleTemplate: z.string().includes('%s'),
    defaultDescription: z.string().min(1).max(300),
    keywords: z.array(z.string()),
    locale: z.string().regex(/^[a-z]{2}_[A-Z]{2}$/),
    type: z.string(),
  }),
  legal: z.object({
    companyName: z.string().min(1),
    foundedYear: z.number().int().min(2000).max(2100),
    privacyPolicyUrl: z.string().startsWith('/'),
    termsUrl: z.string().startsWith('/'),
    refundPolicyUrl: z.string().startsWith('/'),
    cookiePolicyUrl: z.string().startsWith('/'),
  }),
  features: z.object({
    enableBlog: z.boolean(),
    enableTestimonials: z.boolean(),
    enableFAQ: z.boolean(),
    enableSamples: z.boolean(),
    enableReferralProgram: z.boolean(),
    enableSMS: z.boolean(),
    maintenanceMode: z.boolean(),
  }),
});

// ============================================
// Rate Limits Config Schema
// ============================================

const rateLimitEntrySchema = z.object({
  maxRequests: z.number().int().positive(),
  windowSeconds: z.number().int().positive(),
});

export const rateLimitsConfigSchema = z.object({
  login: rateLimitEntrySchema,
  signup: rateLimitEntrySchema,
  payment: rateLimitEntrySchema,
  api: rateLimitEntrySchema,
  contact: rateLimitEntrySchema,
  passwordReset: rateLimitEntrySchema,
  download: rateLimitEntrySchema,
});

// ============================================
// Security Config Schema
// ============================================

export const securityConfigSchema = z.object({
  session: z.object({
    accessTokenLifetime: z.number().int().positive().max(86400), // Max 24 hours
    refreshTokenLifetime: z.number().int().positive().max(2592000), // Max 30 days
    sensitiveActionTimeout: z.number().int().positive().max(3600), // Max 1 hour
    maxConcurrentSessions: z.number().int().positive().max(20),
  }),
  encryption: z.object({
    algorithm: z.literal('aes-256-gcm'),
    keyLength: z.literal(32),
    ivLength: z.literal(16),
    authTagLength: z.literal(16),
    sensitiveFields: z.array(z.string()),
  }),
  password: z.object({
    minLength: z.number().int().min(8).max(32),
    requireUppercase: z.boolean(),
    requireLowercase: z.boolean(),
    requireNumber: z.boolean(),
    requireSpecialChar: z.boolean(),
    maxLength: z.number().int().min(32).max(256),
  }),
  admin: z.object({
    require2FA: z.boolean(),
    sessionTimeout: z.number().int().positive().max(86400),
    auditAllActions: z.boolean(),
    ipWhitelist: z.array(z.string()),
    allowedRoles: z.array(z.enum(['super_admin', 'order_manager', 'support'])),
  }),
  headers: z.object({
    csp: z.record(z.array(z.string())),
    frameOptions: z.enum(['DENY', 'SAMEORIGIN']),
    contentTypeOptions: z.literal('nosniff'),
    xssProtection: z.string(),
    referrerPolicy: z.enum([
      'no-referrer',
      'no-referrer-when-downgrade',
      'origin',
      'origin-when-cross-origin',
      'same-origin',
      'strict-origin',
      'strict-origin-when-cross-origin',
      'unsafe-url',
    ]),
  }),
  cors: z.object({
    allowedOrigins: z.array(urlSchema),
    allowedMethods: z.array(z.enum(['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'])),
    allowedHeaders: z.array(z.string()),
    maxAge: z.number().int().positive().max(604800), // Max 7 days
  }),
});

// ============================================
// Environment Variables Schema
// ============================================

export const envSchema = z.object({
  // Supabase
  PUBLIC_SUPABASE_URL: z.string().url(),
  PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_KEY: z.string().min(1).optional(),

  // Stripe
  PUBLIC_STRIPE_KEY: z.string().startsWith('pk_').optional(),
  STRIPE_SECRET_KEY: z.string().startsWith('sk_').optional(),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_').optional(),

  // CamPay
  CAMPAY_USERNAME: z.string().optional(),
  CAMPAY_PASSWORD: z.string().optional(),
  CAMPAY_WEBHOOK_SECRET: z.string().optional(),
  CAMPAY_ENV: z.enum(['sandbox', 'production']).optional(),

  // Email
  RESEND_API_KEY: z.string().startsWith('re_').optional(),

  // Security
  ENCRYPTION_KEY: z.string().length(64).regex(/^[a-f0-9]+$/i).optional(),

  // Redis
  UPSTASH_REDIS_URL: z.string().url().optional(),
  UPSTASH_REDIS_TOKEN: z.string().optional(),

  // Site
  PUBLIC_SITE_URL: z.string().url().optional(),
});

// ============================================
// Validation Functions
// ============================================

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: z.ZodError };

/**
 * Validate config with detailed error messages
 */
export function validateConfig<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  configName: string
): T {
  const result = schema.safeParse(data);

  if (!result.success) {
    const errors = result.error.errors
      .map((e) => `  - ${e.path.join('.')}: ${e.message}`)
      .join('\n');

    throw new Error(
      `Invalid ${configName} configuration:\n${errors}`
    );
  }

  return result.data;
}

/**
 * Validate environment variables
 */
export function validateEnv(): z.infer<typeof envSchema> {
  const env = {
    PUBLIC_SUPABASE_URL: import.meta.env.PUBLIC_SUPABASE_URL,
    PUBLIC_SUPABASE_ANON_KEY: import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_KEY: import.meta.env.SUPABASE_SERVICE_KEY,
    PUBLIC_STRIPE_KEY: import.meta.env.PUBLIC_STRIPE_KEY,
    STRIPE_SECRET_KEY: import.meta.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: import.meta.env.STRIPE_WEBHOOK_SECRET,
    CAMPAY_USERNAME: import.meta.env.CAMPAY_USERNAME,
    CAMPAY_PASSWORD: import.meta.env.CAMPAY_PASSWORD,
    CAMPAY_WEBHOOK_SECRET: import.meta.env.CAMPAY_WEBHOOK_SECRET,
    CAMPAY_ENV: import.meta.env.CAMPAY_ENV,
    RESEND_API_KEY: import.meta.env.RESEND_API_KEY,
    ENCRYPTION_KEY: import.meta.env.ENCRYPTION_KEY,
    UPSTASH_REDIS_URL: import.meta.env.UPSTASH_REDIS_URL,
    UPSTASH_REDIS_TOKEN: import.meta.env.UPSTASH_REDIS_TOKEN,
    PUBLIC_SITE_URL: import.meta.env.PUBLIC_SITE_URL,
  };

  return validateConfig(envSchema, env, 'environment');
}

/**
 * Check if all required environment variables are set for production
 */
export function validateProductionEnv(): string[] {
  const errors: string[] = [];
  const required = [
    'PUBLIC_SUPABASE_URL',
    'PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_KEY',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'RESEND_API_KEY',
    'ENCRYPTION_KEY',
  ] as const;

  for (const key of required) {
    if (!import.meta.env[key]) {
      errors.push(`Missing required environment variable: ${key}`);
    }
  }

  // Validate encryption key format if present
  const encKey = import.meta.env.ENCRYPTION_KEY;
  if (encKey && (encKey.length !== 64 || !/^[a-f0-9]+$/i.test(encKey))) {
    errors.push('ENCRYPTION_KEY must be exactly 64 hexadecimal characters');
  }

  return errors;
}
