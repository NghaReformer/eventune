-- ============================================
-- PRODUCT-BASED PRICING MIGRATION
-- Add video products, add-ons, and bundles
-- Update song tiers
-- ============================================

-- ============================================
-- 1. CREATE NEW TABLES
-- ============================================

-- Video Products (Lyric Videos & Music Videos)
CREATE TABLE IF NOT EXISTS config_video_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('lyric_video', 'music_video')),
  price_usd DECIMAL(10, 2) NOT NULL,
  price_xaf DECIMAL(10, 0) NOT NULL,
  delivery_days_additional INT DEFAULT 3,
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE config_video_products IS 'Video add-on products (lyric videos, music videos)';
COMMENT ON COLUMN config_video_products.delivery_days_additional IS 'Additional days added to base song delivery time';

-- Add-ons (Delivery, Revisions, Licenses, Extras, Physical)
CREATE TABLE IF NOT EXISTS config_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('delivery', 'revision', 'license', 'extra', 'physical')),
  price_type TEXT NOT NULL CHECK (price_type IN ('fixed', 'percentage')),
  price_usd DECIMAL(10, 2),
  price_xaf DECIMAL(10, 0),
  percentage DECIMAL(5, 2),
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_pricing CHECK (
    (price_type = 'fixed' AND price_usd IS NOT NULL AND price_xaf IS NOT NULL AND percentage IS NULL) OR
    (price_type = 'percentage' AND percentage IS NOT NULL AND price_usd IS NULL AND price_xaf IS NULL)
  )
);

COMMENT ON TABLE config_addons IS 'Add-on products for customization (rush delivery, extra revisions, licenses, etc.)';
COMMENT ON COLUMN config_addons.price_type IS 'Fixed price or percentage of base price';

-- Bundles (Multi-song discounts)
CREATE TABLE IF NOT EXISTS config_bundles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  song_count INT NOT NULL CHECK (song_count >= 2),
  discount_percentage DECIMAL(5, 2) NOT NULL CHECK (discount_percentage > 0 AND discount_percentage <= 100),
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE config_bundles IS 'Multi-song bundle discounts (EP, Album, etc.)';

-- ============================================
-- 2. ENABLE RLS ON NEW TABLES
-- ============================================

ALTER TABLE config_video_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE config_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE config_bundles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. CREATE RLS POLICIES (Public Read Access)
-- ============================================

-- Video Products
CREATE POLICY "Public can view active video products" ON config_video_products
  FOR SELECT USING (is_active = TRUE);

CREATE POLICY "Admins can manage video products" ON config_video_products
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.admin_role IS NOT NULL
    )
  );

-- Add-ons
CREATE POLICY "Public can view active addons" ON config_addons
  FOR SELECT USING (is_active = TRUE);

CREATE POLICY "Admins can manage addons" ON config_addons
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.admin_role IS NOT NULL
    )
  );

-- Bundles
CREATE POLICY "Public can view active bundles" ON config_bundles
  FOR SELECT USING (is_active = TRUE);

CREATE POLICY "Admins can manage bundles" ON config_bundles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.admin_role IS NOT NULL
    )
  );

-- ============================================
-- 4. UPDATE PACKAGES TO NEW SONG TIERS
-- ============================================

-- Clear existing packages
DELETE FROM config_packages;

-- Insert new song tiers
INSERT INTO config_packages (slug, name, description, price_usd, price_xaf, song_length_min, song_length_max, delivery_days_min, delivery_days_max, revision_count, includes_discovery_call, includes_instrumental, includes_full_rights, display_order, is_popular, is_active) VALUES
('quick-tune', 'Quick Tune', 'Perfect for short jingles, intros, or social media clips', 35.00, 17500, 0.5, 1, 5, 7, 1, FALSE, FALSE, FALSE, 1, FALSE, TRUE),
('single', 'Single', 'Our most popular option - a complete custom song for any occasion', 99.00, 50000, 2, 3, 7, 10, 1, FALSE, FALSE, FALSE, 2, TRUE, TRUE),
('extended', 'Extended', 'More time to tell your story with additional verses and detail', 159.00, 80000, 3, 4, 7, 10, 1, TRUE, FALSE, FALSE, 3, FALSE, TRUE),
('epic', 'Epic', 'The ultimate custom song experience with full production value', 219.00, 110000, 4, 5, 7, 10, 2, TRUE, TRUE, FALSE, 4, FALSE, TRUE);

-- ============================================
-- 5. SEED VIDEO PRODUCTS
-- ============================================

