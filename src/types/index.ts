/**
 * Types Index
 * Central export for all type definitions
 */

// Config types
export * from './config.types';

// API types
export * from './api.types';

// Re-export commonly used types for convenience
export type {
  Package,
  Occasion,
  PaymentMethod,
  OrderStatus,
  OrderStatusSlug,
  Testimonial,
  FAQ,
  Sample,
  Currency,
  PriceDisplay,
} from './config.types';

export type {
  CreateOrderRequest,
  CreateOrderResponse,
  QuestionnaireData,
  OrderSummary,
  PaymentStatus,
  PaymentInitRequest,
  PaymentInitResponse,
  ApiError,
  ApiResponse,
} from './api.types';
