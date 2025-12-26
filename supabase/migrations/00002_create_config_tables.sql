-- ============================================
-- CONFIGURATION TABLES
-- Dynamic business logic - no hardcoding
-- ============================================

-- Packages with pricing
CREATE TABLE config_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,

  -- Pricing (multi-currency)
  price_usd DECIMAL(10, 2) NOT NULL,
  price_xaf DECIMAL(10, 0) NOT NULL,

  -- Features
  song_length_min INT NOT NULL DEFAULT 2,
  song_length_max INT NOT NULL DEFAULT 3,
  includes_discovery_call BOOLEAN DEFAULT FALSE,
  revision_count INT DEFAULT 0,
  includes_instrumental BOOLEAN DEFAULT FALSE,
  includes_full_rights BOOLEAN DEFAULT FALSE,

  -- Delivery
  delivery_days_min INT NOT NULL DEFAULT 5,
  delivery_days_max INT NOT NULL DEFAULT 7,

  -- Display
  display_order INT NOT NULL DEFAULT 0,
  is_popular BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Occasions
CREATE TABLE config_occasions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  tagline TEXT,
  icon TEXT,

  -- SEO
  meta_title TEXT,
  meta_description TEXT,

  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment Methods
CREATE TABLE config_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  method_type TEXT NOT NULL,
  display_name TEXT NOT NULL,

  -- Availability
  currencies TEXT[] NOT NULL,
  countries TEXT[],

  -- Fees (for display)
  fee_percentage DECIMAL(5, 2),
  fee_fixed DECIMAL(10, 2),

  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(provider, method_type)
);

-- Order Status Workflow
CREATE TABLE config_order_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,

  -- Workflow
  next_statuses TEXT[] DEFAULT '{}',
  requires_admin BOOLEAN DEFAULT FALSE,

  -- Notifications
  send_email BOOLEAN DEFAULT TRUE,
  email_template TEXT,

  -- Display
  color TEXT DEFAULT '#666666',
  icon TEXT,
  display_order INT NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Capacity Limits
CREATE TABLE config_capacity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE UNIQUE NOT NULL,
  max_orders INT DEFAULT 3,
  current_orders INT DEFAULT 0,
  is_blackout BOOLEAN DEFAULT FALSE,
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Refund Policies
CREATE TABLE config_refund_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status_slug TEXT NOT NULL,
  refund_percentage INT NOT NULL CHECK (refund_percentage >= 0 AND refund_percentage <= 100),
  description TEXT NOT NULL,
  requires_manual_review BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(status_slug)
);

-- Testimonials
CREATE TABLE config_testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT NOT NULL,
  customer_location TEXT,
  occasion TEXT,
  quote TEXT NOT NULL,
  rating INT CHECK (rating >= 1 AND rating <= 5),

  -- Media
  image_url TEXT,
  video_url TEXT,

  display_order INT DEFAULT 0,
  is_featured BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- FAQ Items
CREATE TABLE config_faq (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category TEXT,

  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,

  -- i18n
  locale TEXT DEFAULT 'en',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sample Songs (Portfolio)
CREATE TABLE config_samples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  occasion_slug TEXT REFERENCES config_occasions(slug),
  style TEXT,
  description TEXT,

  -- Media
  audio_url TEXT NOT NULL,
  cover_image_url TEXT,
  duration_seconds INT,

  display_order INT NOT NULL DEFAULT 0,
  is_featured BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Site Settings (key-value for misc settings)
CREATE TABLE config_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users
);

-- Comments
COMMENT ON TABLE config_packages IS 'Service packages with pricing - no hardcoding';
COMMENT ON TABLE config_occasions IS 'Event occasions for ordering';
COMMENT ON TABLE config_payment_methods IS 'Available payment methods per currency/country';
COMMENT ON TABLE config_order_statuses IS 'Order status workflow configuration';
COMMENT ON TABLE config_capacity IS 'Daily order capacity limits';
COMMENT ON TABLE config_refund_policies IS 'Refund rules per order status';
COMMENT ON TABLE config_testimonials IS 'Customer testimonials for display';
COMMENT ON TABLE config_faq IS 'FAQ items with i18n support';
COMMENT ON TABLE config_samples IS 'Portfolio sample songs';
COMMENT ON TABLE config_settings IS 'Miscellaneous site settings';
