# Referral Attribution System

This module provides client-side and server-side utilities for tracking and applying referral codes and UTM parameters in the Eventune Studios application.

## Features

- **Referral Code Tracking**: Automatically detects and stores referral codes from URL parameters
- **UTM Parameter Tracking**: Captures UTM campaign parameters for analytics
- **Cookie + LocalStorage Backup**: Dual-layer storage ensures data persistence even if cookies are cleared
- **30-Day Attribution Window**: Referral data expires after 30 days
- **Automatic Application**: Referral codes are automatically applied after user signup
- **Anti-Self-Referral**: Prevents users from referring themselves
- **One Referrer Per User**: Users can only be attributed to one referrer

## Architecture

### Components

1. **Middleware** (`/src/middleware/referral.ts`)
   - Runs on every page request
   - Detects `?ref=CODE` and UTM parameters from URL
   - Stores data in cookies with proper security settings

2. **Client Utilities** (`/src/lib/referral/attribution.ts`)
   - Provides functions to read, store, and apply referral data
   - Manages localStorage backup
   - Handles API communication

3. **API Endpoint** (`/src/pages/api/referrals/apply.ts`)
   - Applies referral code to authenticated user
   - Validates code format and prevents duplicates
   - Calls database function for attribution

4. **Database Functions** (Supabase)
   - `apply_referral_code(code)`: Creates referral attribution record
   - Handles commission calculation automatically

## Usage

### Tracking a Referral

Simply add the `ref` parameter to any URL:

```
https://eventune.com/?ref=EVT-ABC123
https://eventune.com/order/birthday?ref=john-doe-2024
```

The middleware will automatically:
1. Detect the parameter
2. Validate the format (4-20 alphanumeric characters, hyphens, underscores)
3. Store in cookie and localStorage
4. Maintain for 30 days

### Tracking UTM Parameters

Add standard UTM parameters:

```
https://eventune.com/?utm_source=facebook&utm_medium=social&utm_campaign=summer2024&ref=AGENT123
```

Both referral and UTM data are tracked independently.

### Applying Referral After Signup

The referral code is automatically applied in `/src/pages/auth/callback.astro` after successful signup or login:

```typescript
import { applyReferralOnSignup } from '@/lib/referral/attribution';

// Fire and forget - don't block user flow
applyReferralOnSignup().catch(err => {
  console.warn('Referral attribution failed (non-critical):', err);
});
```

### Manual Referral Application

If you need to apply a referral manually:

```typescript
import { applyReferralOnSignup, getReferralCode } from '@/lib/referral/attribution';

// Check if referral exists
const code = getReferralCode();
if (code) {
  const success = await applyReferralOnSignup();
  console.log('Referral applied:', success);
}
```

### Clearing Referral Data

Clear referral data after attribution or when user declines:

```typescript
import { clearReferralData } from '@/lib/referral/attribution';

clearReferralData();
```

## API Reference

### Client-Side Functions

#### `initReferralTracking()`
Initializes referral tracking by syncing cookie data to localStorage. Call this on auth pages.

```typescript
initReferralTracking();
```

#### `getReferralCode(): string | null`
Gets the current referral code from cookie or localStorage.

```typescript
const code = getReferralCode();
if (code) {
  console.log('User has referral:', code);
}
```

#### `getUTMData(): Partial<UTMData> | null`
Gets UTM tracking data.

```typescript
const utm = getUTMData();
if (utm) {
  console.log('UTM Source:', utm.source);
  console.log('UTM Campaign:', utm.campaign);
  console.log('Landing Page:', utm.landing_page);
}
```

#### `applyReferralOnSignup(): Promise<boolean>`
Applies the stored referral code to the authenticated user.

Returns `true` if successful, `false` otherwise.

```typescript
const applied = await applyReferralOnSignup();
```

#### `clearReferralData(): void`
Clears all referral and UTM data from cookies and localStorage.

```typescript
clearReferralData();
```

#### `getAllTrackingData(): { referralCode: string | null, utm: Partial<UTMData> | null }`
Gets all tracking data at once for debugging or analytics.

```typescript
const data = getAllTrackingData();
console.log(data);
// { referralCode: 'EVT-123', utm: { source: 'facebook', campaign: 'summer' } }
```

### Server-Side Functions (Middleware)

#### `getReferralFromRequest(request, cookies): string | null`
Extracts referral code from URL parameter or cookie.

```typescript
import { getReferralFromRequest } from '@/middleware/referral';

const code = getReferralFromRequest(request, cookies);
```

