/**
 * Client-Side Referral Attribution Utilities
 * Handles referral code storage, retrieval, and application after signup
 */

const REFERRAL_COOKIE_NAME = 'evt_ref';
const UTM_COOKIE_NAME = 'evt_utm';
const REFERRAL_STORAGE_KEY = 'evt_referral_backup';
const UTM_STORAGE_KEY = 'evt_utm_backup';

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
 * Get cookie value by name (client-side)
 */
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;

  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

/**
 * Store referral code in localStorage as backup
 * Called automatically by middleware, but can be called manually if needed
 */
export function storeReferralBackup(code: string): void {
  if (typeof localStorage === 'undefined') return;

  try {
    const data: ReferralData = {
      code,
      timestamp: Date.now(),
    };
    localStorage.setItem(REFERRAL_STORAGE_KEY, JSON.stringify(data));
    console.log('[Referral Attribution] Stored referral backup:', code);
  } catch (error) {
    console.error('[Referral Attribution] Failed to store referral backup:', error);
  }
}

/**
 * Store UTM data in localStorage as backup
 */
export function storeUTMBackup(utmData: Omit<UTMData, 'timestamp'>): void {
  if (typeof localStorage === 'undefined') return;

  try {
    const data: UTMData = {
      ...utmData,
      timestamp: Date.now(),
    };
    localStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(data));
    console.log('[Referral Attribution] Stored UTM backup:', utmData);
  } catch (error) {
    console.error('[Referral Attribution] Failed to store UTM backup:', error);
  }
}

/**
 * Get referral code from cookie or localStorage
 * Prioritizes cookie over localStorage
 */
export function getReferralCode(): string | null {
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

  // Try cookie first
  try {
    const cookieValue = getCookie(REFERRAL_COOKIE_NAME);
    if (cookieValue) {
      const data: ReferralData = JSON.parse(cookieValue);
      const age = Date.now() - data.timestamp;

      if (age <= THIRTY_DAYS_MS && data.code) {
        return data.code;
      }
    }
  } catch (error) {
    console.error('[Referral Attribution] Error reading referral cookie:', error);
  }

  // Fallback to localStorage
  if (typeof localStorage !== 'undefined') {
    try {
      const stored = localStorage.getItem(REFERRAL_STORAGE_KEY);
      if (stored) {
        const data: ReferralData = JSON.parse(stored);
        const age = Date.now() - data.timestamp;

        if (age <= THIRTY_DAYS_MS && data.code) {
          return data.code;
        } else {
          // Clean up expired data
          localStorage.removeItem(REFERRAL_STORAGE_KEY);
        }
      }
    } catch (error) {
      console.error('[Referral Attribution] Error reading referral from localStorage:', error);
    }
  }

  return null;
}

/**
 * Get UTM data from cookie or localStorage
 */
export function getUTMData(): Partial<UTMData> | null {
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

  // Try cookie first
  try {
    const cookieValue = getCookie(UTM_COOKIE_NAME);
    if (cookieValue) {
      const data: UTMData = JSON.parse(cookieValue);
      const age = Date.now() - data.timestamp;

      if (age <= THIRTY_DAYS_MS) {
        return data;
      }
    }
  } catch (error) {
    console.error('[Referral Attribution] Error reading UTM cookie:', error);
  }

  // Fallback to localStorage
  if (typeof localStorage !== 'undefined') {
    try {
      const stored = localStorage.getItem(UTM_STORAGE_KEY);
      if (stored) {
        const data: UTMData = JSON.parse(stored);
        const age = Date.now() - data.timestamp;

        if (age <= THIRTY_DAYS_MS) {
          return data;
        } else {
          // Clean up expired data
          localStorage.removeItem(UTM_STORAGE_KEY);
        }
      }
    } catch (error) {
      console.error('[Referral Attribution] Error reading UTM from localStorage:', error);
    }
  }

  return null;
}

/**
 * Apply referral code to user after signup
 * Returns true if successful, false otherwise
 */
export async function applyReferralOnSignup(): Promise<boolean> {
  const referralCode = getReferralCode();

  if (!referralCode) {
    console.log('[Referral Attribution] No referral code to apply');
    return false;
  }

  try {
    console.log('[Referral Attribution] Applying referral code:', referralCode);

    const response = await fetch('/api/referrals/apply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        referral_code: referralCode,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[Referral Attribution] Failed to apply referral:', data.error);
      return false;
    }

    if (data.success) {
      console.log('[Referral Attribution] Referral code applied successfully');
      // Clear referral data after successful attribution
      clearReferralData();
      return true;
    } else {
      console.warn('[Referral Attribution] Referral not applied:', data.message);
      return false;
    }
  } catch (error) {
    console.error('[Referral Attribution] Error applying referral:', error);
    return false;
  }
}

/**
 * Clear referral and UTM data from cookies and localStorage
 * Call this after successful attribution or when user explicitly declines
 */
export function clearReferralData(): void {
  // Clear cookies (set to expire immediately)
  if (typeof document !== 'undefined') {
    document.cookie = `${REFERRAL_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    document.cookie = `${UTM_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    console.log('[Referral Attribution] Cleared referral cookies');
  }

  // Clear localStorage
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(REFERRAL_STORAGE_KEY);
    localStorage.removeItem(UTM_STORAGE_KEY);
    console.log('[Referral Attribution] Cleared referral localStorage');
  }
}

/**
 * Initialize referral tracking on page load
 * Syncs cookie data to localStorage as backup
 */
export function initReferralTracking(): void {
  if (typeof window === 'undefined') return;

  // Backup cookie data to localStorage
  try {
    const refCookie = getCookie(REFERRAL_COOKIE_NAME);
    if (refCookie) {
      const data: ReferralData = JSON.parse(refCookie);
      if (data.code) {
        storeReferralBackup(data.code);
      }
    }

    const utmCookie = getCookie(UTM_COOKIE_NAME);
    if (utmCookie) {
      const data: UTMData = JSON.parse(utmCookie);
      storeUTMBackup(data);
    }
  } catch (error) {
    console.error('[Referral Attribution] Error initializing referral tracking:', error);
  }
}

/**
 * Get all tracking data (referral + UTM)
 * Useful for analytics and debugging
 */
export function getAllTrackingData(): {
  referralCode: string | null;
  utm: Partial<UTMData> | null;
} {
  return {
    referralCode: getReferralCode(),
    utm: getUTMData(),
  };
}
