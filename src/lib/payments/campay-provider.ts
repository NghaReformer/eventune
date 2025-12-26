/**
 * CamPay Payment Provider
 * Handles XAF payments via MTN/Orange Mobile Money in Cameroon
 */

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
import { normalizePhoneNumber } from '../utils/phone';

interface CamPayTokenResponse {
  token: string;
  expires_in: number;
}

interface CamPayPaymentResponse {
  reference: string;
  ussd_code: string;
  operator: string;
  status: string;
}

interface CamPayStatusResponse {
  reference: string;
  status: 'PENDING' | 'SUCCESSFUL' | 'FAILED';
  amount: number;
  currency: string;
  operator: string;
  code: string;
  operator_reference?: string;
  endpoint?: string;
}

interface CamPayWebhookData {
  reference: string;
  external_reference?: string; // Order ID we passed when initiating payment
  status: 'SUCCESSFUL' | 'FAILED';
  amount: number;
  currency: string;
  code: string;
  operator: string;
  operator_reference?: string;
  signature: string;
}

export class CamPayProvider implements PaymentProvider {
  readonly name = 'CamPay';
  readonly providerId = 'campay';
  readonly supportedCurrencies: SupportedCurrency[] = ['XAF'];
  readonly supportedCountries: string[] = ['CM'];
  readonly supportedMethods: PaymentMethodType[] = ['mtn_momo', 'orange_money'];

  private baseUrl: string;
  private username: string;
  private password: string;
  private webhookSecret: string;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor() {
    const username = import.meta.env.CAMPAY_USERNAME;
    const password = import.meta.env.CAMPAY_PASSWORD;
    const webhookSecret = import.meta.env.CAMPAY_WEBHOOK_SECRET;
    const environment = import.meta.env.CAMPAY_ENV || 'sandbox';

    if (!username || !password) {
      throw new Error('CAMPAY_USERNAME and CAMPAY_PASSWORD environment variables are required');
    }
    if (!webhookSecret) {
      throw new Error('CAMPAY_WEBHOOK_SECRET environment variable is required');
    }

    this.username = username;
    this.password = password;
    this.webhookSecret = webhookSecret;
    this.baseUrl =
      environment === 'production'
        ? 'https://www.campay.net/api'
        : 'https://demo.campay.net/api';
  }

  supports(currency: SupportedCurrency, method?: PaymentMethodType): boolean {
    const currencySupported = this.supportedCurrencies.includes(currency);
    if (!method) return currencySupported;
    return currencySupported && this.supportedMethods.includes(method);
  }

