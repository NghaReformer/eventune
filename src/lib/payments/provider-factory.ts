/**
 * Payment Provider Factory
 * Selects the appropriate payment provider based on currency/method
 */

import type {
  PaymentProvider,
  SupportedCurrency,
  PaymentMethodType,
  HealthCheckResult,
  PaymentSystemHealth,
} from './types';
import { StripeProvider } from './stripe-provider';
import { CamPayProvider } from './campay-provider';

// Singleton instances
let stripeProvider: StripeProvider | null = null;
let camPayProvider: CamPayProvider | null = null;

/**
 * Get the Stripe provider instance
 */
function getStripeProvider(): StripeProvider {
  if (!stripeProvider) {
    stripeProvider = new StripeProvider();
  }
  return stripeProvider;
}

/**
 * Get the CamPay provider instance
 */
function getCamPayProvider(): CamPayProvider {
  if (!camPayProvider) {
    camPayProvider = new CamPayProvider();
  }
  return camPayProvider;
}

/**
 * Get all available payment providers
 */
export function getAllProviders(): PaymentProvider[] {
  return [getStripeProvider(), getCamPayProvider()];
}

/**
 * Get payment provider by ID
 */
export function getProviderById(providerId: string): PaymentProvider | null {
  switch (providerId) {
    case 'stripe':
      return getStripeProvider();
    case 'campay':
      return getCamPayProvider();
    default:
      return null;
  }
}

/**
 * Get the appropriate payment provider for a currency
 */
export function getProviderForCurrency(
  currency: SupportedCurrency
): PaymentProvider {
  switch (currency) {
    case 'USD':
      return getStripeProvider();
    case 'XAF':
      return getCamPayProvider();
    default:
      throw new Error(`Unsupported currency: ${currency}`);
  }
}

/**
 * Get the appropriate payment provider for a payment method
 */
export function getProviderForMethod(
  method: PaymentMethodType
): PaymentProvider {
  switch (method) {
    case 'card':
      return getStripeProvider();
    case 'mtn_momo':
    case 'orange_money':
      return getCamPayProvider();
    default:
      throw new Error(`Unsupported payment method: ${method}`);
  }
}

/**
 * Get providers that support a specific currency
 */
export function getProvidersForCurrency(
  currency: SupportedCurrency
): PaymentProvider[] {
  return getAllProviders().filter((p) => p.supports(currency));
}

/**
 * Get providers that support a specific country
 */
export function getProvidersForCountry(
  countryCode: string
): PaymentProvider[] {
  return getAllProviders().filter(
    (p) => p.supportedCountries.length === 0 || p.supportedCountries.includes(countryCode)
  );
}

/**
 * Get the best provider for a specific combination
 */
export function getBestProvider(options: {
  currency: SupportedCurrency;
  method?: PaymentMethodType;
  country?: string;
}): PaymentProvider | null {
  const providers = getAllProviders();

  for (const provider of providers) {
    const currencySupported = provider.supportedCurrencies.includes(options.currency);
    const methodSupported = !options.method || provider.supportedMethods.includes(options.method);
    const countrySupported =
      !options.country ||
      provider.supportedCountries.length === 0 ||
      provider.supportedCountries.includes(options.country);

    if (currencySupported && methodSupported && countrySupported) {
      return provider;
    }
  }

  return null;
}

/**
 * Determine the default currency based on country
 */
export function getDefaultCurrency(countryCode?: string): SupportedCurrency {
  if (countryCode === 'CM') {
    return 'XAF';
  }
  return 'USD';
}

/**
 * Get available payment methods for a currency
 */
export function getAvailableMethods(
  currency: SupportedCurrency
): PaymentMethodType[] {
  const provider = getProviderForCurrency(currency);
  return provider.supportedMethods;
}

/**
 * Check health of a specific provider
 */
export async function checkProviderHealth(
  providerId: string
): Promise<HealthCheckResult | null> {
  const provider = getProviderById(providerId);
  if (!provider) {
    return null;
  }
  return provider.healthCheck();
}

/**
 * Check health of all payment providers
 * Runs checks in parallel for efficiency
 */
export async function checkAllProvidersHealth(): Promise<PaymentSystemHealth> {
  const providers = getAllProviders();
  const checkedAt = new Date();

  // Run health checks in parallel
  const results = await Promise.all(
    providers.map(async (provider): Promise<HealthCheckResult> => {
      try {
        return await provider.healthCheck();
      } catch (error) {
        // If healthCheck itself throws, wrap the error
        return {
          providerId: provider.providerId,
          healthy: false,
          responseTimeMs: 0,
          checkedAt,
          error: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    })
  );

  const healthyCount = results.filter((r) => r.healthy).length;
  const totalCount = results.length;
  const allHealthy = healthyCount === totalCount;

  let summary: string;
  if (allHealthy) {
    summary = `All ${totalCount} payment providers are healthy`;
  } else if (healthyCount === 0) {
    summary = `All ${totalCount} payment providers are unhealthy - payments may be unavailable`;
  } else {
    summary = `${healthyCount}/${totalCount} payment providers are healthy`;
  }

  return {
    healthy: allHealthy,
    providers: results,
    checkedAt,
    summary,
  };
}

/**
 * Check if at least one provider is available for a currency
 */
export async function isCurrencyAvailable(
  currency: SupportedCurrency
): Promise<boolean> {
  const providers = getProvidersForCurrency(currency);
  if (providers.length === 0) {
    return false;
  }

  // Check if at least one provider is healthy
  const results = await Promise.all(
    providers.map((p) => p.healthCheck())
  );

  return results.some((r) => r.healthy);
}
