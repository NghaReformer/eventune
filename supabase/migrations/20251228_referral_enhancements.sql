-- =====================================================================
-- REFERRAL SYSTEM ENHANCEMENTS MIGRATION
-- Created: 2025-12-28
-- Purpose: Comprehensive upgrade for multi-level referral/affiliate system
-- Features: Currency support, fraud detection, advanced tracking, payout management
-- =====================================================================

-- =====================================================================
-- SECTION 1: ENHANCE EXISTING TABLES
-- =====================================================================

-- 1.1 Enhance referral_programs table
ALTER TABLE referral_programs
  ADD COLUMN IF NOT EXISTS minimum_payout_usd DECIMAL(10,2) DEFAULT 10.00,
  ADD COLUMN IF NOT EXISTS minimum_payout_xaf DECIMAL(10,2) DEFAULT 5000.00,
  ADD COLUMN IF NOT EXISTS cookie_duration_days INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS require_first_purchase BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS allow_self_signup BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS terms_url TEXT,
  ADD COLUMN IF NOT EXISTS cap_period TEXT DEFAULT 'none' CHECK (cap_period IN ('none', 'monthly', 'yearly', 'lifetime'));

COMMENT ON COLUMN referral_programs.minimum_payout_usd IS 'Minimum balance required to request payout (USD)';
COMMENT ON COLUMN referral_programs.minimum_payout_xaf IS 'Minimum balance required to request payout (XAF)';
COMMENT ON COLUMN referral_programs.cookie_duration_days IS 'How long referral cookie lasts (days)';
COMMENT ON COLUMN referral_programs.require_first_purchase IS 'Only award commission on first purchase';
COMMENT ON COLUMN referral_programs.allow_self_signup IS 'Allow public signup to become affiliate';
COMMENT ON COLUMN referral_programs.cap_period IS 'Commission cap period (none, monthly, yearly, lifetime)';

-- 1.2 Enhance referral_profiles table
ALTER TABLE referral_profiles
  ADD COLUMN IF NOT EXISTS total_earnings_usd DECIMAL(10,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS total_earnings_xaf DECIMAL(10,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS current_balance_usd DECIMAL(10,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS current_balance_xaf DECIMAL(10,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS payout_method TEXT CHECK (payout_method IN ('mobile_money', 'bank_transfer', 'paypal')),
  ADD COLUMN IF NOT EXISTS payout_details JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS tier_level INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS suspended_reason TEXT,
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;

COMMENT ON COLUMN referral_profiles.total_earnings_usd IS 'Lifetime earnings in USD';
COMMENT ON COLUMN referral_profiles.total_earnings_xaf IS 'Lifetime earnings in XAF';
COMMENT ON COLUMN referral_profiles.current_balance_usd IS 'Available balance for payout (USD)';
COMMENT ON COLUMN referral_profiles.current_balance_xaf IS 'Available balance for payout (XAF)';
COMMENT ON COLUMN referral_profiles.payout_method IS 'Preferred payout method';
COMMENT ON COLUMN referral_profiles.payout_details IS 'Payout method details (phone, account number, PayPal email)';
COMMENT ON COLUMN referral_profiles.tier_level IS 'Agent tier/level (future feature for tiered benefits)';
COMMENT ON COLUMN referral_profiles.notes IS 'Admin notes about this agent';
COMMENT ON COLUMN referral_profiles.suspended_at IS 'Timestamp when account was suspended';

-- 1.3 Enhance referrals table (Attribution)
ALTER TABLE referrals
  ADD COLUMN IF NOT EXISTS ip_address INET,
  ADD COLUMN IF NOT EXISTS user_agent TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'link' CHECK (source IN ('link', 'manual', 'import', 'api')),
  ADD COLUMN IF NOT EXISTS landing_page TEXT,
  ADD COLUMN IF NOT EXISTS utm_source TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
  ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS first_order_id UUID REFERENCES orders(id);

CREATE INDEX IF NOT EXISTS idx_referrals_ip ON referrals(ip_address);
CREATE INDEX IF NOT EXISTS idx_referrals_converted ON referrals(converted_at) WHERE converted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_referrals_source ON referrals(source);

COMMENT ON COLUMN referrals.ip_address IS 'IP address at time of referral attribution';
COMMENT ON COLUMN referrals.user_agent IS 'User agent at time of attribution';
COMMENT ON COLUMN referrals.source IS 'How referral was created (link, manual admin entry, import, api)';
COMMENT ON COLUMN referrals.landing_page IS 'First page visited with referral code';
COMMENT ON COLUMN referrals.converted_at IS 'Timestamp when referee made first purchase';
COMMENT ON COLUMN referrals.first_order_id IS 'Reference to first order (conversion)';

-- 1.4 Enhance commissions table
ALTER TABLE commissions
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'XAF')),
  ADD COLUMN IF NOT EXISTS order_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Create unique index for idempotency (prevent duplicate commissions)
CREATE UNIQUE INDEX IF NOT EXISTS idx_commissions_idempotent
  ON commissions(order_id, referrer_id, level);

CREATE INDEX IF NOT EXISTS idx_commissions_currency ON commissions(currency);
CREATE INDEX IF NOT EXISTS idx_commissions_status_currency ON commissions(status, currency);

COMMENT ON COLUMN commissions.currency IS 'Currency of commission (matches order currency)';
COMMENT ON COLUMN commissions.order_amount IS 'Total order amount at time of commission';
COMMENT ON COLUMN commissions.approved_by IS 'Admin who approved/rejected commission';
COMMENT ON COLUMN commissions.approved_at IS 'Timestamp of approval/rejection';
COMMENT ON COLUMN commissions.rejection_reason IS 'Reason for rejection if status=rejected';

-- 1.5 Enhance payout_requests table
ALTER TABLE payout_requests
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'XAF')),
  ADD COLUMN IF NOT EXISTS transaction_reference TEXT,
  ADD COLUMN IF NOT EXISTS processed_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_payout_requests_currency ON payout_requests(currency);
