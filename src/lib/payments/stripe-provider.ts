/**
 * Stripe Payment Provider
 * Handles USD payments via credit/debit cards
 */

import Stripe from 'stripe';
import type {
  PaymentProvider,
  PaymentInitParams,
  PaymentInitResult,
  PaymentVerifyParams,
  PaymentVerifyResult,
  RefundParams,
  RefundResult,
  WebhookPayload,
  WebhookVerifyResult,
  SupportedCurrency,
  PaymentMethodType,
  PaymentStatus,
  HealthCheckResult,
} from './types';

export class StripeProvider implements PaymentProvider {
  readonly name = 'Stripe';
  readonly providerId = 'stripe';
  readonly supportedCurrencies: SupportedCurrency[] = ['USD'];
  readonly supportedCountries: string[] = []; // All countries
  readonly supportedMethods: PaymentMethodType[] = ['card'];

  private stripe: Stripe;
  private webhookSecret: string;

  constructor() {
    const secretKey = import.meta.env.STRIPE_SECRET_KEY;
    this.webhookSecret = import.meta.env.STRIPE_WEBHOOK_SECRET;

    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }
    if (!this.webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET environment variable is required');
    }

    this.stripe = new Stripe(secretKey, {
      apiVersion: '2024-11-20.acacia',
      typescript: true,
    });
  }

  supports(currency: SupportedCurrency, method?: PaymentMethodType): boolean {
    const currencySupported = this.supportedCurrencies.includes(currency);
    if (!method) return currencySupported;
    return currencySupported && this.supportedMethods.includes(method);
  }

  async initiatePayment(params: PaymentInitParams): Promise<PaymentInitResult> {
    try {
      const session = await this.stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        customer_email: params.customerEmail,
        client_reference_id: params.orderId,
        line_items: [
          {
            price_data: {
              currency: params.currency.toLowerCase(),
              unit_amount: Math.round(params.amount * 100), // Convert to cents
              product_data: {
                name: `Custom Song - Order ${params.orderNumber}`,
                description: 'Personalized song from Eventune Studios',
              },
            },
            quantity: 1,
          },
        ],
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        metadata: {
          orderId: params.orderId,
          orderNumber: params.orderNumber,
          ...params.metadata,
        },
        expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // 30 minutes
      });

      return {
        success: true,
        sessionId: session.id,
        checkoutUrl: session.url ?? undefined,
        expiresAt: new Date((session.expires_at ?? Date.now() / 1000 + 1800) * 1000),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        sessionId: '',
        expiresAt: new Date(),
        error: `Stripe error: ${message}`,
      };
    }
  }

  async verifyPayment(params: PaymentVerifyParams): Promise<PaymentVerifyResult> {
    try {
      const session = await this.stripe.checkout.sessions.retrieve(
        params.sessionId,
        { expand: ['payment_intent'] }
      );

      const paymentIntent = session.payment_intent as Stripe.PaymentIntent | null;

      let status: PaymentStatus = 'pending';
      if (session.payment_status === 'paid') {
        status = 'completed';
      } else if (session.status === 'expired') {
        status = 'failed';
      } else if (paymentIntent?.status === 'processing') {
        status = 'processing';
      }

      return {
        status,
        transactionId: paymentIntent?.id,
        paidAmount: session.amount_total ? session.amount_total / 100 : undefined,
        currency: session.currency?.toUpperCase() as SupportedCurrency,
        paidAt: session.payment_status === 'paid' ? new Date() : undefined,
        rawResponse: session as unknown as Record<string, unknown>,
      };
    } catch (error) {
      return {
        status: 'failed',
        rawResponse: { error: error instanceof Error ? error.message : 'Unknown error' },
      };
    }
  }

  async refund(params: RefundParams): Promise<RefundResult> {
    try {
      const refund = await this.stripe.refunds.create(
        {
          payment_intent: params.paymentReference,
          amount: Math.round(params.amount * 100), // Convert to cents
          reason: 'requested_by_customer',
          metadata: {
            reason: params.reason,
          },
        },
        {
          idempotencyKey: params.idempotencyKey,
        }
      );

      return {
        success: true,
        refundId: refund.id,
        amount: refund.amount / 100,
        status: refund.status === 'succeeded' ? 'completed' : 'pending',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Refund failed',
      };
    }
  }

  async verifyWebhook(payload: WebhookPayload): Promise<WebhookVerifyResult> {
    try {
      const event = this.stripe.webhooks.constructEvent(
        payload.rawBody,
        payload.signature,
        this.webhookSecret
      );

      let paymentStatus: PaymentStatus | undefined;
      let orderId: string | undefined;
      let amount: number | undefined;
      let currency: SupportedCurrency | undefined;

      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          paymentStatus = session.payment_status === 'paid' ? 'completed' : 'pending';
          orderId = session.metadata?.orderId ?? session.client_reference_id ?? undefined;
          amount = session.amount_total ? session.amount_total / 100 : undefined;
          currency = session.currency?.toUpperCase() as SupportedCurrency;
          break;
        }
        case 'payment_intent.payment_failed': {
          const intent = event.data.object as Stripe.PaymentIntent;
          paymentStatus = 'failed';
          orderId = intent.metadata?.orderId;
          break;
        }
        case 'charge.refunded': {
          const charge = event.data.object as Stripe.Charge;
          paymentStatus = charge.refunded ? 'refunded' : 'partially_refunded';
          orderId = charge.metadata?.orderId;
          break;
        }
      }

      return {
        valid: true,
        eventType: event.type,
        orderId,
        paymentStatus,
        amount,
        currency,
        data: event.data.object as Record<string, unknown>,
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Invalid webhook',
      };
    }
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const checkedAt = new Date();

    try {
      // Retrieve the account to verify API connectivity
      const account = await this.stripe.accounts.retrieve();
      const responseTimeMs = Date.now() - startTime;

      return {
        providerId: this.providerId,
        healthy: true,
        responseTimeMs,
        checkedAt,
        details: {
          accountId: account.id,
          chargesEnabled: account.charges_enabled,
          payoutsEnabled: account.payouts_enabled,
          country: account.country,
        },
      };
    } catch (error) {
      const responseTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      return {
        providerId: this.providerId,
        healthy: false,
        responseTimeMs,
        checkedAt,
        error: `Stripe API health check failed: ${errorMessage}`,
      };
    }
  }
}
