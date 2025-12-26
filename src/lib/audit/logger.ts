/**
 * Admin Audit Logging
 * Tracks all admin actions for security compliance and debugging
 */

import { getServerClient } from '../supabase/server';

export type AuditAction =
  | 'order.view'
  | 'order.status_change'
  | 'order.refund'
  | 'order.note_add'
  | 'customer.view'
  | 'customer.update'
  | 'customer.anonymize'
  | 'export.csv'
  | 'export.report'
  | 'settings.update'
  | 'content.update'
  | 'content.toggle_active'
  | 'content.delete';

export type AuditResourceType = 'order' | 'customer' | 'analytics' | 'content' | 'settings';

export interface AuditLogParams {
  admin_id: string;
  admin_email: string;
  admin_role: string;
  action: AuditAction;
  resource_type: AuditResourceType;
  resource_id: string;
  metadata?: Record<string, unknown>;
  ip_address: string;
  user_agent?: string;
}

/**
 * Log an admin action to the audit trail
 */
export async function logAdminAction(params: AuditLogParams): Promise<boolean> {
  try {
    const supabase = getServerClient();

    const { error } = await supabase.from('admin_audit_log').insert({
      admin_id: params.admin_id,
      admin_email: params.admin_email,
      admin_role: params.admin_role,
      action: params.action,
      resource_type: params.resource_type,
      resource_id: params.resource_id,
      metadata: params.metadata || {},
      ip_address: params.ip_address,
      user_agent: params.user_agent || null,
      created_at: new Date().toISOString(),
    });

    if (error) {
      // Log to console but don't fail the request
      console.error('[AUDIT] Failed to log action:', error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[AUDIT] Exception logging action:', err);
    return false;
  }
}

/**
 * Get audit logs for a specific resource
 */
export async function getAuditLogs(
  resourceType: AuditResourceType,
  resourceId: string,
  limit: number = 50
): Promise<AuditLogEntry[]> {
  const supabase = getServerClient();

  const { data, error } = await supabase
    .from('admin_audit_log')
    .select('*')
    .eq('resource_type', resourceType)
    .eq('resource_id', resourceId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[AUDIT] Failed to fetch logs:', error.message);
    return [];
  }

  return data || [];
}

/**
 * Get audit logs by admin
 */
export async function getAuditLogsByAdmin(
  adminId: string,
  limit: number = 100
): Promise<AuditLogEntry[]> {
  const supabase = getServerClient();

  const { data, error } = await supabase
    .from('admin_audit_log')
    .select('*')
    .eq('admin_id', adminId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[AUDIT] Failed to fetch admin logs:', error.message);
    return [];
  }

  return data || [];
}

export interface AuditLogEntry {
  id: string;
  admin_id: string;
  admin_email: string;
  admin_role: string;
  action: AuditAction;
  resource_type: AuditResourceType;
  resource_id: string;
  metadata: Record<string, unknown>;
  ip_address: string;
  user_agent: string | null;
  created_at: string;
}

/**
 * Format audit action for display
 */
export function formatAuditAction(action: AuditAction): string {
  const actionLabels: Record<AuditAction, string> = {
    'order.view': 'Viewed order',
    'order.status_change': 'Changed order status',
    'order.refund': 'Processed refund',
    'order.note_add': 'Added note',
    'customer.view': 'Viewed customer',
    'customer.update': 'Updated customer',
    'customer.anonymize': 'Anonymized customer data',
    'export.csv': 'Exported to CSV',
    'export.report': 'Generated report',
    'settings.update': 'Updated settings',
    'content.update': 'Updated content',
    'content.toggle_active': 'Toggled content status',
    'content.delete': 'Deleted content',
  };

  return actionLabels[action] || action;
}
