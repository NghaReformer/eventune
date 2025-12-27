/**
 * GET /api/referrals/me/commissions
 * Returns paginated and filtered list of commissions
 */

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { getSession } from '../../../../lib/auth/session';
import { getAgentCommissions } from '../../../../services/referral.service';

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(['pending', 'approved', 'paid', 'rejected']).optional(),
  currency: z.enum(['USD', 'XAF']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  level: z.coerce.number().int().positive().max(10).optional(),
});

export const GET: APIRoute = async ({ request, cookies, url }) => {
  // Authenticate user
  const session = await getSession(cookies);
  if (!session.success) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const userId = session.data.user.id;

  try {
    // Parse and validate query parameters
    const params = Object.fromEntries(url.searchParams);
    const validation = querySchema.safeParse(params);

    if (!validation.success) {
      return new Response(
        JSON.stringify({
          error: 'Invalid query parameters',
          details: validation.error.flatten().fieldErrors,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { page, limit, status, currency, startDate, endDate, level } = validation.data;

    const filters = {
      ...(status && { status }),
      ...(currency && { currency }),
      ...(startDate && { startDate }),
      ...(endDate && { endDate }),
      ...(level && { level }),
    };

    const result = await getAgentCommissions(userId, filters, page, limit);

    if (!result) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch commissions' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[GET /api/referrals/me/commissions] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
