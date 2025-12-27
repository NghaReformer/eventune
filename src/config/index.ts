/**
 * Configuration Index
 * Central export for all static configuration
 */

export { brandConfig, type BrandConfig, type BrandColors } from './brand.config';
export { siteConfig, type SiteConfig } from './site.config';
export { rateLimitsConfig, type RateLimitConfig, type RateLimitType } from './rate-limits.config';
export {
  securityConfig,
  type SecurityConfig,
  type AdminRole,
} from './security.config';

// Validation schemas and functions
export {
  brandConfigSchema,
  siteConfigSchema,
  rateLimitsConfigSchema,
  securityConfigSchema,
  envSchema,
  validateConfig,
  validateEnv,
  validateProductionEnv,
} from './schemas';

/**
 * Get environment variable with optional default
 */
export function getEnv(key: string, defaultValue?: string): string {
  const value = import.meta.env[key] ?? process.env[key] ?? defaultValue;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/**
 * Check if we're in production environment
 */
export function isProduction(): boolean {
  return import.meta.env.PROD || process.env.NODE_ENV === 'production';
}

/**
 * Check if we're in development environment
 */
export function isDevelopment(): boolean {
  return import.meta.env.DEV || process.env.NODE_ENV === 'development';
}
