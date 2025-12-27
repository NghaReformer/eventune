# Referral System Implementation Plan - Eventune Studios

## Overview

A fully configurable, multi-level referral/affiliate system with:
- N-level commission structure (default 2 levels)
- Dual currency support (USD/XAF)
- Lifetime or time-limited attribution
- Fraud prevention & abuse detection
- Hybrid payout methods (Mobile Money, Bank Transfer, PayPal)
- Real-time commission tracking
- Agent self-service dashboard

---

## Phase 1: Schema Enhancements

### 1.1 Enhanced `referral_programs` Table

```sql
ALTER TABLE referral_programs ADD COLUMN IF NOT EXISTS
  minimum_payout_usd DECIMAL(10,2) DEFAULT 10.00,
  minimum_payout_xaf DECIMAL(10,2) DEFAULT 5000.00,
  cookie_duration_days INTEGER DEFAULT 30,
  require_first_purchase BOOLEAN DEFAULT FALSE,
  allow_self_signup BOOLEAN DEFAULT TRUE,
  terms_url TEXT,
  cap_period TEXT DEFAULT 'none' CHECK (cap_period IN ('none', 'monthly', 'yearly', 'lifetime'));
```

### 1.2 Enhanced `referral_profiles` Table

```sql
ALTER TABLE referral_profiles ADD COLUMN IF NOT EXISTS
  total_earnings_usd DECIMAL(10,2) DEFAULT 0.00,
  total_earnings_xaf DECIMAL(10,2) DEFAULT 0.00,
  current_balance_usd DECIMAL(10,2) DEFAULT 0.00,
  current_balance_xaf DECIMAL(10,2) DEFAULT 0.00,
  payout_method TEXT CHECK (payout_method IN ('mobile_money', 'bank_transfer', 'paypal')),
  payout_details JSONB DEFAULT '{}',
  tier_level INTEGER DEFAULT 1,
  notes TEXT,
  suspended_reason TEXT,
  suspended_at TIMESTAMPTZ;
```

### 1.3 Enhanced `referrals` Table (Attribution)

```sql
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS
  ip_address INET,
  user_agent TEXT,
  source TEXT DEFAULT 'link' CHECK (source IN ('link', 'manual', 'import', 'api')),
  landing_page TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  converted_at TIMESTAMPTZ,
  first_order_id UUID REFERENCES orders(id);
```

### 1.4 Enhanced `commissions` Table

```sql
ALTER TABLE commissions ADD COLUMN IF NOT EXISTS
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'XAF')),
  order_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  notes TEXT;

-- Idempotency constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_commissions_idempotent
  ON commissions(order_id, referrer_id, level);
```

### 1.5 Enhanced `payout_requests` Table

```sql
ALTER TABLE payout_requests ADD COLUMN IF NOT EXISTS
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'XAF')),
  transaction_reference TEXT,
  processed_by UUID REFERENCES auth.users(id),
  rejection_reason TEXT;
```

### 1.6 New `referral_events` Table (Audit Log)

```sql
CREATE TABLE IF NOT EXISTS referral_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  referrer_id UUID REFERENCES referral_profiles(id),
  referee_id UUID REFERENCES auth.users(id),
  order_id UUID REFERENCES orders(id),
  commission_id UUID REFERENCES commissions(id),
  data JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_referral_events_type ON referral_events(event_type);
CREATE INDEX idx_referral_events_referrer ON referral_events(referrer_id);
```

### 1.7 New `referral_fraud_signals` Table

