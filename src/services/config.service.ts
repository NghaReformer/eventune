/**
 * Config Service
 * Fetches business configuration from database with caching
 *
 * All dynamic business logic is stored in database config tables
 * and cached in memory to minimize database calls.
 *
 * Cache is automatically invalidated via Supabase Realtime when data changes.
 */

import { getServerClient } from '../lib/supabase/server';
import { supabase as browserClient } from '../lib/supabase/client';
import type { Database, Tables } from '../types/database.types';
import type { RealtimeChannel } from '@supabase/supabase-js';

// Cache TTL in milliseconds
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Cache storage
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

// Realtime subscription for cache invalidation
let realtimeChannel: RealtimeChannel | null = null;
let realtimeInitialized = false;

/**
 * Initialize Supabase Realtime for cache invalidation
 * Call this on app startup (client-side only)
 */
export function initConfigRealtime(): void {
  if (realtimeInitialized || typeof window === 'undefined') {
    return;
  }

  realtimeInitialized = true;

  const configTables = [
    'config_packages',
    'config_occasions',
    'config_payment_methods',
    'config_order_statuses',
    'config_capacity',
    'config_testimonials',
    'config_faq',
    'config_samples',
    'config_settings',
  ] as const;

  realtimeChannel = browserClient.channel('config-changes');

  for (const table of configTables) {
    realtimeChannel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      (payload) => {
        console.log(`Config change detected in ${table}:`, payload.eventType);
        // Invalidate all cache entries for this table
        const cachePrefix = table.replace('config_', '') + ':';
        invalidateCache(cachePrefix + '*');
      }
    );
  }

  realtimeChannel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      console.log('Config realtime subscription active');
    } else if (status === 'CHANNEL_ERROR') {
      console.error('Config realtime subscription error');
      realtimeInitialized = false;
    }
  });
}

/**
 * Cleanup realtime subscription
 */
export function cleanupConfigRealtime(): void {
  if (realtimeChannel) {
    browserClient.removeChannel(realtimeChannel);
    realtimeChannel = null;
    realtimeInitialized = false;
  }
}

/**
 * Get cached data or fetch from database
 */
async function getCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = CACHE_TTL
): Promise<T> {
  const now = Date.now();
  const cached = cache.get(key) as CacheEntry<T> | undefined;

  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const data = await fetcher();
  cache.set(key, { data, expiresAt: now + ttl });
  return data;
}

/**
 * Invalidate cache by key or pattern
 */
export function invalidateCache(keyOrPattern?: string): void {
  if (!keyOrPattern) {
    cache.clear();
    return;
  }

  if (keyOrPattern.endsWith('*')) {
    const prefix = keyOrPattern.slice(0, -1);
    for (const key of cache.keys()) {
      if (key.startsWith(prefix)) {
        cache.delete(key);
      }
    }
  } else {
    cache.delete(keyOrPattern);
  }
}

/**
 * Force refresh all config caches
 */
export function refreshAllCaches(): void {
  cache.clear();
}

// ============================================
// PACKAGES
// ============================================

export type Package = Tables<'config_packages'>;

/**
 * Get all active packages ordered by display_order
 */
export async function getPackages(): Promise<Package[]> {
  return getCached('packages:active', async () => {
    const supabase = getServerClient();
    const { data, error } = await supabase
      .from('config_packages')
      .select('*')
      .eq('is_active', true)
      .order('display_order');

    if (error) throw error;
    return data ?? [];
  });
}

/**
 * Get a single package by slug
 */
export async function getPackageBySlug(slug: string): Promise<Package | null> {
  return getCached(`packages:${slug}`, async () => {
    const supabase = getServerClient();
    const { data, error } = await supabase
      .from('config_packages')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  });
}

/**
 * Get package price for a specific currency
 */
export function getPackagePrice(
  pkg: Package,
  currency: 'USD' | 'XAF'
): number {
  return currency === 'USD' ? pkg.price_usd : pkg.price_xaf;
}

// ============================================
// OCCASIONS
// ============================================

export type Occasion = Tables<'config_occasions'>;

/**
 * Get all active occasions ordered by display_order
 */
export async function getOccasions(): Promise<Occasion[]> {
  return getCached('occasions:active', async () => {
    const supabase = getServerClient();
    const { data, error } = await supabase
      .from('config_occasions')
      .select('*')
      .eq('is_active', true)
      .order('display_order');

    if (error) throw error;
    return data ?? [];
  });
}