CREATE INDEX IF NOT EXISTS idx_payout_requests_status_currency ON payout_requests(status, currency);

COMMENT ON COLUMN payout_requests.currency IS 'Currency of payout request';
COMMENT ON COLUMN payout_requests.transaction_reference IS 'External transaction ID from payment processor';
COMMENT ON COLUMN payout_requests.processed_by IS 'Admin who processed the payout';
COMMENT ON COLUMN payout_requests.rejection_reason IS 'Reason for rejection if status=rejected';

-- =====================================================================
-- SECTION 2: CREATE NEW TABLES
-- =====================================================================

-- 2.1 Create referral_events table (Audit Log)
CREATE TABLE IF NOT EXISTS referral_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  referrer_id UUID REFERENCES referral_profiles(id),
  referee_id UUID REFERENCES auth.users(id),
  order_id UUID REFERENCES orders(id),
  commission_id UUID REFERENCES commissions(id),
  data JSONB DEFAULT '{}',
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_events_type ON referral_events(event_type);
CREATE INDEX IF NOT EXISTS idx_referral_events_referrer ON referral_events(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referral_events_referee ON referral_events(referee_id);
CREATE INDEX IF NOT EXISTS idx_referral_events_created ON referral_events(created_at DESC);

COMMENT ON TABLE referral_events IS 'Audit log for all referral system events';
COMMENT ON COLUMN referral_events.event_type IS 'Event type: signup, attribution, commission_created, commission_paid, payout_requested, etc.';

-- 2.2 Create referral_fraud_signals table
CREATE TABLE IF NOT EXISTS referral_fraud_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID REFERENCES referral_profiles(id),
  signal_type TEXT NOT NULL,
  severity TEXT DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  data JSONB DEFAULT '{}',
  resolved BOOLEAN DEFAULT FALSE,
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fraud_signals_referrer ON referral_fraud_signals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_fraud_signals_severity ON referral_fraud_signals(severity) WHERE NOT resolved;
CREATE INDEX IF NOT EXISTS idx_fraud_signals_unresolved ON referral_fraud_signals(created_at DESC) WHERE NOT resolved;

COMMENT ON TABLE referral_fraud_signals IS 'Fraud detection signals for review';
COMMENT ON COLUMN referral_fraud_signals.signal_type IS 'Type: same_ip_abuse, rapid_signups, suspicious_pattern, etc.';
COMMENT ON COLUMN referral_fraud_signals.severity IS 'Severity level for prioritization';

-- =====================================================================
-- SECTION 3: DROP OLD TRIGGERS (for clean replacement)
-- =====================================================================

DROP TRIGGER IF EXISTS trigger_calculate_commissions ON orders;
DROP TRIGGER IF EXISTS trigger_update_balance ON commissions;
DROP TRIGGER IF EXISTS trigger_check_circular_referral ON referral_profiles;
DROP TRIGGER IF EXISTS trigger_detect_fraud ON referrals;

-- =====================================================================
-- SECTION 4: CREATE/REPLACE FUNCTIONS
-- =====================================================================

-- 4.1 Generate Referral Code Function (EVT-XXXXX format)
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TEXT AS $$
DECLARE
  v_code TEXT;
  v_exists BOOLEAN;
  v_attempts INT := 0;
  v_max_attempts INT := 10;
BEGIN
  LOOP
    -- Generate code: EVT-XXXXX (5 alphanumeric uppercase chars)
    v_code := 'EVT-' || upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 5));

    -- Check for collision
    SELECT EXISTS(SELECT 1 FROM referral_profiles WHERE referral_code = v_code) INTO v_exists;

    EXIT WHEN NOT v_exists;

    v_attempts := v_attempts + 1;
    IF v_attempts >= v_max_attempts THEN
      RAISE EXCEPTION 'Failed to generate unique referral code after % attempts', v_max_attempts;
    END IF;
  END LOOP;

  RETURN v_code;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_referral_code() IS 'Generate unique referral code in EVT-XXXXX format with collision detection';

