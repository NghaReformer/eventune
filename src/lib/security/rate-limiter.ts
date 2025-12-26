/**
 * Rate Limiter using Upstash Redis
 * Protects endpoints from abuse
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { rateLimitsConfig, type RateLimitType } from '../../config';

// Lazy initialization of Redis client
let redis: Redis | null = null;
const rateLimiters = new Map<string, Ratelimit>();

// Track if Redis is available (for graceful degradation)
let redisAvailable: boolean | null = null;

/**
 * Check if Redis is configured
 */
function isRedisConfigured(): boolean {
  const url = import.meta.env.UPSTASH_REDIS_URL;
  const token = import.meta.env.UPSTASH_REDIS_TOKEN;
  return !!(url && token);
}

/**
 * Get Redis client (lazy initialization)
 */
function getRedis(): Redis | null {
  if (!isRedisConfigured()) {
    if (redisAvailable === null) {
      console.warn('Rate limiting disabled: UPSTASH_REDIS_URL and UPSTASH_REDIS_TOKEN not configured');
      redisAvailable = false;
    }
    return null;
  }

  if (!redis) {
    const url = import.meta.env.UPSTASH_REDIS_URL;
    const token = import.meta.env.UPSTASH_REDIS_TOKEN;
    redis = new Redis({ url, token });
    redisAvailable = true;
  }
  return redis;
}

export type { RateLimitType };

/**
 * Rate limit result
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Remaining requests in the window */
  remaining: number;
  /** Timestamp when the rate limit resets */
  resetAt: Date;
  /** Time until reset in seconds */
  retryAfter: number;
}

/**
 * Get or create a rate limiter for a specific type
 * Returns null if Redis is not configured
 */
function getRateLimiter(type: RateLimitType): Ratelimit | null {
  const redisClient = getRedis();
  if (!redisClient) {
    return null;
  }

  if (rateLimiters.has(type)) {
    return rateLimiters.get(type)!;
  }

  const config = rateLimitsConfig[type] ?? rateLimitsConfig.api;
  const limiter = new Ratelimit({
    redis: redisClient,
    limiter: Ratelimit.slidingWindow(config.maxRequests, `${config.windowSeconds}s`),
    prefix: `eventune:ratelimit:${type}`,
    analytics: true,
  });

  rateLimiters.set(type, limiter);
  return limiter;
}

/**
 * Check rate limit for an identifier
 */
export async function checkRateLimit(
  type: RateLimitType,
  identifier: string
): Promise<RateLimitResult> {
  try {
    const limiter = getRateLimiter(type);

    // If rate limiting is not configured, allow all requests
    if (!limiter) {
      return {
        allowed: true,
        remaining: 999,
        resetAt: new Date(),
        retryAfter: 0,
      };
    }

    const result = await limiter.limit(identifier);

    return {
      allowed: result.success,
      remaining: result.remaining,
      resetAt: new Date(result.reset),
      retryAfter: Math.ceil((result.reset - Date.now()) / 1000),
    };
  } catch (error) {
    // On Redis failure, allow the request (fail open)
    console.error('Rate limiter error:', error);
    return {
      allowed: true,
      remaining: 999,
      resetAt: new Date(),
      retryAfter: 0,
    };
  }
}

/**
 * Rate limit middleware result headers
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.resetAt.toISOString(),
    ...(result.allowed ? {} : { 'Retry-After': result.retryAfter.toString() }),
  };
}

/**
 * Get client IP from request
 */
export function getClientIP(request: Request): string {
  // Check common headers for proxied requests
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  // Cloudflare
  const cfIP = request.headers.get('cf-connecting-ip');
  if (cfIP) {
    return cfIP;
  }

  // Fallback (shouldn't happen in production with proper proxy setup)
  return 'unknown';
}

/**
 * Create rate limit identifier combining IP and optional user ID
 */
export function createIdentifier(request: Request, userId?: string): string {
  const ip = getClientIP(request);
  return userId ? `${userId}:${ip}` : ip;
}

/**
 * Check if rate limited and return response if so
 */
export async function enforceRateLimit(
  type: RateLimitType,
  request: Request,
  userId?: string
): Promise<Response | null> {
  const identifier = createIdentifier(request, userId);
  const result = await checkRateLimit(type, identifier);

  if (!result.allowed) {
    return new Response(
      JSON.stringify({
        error: 'Too many requests',
        retryAfter: result.retryAfter,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          ...getRateLimitHeaders(result),
        },
      }
    );
  }

  return null;
}
