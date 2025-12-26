/**
 * Brand Configuration
 * Static brand identity - colors, fonts, logos
 * Changes require code deploy
 */

export const brandConfig = {
  name: 'Eventune Studios',
  tagline: 'Your Event. Your Tune.',
  domain: 'eventunestudios.com',

  colors: {
    primary: {
      black: '#0A0A0A',
      cardBlack: '#141414',
      hoverBlack: '#1A1A1A',
    },
    accent: {
      gold: '#D4AF37',
      goldHover: '#E5C158',
      goldMuted: '#B8962E',
    },
    text: {
      primary: '#F5F5F5',
      secondary: '#A0A0A0',
      muted: '#666666',
    },
    status: {
      success: '#22C55E',
      warning: '#EAB308',
      error: '#EF4444',
      info: '#3B82F6',
    },
  },

  fonts: {
    heading: {
      family: 'Playfair Display',
      weights: ['600', '700'] as const,
    },
    body: {
      family: 'Inter',
      weights: ['400', '500'] as const,
    },
  },

  logo: {
    full: '/images/logo-full.svg',
    icon: '/images/logo-icon.svg',
    favicon: '/favicon.ico',
  },

  images: {
    ogDefault: '/images/og-default.jpg',
    heroBackground: '/images/hero-bg.jpg',
  },
} as const;

export type BrandConfig = typeof brandConfig;
export type BrandColors = typeof brandConfig.colors;
