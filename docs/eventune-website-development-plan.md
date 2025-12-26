# EVENTUNE STUDIOS
## Comprehensive Website Development Plan (v4)
### Production-Ready: Security Hardened + Scalable + Compliant

---

# EXECUTIVE SUMMARY

This document provides a **production-ready** roadmap for building a secure, scalable website for your personalized music business. All critical gaps from the v3 analysis have been addressed.

**Key Updates in v4:**
- ✅ Security hardening (webhook verification, rate limiting, encryption)
- ✅ Operational resilience (monitoring, backups, error tracking)
- ✅ Legal compliance (privacy policy, terms, cookie consent)
- ✅ Payment security (amount verification, idempotency, refunds)
- ✅ Scalability architecture (caching, indexing, file storage)
- ✅ Expansion readiness (i18n foundation, payment abstraction)
- ✅ Missing features (transactional emails, notifications, admin tools)

**Tech Stack:**
- **Frontend**: Astro + Tailwind CSS
- **Backend**: Supabase Pro ($25/month)
- **Hosting**: Netlify + Cloudflare (DDoS protection)
- **Payments**: Stripe (USD) + CamPay (XAF) — abstracted
- **Files**: Cloudflare R2 (audio storage)
- **Email**: Resend (transactional)
- **Monitoring**: Sentry + UptimeRobot

**Timeline**: 5 weeks (added 1 week for security/operations)
**Monthly Cost**: ~$26-30/month (realistic production budget)

---

# SECTION 1: UPDATED TECH STACK

## Full Stack Overview (Production-Ready)

```
┌─────────────────────────────────────────────────────────────┐
│                 EVENTUNE WEBSITE (v4)                      │
├─────────────────────────────────────────────────────────────┤
│  FRONTEND                                                   │
│  ├── Astro (Static Site Generator)                          │
│  ├── Tailwind CSS (Styling)                                 │
│  ├── TypeScript (Type Safety)                               │
│  └── i18n Ready (English + French foundation)               │
├─────────────────────────────────────────────────────────────┤
│  BACKEND                                                    │
│  └── Supabase Pro ($25/month)                               │
│      ├── PostgreSQL Database (8 GB)                         │
│      ├── Daily Automatic Backups                            │
│      ├── No Pausing (always available)                      │
│      ├── Authentication + RLS                               │
│      └── Edge Functions (for sensitive operations)          │
├─────────────────────────────────────────────────────────────┤
│  CDN & SECURITY                                             │
│  ├── Cloudflare (Free)                                      │
│  │   ├── DDoS Protection                                    │
│  │   ├── WAF (Basic)                                        │
│  │   ├── SSL/TLS                                            │
│  │   └── Edge Caching                                       │
│  └── Security Headers (CSP, HSTS, etc.)                     │
├─────────────────────────────────────────────────────────────┤
│  FILE STORAGE                                               │
│  └── Cloudflare R2 (Audio Files)                            │
│      ├── 10 GB Free                                         │
│      ├── S3-Compatible API                                  │
│      └── Global Edge Delivery                               │
├─────────────────────────────────────────────────────────────┤
│  PAYMENTS (Abstracted Layer)                                │
│  ├── PaymentProvider Interface                              │
│  ├── StripeProvider (International - USD)                   │
│  ├── CamPayProvider (Cameroon - XAF)                        │
│  └── [Future: PaystackProvider for Nigeria]                 │
├─────────────────────────────────────────────────────────────┤
│  COMMUNICATIONS                                             │
│  ├── Resend (Transactional Email)                           │
│  ├── Twilio (SMS - Optional)                                │
│  └── WhatsApp Business API (Future)                         │
├─────────────────────────────────────────────────────────────┤
│  MONITORING & OBSERVABILITY                                 │
│  ├── Sentry (Error Tracking)                                │
│  ├── UptimeRobot (Uptime Monitoring)                        │
│  ├── Netlify Analytics (Traffic)                            │
│  └── Custom Dashboard (Business Metrics)                    │
├─────────────────────────────────────────────────────────────┤
│  OTHER INTEGRATIONS                                         │
│  ├── Calendly (Booking)                                     │
│  ├── Tally.so (Questionnaire)                               │
│  ├── Mailchimp (Marketing Email)                            │
│  └── Google Analytics 4                                     │
└─────────────────────────────────────────────────────────────┘
```

---

# SECTION 2: REALISTIC COST STRUCTURE

## Monthly Production Costs

| Component | Provider | Free Tier | Recommended | Notes |
|-----------|----------|-----------|-------------|-------|
| Backend | Supabase | ~~$0~~ | **$25/mo** | Pro required for no-pause + backups |
| Hosting | Netlify | $0 | $0 | Free tier sufficient |
| CDN/Security | Cloudflare | $0 | $0 | Free tier includes DDoS |
| File Storage | Cloudflare R2 | $0 | $0 | 10GB free |
| Email | Resend | $0 | $0 | 3,000 emails/mo free |
| Error Tracking | Sentry | $0 | $0 | 5,000 events/mo free |
| Uptime Monitor | UptimeRobot | $0 | $0 | 50 monitors free |
| Domain | Namecheap | — | ~$15/yr | Required |
| **TOTAL** | | | **~$26.25/mo** | |

## Transaction Fees (Per Sale)

| Provider | Fee | Example ($299 order) |
|----------|-----|----------------------|
| Stripe | 2.9% + $0.30 | $8.97 |
| CamPay | 2% flat | 3,000 XAF (~$5) |

---

# SECTION 3: SECURITY ARCHITECTURE

## 3.1 Authentication Security

### Rate Limiting Implementation

```typescript
// src/lib/security/rate-limiter.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Initialize Redis (Upstash free tier: 10,000 requests/day)
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
});

// Different limits for different actions
export const rateLimiters = {
  // Login: 5 attempts per minute per IP
  login: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "60 s"),
    prefix: "ratelimit:login",
  }),
  
  // Signup: 3 attempts per hour per IP
  signup: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, "3600 s"),
    prefix: "ratelimit:signup",
  }),
  
  // Password reset: 3 attempts per hour per email
  passwordReset: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, "3600 s"),
    prefix: "ratelimit:reset",
  }),
  
  // Payment initiation: 10 per hour per user
  payment: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "3600 s"),
    prefix: "ratelimit:payment",
  }),
};

// Usage in API route
export async function checkRateLimit(
  limiter: Ratelimit,
  identifier: string
): Promise<{ success: boolean; remaining: number }> {
  const result = await limiter.limit(identifier);
  return {
    success: result.success,
    remaining: result.remaining,
  };
}
```

### Session Management

```typescript
// src/lib/auth/session-config.ts

// Supabase Auth configuration
export const authConfig = {
  // Short-lived access tokens (1 hour instead of default 1 week)
  accessTokenLifetime: 3600, // 1 hour in seconds
  
  // Refresh tokens last 7 days
  refreshTokenLifetime: 604800,
  
  // Require re-authentication for sensitive actions
  sensitiveActionTimeout: 300, // 5 minutes
};

// Check if user needs to re-authenticate
export function requiresReauth(lastAuthTime: Date): boolean {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  return lastAuthTime < fiveMinutesAgo;
}
```

### Admin Security

```sql
-- Enhanced admin security schema
CREATE TYPE admin_role AS ENUM (
  'super_admin',    -- Full access
  'order_manager',  -- Can manage orders
  'support'         -- Read-only + customer communication
);

-- Add admin fields to profiles
ALTER TABLE profiles ADD COLUMN admin_role admin_role;
ALTER TABLE profiles ADD COLUMN admin_2fa_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN admin_2fa_secret TEXT;
ALTER TABLE profiles ADD COLUMN last_admin_login TIMESTAMP;

-- Admin audit log (REQUIRED)
CREATE TABLE admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES auth.users NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT, -- 'order', 'customer', 'settings', 'refund'
  target_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for querying audit logs
CREATE INDEX idx_audit_admin ON admin_audit_log(admin_id);
CREATE INDEX idx_audit_target ON admin_audit_log(target_type, target_id);
CREATE INDEX idx_audit_date ON admin_audit_log(created_at DESC);

-- Function to log admin actions
CREATE OR REPLACE FUNCTION log_admin_action(
  p_admin_id UUID,
  p_action TEXT,
  p_target_type TEXT,
  p_target_id UUID,
  p_old_values JSONB,
  p_new_values JSONB,
  p_ip_address INET,
  p_user_agent TEXT
) RETURNS UUID AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO admin_audit_log (
    admin_id, action, target_type, target_id,
    old_values, new_values, ip_address, user_agent
  ) VALUES (
    p_admin_id, p_action, p_target_type, p_target_id,
    p_old_values, p_new_values, p_ip_address, p_user_agent
  ) RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 3.2 Payment Security (CRITICAL)

### Secure Webhook Handler with Verification

```typescript
// netlify/functions/campay-webhook.ts
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

