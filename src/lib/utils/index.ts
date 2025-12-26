/**
 * Utility Functions Index
 */

// Phone number utilities
export {
  normalizePhoneNumber,
  isValidPhoneNumber,
  toE164,
  formatPhoneDisplay,
  isMtnCameroon,
  isOrangeCameroon,
  getCarrier,
  phoneSchema,
  cameroonPhoneSchema,
  type PhoneNumber,
  type PhoneValidationResult,
} from './phone';

// Request ID tracking
export {
  REQUEST_ID_HEADER,
  generateRequestId,
  isValidRequestId,
  getOrCreateRequestId,
  createRequestContext,
  getRequestDuration,
  formatRequestLog,
  RequestLogger,
  createRequestLogger,
  addRequestIdToResponse,
  type RequestContext,
} from './request-id';
