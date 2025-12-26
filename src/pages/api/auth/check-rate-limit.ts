/**
 * Rate Limit Check API
 * Check rate limits for auth actions (login, signup, password reset)
 */

import type { APIRoute } from 'astro';
import { enforceRateLimit, type RateLimitType } from '@/lib/security/rate-limiter';

const actionToRateLimitType: Record<string, RateLimitType> = {
  login: 'login',
  signup: 'signup',
  password_reset: 'password_reset',
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const action = body.action as string;

    if (!action || !actionToRateLimitType[action]) {
      return new Response(
        JSON.stringify({ error: 'Invalid action' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const rateLimitType = actionToRateLimitType[action];
    const rateLimitResponse = await enforceRateLimit(rateLimitType, request);

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    return new Response(
      JSON.stringify({ allowed: true }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Rate limit check error:', error);
    // Allow on error (fail open)
    return new Response(
      JSON.stringify({ allowed: true }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