interface CamPayWebhookPayload {
  status: 'SUCCESSFUL' | 'FAILED' | 'PENDING';
  reference: string;
  external_reference: string;
  amount: number;
  currency: string;
  operator: string;
  code: string;
  operator_reference: string;
}

export async function handler(event: any) {
  const startTime = Date.now();
  
  try {
    // ===== STEP 1: Verify Request Origin =====
    
    // Check for webhook signature (if CamPay provides one)
    const signature = event.headers['x-campay-signature'];
    const webhookSecret = process.env.CAMPAY_WEBHOOK_SECRET;
    
    if (webhookSecret && signature) {
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(event.body)
        .digest('hex');
      
      if (signature !== expectedSignature) {
        console.error('Invalid webhook signature');
        return { statusCode: 401, body: 'Invalid signature' };
      }
    }
    
    // Parse payload
    const payload: CamPayWebhookPayload = JSON.parse(event.body);
    
    // ===== STEP 2: Verify Transaction with CamPay API =====
    // CRITICAL: Never trust webhook alone, always verify!
    
    const isValidTransaction = await verifyCamPayTransaction(payload.reference);
    if (!isValidTransaction.valid) {
      console.error('Transaction verification failed:', payload.reference);
      await logSuspiciousActivity('invalid_transaction', payload);
      return { statusCode: 400, body: 'Transaction verification failed' };
    }
    
    // ===== STEP 3: Check Idempotency =====
    // Prevent duplicate processing
    
    const { data: existingOrder } = await supabase
      .from('orders')
      .select('id, status, payment_reference')
      .eq('id', payload.external_reference)
      .single();
    
    if (!existingOrder) {
      console.error('Order not found:', payload.external_reference);
      return { statusCode: 404, body: 'Order not found' };
    }
    
    if (existingOrder.status === 'paid') {
      console.log('Order already paid, skipping:', existingOrder.id);
      return { statusCode: 200, body: 'Already processed' };
    }
    
    // ===== STEP 4: Verify Amount Matches =====
    // CRITICAL: Prevent underpayment attacks
    
    const { data: orderDetails } = await supabase
      .from('orders')
      .select('amount_expected, currency')
      .eq('id', payload.external_reference)
      .single();
    
    if (payload.amount < orderDetails.amount_expected) {
      console.error('Amount mismatch:', {
        expected: orderDetails.amount_expected,
        received: payload.amount,
        order: payload.external_reference
      });
      await logSuspiciousActivity('amount_mismatch', {
        ...payload,
        expected: orderDetails.amount_expected
      });
      return { statusCode: 400, body: 'Amount mismatch' };
    }
    
    // ===== STEP 5: Process Based on Status =====
    
    if (payload.status === 'SUCCESSFUL') {
      // Update order
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          payment_method: 'mobile_money',
          payment_provider: payload.operator.toLowerCase(),
          payment_reference: payload.reference,
          campay_reference: payload.reference,
          campay_operator: payload.operator,
          amount_paid: payload.amount
        })
        .eq('id', payload.external_reference)
        .eq('status', 'pending'); // Only update if still pending (extra safety)
      
      if (updateError) {
        console.error('Failed to update order:', updateError);
        return { statusCode: 500, body: 'Database error' };
      }
      
      // Log to payment history
      await supabase.from('payment_events').insert({
        order_id: payload.external_reference,
        event_type: 'payment_successful',
        provider: 'campay',
        provider_reference: payload.reference,
        amount: payload.amount,
        currency: payload.currency,
        raw_payload: payload
      });
      
      // Send confirmation email (async, don't wait)
      sendOrderConfirmationEmail(payload.external_reference).catch(console.error);
      
      console.log('Payment successful:', {
        order: payload.external_reference,
        amount: payload.amount,
        duration: Date.now() - startTime
      });
    } else if (payload.status === 'FAILED') {
      // Log failure
      await supabase.from('payment_events').insert({
        order_id: payload.external_reference,
        event_type: 'payment_failed',
        provider: 'campay',
        provider_reference: payload.reference,
        amount: payload.amount,
        currency: payload.currency,
        failure_reason: payload.code,
        raw_payload: payload
      });
      
      // Send failure notification (for recovery)
      sendPaymentFailedEmail(payload.external_reference).catch(console.error);
    }
    
    return { statusCode: 200, body: 'OK' };
    
  } catch (error) {
    console.error('Webhook processing error:', error);
    return { statusCode: 500, body: 'Internal error' };
  }
}

