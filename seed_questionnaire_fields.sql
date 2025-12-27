-- Seed Data: Questionnaire Fields
-- This file contains initial questionnaire fields for all occasions
-- Run this AFTER the migration_questionnaire_fields.sql migration

-- ============================================
-- COMMON FIELDS (apply to all occasions)
-- These have NULL occasion_slug so they appear for every occasion
-- ============================================

-- Recipient Group
INSERT INTO config_questionnaire_fields (occasion_slug, field_name, field_type, field_label, placeholder, help_text, required, display_order, options, field_group, validation_rules) VALUES
(NULL, 'recipient_name', 'text', 'Who is this song for?', 'e.g., Sarah, Mom, John & Mary', 'The person or people this song celebrates', true, 1, NULL, 'recipient', NULL),
(NULL, 'recipient_relationship', 'select', 'Your relationship to them', 'Select relationship', NULL, true, 2,
  '[{"value": "spouse", "label": "Spouse / Partner"}, {"value": "parent", "label": "Parent"}, {"value": "child", "label": "Child"}, {"value": "sibling", "label": "Sibling"}, {"value": "friend", "label": "Friend"}, {"value": "grandparent", "label": "Grandparent"}, {"value": "other_family", "label": "Other Family Member"}, {"value": "colleague", "label": "Colleague"}, {"value": "other", "label": "Other"}]'::jsonb,
  'recipient', NULL),
(NULL, 'occasion_date', 'date', 'When is the occasion?', NULL, 'This helps us prioritize delivery', false, 3, NULL, 'recipient', NULL);

-- Memories Group
INSERT INTO config_questionnaire_fields (occasion_slug, field_name, field_type, field_label, placeholder, help_text, required, display_order, options, field_group, validation_rules) VALUES
(NULL, 'story', 'textarea', 'Tell us about your story', 'Share the memories, moments, and feelings you want captured in the song. Include specific details, inside jokes, meaningful places, or special phrases that matter to you both...', 'This is the heart of your song. The more detail, the better!', true, 1, NULL, 'memories', '{"max_length": 3000}'::jsonb);

-- Song Preferences Group
INSERT INTO config_questionnaire_fields (occasion_slug, field_name, field_type, field_label, placeholder, help_text, required, display_order, options, field_group, validation_rules) VALUES
(NULL, 'genre', 'select', 'Preferred genre/style', 'Let our artists decide', NULL, false, 1,
  '[{"value": "pop", "label": "Pop"}, {"value": "rnb", "label": "R&B / Soul"}, {"value": "acoustic", "label": "Acoustic"}, {"value": "country", "label": "Country"}, {"value": "gospel", "label": "Gospel"}, {"value": "jazz", "label": "Jazz"}, {"value": "afrobeats", "label": "Afrobeats"}, {"value": "classical", "label": "Classical"}, {"value": "hiphop", "label": "Hip-Hop"}, {"value": "rock", "label": "Rock"}, {"value": "folk", "label": "Folk"}]'::jsonb,
  'song_preferences', NULL),
(NULL, 'moods', 'checkbox', 'Mood/Feeling', NULL, 'Select all that apply', false, 2,
  '[{"value": "romantic", "label": "Romantic"}, {"value": "upbeat", "label": "Upbeat"}, {"value": "emotional", "label": "Emotional"}, {"value": "celebratory", "label": "Celebratory"}, {"value": "nostalgic", "label": "Nostalgic"}, {"value": "inspirational", "label": "Inspirational"}, {"value": "fun", "label": "Fun & Playful"}, {"value": "heartfelt", "label": "Heartfelt"}]'::jsonb,
  'song_preferences', NULL),
(NULL, 'special_requests', 'textarea', 'Any specific requests?', 'Reference songs you like, specific lyrics to include, or anything else we should know...', NULL, false, 3, NULL, 'song_preferences', '{"max_length": 1000}'::jsonb);


-- ============================================
-- WEDDING-SPECIFIC FIELDS
-- ============================================

