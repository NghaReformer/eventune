/**
 * PATCH /api/referrals/me/settings
 * Update agent payout method and details
 */

import type { APIRoute } from 'astro';
import { z } from 'zod';
import { getSession } from '../../../../lib/auth/session';
import { updatePayoutSettings } from '../../../../services/referral.service';

// Conditional schemas based on payment method
const mobileMoneySchema = z.object({
  method: z.literal('mobile_money'),
  details: z.object({
    phone: z.string().min(1),
    operator: z.string().min(1),
    name: z.string().optional(),
  }),
});

const bankTransferSchema = z.object({
  method: z.literal('bank_transfer'),
  details: z.object({
    account_number: z.string().min(1),
    account_name: z.string().min(1),
    bank_name: z.string().min(1),
    bank_code: z.string().optional(),
    swift_code: z.string().optional(),
  }),
});

const paypalSchema = z.object({
  method: z.literal('paypal'),
  details: z.object({
    email: z.string().email(),
  }),
});

const settingsUpdateSchema = z.discriminatedUnion('method', [
  mobileMoneySchema,
  bankTransferSchema,
  paypalSchema,
]);

export const PATCH: APIRoute = async ({ request, cookies }) => {
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
    // Parse and validate request body
    const body = await request.json();
    const validation = settingsUpdateSchema.safeParse(body);

    if (!validation.success) {
      return new Response(
        JSON.stringify({
          error: 'Invalid request body',
          details: validation.error.flatten().fieldErrors,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { method, details } = validation.data;

    const result = await updatePayoutSettings(userId, method, details);

    if (!result.success) {
      return new Response(
        JSON.stringify({ error: result.error }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Payout settings updated successfully' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[PATCH /api/referrals/me/settings] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