// Verify transaction directly with CamPay API
async function verifyCamPayTransaction(reference: string): Promise<{ valid: boolean; data?: any }> {
  try {
    // Get fresh token
    const tokenResponse = await fetch(`${getCamPayBaseUrl()}/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: process.env.CAMPAY_USERNAME,
        password: process.env.CAMPAY_PASSWORD
      })
    });
    
    const { token } = await tokenResponse.json();
    
    // Verify transaction
    const verifyResponse = await fetch(
      `${getCamPayBaseUrl()}/transaction/${reference}/`,
      {
        headers: { 'Authorization': `Token ${token}` }
      }
    );
    
    if (!verifyResponse.ok) {
      return { valid: false };
    }
    
    const data = await verifyResponse.json();
    return {
      valid: data.status === 'SUCCESSFUL',
      data
    };
  } catch (error) {
    console.error('CamPay verification error:', error);
    return { valid: false };
  }
}

function getCamPayBaseUrl(): string {
  return process.env.CAMPAY_ENV === 'prod'
    ? 'https://www.campay.net/api'
    : 'https://demo.campay.net/api';
}

async function logSuspiciousActivity(type: string, data: any) {
  await supabase.from('security_events').insert({
    event_type: type,
    data,
    severity: 'high',
    created_at: new Date().toISOString()
  });
}
```

### Stripe Webhook (Also Secured)

```typescript
// netlify/functions/stripe-webhook.ts
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function handler(event: any) {
  const sig = event.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
  
  let stripeEvent: Stripe.Event;
  
  // ===== STEP 1: Verify Signature =====
  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      webhookSecret
    );
  } catch (err: any) {
    console.error('Stripe signature verification failed:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }
  
  // ===== STEP 2: Handle Event Types =====
  switch (stripeEvent.type) {
    case 'checkout.session.completed': {
      const session = stripeEvent.data.object as Stripe.Checkout.Session;
      
      // Verify payment was actually received
      if (session.payment_status !== 'paid') {
        console.log('Payment not yet complete:', session.id);
        return { statusCode: 200, body: 'Payment pending' };
      }
      
      // Get order ID from metadata
      const orderId = session.metadata?.order_id;
      if (!orderId) {
        console.error('No order_id in session metadata');
        return { statusCode: 400, body: 'Missing order_id' };
      }
      
      // Check idempotency
      const { data: existingOrder } = await supabase
        .from('orders')
        .select('status')
        .eq('id', orderId)
        .single();
      
      if (existingOrder?.status === 'paid') {
        return { statusCode: 200, body: 'Already processed' };
      }
      
      // Verify amount
      const { data: orderDetails } = await supabase
        .from('orders')
        .select('amount_expected')
        .eq('id', orderId)
        .single();
      
      const amountPaid = session.amount_total! / 100; // Stripe uses cents
      if (amountPaid < orderDetails.amount_expected) {
        console.error('Amount mismatch:', { expected: orderDetails.amount_expected, received: amountPaid });
        return { statusCode: 400, body: 'Amount mismatch' };
      }
      
      // Update order
      await supabase
        .from('orders')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          payment_method: 'card',
          payment_provider: 'stripe',
          payment_reference: session.payment_intent as string,
          stripe_checkout_session: session.id,
          stripe_payment_intent: session.payment_intent as string,
          amount_paid: amountPaid
        })
        .eq('id', orderId);
      
      // Log event
      await supabase.from('payment_events').insert({
        order_id: orderId,
        event_type: 'payment_successful',
        provider: 'stripe',
        provider_reference: session.payment_intent,
        amount: amountPaid,
        currency: 'USD',
        raw_payload: session
      });
      
      // Send confirmation
      sendOrderConfirmationEmail(orderId).catch(console.error);
      
      break;
    }
    
    case 'charge.refunded': {
      const charge = stripeEvent.data.object as Stripe.Charge;
      // Handle refund logic
      await handleRefund(charge);
      break;
    }
    
    case 'charge.dispute.created': {
      const dispute = stripeEvent.data.object as Stripe.Dispute;
      // Alert admin about dispute
      await alertAdminDispute(dispute);
      break;
    }
  }
  
  return { statusCode: 200, body: 'OK' };
}
```

---

## 3.3 Security Headers

```toml
# netlify.toml

[[headers]]
  for = "/*"
  [headers.values]
    # Prevent clickjacking
    X-Frame-Options = "DENY"
    
    # Prevent MIME type sniffing
    X-Content-Type-Options = "nosniff"
    
    # XSS Protection
    X-XSS-Protection = "1; mode=block"
    
    # Referrer Policy
    Referrer-Policy = "strict-origin-when-cross-origin"
    
    # Permissions Policy
    Permissions-Policy = "camera=(), microphone=(), geolocation=()"
    
    # Content Security Policy
    Content-Security-Policy = """
      default-src 'self';
      script-src 'self' 'unsafe-inline' https://js.stripe.com https://assets.calendly.com https://tally.so;
      style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
      font-src 'self' https://fonts.gstatic.com;
      img-src 'self' data: https: blob:;
      connect-src 'self' https://*.supabase.co https://api.stripe.com https://*.campay.net https://api.resend.com;
      frame-src https://js.stripe.com https://calendly.com https://tally.so https://www.youtube.com;
      media-src 'self' https://*.r2.cloudflarestorage.com;
    """
    
    # HSTS (enable after confirming SSL works)
    # Strict-Transport-Security = "max-age=31536000; includeSubDomains"

# Cache static assets
[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/*.js"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/*.css"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
```

---

## 3.4 Data Encryption

```typescript
// src/lib/security/encryption.ts
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = scryptSync(process.env.ENCRYPTION_KEY!, 'salt', 32);

// Encrypt sensitive data before storing
export function encryptSensitiveData(plaintext: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Return IV + AuthTag + Encrypted data
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

// Decrypt sensitive data when retrieving
export function decryptSensitiveData(encryptedData: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
  
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  const decipher = createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

// Fields to encrypt
export const SENSITIVE_FIELDS = [
  'questionnaire', // Personal stories
  'phone',         // Phone numbers (optional)
];
```

---

# SECTION 4: DATABASE SCHEMA (Production-Ready)

## Complete Schema with Security & Audit Tables

```sql
-- =============================================
-- CORE TABLES
-- =============================================

-- Customer Profiles (extends auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  phone_country_code TEXT DEFAULT '+237',
  preferred_language TEXT DEFAULT 'en',
  notification_preferences JSONB DEFAULT '{"email": true, "sms": false}',
  
  -- Admin fields
  admin_role admin_role,
  admin_2fa_enabled BOOLEAN DEFAULT FALSE,
  
  -- GDPR compliance
  marketing_consent BOOLEAN DEFAULT FALSE,
  data_processing_consent BOOLEAN DEFAULT TRUE,
  consent_updated_at TIMESTAMP WITH TIME ZONE,
  
  -- Soft delete for GDPR
  deleted_at TIMESTAMP WITH TIME ZONE,
  anonymized_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Orders
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL, -- Human-readable: SC-2024-0001
  
  -- Customer
  customer_id UUID REFERENCES auth.users,
  customer_email TEXT NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,
  
  -- Order details
  occasion TEXT NOT NULL,
  package TEXT NOT NULL,
  
  -- Pricing (multi-currency)
  currency TEXT NOT NULL, -- 'USD' or 'XAF'
  amount_expected DECIMAL NOT NULL,
  amount_paid DECIMAL,
  
  -- Payment
  payment_method TEXT, -- 'card', 'mobile_money'
  payment_provider TEXT, -- 'stripe', 'mtn', 'orange'
  payment_reference TEXT,
  payment_status TEXT DEFAULT 'pending', -- 'pending', 'paid', 'failed', 'refunded'
  
  -- Provider-specific references
  stripe_checkout_session TEXT,
  stripe_payment_intent TEXT,
  campay_reference TEXT,
  campay_operator TEXT,
  
  -- Order status
  status TEXT DEFAULT 'pending',
  -- 'pending', 'paid', 'discovery', 'writing', 'production', 'review', 'delivered', 'cancelled'
  
  -- Dates
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  paid_at TIMESTAMP WITH TIME ZONE,
  due_date DATE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  
  -- Content (encrypted questionnaire stored separately)
  questionnaire_id UUID,
  song_title TEXT,
  delivery_url TEXT,
  
  -- Refund tracking
  refund_status TEXT, -- 'requested', 'approved', 'processed', 'denied'
  refund_amount DECIMAL,
  refund_reason TEXT,
  refunded_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  notes TEXT,
  internal_notes TEXT, -- Admin only
  source TEXT, -- 'website', 'referral', 'social'
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Questionnaires (separate for encryption)
CREATE TABLE questionnaires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders ON DELETE CASCADE,
  
  -- Encrypted content
  encrypted_data TEXT NOT NULL, -- Encrypted JSON
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Order Status History
CREATE TABLE order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders ON DELETE CASCADE,
  status TEXT NOT NULL,
  previous_status TEXT,
  note TEXT,
  changed_by UUID REFERENCES auth.users,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- PAYMENT TRACKING
-- =============================================

-- Payment Events (for audit trail)
CREATE TABLE payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders,
  event_type TEXT NOT NULL, -- 'initiated', 'successful', 'failed', 'refunded'
  provider TEXT NOT NULL, -- 'stripe', 'campay'
  provider_reference TEXT,
  amount DECIMAL,
  currency TEXT,
  failure_reason TEXT,
  raw_payload JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment Timeout Tracking
CREATE TABLE payment_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders,
  provider TEXT NOT NULL,
  provider_session_id TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'expired'
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- SECURITY & AUDIT
-- =============================================

-- Admin Audit Log
CREATE TABLE admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES auth.users NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Security Events
CREATE TABLE security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL, -- 'invalid_webhook', 'amount_mismatch', 'rate_limited', etc.
  severity TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  data JSONB,
  ip_address INET,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_by UUID REFERENCES auth.users,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Failed Login Attempts (for security monitoring)
CREATE TABLE failed_login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  ip_address INET,
  user_agent TEXT,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- CAPACITY MANAGEMENT
-- =============================================

-- Capacity Limits
CREATE TABLE capacity_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  max_orders INT DEFAULT 3,
  current_orders INT DEFAULT 0,
  is_blackout BOOLEAN DEFAULT FALSE,
  notes TEXT,
  UNIQUE(date)
);

-- =============================================
-- NOTIFICATIONS
-- =============================================

-- Notification Queue
CREATE TABLE notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID REFERENCES auth.users,
  recipient_email TEXT NOT NULL,
  recipient_phone TEXT,
  notification_type TEXT NOT NULL, -- 'order_confirmation', 'status_update', 'delivery', etc.
  channel TEXT NOT NULL, -- 'email', 'sms', 'whatsapp'
  subject TEXT,
  body TEXT,
  template_data JSONB,
  status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'failed'
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  retry_count INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- INDEXES (Performance)
-- =============================================

-- Orders
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);
CREATE INDEX idx_orders_due_date ON orders(due_date);
CREATE INDEX idx_orders_payment_ref ON orders(payment_reference);
CREATE INDEX idx_orders_stripe_session ON orders(stripe_checkout_session);
CREATE INDEX idx_orders_campay_ref ON orders(campay_reference);
CREATE INDEX idx_orders_number ON orders(order_number);

-- Payment Events
CREATE INDEX idx_payment_events_order ON payment_events(order_id);
CREATE INDEX idx_payment_events_type ON payment_events(event_type);
CREATE INDEX idx_payment_events_date ON payment_events(created_at DESC);

-- Audit Logs
CREATE INDEX idx_audit_admin ON admin_audit_log(admin_id);
CREATE INDEX idx_audit_target ON admin_audit_log(target_type, target_id);
CREATE INDEX idx_audit_date ON admin_audit_log(created_at DESC);

-- Security Events
CREATE INDEX idx_security_severity ON security_events(severity, created_at DESC);
CREATE INDEX idx_security_unresolved ON security_events(resolved) WHERE NOT resolved;

-- Notifications
CREATE INDEX idx_notifications_pending ON notification_queue(status, created_at) WHERE status = 'pending';

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE questionnaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Profiles: Users see only their own
CREATE POLICY "Users view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Orders: Users see only their own orders
CREATE POLICY "Users view own orders" ON orders
  FOR SELECT USING (auth.uid() = customer_id);

-- Admins: Full access based on role
CREATE POLICY "Admins view all orders" ON orders
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.admin_role IS NOT NULL
    )
  );

CREATE POLICY "Admins view all profiles" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.admin_role IS NOT NULL
    )
  );

-- Audit logs: Only super_admin can view
CREATE POLICY "Super admins view audit logs" ON admin_audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.admin_role = 'super_admin'
    )
  );

-- =============================================
-- FUNCTIONS
-- =============================================

-- Generate order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
  year_str TEXT;
  seq_num INT;
  order_num TEXT;
BEGIN
  year_str := to_char(CURRENT_DATE, 'YYYY');
  
  SELECT COUNT(*) + 1 INTO seq_num
  FROM orders
  WHERE created_at >= date_trunc('year', CURRENT_DATE);
  
  order_num := 'SC-' || year_str || '-' || lpad(seq_num::TEXT, 4, '0');
  
  RETURN order_num;
END;
$$ LANGUAGE plpgsql;

-- Trigger for order number
CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.order_number := generate_order_number();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION set_order_number();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, email)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_orders_updated
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_profiles_updated
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- GDPR: Anonymize user data
CREATE OR REPLACE FUNCTION anonymize_user(user_uuid UUID)
RETURNS void AS $$
BEGIN
  -- Anonymize profile
  UPDATE profiles SET
    full_name = 'Deleted User',
    email = 'deleted-' || user_uuid || '@anonymized.local',
    phone = NULL,
    anonymized_at = NOW()
  WHERE id = user_uuid;
  
  -- Anonymize orders (keep for accounting, remove PII)
  UPDATE orders SET
    customer_name = 'Deleted User',
    customer_email = 'deleted@anonymized.local',
    customer_phone = NULL
  WHERE customer_id = user_uuid;
  
  -- Delete questionnaires (personal stories)
  DELETE FROM questionnaires
  WHERE order_id IN (SELECT id FROM orders WHERE customer_id = user_uuid);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

# SECTION 5: PAYMENT ABSTRACTION LAYER

## Provider Interface (For Easy Expansion)

```typescript
// src/lib/payments/types.ts

export interface PaymentSession {
  id: string;
  orderId: string;
  provider: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'expired';
  redirectUrl?: string;
  expiresAt: Date;
  metadata: Record<string, any>;
}

export interface PaymentResult {
  success: boolean;
  reference?: string;
  error?: string;
  requiresAction?: boolean;
  actionType?: 'redirect' | 'ussd_prompt' | 'otp';
}

export interface RefundResult {
  success: boolean;
  reference?: string;
  error?: string;
}

export interface PaymentProvider {
  name: string;
  supportedCountries: string[];
  supportedCurrencies: string[];
  
  // Initialize a payment
  initiatePayment(params: {
    orderId: string;
    amount: number;
    currency: string;
    customerEmail: string;
    customerPhone?: string;
    description: string;
    returnUrl: string;
    metadata?: Record<string, any>;
  }): Promise<PaymentResult>;
  
  // Check payment status
  verifyPayment(reference: string): Promise<{
    status: 'pending' | 'successful' | 'failed';
    amount?: number;
    paidAt?: Date;
  }>;
  
  // Process refund
  refund(params: {
    paymentReference: string;
    amount: number;
    reason: string;
  }): Promise<RefundResult>;
}
```

## Stripe Provider

```typescript
// src/lib/payments/stripe-provider.ts
import Stripe from 'stripe';
import type { PaymentProvider, PaymentResult, RefundResult } from './types';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export const stripeProvider: PaymentProvider = {
  name: 'stripe',
  supportedCountries: ['*'], // International
  supportedCurrencies: ['USD', 'EUR', 'GBP'],
  
  async initiatePayment(params) {
    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: params.currency.toLowerCase(),
            product_data: {
              name: params.description,
            },
            unit_amount: Math.round(params.amount * 100), // Cents
          },
          quantity: 1,
        }],
        mode: 'payment',
        success_url: `${params.returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.PUBLIC_SITE_URL}/checkout/cancelled`,
        customer_email: params.customerEmail,
        metadata: {
          order_id: params.orderId,
          ...params.metadata
        },
        expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // 30 minutes
      });
      
      return {
        success: true,
        reference: session.id,
        requiresAction: true,
        actionType: 'redirect',
        redirectUrl: session.url!,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  },
  
  async verifyPayment(reference) {
    const session = await stripe.checkout.sessions.retrieve(reference);
    
    return {
      status: session.payment_status === 'paid' ? 'successful' : 
              session.payment_status === 'unpaid' ? 'pending' : 'failed',
      amount: session.amount_total ? session.amount_total / 100 : undefined,
      paidAt: session.payment_status === 'paid' ? new Date() : undefined,
    };
  },
  
  async refund(params) {
    try {
      const refund = await stripe.refunds.create({
        payment_intent: params.paymentReference,
        amount: Math.round(params.amount * 100),
        reason: 'requested_by_customer',
        metadata: { reason: params.reason }
      });
      
      return {
        success: true,
        reference: refund.id,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
};
```

## CamPay Provider

```typescript
// src/lib/payments/campay-provider.ts
import type { PaymentProvider, PaymentResult, RefundResult } from './types';

const CAMPAY_BASE_URL = process.env.CAMPAY_ENV === 'prod'
  ? 'https://www.campay.net/api'
  : 'https://demo.campay.net/api';

async function getCamPayToken(): Promise<string> {
  const response = await fetch(`${CAMPAY_BASE_URL}/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: process.env.CAMPAY_USERNAME,
      password: process.env.CAMPAY_PASSWORD
    })
  });
  
  const data = await response.json();
  return data.token;
}

export const campayProvider: PaymentProvider = {
  name: 'campay',
  supportedCountries: ['CM'], // Cameroon only
  supportedCurrencies: ['XAF'],
  
  async initiatePayment(params) {
    try {
      const token = await getCamPayToken();
      
      const response = await fetch(`${CAMPAY_BASE_URL}/collect/`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: params.amount.toString(),
          currency: 'XAF',
          from: params.customerPhone,
          description: params.description,
          external_reference: params.orderId,
        })
      });
      
      const data = await response.json();
      
      if (data.reference) {
        return {
          success: true,
          reference: data.reference,
          requiresAction: true,
          actionType: 'ussd_prompt',
        };
      } else {
        return {
          success: false,
          error: data.message || 'Payment initiation failed',
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  },
  
  async verifyPayment(reference) {
    const token = await getCamPayToken();
    
    const response = await fetch(`${CAMPAY_BASE_URL}/transaction/${reference}/`, {
      headers: { 'Authorization': `Token ${token}` }
    });
    
    const data = await response.json();
    
    return {
      status: data.status === 'SUCCESSFUL' ? 'successful' :
              data.status === 'PENDING' ? 'pending' : 'failed',
      amount: data.amount ? parseFloat(data.amount) : undefined,
      paidAt: data.status === 'SUCCESSFUL' ? new Date() : undefined,
    };
  },
  
  async refund(params) {
    // CamPay refunds require manual disbursement
    // Log for manual processing
    console.log('CamPay refund requested:', params);
    
    // You would implement disbursement API here
    // For now, return that it needs manual processing
    return {
      success: false,
      error: 'CamPay refunds require manual processing. Contact support.',
    };
  }
};
```

## Payment Service

```typescript
// src/lib/payments/payment-service.ts
import { stripeProvider } from './stripe-provider';
import { campayProvider } from './campay-provider';
import type { PaymentProvider } from './types';

const providers: Record<string, PaymentProvider> = {
  stripe: stripeProvider,
  campay: campayProvider,
  // Future: paystack: paystackProvider (Nigeria)
};

export function getProviderForCountry(country: string): PaymentProvider | null {
  if (country === 'CM') return providers.campay;
  return providers.stripe; // Default to Stripe for international
}

export function getProviderForCurrency(currency: string): PaymentProvider | null {
  if (currency === 'XAF') return providers.campay;
  return providers.stripe;
}

export function getProvider(name: string): PaymentProvider | null {
  return providers[name] || null;
}
```

---

# SECTION 6: TRANSACTIONAL EMAIL SYSTEM

## Email Service with Resend

```typescript
// src/lib/email/email-service.ts
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = 'Eventune Studios <orders@eventunestudios.com>';

interface EmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });
    return true;
  } catch (error) {
    console.error('Email send error:', error);
    return false;
  }
}

// ===== EMAIL TEMPLATES =====

export async function sendOrderConfirmationEmail(order: {
  id: string;
  orderNumber: string;
  customerEmail: string;
  customerName: string;
  package: string;
  occasion: string;
  amountPaid: number;
  currency: string;
  paymentMethod: string;
}) {
  const subject = `Order Confirmed: ${order.orderNumber} - Eventune Studios`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #0A0A0A; color: #D4AF37; padding: 30px; text-align: center; }
        .content { padding: 30px; background: #f9f9f9; }
        .order-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
        .button { display: inline-block; background: #D4AF37; color: #0A0A0A; padding: 12px 24px; 
                  text-decoration: none; border-radius: 4px; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎵 Order Confirmed!</h1>
        </div>
        
        <div class="content">
          <p>Hi ${order.customerName},</p>
          
          <p>Thank you for your order! We're excited to create your custom song.</p>
          
          <div class="order-details">
            <h3>Order Details</h3>
            <p><strong>Order Number:</strong> ${order.orderNumber}</p>
            <p><strong>Package:</strong> ${order.package}</p>
            <p><strong>Occasion:</strong> ${order.occasion}</p>
            <p><strong>Amount Paid:</strong> ${order.currency} ${order.amountPaid.toLocaleString()}</p>
            <p><strong>Payment Method:</strong> ${order.paymentMethod === 'mobile_money' ? 'Mobile Money' : 'Credit Card'}</p>
          </div>
          
          <h3>What's Next?</h3>
          <ol>
            <li>We'll review your questionnaire within 24 hours</li>
            <li>If you selected Classic or Signature package, we'll schedule your discovery call</li>
            <li>We'll start crafting your unique song</li>
            <li>You can track progress in your customer portal</li>
          </ol>
          
          <p style="text-align: center; margin-top: 30px;">
            <a href="${process.env.PUBLIC_SITE_URL}/portal/orders/${order.id}" class="button">
              View Your Order
            </a>
          </p>
        </div>
        
        <div class="footer">
          <p>Questions? Reply to this email or WhatsApp us at +237 XXX XXX XXX</p>
          <p>© ${new Date().getFullYear()} Eventune Studios. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  return sendEmail({
    to: order.customerEmail,
    subject,
    html
  });
}

export async function sendStatusUpdateEmail(order: {
  customerEmail: string;
  customerName: string;
  orderNumber: string;
  orderId: string;
  newStatus: string;
  statusMessage: string;
}) {
  const statusEmoji: Record<string, string> = {
    discovery: '📞',
    writing: '✍️',
    production: '🎹',
    review: '👀',
    delivered: '🎉'
  };
  
  const subject = `${statusEmoji[order.newStatus] || '📋'} Order Update: ${order.orderNumber}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #0A0A0A; color: #D4AF37; padding: 30px; text-align: center; }
        .content { padding: 30px; background: #f9f9f9; }
        .status-badge { display: inline-block; background: #D4AF37; color: #0A0A0A; 
                        padding: 8px 16px; border-radius: 20px; font-weight: bold; }
        .button { display: inline-block; background: #D4AF37; color: #0A0A0A; padding: 12px 24px; 
                  text-decoration: none; border-radius: 4px; font-weight: bold; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Order Update</h1>
        </div>
        
        <div class="content">
          <p>Hi ${order.customerName},</p>
          
          <p>Great news! Your order <strong>${order.orderNumber}</strong> has been updated:</p>
          
          <p style="text-align: center; margin: 30px 0;">
            <span class="status-badge">${order.newStatus.toUpperCase()}</span>
          </p>
          
          <p>${order.statusMessage}</p>
          
          <p style="text-align: center; margin-top: 30px;">
            <a href="${process.env.PUBLIC_SITE_URL}/portal/orders/${order.orderId}" class="button">
              View Order Details
            </a>
          </p>
        </div>
        
        <div class="footer">
          <p>© ${new Date().getFullYear()} Eventune Studios</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  return sendEmail({
    to: order.customerEmail,
    subject,
    html
  });
}

export async function sendDeliveryEmail(order: {
  customerEmail: string;
  customerName: string;
  orderNumber: string;
  orderId: string;
  songTitle: string;
  deliveryUrl: string;
}) {
  const subject = `🎉 Your Song is Ready: "${order.songTitle}" - ${order.orderNumber}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #0A0A0A; color: #D4AF37; padding: 30px; text-align: center; }
        .content { padding: 30px; background: #f9f9f9; }
        .song-card { background: linear-gradient(135deg, #0A0A0A, #1A1A1A); 
                     color: white; padding: 30px; border-radius: 12px; text-align: center; margin: 20px 0; }
        .song-title { color: #D4AF37; font-size: 24px; margin: 10px 0; }
        .button { display: inline-block; background: #D4AF37; color: #0A0A0A; padding: 16px 32px; 
                  text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 18px; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎵 Your Song is Ready!</h1>
        </div>
        
        <div class="content">
          <p>Hi ${order.customerName},</p>
          
          <p>We're thrilled to deliver your custom song! This moment has been a joy to create.</p>
          
          <div class="song-card">
            <p style="margin: 0; opacity: 0.7;">Your Custom Song</p>
            <h2 class="song-title">"${order.songTitle}"</h2>
            <p style="margin: 20px 0;">
              <a href="${order.deliveryUrl}" class="button">
                🎧 Listen & Download
              </a>
            </p>
          </div>
          
          <h3>We'd Love Your Feedback!</h3>
          <p>Your reaction means the world to us. Would you consider:</p>
          <ul>
            <li>Recording a reaction video when you (or your loved one) hear it for the first time</li>
            <li>Leaving us a review on Google</li>
            <li>Sharing on social media (tag us @eventunestudios)</li>
          </ul>
          
          <p>If you'd like any adjustments, just reply to this email within 7 days.</p>
          
          <p style="text-align: center; margin-top: 30px;">
            <a href="${process.env.PUBLIC_SITE_URL}/portal/orders/${order.orderId}" class="button">
              View in Portal
            </a>
          </p>
        </div>
        
        <div class="footer">
          <p>Thank you for trusting us with your special moment! 💛</p>
          <p>© ${new Date().getFullYear()} Eventune Studios</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  return sendEmail({
    to: order.customerEmail,
    subject,
    html
  });
}

export async function sendPaymentFailedEmail(order: {
  customerEmail: string;
  customerName: string;
  orderNumber: string;
  orderId: string;
  failureReason?: string;
}) {
  const subject = `Payment Issue - Order ${order.orderNumber}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #dc2626; color: white; padding: 30px; text-align: center; }
        .content { padding: 30px; background: #f9f9f9; }
        .button { display: inline-block; background: #D4AF37; color: #0A0A0A; padding: 12px 24px; 
                  text-decoration: none; border-radius: 4px; font-weight: bold; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Payment Issue</h1>
        </div>
        
        <div class="content">
          <p>Hi ${order.customerName},</p>
          
          <p>We noticed there was an issue with your payment for order <strong>${order.orderNumber}</strong>.</p>
          
          ${order.failureReason ? `<p><strong>Reason:</strong> ${order.failureReason}</p>` : ''}
          
          <p>Don't worry - your order is saved. You can complete your payment anytime:</p>
          
          <p style="text-align: center; margin: 30px 0;">
            <a href="${process.env.PUBLIC_SITE_URL}/checkout/retry/${order.orderId}" class="button">
              Complete Payment
            </a>
          </p>
          
          <p>If you're having trouble, please don't hesitate to contact us via WhatsApp or email.</p>
        </div>
        
        <div class="footer">
          <p>© ${new Date().getFullYear()} Eventune Studios</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  return sendEmail({
    to: order.customerEmail,
    subject,
    html
  });
}
```

---

# SECTION 7: MONITORING & OBSERVABILITY

## 7.1 Error Tracking with Sentry

```typescript
// src/lib/monitoring/sentry.ts
import * as Sentry from "@sentry/astro";

Sentry.init({
  dsn: process.env.PUBLIC_SENTRY_DSN,
  
  // Performance monitoring
  tracesSampleRate: 0.1, // 10% of transactions
  
  // Environment
  environment: process.env.NODE_ENV,
  
  // Release tracking
  release: process.env.npm_package_version,
  
  // Filter out noisy errors
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'Non-Error promise rejection captured',
  ],
  
  // Scrub sensitive data
  beforeSend(event) {
    // Remove sensitive query params
    if (event.request?.query_string) {
      event.request.query_string = '[Filtered]';
    }
    
    // Remove credit card / phone numbers from breadcrumbs
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.map(breadcrumb => {
        if (breadcrumb.message) {
          breadcrumb.message = breadcrumb.message
            .replace(/\d{13,16}/g, '[CARD]')
            .replace(/\+?\d{10,15}/g, '[PHONE]');
        }
        return breadcrumb;
      });
    }
    
    return event;
  },
});

// Custom error capture with context
export function captureError(error: Error, context?: Record<string, any>) {
  Sentry.withScope(scope => {
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }
    Sentry.captureException(error);
  });
}

// Track specific events
export function trackEvent(name: string, data?: Record<string, any>) {
  Sentry.addBreadcrumb({
    message: name,
    data,
    level: 'info',
  });
}
```

## 7.2 Uptime Monitoring Setup

```yaml
# UptimeRobot configuration (set up in dashboard)

Monitors to create:
  1. Main Website
     - URL: https://eventunestudios.com
     - Interval: 5 minutes
     - Alert: Email + Slack
     
  2. API Health
     - URL: https://eventunestudios.com/.netlify/functions/health
     - Interval: 5 minutes
     
  3. Supabase Connection
     - URL: https://YOUR_PROJECT.supabase.co/rest/v1/
     - Interval: 5 minutes
     - Headers: apikey: YOUR_ANON_KEY
     
  4. Payment Webhooks
     - URL: https://eventunestudios.com/.netlify/functions/stripe-webhook
     - Method: HEAD
     - Interval: 5 minutes
```

## 7.3 Health Check Endpoint

```typescript
// netlify/functions/health.ts

export async function handler() {
  const checks = {
    timestamp: new Date().toISOString(),
    status: 'healthy',
    checks: {
      database: await checkDatabase(),
      stripe: await checkStripe(),
      campay: await checkCamPay(),
      email: await checkEmail(),
    }
  };
  
  const allHealthy = Object.values(checks.checks).every(c => c.status === 'ok');
  
  return {
    statusCode: allHealthy ? 200 : 503,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(checks)
  };
}

async function checkDatabase() {
  try {
    const { error } = await supabase.from('profiles').select('id').limit(1);
    return { status: error ? 'error' : 'ok', latency: Date.now() };
  } catch {
    return { status: 'error' };
  }
}

async function checkStripe() {
  try {
    await stripe.balance.retrieve();
    return { status: 'ok' };
  } catch {
    return { status: 'error' };
  }
}

async function checkCamPay() {
  try {
    // Just check if we can get a token
    const token = await getCamPayToken();
    return { status: token ? 'ok' : 'error' };
  } catch {
    return { status: 'error' };
  }
}

async function checkEmail() {
  // Resend doesn't have a simple health check
  // We just verify the API key is set
  return { status: process.env.RESEND_API_KEY ? 'ok' : 'error' };
}
```

## 7.4 Business Metrics Dashboard

```typescript
// src/lib/analytics/metrics.ts

export async function getBusinessMetrics() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  
  // Orders this month
  const { data: thisMonthOrders } = await supabase
    .from('orders')
    .select('id, amount_paid, currency')
    .gte('created_at', startOfMonth.toISOString())
    .eq('payment_status', 'paid');
  
  // Orders last month
  const { data: lastMonthOrders } = await supabase
    .from('orders')
    .select('id, amount_paid, currency')
    .gte('created_at', startOfLastMonth.toISOString())
    .lt('created_at', startOfMonth.toISOString())
    .eq('payment_status', 'paid');
  
  // Orders by status
  const { data: ordersByStatus } = await supabase
    .from('orders')
    .select('status')
    .neq('status', 'cancelled');
  
  // Revenue breakdown
  const revenueUSD = thisMonthOrders?.filter(o => o.currency === 'USD')
    .reduce((sum, o) => sum + o.amount_paid, 0) || 0;
  const revenueXAF = thisMonthOrders?.filter(o => o.currency === 'XAF')
    .reduce((sum, o) => sum + o.amount_paid, 0) || 0;
  
  // Status distribution
  const statusCounts = ordersByStatus?.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};
  
  return {
    thisMonth: {
      orders: thisMonthOrders?.length || 0,
      revenueUSD,
      revenueXAF,
    },
    lastMonth: {
      orders: lastMonthOrders?.length || 0,
    },
    pipeline: {
      pending: statusCounts['pending'] || 0,
      paid: statusCounts['paid'] || 0,
      inProgress: (statusCounts['discovery'] || 0) + 
                  (statusCounts['writing'] || 0) + 
                  (statusCounts['production'] || 0),
      review: statusCounts['review'] || 0,
      delivered: statusCounts['delivered'] || 0,
    }
  };
}
```

---

# SECTION 8: LEGAL COMPLIANCE

## 8.1 Privacy Policy Template

```markdown
# Privacy Policy

**Last updated:** [DATE]

Eventune Studios ("we", "our", "us") respects your privacy and is committed to protecting your personal data.

## 1. Information We Collect

### Information you provide:
- Name and contact information (email, phone number)
- Payment information (processed securely by Stripe/CamPay)
- Questionnaire responses about your song
- Communications with us

### Information collected automatically:
- Usage data (pages visited, time spent)
- Device information (browser type, IP address)
- Cookies (see Cookie Policy below)

## 2. How We Use Your Information

We use your information to:
- Process and fulfill your order
- Communicate about your order status
- Improve our services
- Send marketing emails (with your consent)

## 3. Third-Party Services

We share data with:
- **Stripe** (payment processing) - [Stripe Privacy Policy]
- **CamPay** (mobile money payments) - [CamPay Privacy Policy]
- **Supabase** (data storage) - [Supabase Privacy Policy]
- **Resend** (email delivery) - [Resend Privacy Policy]

## 4. Data Retention

We retain your data for:
- Order records: 7 years (legal requirement)
- Account information: Until you request deletion
- Marketing preferences: Until you unsubscribe

## 5. Your Rights

You have the right to:
- Access your personal data
- Correct inaccurate data
- Delete your data ("right to be forgotten")
- Export your data
- Withdraw consent

To exercise these rights, contact: privacy@eventunestudios.com

## 6. International Transfers

Your data may be processed in countries outside your residence. We ensure adequate protection through [appropriate safeguards].

## 7. Security

We implement security measures including:
- Encryption of sensitive data
- Secure payment processing
- Access controls
- Regular security reviews

## 8. Contact Us

For privacy inquiries:
- Email: privacy@eventunestudios.com
- Address: [Your address]

## 9. Changes to This Policy

We may update this policy. Material changes will be notified via email.
```

## 8.2 Terms of Service Template

```markdown
# Terms of Service

**Last updated:** [DATE]

## 1. Services

Eventune Studios creates custom, personalized songs based on your specifications.

## 2. Ordering Process

1. Submit questionnaire with song details
2. Complete payment
3. We create your custom song
4. Receive your song via email/portal

## 3. Pricing & Payment

- Prices displayed at time of order are final
- Payment required before production begins
- We accept credit cards (Stripe) and Mobile Money (CamPay)
- All prices in USD or XAF as displayed

## 4. Delivery Timeframes

- Express Package: 5-7 business days
- Classic Package: 7-10 business days
- Signature Package: 10-14 business days

Timeframes begin after payment confirmation.

## 5. Revisions

- Express: No revisions included
- Classic: 1 revision
- Signature: 2 revisions

Revision requests must be submitted within 7 days of delivery.

## 6. Refund Policy

- Before production starts: Full refund
- During production: 50% refund
- After delivery: No refund (revisions available)

Refunds processed within 5-10 business days.

## 7. Intellectual Property

- You receive a license to use the song for personal, non-commercial purposes
- Commercial licensing available separately
- We retain rights for portfolio/promotional use (unless you opt out)

## 8. Acceptable Use

You agree not to:
- Request content that is illegal, harmful, or offensive
- Misrepresent yourself or your intentions
- Use the service for fraudulent purposes

## 9. Limitation of Liability

Our liability is limited to the amount paid for the service. We are not liable for indirect, incidental, or consequential damages.

## 10. Disputes

Disputes will be resolved through arbitration in [Jurisdiction].

## 11. Changes

We may modify these terms. Continued use constitutes acceptance.

## 12. Contact

Questions: legal@eventunestudios.com
```

## 8.3 Cookie Consent Banner

```typescript
// src/components/CookieConsent.astro

<script>
  // Check if consent already given
  const hasConsent = localStorage.getItem('cookie_consent');
  
  if (!hasConsent) {
    document.getElementById('cookie-banner').style.display = 'flex';
  }
  
  function acceptCookies() {
    localStorage.setItem('cookie_consent', 'accepted');
    document.getElementById('cookie-banner').style.display = 'none';
    
    // Now load analytics
    loadGoogleAnalytics();
  }
  
  function declineCookies() {
    localStorage.setItem('cookie_consent', 'declined');
    document.getElementById('cookie-banner').style.display = 'none';
    
    // Don't load analytics
  }
  
  function loadGoogleAnalytics() {
    // Only load GA if consent given
    const script = document.createElement('script');
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
    script.async = true;
    document.head.appendChild(script);
    
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', GA_ID);
  }
  
  // If already consented, load analytics
  if (hasConsent === 'accepted') {
    loadGoogleAnalytics();
  }
</script>

<div id="cookie-banner" class="fixed bottom-0 left-0 right-0 bg-gray-900 text-white p-4 z-50 hidden">
  <div class="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
    <p class="text-sm">
      We use cookies to improve your experience and analyze site traffic. 
      <a href="/privacy-policy" class="underline">Learn more</a>
    </p>
    <div class="flex gap-3">
      <button onclick="declineCookies()" class="px-4 py-2 text-sm border border-white rounded hover:bg-white hover:text-gray-900">
        Decline
      </button>
      <button onclick="acceptCookies()" class="px-4 py-2 text-sm bg-gold-500 text-black rounded hover:bg-gold-400">
        Accept
      </button>
    </div>
  </div>
</div>
```

---

# SECTION 9: i18n FOUNDATION

## Internationalization Setup (English + French Ready)

```typescript
// astro.config.mjs
import { defineConfig } from 'astro/config';

export default defineConfig({
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'fr'],
    routing: {
      prefixDefaultLocale: false // /about vs /fr/about
    }
  }
});
```

```typescript
// src/i18n/translations.ts

