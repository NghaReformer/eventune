/**
 * Admin Session Management
 * Extends base session with admin-specific role checking
 */

import type { AstroCookies } from 'astro';
import { getSession, type SessionData } from './session';

export interface AdminSessionData extends SessionData {
  adminRole: 'super_admin' | 'order_manager' | 'support';
  permissions: string[];
}

export type AdminSessionResult =
  | { success: true; data: AdminSessionData }
  | { success: false; error: { code: string; message: string } };

// Permission matrix by role
const ROLE_PERMISSIONS: Record<string, string[]> = {
  super_admin: [
    'dashboard:view',
    'orders:view', 'orders:update', 'orders:refund', 'orders:export',
    'customers:view', 'customers:update', 'customers:anonymize',
    'analytics:view', 'analytics:export',
    'content:view', 'content:update', 'content:delete',
    'settings:view', 'settings:update',
    'audit:view',
  ],
  order_manager: [
    'dashboard:view',
    'orders:view', 'orders:update',
    'customers:view',
    'analytics:view',
  ],
  support: [
    'dashboard:view',
    'orders:view',
    'customers:view',
  ],
};

/**
 * Get admin session with role verification
 */
export async function getAdminSession(cookies: AstroCookies): Promise<AdminSessionResult> {
  const sessionResult = await getSession(cookies);

  if (!sessionResult.success) {
    return {
      success: false,
      error: {
        code: 'NO_SESSION',
        message: 'Not authenticated',
      },
    };
  }

  const { profile } = sessionResult.data;
  const adminRole = profile?.admin_role as 'super_admin' | 'order_manager' | 'support' | null;

  if (!adminRole || !ROLE_PERMISSIONS[adminRole]) {
    return {
      success: false,
      error: {
        code: 'NOT_ADMIN',
        message: 'Access denied. Admin privileges required.',
      },
    };
  }

  return {
    success: true,
    data: {
      ...sessionResult.data,
      adminRole,
      permissions: ROLE_PERMISSIONS[adminRole],
    },
  };
}

/**
 * Check if admin has specific permission
 */
export function hasPermission(permissions: string[], permission: string): boolean {
  return permissions.includes(permission);
}

/**
 * Check if admin can access a resource
 */
export function canAccess(permissions: string[], resource: string, action: string = 'view'): boolean {
  return permissions.includes(`${resource}:${action}`);
}

/**
 * Get role display name
 */
export function getRoleDisplayName(role: string): string {
  const names: Record<string, string> = {
    super_admin: 'Super Admin',
    order_manager: 'Order Manager',
    support: 'Support',
  };
  return names[role] || role;
}

/**
 * Get role badge color classes
 */
export function getRoleBadgeClasses(role: string): string {
  const classes: Record<string, string> = {
    super_admin: 'bg-gold/20 text-gold border-gold/30',
    order_manager: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    support: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  };
  return classes[role] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
}

/**
 * Get permissions for a role
 */
export function getPermissionsForRole(role: string): string[] {
  return ROLE_PERMISSIONS[role] || [];
}
