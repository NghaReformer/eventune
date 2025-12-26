-- ============================================
-- DATABASE FUNCTIONS & TRIGGERS
-- ============================================

-- ============================================
-- ORDER NUMBER GENERATION
-- ============================================

-- Generate order number in format: ES-YYYY-NNNN
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
  current_year TEXT;
  next_number INT;
  order_number TEXT;
BEGIN
  current_year := EXTRACT(YEAR FROM NOW())::TEXT;

  -- Get the next sequence number for this year
  SELECT COALESCE(MAX(
    CASE
      WHEN order_number LIKE 'ES-' || current_year || '-%'
      THEN NULLIF(SPLIT_PART(order_number, '-', 3), '')::INT
      ELSE 0
    END
  ), 0) + 1
  INTO next_number
  FROM orders
  WHERE order_number LIKE 'ES-' || current_year || '-%';

  -- Format: ES-2024-0001
  order_number := 'ES-' || current_year || '-' || LPAD(next_number::TEXT, 4, '0');

  RETURN order_number;
END;
$$ LANGUAGE plpgsql;

-- Trigger to set order number on insert
CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number := generate_order_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION set_order_number();

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables with updated_at
CREATE TRIGGER trigger_update_profiles
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_update_orders
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_update_questionnaires
  BEFORE UPDATE ON questionnaires
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_update_packages
  BEFORE UPDATE ON config_packages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================
-- PROFILE CREATION ON SIGNUP
-- ============================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================
-- ORDER STATUS CHANGE LOGGING
-- ============================================

CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO order_status_history (order_id, status, previous_status, changed_by)
    VALUES (NEW.id, NEW.status, OLD.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_log_order_status
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION log_order_status_change();

-- ============================================
-- CAPACITY TRACKING
-- ============================================

CREATE OR REPLACE FUNCTION update_capacity_on_order()
RETURNS TRIGGER AS $$
BEGIN
  -- Increment capacity when order is created
  IF TG_OP = 'INSERT' THEN
    INSERT INTO config_capacity (date, current_orders)
    VALUES (CURRENT_DATE, 1)
    ON CONFLICT (date)
    DO UPDATE SET current_orders = config_capacity.current_orders + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_capacity
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_capacity_on_order();

-- ============================================
-- GDPR ANONYMIZATION
-- ============================================

CREATE OR REPLACE FUNCTION anonymize_user(user_uuid UUID)
RETURNS void AS $$
BEGIN
  -- Anonymize profile
  UPDATE profiles SET
    full_name = 'Deleted User',
    email = 'deleted-' || user_uuid || '@anonymized.local',
    phone = NULL,
    admin_role = NULL,
    admin_2fa_secret = NULL,
    anonymized_at = NOW()
  WHERE id = user_uuid;

  -- Keep orders but remove personal data
  UPDATE orders SET
    customer_name = 'Deleted User',
    customer_email = 'deleted-' || customer_id || '@anonymized.local',
    customer_phone = NULL,
    notes = NULL
  WHERE customer_id = user_uuid;

  -- Delete questionnaires (sensitive data)
  DELETE FROM questionnaires
  WHERE order_id IN (SELECT id FROM orders WHERE customer_id = user_uuid);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- CALCULATE DUE DATE
-- ============================================

CREATE OR REPLACE FUNCTION calculate_due_date(package_slug TEXT, created_at TIMESTAMPTZ)
RETURNS DATE AS $$
DECLARE
  delivery_days INT;
BEGIN
  SELECT delivery_days_max INTO delivery_days
  FROM config_packages
  WHERE slug = package_slug;

  IF delivery_days IS NULL THEN
    delivery_days := 14; -- Default fallback
  END IF;

  RETURN (created_at + (delivery_days || ' days')::INTERVAL)::DATE;
END;
$$ LANGUAGE plpgsql;

-- Set due date on order creation
CREATE OR REPLACE FUNCTION set_order_due_date()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.due_date IS NULL AND NEW.package_slug IS NOT NULL THEN
    NEW.due_date := calculate_due_date(NEW.package_slug, NEW.created_at);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_due_date
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION set_order_due_date();
