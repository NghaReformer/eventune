/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
  // Core
  readonly PUBLIC_SITE_URL: string;

  // Supabase
  readonly PUBLIC_SUPABASE_URL: string;
  readonly PUBLIC_SUPABASE_ANON_KEY: string;
  readonly SUPABASE_SERVICE_KEY: string;

  // Stripe
  readonly PUBLIC_STRIPE_KEY: string;
  readonly STRIPE_SECRET_KEY: string;
  readonly STRIPE_WEBHOOK_SECRET: string;

  // CamPay
  readonly CAMPAY_USERNAME: string;
  readonly CAMPAY_PASSWORD: string;
  readonly CAMPAY_WEBHOOK_SECRET: string;
  readonly CAMPAY_ENV: 'demo' | 'prod';

  // R2
  readonly R2_ACCOUNT_ID: string;
  readonly R2_ACCESS_KEY_ID: string;
  readonly R2_SECRET_ACCESS_KEY: string;
  readonly R2_BUCKET_NAME: string;
  readonly R2_PUBLIC_DOMAIN: string;

  // Email
  readonly RESEND_API_KEY: string;

  // Security
  readonly ENCRYPTION_KEY: string;
  readonly UPSTASH_REDIS_URL: string;
  readonly UPSTASH_REDIS_TOKEN: string;

  // Monitoring
  readonly PUBLIC_SENTRY_DSN: string;
  readonly PUBLIC_GA_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
