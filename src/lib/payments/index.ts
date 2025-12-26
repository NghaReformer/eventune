/**
 * Payment Module Exports
 */

// Types
export type {
  SupportedCurrency,
  PaymentStatus,
  PaymentMethodType,
  PaymentInitParams,
  PaymentInitResult,
  PaymentVerifyParams,
  PaymentVerifyResult,
  RefundParams,
  RefundResult,
  WebhookPayload,
  WebhookVerifyResult,
  PaymentProvider,
  ProviderConfig,
  HealthCheckResult,
  PaymentSystemHealth,
} from './types';

// Provider Factory
export {
  getAllProviders,
  getProviderById,
  getProviderForCurrency,
  getProviderForMethod,
  getProvidersForCurrency,
  getProvidersForCountry,
  getBestProvider,
  getDefaultCurrency,
  getAvailableMethods,
  checkProviderHealth,
  checkAllProvidersHealth,
  isCurrencyAvailable,
} from './provider-factory';

// Individual Providers (for direct access if needed)
export { StripeProvider } from './stripe-provider';
export { CamPayProvider } from './campay-provider';
