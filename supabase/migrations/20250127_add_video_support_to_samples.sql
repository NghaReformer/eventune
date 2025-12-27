-- Migration: Add video support to config_samples table
-- Created: 2025-01-27
-- Description: Adds video_url and media_type columns to support both audio and video samples

-- Add video_url column (nullable for backward compatibility)
ALTER TABLE config_samples
ADD COLUMN IF NOT EXISTS video_url TEXT;

-- Add media_type column with default 'audio' for existing records
ALTER TABLE config_samples
ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT 'audio'
CHECK (media_type IN ('audio', 'video'));

-- Add comment to columns
COMMENT ON COLUMN config_samples.video_url IS 'URL for video content (YouTube, Vimeo, etc.)';
COMMENT ON COLUMN config_samples.media_type IS 'Type of media: audio or video';

-- Update existing records to ensure they have media_type = 'audio'
UPDATE config_samples
SET media_type = 'audio'
WHERE media_type IS NULL;
