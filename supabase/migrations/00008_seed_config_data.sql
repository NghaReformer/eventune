-- ============================================
-- SEED CONFIGURATION DATA
-- Initial data for all config tables
-- ============================================

-- ============================================
-- PACKAGES
-- ============================================
INSERT INTO config_packages (slug, name, description, price_usd, price_xaf, song_length_min, song_length_max, includes_discovery_call, revision_count, includes_instrumental, includes_full_rights, delivery_days_min, delivery_days_max, display_order, is_popular) VALUES
('express', 'Express', '2-3 minute custom song with digital delivery', 149.00, 75000, 2, 3, FALSE, 0, FALSE, FALSE, 5, 7, 1, FALSE),
('classic', 'Classic', '3-4 minute song with discovery call and 1 revision', 299.00, 150000, 3, 4, TRUE, 1, FALSE, FALSE, 7, 10, 2, TRUE),
('signature', 'Signature', '4-5 minute song with video call, 2 revisions, and instrumental track', 499.00, 250000, 4, 5, TRUE, 2, TRUE, FALSE, 10, 14, 3, FALSE),
('legacy', 'Legacy', 'Premium production with live instruments and full ownership rights', 799.00, 400000, 4, 6, TRUE, 3, TRUE, TRUE, 14, 21, 4, FALSE);

-- ============================================
-- OCCASIONS
-- ============================================
INSERT INTO config_occasions (slug, name, description, tagline, icon, meta_title, meta_description, display_order) VALUES
('wedding', 'Wedding', 'Custom wedding songs for your special day', 'The First Dance They''ll Never Forget', 'heart', 'Custom Wedding Songs | Eventune Studios', 'Create a personalized wedding song for your first dance, ceremony, or celebration.', 1),
('birthday', 'Birthday', 'Personalized birthday songs for any age', 'A Gift That Sings Their Story', 'cake', 'Custom Birthday Songs | Eventune Studios', 'Give the gift of a personalized birthday song that celebrates their unique story.', 2),
('anniversary', 'Anniversary', 'Celebrate your journey in song', 'Celebrate Your Journey in Song', 'rings', 'Custom Anniversary Songs | Eventune Studios', 'Mark your anniversary milestone with a custom song that captures your love story.', 3),
('graduation', 'Graduation', 'Honor their achievement with music', 'A Musical Milestone', 'cap', 'Custom Graduation Songs | Eventune Studios', 'Celebrate graduation with a personalized song honoring their achievements.', 4),
('memorial', 'Memorial', 'Honor loved ones through song', 'Forever in Song', 'dove', 'Custom Memorial Songs | Eventune Studios', 'Create a beautiful tribute song to honor and remember your loved one.', 5),
('corporate', 'Corporate', 'Custom music for business events', 'Your Brand, Your Sound', 'building', 'Custom Corporate Songs | Eventune Studios', 'Professional custom songs for corporate events, retirements, and team celebrations.', 6),
('other', 'Other', 'Custom songs for any occasion', 'Your Story, Your Song', 'music', 'Custom Songs for Any Occasion | Eventune Studios', 'Whatever your occasion, we can create a personalized song just for you.', 7);

-- ============================================
-- PAYMENT METHODS
-- ============================================
INSERT INTO config_payment_methods (provider, method_type, display_name, currencies, countries, fee_percentage, display_order) VALUES
('stripe', 'card', 'Credit/Debit Card', ARRAY['USD'], NULL, 2.90, 1),
('campay', 'mtn_momo', 'MTN Mobile Money', ARRAY['XAF'], ARRAY['CM'], 2.00, 2),
('campay', 'orange_money', 'Orange Money', ARRAY['XAF'], ARRAY['CM'], 2.00, 3);

