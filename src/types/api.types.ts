/**
 * API Types
 * Request and response types for API endpoints
 */

import type { Currency, OrderStatusSlug } from './config.types';

// ============================================
// Order Types
// ============================================

export interface CreateOrderRequest {
  package_slug: string;
  occasion_slug: string;
  currency: Currency;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  questionnaire_data: QuestionnaireData;
  source?: 'website' | 'referral' | 'social';
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
}

export interface CreateOrderResponse {
  success: boolean;
  order_id?: string;
  order_number?: string;
  error?: string;
}

export interface QuestionnaireData {
  recipient_name: string;
  recipient_relationship: string;
  key_memories: string[];
  emotions: string[];
  must_include_phrases?: string;
  music_style_preferences: string[];
  things_to_avoid?: string;
  additional_details?: string;
}

export interface OrderSummary {
  id: string;
  order_number: string;
  status: OrderStatusSlug;
  package_slug: string;
  occasion_slug: string;
  currency: Currency;
  amount_expected: number;
  amount_paid: number | null;
  payment_status: PaymentStatus;
  song_title: string | null;
  delivery_url: string | null;
  created_at: string;
  due_date: string | null;
  delivered_at: string | null;
}

// ============================================
// Payment Types
// ============================================

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export interface PaymentInitRequest {
  order_id: string;
  payment_method: string;
  phone_number?: string; // For mobile money
  return_url?: string;
}

export interface PaymentInitResponse {
  success: boolean;
  redirect_url?: string;
  requires_action?: boolean;
  action_type?: 'redirect' | 'ussd_prompt' | 'otp';
  reference?: string;
  error?: string;
}

export interface PaymentVerifyRequest {
  reference: string;
  provider: 'stripe' | 'campay';
}

export interface PaymentVerifyResponse {
  success: boolean;
  status: 'pending' | 'successful' | 'failed';
  amount?: number;
  paid_at?: string;
  error?: string;
}

// ============================================
// Auth Types
// ============================================

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  user?: {
    id: string;
    email: string;
    full_name: string | null;
  };
  error?: string;
}

export interface SignupRequest {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  marketing_consent?: boolean;
}

export interface SignupResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetResponse {
  success: boolean;
  message?: string;
  error?: string;
}

// ============================================
// Admin Types
// ============================================

export interface UpdateOrderStatusRequest {
  order_id: string;
  new_status: OrderStatusSlug;
  note?: string;
}

export interface UpdateOrderStatusResponse {
  success: boolean;
  error?: string;
}

export interface RefundRequest {
  order_id: string;
  amount: number;
  reason: string;
}

export interface RefundResponse {
  success: boolean;
  refund_reference?: string;
  error?: string;
}

export interface AuditLogEntry {
  id: string;
  admin_id: string;
  admin_email: string;
  action: string;
  target_type: string;
  target_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string;
  user_agent: string;
  created_at: string;
}

// ============================================
// Contact Types
// ============================================

export interface ContactFormRequest {
  name: string;
  email: string;
  subject: string;
  message: string;
  occasion?: string;
}

export interface ContactFormResponse {
  success: boolean;
  message?: string;
  error?: string;
}

// ============================================
// API Error Types
// ============================================

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}
