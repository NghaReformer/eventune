# EVENTUNE STUDIOS WEBSITE PLAN
## Critical Gap Analysis & Risk Assessment

---

# EXECUTIVE SUMMARY

This document provides an honest, critical analysis of the v3 website plan, identifying gaps, risks, and blockers that could impact launch, scaling, security, and long-term success.

**Overall Assessment**: The plan is solid for MVP launch but has significant gaps in:
- Security hardening
- Payment edge cases
- Scalability architecture
- Legal/compliance
- Operational resilience
- International expansion readiness

**Risk Level**: MEDIUM-HIGH for production without addressing these gaps.

---

# SECTION 1: SECURITY VULNERABILITIES

## 1.1 Authentication & Authorization Gaps

### CRITICAL: No Rate Limiting on Auth Endpoints

**Gap**: The plan doesn't mention rate limiting for login/signup.

**Risk**: 
- Brute force attacks on customer accounts
- Credential stuffing attacks
- Account enumeration

**Impact**: HIGH - Attackers can compromise customer accounts.

**Solution**:
```javascript
// Add to Netlify Functions or use Supabase's built-in rate limiting
// Supabase has some built-in protection but it's basic

// Custom rate limiting with Upstash Redis (free tier)
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, "60 s"), // 5 attempts per minute
});
```

**Added Cost**: Upstash free tier (10,000 requests/day) or $0.20/100k requests

---

### CRITICAL: No Session Management Strategy

**Gap**: Plan uses Supabase Auth but doesn't address:
- Session timeout policy
- Concurrent session limits
- Session revocation on password change
- Device tracking

**Risk**: Stolen sessions remain valid indefinitely.

**Solution**:
- Set JWT expiry to 1 hour (not default 1 week)
- Implement refresh token rotation
- Add "Log out all devices" feature

---

### HIGH: Admin Access Not Hardened

**Gap**: Admin is just a boolean flag in database (`is_admin = true`).

**Risks**:
- No audit logging of admin actions
- No 2FA requirement for admin
- No IP restriction for admin panel
- Single point of failure if admin account compromised

**Solution**:
```sql
-- Add admin audit log
CREATE TABLE admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES auth.users,
  action TEXT NOT NULL,
  target_type TEXT, -- 'order', 'customer', 'settings'
  target_id UUID,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 1.2 Payment Security Gaps

### CRITICAL: CamPay Webhook Verification Missing

**Gap**: The webhook handler doesn't verify that requests actually come from CamPay.

**Current Code (INSECURE)**:
```javascript
// Anyone can POST fake payment confirmations!
export async function handler(event) {
  const payload = JSON.parse(event.body);
  if (payload.status === 'SUCCESSFUL') {
    // Updates order as paid - DANGEROUS
  }
}
```

**Risk**: Attackers can send fake webhook calls to mark orders as paid without paying.

**Impact**: CRITICAL - Direct financial loss.

**Solution**:
```javascript
// Verify webhook signature or use secret token
export async function handler(event) {
  // Option 1: Check shared secret in header
  const webhookSecret = event.headers['x-campay-signature'];
  if (webhookSecret !== process.env.CAMPAY_WEBHOOK_SECRET) {
    return { statusCode: 401, body: 'Unauthorized' };
  }
  
  // Option 2: Verify by calling CamPay API to confirm transaction
  const isValid = await verifyCamPayTransaction(payload.reference);
  if (!isValid) {
    return { statusCode: 400, body: 'Invalid transaction' };
  }
  
  // Now safe to process
}
```

---

### HIGH: No Idempotency on Payment Webhooks

**Gap**: Webhooks can be delivered multiple times. No duplicate handling.

**Risk**: 
- Order marked as paid multiple times
- Duplicate confirmation emails
- Incorrect revenue tracking

**Solution**:
```javascript
// Check if already processed
const { data: existing } = await supabase
  .from('orders')
  .select('status, payment_reference')
  .eq('payment_reference', payload.reference)
  .single();