/**
 * Get a single occasion by slug
 */
export async function getOccasionBySlug(slug: string): Promise<Occasion | null> {
  return getCached(`occasions:${slug}`, async () => {
    const supabase = getServerClient();
    const { data, error } = await supabase
      .from('config_occasions')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  });
}

// ============================================
// PAYMENT METHODS
// ============================================

export type PaymentMethod = Tables<'config_payment_methods'>;

/**
 * Get all active payment methods
 */
export async function getPaymentMethods(): Promise<PaymentMethod[]> {
  return getCached('payment_methods:active', async () => {
    const supabase = getServerClient();
    const { data, error } = await supabase
      .from('config_payment_methods')
      .select('*')
      .eq('is_active', true)
      .order('display_order');

    if (error) throw error;
    return data ?? [];
  });
}

/**
 * Get payment methods for a specific currency
 */
export async function getPaymentMethodsForCurrency(
  currency: string
): Promise<PaymentMethod[]> {
  const methods = await getPaymentMethods();
  return methods.filter((m) => m.currencies.includes(currency));
}

/**
 * Get payment methods for a specific country
 */
export async function getPaymentMethodsForCountry(
  countryCode: string
): Promise<PaymentMethod[]> {
  const methods = await getPaymentMethods();
  return methods.filter(
    (m) => !m.countries || m.countries.includes(countryCode)
  );
}

// ============================================
// ORDER STATUSES
// ============================================

export type OrderStatus = Tables<'config_order_statuses'>;

/**
 * Get all order statuses
 */
export async function getOrderStatuses(): Promise<OrderStatus[]> {
  return getCached('order_statuses:all', async () => {
    const supabase = getServerClient();
    const { data, error } = await supabase
      .from('config_order_statuses')
      .select('*')
      .order('display_order');

    if (error) throw error;
    return data ?? [];
  });
}

/**
 * Get order status by slug
 */
export async function getOrderStatusBySlug(
  slug: string
): Promise<OrderStatus | null> {
  const statuses = await getOrderStatuses();
  return statuses.find((s) => s.slug === slug) ?? null;
}

/**
 * Check if a status transition is valid
 */
export async function isValidStatusTransition(
  currentStatus: string,
  newStatus: string
): Promise<boolean> {
  const current = await getOrderStatusBySlug(currentStatus);
  if (!current) return false;
  return current.next_statuses.includes(newStatus);
}

// ============================================
// CAPACITY
// ============================================

export type Capacity = Tables<'config_capacity'>;

/**
 * Get capacity for a specific date
 */
