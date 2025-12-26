/**
 * Admin Configuration Constants
 * Centralized config to avoid magic numbers and hardcoded values
 */

export const ADMIN_CONFIG = {
  PAGINATION: {
    DEFAULT_SIZE: 20,
    MAX_SIZE: 100,
    MAX_OFFSET: 100000,
  },
  RATE_LIMITS: {
    PAGE_ACCESS: { requests: 100, window: 60000 },
    EXPORT: { requests: 5, window: 60000 },
    STATUS_UPDATE: { requests: 30, window: 60000 },
    NOTES_ADD: { requests: 20, window: 60000 },
  },
  UI: {
    SEARCH_DEBOUNCE_MS: 500,
    CHART_DAYS: 7,
    RECENT_ORDERS_LIMIT: 10,
    NOTES_LIMIT: 50,
  },
  SECURITY: {
    CSRF_TOKEN_TTL: 3600,
    MAX_SEARCH_LENGTH: 100,
    MAX_NOTE_LENGTH: 5000,
  },
} as const;

// Allowed sort columns - whitelist to prevent SQL injection
export const ALLOWED_SORT_COLUMNS = [
  'created_at',
  'order_number',
  'customer_email',
  'status',
  'amount_expected',
  'due_date',
] as const;

export type SortColumn = (typeof ALLOWED_SORT_COLUMNS)[number];

// Valid order statuses - whitelist for filter validation
export const VALID_ORDER_STATUSES = [
  'all',
  'pending',
  'payment_pending',
  'paid',
  'in_progress',
  'review',
  'revision',
  'completed',
  'delivered',
  'cancelled',
  'refunded',
] as const;

export type OrderStatus = (typeof VALID_ORDER_STATUSES)[number];

// Valid payment statuses
export const VALID_PAYMENT_STATUSES = [
  'pending',
  'paid',
  'partial',
  'failed',
  'refunded',
] as const;

export type PaymentStatus = (typeof VALID_PAYMENT_STATUSES)[number];

// Status colors for consistent UI
export const STATUS_COLORS = {
  pending: { bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-400', border: 'border-amber-400/30' },
  payment_pending: { bg: 'bg-orange-500/10', text: 'text-orange-400', dot: 'bg-orange-400', border: 'border-orange-400/30' },
  paid: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400', border: 'border-emerald-400/30' },
  in_progress: { bg: 'bg-blue-500/10', text: 'text-blue-400', dot: 'bg-blue-400', border: 'border-blue-400/30' },
  review: { bg: 'bg-purple-500/10', text: 'text-purple-400', dot: 'bg-purple-400', border: 'border-purple-400/30' },
  revision: { bg: 'bg-pink-500/10', text: 'text-pink-400', dot: 'bg-pink-400', border: 'border-pink-400/30' },
  completed: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400', border: 'border-emerald-400/30' },
  delivered: { bg: 'bg-green-500/10', text: 'text-green-400', dot: 'bg-green-400', border: 'border-green-400/30' },
  cancelled: { bg: 'bg-red-500/10', text: 'text-red-400', dot: 'bg-red-400', border: 'border-red-400/30' },
  refunded: { bg: 'bg-gray-500/10', text: 'text-gray-400', dot: 'bg-gray-400', border: 'border-gray-400/30' },
} as const;

export function getStatusColor(status: string) {
  return STATUS_COLORS[status as keyof typeof STATUS_COLORS] || STATUS_COLORS.pending;
}

// Status label mappings
export const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  payment_pending: 'Payment Pending',
  paid: 'Paid',
  in_progress: 'In Progress',
  review: 'Under Review',
  revision: 'Revision',
  completed: 'Completed',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

export function getStatusLabel(status: string): string {
  return STATUS_LABELS[status] || status;
}

// Allowed status transitions (workflow enforcement)
export const STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ['payment_pending', 'cancelled'],
  payment_pending: ['paid', 'cancelled'],
  paid: ['in_progress', 'cancelled', 'refunded'],
  in_progress: ['review', 'cancelled'],
  review: ['revision', 'completed', 'in_progress'],
  revision: ['in_progress'],
  completed: ['delivered'],
  delivered: [],
  cancelled: [],
  refunded: [],
};

export function canTransitionTo(currentStatus: string, newStatus: string): boolean {
  const allowed = STATUS_TRANSITIONS[currentStatus] || [];
  return allowed.includes(newStatus);
}

// Currency formatting
export function formatCurrency(amount: number, currency: string): string {
  if (currency === 'XAF') {
    return new Intl.NumberFormat('fr-CM', {
      style: 'currency',
      currency: 'XAF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// Business timezone for consistent date handling
export const BUSINESS_TIMEZONE = 'Africa/Douala';

export function getBusinessDate(daysOffset: number = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);

  return date.toLocaleDateString('en-CA', {
    timeZone: BUSINESS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}