INSERT INTO config_questionnaire_fields (occasion_slug, field_name, field_type, field_label, placeholder, help_text, required, display_order, options, field_group, validation_rules) VALUES
('wedding', 'how_you_met', 'textarea', 'How did you meet?', 'Tell us the story of how you first met your partner...', 'We love the details - where, when, what was your first impression?', false, 1, NULL, 'relationship', '{"max_length": 1500}'::jsonb),
('wedding', 'proposal_story', 'textarea', 'Tell us about your proposal', 'If applicable, share your proposal story...', NULL, false, 2, NULL, 'relationship', '{"max_length": 1500}'::jsonb),
('wedding', 'wedding_venue', 'text', 'Wedding venue or location', 'e.g., Beach ceremony, Garden wedding, Church', 'This can inspire the song''s imagery', false, 3, NULL, 'additional', NULL),
('wedding', 'first_dance', 'radio', 'Will this be your first dance song?', NULL, NULL, false, 4,
  '[{"value": "yes", "label": "Yes, this will be our first dance"}, {"value": "no", "label": "No, it''s for another part of the wedding"}, {"value": "unsure", "label": "Not sure yet"}]'::jsonb,
  'additional', NULL),
('wedding', 'partner_qualities', 'textarea', 'What do you love most about your partner?', 'Their smile, their laugh, how they make you feel...', 'These details make the song personal', false, 5, NULL, 'memories', '{"max_length": 1500}'::jsonb);


-- ============================================
-- BIRTHDAY-SPECIFIC FIELDS
-- ============================================

INSERT INTO config_questionnaire_fields (occasion_slug, field_name, field_type, field_label, placeholder, help_text, required, display_order, options, field_group, validation_rules) VALUES
('birthday', 'birthday_age', 'number', 'What birthday are they celebrating?', 'e.g., 30, 50, 80', 'Optional - helps us personalize the song', false, 1, NULL, 'recipient', '{"min": 1, "max": 120}'::jsonb),
('birthday', 'milestone_type', 'select', 'Is this a milestone birthday?', 'Select if applicable', NULL, false, 2,
  '[{"value": "sweet_16", "label": "Sweet 16"}, {"value": "21st", "label": "21st Birthday"}, {"value": "30th", "label": "30th Birthday"}, {"value": "40th", "label": "40th Birthday"}, {"value": "50th", "label": "50th Birthday"}, {"value": "60th", "label": "60th Birthday"}, {"value": "retirement", "label": "Retirement Age"}, {"value": "other", "label": "Other milestone"}, {"value": "none", "label": "Not a milestone"}]'::jsonb,
  'recipient', NULL),
('birthday', 'birthday_theme', 'text', 'Any party theme or special interest to incorporate?', 'e.g., Travel lover, Sports fan, Music enthusiast', NULL, false, 3, NULL, 'additional', NULL),
('birthday', 'favorite_memories', 'textarea', 'Share favorite memories with this person', 'What makes birthdays with them special? Any traditions?', NULL, false, 4, NULL, 'memories', '{"max_length": 2000}'::jsonb),
('birthday', 'their_personality', 'textarea', 'Describe their personality', 'Are they funny, adventurous, caring, wise?', 'Helps us capture their essence', false, 5, NULL, 'recipient', '{"max_length": 1000}'::jsonb);


-- ============================================
-- ANNIVERSARY-SPECIFIC FIELDS
-- ============================================

INSERT INTO config_questionnaire_fields (occasion_slug, field_name, field_type, field_label, placeholder, help_text, required, display_order, options, field_group, validation_rules) VALUES
('anniversary', 'years_together', 'number', 'How many years are you celebrating?', 'e.g., 1, 10, 25, 50', NULL, false, 1, NULL, 'recipient', '{"min": 1, "max": 100}'::jsonb),
('anniversary', 'anniversary_type', 'select', 'Type of anniversary', NULL, NULL, false, 2,
  '[{"value": "wedding", "label": "Wedding Anniversary"}, {"value": "dating", "label": "Dating Anniversary"}, {"value": "engagement", "label": "Engagement Anniversary"}, {"value": "other", "label": "Other"}]'::jsonb,
  'recipient', NULL),