INSERT INTO config_video_products (slug, name, description, category, price_usd, price_xaf, delivery_days_additional, display_order) VALUES
('basic-lyric', 'Basic Lyric Video', 'Text animation with solid color backgrounds', 'lyric_video', 39.00, 20000, 2, 1),
('animated-lyric', 'Animated Lyric Video', 'Motion graphics with custom colors and transitions', 'lyric_video', 79.00, 40000, 3, 2),
('premium-lyric', 'Premium Lyric Video', 'Full animation with brand elements and effects', 'lyric_video', 149.00, 75000, 5, 3),
('slideshow-video', 'Slideshow Video', 'Your photos set to music with smooth transitions', 'music_video', 49.00, 25000, 2, 4),
('visual-story', 'Visual Story', 'Stock footage and effects telling your story', 'music_video', 149.00, 75000, 5, 5),
('custom-video', 'Custom Music Video', 'Original visuals with professional editing', 'music_video', 349.00, 175000, 10, 6);

-- ============================================
-- 6. SEED ADD-ONS
-- ============================================

INSERT INTO config_addons (slug, name, description, category, price_type, price_usd, price_xaf, percentage, display_order) VALUES
-- Delivery add-ons (percentage-based)
('rush-delivery', 'Rush Delivery (48-72h)', 'Get your song in 2-3 business days', 'delivery', 'percentage', NULL, NULL, 50.00, 1),
('express-delivery', 'Express Delivery (4-5 days)', 'Faster than standard delivery', 'delivery', 'percentage', NULL, NULL, 25.00, 2),

-- Revision add-ons (fixed price)
('extra-revision', 'Extra Revision', 'One additional revision round', 'revision', 'fixed', 25.00, 12500, NULL, 3),
('revision-pack', 'Revision Pack (3)', 'Three additional revision rounds - best value', 'revision', 'fixed', 59.00, 30000, NULL, 4),

-- Extra features (fixed price)
('instrumental-track', 'Instrumental Track', 'Karaoke version without vocals', 'extra', 'fixed', 29.00, 15000, NULL, 5),
('discovery-call', 'Discovery Call', '30-minute consultation to discuss your song', 'extra', 'fixed', 29.00, 15000, NULL, 6),

-- License add-ons (fixed price)
('commercial-license', 'Commercial License', 'Use your song for business purposes', 'license', 'fixed', 79.00, 40000, NULL, 7),
('full-ownership', 'Full Ownership Rights', 'Complete rights transfer to you', 'license', 'fixed', 149.00, 75000, NULL, 8),

-- Physical products (fixed price)
('physical-cd', 'Physical CD', 'Your song on a professionally printed CD', 'physical', 'fixed', 19.00, 10000, NULL, 9),
('vinyl-record', 'Vinyl Record', 'Premium vinyl pressing of your song', 'physical', 'fixed', 49.00, 25000, NULL, 10);

-- ============================================
-- 7. SEED BUNDLES
-- ============================================

INSERT INTO config_bundles (slug, name, description, song_count, discount_percentage, display_order) VALUES
('ep-bundle', 'EP Bundle', 'Perfect for a mini project or themed collection', 3, 15.00, 1),
('mini-album', 'Mini Album', 'Tell a bigger story with 5 custom songs', 5, 20.00, 2),
('full-album', 'Full Album', 'The complete package for serious projects', 10, 30.00, 3);

-- ============================================
-- 8. UPDATE FAQ FOR NEW PRICING
-- ============================================

-- Update existing FAQ entries
UPDATE config_faq
SET answer = 'Delivery times vary by song tier and add-ons: Quick Tune (5-7 days), Single (7-10 days), Extended (7-10 days), and Epic (7-10 days). Add rush delivery for faster turnaround. We''ll keep you updated throughout the process.'
WHERE question = 'How long does it take to receive my custom song?';

UPDATE config_faq
SET answer = 'Base packages include 1 revision. You can add extra revisions or revision packs as add-ons. Epic tier includes 2 revisions by default.'
WHERE question = 'Can I request revisions?';

-- Add new FAQ for product-based pricing
INSERT INTO config_faq (question, answer, category, display_order, locale) VALUES
('Can I add a video to my song?', 'Yes! We offer lyric videos (basic, animated, premium) and music videos (slideshow, visual story, custom). Add them during checkout or after ordering.', 'ordering', 9, 'en'),
('What are bundles?', 'Bundles let you order multiple songs at a discounted rate. Save 15% on 3 songs (EP Bundle), 20% on 5 songs (Mini Album), or 30% on 10 songs (Full Album).', 'ordering', 10, 'en'),
('Can I upgrade my song later?', 'Yes! You can add features like instrumental tracks, lyric videos, or commercial licenses even after your song is delivered. Contact us for assistance.', 'ordering', 11, 'en');

-- ============================================
-- 9. CREATE INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX idx_video_products_category ON config_video_products(category) WHERE is_active = TRUE;
CREATE INDEX idx_addons_category ON config_addons(category) WHERE is_active = TRUE;
CREATE INDEX idx_bundles_song_count ON config_bundles(song_count) WHERE is_active = TRUE;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
