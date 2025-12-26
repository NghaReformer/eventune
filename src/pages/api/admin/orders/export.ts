/**
 * API: Export Orders to CSV
 * GET /api/admin/orders/export
 *
 * Security: Admin auth, permission check, rate limiting, audit logging
 */

import type { APIRoute } from 'astro';
import { getAdminSession, hasPermission } from '../../../../lib/auth/admin-session';
import { getOrdersForExport } from '../../../../services/admin.service';
import { logAdminAction } from '../../../../lib/audit/logger';
import { checkRateLimit } from '../../../../lib/security/validation';
import { ADMIN_CONFIG, VALID_ORDER_STATUSES } from '../../../../config/admin.constants';

const MAX_EXPORT_ROWS = 10000;

export const GET: APIRoute = async ({ request, cookies, clientAddress }) => {
  // Rate limiting (strict for exports)
  const rateLimit = checkRateLimit(
    clientAddress,
    'admin-export',
    ADMIN_CONFIG.RATE_LIMITS.EXPORT.requests,
    ADMIN_CONFIG.RATE_LIMITS.EXPORT.window
  );

  if (!rateLimit.allowed) {
    return new Response(
      JSON.stringify({ error: 'Export limit reached. Please wait before trying again.' }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(Math.ceil(rateLimit.resetIn / 1000)),
        },
      }
    );
  }

  // Admin authentication
  const adminSession = await getAdminSession(cookies);
  if (!adminSession.success) {
    return new Response(
      JSON.stringify({ error: 'Authentication required' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Permission check (super_admin only)
  if (!hasPermission(adminSession.data.permissions, 'orders:export')) {
    return new Response(
      JSON.stringify({ error: 'Export permission required' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Parse query parameters
  const url = new URL(request.url);
  const rawStatus = url.searchParams.get('status') || 'all';
  const status = VALID_ORDER_STATUSES.includes(rawStatus as any) ? rawStatus : 'all';
  const dateFrom = url.searchParams.get('date_from') || undefined;
  const dateTo = url.searchParams.get('date_to') || undefined;

  // Get orders for export
  const result = await getOrdersForExport(
    { status, date_from: dateFrom, date_to: dateTo },
    MAX_EXPORT_ROWS
  );

  if (result.orders.length === 0) {
    return new Response(
      JSON.stringify({ error: 'No orders found matching the criteria' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Build CSV
  const headers = [
    'Order Number',
    'Customer Email',
    'Customer Name',
    'Package',
    'Occasion',
    'Status',
    'Payment Status',
    'Currency',
    'Amount Expected',
    'Amount Paid',
    'Created At',
    'Due Date',
  ];

  const escapeCSV = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvRows = [
    headers.join(','),
    ...result.orders.map((order) =>
      [
        escapeCSV(order.order_number),
        escapeCSV(order.customer_email),
        escapeCSV(order.customer_name),
        escapeCSV(order.package_slug),
        escapeCSV(order.occasion_slug),
        escapeCSV(order.status),
        escapeCSV(order.payment_status),
        escapeCSV(order.currency),
        escapeCSV(order.amount_expected),
        escapeCSV(order.amount_paid),
        escapeCSV(order.created_at ? new Date(order.created_at).toISOString() : ''),
        escapeCSV(order.due_date || ''),
      ].join(',')
    ),
  ];

  const csv = csvRows.join('\n');

  // Audit log
  await logAdminAction({
    admin_id: adminSession.data.user.id,
    admin_email: adminSession.data.user.email,
    admin_role: adminSession.data.adminRole,
    action: 'export.csv',
    resource_type: 'order',
    resource_id: 'bulk',
    metadata: {
      row_count: result.orders.length,
      total_available: result.total,
      truncated: result.truncated,
      filters: { status, date_from: dateFrom, date_to: dateTo },
    },
    ip_address: clientAddress,
    user_agent: request.headers.get('user-agent') || undefined,
  });

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `orders-export-${timestamp}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
};
