-- Migration: Add video support to testimonials
-- Date: 2025-12-27
-- Description: Adds video_url, video_source_type, and image_url columns to config_testimonials

-- Add new columns for video testimonials
ALTER TABLE config_testimonials
ADD COLUMN IF NOT EXISTS video_url TEXT,
ADD COLUMN IF NOT EXISTS video_source_type TEXT DEFAULT 'youtube' CHECK (video_source_type IN ('youtube', 'vimeo', 'direct')),
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Migrate existing avatar_url data to image_url
UPDATE config_testimonials
SET image_url = avatar_url
WHERE image_url IS NULL AND avatar_url IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN config_testimonials.video_url IS 'URL to video testimonial (YouTube, Vimeo, or direct link)';
COMMENT ON COLUMN config_testimonials.video_source_type IS 'Type of video source: youtube, vimeo, or direct';
COMMENT ON COLUMN config_testimonials.image_url IS 'URL to customer photo/avatar';

-- Optional: You may want to deprecate avatar_url column in future
-- COMMENT ON COLUMN config_testimonials.avatar_url IS 'DEPRECATED: Use image_url instead';