-- 4.2 Circular Referral Prevention Function
CREATE OR REPLACE FUNCTION check_circular_referral()
RETURNS TRIGGER AS $$
DECLARE
  v_current_id UUID := NEW.parent_referrer_id;
  v_depth INT := 0;
  v_max_depth INT := 10;
BEGIN
  -- Check if setting self as parent
  IF NEW.id = NEW.parent_referrer_id THEN
    RAISE EXCEPTION 'Cannot set self as parent referrer';
  END IF;

  -- Walk up the chain to detect cycles
  WHILE v_current_id IS NOT NULL AND v_depth < v_max_depth LOOP
    IF v_current_id = NEW.id THEN
      RAISE EXCEPTION 'Circular referral chain detected: agent cannot be their own ancestor';
    END IF;

    SELECT parent_referrer_id INTO v_current_id
    FROM referral_profiles WHERE id = v_current_id;

    v_depth := v_depth + 1;
  END LOOP;

  IF v_depth >= v_max_depth THEN
    RAISE EXCEPTION 'Referral chain exceeds maximum depth of %', v_max_depth;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_circular_referral() IS 'Prevent circular referral chains (A→B→C→A)';

-- 4.3 Enhanced Commission Calculation with Currency & Idempotency
CREATE OR REPLACE FUNCTION calculate_commissions_v2()
RETURNS TRIGGER AS $$
DECLARE
  v_referee_id UUID;
  v_referrer_id UUID;
  v_program_id UUID;
  v_level INT := 1;
  v_max_levels INT;
  v_commission_amount DECIMAL;
  v_order_amount DECIMAL;
  v_order_currency TEXT;
  v_program_config JSONB;
  v_level_config RECORD;
  v_existing_commission UUID;
