-- ============================================
-- ENUM TYPES
-- ============================================

-- Admin roles
CREATE TYPE admin_role AS ENUM ('super_admin', 'order_manager', 'support');

-- Payment status
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded');

-- Refund status
CREATE TYPE refund_status AS ENUM ('requested', 'approved', 'processed', 'denied');

-- Notification channel
CREATE TYPE notification_channel AS ENUM ('email', 'sms', 'whatsapp');

-- Notification status
CREATE TYPE notification_status AS ENUM ('pending', 'sent', 'failed');

-- Security event severity
CREATE TYPE security_severity AS ENUM ('low', 'medium', 'high', 'critical');
