/**
 * Configuration Types
 * Types for database-stored configuration
 */

// Currency types
export type Currency = 'USD' | 'XAF';

// Package configuration (from config_packages table)
export interface Package {
  id: string;
  slug: 'express' | 'classic' | 'signature' | 'legacy';
  name: string;
  description: string;
  price_usd: number;
  price_xaf: number;
  song_length_min: number;
  song_length_max: number;
  includes_discovery_call: boolean;
  revision_count: number;
  includes_instrumental: boolean;
  includes_full_rights: boolean;
  delivery_days_min: number;
  delivery_days_max: number;
  display_order: number;
  is_popular: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Occasion configuration (from config_occasions table)
export interface Occasion {
  id: string;
  slug: string;
  name: string;
  description: string;
  tagline: string;
  icon: string;
  meta_title: string;
  meta_description: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

// Payment method configuration (from config_payment_methods table)
export interface PaymentMethod {
  id: string;
  provider: 'stripe' | 'campay';
  method_type: 'card' | 'mtn_momo' | 'orange_money';
  display_name: string;
  currencies: Currency[];
  countries: string[] | null;
  fee_percentage: number | null;
  fee_fixed: number | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

// Order status configuration (from config_order_statuses table)
export interface OrderStatus {
  id: string;
  slug: OrderStatusSlug;
  name: string;
  description: string;
  next_statuses: OrderStatusSlug[];
  requires_admin: boolean;
  send_email: boolean;
  email_template: string | null;
  color: string;
  icon: string;
  display_order: number;
  created_at: string;
}

export type OrderStatusSlug =
  | 'pending'
  | 'paid'
  | 'discovery'
  | 'writing'
  | 'production'
  | 'review'
  | 'delivered'
  | 'cancelled';

// Capacity configuration (from config_capacity table)
export interface CapacityLimit {
  id: string;
  date: string;
  max_orders: number;
  current_orders: number;
  is_blackout: boolean;
  notes: string | null;
  created_at: string;
}

// Refund policy configuration (from config_refund_policies table)
export interface RefundPolicy {
  id: string;
  status_slug: OrderStatusSlug;
  refund_percentage: number;
  description: string;
  requires_manual_review: boolean;
  created_at: string;
}

// Testimonial configuration (from config_testimonials table)
export interface Testimonial {
  id: string;
  customer_name: string;
  customer_location: string | null;
  occasion: string | null;
  quote: string;
  rating: number;
  image_url: string | null;
  video_url: string | null;
  display_order: number | null;
  is_featured: boolean;
  is_active: boolean;
  created_at: string;
}

// FAQ configuration (from config_faq table)
export interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  display_order: number;
  is_active: boolean;
  locale: string;
  created_at: string;
}

// Sample song configuration (from config_samples table)
export interface Sample {
  id: string;
  title: string;
  occasion_slug: string | null;
  style: string | null;
  description: string | null;
  audio_url: string;
  cover_image_url: string | null;
  duration_seconds: number | null;
  display_order: number;
  is_featured: boolean;
  is_active: boolean;
  created_at: string;
}

// Site settings (from config_settings table)
export interface SiteSetting {
  key: string;
  value: unknown;
  description: string | null;
  updated_at: string;
  updated_by: string | null;
}

// Price display helper
export interface PriceDisplay {
  amount: number;
  currency: Currency;
  formatted: string;
}