BEGIN
  -- Only proceed if payment_status changed to 'paid'
  IF TG_OP = 'UPDATE' THEN
    IF OLD.payment_status = 'paid' OR NEW.payment_status != 'paid' THEN
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    IF NEW.payment_status != 'paid' THEN
      RETURN NEW;
    END IF;
  END IF;

  v_referee_id := NEW.customer_id;
  v_order_amount := COALESCE(NEW.amount_paid, NEW.amount_expected, 0);
  v_order_currency := COALESCE(NEW.currency, 'USD');

  -- Find active, non-expired referral
  SELECT r.referrer_id, r.program_id INTO v_referrer_id, v_program_id
  FROM referrals r
  WHERE r.referee_id = v_referee_id
    AND r.status = 'active'
    AND (r.expires_at IS NULL OR r.expires_at > NOW())
  LIMIT 1;

  IF v_referrer_id IS NULL THEN
    RETURN NEW; -- No referral found
  END IF;

  -- Update referral with conversion data (first purchase)
  UPDATE referrals
  SET converted_at = COALESCE(converted_at, NOW()),
      first_order_id = COALESCE(first_order_id, NEW.id)
  WHERE referee_id = v_referee_id AND first_order_id IS NULL;

  -- Get Program Config
  SELECT config INTO v_program_config FROM referral_programs WHERE id = v_program_id;
  v_max_levels := COALESCE((v_program_config->>'max_levels')::INT, 2);

  -- Loop through levels (with idempotency)
  WHILE v_referrer_id IS NOT NULL AND v_level <= v_max_levels LOOP

    -- Check idempotency (already processed this order+referrer+level?)
    SELECT id INTO v_existing_commission
    FROM commissions
    WHERE order_id = NEW.id AND referrer_id = v_referrer_id AND level = v_level;

    IF v_existing_commission IS NOT NULL THEN
      -- Already exists, skip to next level
      SELECT parent_referrer_id INTO v_referrer_id
      FROM referral_profiles WHERE id = v_referrer_id;
      v_level := v_level + 1;
      CONTINUE;
    END IF;

    -- Get commission rate for this level
    SELECT * INTO v_level_config
    FROM referral_program_levels
    WHERE program_id = v_program_id AND level = v_level;

    IF FOUND THEN
      -- Calculate Amount
      IF v_level_config.commission_type = 'percentage' THEN
        v_commission_amount := v_order_amount * (v_level_config.commission_value / 100);
      ELSE
        v_commission_amount := v_level_config.commission_value;
      END IF;

      -- Round to 2 decimal places
      v_commission_amount := ROUND(v_commission_amount, 2);

      -- Skip if zero commission
      IF v_commission_amount > 0 THEN
        -- Insert Commission with currency
        INSERT INTO commissions (
          order_id, referrer_id, level, amount, currency, order_amount,
          rate_snapshot, rate_type_snapshot, status
        ) VALUES (
          NEW.id, v_referrer_id, v_level, v_commission_amount, v_order_currency, v_order_amount,
          v_level_config.commission_value, v_level_config.commission_type, 'pending'
        );

        -- Log event
        INSERT INTO referral_events (event_type, referrer_id, order_id, data)
        VALUES ('commission_created', v_referrer_id, NEW.id,
          jsonb_build_object(
            'level', v_level,
            'amount', v_commission_amount,
            'currency', v_order_currency,
            'order_amount', v_order_amount,
            'commission_type', v_level_config.commission_type,
            'commission_rate', v_level_config.commission_value
          ));
      END IF;
    END IF;

    -- Get parent for next level
    SELECT parent_referrer_id INTO v_referrer_id
    FROM referral_profiles WHERE id = v_referrer_id;

    v_level := v_level + 1;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION calculate_commissions_v2() IS 'Calculate multi-level commissions with currency support and idempotency';

