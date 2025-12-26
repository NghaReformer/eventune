/**
 * Rate Limiting Configuration
 * Thresholds for API endpoints
 * Changes require code deploy
 */

export interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  maxRequests: number;
  /** Window size in seconds */
  windowSeconds: number;
}

/**
 * Rate limits by endpoint type
 * Used by rate-limiter.ts with Upstash Redis
 */
export const rateLimitsConfig = {
  // Authentication endpoints
  login: {
    maxRequests: 5,
    windowSeconds: 60,
  },
  signup: {
    maxRequests: 3,
    windowSeconds: 3600,
  },
  passwordReset: {
    maxRequests: 3,
    windowSeconds: 3600,
  },

  // API endpoints
  payment: {
    maxRequests: 10,
    windowSeconds: 3600,
  },
  orderCreate: {
    maxRequests: 5,
    windowSeconds: 3600,
  },
  contact: {
    maxRequests: 5,
    windowSeconds: 3600,
  },

  // Admin endpoints
  adminLogin: {
    maxRequests: 3,
    windowSeconds: 60,
  },
  adminActions: {
    maxRequests: 50,
    windowSeconds: 60,
  },

  // Default for general API requests
  api: {
    maxRequests: 100,
    windowSeconds: 60,
  },
} as const satisfies Record<string, RateLimitConfig>;

export type RateLimitType = keyof typeof rateLimitsConfig;
