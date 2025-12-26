/**
 * Payment Provider Types
 * Abstract interface for payment providers (Stripe, CamPay, etc.)
 */

/**
 * Supported currencies
 */
export type SupportedCurrency = 'USD' | 'XAF';

/**
 * Payment status
 */
export type PaymentStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'refunded'
  | 'partially_refunded';

/**
 * Payment method type
 */
export type PaymentMethodType =
  | 'card'
  | 'mtn_momo'
  | 'orange_money'
  | 'bank_transfer';

/**
 * Parameters for initiating a payment
 */
export interface PaymentInitParams {
  /** Order ID for reference */
  orderId: string;
  /** Order number for display */
  orderNumber: string;
  /** Amount to charge */
  amount: number;
  /** Currency code */
  currency: SupportedCurrency;
  /** Customer email */
  customerEmail: string;
  /** Customer name */
  customerName: string;
  /** Customer phone (required for mobile money) */
  customerPhone?: string;
  /** Payment method type */
  methodType: PaymentMethodType;
  /** URL to redirect on success */
  successUrl: string;
  /** URL to redirect on cancel */
  cancelUrl: string;
  /** Optional metadata */
  metadata?: Record<string, string>;
}

/**
 * Result of initiating a payment
 */
export interface PaymentInitResult {
  /** Whether the initialization was successful */
  success: boolean;
  /** Provider-specific session/reference ID */
  sessionId: string;
  /** URL to redirect user to (for hosted checkout) */
  checkoutUrl?: string;
  /** USSD code to dial (for mobile money) */
  ussdCode?: string;
  /** Expiration timestamp */
  expiresAt: Date;
  /** Error message if failed */
  error?: string;
}

/**
 * Parameters for verifying a payment
 */
export interface PaymentVerifyParams {
  /** Session/reference ID from initiation */
  sessionId: string;
  /** Order ID for cross-reference */
  orderId: string;
}

/**
 * Result of verifying a payment
 */
export interface PaymentVerifyResult {
  /** Current payment status */
  status: PaymentStatus;
  /** Provider-specific transaction ID */
  transactionId?: string;
  /** Amount actually paid */
  paidAmount?: number;
  /** Currency of payment */
  currency?: SupportedCurrency;
  /** Timestamp of payment completion */
  paidAt?: Date;
  /** Raw provider response */
  rawResponse?: Record<string, unknown>;
}

/**
 * Parameters for refunding a payment
 */
export interface RefundParams {
  /** Original payment reference */
  paymentReference: string;
  /** Amount to refund (partial refund if less than original) */
  amount: number;
  /** Currency */
  currency: SupportedCurrency;
  /** Reason for refund */
  reason: string;
  /** Idempotency key */
  idempotencyKey: string;
}

/**
 * Result of refund operation
 */
export interface RefundResult {
  /** Whether refund was successful */
  success: boolean;
  /** Provider-specific refund ID */
  refundId?: string;
  /** Amount refunded */
  amount?: number;
  /** Status of refund */
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  /** Error message if failed */
  error?: string;
}

/**
 * Webhook payload structure
 */
export interface WebhookPayload {
  /** Raw request body */
  rawBody: string;
  /** Signature header value */
  signature: string;
  /** Any headers needed for verification */
  headers: Record<string, string>;
}

/**
 * Result of webhook verification
 */
export interface WebhookVerifyResult {
  /** Whether webhook is valid */
  valid: boolean;
  /** Parsed event type */
  eventType?: string;
  /** Order/reference ID */
  orderId?: string;
  /** Payment status if applicable */
  paymentStatus?: PaymentStatus;
  /** Amount if applicable */
  amount?: number;
  /** Currency if applicable */
  currency?: SupportedCurrency;
  /** Raw parsed data */
  data?: Record<string, unknown>;
  /** Error if invalid */
  error?: string;
}

/**
 * Payment Provider Interface
 * All payment providers must implement this interface
 */
export interface PaymentProvider {
  /** Provider name */
  readonly name: string;

  /** Provider identifier */
  readonly providerId: string;

  /** Supported currencies */
  readonly supportedCurrencies: SupportedCurrency[];

  /** Supported countries (ISO codes) */
  readonly supportedCountries: string[];

  /** Supported payment method types */
  readonly supportedMethods: PaymentMethodType[];

  /**
   * Initiate a payment session
   */
  initiatePayment(params: PaymentInitParams): Promise<PaymentInitResult>;

  /**
   * Verify payment status
   */
  verifyPayment(params: PaymentVerifyParams): Promise<PaymentVerifyResult>;

  /**
   * Process refund
   */
  refund(params: RefundParams): Promise<RefundResult>;

  /**
   * Verify webhook signature and parse payload
   */
  verifyWebhook(payload: WebhookPayload): Promise<WebhookVerifyResult>;

  /**
   * Check if provider supports a specific method/currency combination
   */
  supports(currency: SupportedCurrency, method?: PaymentMethodType): boolean;

  /**
   * Perform a health check on the payment provider
   * Returns status of API connectivity and basic operations
   */
  healthCheck(): Promise<HealthCheckResult>;
}

/**
 * Provider configuration
 */
export interface ProviderConfig {
  stripe?: {
    secretKey: string;
    publishableKey: string;
    webhookSecret: string;
  };
  campay?: {
    username: string;
    password: string;
    webhookSecret: string;
    environment: 'sandbox' | 'production';
  };
}

/**
 * Health check result for a payment provider
 */
export interface HealthCheckResult {
  /** Provider identifier */
  providerId: string;
  /** Whether the provider is healthy */
  healthy: boolean;
  /** Response time in milliseconds */
  responseTimeMs: number;
  /** Last successful check timestamp */
  checkedAt: Date;
  /** Error details if unhealthy */
  error?: string;
  /** Additional status details */
  details?: Record<string, unknown>;
}

/**
 * Aggregated health status for all providers
 */
export interface PaymentSystemHealth {
  /** Overall health status */
  healthy: boolean;
  /** Individual provider health results */
  providers: HealthCheckResult[];
  /** Timestamp of the check */
  checkedAt: Date;
  /** Summary message */
  summary: string;
}
