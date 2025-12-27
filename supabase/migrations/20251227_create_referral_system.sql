-- Referral System Tables

-- 1. Referral Programs
CREATE TABLE referral_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  config JSONB DEFAULT '{"max_levels": 2, "lifetime_duration_days": 30, "commission_cap_per_user": null}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Program Levels (Commission Rates)
CREATE TABLE referral_program_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID REFERENCES referral_programs(id) ON DELETE CASCADE,
  level INT NOT NULL CHECK (level > 0),
  commission_type TEXT NOT NULL CHECK (commission_type IN ('percentage', 'fixed')),
  commission_value DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(program_id, level)
);

-- 3. Referral Profiles (Agents)
-- Linked to auth.users. Any user (client or not) can become an agent.
CREATE TABLE referral_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  referral_code TEXT UNIQUE NOT NULL,
  program_id UUID REFERENCES referral_programs(id),
  parent_referrer_id UUID REFERENCES referral_profiles(id), -- For multi-level hierarchy
  
  -- Financials
  total_earnings DECIMAL(10, 2) DEFAULT 0.00,
  current_balance DECIMAL(10, 2) DEFAULT 0.00,
  
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Referrals (Customer Attribution)
CREATE TABLE referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID REFERENCES referral_profiles(id) NOT NULL,
  referee_id UUID REFERENCES auth.users(id) NOT NULL, -- The Customer
  program_id UUID REFERENCES referral_programs(id), -- Snapshot of program at time of referral
  
  attributed_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ, -- Null = Lifetime
  
  status TEXT DEFAULT 'active',
  metadata JSONB,
  
  UNIQUE(referee_id) -- One active referrer per customer (simplification for now)
);

-- 5. Commissions (Earnings per Order)
CREATE TABLE commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) NOT NULL,
  referrer_id UUID REFERENCES referral_profiles(id) NOT NULL,
  
  level INT NOT NULL, -- 1 = Direct, 2 = Parent, etc.
  amount DECIMAL(10, 2) NOT NULL,
  
  -- Snapshots for audit
  rate_snapshot DECIMAL(10, 2) NOT NULL,
  rate_type_snapshot TEXT NOT NULL,
  
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'rejected')),
  metadata JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);

-- 6. Payout Requests
CREATE TABLE payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES referral_profiles(id) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  status TEXT DEFAULT 'requested' CHECK (status IN ('requested', 'processing', 'paid', 'rejected')),
  
  payment_method TEXT,
  payment_details JSONB,
  admin_notes TEXT,
  
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX idx_commissions_referrer ON commissions(referrer_id);
CREATE INDEX idx_commissions_order ON commissions(order_id);
CREATE INDEX idx_referral_profiles_code ON referral_profiles(referral_code);
CREATE INDEX idx_referral_profiles_parent ON referral_profiles(parent_referrer_id);

-- RLS Policies
ALTER TABLE referral_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_program_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_requests ENABLE ROW LEVEL SECURITY;

-- Public can read programs (for info)
CREATE POLICY "Public can view active programs" ON referral_programs
  FOR SELECT USING (is_active = true);

-- Agents can view their own profile
CREATE POLICY "Users can view own referral profile" ON referral_profiles
  FOR SELECT USING (auth.uid() = id);

-- Agents can view their referrals
CREATE POLICY "Agents can view their referrals" ON referrals
  FOR SELECT USING (auth.uid() = referrer_id);

-- Agents can view their commissions
CREATE POLICY "Agents can view their commissions" ON commissions
  FOR SELECT USING (auth.uid() = referrer_id);

-- Agents can manage their payout requests
CREATE POLICY "Agents can view own payout requests" ON payout_requests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Agents can create payout requests" ON payout_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admins have full access (assuming admin_role check from profiles)
-- Note: Using a simplified admin check for now, ideally should use a function or consistent policy
CREATE POLICY "Admins can do everything on referral_programs" ON referral_programs
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND admin_role IS NOT NULL));

CREATE POLICY "Admins can do everything on referral_program_levels" ON referral_program_levels
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND admin_role IS NOT NULL));

CREATE POLICY "Admins can do everything on referral_profiles" ON referral_profiles
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND admin_role IS NOT NULL));

CREATE POLICY "Admins can do everything on referrals" ON referrals
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND admin_role IS NOT NULL));

CREATE POLICY "Admins can do everything on commissions" ON commissions
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND admin_role IS NOT NULL));

CREATE POLICY "Admins can do everything on payout_requests" ON payout_requests
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND admin_role IS NOT NULL));

-- Comments
COMMENT ON TABLE referral_programs IS 'Configuration for different referral tiers/types';
COMMENT ON TABLE referral_profiles IS 'Extended profile for users participating in the referral program';
COMMENT ON TABLE commissions IS 'Earnings record per order with snapshot of rates used';