```sql
CREATE TABLE IF NOT EXISTS referral_fraud_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID REFERENCES referral_profiles(id),
  signal_type TEXT NOT NULL,
  severity TEXT DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  data JSONB,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Phase 2: Enhanced Functions & Triggers

### 2.1 Improved Commission Calculation

```sql
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
  v_order_currency := NEW.currency;

  -- Find active, non-expired referral
  SELECT r.referrer_id, r.program_id INTO v_referrer_id, v_program_id
  FROM referrals r
  WHERE r.referee_id = v_referee_id
    AND r.status = 'active'
    AND (r.expires_at IS NULL OR r.expires_at > NOW());

  IF v_referrer_id IS NULL THEN
    RETURN NEW;
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

    -- Check idempotency (already processed this order+referrer+level)
    SELECT id INTO v_existing_commission
    FROM commissions
    WHERE order_id = NEW.id AND referrer_id = v_referrer_id AND level = v_level;

    IF v_existing_commission IS NOT NULL THEN
      -- Already exists, skip
      v_level := v_level + 1;
      SELECT parent_referrer_id INTO v_referrer_id
      FROM referral_profiles WHERE id = v_referrer_id;
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
        jsonb_build_object('level', v_level, 'amount', v_commission_amount, 'currency', v_order_currency));
    END IF;

    -- Get parent for next level
    SELECT parent_referrer_id INTO v_referrer_id
    FROM referral_profiles WHERE id = v_referrer_id;

    v_level := v_level + 1;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 2.2 Circular Reference Prevention

```sql
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
      RAISE EXCEPTION 'Circular referral chain detected';
    END IF;

    SELECT parent_referrer_id INTO v_current_id
    FROM referral_profiles WHERE id = v_current_id;

    v_depth := v_depth + 1;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_circular_referral
BEFORE INSERT OR UPDATE ON referral_profiles
FOR EACH ROW
WHEN (NEW.parent_referrer_id IS NOT NULL)
EXECUTE FUNCTION check_circular_referral();
```

### 2.3 Fraud Detection Signals

```sql
CREATE OR REPLACE FUNCTION detect_referral_fraud()
RETURNS TRIGGER AS $$
DECLARE
  v_same_ip_count INT;
  v_rapid_signups INT;
BEGIN
  -- Check 1: Same IP used multiple times
  SELECT COUNT(*) INTO v_same_ip_count
  FROM referrals
  WHERE referrer_id = NEW.referrer_id
    AND ip_address = NEW.ip_address
    AND ip_address IS NOT NULL
    AND attributed_at > NOW() - INTERVAL '24 hours';

  IF v_same_ip_count >= 3 THEN
    INSERT INTO referral_fraud_signals (referrer_id, signal_type, severity, data)
    VALUES (NEW.referrer_id, 'same_ip_abuse', 'high',
      jsonb_build_object('ip', NEW.ip_address, 'count', v_same_ip_count));
  END IF;

  -- Check 2: Rapid signups (>10 in 1 hour)
  SELECT COUNT(*) INTO v_rapid_signups
  FROM referrals
  WHERE referrer_id = NEW.referrer_id
    AND attributed_at > NOW() - INTERVAL '1 hour';

  IF v_rapid_signups >= 10 THEN
    INSERT INTO referral_fraud_signals (referrer_id, signal_type, severity, data)
    VALUES (NEW.referrer_id, 'rapid_signups', 'medium',
      jsonb_build_object('count_1h', v_rapid_signups));
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_detect_fraud
AFTER INSERT ON referrals
FOR EACH ROW
EXECUTE FUNCTION detect_referral_fraud();
```

### 2.4 Balance Update with Currency

```sql
CREATE OR REPLACE FUNCTION update_referral_balance_v2()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN
    IF NEW.currency = 'USD' THEN
      UPDATE referral_profiles
      SET total_earnings_usd = total_earnings_usd + NEW.amount,
          current_balance_usd = current_balance_usd + NEW.amount,
          updated_at = NOW()
      WHERE id = NEW.referrer_id;
    ELSE
      UPDATE referral_profiles
      SET total_earnings_xaf = total_earnings_xaf + NEW.amount,
          current_balance_xaf = current_balance_xaf + NEW.amount,
          updated_at = NOW()
      WHERE id = NEW.referrer_id;
    END IF;
  END IF;

  -- Handle reversal
  IF OLD.status = 'paid' AND NEW.status != 'paid' THEN
    IF NEW.currency = 'USD' THEN
      UPDATE referral_profiles
      SET total_earnings_usd = total_earnings_usd - OLD.amount,
          current_balance_usd = current_balance_usd - OLD.amount,
          updated_at = NOW()
      WHERE id = NEW.referrer_id;
    ELSE
      UPDATE referral_profiles
      SET total_earnings_xaf = total_earnings_xaf - OLD.amount,
          current_balance_xaf = current_balance_xaf - OLD.amount,
          updated_at = NOW()
      WHERE id = NEW.referrer_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 2.5 Referral Code Generation

```sql
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TEXT AS $$
DECLARE
  v_code TEXT;
  v_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate code: EVT-XXXXX (5 alphanumeric chars)
    v_code := 'EVT-' || upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 5));

    SELECT EXISTS(SELECT 1 FROM referral_profiles WHERE referral_code = v_code) INTO v_exists;

    EXIT WHEN NOT v_exists;
  END LOOP;

  RETURN v_code;
