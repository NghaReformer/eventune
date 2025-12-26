-- ============================================
-- PERFORMANCE INDEXES
-- ============================================

-- Config tables
CREATE INDEX idx_packages_active ON config_packages(is_active, display_order);
CREATE INDEX idx_occasions_active ON config_occasions(is_active, display_order);
CREATE INDEX idx_payment_methods_active ON config_payment_methods(is_active, display_order);
CREATE INDEX idx_testimonials_active ON config_testimonials(is_active, display_order);
CREATE INDEX idx_testimonials_featured ON config_testimonials(is_featured) WHERE is_featured = TRUE;
CREATE INDEX idx_faq_locale ON config_faq(locale, is_active, display_order);
CREATE INDEX idx_samples_active ON config_samples(is_active, display_order);
CREATE INDEX idx_samples_featured ON config_samples(is_featured) WHERE is_featured = TRUE;
CREATE INDEX idx_capacity_date ON config_capacity(date);

-- Orders - most queried table
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);
CREATE INDEX idx_orders_due_date ON orders(due_date);
CREATE INDEX idx_orders_number ON orders(order_number);
CREATE INDEX idx_orders_payment_ref ON orders(payment_reference);
CREATE INDEX idx_orders_stripe_session ON orders(stripe_checkout_session) WHERE stripe_checkout_session IS NOT NULL;
CREATE INDEX idx_orders_campay_ref ON orders(campay_reference) WHERE campay_reference IS NOT NULL;
CREATE INDEX idx_orders_email ON orders(customer_email);

-- Order status history
CREATE INDEX idx_order_history_order ON order_status_history(order_id);
CREATE INDEX idx_order_history_created ON order_status_history(created_at DESC);

-- Payment events
CREATE INDEX idx_payment_events_order ON payment_events(order_id);
CREATE INDEX idx_payment_events_type ON payment_events(event_type);
CREATE INDEX idx_payment_events_provider_ref ON payment_events(provider, provider_reference);
CREATE INDEX idx_payment_events_date ON payment_events(created_at DESC);

-- Payment sessions
CREATE INDEX idx_payment_sessions_order ON payment_sessions(order_id);
CREATE INDEX idx_payment_sessions_provider ON payment_sessions(provider, provider_session_id);
CREATE INDEX idx_payment_sessions_pending ON payment_sessions(status) WHERE status = 'pending';

-- Admin audit
CREATE INDEX idx_audit_admin ON admin_audit_log(admin_id);
CREATE INDEX idx_audit_target ON admin_audit_log(target_type, target_id);
CREATE INDEX idx_audit_date ON admin_audit_log(created_at DESC);
CREATE INDEX idx_audit_action ON admin_audit_log(action);

-- Security events
CREATE INDEX idx_security_severity ON security_events(severity, created_at DESC);
CREATE INDEX idx_security_unresolved ON security_events(resolved) WHERE resolved = FALSE;
CREATE INDEX idx_security_type ON security_events(event_type);

-- Failed logins
CREATE INDEX idx_failed_login_email ON failed_login_attempts(email, created_at DESC);
CREATE INDEX idx_failed_login_ip ON failed_login_attempts(ip_address, created_at DESC);

-- Notifications
CREATE INDEX idx_notifications_pending ON notification_queue(status, created_at) WHERE status = 'pending';
CREATE INDEX idx_notifications_recipient ON notification_queue(recipient_id);
CREATE INDEX idx_notifications_type ON notification_queue(notification_type);

-- Profiles
CREATE INDEX idx_profiles_admin ON profiles(admin_role) WHERE admin_role IS NOT NULL;
CREATE INDEX idx_profiles_email ON profiles(email);

-- Questionnaires
CREATE INDEX idx_questionnaires_order ON questionnaires(order_id);
