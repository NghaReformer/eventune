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
  | 'content.delete'
  | 'occasion.create'
  | 'occasion.update'
  | 'occasion.delete'
  | 'sample.create'
  | 'sample.update'
  | 'sample.delete';

export type AuditResourceType = 'order' | 'customer' | 'analytics' | 'content' | 'settings' | 'occasion' | 'sample';

export interface AuditLogParams {
  admin_id: string;
  admin_email: string; // Not stored in DB, but kept for logging context
  admin_role?: string; // Not stored in DB, but kept for logging context
  action: AuditAction;
  resource_type: AuditResourceType;
  resource_id: string;
  metadata?: Record<string, unknown>;
  ip_address: string;
  user_agent?: string;
}

/**
 * Log an admin action to the audit trail
 * Note: DB schema uses entity_type/entity_id and old_data/new_data columns
 */
export async function logAdminAction(params: AuditLogParams): Promise<boolean> {
  try {
    const supabase = getServerClient();

    // Map to actual database column names
    const { error } = await supabase.from('admin_audit_log').insert({
      admin_id: params.admin_id,
      action: params.action,
      entity_type: params.resource_type, // DB column name
      entity_id: params.resource_id,     // DB column name
      new_data: params.metadata || null, // Store metadata in new_data column
      ip_address: params.ip_address,
      user_agent: params.user_agent || null,
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
    .eq('entity_type', resourceType)  // DB column name
    .eq('entity_id', resourceId)      // DB column name
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[AUDIT] Failed to fetch logs:', error.message);
    return [];
  }

  // Map DB columns to interface
  return (data || []).map(row => ({
    id: row.id,
    admin_id: row.admin_id,
    action: row.action as AuditAction,
    resource_type: row.entity_type as AuditResourceType,
    resource_id: row.entity_id,
    metadata: row.new_data as Record<string, unknown> || {},
    ip_address: row.ip_address,
    user_agent: row.user_agent,
    created_at: row.created_at,
  }));
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

  // Map DB columns to interface
  return (data || []).map(row => ({
    id: row.id,
    admin_id: row.admin_id,
    action: row.action as AuditAction,
    resource_type: row.entity_type as AuditResourceType,
    resource_id: row.entity_id,
    metadata: row.new_data as Record<string, unknown> || {},
    ip_address: row.ip_address,
    user_agent: row.user_agent,
    created_at: row.created_at,
  }));
}

export interface AuditLogEntry {
  id: string;
  admin_id: string;
  action: AuditAction;
  resource_type: AuditResourceType;
  resource_id: string;
  metadata: Record<string, unknown>;
  ip_address: string | null;
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
    'occasion.create': 'Created occasion',
    'occasion.update': 'Updated occasion',
    'occasion.delete': 'Deleted occasion',
    'sample.create': 'Created sample',
    'sample.update': 'Updated sample',
    'sample.delete': 'Deleted sample',
  };

  return actionLabels[action] || action;
}