export const translations = {
  en: {
    // Navigation
    'nav.home': 'Home',
    'nav.services': 'Services',
    'nav.samples': 'Samples',
    'nav.about': 'About',
    'nav.contact': 'Contact',
    'nav.login': 'Login',
    'nav.portal': 'My Orders',
    
    // Hero
    'hero.title': 'Your Story. Your Song.',
    'hero.subtitle': 'Professional custom songs for life\'s special moments',
    'hero.cta': 'Start Your Song',
    
    // Packages
    'packages.express': 'Express',
    'packages.classic': 'Classic',
    'packages.signature': 'Signature',
    
    // Order status
    'status.pending': 'Pending',
    'status.paid': 'Paid',
    'status.discovery': 'Discovery',
    'status.writing': 'Writing',
    'status.production': 'Production',
    'status.review': 'Review',
    'status.delivered': 'Delivered',
    
    // Common
    'common.loading': 'Loading...',
    'common.error': 'Something went wrong',
    'common.retry': 'Try Again',
    'common.submit': 'Submit',
    'common.cancel': 'Cancel',
  },
  
  fr: {
    // Navigation
    'nav.home': 'Accueil',
    'nav.services': 'Services',
    'nav.samples': 'Exemples',
    'nav.about': 'À propos',
    'nav.contact': 'Contact',
    'nav.login': 'Connexion',
    'nav.portal': 'Mes Commandes',
    
    // Hero
    'hero.title': 'Votre Histoire. Votre Chanson.',
    'hero.subtitle': 'Chansons personnalisées pour les moments spéciaux',
    'hero.cta': 'Commencer',
    
    // Packages
    'packages.express': 'Express',
    'packages.classic': 'Classique',
    'packages.signature': 'Signature',
    
    // Order status
    'status.pending': 'En attente',
    'status.paid': 'Payé',
    'status.discovery': 'Découverte',
    'status.writing': 'Écriture',
    'status.production': 'Production',
    'status.review': 'Révision',
    'status.delivered': 'Livré',
    
    // Common
    'common.loading': 'Chargement...',
    'common.error': 'Une erreur s\'est produite',
    'common.retry': 'Réessayer',
    'common.submit': 'Envoyer',
    'common.cancel': 'Annuler',
  }
};