-- 4.4 Currency-Aware Balance Update Function
CREATE OR REPLACE FUNCTION update_referral_balance_v2()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle status change to 'paid'
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN
    IF NEW.currency = 'USD' THEN
      UPDATE referral_profiles
      SET total_earnings_usd = total_earnings_usd + NEW.amount,
          current_balance_usd = current_balance_usd + NEW.amount,
          updated_at = NOW()
      WHERE id = NEW.referrer_id;
    ELSE -- XAF
      UPDATE referral_profiles
      SET total_earnings_xaf = total_earnings_xaf + NEW.amount,
          current_balance_xaf = current_balance_xaf + NEW.amount,
          updated_at = NOW()
      WHERE id = NEW.referrer_id;
    END IF;

    -- Log event
    INSERT INTO referral_events (event_type, referrer_id, commission_id, data)
    VALUES ('commission_paid', NEW.referrer_id, NEW.id,
      jsonb_build_object('amount', NEW.amount, 'currency', NEW.currency, 'level', NEW.level));
  END IF;

  -- Handle reversal (status changes FROM 'paid' to something else)
  IF OLD.status = 'paid' AND NEW.status != 'paid' THEN
    IF OLD.currency = 'USD' THEN
      UPDATE referral_profiles
      SET total_earnings_usd = GREATEST(0, total_earnings_usd - OLD.amount),
          current_balance_usd = GREATEST(0, current_balance_usd - OLD.amount),
          updated_at = NOW()
      WHERE id = NEW.referrer_id;
    ELSE -- XAF
      UPDATE referral_profiles
      SET total_earnings_xaf = GREATEST(0, total_earnings_xaf - OLD.amount),
          current_balance_xaf = GREATEST(0, current_balance_xaf - OLD.amount),
          updated_at = NOW()
      WHERE id = NEW.referrer_id;
    END IF;

    -- Log event
    INSERT INTO referral_events (event_type, referrer_id, commission_id, data)
    VALUES ('commission_reversed', NEW.referrer_id, NEW.id,
      jsonb_build_object('amount', OLD.amount, 'currency', OLD.currency, 'reason', NEW.rejection_reason));
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION update_referral_balance_v2() IS 'Update agent balance when commission status changes, with currency support';

-- 4.5 Fraud Detection Function
CREATE OR REPLACE FUNCTION detect_referral_fraud()
RETURNS TRIGGER AS $$
DECLARE
  v_same_ip_count INT;
  v_rapid_signups INT;
  v_same_user_agent_count INT;
BEGIN
  -- Check 1: Same IP used multiple times in 24 hours
  IF NEW.ip_address IS NOT NULL THEN
    SELECT COUNT(*) INTO v_same_ip_count
    FROM referrals
    WHERE referrer_id = NEW.referrer_id
      AND ip_address = NEW.ip_address
      AND attributed_at > NOW() - INTERVAL '24 hours';

    IF v_same_ip_count >= 3 THEN
      INSERT INTO referral_fraud_signals (referrer_id, signal_type, severity, data)
      VALUES (NEW.referrer_id, 'same_ip_abuse', 'high',
        jsonb_build_object('ip', host(NEW.ip_address), 'count_24h', v_same_ip_count, 'referral_id', NEW.id));
    END IF;
  END IF;

  -- Check 2: Rapid signups (>10 in 1 hour)
  SELECT COUNT(*) INTO v_rapid_signups
  FROM referrals
  WHERE referrer_id = NEW.referrer_id
    AND attributed_at > NOW() - INTERVAL '1 hour';

  IF v_rapid_signups >= 10 THEN
    INSERT INTO referral_fraud_signals (referrer_id, signal_type, severity, data)
    VALUES (NEW.referrer_id, 'rapid_signups', 'medium',
      jsonb_build_object('count_1h', v_rapid_signups, 'referral_id', NEW.id));
  END IF;

  -- Check 3: Same user agent multiple times (potential bot)
  IF NEW.user_agent IS NOT NULL THEN
    SELECT COUNT(*) INTO v_same_user_agent_count
    FROM referrals
    WHERE referrer_id = NEW.referrer_id
      AND user_agent = NEW.user_agent
      AND attributed_at > NOW() - INTERVAL '24 hours';

    IF v_same_user_agent_count >= 5 THEN
      INSERT INTO referral_fraud_signals (referrer_id, signal_type, severity, data)
      VALUES (NEW.referrer_id, 'same_user_agent', 'medium',
        jsonb_build_object('user_agent', NEW.user_agent, 'count_24h', v_same_user_agent_count));
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION detect_referral_fraud() IS 'Detect fraud patterns in referral attribution';