END;
$$ LANGUAGE plpgsql;
```

---

## Phase 3: API Endpoints

### 3.1 Public Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/referrals/apply` | POST | Apply referral code (cookie or direct) |
| `/api/referrals/join` | POST | Become an affiliate agent |
| `/api/referrals/validate/[code]` | GET | Check if referral code is valid |

### 3.2 Agent Dashboard Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/referrals/me` | GET | Get agent profile & stats |
| `/api/referrals/me/referrals` | GET | List referred customers |
| `/api/referrals/me/commissions` | GET | List commissions with filters |
| `/api/referrals/me/payouts` | GET | List payout requests |
| `/api/referrals/me/payouts` | POST | Request a payout |
| `/api/referrals/me/settings` | PATCH | Update payout method |

### 3.3 Admin Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/referrals/stats` | GET | Dashboard statistics |
| `/api/admin/referrals/programs` | GET/POST | Manage programs |
| `/api/admin/referrals/programs/[id]` | GET/PATCH/DELETE | Single program |
| `/api/admin/referrals/agents` | GET | List all agents |
| `/api/admin/referrals/agents/[id]` | GET/PATCH | Manage agent |
| `/api/admin/referrals/agents/[id]/suspend` | POST | Suspend agent |
| `/api/admin/referrals/commissions` | GET | List all commissions |
| `/api/admin/referrals/commissions/[id]` | PATCH | Approve/reject commission |
| `/api/admin/referrals/commissions/bulk` | POST | Bulk approve commissions |
| `/api/admin/referrals/payouts` | GET | List payout requests |
| `/api/admin/referrals/payouts/[id]` | PATCH | Process payout |
| `/api/admin/referrals/fraud` | GET | List fraud signals |

---

## Phase 4: Frontend Pages

### 4.1 Public Pages

- `/become-affiliate` - Landing page to join program
- Marketing/SEO optimized

### 4.2 Agent Dashboard (`/dashboard/referrals`)

- **Overview Tab**: Earnings summary, referral link, quick stats
- **Referrals Tab**: List of referred customers with status
- **Commissions Tab**: Commission history with filters
- **Payouts Tab**: Request payout, view history
- **Settings Tab**: Update payout method

### 4.3 Admin Pages (`/admin/referrals/*`)

- **Dashboard**: Key metrics, charts, alerts
- **Programs**: CRUD for referral programs
- **Agents**: List, search, filter, manage agents
- **Commissions**: Review pending, bulk approve, override
- **Payouts**: Process payout requests
- **Fraud**: Review and resolve fraud signals
- **Settings**: Global referral settings

---

## Phase 5: Cookie & Attribution Logic

### 5.1 Referral Link Flow

```
1. User clicks: eventunestudios.com/?ref=EVT-ABC12
2. Middleware detects `ref` param
3. Store in cookie: `evt_ref=EVT-ABC12` (30 days default)
4. Store in localStorage as backup
5. On signup/first purchase:
   - Read cookie/localStorage
   - Call apply_referral_code()
   - Create referral record with tracking data
```

### 5.2 Cookie Configuration (from program settings)

```typescript
const cookieConfig = {
  name: 'evt_ref',
  maxAge: program.cookie_duration_days * 24 * 60 * 60,
  sameSite: 'lax',
  secure: true,
  path: '/'
};
```

