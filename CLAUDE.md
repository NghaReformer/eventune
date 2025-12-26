# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

**Eventune Studios** is a personalized music/custom songs business targeting both international (USD) and Cameroon (XAF) markets. This repository currently contains business planning documentation and will evolve into a production website.

**Current State**: Pre-development planning phase (documentation only, no code yet)

## Planned Tech Stack

When development begins, the stack will be:

- **Frontend**: Astro + Tailwind CSS + TypeScript
- **Backend**: Supabase Pro (PostgreSQL + Auth + Edge Functions + RLS)
- **Hosting**: Netlify + Cloudflare (CDN/DDoS protection)
- **Payments**: Stripe (USD) + CamPay (XAF) via abstracted payment provider pattern
- **File Storage**: Cloudflare R2 (audio files, S3-compatible)
- **Email**: Resend (transactional)
- **Monitoring**: Sentry (errors) + UptimeRobot (uptime)

## Development Commands (Once Initialized)

```bash
# Initialize Astro project
npm create astro@latest

# Install dependencies
npm install

# Development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Key Documentation Files

| File | Purpose |
|------|---------|
| `eventune-website-development-plan.md` | Complete technical architecture, database schema, security implementation |
| `eventune-90-day-action-plan.md` | Week-by-week execution timeline with deliverables |
| `eventune-brand-guide.md` | Visual identity (colors, typography, service packages, pricing) |
| `eventune-studios-business-plan.md` | Market analysis, target personas, marketing strategy |
| `eventune-gap-analysis.md` | Security/operational risks with code solutions |

## Architecture Guidelines

### Payment Abstraction Pattern
The codebase uses an abstracted payment provider interface to support multiple payment gateways:
- `StripeProvider` for international USD payments
- `CamPayProvider` for Cameroon XAF payments (mobile money)
- Designed for future expansion (e.g., PaystackProvider for Nigeria)

### Security Requirements
- Rate limiting on auth endpoints (Upstash Redis)
- Webhook signature verification for all payment providers
- Payment idempotency to prevent duplicate charges
- Row Level Security (RLS) on all Supabase tables
- Admin 2FA and audit logging
- CSP and security headers via Cloudflare

### Dual Market Considerations
All features must support both markets:
- **International**: USD pricing, Stripe payments, English
- **Cameroon**: XAF pricing, CamPay/mobile money, French option
- Currency and locale should be detected/selectable

## Brand Colors

```css
--color-bg-primary: #0A0A0A;     /* Rich Black */
--color-accent: #D4AF37;          /* Gold */
--color-text-primary: #F5F5F5;    /* Off-white */
```

## Service Packages

| Package | USD | XAF |
|---------|-----|-----|
| Express | $149 | 75,000 |
| Classic | $299 | 150,000 |
| Signature | $499 | 250,000 |
| Legacy | $799+ | 400,000+ |