if (existing?.status === 'paid') {
  console.log('Already processed, skipping');
  return { statusCode: 200, body: 'Already processed' };
}
```

---

### HIGH: Payment Amount Not Verified

**Gap**: Plan doesn't verify that the amount paid matches the order amount.

**Risk**: Customer could manipulate payment to pay less than expected.

**Solution**:
```javascript
// Always verify amount
const order = await getOrder(payload.external_reference);
if (payload.amount !== order.amount_expected) {
  await logSuspiciousActivity(payload);
  return { statusCode: 400, body: 'Amount mismatch' };
}
```

---

### MEDIUM: No Payment Timeout Handling

**Gap**: What happens if customer initiates Mobile Money but never confirms?

**Risks**:
- Order stuck in "pending" forever
- Customer confusion
- Inventory/capacity issues (if tracking)

**Solution**:
- Implement 15-minute payment timeout
- Auto-cancel unpaid orders after timeout
- Send reminder before timeout

---

## 1.3 Data Security Gaps

### HIGH: No Encryption at Rest Strategy

**Gap**: Sensitive data in Supabase isn't encrypted beyond default.

**Sensitive fields NOT encrypted**:
- Customer phone numbers
- Questionnaire responses (personal stories)
- Payment references

**Risk**: Database breach exposes sensitive personal information.

**Solution**:
- Encrypt sensitive fields before storing
- Use Supabase Vault (requires Pro plan) or client-side encryption

---

### HIGH: No PII Handling Policy

**Gap**: No strategy for:
- Data retention limits
- Right to deletion (GDPR)
- Data export on request
- Anonymization of old orders

**Risk**: Legal liability under GDPR (EU customers) and potential data regulations.

**Solution**:
```sql
-- Add soft delete and anonymization
ALTER TABLE customers ADD COLUMN deleted_at TIMESTAMP;
ALTER TABLE customers ADD COLUMN anonymized_at TIMESTAMP;

