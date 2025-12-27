/**
 * Site Configuration
 * URLs, social links, contact info
 * Changes require code deploy
 */

export const siteConfig = {
  url: import.meta.env.PUBLIC_SITE_URL || 'https://eventunestudios.com',
  domain: 'eventunestudios.com',

  social: {
    instagram: 'https://instagram.com/eventunestudios',
    tiktok: 'https://tiktok.com/@eventunestudios',
    twitter: 'https://x.com/eventunestudios',
    youtube: 'https://youtube.com/@eventunestudios',
    facebook: 'https://facebook.com/eventunestudios',
    whatsapp: '+237XXXXXXXXX', // Update with real number
  },

  contact: {
    email: 'hello@eventunestudios.com',
    general: 'hello@eventunestudios.com',
    orders: 'orders@eventunestudios.com',
    support: 'support@eventunestudios.com',
    privacy: 'privacy@eventunestudios.com',
    legal: 'legal@eventunestudios.com',
  },

  seo: {
    defaultTitle: 'Eventune Studios | Custom Songs for Special Moments',
    titleTemplate: '%s | Eventune Studios',
    defaultDescription:
      'Professional custom songs for weddings, birthdays, anniversaries, and special celebrations. Your event deserves its own tune.',
    keywords: [
      'custom songs',
      'personalized music',
      'wedding song',
      'birthday song',
      'anniversary song',
      'afrobeat',
      'custom music',
    ],
    locale: 'en_US',
    type: 'website',
  },

  legal: {
    companyName: 'Eventune Studios',
    foundedYear: 2024,
    privacyPolicyUrl: '/legal/privacy-policy',
    termsUrl: '/legal/terms',
    refundPolicyUrl: '/legal/refunds',
    cookiePolicyUrl: '/legal/cookies',
  },

  features: {
    enableBlog: true,
    enableTestimonials: true,
    enableFAQ: true,
    enableSamples: true,
    enableReferralProgram: false, // Enable in Phase 2
    enableSMS: import.meta.env.PUBLIC_SMS_ENABLED === 'true', // Controlled by env var
    maintenanceMode: false,
  },
} as const;

export type SiteConfig = typeof siteConfig;