---

## Phase 6: Email Notifications

### 6.1 Agent Notifications

- Welcome email when joining program
- Commission earned notification
- Commission paid notification
- Payout processed notification
- Fraud alert (if applicable)

### 6.2 Admin Notifications

- New agent signup
- Large commission alert (configurable threshold)
- Fraud signal alert
- Payout request submitted

---

## Phase 7: Configuration Options

### 7.1 Global Settings (`config_settings`)

```json
{
  "referral_enabled": true,
  "default_program_slug": "standard",
  "require_admin_approval": false,
  "auto_approve_commissions": true,
  "auto_approve_threshold_usd": 100,
  "fraud_detection_enabled": true,
  "notify_on_signup": true,
  "notify_on_large_commission": true,
  "large_commission_threshold_usd": 50
}
```

### 7.2 Program-Level Settings (in `referral_programs.config`)

```json
{
  "max_levels": 2,
  "lifetime_duration_days": null,
  "commission_cap_usd": null,
  "commission_cap_xaf": null,
  "cap_period": "none",
  "first_purchase_only": false,
  "min_order_amount_usd": 0,
  "min_order_amount_xaf": 0,
  "excluded_packages": [],
  "excluded_occasions": []
}
```

---

## Phase 8: Testing Plan

### 8.1 Unit Tests

- [ ] Commission calculation (percentage & fixed)
- [ ] Multi-level chain traversal
- [ ] Currency handling (USD vs XAF)
- [ ] Cap enforcement (monthly, yearly, lifetime)
- [ ] Circular reference prevention
- [ ] Self-referral prevention

### 8.2 Integration Tests

- [ ] Full flow: Signup → Referral → Purchase → Commission
- [ ] Multi-level: A→B→C purchase flow
- [ ] Cookie persistence across sessions
- [ ] Payout request and processing
- [ ] Admin commission override

### 8.3 Security Tests

- [ ] RLS policy enforcement
- [ ] Cannot view other agents' data
- [ ] Cannot modify own commission amounts
- [ ] Admin-only endpoints protected

---

## Implementation Order

### Sprint 1: Schema & Core Logic (2-3 hours)
1. Apply schema migrations
2. Update triggers with v2 functions
3. Seed default "Standard" program

### Sprint 2: Agent Dashboard (2-3 hours)
1. Agent profile page
2. Referrals list
3. Commissions list
4. Payout request form

### Sprint 3: Admin Panel (2-3 hours)
1. Dashboard with stats
2. Programs CRUD
3. Agents management
4. Commission review

### Sprint 4: Attribution & Cookies (1-2 hours)
1. Middleware for ref param
2. Cookie handling
3. Attribution on signup/purchase

### Sprint 5: Notifications & Polish (1-2 hours)
1. Email templates
2. Real-time updates (optional)
3. Testing & bug fixes

---

## Files to Create/Modify

### New Files
- `supabase/migrations/20251227_referral_enhancements.sql`
- `src/services/referral.service.ts` (agent-facing)
- `src/pages/api/referrals/me.ts`
- `src/pages/api/referrals/me/payouts.ts`
- `src/pages/api/admin/referrals/agents/[id].ts`
- `src/pages/api/admin/referrals/commissions/[id].ts`
- `src/pages/api/admin/referrals/payouts/[id].ts`
- `src/pages/admin/referrals/fraud.astro`
- `src/pages/become-affiliate.astro`
- `src/middleware/referral.ts`

### Modify
- `src/pages/dashboard/referrals.astro` (enhance)
- `src/services/admin-referral.service.ts` (add missing functions)
- `src/pages/admin/referrals/*.astro` (enhance)
- `src/middleware/index.ts` (add referral tracking)

---

## Success Metrics

1. **Agent Activation Rate**: % of signups who refer at least 1 person
2. **Conversion Rate**: % of referred visitors who purchase
3. **Commission Accuracy**: 100% match between calculated and expected
4. **Fraud Detection Rate**: Signals caught before payout
5. **Payout Processing Time**: < 48 hours average