-- Anonymization function
CREATE FUNCTION anonymize_customer(customer_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE profiles SET
    full_name = 'Deleted User',
    email = 'deleted-' || customer_uuid || '@anonymized.local',
    phone = NULL,
    anonymized_at = NOW()
  WHERE id = customer_uuid;
END;
$$ LANGUAGE plpgsql;
```

---

### MEDIUM: API Keys in Environment Variables Only

**Gap**: All secrets in plain environment variables.

**Risk**: 
- Leaked in logs if not careful
- Visible to anyone with Netlify access
- No rotation strategy

**Solution**:
- Use Netlify's encrypted environment variables (already available)
- Implement secret rotation schedule
- Never log request bodies containing tokens

---

## 1.4 Infrastructure Security Gaps

### MEDIUM: No WAF/DDoS Protection

**Gap**: Netlify free tier has basic protection but no advanced WAF.

**Risks**:
- DDoS attack takes site offline
- SQL injection attempts (though Supabase mitigates)
- XSS attacks

**Solution**:
- Cloudflare free tier in front of Netlify (adds DDoS protection)
- Implement Content Security Policy headers
- Add security headers:

```javascript
// netlify.toml
[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    X-XSS-Protection = "1; mode=block"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Content-Security-Policy = "default-src 'self'; script-src 'self' 'unsafe-inline' https://js.stripe.com; style-src 'self' 'unsafe-inline';"
```

---

### MEDIUM: No Dependency Vulnerability Scanning

**Gap**: No mention of npm audit, Dependabot, or security scanning.

**Risk**: Vulnerable dependencies in production.

**Solution**:
- Enable GitHub Dependabot
- Run `npm audit` in CI/CD
- Use Snyk (free for open source)

---

# SECTION 2: SCALABILITY BLOCKERS

## 2.1 Database Scalability

### HIGH: Supabase Free Tier Limitations

**Current Limits**:
| Resource | Limit | Problem |
|----------|-------|---------|
| Database | 500 MB | Will fill with order history + questionnaires |
| Connections | 60 | Could bottleneck under load |
| Pause after 7 days | Yes | Business-critical site goes down |

**Projection**: At 50 orders/month with questionnaires (avg 5KB each):
- Orders: ~2.5 KB × 50 = 125 KB/month
- Questionnaires: ~5 KB × 50 = 250 KB/month
- Status history: ~1 KB × 50 × 5 = 250 KB/month
- **Total**: ~625 KB/month = ~7.5 MB/year

**You'll hit 500 MB in ~66 years at this rate** — actually fine for database.

**REAL PROBLEM**: The 7-day pause rule. Your production site's database going to sleep is unacceptable.

**Solution**: 
- Budget $25/month for Supabase Pro from day 1, OR
- Implement aggressive keep-alive (but this is hacky)

---

### MEDIUM: No Database Indexing Strategy

**Gap**: No indexes defined for common queries.

**Missing indexes**:
```sql
-- Orders by customer (for portal)
CREATE INDEX idx_orders_customer ON orders(customer_id);

-- Orders by status (for admin filtering)
CREATE INDEX idx_orders_status ON orders(status);

-- Orders by date (for reporting)
CREATE INDEX idx_orders_created ON orders(created_at DESC);

-- Orders by payment reference (for webhook lookup)
CREATE INDEX idx_orders_payment_ref ON orders(payment_reference);
CREATE INDEX idx_orders_campay_ref ON orders(campay_reference);
```

**Impact**: Slow queries as data grows.

---

### MEDIUM: No Caching Strategy

**Gap**: Every page load queries Supabase.

**Missing**:
- Static page caching (Netlify does this)
- API response caching
- Client-side caching for user data

**Solution**:
- Use Netlify's built-in CDN caching for static assets
- Add `stale-while-revalidate` headers
- Implement React Query or SWR for client-side caching

---

## 2.2 File/Media Scalability

### HIGH: No Audio File Strategy

**Gap**: Plan mentions audio samples but no hosting strategy.

**Questions unanswered**:
- Where are sample audio files hosted?
- Where are delivered songs stored?
- How are large files served efficiently?

**Current implicit approach**: YouTube embeds + direct file links

**Problems**:
- YouTube: Can be taken down, ads, not your platform
- Direct files on Netlify: 100MB site limit, slow

**Solution Options**:

| Option | Pros | Cons | Cost |
|--------|------|------|------|
| **Cloudflare R2** | Fast, cheap, S3-compatible | Setup complexity | $0 for 10GB/month |
| **Backblaze B2** | Very cheap | Less edge locations | $0 for 10GB |
| **Supabase Storage** | Integrated | Counts against limits | Included (1GB free) |
| **Bunny CDN** | Fast, cheap, simple | Another service | $0.01/GB |

**Recommendation**: Cloudflare R2 for audio files (10GB free, then $0.015/GB).

---

### MEDIUM: No Image Optimization

**Gap**: No mention of image optimization pipeline.

**Risks**:
- Slow page loads
- High bandwidth usage
- Poor mobile experience

**Solution**:
- Use Astro's built-in image optimization
- Add `@astrojs/image` integration
- Use WebP format with fallbacks
- Implement lazy loading

```javascript
// astro.config.mjs
import image from '@astrojs/image';

export default {
  integrations: [image({
    serviceEntryPoint: '@astrojs/image/sharp'
  })]
}
```

---

## 2.3 Code/Architecture Scalability

### MEDIUM: Monolithic Netlify Functions

**Gap**: All serverless functions in one repo.

**Current structure**:
```
netlify/functions/
├── stripe-webhook.js
├── campay-token.js
├── campay-collect.js
├── campay-status.js
└── campay-webhook.js
```

**Problems as you scale**:
- All functions share cold start
- Can't scale functions independently
- Hard to test in isolation

**Solution** (when needed):
- Split into separate services
- Use Supabase Edge Functions for some logic
- Consider Cloudflare Workers for latency-sensitive operations

---

### LOW: No API Versioning

**Gap**: APIs have no versioning strategy.

**Risk**: Breaking changes affect existing integrations.

**Solution** (for later):
```
/api/v1/orders
/api/v2/orders  // When you need breaking changes
```

---

# SECTION 3: PERFORMANCE ISSUES

## 3.1 Frontend Performance

### HIGH: No Performance Budget

**Gap**: No defined performance targets.

**Recommended targets**:
| Metric | Target | Why |
|--------|--------|-----|
| First Contentful Paint | < 1.5s | User perceives speed |
| Largest Contentful Paint | < 2.5s | Google Core Web Vital |
| Time to Interactive | < 3.5s | Usability |
| Cumulative Layout Shift | < 0.1 | Visual stability |
| Total Page Size | < 1MB | Mobile users |

**Solution**:
- Set up Lighthouse CI in GitHub Actions
- Monitor with Web Vitals

---

### MEDIUM: Audio Player Performance

**Gap**: Custom audio player loading strategy not defined.

**Risks**:
- Loading all audio files on samples page = slow
- No preload strategy
- No streaming for large files

**Solution**:
```html
<!-- Lazy load audio -->
<audio preload="none" data-src="/audio/sample1.mp3">
  <!-- Load on play click -->
</audio>

<!-- For streaming, use HLS or range requests -->
```

---

### MEDIUM: Third-Party Script Bloat

**Gap**: Many third-party integrations not optimized.

**Current third-party scripts**:
- Stripe.js
- Calendly embed
- Tally.so embed
- Google Analytics
- Mailchimp form
- WhatsApp widget

**Each script**:
- Adds 50-200KB
- Creates network requests
- Blocks main thread

**Solution**:
- Lazy load non-critical scripts
- Use `async` and `defer`
- Load Calendly/Tally on demand, not page load

```javascript
// Load Calendly only when user clicks booking button
function loadCalendly() {
  const script = document.createElement('script');
  script.src = 'https://assets.calendly.com/assets/external/widget.js';
  document.head.appendChild(script);
}
```

---

## 3.2 API Performance

### MEDIUM: N+1 Query Problem Potential

**Gap**: No guidance on efficient data fetching.

**Example problem**:
```javascript
// BAD: N+1 queries
const orders = await supabase.from('orders').select('*');
for (const order of orders) {
  const customer = await supabase.from('profiles').select('*').eq('id', order.customer_id);
  // This creates N additional queries!
}
```

**Solution**:
```javascript
// GOOD: Single query with join
const orders = await supabase
  .from('orders')
  .select(`
    *,
    profiles (full_name, email)
  `);
```

---

### MEDIUM: No Pagination

**Gap**: Order lists have no pagination strategy.

**Risk**: Admin dashboard loading 10,000 orders = crash.

**Solution**:
```javascript
// Always paginate
const { data, count } = await supabase
  .from('orders')
  .select('*', { count: 'exact' })
  .range(0, 19)  // First 20
  .order('created_at', { ascending: false });
```

---

# SECTION 4: OPERATIONAL GAPS

## 4.1 Monitoring & Observability

### CRITICAL: No Error Tracking

**Gap**: No error monitoring service.

**Risk**: 
- Bugs in production go unnoticed
- Customer-facing errors not captured
- No context for debugging

**Solution**:
- **Sentry** (free tier: 5,000 events/month)
- Or **LogRocket** (free tier: 1,000 sessions/month)

```javascript
// Add to Astro
import * as Sentry from "@sentry/astro";

Sentry.init({
  dsn: "YOUR_SENTRY_DSN",
  tracesSampleRate: 0.1,
});
```

---

### HIGH: No Uptime Monitoring

**Gap**: No alert if site goes down.

**Risk**: Site down for hours before you notice.

**Solution**:
- **UptimeRobot** (free: 50 monitors, 5-min checks)
- **Better Uptime** (free tier available)
- Set up alerts for:
  - Main site
  - Supabase API
  - Payment endpoints

---

### HIGH: No Log Aggregation

**Gap**: Logs scattered across:
- Netlify function logs (7 days retention)
- Supabase logs
- Stripe dashboard
- CamPay dashboard

**Risk**: Debugging production issues = nightmare.

**Solution**:
- **LogDNA** / **Papertrail** (free tiers available)
- Or use structured logging to a central place

---

### MEDIUM: No Performance Monitoring

**Gap**: No tracking of:
- API response times
- Database query times
- Payment success rates

**Solution**:
- Supabase has basic metrics (Pro plan)
- Add custom metrics to Sentry or Datadog

---

## 4.2 Backup & Recovery

### CRITICAL: No Backup Strategy (Free Tier)

**Gap**: Supabase Free has NO backups.

**Risk**: Database corruption/deletion = total data loss.

**Impact**: CATASTROPHIC

**Solutions**:

| Option | Cost | Frequency |
|--------|------|-----------|
| Upgrade to Supabase Pro | $25/month | Daily automatic |
| Manual pg_dump scripts | $0 | Manual/scheduled |
| Supabase CLI backup | $0 | Manual |

**Minimum viable backup**:
```bash
# Run weekly via GitHub Action
supabase db dump --project-ref YOUR_PROJECT > backup_$(date +%Y%m%d).sql
# Upload to Cloudflare R2 or Google Drive
```

---

### HIGH: No Disaster Recovery Plan

**Gap**: What happens if:
- Supabase goes down?
- Netlify goes down?
- CamPay goes down?
- Stripe goes down?

**No answers in plan for**:
- Failover procedures
- Communication plan
- Recovery time objectives (RTO)
- Recovery point objectives (RPO)

**Minimum Solution**:
- Document manual fallback procedures
- Have backup payment method (manual bank transfer)
- Status page for customers
- Email templates for outage communication

---

## 4.3 Deployment & DevOps

### MEDIUM: No CI/CD Pipeline Defined

**Gap**: Deployment strategy not specified.

**Implied approach**: Push to main → Netlify auto-deploys

**Missing**:
- Staging environment
- Automated tests before deploy
- Rollback procedure
- Database migration strategy

**Solution**:
```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm ci
      - run: npm run test
      - run: npm run build
      
  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - run: netlify deploy --prod
```

---

### MEDIUM: No Database Migration Strategy

**Gap**: How to update database schema safely?

**Risk**: Breaking changes to production database.

**Solution**:
- Use Supabase migrations
- Never modify production directly
- Test migrations on staging first

```bash
# Create migration
supabase migration new add_new_column

# Apply locally
supabase db reset

# Push to production (with caution)
supabase db push
```

---

# SECTION 5: BUSINESS/OPERATIONAL GAPS

## 5.1 Payment Operations

### HIGH: No Refund Flow

**Gap**: Plan doesn't address:
- How to process refunds (Stripe + CamPay)
- Partial refunds
- Refund policies
- Accounting for refunds

**CamPay Refund Reality**: 
- May require manual transfer back
- Not automatic like Stripe

**Solution**:
- Define refund policy clearly
- Build admin UI for initiating refunds
- Track refunds in database

```sql
ALTER TABLE orders ADD COLUMN refund_status TEXT;
ALTER TABLE orders ADD COLUMN refund_amount DECIMAL;
ALTER TABLE orders ADD COLUMN refunded_at TIMESTAMP;
```

---

### HIGH: No Failed Payment Recovery

**Gap**: What happens when:
- Card declined
- Mobile Money insufficient funds
- Payment timeout

**No strategy for**:
- Retry logic
- Customer notification
- Abandoned cart recovery

**Solution**:
- Save order as "payment_failed"
- Send recovery email with retry link
- Implement 3-attempt limit
- Track failure reasons

---

### MEDIUM: No Invoice Generation

**Gap**: Customers may need invoices/receipts.

**Requirements**:
- PDF invoice generation
- Invoice numbering
- Tax compliance (if applicable)

**Solution**:
- Use a service like **Invoice Ninja** (free self-hosted)
- Or generate with **jsPDF** in serverless function

---

### MEDIUM: No Revenue Reconciliation

**Gap**: How to reconcile:
- Stripe payments vs. database
- CamPay payments vs. database
- Actual bank deposits vs. records

**Risk**: Money leaks, discrepancies unnoticed.

**Solution**:
- Weekly reconciliation report
- Automated comparison script
- Alert on mismatches

---

## 5.2 Customer Service

### MEDIUM: No Dispute Handling

**Gap**: What happens with chargebacks?

**Stripe chargebacks**: They handle it but you need evidence.
**CamPay disputes**: Unclear process.

**Solution**:
- Document clear terms of service
- Save all customer communications
- Store questionnaire as evidence of agreement

---

### LOW: No Customer Feedback Loop

**Gap**: No mechanism for:
- Post-delivery surveys
- NPS scores
- Review collection

**Solution**:
- Automated email after delivery
- Simple rating system
- Integration with Google Reviews

---

## 5.3 Capacity Management

### MEDIUM: No Order Capacity Limits

**Gap**: What if 100 orders come in on one day?

**You planned**: 12-18 songs/month capacity

**No mechanism for**:
- Limiting orders per period
- Waitlist when at capacity
- Dynamic pricing during high demand
- Blackout dates

**Solution**:
```sql
-- Track capacity
CREATE TABLE capacity_limits (
  date DATE PRIMARY KEY,
  max_orders INT DEFAULT 3,
  current_orders INT DEFAULT 0
);

-- Check before accepting order
SELECT * FROM capacity_limits 
WHERE date = CURRENT_DATE 
AND current_orders < max_orders;
```

---

# SECTION 6: LEGAL & COMPLIANCE GAPS

## 6.1 Privacy & Data Protection

### HIGH: No Privacy Policy

**Gap**: Plan doesn't mention privacy policy.

**Required by**:
- GDPR (EU customers)
- Various African data protection laws
- Common sense

**Must cover**:
- What data you collect
- How you use it
- Third parties (Stripe, CamPay, Supabase)
- Retention periods
- User rights

---

### HIGH: No Cookie Consent

**Gap**: Using Google Analytics = cookies = consent required.

**Risk**: GDPR violations (EU visitors).

**Solution**:
- Cookie consent banner
- Don't load GA until consent given
- Document cookie usage

---

### MEDIUM: No Terms of Service

**Gap**: No legal agreement with customers.

**Should cover**:
- Service description
- Payment terms
- Refund policy
- Intellectual property (who owns the song?)
- Limitations of liability
- Dispute resolution

---

## 6.2 Financial Compliance

### MEDIUM: Tax Handling Undefined

**Questions unanswered**:
- Do you charge VAT in Cameroon?
- Sales tax for US customers?
- Tax invoices required?

**Solution**:
- Consult local accountant
- Consider Stripe Tax for international
- Document tax handling in checkout

---

### MEDIUM: Currency Handling

**Gap**: XAF/USD conversion not addressed.

**Questions**:
- What exchange rate do you use?
- How often updated?
- Who bears currency risk?

**Solution**:
- Fix XAF prices (don't convert dynamically)
- Or use API like Open Exchange Rates

---

# SECTION 7: EXPANSION BLOCKERS

## 7.1 Multi-Language Readiness

### MEDIUM: No i18n Architecture

**You mentioned**: English + French eventually

**Current plan**: No i18n setup

**Blocking issues**:
- Hardcoded strings in components
- No translation file structure
- No language switcher UI
- URL structure not defined (/fr/ vs subdomain)

**Solution**:
```javascript
// Set up from day 1
// astro.config.mjs
export default defineConfig({
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'fr'],
    routing: {
      prefixDefaultLocale: false
    }
  }
});
```

---

## 7.2 Multi-Currency Expansion

### MEDIUM: Hardcoded Currency Logic

**Current**: USD (Stripe) + XAF (CamPay)

**What about**:
- Nigerian Naira (NGN)?
- Other African currencies?
- GBP for UK customers?

**Solution**: Design for currency abstraction now:
```typescript
interface PricingTier {
  package: string;
  prices: {
    USD: number;
    XAF: number;
    NGN?: number;
    GBP?: number;
  };
}
```

---

## 7.3 Multi-Country Payment Expansion

### HIGH: CamPay is Cameroon-Only

**Gap**: CamPay only works in Cameroon.

**For Nigeria expansion**:
- Need Paystack or Flutterwave
- Different integration
- Different KYC

**For other African countries**:
- Each country may need different provider

**Solution**: Abstract payment provider:
```typescript
interface PaymentProvider {
  name: string;
  country: string;
  currencies: string[];
  initiate(amount: number, phone: string): Promise<PaymentSession>;
  verify(reference: string): Promise<PaymentStatus>;
}

