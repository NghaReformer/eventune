-- ============================================
-- CORE BUSINESS TABLES
-- ============================================

-- Customer Profiles
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  phone_country_code TEXT DEFAULT '+237',
  preferred_language TEXT DEFAULT 'en',
  notification_preferences JSONB DEFAULT '{"email": true, "sms": false}',

  -- Admin fields
  admin_role admin_role,
  admin_2fa_enabled BOOLEAN DEFAULT FALSE,
  admin_2fa_secret TEXT,
  last_admin_login TIMESTAMPTZ,

  -- GDPR compliance
  marketing_consent BOOLEAN DEFAULT FALSE,
  data_processing_consent BOOLEAN DEFAULT TRUE,
  consent_updated_at TIMESTAMPTZ,

  -- Soft delete for GDPR
  deleted_at TIMESTAMPTZ,
  anonymized_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orders
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL,

  -- Customer
  customer_id UUID REFERENCES auth.users,
  customer_email TEXT NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,

  -- Order details (references config)
  occasion_slug TEXT REFERENCES config_occasions(slug),
  package_slug TEXT REFERENCES config_packages(slug),

  -- Pricing
  currency TEXT NOT NULL CHECK (currency IN ('USD', 'XAF')),
  amount_expected DECIMAL(10, 2) NOT NULL,
  amount_paid DECIMAL(10, 2),

  -- Payment
  payment_method TEXT,
  payment_provider TEXT,
  payment_reference TEXT,
  payment_status payment_status DEFAULT 'pending',

  -- Provider references
  stripe_checkout_session TEXT,
  stripe_payment_intent TEXT,
  campay_reference TEXT,
  campay_operator TEXT,

  -- Status
  status TEXT DEFAULT 'pending',

  -- Dates
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  due_date DATE,
  delivered_at TIMESTAMPTZ,

  -- Content
  questionnaire_id UUID,
  song_title TEXT,
  delivery_url TEXT,

  -- Refund
  refund_status refund_status,
  refund_amount DECIMAL(10, 2),
  refund_reason TEXT,
  refunded_at TIMESTAMPTZ,

  -- Metadata
  notes TEXT,
  internal_notes TEXT,
  source TEXT DEFAULT 'website',
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,

  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Questionnaires (encrypted content)
CREATE TABLE questionnaires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders ON DELETE CASCADE,
  encrypted_data TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Order Status History
CREATE TABLE order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL,
  previous_status TEXT,
  note TEXT,
  changed_by UUID REFERENCES auth.users,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment Events (lifecycle logging)
CREATE TABLE payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders,
  event_type TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_reference TEXT,
  amount DECIMAL(10, 2),
  currency TEXT,
  failure_reason TEXT,
  raw_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment Sessions (for timeout tracking)
CREATE TABLE payment_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders,
  provider TEXT NOT NULL,
  provider_session_id TEXT,
  status TEXT DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Admin Audit Log
CREATE TABLE admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES auth.users NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Security Events
CREATE TABLE security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  severity security_severity DEFAULT 'medium',
  data JSONB,
  ip_address INET,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_by UUID REFERENCES auth.users,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Failed Login Attempts
CREATE TABLE failed_login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  ip_address INET,
  user_agent TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notification Queue
CREATE TABLE notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID REFERENCES auth.users,
  recipient_email TEXT NOT NULL,
  recipient_phone TEXT,
  notification_type TEXT NOT NULL,
  channel notification_channel NOT NULL,
  subject TEXT,
  body TEXT,
  template_data JSONB,
  status notification_status DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comments
COMMENT ON TABLE profiles IS 'Customer profiles with admin roles and GDPR compliance';
COMMENT ON TABLE orders IS 'Core order tracking with full payment history';
COMMENT ON TABLE questionnaires IS 'Encrypted customer questionnaire data';
COMMENT ON TABLE order_status_history IS 'Audit trail for order status changes';
COMMENT ON TABLE payment_events IS 'Payment lifecycle event logging';
COMMENT ON TABLE payment_sessions IS 'Active payment session tracking';
COMMENT ON TABLE admin_audit_log IS 'Admin action audit trail';
COMMENT ON TABLE security_events IS 'Security incident logging';
COMMENT ON TABLE failed_login_attempts IS 'Failed login tracking for rate limiting';
COMMENT ON TABLE notification_queue IS 'Email/SMS notification queue';