('anniversary', 'how_you_met', 'textarea', 'How did you meet?', 'Tell us the story of how you first met...', 'We love the details - where, when, what was your first impression?', false, 3, NULL, 'relationship', '{"max_length": 1500}'::jsonb),
('anniversary', 'favorite_trip', 'text', 'Any favorite trips or adventures together?', 'e.g., Our honeymoon in Paris, Road trip across the country', 'Great for adding personal imagery to the song', false, 4, NULL, 'memories', NULL),
('anniversary', 'challenges_overcome', 'textarea', 'Any challenges you''ve overcome together?', 'Optional - can add depth to the song', 'These stories can make the song more meaningful', false, 5, NULL, 'memories', '{"max_length": 1500}'::jsonb),
('anniversary', 'what_you_love', 'textarea', 'What do you love most about your partner?', 'Their qualities, habits, the little things...', NULL, false, 6, NULL, 'memories', '{"max_length": 1500}'::jsonb);


-- ============================================
-- GRADUATION-SPECIFIC FIELDS
-- ============================================

INSERT INTO config_questionnaire_fields (occasion_slug, field_name, field_type, field_label, placeholder, help_text, required, display_order, options, field_group, validation_rules) VALUES
('graduation', 'graduation_level', 'select', 'What level of graduation?', NULL, NULL, false, 1,
  '[{"value": "high_school", "label": "High School"}, {"value": "college", "label": "College / University"}, {"value": "masters", "label": "Master''s Degree"}, {"value": "phd", "label": "PhD / Doctorate"}, {"value": "medical", "label": "Medical School"}, {"value": "law", "label": "Law School"}, {"value": "trade", "label": "Trade School / Certification"}, {"value": "other", "label": "Other"}]'::jsonb,
  'recipient', NULL),
('graduation', 'school_name', 'text', 'School or Institution name', 'e.g., UCLA, Harvard Medical School', 'Can be mentioned in the song if you''d like', false, 2, NULL, 'recipient', NULL),
('graduation', 'field_of_study', 'text', 'Field of study or major', 'e.g., Computer Science, Nursing, Law', NULL, false, 3, NULL, 'recipient', NULL),
('graduation', 'graduate_achievements', 'textarea', 'Notable achievements during their studies', 'Dean''s list, sports achievements, overcoming obstacles...', NULL, false, 4, NULL, 'memories', '{"max_length": 1500}'::jsonb),
('graduation', 'future_plans', 'textarea', 'What''s next for them?', 'Their career plans, dreams, or next adventure...', 'We can incorporate wishes for their future', false, 5, NULL, 'additional', '{"max_length": 1000}'::jsonb),
('graduation', 'proud_moments', 'textarea', 'What are you most proud of about them?', 'Their hard work, growth, determination...', NULL, false, 6, NULL, 'memories', '{"max_length": 1500}'::jsonb);


-- ============================================
-- VERIFY INSERTION
-- ============================================

SELECT
  COALESCE(occasion_slug, 'COMMON') as occasion,
  field_group,
  COUNT(*) as field_count
FROM config_questionnaire_fields
GROUP BY occasion_slug, field_group
ORDER BY occasion_slug NULLS FIRST, field_group;


-- ============================================
-- NOTE: To add more occasions in the future
-- ============================================
-- 1. First add the occasion to config_occasions table:
--    INSERT INTO config_occasions (slug, name, tagline, icon, description, meta_title, meta_description, display_order)
--    VALUES ('memorial', 'Memorial', 'Honor Their Memory in Song', 'candle', '...', '...', '...', 5);
--
-- 2. Then add occasion-specific fields:
--    INSERT INTO config_questionnaire_fields (occasion_slug, field_name, ...)
--    VALUES ('memorial', 'person_name', ...);