-- ============================================
-- ORDER STATUSES
-- ============================================
INSERT INTO config_order_statuses (slug, name, description, next_statuses, requires_admin, send_email, email_template, color, icon, display_order) VALUES
('pending', 'Pending', 'Awaiting payment', ARRAY['paid', 'cancelled'], FALSE, FALSE, NULL, '#6B7280', 'clock', 1),
('paid', 'Paid', 'Payment received', ARRAY['discovery', 'writing'], TRUE, TRUE, 'order-confirmation', '#22C55E', 'check', 2),
('discovery', 'Discovery', 'Discovery call scheduled', ARRAY['writing'], TRUE, TRUE, 'status-update', '#3B82F6', 'phone', 3),
('writing', 'Writing', 'Song being written', ARRAY['production'], TRUE, TRUE, 'status-update', '#3B82F6', 'edit', 4),
('production', 'Production', 'In production', ARRAY['review'], TRUE, TRUE, 'status-update', '#3B82F6', 'music', 5),
('review', 'Review', 'Ready for review', ARRAY['delivered', 'production'], TRUE, TRUE, 'status-update', '#EAB308', 'eye', 6),
('delivered', 'Delivered', 'Song delivered', ARRAY[]::TEXT[], TRUE, TRUE, 'delivery', '#22C55E', 'gift', 7),
('cancelled', 'Cancelled', 'Order cancelled', ARRAY[]::TEXT[], TRUE, TRUE, 'cancellation', '#EF4444', 'x', 8);

-- ============================================
-- REFUND POLICIES
-- ============================================
INSERT INTO config_refund_policies (status_slug, refund_percentage, description, requires_manual_review) VALUES
('pending', 100, 'Full refund - order not yet paid', FALSE),
('paid', 100, 'Full refund before production starts', FALSE),
('discovery', 75, '75% refund during discovery phase', TRUE),
('writing', 50, '50% refund during writing phase', TRUE),
('production', 25, '25% refund during production', TRUE),
('review', 0, 'No refund after review begins', TRUE),
('delivered', 0, 'No refund after delivery', TRUE);

-- ============================================
-- SAMPLE FAQ
-- ============================================
INSERT INTO config_faq (question, answer, category, display_order, locale) VALUES
('How long does it take to receive my custom song?', 'Delivery times vary by package: Express (5-7 days), Classic (7-10 days), Signature (10-14 days), and Legacy (14-21 days). We''ll keep you updated throughout the process.', 'delivery', 1, 'en'),
('What information do you need from me?', 'After ordering, you''ll complete a questionnaire about your recipient, occasion, key memories, preferred music style, and any must-include phrases. The more details you share, the more personal your song will be.', 'ordering', 2, 'en'),
('Can I request revisions?', 'Yes! Classic packages include 1 revision, Signature includes 2 revisions, and Legacy includes 3 revisions. Express packages do not include revisions.', 'ordering', 3, 'en'),
('What music styles are available?', 'We offer various styles including pop, acoustic, R&B, Afrobeat, country, and more. Let us know your preferences and we''ll match the song to your taste.', 'ordering', 4, 'en'),
('How do I pay in Cameroon?', 'We accept MTN Mobile Money and Orange Money for payments in XAF. Just select your mobile money option at checkout and follow the prompts.', 'payment', 5, 'en'),
('Is my personal information safe?', 'Yes! All personal stories and information you share are encrypted and kept confidential. We never share your details with third parties.', 'privacy', 6, 'en'),
('Can I get a refund?', 'Refund availability depends on the order status. Full refunds are available before production starts. Partial refunds may be available during early stages. See our refund policy for details.', 'payment', 7, 'en'),
('Do I own the song?', 'With our Express, Classic, and Signature packages, you receive a personal use license. The Legacy package includes full ownership rights, allowing commercial use.', 'ordering', 8, 'en');

-- ============================================
-- SITE SETTINGS
-- ============================================
INSERT INTO config_settings (key, value, description) VALUES
('site_maintenance', '{"enabled": false, "message": ""}', 'Maintenance mode settings'),
('booking_enabled', 'true', 'Whether new orders are accepted'),
('default_capacity', '3', 'Default daily order capacity'),
('support_whatsapp', '"+237XXXXXXXXX"', 'WhatsApp support number'),
('currency_display', '{"default": "USD", "showBoth": true}', 'Currency display preferences');
