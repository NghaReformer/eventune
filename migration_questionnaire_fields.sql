-- Migration: Create config_questionnaire_fields table
-- Description: Dynamic questionnaire builder for occasion-specific questions

CREATE TABLE IF NOT EXISTS config_questionnaire_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Occasion relationship (NULL = applies to all occasions)
  occasion_slug TEXT NULL REFERENCES config_occasions(slug) ON DELETE CASCADE,
  
  -- Field configuration
  field_name TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('text', 'textarea', 'select', 'radio', 'checkbox', 'date', 'number', 'email', 'phone')),
  field_label TEXT NOT NULL,
  placeholder TEXT,
  help_text TEXT,
  required BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 10,
  
  -- Options for select/radio/checkbox fields (JSONB array)
  -- Format: [{"value": "option1", "label": "Option 1"}, ...]
  options JSONB,
  
  -- Field grouping for UI organization
  field_group TEXT NOT NULL DEFAULT 'additional' CHECK (field_group IN ('recipient', 'relationship', 'memories', 'song_preferences', 'additional')),
  
  -- Validation rules (JSONB object)
  -- Format: {"min_length": 10, "max_length": 500, "pattern": "regex", "min": 0, "max": 100}
  validation_rules JSONB,
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookups by occasion
CREATE INDEX IF NOT EXISTS idx_questionnaire_fields_occasion 
  ON config_questionnaire_fields(occasion_slug) 
  WHERE is_active = true;

-- Index for ordering fields
CREATE INDEX IF NOT EXISTS idx_questionnaire_fields_order 
  ON config_questionnaire_fields(occasion_slug, display_order);

-- Unique constraint on field_name per occasion
CREATE UNIQUE INDEX IF NOT EXISTS idx_questionnaire_fields_unique_name 
  ON config_questionnaire_fields(COALESCE(occasion_slug, 'common'), field_name);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_questionnaire_fields_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_questionnaire_fields_updated_at
  BEFORE UPDATE ON config_questionnaire_fields
  FOR EACH ROW
  EXECUTE FUNCTION update_questionnaire_fields_updated_at();

-- Row Level Security
ALTER TABLE config_questionnaire_fields ENABLE ROW LEVEL SECURITY;

-- Public can read active fields
CREATE POLICY "Public users can view active questionnaire fields"
  ON config_questionnaire_fields
  FOR SELECT
  USING (is_active = true);

-- Admins can manage all fields
CREATE POLICY "Admins can manage questionnaire fields"
  ON config_questionnaire_fields
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.admin_role IN ('super_admin', 'order_manager')
    )
  );

COMMENT ON TABLE config_questionnaire_fields IS 'Dynamic questionnaire fields for occasion-specific order forms';
COMMENT ON COLUMN config_questionnaire_fields.occasion_slug IS 'NULL means field applies to all occasions (common fields)';
COMMENT ON COLUMN config_questionnaire_fields.field_name IS 'Unique identifier for the field (e.g., recipient_name, relationship_type)';
COMMENT ON COLUMN config_questionnaire_fields.options IS 'JSON array of options for select/radio/checkbox: [{"value": "...", "label": "..."}]';
COMMENT ON COLUMN config_questionnaire_fields.validation_rules IS 'JSON object with validation rules: {"min_length": 10, "max_length": 500}';
