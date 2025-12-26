/**
 * Input Validation & Sanitization
 * Prevents XSS, injection attacks, and ensures data integrity
 */

/**
 * Sanitize string input - removes HTML tags and dangerous characters
 */
export function sanitizeString(input: unknown, maxLength: number = 1000): string {
  if (typeof input !== 'string') return '';

  return input
    // Remove script tags and their content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove all HTML tags
    .replace(/<[^>]+>/g, '')
    // Remove javascript: protocol
    .replace(/javascript:/gi, '')
    // Remove event handlers
    .replace(/on\w+\s*=/gi, '')
    // Trim and limit length
    .trim()
    .substring(0, maxLength);
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

/**
 * Validate phone number by country code
 */
export function isValidPhone(phone: string, countryCode: string): boolean {
  const cleaned = phone.replace(/\D/g, '');

  const patterns: Record<string, RegExp> = {
    '+1': /^[2-9]\d{9}$/, // US/Canada
    '+237': /^[26]\d{8}$/, // Cameroon (mobile starts with 6, landline with 2)
    '+44': /^7\d{9}$/, // UK mobile
    '+33': /^[67]\d{8}$/, // France mobile
  };

  const pattern = patterns[countryCode];
  return pattern ? pattern.test(cleaned) : cleaned.length >= 7 && cleaned.length <= 15;
}

/**
 * Validate password strength
 */
export interface PasswordValidation {
  valid: boolean;
  score: number; // 0-4
  errors: string[];
}

export function validatePassword(password: string): PasswordValidation {
  const errors: string[] = [];
  let score = 0;

  if (password.length < 8) {
    errors.push('Must be at least 8 characters');
  } else {
    score++;
  }

  if (password.length >= 12) score++;

  if (!/[A-Z]/.test(password)) {
    errors.push('Must contain an uppercase letter');
  } else {
    score++;
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Must contain a lowercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Must contain a number');
  } else {
    score++;
  }

  if (/[^A-Za-z0-9]/.test(password)) {
    score++;
  }

  // Check for common passwords
  const commonPasswords = [
    'password',
    '12345678',
    'qwerty123',
    'password123',
    'letmein',
    'welcome',
    'admin123',
    'iloveyou',
  ];

  if (commonPasswords.some((p) => password.toLowerCase().includes(p))) {
    errors.push('Password is too common');
    score = Math.max(0, score - 2);
  }

  return {
    valid: errors.length === 0,
    score: Math.min(4, score),
    errors,
  };
}

/**
 * Validate UUID format
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Sanitize revision notes - allows some formatting but prevents XSS
 */
export function sanitizeRevisionNotes(input: string, maxLength: number = 5000): string {
  if (!input) return '';

  return input
    // Remove script tags
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove HTML tags except basic formatting
    .replace(/<(?!\/?(b|i|u|br|p)\b)[^>]+>/gi, '')
    // Remove javascript: protocol
    .replace(/javascript:/gi, '')
    // Remove event handlers
    .replace(/on\w+\s*=/gi, '')
    .trim()
    .substring(0, maxLength);
}

/**
 * Validate order belongs to user (IDOR protection)
 */
export function validateOrderOwnership(
  order: { customer_id: string | null } | null,
  userId: string
): boolean {
  if (!order || !order.customer_id) return false;
  return order.customer_id === userId;
}

/**
 * Rate limiting helper (in-memory, use Redis for production)
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  identifier: string,
  action: string,
  maxAttempts: number = 10,
  windowMs: number = 60000
): { allowed: boolean; remaining: number; resetIn: number } {
  const key = `${identifier}:${action}`;
  const now = Date.now();
  const record = rateLimitMap.get(key);

  // Clean up old entries periodically
  if (rateLimitMap.size > 10000) {
    for (const [k, v] of rateLimitMap) {
      if (now > v.resetAt) rateLimitMap.delete(k);
    }
  }

  if (!record || now > record.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxAttempts - 1, resetIn: windowMs };
  }

  if (record.count >= maxAttempts) {
    return {
      allowed: false,
      remaining: 0,
      resetIn: record.resetAt - now,
    };
  }

  record.count++;
  return {
    allowed: true,
    remaining: maxAttempts - record.count,
    resetIn: record.resetAt - now,
  };
}