// Helper function
export function t(key: string, locale: string = 'en'): string {
  return translations[locale]?.[key] || translations['en'][key] || key;
}
```

---

# SECTION 10: FILE STORAGE (Cloudflare R2)

## R2 Setup for Audio Files

```typescript
// src/lib/storage/r2-client.ts
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const R2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME!;

// Upload file
export async function uploadFile(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  await R2.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));
  
  return `https://${process.env.R2_PUBLIC_DOMAIN}/${key}`;
}

// Get signed URL for private files
export async function getSignedDownloadUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });
  
  return getSignedUrl(R2, command, { expiresIn });
}

// Upload delivered song
export async function uploadDeliveredSong(
  orderId: string,
  fileName: string,
  fileBuffer: Buffer
): Promise<string> {
  const key = `deliveries/${orderId}/${fileName}`;
  const contentType = fileName.endsWith('.mp3') ? 'audio/mpeg' : 'audio/wav';
  
  return uploadFile(key, fileBuffer, contentType);
}

// Upload sample for portfolio
export async function uploadSample(
  sampleId: string,
  fileName: string,
  fileBuffer: Buffer
): Promise<string> {
  const key = `samples/${sampleId}/${fileName}`;
  const contentType = fileName.endsWith('.mp3') ? 'audio/mpeg' : 'audio/wav';
  
  return uploadFile(key, fileBuffer, contentType);
}
```

---

# SECTION 11: UPDATED DEVELOPMENT TIMELINE

## 5-Week Build Schedule

### Week 1: Foundation + Security Setup

```
Day 1-2: Project Initialization
□ GitHub repository with branch protection
□ Astro + Tailwind + TypeScript
□ Netlify deployment pipeline
□ Environment variables setup