-- 4.6 Enhanced Join Referral Program Function
CREATE OR REPLACE FUNCTION join_referral_program_v2(
  program_slug TEXT DEFAULT 'standard',
  parent_code TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_program_id UUID;
  v_parent_id UUID;
  v_user_id UUID := auth.uid();
  v_code TEXT;
  v_allow_self_signup BOOLEAN;
BEGIN
  -- Check if user already has a profile
  IF EXISTS (SELECT 1 FROM referral_profiles WHERE id = v_user_id) THEN
    RAISE EXCEPTION 'User already has a referral profile';
  END IF;

  -- Get Program
  SELECT id, allow_self_signup INTO v_program_id, v_allow_self_signup
  FROM referral_programs
  WHERE slug = program_slug AND is_active = TRUE;

  IF v_program_id IS NULL THEN
    RAISE EXCEPTION 'Program not found or inactive: %', program_slug;
  END IF;

  IF NOT v_allow_self_signup THEN
    RAISE EXCEPTION 'This program does not allow self-signup';
  END IF;

  -- Handle parent referrer (optional multi-level enrollment)
  IF parent_code IS NOT NULL THEN
    SELECT id INTO v_parent_id FROM referral_profiles WHERE referral_code = parent_code;
    IF v_parent_id IS NULL THEN
      RAISE EXCEPTION 'Parent referral code not found: %', parent_code;
    END IF;
  END IF;

  -- Generate unique code
  v_code := generate_referral_code();

  -- Create Profile
  INSERT INTO referral_profiles (id, referral_code, program_id, parent_referrer_id)
  VALUES (v_user_id, v_code, v_program_id, v_parent_id);

  -- Log event
  INSERT INTO referral_events (event_type, referrer_id, data)
  VALUES ('agent_signup', v_user_id, jsonb_build_object('program', program_slug, 'code', v_code));

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION join_referral_program_v2(TEXT, TEXT) IS 'Join referral program with optional parent code for multi-level';

-- 4.7 Enhanced Apply Referral Code Function
CREATE OR REPLACE FUNCTION apply_referral_code_v2(
  code TEXT,
  ip_addr TEXT DEFAULT NULL,
  user_agent_str TEXT DEFAULT NULL,
  landing_page_url TEXT DEFAULT NULL,
  utm_src TEXT DEFAULT NULL,
  utm_med TEXT DEFAULT NULL,
  utm_camp TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_referrer_id UUID;
  v_program_id UUID;
  v_referee_id UUID := auth.uid();
  v_ip_inet INET;
BEGIN
  -- Find Referrer
  SELECT id, program_id INTO v_referrer_id, v_program_id
  FROM referral_profiles
  WHERE referral_code = code AND status = 'active';

  IF v_referrer_id IS NULL THEN
    RETURN FALSE; -- Invalid or inactive code
  END IF;

  IF v_referrer_id = v_referee_id THEN
    RETURN FALSE; -- Self-referral
  END IF;

  -- Convert IP string to INET if provided
  IF ip_addr IS NOT NULL THEN
    BEGIN
      v_ip_inet := ip_addr::INET;
    EXCEPTION WHEN OTHERS THEN
      v_ip_inet := NULL; -- Invalid IP format
    END;
  END IF;

  -- Create Referral with tracking data
  INSERT INTO referrals (
    referrer_id, referee_id, program_id,
    ip_address, user_agent, landing_page,
    utm_source, utm_medium, utm_campaign,
    source
  )
  VALUES (
    v_referrer_id, v_referee_id, v_program_id,
    v_ip_inet, user_agent_str, landing_page_url,
    utm_src, utm_med, utm_camp,
    'link'
  )
  ON CONFLICT (referee_id) DO NOTHING;

  -- Log event
  INSERT INTO referral_events (event_type, referrer_id, referee_id, ip_address, data)
  VALUES ('referral_attributed', v_referrer_id, v_referee_id, v_ip_inet,
    jsonb_build_object('code', code, 'utm_source', utm_src, 'utm_campaign', utm_camp));

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION apply_referral_code_v2(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) IS 'Apply referral code with full attribution tracking';

-- =====================================================================
-- SECTION 5: CREATE TRIGGERS
-- =====================================================================

-- 5.1 Commission Calculation Trigger
CREATE TRIGGER trigger_calculate_commissions_v2
AFTER INSERT OR UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION calculate_commissions_v2();

-- 5.2 Balance Update Trigger
CREATE TRIGGER trigger_update_balance_v2
AFTER UPDATE ON commissions
FOR EACH ROW
EXECUTE FUNCTION update_referral_balance_v2();

-- 5.3 Circular Reference Check Trigger
CREATE TRIGGER trigger_check_circular_referral
BEFORE INSERT OR UPDATE ON referral_profiles
FOR EACH ROW
WHEN (NEW.parent_referrer_id IS NOT NULL)
EXECUTE FUNCTION check_circular_referral();

-- 5.4 Fraud Detection Trigger
CREATE TRIGGER trigger_detect_fraud
AFTER INSERT ON referrals
FOR EACH ROW
EXECUTE FUNCTION detect_referral_fraud();

-- =====================================================================
-- SECTION 6: ENABLE RLS ON NEW TABLES
-- =====================================================================

ALTER TABLE referral_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_fraud_signals ENABLE ROW LEVEL SECURITY;

-- 6.1 RLS Policies for referral_events

-- Agents can view their own events
CREATE POLICY "Agents can view own events" ON referral_events
  FOR SELECT USING (auth.uid() = referrer_id);

-- Admins can view all events
CREATE POLICY "Admins can view all events" ON referral_events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND admin_role IS NOT NULL)
  );