// Then implement
class CamPayProvider implements PaymentProvider { }
class PaystackProvider implements PaymentProvider { }
```

---

## 7.4 Team Scaling

### MEDIUM: Single Admin Architecture

**Gap**: Plan assumes you're the only admin.

**When you hire**:
- No role-based access control
- No permissions system
- Can't limit what team members can do

**Solution**:
```sql
CREATE TYPE admin_role AS ENUM ('super_admin', 'order_manager', 'support');

ALTER TABLE profiles ADD COLUMN admin_role admin_role;

-- Separate permissions table
CREATE TABLE role_permissions (
  role admin_role,
  permission TEXT,
  PRIMARY KEY (role, permission)
);
```

---

# SECTION 8: MISSING FEATURES

## 8.1 Critical Missing Features

| Feature | Impact | Effort to Add |
|---------|--------|---------------|
| **Email notifications** | Customers don't know status updates | Medium |
| **SMS notifications** | Cameroon customers prefer SMS | Medium |
| **Order status webhooks** | Can't integrate with other tools | Low |
| **Search functionality** | Admin can't find orders | Low |
| **Bulk actions** | Admin inefficiency | Medium |
| **Export data** | Reporting, accounting | Low |
| **Analytics dashboard** | No visibility into metrics | Medium |

---

## 8.2 Email System Gap

### HIGH: No Transactional Email System

**Gap**: Plan doesn't define how to send:
- Order confirmation
- Payment receipt
- Status updates
- Delivery notification

**Options**:

| Provider | Free Tier | Notes |
|----------|-----------|-------|
| **Resend** | 3,000/month | Modern, easy API |
| **SendGrid** | 100/day | Established |
| **Mailgun** | 5,000/month (3 months) | Reliable |
| **Postmark** | 100/month | Great deliverability |

**Solution**:
```javascript
// Add Resend integration
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