  /**
   * Get access token (with caching)
   */
  private async getAccessToken(): Promise<string> {
    // Return cached token if valid
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    const response = await fetch(`${this.baseUrl}/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: this.username,
        password: this.password,
      }),
    });

    if (!response.ok) {
      throw new Error(`CamPay auth failed: ${response.status}`);
    }

    const data = (await response.json()) as CamPayTokenResponse;
    this.accessToken = data.token;
    this.tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000; // 60s buffer

    return this.accessToken;
  }

  /**
   * Make authenticated API request
   */
  private async apiRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' = 'POST',
    body?: Record<string, unknown>
  ): Promise<T> {
    const token = await this.getAccessToken();

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Token ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`CamPay API error: ${response.status} - ${error}`);
    }

    return response.json() as Promise<T>;
  }

  async initiatePayment(params: PaymentInitParams): Promise<PaymentInitResult> {
    try {
      if (!params.customerPhone) {
        return {
          success: false,
          sessionId: '',
          expiresAt: new Date(),
          error: 'Phone number is required for mobile money payments',
        };
      }

      // Normalize phone number using E.164 format
      const phoneResult = normalizePhoneNumber(params.customerPhone, 'CM');
      if (!phoneResult.valid || !phoneResult.phone) {
        return {
          success: false,
          sessionId: '',
          expiresAt: new Date(),
          error: phoneResult.error ?? 'Invalid phone number',
        };
      }

      // CamPay expects number without + prefix
      const phone = phoneResult.phone.e164.replace('+', '');

      const response = await this.apiRequest<CamPayPaymentResponse>('/collect/', 'POST', {
        amount: Math.round(params.amount).toString(),
        currency: 'XAF',
        from: phone,
        description: `Custom Song - Order ${params.orderNumber}`,
        external_reference: params.orderId,
      });

      return {
        success: true,
        sessionId: response.reference,
        ussdCode: response.ussd_code,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        sessionId: '',
        expiresAt: new Date(),
        error: `CamPay error: ${message}`,
      };
    }
  }

  async verifyPayment(params: PaymentVerifyParams): Promise<PaymentVerifyResult> {
    try {
      const response = await this.apiRequest<CamPayStatusResponse>(
        `/transaction/${params.sessionId}/`,
        'GET'
      );

      let status: PaymentStatus;
      switch (response.status) {
        case 'SUCCESSFUL':
          status = 'completed';
          break;
        case 'FAILED':
          status = 'failed';
          break;
        default:
          status = 'pending';
      }

      return {
        status,
        transactionId: response.operator_reference,
        paidAmount: response.amount,
        currency: 'XAF',
        paidAt: status === 'completed' ? new Date() : undefined,
        rawResponse: response as unknown as Record<string, unknown>,
      };
    } catch (error) {
      return {
        status: 'failed',
        rawResponse: { error: error instanceof Error ? error.message : 'Unknown error' },
      };
    }
  }

  async refund(_params: RefundParams): Promise<RefundResult> {
    // CamPay doesn't support automatic refunds via API
    // Refunds must be done manually
    return {
      success: false,
      error: 'CamPay refunds must be processed manually. Please contact support.',
      status: 'pending',
    };
  }

  async verifyWebhook(payload: WebhookPayload): Promise<WebhookVerifyResult> {
    try {
      const data = JSON.parse(payload.rawBody) as CamPayWebhookData;

      // Verify signature
      // CamPay uses a signature based on the webhook secret
      const expectedSignature = await this.generateSignature(data);
      if (data.signature !== expectedSignature) {
        return {
          valid: false,
          error: 'Invalid webhook signature',
        };
      }

      let paymentStatus: PaymentStatus;
      switch (data.status) {
        case 'SUCCESSFUL':
          paymentStatus = 'completed';
          break;
        case 'FAILED':
          paymentStatus = 'failed';
          break;
        default:
          paymentStatus = 'pending';
      }

      return {
        valid: true,
        eventType: `payment.${data.status.toLowerCase()}`,
        orderId: data.external_reference, // The order ID we passed when initiating
        paymentStatus,
        amount: data.amount,
        currency: 'XAF',
        data: data as unknown as Record<string, unknown>,
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Invalid webhook payload',
      };
    }
  }

  /**
   * Generate HMAC signature for webhook verification
   */
  private async generateSignature(data: CamPayWebhookData): Promise<string> {
    const message = `${data.reference}${data.amount}${data.status}`;

    // Use Web Crypto API for HMAC
    const encoder = new TextEncoder();
    const keyData = encoder.encode(this.webhookSecret);
    const messageData = encoder.encode(message);

    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', key, messageData);
    const hashArray = Array.from(new Uint8Array(signature));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const checkedAt = new Date();

    try {
      // Test authentication by getting a token
      // This verifies credentials and API connectivity
      const token = await this.getAccessToken();
      const responseTimeMs = Date.now() - startTime;

      // Verify the token is valid
      if (!token) {
        return {
          providerId: this.providerId,
          healthy: false,
          responseTimeMs,
          checkedAt,
          error: 'CamPay authentication failed: no token received',
        };
      }

      return {
        providerId: this.providerId,
        healthy: true,
        responseTimeMs,
        checkedAt,
        details: {
          environment: this.baseUrl.includes('demo') ? 'sandbox' : 'production',
          tokenValid: true,
          tokenExpiresAt: new Date(this.tokenExpiresAt).toISOString(),
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
        error: `CamPay API health check failed: ${errorMessage}`,
      };
    }
  }
}
