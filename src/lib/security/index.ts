/**
 * Security Module Exports
 */

// Rate Limiting
export {
  checkRateLimit,
  enforceRateLimit,
  getRateLimitHeaders,
  getClientIP,
  createIdentifier,
  type RateLimitType,
  type RateLimitResult,
} from './rate-limiter';

// Encryption
export {
  encrypt,
  decrypt,
  hash,
  generateToken,
  hmacSign,
  hmacVerify,
  encryptFields,
  decryptFields,
} from './encryption';

// Webhook Verification
export {
  verifyWebhook,
  verifyStripeWebhook,
  verifyCamPayWebhook,
  isWebhookDuplicate,
  markWebhookProcessed,
  createIdempotencyKey,
  validatePaymentAmount,
  type WebhookProvider,
  type WebhookVerificationResult,
} from './webhook-verifier';
