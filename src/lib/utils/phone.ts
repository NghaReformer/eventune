/**
 * Phone Number Utilities
 * E.164 format normalization and validation
 *
 * Supports:
 * - Cameroon (+237) - MTN, Orange
 * - International numbers
 */

import { z } from 'zod';

/**
 * Phone number type
 */
export interface PhoneNumber {
  /** E.164 format (e.g., +237612345678) */
  e164: string;
  /** National format without country code */
  national: string;
  /** Country code without + */
  countryCode: string;
  /** ISO 3166-1 alpha-2 country code */
  countryIso: string;
  /** Mobile carrier if detectable */
  carrier?: 'mtn' | 'orange' | 'unknown';
  /** Whether the number is valid */
  isValid: boolean;
}

/**
 * Phone number validation result
 */
export interface PhoneValidationResult {
  valid: boolean;
  phone?: PhoneNumber;
  error?: string;
}

/**
 * Country configuration for phone validation
 */
interface CountryConfig {
  code: string;
  iso: string;
  nationalLength: number[];
  prefixes: { pattern: RegExp; carrier?: 'mtn' | 'orange' }[];
}

/**
 * Supported country configurations
 */
const COUNTRY_CONFIGS: Record<string, CountryConfig> = {
  CM: {
    code: '237',
    iso: 'CM',
    nationalLength: [9], // 9 digits for Cameroon
    prefixes: [
      // MTN Cameroon prefixes
      { pattern: /^6[578]/, carrier: 'mtn' },
      { pattern: /^67/, carrier: 'mtn' },
      // Orange Cameroon prefixes
      { pattern: /^69/, carrier: 'orange' },
      { pattern: /^655/, carrier: 'orange' },
      { pattern: /^656/, carrier: 'orange' },
      // Generic mobile
      { pattern: /^6/, carrier: 'unknown' },
    ],
  },
  US: {
    code: '1',
    iso: 'US',
    nationalLength: [10],
    prefixes: [{ pattern: /^\d{3}/ }],
  },
};

/**
 * Remove all non-digit characters except leading +
 */
function stripNonDigits(phone: string): string {
  const hasPlus = phone.startsWith('+');
  const digits = phone.replace(/\D/g, '');
  return hasPlus ? `+${digits}` : digits;
}

/**
 * Detect country from phone number
 */
function detectCountry(digits: string): CountryConfig | null {
  // Check for Cameroon
  if (digits.startsWith('237')) {
    return COUNTRY_CONFIGS.CM;
  }
  // Check for US/Canada
  if (digits.startsWith('1') && digits.length === 11) {
    return COUNTRY_CONFIGS.US;
  }
  return null;
}

/**
 * Detect carrier from phone number (Cameroon only)
 */
function detectCarrier(
  national: string,
  config: CountryConfig
): 'mtn' | 'orange' | 'unknown' | undefined {
  for (const prefix of config.prefixes) {
    if (prefix.pattern.test(national)) {
      return prefix.carrier;
    }
  }
  return undefined;
}

/**
 * Normalize a phone number to E.164 format
 * @param input - Raw phone number input
 * @param defaultCountry - Default country if not detected (ISO 3166-1 alpha-2)
 */