Day 3-4: Supabase Setup
□ Create Supabase Pro project ($25/mo)
□ Run complete database schema
□ Configure Row Level Security
□ Set up authentication
□ Create admin user

Day 5-7: Security Foundation
□ Cloudflare DNS + DDoS protection
□ Security headers in netlify.toml
□ Rate limiting with Upstash Redis
□ Error tracking with Sentry
□ Uptime monitoring setup
```

### Week 2: Core Pages + Auth

```
Day 8-10: Public Pages
□ Base layout (header, footer)
□ Home page (all sections)
□ Services page (with XAF pricing)
□ Samples page with audio player
□ About page
□ Contact page

Day 11-12: Authentication System
□ Login page
□ Signup page
□ Password reset
□ Protected route middleware
□ Session management

Day 13-14: Legal Pages
□ Privacy policy
□ Terms of service
□ Refund policy
□ Cookie consent banner
```

### Week 3: Payment System

```
Day 15-16: Stripe Integration
□ Stripe Checkout flow
□ Secure webhook handler (with verification)
□ Amount validation
□ Idempotency handling
□ Test with test cards

Day 17-19: CamPay Integration
□ CamPay account + sandbox
□ Token management
□ Collect payment endpoint
□ Secure webhook handler (with verification)
□ Status polling for pending payments
□ Payment UI (phone input, provider selection)
□ Waiting/confirmation screens