await resend.emails.send({
  from: 'Eventune <orders@eventunestudios.com>',
  to: customer.email,
  subject: 'Your Song Order Confirmation',
  html: emailTemplate
});
```

---

## 8.3 Notification Preferences

**Gap**: No customer preference management.

**Should allow**:
- Email on/off
- SMS on/off
- WhatsApp on/off
- Marketing consent

---

# SECTION 9: TECHNICAL DEBT RISKS

## 9.1 Future Technical Debt

| Decision | Potential Debt |
|----------|----------------|
| Astro (newer framework) | Less community support than Next.js |
| Decap CMS | May outgrow Git-based CMS |
| Supabase Free | Will need to migrate to Pro |
| Dual payment providers | More integration maintenance |
| Netlify Functions | Cold starts, may need edge functions |

---

## 9.2 Dependency Risks

| Dependency | Risk | Mitigation |
|------------|------|------------|
| Supabase | Vendor lock-in (Postgres helps) | Standard SQL, can migrate |
| CamPay | Small company, could shut down | Abstract payment layer |
| Netlify | Pricing changes | Astro deploys anywhere |
| Stripe | Low risk, industry standard | None needed |

---

# SECTION 10: PRIORITIZED ACTION ITEMS

## Must Have Before Launch (Blockers)

```
[ ] Webhook signature verification (CamPay)
[ ] Payment amount verification
[ ] Basic rate limiting on auth
[ ] Security headers configured
[ ] Privacy policy page
[ ] Terms of service page
[ ] Error tracking (Sentry)
[ ] Uptime monitoring
[ ] Transactional email system
[ ] Basic backup strategy
```

## Should Have First Month

```
[ ] Admin audit logging
[ ] Refund handling
[ ] Failed payment recovery emails
[ ] Cookie consent
[ ] Database indexes
[ ] Image optimization
[ ] Lazy loading third-party scripts
```

## Nice to Have (Month 2-3)

```
[ ] i18n foundation
[ ] SMS notifications
[ ] Analytics dashboard
[ ] Capacity management
[ ] Role-based admin access
[ ] Invoice generation
```

---

# SECTION 11: REVISED COST PROJECTION

## Realistic Production Costs

| Item | Free Tier | Recommended | Notes |
|------|-----------|-------------|-------|
| Supabase | $0 (pauses) | **$25/mo** | Don't risk pausing |
| Netlify | $0 | $0 | Free tier sufficient |
| Domain | $15/year | $15/year | Required |
| Error tracking (Sentry) | $0 | $0 | Free tier |
| Uptime monitoring | $0 | $0 | UptimeRobot free |
| Email (Resend) | $0 | $0 | 3,000/mo free |
| File storage (R2) | $0 | $0 | 10GB free |
| **TOTAL** | **$1.25/mo** | **$26.25/mo** | Recommended |

**Recommendation**: Budget $25-30/month for reliable production, not $0.

---

# SECTION 12: SUMMARY

## Critical Gaps (Fix Before Launch)

1. **Payment webhook security** — Can be exploited for free orders
2. **No backups** — Data loss risk
3. **No error tracking** — Blind to production issues
4. **No transactional emails** — Customers in the dark
5. **No legal pages** — Compliance risk

## High Priority Gaps (Fix Within 30 Days)

1. **Rate limiting** — Security vulnerability
2. **Uptime monitoring** — Won't know if site is down
3. **Refund handling** — Will have unhappy customers
4. **Admin audit logging** — No accountability

## Architecture Concerns (Plan For)

1. **Supabase Free tier pause** — Use Pro or accept risk
2. **CamPay only for Cameroon** — Limits expansion
3. **No i18n foundation** — Harder to add later
4. **Monolithic functions** — May need to split

## What the Plan Does Well

1. ✅ Good tech stack choices
2. ✅ Mobile-first approach
3. ✅ Dual payment system concept
4. ✅ Customer portal design
5. ✅ Realistic timeline
6. ✅ Clear information architecture

---

**Bottom Line**: The plan is a solid foundation but needs hardening before production. Address the critical gaps before launch, or accept significant risk.