-- 6.2 RLS Policies for referral_fraud_signals

-- Admins can manage fraud signals
CREATE POLICY "Admins can manage fraud signals" ON referral_fraud_signals
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND admin_role IS NOT NULL)
  );

-- =====================================================================
-- SECTION 7: SEED DEFAULT DATA
-- =====================================================================

-- Insert default "Standard" program if it doesn't exist
INSERT INTO referral_programs (name, slug, description, config, is_active, minimum_payout_usd, minimum_payout_xaf)
VALUES (
  'Standard Affiliate Program',
  'standard',
  'Default 2-level affiliate program with 10% Level 1 and 5% Level 2 commission',
  jsonb_build_object(
    'max_levels', 2,
    'lifetime_duration_days', null,
    'commission_cap_usd', null,
    'commission_cap_xaf', null,
    'cap_period', 'none',
    'first_purchase_only', false,
    'min_order_amount_usd', 0,
    'min_order_amount_xaf', 0,
    'excluded_packages', '[]'::jsonb,
    'excluded_occasions', '[]'::jsonb
  ),
  true,
  10.00,
  5000.00
)
ON CONFLICT (slug) DO UPDATE SET
  config = EXCLUDED.config,
  minimum_payout_usd = EXCLUDED.minimum_payout_usd,
  minimum_payout_xaf = EXCLUDED.minimum_payout_xaf,
  updated_at = NOW();

-- Get the program ID for level seeding
DO $$
DECLARE
  v_program_id UUID;
BEGIN
  SELECT id INTO v_program_id FROM referral_programs WHERE slug = 'standard';

  -- Insert Level 1 (10% commission)
  INSERT INTO referral_program_levels (program_id, level, commission_type, commission_value)
  VALUES (v_program_id, 1, 'percentage', 10.00)
  ON CONFLICT (program_id, level) DO UPDATE SET
    commission_value = EXCLUDED.commission_value;

  -- Insert Level 2 (5% commission)
  INSERT INTO referral_program_levels (program_id, level, commission_type, commission_value)
  VALUES (v_program_id, 2, 'percentage', 5.00)
  ON CONFLICT (program_id, level) DO UPDATE SET
    commission_value = EXCLUDED.commission_value;
END $$;

-- =====================================================================
-- SECTION 8: MIGRATION METADATA
-- =====================================================================

COMMENT ON TABLE referral_events IS 'Audit log for referral system events (signup, attribution, commission_created, commission_paid, payout_requested, etc.)';
COMMENT ON TABLE referral_fraud_signals IS 'Fraud detection signals requiring admin review';

-- =====================================================================
-- END OF MIGRATION
-- =====================================================================