Day 20-21: Payment Polish
□ Payment timeout handling
□ Failed payment recovery flow
□ Refund request system
□ Payment events logging
□ End-to-end testing
```

### Week 4: Portal + Admin

```
Day 22-24: Customer Portal
□ Orders list page
□ Order detail page with timeline
□ Download functionality
□ Profile settings
□ Notification preferences

Day 25-27: Admin Dashboard
□ Admin layout + auth
□ Orders management
□ Status update with audit logging
□ Customer list
□ Refund processing
□ Business metrics dashboard
```

### Week 5: Polish + Launch

```
Day 28-29: Email System
□ Resend integration
□ Order confirmation template
□ Status update template
□ Delivery notification template
□ Payment failed template
□ Test all email flows

Day 30-31: CMS + Content
□ Decap CMS setup
□ Blog system
□ Sample songs upload to R2
□ Testimonials
□ SEO optimization

Day 32-33: Testing & QA
□ Full payment flow (Stripe live - small test)
□ Full payment flow (CamPay live - small test)
□ Mobile testing (iOS + Android)
□ Cross-browser testing
□ Security review
□ Performance audit (Lighthouse)
□ Load testing

Day 34-35: Launch
□ Final review
□ DNS switch
□ Production environment variables
□ Monitor error rates
□ Monitor uptime
□ Celebrate! 🎉
```

---

# SECTION 12: ENVIRONMENT VARIABLES (Complete)

```env
# ======================
# CORE
# ======================
PUBLIC_SITE_URL=https://eventunestudios.com
# Domain: eventunestudios.com
NODE_ENV=production