export async function getCapacityForDate(date: string): Promise<Capacity | null> {
  // Don't cache capacity - needs real-time accuracy
  const supabase = getServerClient();
  const { data, error } = await supabase
    .from('config_capacity')
    .select('*')
    .eq('date', date)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

/**
 * Check if a date has available capacity
 */
export async function hasCapacity(date: string): Promise<boolean> {
  const capacity = await getCapacityForDate(date);
  if (!capacity) {
    // No capacity record = use default capacity
    const settings = await getSetting('default_capacity');
    return true; // Default to available
  }
  if (capacity.is_blackout) return false;
  return capacity.current_orders < capacity.max_orders;
}

// ============================================
// REFUND POLICIES
// ============================================

export type RefundPolicy = Tables<'config_refund_policies'>;

/**
 * Get refund policy for a specific order status
 */
export async function getRefundPolicy(
  statusSlug: string
): Promise<RefundPolicy | null> {
  return getCached(`refund_policies:${statusSlug}`, async () => {
    const supabase = getServerClient();
    const { data, error } = await supabase
      .from('config_refund_policies')
      .select('*')
      .eq('status_slug', statusSlug)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  });
}

/**
 * Calculate refund amount based on order status
 */
export async function calculateRefundAmount(
  statusSlug: string,
  originalAmount: number
): Promise<{ amount: number; percentage: number; requiresReview: boolean }> {
  const policy = await getRefundPolicy(statusSlug);

  if (!policy) {
    return { amount: 0, percentage: 0, requiresReview: true };
  }

  return {
    amount: (originalAmount * policy.refund_percentage) / 100,
    percentage: policy.refund_percentage,
    requiresReview: policy.requires_manual_review,
  };
}

// ============================================
// TESTIMONIALS
// ============================================

export type Testimonial = Tables<'config_testimonials'>;

/**
 * Get active testimonials
 */
export async function getTestimonials(
  options: { featured?: boolean; limit?: number } = {}
): Promise<Testimonial[]> {
  const cacheKey = `testimonials:${options.featured ? 'featured' : 'all'}:${options.limit ?? 'all'}`;

  return getCached(cacheKey, async () => {
    const supabase = getServerClient();
    let query = supabase
      .from('config_testimonials')
      .select('*')
      .eq('is_active', true)
      .order('display_order');

    if (options.featured) {
      query = query.eq('is_featured', true);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  });
}

// ============================================
// FAQ
// ============================================

export type FAQ = Tables<'config_faq'>;

/**
 * Get active FAQs by locale
 */
export async function getFAQs(locale: string = 'en'): Promise<FAQ[]> {
  return getCached(`faqs:${locale}`, async () => {
    const supabase = getServerClient();
    const { data, error } = await supabase
      .from('config_faq')
      .select('*')
      .eq('is_active', true)
      .eq('locale', locale)
      .order('display_order');

    if (error) throw error;
    return data ?? [];
  });
}

/**
 * Get FAQs grouped by category
 */
export async function getFAQsByCategory(
  locale: string = 'en'
): Promise<Record<string, FAQ[]>> {
  const faqs = await getFAQs(locale);
  return faqs.reduce(
    (acc, faq) => {
      const category = faq.category || 'general';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(faq);
      return acc;
    },
    {} as Record<string, FAQ[]>
  );
}

// ============================================
// SAMPLES
// ============================================

export type Sample = Tables<'config_samples'>;

/**
 * Get active samples
 */
export async function getSamples(
  options: { featured?: boolean; occasion?: string; limit?: number } = {}
): Promise<Sample[]> {
  const cacheKey = `samples:${JSON.stringify(options)}`;

  return getCached(cacheKey, async () => {
    const supabase = getServerClient();
    let query = supabase
      .from('config_samples')
      .select('*')
      .eq('is_active', true)
      .order('display_order');

    if (options.featured) {
      query = query.eq('is_featured', true);
    }

    if (options.occasion) {
      query = query.eq('occasion', options.occasion);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  });
}

// ============================================
// SETTINGS
// ============================================

export type Setting = Tables<'config_settings'>;

/**
 * Get a specific setting value
 */
export async function getSetting<T = string>(
  key: string,
  defaultValue?: T
): Promise<T> {
  return getCached(`settings:${key}`, async () => {
    const supabase = getServerClient();
    const { data, error } = await supabase
      .from('config_settings')
      .select('value')
      .eq('key', key)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    if (!data) {
      return defaultValue as T;
    }

    // Try to parse JSON, otherwise return as string
    try {
      return JSON.parse(data.value) as T;
    } catch {
      return data.value as T;
    }
  });
}

/**
 * Check if site is in maintenance mode
 */
export async function isMaintenanceMode(): Promise<{
  enabled: boolean;
  message: string;
}> {
  const setting = await getSetting<{ enabled: boolean; message: string }>(
    'site_maintenance',
    { enabled: false, message: '' }
  );
  return setting;
}

/**
 * Check if booking is enabled
 */
export async function isBookingEnabled(): Promise<boolean> {
  const setting = await getSetting('booking_enabled', 'true');
  return setting === 'true' || setting === true;
}

// ============================================
// BULK FETCH FOR SSR
// ============================================

/**
 * Fetch all public config data for SSR hydration
 * Use this on initial page load to minimize requests
 */
export async function getPublicConfig(): Promise<{
  packages: Package[];
  occasions: Occasion[];
  testimonials: Testimonial[];
  faqs: FAQ[];
  samples: Sample[];
  settings: {
    maintenanceMode: { enabled: boolean; message: string };
    bookingEnabled: boolean;
  };
}> {
  const [packages, occasions, testimonials, faqs, samples, maintenanceMode, bookingEnabled] =
    await Promise.all([
      getPackages(),
      getOccasions(),
      getTestimonials({ featured: true }),
      getFAQs('en'),
      getSamples({ featured: true }),
      isMaintenanceMode(),
      isBookingEnabled(),
    ]);

  return {
    packages,
    occasions,
    testimonials,
    faqs,
    samples,
    settings: {
      maintenanceMode,
      bookingEnabled,
    },
  };
}
