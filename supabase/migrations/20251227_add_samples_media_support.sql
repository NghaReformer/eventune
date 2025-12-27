/**
 * Migration: Add Media Support to Samples
 * Date: 2025-12-27
 *
 * Changes:
 * 1. Add audio_source_type column to config_samples (url or embed)
 * 2. Add cover_image_url column for sample thumbnails
 * 3. Add updated_at column for tracking changes
 * 4. Rename 'style' to 'genre' for clarity
 * 5. Seed new occasion categories
 */

-- Add new columns to config_samples
ALTER TABLE config_samples
ADD COLUMN IF NOT EXISTS audio_source_type TEXT DEFAULT 'url' CHECK (audio_source_type IN ('url', 'embed')),
ADD COLUMN IF NOT EXISTS cover_image_url TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS genre TEXT;

-- Migrate existing 'style' data to 'genre' if column exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'config_samples' AND column_name = 'style') THEN
    UPDATE config_samples SET genre = style WHERE genre IS NULL;
  END IF;
END $$;

-- Update existing samples to use 'url' type by default
UPDATE config_samples
SET audio_source_type = 'url'
WHERE audio_source_type IS NULL;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_config_samples_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS config_samples_updated_at ON config_samples;
CREATE TRIGGER config_samples_updated_at
  BEFORE UPDATE ON config_samples
  FOR EACH ROW
  EXECUTE FUNCTION update_config_samples_updated_at();

-- Add updated_at to config_occasions if not exists
ALTER TABLE config_occasions
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE OR REPLACE FUNCTION update_config_occasions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS config_occasions_updated_at ON config_occasions;
CREATE TRIGGER config_occasions_updated_at
  BEFORE UPDATE ON config_occasions
  FOR EACH ROW
  EXECUTE FUNCTION update_config_occasions_updated_at();

-- Seed new occasion categories
INSERT INTO config_occasions (slug, name, tagline, description, icon, meta_title, meta_description, display_order, is_active)
VALUES
  (
    'political-campaign',
    'Political Campaign',
    'Rally your supporters with a powerful campaign anthem',
    'Rally your supporters with a powerful campaign anthem that communicates your vision and values.',
    '🎤',
    'Political Campaign Songs | Custom Campaign Anthems',
    'Professional custom political campaign songs to rally supporters and communicate your vision',
    10,
    true
  ),
  (
    'marketing-promotion',
    'Marketing & Promotion',
    'Elevate your brand with custom jingles',
    'Elevate your brand with custom jingles and promotional songs that stick in customers'' minds.',
    '📢',
    'Marketing Jingles | Custom Promotional Songs',
    'Create memorable brand jingles and promotional music for your business',
    11,
    true
  ),
  (
    'gospel-worship',
    'Gospel & Worship',
    'Lift spirits and inspire faith',
    'Lift spirits and inspire faith with original gospel songs, praise anthems, and worship music.',
    '🙏',
    'Gospel Songs | Custom Worship Music',
    'Original gospel songs and worship music to inspire faith and lift spirits',
    12,
    true
  ),
  (
    'memorial-tribute',
    'Memorial & Tribute',
    'Honor loved ones with a beautiful tribute',
    'Honor loved ones with a beautiful tribute song that celebrates their life and legacy.',
    '🕊️',
    'Memorial Songs | Custom Tribute Music',
    'Beautiful memorial and tribute songs to honor and celebrate loved ones',
    13,
    true
  ),
  (
    'love-romance',
    'Love & Romance',
    'Express your deepest feelings through music',
    'Express your deepest feelings through music - proposals, Valentine''s, or romantic gestures.',
    '💝',
    'Romantic Songs | Custom Love Songs',
    'Custom romantic songs for proposals, Valentine''s Day, and special romantic moments',
    14,
    true
  ),
  (
    'baby-family',
    'Baby & Family',
    'Welcome new arrivals with custom songs',
    'Welcome new arrivals with custom lullabies, gender reveal songs, or pregnancy announcements.',
    '👶',
    'Baby Songs | Custom Family Music',
    'Custom lullabies and songs for pregnancy, gender reveals, and welcoming new babies',
    15,
    true
  ),
  (
    'corporate-events',
    'Corporate & Events',
    'Professional music for company events',
    'Professional music for company events, conferences, and brand experiences.',
    '🏢',
    'Corporate Event Music | Professional Business Songs',
    'Custom music for corporate events, conferences, and professional brand experiences',
    16,
    true
  ),
  (
    'retirement',
    'Retirement',
    'Celebrate a lifetime of achievement',
    'Celebrate a lifetime of achievement with a custom song honoring their career journey.',
    '🎖️',
    'Retirement Songs | Career Celebration Music',
    'Custom retirement songs to celebrate and honor career achievements',
    17,
    true
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  tagline = EXCLUDED.tagline,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  meta_title = EXCLUDED.meta_title,
  meta_description = EXCLUDED.meta_description,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_config_samples_occasion ON config_samples(occasion);
CREATE INDEX IF NOT EXISTS idx_config_samples_is_active ON config_samples(is_active);
CREATE INDEX IF NOT EXISTS idx_config_samples_is_featured ON config_samples(is_featured);
CREATE INDEX IF NOT EXISTS idx_config_occasions_slug ON config_occasions(slug);
CREATE INDEX IF NOT EXISTS idx_config_occasions_is_active ON config_occasions(is_active);

COMMENT ON COLUMN config_samples.audio_source_type IS 'Source type: url (external link) or embed (uploaded file)';
COMMENT ON COLUMN config_samples.cover_image_url IS 'Optional cover image/thumbnail for the sample';
COMMENT ON COLUMN config_samples.genre IS 'Music genre/style (e.g., Pop, R&B, Country)';