# ======================
# SUPABASE
# ======================
PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_KEY=eyJhbGci...

# ======================
# STRIPE
# ======================
PUBLIC_STRIPE_KEY=pk_live_xxxxx
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# ======================
# CAMPAY
# ======================
CAMPAY_USERNAME=your_username
CAMPAY_PASSWORD=your_password
CAMPAY_WEBHOOK_SECRET=your_secret
CAMPAY_ENV=prod  # 'demo' or 'prod'

# ======================
# CLOUDFLARE R2
# ======================
R2_ACCOUNT_ID=xxxxx
R2_ACCESS_KEY_ID=xxxxx
R2_SECRET_ACCESS_KEY=xxxxx
R2_BUCKET_NAME=eventune-files
R2_PUBLIC_DOMAIN=files.eventunestudios.com

# ======================
# EMAIL (RESEND)
# ======================
RESEND_API_KEY=re_xxxxx

# ======================
# SECURITY
# ======================
ENCRYPTION_KEY=your-32-char-encryption-key-here
UPSTASH_REDIS_URL=https://xxxxx.upstash.io
UPSTASH_REDIS_TOKEN=xxxxx

# ======================
# MONITORING
# ======================
PUBLIC_SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
PUBLIC_GA_ID=G-XXXXXXXXXX

# ======================
# OPTIONAL
# ======================
TWILIO_SID=xxxxx  # For SMS
TWILIO_AUTH_TOKEN=xxxxx
TWILIO_PHONE=+1234567890
```

---

# SECTION 13: LAUNCH CHECKLIST (Complete)

## Security Checklist

```
□ Webhook signature verification (Stripe)
□ Webhook signature verification (CamPay)  
□ Payment amount validation
□ Rate limiting active
□ Security headers configured
□ CSP policy set
□ HTTPS enforced
□ Sensitive data encrypted
□ Admin audit logging active
□ Failed login tracking
□ Session timeout configured
```

## Operational Checklist

```
□ Sentry error tracking connected
□ UptimeRobot monitors active
□ Health check endpoint working
□ Backup strategy documented
□ Supabase Pro active (no pausing)
□ DNS through Cloudflare
□ Email delivery tested
□ All environment variables set
```

## Legal Checklist

```
□ Privacy policy published
□ Terms of service published
□ Cookie consent banner active
□ Refund policy clear
□ Data processing documented
```

## Payment Checklist

```
□ Stripe live mode enabled
□ Stripe test payment successful
□ CamPay KYC approved
□ CamPay live credentials set
□ CamPay test payment successful
□ Refund flow tested
□ Failed payment recovery works
□ Payment timeout handling works
```

## Content Checklist

```
□ All pages proofread
□ Sample songs uploaded
□ Testimonials added
□ Images optimized
□ SEO meta tags set
□ Open Graph images ready
```

---

# SECTION 14: SUMMARY

## What's New in v4

| Category | v3 | v4 |
|----------|----|----|
| **Backend** | Supabase Free | Supabase Pro ($25/mo) |
| **Webhook Security** | None | Signature verification + amount validation |
| **Rate Limiting** | None | Upstash Redis |
| **Error Tracking** | None | Sentry |
| **Uptime Monitoring** | None | UptimeRobot |
| **Backups** | None | Daily (Supabase Pro) |
| **Transactional Email** | None | Resend |
| **File Storage** | Unclear | Cloudflare R2 |
| **DDoS Protection** | Basic | Cloudflare |
| **Legal Pages** | None | Privacy + Terms + Cookies |
| **Audit Logging** | None | Complete admin audit trail |
| **i18n** | None | Foundation ready |
| **Payment Abstraction** | Hardcoded | Provider interface |
| **Encryption** | None | Sensitive data encrypted |
| **Timeline** | 4 weeks | 5 weeks |

## Monthly Cost (Production)

| Item | Cost |
|------|------|
| Supabase Pro | $25 |
| Cloudflare | $0 |
| Netlify | $0 |
| R2 Storage | $0 |
| Resend | $0 |
| Sentry | $0 |
| UptimeRobot | $0 |
| Domain | ~$1.25 |
| **TOTAL** | **~$26.25/mo** |

## Risk Level After v4

| Risk | Before | After |
|------|--------|-------|
| Payment fraud | 🔴 HIGH | 🟢 LOW |
| Data loss | 🔴 HIGH | 🟢 LOW |
| Downtime unnoticed | 🔴 HIGH | 🟢 LOW |
| Production errors | 🔴 HIGH | 🟢 LOW |
| Legal issues | 🟠 MEDIUM | 🟢 LOW |
| Scaling blockers | 🟠 MEDIUM | 🟢 LOW |

---

# NEXT STEPS

1. **Sign up for services**:
   - [ ] Supabase Pro ($25/mo)
   - [ ] Cloudflare (free)
   - [ ] Sentry (free)
   - [ ] Resend (free)
   - [ ] UptimeRobot (free)
   - [ ] Upstash Redis (free)
   - [ ] CamPay

2. **Prepare content**:
   - [ ] Write privacy policy
   - [ ] Write terms of service
   - [ ] Gather sample songs
   - [ ] Professional photos

3. **Start building**:
   - [ ] Initialize repository
   - [ ] Set up CI/CD
   - [ ] Begin Week 1 tasks

---

**This plan is now production-ready. All critical security gaps have been addressed, monitoring is in place, and the architecture supports growth.**
