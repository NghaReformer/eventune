-- Referral System Functions & Triggers

-- 1. Function to calculate commissions on order payment
CREATE OR REPLACE FUNCTION calculate_commissions()
RETURNS TRIGGER AS $$
DECLARE
  v_referee_id UUID;
  v_referrer_id UUID;
  v_program_id UUID;
  v_level INT := 1;
  v_max_levels INT;
  v_commission_amount DECIMAL;
  v_order_amount DECIMAL;
  v_program_config JSONB;
  v_level_config RECORD;
BEGIN
  -- Only proceed if payment_status changed to 'paid'
  -- Handle both INSERT (if created as paid) and UPDATE
  IF (TG_OP = 'UPDATE' AND (OLD.payment_status = 'paid' OR NEW.payment_status != 'paid')) THEN
    RETURN NEW;
  END IF;
  
  IF (TG_OP = 'INSERT' AND NEW.payment_status != 'paid') THEN
    RETURN NEW;
  END IF;

  -- Get referee (customer)
  -- Assuming orders.customer_id links to auth.users
  v_referee_id := NEW.customer_id;
  
  -- Find active referral
  SELECT referrer_id, program_id INTO v_referrer_id, v_program_id
  FROM referrals
  WHERE referee_id = v_referee_id
  AND status = 'active'
  AND (expires_at IS NULL OR expires_at > NOW());

  IF v_referrer_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get Program Config
  SELECT config INTO v_program_config FROM referral_programs WHERE id = v_program_id;
  v_max_levels := COALESCE((v_program_config->>'max_levels')::INT, 2);
  v_order_amount := COALESCE(NEW.amount_paid, 0);

  -- Loop through levels
  WHILE v_referrer_id IS NOT NULL AND v_level <= v_max_levels LOOP
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

      -- Insert Commission
      INSERT INTO commissions (
        order_id, referrer_id, level, amount, 
        rate_snapshot, rate_type_snapshot, status
      ) VALUES (
        NEW.id, v_referrer_id, v_level, v_commission_amount,
        v_level_config.commission_value, v_level_config.commission_type, 'pending'
      );
    END IF;

    -- Prepare for next level (Parent Referrer)
    SELECT parent_referrer_id INTO v_referrer_id
    FROM referral_profiles
    WHERE id = v_referrer_id;
    
    v_level := v_level + 1;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for Orders
CREATE TRIGGER trigger_calculate_commissions
AFTER INSERT OR UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION calculate_commissions();

-- 2. Function to update Agent Balance when commission is PAID
CREATE OR REPLACE FUNCTION update_referral_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- Only if status changes to 'paid'
  IF NEW.status = 'paid' AND (OLD.status != 'paid' OR OLD.status IS NULL) THEN
    UPDATE referral_profiles
    SET total_earnings = total_earnings + NEW.amount,
        current_balance = current_balance + NEW.amount
    WHERE id = NEW.referrer_id;
  END IF;
  
  -- Handle reversal (if status changes from 'paid' to something else)
  IF OLD.status = 'paid' AND NEW.status != 'paid' THEN
    UPDATE referral_profiles
    SET total_earnings = total_earnings - OLD.amount,
        current_balance = current_balance - OLD.amount
    WHERE id = NEW.referrer_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_balance
AFTER UPDATE ON commissions
FOR EACH ROW
EXECUTE FUNCTION update_referral_balance();

-- 3. Function to Join Program (Become an Agent)
CREATE OR REPLACE FUNCTION join_referral_program(program_slug TEXT DEFAULT 'standard')
RETURNS UUID AS $$
DECLARE
  v_program_id UUID;
  v_user_id UUID := auth.uid();
  v_code TEXT;
BEGIN
  -- Get Program
  SELECT id INTO v_program_id FROM referral_programs WHERE slug = program_slug;
  IF v_program_id IS NULL THEN
    RAISE EXCEPTION 'Program not found';
  END IF;

  -- Generate Code (8 chars, alphanumeric)
  v_code := lower(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));

  -- Create Profile
  INSERT INTO referral_profiles (id, referral_code, program_id)
  VALUES (v_user_id, v_code, v_program_id)
  ON CONFLICT (id) DO NOTHING; 

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Function to Apply Referral Code (Attribution)
CREATE OR REPLACE FUNCTION apply_referral_code(code TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_referrer_id UUID;
  v_program_id UUID;
  v_referee_id UUID := auth.uid();
BEGIN
  -- Find Referrer
  SELECT id, program_id INTO v_referrer_id, v_program_id
  FROM referral_profiles
  WHERE referral_code = code;

  IF v_referrer_id IS NULL THEN
    RETURN FALSE; -- Invalid code
  END IF;

  IF v_referrer_id = v_referee_id THEN
    RETURN FALSE; -- Self-referral
  END IF;

  -- Create Referral
  INSERT INTO referrals (referrer_id, referee_id, program_id)
  VALUES (v_referrer_id, v_referee_id, v_program_id)
  ON CONFLICT (referee_id) DO NOTHING;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
