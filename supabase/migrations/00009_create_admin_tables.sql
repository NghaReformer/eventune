-- Admin Audit Log table for tracking admin actions
-- Security compliance and debugging

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_email TEXT NOT NULL,
  admin_role TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_audit_admin ON admin_audit_log(admin_id, created_at DESC);
CREATE INDEX idx_audit_resource ON admin_audit_log(resource_type, resource_id);
CREATE INDEX idx_audit_action ON admin_audit_log(action, created_at DESC);
CREATE INDEX idx_audit_created ON admin_audit_log(created_at DESC);

-- Order internal notes table
CREATE TABLE IF NOT EXISTS order_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_email TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for notes lookup by order
CREATE INDEX idx_order_notes_order ON order_notes(order_id, created_at DESC);

-- RLS policies for admin audit log
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Only super_admin can view audit logs
CREATE POLICY "Super admin can view audit logs"
  ON admin_audit_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND admin_role = 'super_admin'
    )
  );

-- Allow admins to insert audit logs
CREATE POLICY "Admins can insert audit logs"
  ON admin_audit_log
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND admin_role IS NOT NULL
    )
  );

-- RLS policies for order notes
ALTER TABLE order_notes ENABLE ROW LEVEL SECURITY;

-- Admins can view order notes
CREATE POLICY "Admins can view order notes"
  ON order_notes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND admin_role IS NOT NULL
    )
  );

-- Admins can insert order notes
CREATE POLICY "Admins can insert order notes"
  ON order_notes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND admin_role IS NOT NULL
    )
  );

-- Add status history note column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_status_history'
    AND column_name = 'notes'
  ) THEN
    ALTER TABLE order_status_history ADD COLUMN notes TEXT;
  END IF;
END $$;

COMMENT ON TABLE admin_audit_log IS 'Tracks all admin actions for security compliance';
COMMENT ON TABLE order_notes IS 'Internal admin notes for orders';
