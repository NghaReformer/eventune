/**
 * Referral Attribution Middleware
 * Detects and stores referral codes and UTM parameters from URLs
 */

import type { AstroCookies } from 'astro';
import type { MiddlewareHandler } from 'astro';

const REFERRAL_COOKIE_NAME = 'evt_ref';
const UTM_COOKIE_NAME = 'evt_utm';
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

interface ReferralData {
  code: string;
  timestamp: number;
}

interface UTMData {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
  landing_page: string;
  timestamp: number;
}

/**
 * Set referral cookie with proper configuration
 */
function setReferralCookie(cookies: AstroCookies, code: string, isProd: boolean): void {
  const data: ReferralData = {
    code,
    timestamp: Date.now(),
  };

  cookies.set(REFERRAL_COOKIE_NAME, JSON.stringify(data), {
    maxAge: COOKIE_MAX_AGE,
    path: '/',
    sameSite: 'lax',
    secure: isProd,
    httpOnly: false, // Allow JS access for localStorage backup
  });
}

/**
 * Set UTM tracking cookie with proper configuration
 */
function setUTMCookie(
  cookies: AstroCookies,
  utmData: Omit<UTMData, 'timestamp'>,
  isProd: boolean
): void {
  const data: UTMData = {
    ...utmData,
    timestamp: Date.now(),
  };

  cookies.set(UTM_COOKIE_NAME, JSON.stringify(data), {
    maxAge: COOKIE_MAX_AGE,
    path: '/',
    sameSite: 'lax',
    secure: isProd,
    httpOnly: false, // Allow JS access for analytics
  });
}

/**
 * Extract referral code from request (URL param or cookie)
 */
export function getReferralFromRequest(request: Request, cookies: AstroCookies): string | null {
  const url = new URL(request.url);

  // Check URL parameter first (highest priority)
  const refParam = url.searchParams.get('ref');
  if (refParam && isValidReferralCode(refParam)) {
    return refParam;
  }

  // Fallback to cookie
  return getReferralFromCookie(cookies);
}

/**
 * Extract referral code from cookie only
 */
export function getReferralFromCookie(cookies: AstroCookies): string | null {
  try {
    const cookieValue = cookies.get(REFERRAL_COOKIE_NAME)?.value;
    if (!cookieValue) return null;

    const data: ReferralData = JSON.parse(cookieValue);

    // Check if cookie is expired (30 days)
    const age = Date.now() - data.timestamp;
    if (age > COOKIE_MAX_AGE * 1000) {
      return null;
    }

    return data.code || null;
  } catch (error) {
    console.error('[Referral Middleware] Error parsing referral cookie:', error);
    return null;
  }
}

/**
 * Get all tracking data (referral + UTM)
 */
export function getTrackingData(request: Request, cookies: AstroCookies): {
  referralCode: string | null;
  utm: Partial<UTMData> | null;
} {
  const url = new URL(request.url);

  // Get referral code
  const referralCode = getReferralFromRequest(request, cookies);

  // Get UTM data from cookie
  let utm: Partial<UTMData> | null = null;
  try {
    const utmCookie = cookies.get(UTM_COOKIE_NAME)?.value;
    if (utmCookie) {
      const data: UTMData = JSON.parse(utmCookie);

      // Check if cookie is expired
      const age = Date.now() - data.timestamp;
      if (age <= COOKIE_MAX_AGE * 1000) {
        utm = data;
      }
    }
  } catch (error) {
    console.error('[Referral Middleware] Error parsing UTM cookie:', error);
  }

  return { referralCode, utm };
}

/**
 * Validate referral code format
 * Expected format: alphanumeric, 6-20 characters (can include hyphens/underscores)
 */
function isValidReferralCode(code: string): boolean {
  // Allow alphanumeric, hyphens, and underscores, 4-20 characters
  const pattern = /^[a-zA-Z0-9_-]{4,20}$/;
  return pattern.test(code);
}

/**
 * Referral Middleware
 * Detects and stores referral codes and UTM parameters
 */
export const referralMiddleware: MiddlewareHandler = async ({ request, cookies }, next) => {
  const url = new URL(request.url);
  const isProd = import.meta.env.PROD;

  // Skip API routes and static assets
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/_') ||
    url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf)$/)
  ) {
    return next();
  }

  // Check for referral code in URL
  const refParam = url.searchParams.get('ref');
  if (refParam && isValidReferralCode(refParam)) {
    // Store in cookie (overwrite existing)
    setReferralCookie(cookies, refParam, isProd);
    console.log(`[Referral Middleware] Stored referral code: ${refParam}`);
  }

  // Check for UTM parameters
  const utmSource = url.searchParams.get('utm_source');
  const utmMedium = url.searchParams.get('utm_medium');
  const utmCampaign = url.searchParams.get('utm_campaign');
  const utmContent = url.searchParams.get('utm_content');
  const utmTerm = url.searchParams.get('utm_term');

  // Only store UTM if at least one parameter exists
  if (utmSource || utmMedium || utmCampaign || utmContent || utmTerm) {
    const utmData: Omit<UTMData, 'timestamp'> = {
      landing_page: url.pathname,
    };

    if (utmSource) utmData.source = utmSource;
    if (utmMedium) utmData.medium = utmMedium;
    if (utmCampaign) utmData.campaign = utmCampaign;
    if (utmContent) utmData.content = utmContent;
    if (utmTerm) utmData.term = utmTerm;

    setUTMCookie(cookies, utmData, isProd);
    console.log(`[Referral Middleware] Stored UTM data:`, utmData);
  }

  return next();
};
