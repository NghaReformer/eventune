-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.admin_role IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is super_admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.admin_role = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- PROFILES POLICIES
-- ============================================

CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
ON profiles FOR SELECT
TO authenticated
USING (is_admin());

-- ============================================
-- ORDERS POLICIES
-- ============================================

CREATE POLICY "Users can view own orders"
ON orders FOR SELECT
TO authenticated
USING (auth.uid() = customer_id);

CREATE POLICY "Users can create orders"
ON orders FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Admins can view all orders"
ON orders FOR SELECT
TO authenticated
USING (is_admin());

CREATE POLICY "Admins can update orders"
ON orders FOR UPDATE
TO authenticated
USING (is_admin());

-- ============================================
-- QUESTIONNAIRES POLICIES
-- ============================================

CREATE POLICY "Users can view own questionnaires"
ON questionnaires FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = questionnaires.order_id
    AND orders.customer_id = auth.uid()
  )
);

CREATE POLICY "Users can create questionnaires for own orders"
ON questionnaires FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = questionnaires.order_id
    AND orders.customer_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all questionnaires"
ON questionnaires FOR SELECT
TO authenticated
USING (is_admin());

-- ============================================
-- ORDER STATUS HISTORY POLICIES
-- ============================================

CREATE POLICY "Users can view own order history"
ON order_status_history FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = order_status_history.order_id
    AND orders.customer_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all order history"
ON order_status_history FOR SELECT
TO authenticated
USING (is_admin());

CREATE POLICY "Admins can insert order history"
ON order_status_history FOR INSERT
TO authenticated
WITH CHECK (is_admin());

-- ============================================
-- PAYMENT EVENTS POLICIES
-- ============================================

CREATE POLICY "Admins can view payment events"
ON payment_events FOR SELECT
TO authenticated
USING (is_admin());

-- Service role can insert (from webhooks)
-- No policy needed for service role

-- ============================================
-- PAYMENT SESSIONS POLICIES
-- ============================================

CREATE POLICY "Users can view own payment sessions"
ON payment_sessions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = payment_sessions.order_id
    AND orders.customer_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all payment sessions"
ON payment_sessions FOR SELECT
TO authenticated
USING (is_admin());

-- ============================================
-- ADMIN AUDIT LOG POLICIES
-- ============================================

CREATE POLICY "Super admins can view audit logs"
ON admin_audit_log FOR SELECT
TO authenticated
USING (is_super_admin());

CREATE POLICY "Admins can insert audit logs"
ON admin_audit_log FOR INSERT
TO authenticated
WITH CHECK (is_admin());

-- ============================================
-- SECURITY EVENTS POLICIES
-- ============================================

CREATE POLICY "Super admins can view security events"
ON security_events FOR SELECT
TO authenticated
USING (is_super_admin());

CREATE POLICY "Super admins can update security events"
ON security_events FOR UPDATE
TO authenticated
USING (is_super_admin());

-- ============================================
-- FAILED LOGIN ATTEMPTS POLICIES
-- ============================================

CREATE POLICY "Admins can view failed logins"
ON failed_login_attempts FOR SELECT
TO authenticated
USING (is_admin());

-- ============================================
-- NOTIFICATION QUEUE POLICIES
-- ============================================

CREATE POLICY "Users can view own notifications"
ON notification_queue FOR SELECT
TO authenticated
USING (recipient_id = auth.uid());

CREATE POLICY "Admins can view all notifications"
ON notification_queue FOR SELECT
TO authenticated
USING (is_admin());

-- ============================================
-- CONFIG TABLES - PUBLIC READ POLICIES
-- ============================================

CREATE POLICY "Anyone can read active packages"
ON config_packages FOR SELECT
TO anon, authenticated
USING (is_active = TRUE);

CREATE POLICY "Anyone can read active occasions"
ON config_occasions FOR SELECT
TO anon, authenticated
USING (is_active = TRUE);

CREATE POLICY "Anyone can read active payment methods"
ON config_payment_methods FOR SELECT
TO anon, authenticated
USING (is_active = TRUE);

CREATE POLICY "Anyone can read order statuses"
ON config_order_statuses FOR SELECT
TO anon, authenticated
USING (TRUE);

CREATE POLICY "Admins can read capacity"
ON config_capacity FOR SELECT
TO authenticated
USING (is_admin());

CREATE POLICY "Admins can modify capacity"
ON config_capacity FOR ALL
TO authenticated
USING (is_admin());

CREATE POLICY "Admins can read refund policies"
ON config_refund_policies FOR SELECT
TO authenticated
USING (is_admin());

CREATE POLICY "Anyone can read active testimonials"
ON config_testimonials FOR SELECT
TO anon, authenticated
USING (is_active = TRUE);

CREATE POLICY "Anyone can read active FAQ"
ON config_faq FOR SELECT
TO anon, authenticated
USING (is_active = TRUE);

CREATE POLICY "Anyone can read active samples"
ON config_samples FOR SELECT
TO anon, authenticated
USING (is_active = TRUE);

CREATE POLICY "Anyone can read settings"
ON config_settings FOR SELECT
TO anon, authenticated
USING (TRUE);

-- ============================================
-- CONFIG ADMIN WRITE POLICIES
-- ============================================

CREATE POLICY "Super admins can modify packages"
ON config_packages FOR ALL
TO authenticated
USING (is_super_admin());

CREATE POLICY "Super admins can modify occasions"
ON config_occasions FOR ALL
TO authenticated
USING (is_super_admin());

CREATE POLICY "Super admins can modify payment methods"
ON config_payment_methods FOR ALL
TO authenticated
USING (is_super_admin());

CREATE POLICY "Super admins can modify order statuses"
ON config_order_statuses FOR ALL
TO authenticated
USING (is_super_admin());

CREATE POLICY "Super admins can modify refund policies"
ON config_refund_policies FOR ALL
TO authenticated
USING (is_super_admin());

CREATE POLICY "Admins can modify testimonials"
ON config_testimonials FOR ALL
TO authenticated
USING (is_admin());

CREATE POLICY "Admins can modify FAQ"
ON config_faq FOR ALL
TO authenticated
USING (is_admin());

CREATE POLICY "Admins can modify samples"
ON config_samples FOR ALL
TO authenticated
USING (is_admin());

CREATE POLICY "Super admins can modify settings"
ON config_settings FOR ALL
TO authenticated
USING (is_super_admin());