#### `getReferralFromCookie(cookies): string | null`
Extracts referral code from cookie only.

```typescript
import { getReferralFromCookie } from '@/middleware/referral';

const code = getReferralFromCookie(cookies);
```

#### `getTrackingData(request, cookies): { referralCode: string | null, utm: Partial<UTMData> | null }`
Gets all tracking data from request and cookies.

```typescript
import { getTrackingData } from '@/middleware/referral';

const { referralCode, utm } = getTrackingData(request, cookies);
```

## Cookie Configuration

### Referral Cookie (`evt_ref`)
```typescript
{
  name: 'evt_ref',
  value: JSON.stringify({ code: 'EVT-123', timestamp: 1703001234567 }),
  maxAge: 2592000, // 30 days
  path: '/',
  sameSite: 'lax',
  secure: true, // in production
  httpOnly: false // allows JS access for localStorage backup
}
```

### UTM Cookie (`evt_utm`)
```typescript
{
  name: 'evt_utm',
  value: JSON.stringify({
    source: 'facebook',
    medium: 'social',
    campaign: 'summer2024',
    landing_page: '/order/birthday',
    timestamp: 1703001234567
  }),
  maxAge: 2592000, // 30 days
  path: '/',
  sameSite: 'lax',
  secure: true,
  httpOnly: false
}
```

## Validation

### Referral Code Format

Valid referral codes must match:
- Pattern: `/^[a-zA-Z0-9_-]{4,20}$/`
- 4-20 characters
- Alphanumeric, hyphens, and underscores only
- Case-insensitive (stored as lowercase)

**Valid Examples:**
- `EVT-ABC123`
- `john_doe`
- `summer-promo-24`
- `AGENT007`

**Invalid Examples:**
- `ab` (too short)
- `this-is-way-too-long-for-a-code` (too long)
- `code@123` (invalid character)
- `code with spaces` (spaces not allowed)

## Security Considerations

1. **No Sensitive Data**: Referral codes are public identifiers, not secrets
2. **HttpOnly = false**: Intentionally allows JavaScript access for localStorage backup
3. **SameSite = lax**: Prevents CSRF while allowing referral links from external sites
4. **Secure in Production**: Cookies are secure (HTTPS-only) in production
5. **30-Day Expiry**: Automatic cleanup prevents indefinite data retention
6. **One Referrer Per User**: Database constraint prevents attribution manipulation

## Database Schema

The referral system uses these tables:

- `referral_programs`: Program configurations
- `referral_profiles`: Agent profiles with referral codes
- `referrals`: Attribution records (referee → referrer mapping)
- `commissions`: Commission earnings per order

See `/supabase/migrations/20251227_create_referral_system.sql` for full schema.

## Testing

### Test Referral Flow

1. Visit URL with referral: `http://localhost:4321/?ref=TEST123`
2. Check cookie in DevTools: Look for `evt_ref` cookie
3. Check localStorage: Look for `evt_referral_backup` key
4. Sign up for account
5. Check console for "Referral code applied successfully"
6. Verify in database:
   ```sql
   SELECT * FROM referrals WHERE referee_id = 'user-id';
   ```

### Test UTM Tracking

1. Visit URL: `http://localhost:4321/?utm_source=test&utm_campaign=dev&ref=TEST123`
2. Check cookie: `evt_utm` should contain all parameters
3. Check console logs for tracking confirmation

## Troubleshooting

### Referral not applied after signup

1. Check browser console for errors
2. Verify `evt_ref` cookie exists and is not expired
3. Check if user already has a referrer:
   ```sql
   SELECT * FROM referrals WHERE referee_id = 'user-id';
   ```
4. Verify referral code exists in database:
   ```sql
   SELECT * FROM referral_profiles WHERE referral_code = 'code';
   ```

### Cookie not persisting

1. Check if cookies are enabled in browser
2. Verify domain/path settings match your site
3. Check if browser is in incognito mode (cookies may be restricted)
4. Check localStorage as backup

### Self-referral rejected

This is intentional. Users cannot refer themselves. The database function `apply_referral_code` prevents this.

## Future Enhancements

- [ ] Admin dashboard to view referral attribution analytics
- [ ] Support for custom attribution windows per program
- [ ] A/B testing support for different referral codes
- [ ] Integration with analytics platforms (Google Analytics, Mixpanel)
- [ ] Email notification when referral signs up
- [ ] QR code generation for referral links
