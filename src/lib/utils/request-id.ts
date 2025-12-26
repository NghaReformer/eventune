/**
 * Request ID Tracking
 * Generates and manages unique request IDs for tracing
 *
 * Used for:
 * - Correlating logs across services
 * - Tracing requests through the system
 * - Debugging and error tracking
 */

/**
 * Header name for request ID
 */
export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Generate a unique request ID
 * Format: {timestamp_hex}-{random_hex}
 */
export function generateRequestId(): string {
  const timestamp = Date.now().toString(16);
  const random = Math.random().toString(16).slice(2, 10);
  return `${timestamp}-${random}`;
}

/**
 * Validate a request ID format
 */
export function isValidRequestId(id: string): boolean {
  // Format: hex-hex (timestamp-random)
  return /^[a-f0-9]+-[a-f0-9]+$/i.test(id);
}

/**
 * Extract or generate request ID from headers
 */
export function getOrCreateRequestId(headers: Headers): string {
  const existing = headers.get(REQUEST_ID_HEADER);
  if (existing && isValidRequestId(existing)) {
    return existing;
  }
  return generateRequestId();
}

/**
 * Request context for async local storage
 */
export interface RequestContext {
  requestId: string;
  startTime: number;
  path?: string;
  method?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Create a new request context
 */
export function createRequestContext(
  requestId: string,
  options: Partial<Omit<RequestContext, 'requestId' | 'startTime'>> = {}
): RequestContext {
  return {
    requestId,
    startTime: Date.now(),
    ...options,
  };
}

/**
 * Calculate request duration
 */
export function getRequestDuration(context: RequestContext): number {
  return Date.now() - context.startTime;
}

/**
 * Format request context for logging
 */
export function formatRequestLog(
  context: RequestContext,
  message: string,
  data?: Record<string, unknown>
): Record<string, unknown> {
  return {
    requestId: context.requestId,
    method: context.method,
    path: context.path,
    userId: context.userId,
    durationMs: getRequestDuration(context),
    message,
    ...data,
  };
}

/**
 * Simple logger with request context
 */
export class RequestLogger {
  constructor(private context: RequestContext) {}

  private log(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    data?: Record<string, unknown>
  ) {
    const logData = formatRequestLog(this.context, message, data);

    switch (level) {
      case 'debug':
        console.debug(JSON.stringify(logData));
        break;
      case 'info':
        console.info(JSON.stringify(logData));
        break;
      case 'warn':
        console.warn(JSON.stringify(logData));
        break;
      case 'error':
        console.error(JSON.stringify(logData));
        break;
    }
  }

  debug(message: string, data?: Record<string, unknown>) {
    this.log('debug', message, data);
  }

  info(message: string, data?: Record<string, unknown>) {
    this.log('info', message, data);
  }

  warn(message: string, data?: Record<string, unknown>) {
    this.log('warn', message, data);
  }

  error(message: string, error?: Error | unknown, data?: Record<string, unknown>) {
    const errorData: Record<string, unknown> = { ...data };

    if (error instanceof Error) {
      errorData.errorName = error.name;
      errorData.errorMessage = error.message;
      errorData.errorStack = error.stack;
    } else if (error !== undefined) {
      errorData.error = String(error);
    }

    this.log('error', message, errorData);
  }

  /**
   * Create a child logger with additional metadata
   */
  child(metadata: Record<string, unknown>): RequestLogger {
    return new RequestLogger({
      ...this.context,
      metadata: {
        ...this.context.metadata,
        ...metadata,
      },
    });
  }

  /**
   * Set user ID for context
   */
  setUserId(userId: string): void {
    this.context.userId = userId;
  }

  /**
   * Get the request ID
   */
  getRequestId(): string {
    return this.context.requestId;
  }

  /**
   * Get the full context
   */
  getContext(): RequestContext {
    return { ...this.context };
  }
}

/**
 * Create a logger for a request
 */
export function createRequestLogger(
  headers: Headers,
  options: Partial<Omit<RequestContext, 'requestId' | 'startTime'>> = {}
): RequestLogger {
  const requestId = getOrCreateRequestId(headers);
  const context = createRequestContext(requestId, options);
  return new RequestLogger(context);
}

/**
 * Middleware helper to add request ID to response
 */
export function addRequestIdToResponse(
  response: Response,
  requestId: string
): Response {
  const headers = new Headers(response.headers);
  headers.set(REQUEST_ID_HEADER, requestId);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
