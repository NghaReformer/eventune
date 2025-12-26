/**
 * Webhook Verification Utilities
 * Verifies webhook signatures from payment providers
 */

import { hmacSign, hmacVerify } from './encryption';

/**
 * Webhook provider types
 */
export type WebhookProvider = 'stripe' | 'campay';

/**
 * Webhook verification result
 */
export interface WebhookVerificationResult {
  valid: boolean;
  error?: string;
  timestamp?: number;
}

/**
 * Verify Stripe webhook signature
 * Stripe uses HMAC-SHA256 with a specific signature format
 */
export async function verifyStripeWebhook(
  payload: string,
  signature: string,
  secret: string
): Promise<WebhookVerificationResult> {
  try {
    // Parse signature header (format: t=timestamp,v1=signature,v0=signature)
    const elements = signature.split(',').reduce(
      (acc, item) => {
        const [key, value] = item.split('=');
        if (key && value) {
          if (!acc[key]) acc[key] = [];
          acc[key].push(value);
        }
        return acc;
      },
      {} as Record<string, string[]>
    );

    const timestamp = elements['t']?.[0];
    const signatures = elements['v1'] ?? [];

    if (!timestamp || signatures.length === 0) {
      return { valid: false, error: 'Invalid signature format' };
    }

    // Check timestamp tolerance (5 minutes)
    const timestampNum = parseInt(timestamp, 10);
    const now = Math.floor(Date.now() / 1000);
    const tolerance = 300; // 5 minutes

    if (Math.abs(now - timestampNum) > tolerance) {
      return { valid: false, error: 'Timestamp outside tolerance', timestamp: timestampNum };
    }

    // Compute expected signature
    const signedPayload = `${timestamp}.${payload}`;
    const expectedSignature = await hmacSign(signedPayload, secret);

    // Check if any provided signature matches
    for (const sig of signatures) {
      if (await hmacVerify(signedPayload, sig, secret)) {
        return { valid: true, timestamp: timestampNum };
      }
    }

    return { valid: false, error: 'Signature mismatch' };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Verification failed',
    };
  }
}

/**
 * Verify CamPay webhook signature
 * CamPay uses HMAC-SHA256 on reference+amount+status
 */
export async function verifyCamPayWebhook(
  data: { reference: string; amount: number; status: string; signature: string },
  secret: string
): Promise<WebhookVerificationResult> {
  try {
    const message = `${data.reference}${data.amount}${data.status}`;
    const isValid = await hmacVerify(message, data.signature, secret);

    if (isValid) {
      return { valid: true };
    }

    return { valid: false, error: 'Signature mismatch' };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Verification failed',
    };
  }
}

/**
 * Generic webhook verification
 */
export async function verifyWebhook(
  provider: WebhookProvider,
  request: Request
): Promise<WebhookVerificationResult & { body?: string }> {
  const body = await request.text();

  switch (provider) {
    case 'stripe': {
      const signature = request.headers.get('stripe-signature');
      const secret = import.meta.env.STRIPE_WEBHOOK_SECRET;

      if (!signature || !secret) {
        return { valid: false, error: 'Missing signature or secret' };
      }

      const result = await verifyStripeWebhook(body, signature, secret);
      return { ...result, body };
    }

    case 'campay': {
      const secret = import.meta.env.CAMPAY_WEBHOOK_SECRET;

      if (!secret) {
        return { valid: false, error: 'Missing webhook secret' };
      }

      try {
        const data = JSON.parse(body);
        const result = await verifyCamPayWebhook(data, secret);
        return { ...result, body };
      } catch {
        return { valid: false, error: 'Invalid JSON payload' };
      }
    }

    default:
      return { valid: false, error: `Unknown provider: ${provider}` };
  }
}

/**
 * Check for duplicate webhook (idempotency)
 * Uses a simple in-memory cache - in production, use Redis
 */
const processedWebhooks = new Map<string, number>();
const IDEMPOTENCY_TTL = 24 * 60 * 60 * 1000; // 24 hours

export function isWebhookDuplicate(idempotencyKey: string): boolean {
  const timestamp = processedWebhooks.get(idempotencyKey);
  if (!timestamp) return false;

  // Check if still within TTL
  if (Date.now() - timestamp > IDEMPOTENCY_TTL) {
    processedWebhooks.delete(idempotencyKey);
    return false;
  }

  return true;
}

export function markWebhookProcessed(idempotencyKey: string): void {
  // Cleanup old entries periodically
  if (processedWebhooks.size > 1000) {
    const now = Date.now();
    for (const [key, timestamp] of processedWebhooks) {
      if (now - timestamp > IDEMPOTENCY_TTL) {
        processedWebhooks.delete(key);
      }
    }
  }

  processedWebhooks.set(idempotencyKey, Date.now());
}

/**
 * Create idempotency key from webhook data
 */
export function createIdempotencyKey(
  provider: WebhookProvider,
  eventType: string,
  referenceId: string
): string {
  return `${provider}:${eventType}:${referenceId}`;
}

/**
 * Validate payment amount matches expected
 * Prevents amount manipulation attacks
 */
export function validatePaymentAmount(
  expectedAmount: number,
  actualAmount: number,
  currency: string,
  tolerancePercent: number = 0.01
): { valid: boolean; error?: string } {
  // XAF has no decimals
  const tolerance =
    currency === 'XAF'
      ? 0
      : expectedAmount * tolerancePercent;

  const diff = Math.abs(expectedAmount - actualAmount);

  if (diff > tolerance) {
    return {
      valid: false,
      error: `Amount mismatch: expected ${expectedAmount}, got ${actualAmount}`,
    };
  }

  return { valid: true };
}