export function normalizePhoneNumber(
  input: string,
  defaultCountry: string = 'CM'
): PhoneValidationResult {
  if (!input || typeof input !== 'string') {
    return { valid: false, error: 'Phone number is required' };
  }

  // Clean the input
  let cleaned = input.trim();
  cleaned = stripNonDigits(cleaned);

  // Remove leading + for processing
  const hadPlus = cleaned.startsWith('+');
  if (hadPlus) {
    cleaned = cleaned.substring(1);
  }

  // Handle Cameroon-specific cases
  const defaultConfig = COUNTRY_CONFIGS[defaultCountry];
  if (!defaultConfig) {
    return { valid: false, error: `Unsupported country: ${defaultCountry}` };
  }

  let countryCode = defaultConfig.code;
  let national = cleaned;
  let config = defaultConfig;

  // Detect if number already has country code
  if (hadPlus || cleaned.startsWith(countryCode)) {
    const detected = detectCountry(cleaned);
    if (detected) {
      config = detected;
      countryCode = config.code;
      national = cleaned.substring(countryCode.length);
    }
  } else if (cleaned.startsWith('0')) {
    // National format with leading 0
    national = cleaned.substring(1);
  } else if (cleaned.startsWith('00')) {
    // International format with 00
    const withoutPrefix = cleaned.substring(2);
    const detected = detectCountry(withoutPrefix);
    if (detected) {
      config = detected;
      countryCode = config.code;
      national = withoutPrefix.substring(countryCode.length);
    }
  }

  // Validate national number length
  if (!config.nationalLength.includes(national.length)) {
    return {
      valid: false,
      error: `Invalid phone number length. Expected ${config.nationalLength.join(' or ')} digits, got ${national.length}`,
    };
  }

  // Check if it's a valid mobile prefix
  const hasValidPrefix = config.prefixes.some((p) => p.pattern.test(national));
  if (!hasValidPrefix && config.iso === 'CM') {
    return {
      valid: false,
      error: 'Invalid mobile phone prefix for Cameroon',
    };
  }

  // Build E.164 format
  const e164 = `+${countryCode}${national}`;

  // Detect carrier for Cameroon
  const carrier = config.iso === 'CM' ? detectCarrier(national, config) : undefined;

  return {
    valid: true,
    phone: {
      e164,
      national,
      countryCode,
      countryIso: config.iso,
      carrier,
      isValid: true,
    },
  };
}

/**
 * Validate a phone number without normalizing
 */
export function isValidPhoneNumber(
  input: string,
  defaultCountry: string = 'CM'
): boolean {
  const result = normalizePhoneNumber(input, defaultCountry);
  return result.valid;
}

/**
 * Get E.164 formatted number or null if invalid
 */
export function toE164(input: string, defaultCountry: string = 'CM'): string | null {
  const result = normalizePhoneNumber(input, defaultCountry);
  return result.valid ? result.phone!.e164 : null;
}

/**
 * Format phone for display (national format with spaces)
 */
export function formatPhoneDisplay(
  input: string,
  defaultCountry: string = 'CM'
): string | null {
  const result = normalizePhoneNumber(input, defaultCountry);
  if (!result.valid || !result.phone) return null;

  const { national, countryIso } = result.phone;

  if (countryIso === 'CM' && national.length === 9) {
    // Format: 6XX XXX XXX
    return `${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`;
  }

  if (countryIso === 'US' && national.length === 10) {
    // Format: (XXX) XXX-XXXX
    return `(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`;
  }

  return national;
}

/**
 * Zod schema for phone number validation
 */
export const phoneSchema = z.string().transform((val, ctx) => {
  const result = normalizePhoneNumber(val);
  if (!result.valid) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: result.error ?? 'Invalid phone number',
    });
    return z.NEVER;
  }
  return result.phone!.e164;
});

/**
 * Zod schema for Cameroon phone number
 */
export const cameroonPhoneSchema = z.string().transform((val, ctx) => {
  const result = normalizePhoneNumber(val, 'CM');
  if (!result.valid) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: result.error ?? 'Invalid Cameroon phone number',
    });
    return z.NEVER;
  }
  if (result.phone!.countryIso !== 'CM') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Phone number must be a Cameroon number',
    });
    return z.NEVER;
  }
  return result.phone!.e164;
});

/**
 * Check if phone number is MTN Cameroon
 */
export function isMtnCameroon(input: string): boolean {
  const result = normalizePhoneNumber(input, 'CM');
  return result.valid && result.phone?.carrier === 'mtn';
}

/**
 * Check if phone number is Orange Cameroon
 */
export function isOrangeCameroon(input: string): boolean {
  const result = normalizePhoneNumber(input, 'CM');
  return result.valid && result.phone?.carrier === 'orange';
}

/**
 * Get carrier for a phone number
 */
export function getCarrier(input: string): 'mtn' | 'orange' | 'unknown' | null {
  const result = normalizePhoneNumber(input, 'CM');
  return result.valid ? (result.phone?.carrier ?? null) : null;
}
