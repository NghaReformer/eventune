/**
 * Admin Service
 * Data fetching and operations for admin dashboard
 * Security: Input validation, SQL injection prevention, XSS sanitization
 */

import { getServerClient } from '../lib/supabase/server';
import { sanitizeString, sanitizeRevisionNotes, isValidUUID } from '../lib/security/validation';
import {
  ADMIN_CONFIG,
  ALLOWED_SORT_COLUMNS,
  VALID_ORDER_STATUSES,
  VALID_PAYMENT_STATUSES,
  getBusinessDate,
  type SortColumn,
} from '../config/admin.constants';

export interface AdminStats {
  totalOrders: number;
  pendingOrders: number;
  completedToday: number;
  revenueUSD: number;
  revenueXAF: number;
  ordersThisWeek: number;
  customersTotal: number;
}

export interface OrderListItem {
  id: string;
  order_number: string;
  customer_id: string;
  customer_email: string;
  customer_name: string;
  package_slug: string;
  occasion_slug: string;
  status: string;
  payment_status: string;
  currency: string;
  amount_expected: number;
  amount_paid: number;
  created_at: string;
  due_date: string | null;
}

export interface OrderFilters {
  status?: string;
  payment_status?: string;
  search?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

/**
 * Validate and sanitize order filters
 * Prevents SQL injection and invalid inputs
 */
function validateFilters(filters: OrderFilters): OrderFilters {
  const validated: OrderFilters = {};

  // Validate status against whitelist
  if (filters.status) {
    validated.status = VALID_ORDER_STATUSES.includes(filters.status as any)
      ? filters.status
      : 'all';
  }

  // Validate payment status against whitelist
  if (filters.payment_status) {
    validated.payment_status = VALID_PAYMENT_STATUSES.includes(filters.payment_status as any)
      ? filters.payment_status
      : undefined;
  }

  // Sanitize search string and escape SQL special chars
  if (filters.search) {
    const sanitized = sanitizeString(filters.search, ADMIN_CONFIG.SECURITY.MAX_SEARCH_LENGTH);
    // Escape SQL LIKE special characters
    validated.search = sanitized.replace(/[%_\\]/g, '\\$&');
  }

  // Validate date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (filters.date_from && dateRegex.test(filters.date_from)) {
    validated.date_from = filters.date_from;
  }
  if (filters.date_to && dateRegex.test(filters.date_to)) {
    validated.date_to = filters.date_to;
  }

  // Validate and cap pagination
  validated.page = Math.max(1, filters.page || 1);
  validated.limit = Math.min(
    ADMIN_CONFIG.PAGINATION.MAX_SIZE,
    Math.max(1, filters.limit || ADMIN_CONFIG.PAGINATION.DEFAULT_SIZE)
  );

  // Validate offset doesn't exceed max
  const offset = (validated.page - 1) * validated.limit;
  if (offset > ADMIN_CONFIG.PAGINATION.MAX_OFFSET) {
    validated.page = Math.floor(ADMIN_CONFIG.PAGINATION.MAX_OFFSET / validated.limit);
  }

  // Validate sort column against whitelist
  if (filters.sort_by) {
    validated.sort_by = ALLOWED_SORT_COLUMNS.includes(filters.sort_by as SortColumn)
      ? filters.sort_by
      : 'created_at';
  } else {
    validated.sort_by = 'created_at';
  }

  // Validate sort order
  validated.sort_order = filters.sort_order === 'asc' ? 'asc' : 'desc';

  return validated;
}

/**
 * Get admin dashboard statistics
 */
export async function getAdminStats(): Promise<AdminStats> {
  const supabase = getServerClient();
  const today = getBusinessDate(0);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Fetch all stats in parallel
  const [
    totalOrdersResult,
    pendingOrdersResult,
    completedTodayResult,
    revenueResult,
    weekOrdersResult,
    customersResult,
  ] = await Promise.all([
    // Total orders
    supabase.from('orders').select('*', { count: 'exact', head: true }),

    // Pending orders
    supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .in('status', ['pending', 'payment_pending']),

    // Completed today
    supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')
      .gte('updated_at', today),

    // Revenue (paid orders)
    supabase
      .from('orders')
      .select('currency, amount_paid')
      .eq('payment_status', 'paid'),

    // Orders this week
    supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', weekAgo),

    // Total customers
    supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .is('admin_role', null),
  ]);

  // Calculate revenue by currency
  let revenueUSD = 0;
  let revenueXAF = 0;
  if (revenueResult.data) {
    for (const order of revenueResult.data) {
      if (order.currency === 'USD') {
        revenueUSD += order.amount_paid || 0;
      } else if (order.currency === 'XAF') {
        revenueXAF += order.amount_paid || 0;
      }
    }
  }

  return {
    totalOrders: totalOrdersResult.count || 0,
    pendingOrders: pendingOrdersResult.count || 0,
    completedToday: completedTodayResult.count || 0,
    revenueUSD,
    revenueXAF,
    ordersThisWeek: weekOrdersResult.count || 0,
    customersTotal: customersResult.count || 0,
  };
}

/**
 * Get orders with filters and pagination
 * Security: All inputs validated and sanitized
 */
export async function getOrders(filters: OrderFilters = {}): Promise<{
  orders: OrderListItem[];
  total: number;
  page: number;
  limit: number;
}> {
  const supabase = getServerClient();

  // Validate and sanitize all filters
  const validated = validateFilters(filters);
  const page = validated.page!;
  const limit = validated.limit!;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('orders')
    .select('*', { count: 'exact' });

  // Apply filters with validated values only
  if (validated.status && validated.status !== 'all') {
    query = query.eq('status', validated.status);
  }

  if (validated.payment_status) {
    query = query.eq('payment_status', validated.payment_status);
  }

  // Safe search with escaped special characters
  if (validated.search) {
    query = query.or(
      `order_number.ilike.%${validated.search}%,customer_email.ilike.%${validated.search}%`
    );
  }

  if (validated.date_from) {
    query = query.gte('created_at', validated.date_from);
  }

  if (validated.date_to) {
    query = query.lte('created_at', validated.date_to);
  }

  // Apply sorting with validated column
  query = query.order(validated.sort_by!, { ascending: validated.sort_order === 'asc' });

  // Apply pagination
  query = query.range(offset, offset + limit - 1);

  const { data, count, error } = await query;

  if (error) {
    console.error('[ADMIN] Error fetching orders:', error.code, error.message);
    return { orders: [], total: 0, page, limit };
  }

  return {
    orders: data || [],
    total: count || 0,
    page,
    limit,
  };
}

/**
 * Get recent orders for dashboard
 */
export async function getRecentOrders(
  limit: number = ADMIN_CONFIG.UI.RECENT_ORDERS_LIMIT
): Promise<OrderListItem[]> {
  const supabase = getServerClient();

  // Cap limit to prevent DoS
  const safeLimit = Math.min(limit, ADMIN_CONFIG.PAGINATION.MAX_SIZE);

  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(safeLimit);

  if (error) {
    console.error('[ADMIN] Error fetching recent orders:', error.code);
    return [];
  }

  return data || [];
}

/**
 * Get single order with full details
 * Sanitizes user-generated content (notes, questionnaire)
 */
export async function getOrderById(orderId: string): Promise<{
  order: any;
  statusHistory: any[];
  questionnaire: any | null;
  notes: any[];
} | null> {
  // Validate UUID format
  if (!isValidUUID(orderId)) {
    return null;
  }

  const supabase = getServerClient();

  // Fetch order
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();

  if (orderError || !order) {
    return null;
  }

  // Fetch related data in parallel
  const [historyResult, questionnaireResult, notesResult] = await Promise.all([
    // Status history
    supabase
      .from('order_status_history')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true }),

    // Questionnaire
    order.questionnaire_id
      ? supabase
          .from('questionnaires')
          .select('*')
          .eq('id', order.questionnaire_id)
          .single()
      : Promise.resolve({ data: null }),

    // Internal notes (limit for performance)
    supabase
      .from('order_notes')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false })
      .limit(ADMIN_CONFIG.UI.NOTES_LIMIT),
  ]);

  // Sanitize questionnaire responses (XSS prevention)
  let sanitizedQuestionnaire = null;
  if (questionnaireResult.data) {
    sanitizedQuestionnaire = {
      ...questionnaireResult.data,
      responses: Object.entries(questionnaireResult.data.responses || {}).reduce(
        (acc, [key, val]) => ({
          ...acc,
          [key]: sanitizeString(String(val), 1000),
        }),
        {}
      ),
    };
  }

  // Sanitize notes content (XSS prevention)
  const sanitizedNotes = (notesResult.data || []).map((note) => ({
    ...note,
    content: sanitizeRevisionNotes(note.content || ''),
  }));

  return {
    order,
    statusHistory: historyResult.data || [],
    questionnaire: sanitizedQuestionnaire,
    notes: sanitizedNotes,
  };
}

/**
 * Get customer profile by ID
 */
export async function getCustomerById(customerId: string): Promise<any | null> {
  // Validate UUID format
  if (!isValidUUID(customerId)) {
    return null;
  }

  const supabase = getServerClient();

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', customerId)
    .single();

  if (error) {
    console.error('[ADMIN] Error fetching customer:', error.code);
    return null;
  }

  return data;
}

/**
 * Get order stats for charts (last 7 days)
 * Optimized: Single query instead of N queries in loop
 */
export async function getOrderTrends(): Promise<{
  labels: string[];
  orders: number[];
  revenue: number[];
}> {
  const supabase = getServerClient();
  const chartDays = ADMIN_CONFIG.UI.CHART_DAYS;
  const startDate = getBusinessDate(-chartDays + 1);

  // Single query to get all data
  const { data } = await supabase
    .from('orders')
    .select('created_at, amount_paid')
    .gte('created_at', startDate)
    .order('created_at', { ascending: true });

  // Build date map for quick lookup
  const dateMap = new Map<string, { count: number; revenue: number }>();

  // Initialize all days
  for (let i = chartDays - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    dateMap.set(dateStr, { count: 0, revenue: 0 });
  }

  // Aggregate data
  if (data) {
    for (const order of data) {
      const dateStr = order.created_at.split('T')[0];
      const existing = dateMap.get(dateStr);
      if (existing) {
        existing.count++;
        existing.revenue += order.amount_paid || 0;
      }
    }
  }

  // Build response arrays
  const labels: string[] = [];
  const orders: number[] = [];
  const revenue: number[] = [];

  for (let i = chartDays - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const dayData = dateMap.get(dateStr) || { count: 0, revenue: 0 };

    labels.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
    orders.push(dayData.count);
    revenue.push(dayData.revenue);
  }

  return { labels, orders, revenue };
}

/**
 * Update order status
 * Validates transition is allowed and logs audit trail
 */
export async function updateOrderStatus(
  orderId: string,
  newStatus: string,
  adminId: string,
  note?: string
): Promise<{ success: boolean; error?: string }> {
  if (!isValidUUID(orderId)) {
    return { success: false, error: 'Invalid order ID' };
  }

  if (!VALID_ORDER_STATUSES.includes(newStatus as any) || newStatus === 'all') {
    return { success: false, error: 'Invalid status' };
  }

  const supabase = getServerClient();

  // Get current order
  const { data: order, error: fetchError } = await supabase
    .from('orders')
    .select('status')
    .eq('id', orderId)
    .single();

  if (fetchError || !order) {
    return { success: false, error: 'Order not found' };
  }

  // Update order status
  const { error: updateError } = await supabase
    .from('orders')
    .update({
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId);

  if (updateError) {
    return { success: false, error: 'Failed to update status' };
  }

  // Record status history
  await supabase.from('order_status_history').insert({
    order_id: orderId,
    old_status: order.status,
    new_status: newStatus,
    changed_by: adminId,
    notes: note ? sanitizeRevisionNotes(note, 500) : null,
    created_at: new Date().toISOString(),
  });

  return { success: true };
}

/**
 * Add internal note to order
 */
export async function addOrderNote(
  orderId: string,
  adminId: string,
  adminEmail: string,
  content: string
): Promise<{ success: boolean; error?: string }> {
  if (!isValidUUID(orderId)) {
    return { success: false, error: 'Invalid order ID' };
  }

  const sanitizedContent = sanitizeRevisionNotes(content, ADMIN_CONFIG.SECURITY.MAX_NOTE_LENGTH);
  if (!sanitizedContent.trim()) {
    return { success: false, error: 'Note content is required' };
  }

  const supabase = getServerClient();

  const { error } = await supabase.from('order_notes').insert({
    order_id: orderId,
    admin_id: adminId,
    admin_email: adminEmail,
    content: sanitizedContent,
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error('[ADMIN] Error adding note:', error.code);
    return { success: false, error: 'Failed to add note' };
  }

  return { success: true };
}

/**
 * Get orders for CSV export
 * Limits data and excludes sensitive fields
 */
export async function getOrdersForExport(
  filters: OrderFilters,
  maxRows: number = 10000
): Promise<{
  orders: Partial<OrderListItem>[];
  total: number;
  truncated: boolean;
}> {
  const validated = validateFilters({ ...filters, limit: maxRows, page: 1 });
  const result = await getOrders(validated);

  // Remove sensitive fields for export
  const sanitizedOrders = result.orders.map((order) => ({
    order_number: order.order_number,
    customer_email: order.customer_email,
    customer_name: order.customer_name,
    package_slug: order.package_slug,
    occasion_slug: order.occasion_slug,
    status: order.status,
    payment_status: order.payment_status,
    currency: order.currency,
    amount_expected: order.amount_expected,
    amount_paid: order.amount_paid,
    created_at: order.created_at,
    due_date: order.due_date,
  }));

  return {
    orders: sanitizedOrders,
    total: result.total,
    truncated: result.total > maxRows,
  };
}

// ============================================
// ANALYTICS FUNCTIONS
// ============================================

export interface AnalyticsOverview {
  totalRevenue: { usd: number; xaf: number };
  totalOrders: number;
  totalCustomers: number;
  avgOrderValue: { usd: number; xaf: number };
  conversionRate: number;
  repeatCustomerRate: number;
}

export interface RevenueByPackage {
  package_slug: string;
  order_count: number;
  revenue_usd: number;
  revenue_xaf: number;
}

export interface RevenueByOccasion {
  occasion_slug: string;
  order_count: number;
  revenue_usd: number;
  revenue_xaf: number;
}

export interface OrderStatusDistribution {
  status: string;
  count: number;
  percentage: number;
}

export interface TrendDataPoint {
  date: string;
  label: string;
  orders: number;
  revenue_usd: number;
  revenue_xaf: number;
}

/**
 * Get analytics overview metrics
 */
export async function getAnalyticsOverview(
  dateFrom?: string,
  dateTo?: string
): Promise<AnalyticsOverview> {
  const supabase = getServerClient();

  // Build date filter
  let ordersQuery = supabase.from('orders').select('*');
  let customersQuery = supabase.from('profiles').select('id', { count: 'exact', head: true }).is('admin_role', null);

  if (dateFrom) {
    ordersQuery = ordersQuery.gte('created_at', dateFrom);
  }
  if (dateTo) {
    ordersQuery = ordersQuery.lte('created_at', dateTo);
  }

  const [ordersResult, customersResult] = await Promise.all([
    ordersQuery,
    customersQuery,
  ]);

  const orders = ordersResult.data || [];
  const totalCustomers = customersResult.count || 0;

  // Calculate revenue
  let totalUSD = 0;
  let totalXAF = 0;
  let paidOrdersUSD = 0;
  let paidOrdersXAF = 0;
  const customerOrderCounts = new Map<string, number>();

  for (const order of orders) {
    if (order.payment_status === 'paid') {
      if (order.currency === 'USD') {
        totalUSD += order.amount_paid || 0;
        paidOrdersUSD++;
      } else if (order.currency === 'XAF') {
        totalXAF += order.amount_paid || 0;
        paidOrdersXAF++;
      }
    }

    // Track customer order counts for repeat rate
    const customerId = order.customer_id;
    if (customerId) {
      customerOrderCounts.set(customerId, (customerOrderCounts.get(customerId) || 0) + 1);
    }
  }

  // Calculate metrics
  const avgUSD = paidOrdersUSD > 0 ? totalUSD / paidOrdersUSD : 0;
  const avgXAF = paidOrdersXAF > 0 ? totalXAF / paidOrdersXAF : 0;

  // Repeat customer rate (customers with 2+ orders)
  const repeatCustomers = Array.from(customerOrderCounts.values()).filter(c => c >= 2).length;
  const uniqueCustomers = customerOrderCounts.size;
  const repeatRate = uniqueCustomers > 0 ? (repeatCustomers / uniqueCustomers) * 100 : 0;

  // Conversion rate (paid / total orders)
  const totalPaidOrders = paidOrdersUSD + paidOrdersXAF;
  const conversionRate = orders.length > 0 ? (totalPaidOrders / orders.length) * 100 : 0;

  return {
    totalRevenue: { usd: totalUSD, xaf: totalXAF },
    totalOrders: orders.length,
    totalCustomers,
    avgOrderValue: { usd: Math.round(avgUSD), xaf: Math.round(avgXAF) },
    conversionRate: Math.round(conversionRate * 10) / 10,
    repeatCustomerRate: Math.round(repeatRate * 10) / 10,
  };
}

/**
 * Get revenue breakdown by package
 */
export async function getRevenueByPackage(): Promise<RevenueByPackage[]> {
  const supabase = getServerClient();

  const { data } = await supabase
    .from('orders')
    .select('package_slug, currency, amount_paid, payment_status')
    .eq('payment_status', 'paid');

  if (!data) return [];

  // Aggregate by package
  const packageMap = new Map<string, RevenueByPackage>();

  for (const order of data) {
    const pkg = order.package_slug || 'unknown';
    const existing = packageMap.get(pkg) || {
      package_slug: pkg,
      order_count: 0,
      revenue_usd: 0,
      revenue_xaf: 0,
    };

    existing.order_count++;
    if (order.currency === 'USD') {
      existing.revenue_usd += order.amount_paid || 0;
    } else if (order.currency === 'XAF') {
      existing.revenue_xaf += order.amount_paid || 0;
    }

    packageMap.set(pkg, existing);
  }

  return Array.from(packageMap.values()).sort((a, b) => b.order_count - a.order_count);
}

/**
 * Get revenue breakdown by occasion
 */
export async function getRevenueByOccasion(): Promise<RevenueByOccasion[]> {
  const supabase = getServerClient();

  const { data } = await supabase
    .from('orders')
    .select('occasion_slug, currency, amount_paid, payment_status')
    .eq('payment_status', 'paid');

  if (!data) return [];

  // Aggregate by occasion
  const occasionMap = new Map<string, RevenueByOccasion>();

  for (const order of data) {
    const occ = order.occasion_slug || 'unknown';
    const existing = occasionMap.get(occ) || {
      occasion_slug: occ,
      order_count: 0,
      revenue_usd: 0,
      revenue_xaf: 0,
    };

    existing.order_count++;
    if (order.currency === 'USD') {
      existing.revenue_usd += order.amount_paid || 0;
    } else if (order.currency === 'XAF') {
      existing.revenue_xaf += order.amount_paid || 0;
    }

    occasionMap.set(occ, existing);
  }

  return Array.from(occasionMap.values()).sort((a, b) => b.order_count - a.order_count);
}

/**
 * Get order status distribution
 */
export async function getOrderStatusDistribution(): Promise<OrderStatusDistribution[]> {
  const supabase = getServerClient();

  const { data } = await supabase.from('orders').select('status');

  if (!data || data.length === 0) return [];

  // Count by status
  const statusCounts = new Map<string, number>();
  for (const order of data) {
    const status = order.status || 'unknown';
    statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
  }

  const total = data.length;
  return Array.from(statusCounts.entries())
    .map(([status, count]) => ({
      status,
      count,
      percentage: Math.round((count / total) * 1000) / 10,
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Get extended trends (30/60/90 days)
 */
export async function getExtendedTrends(days: number = 30): Promise<TrendDataPoint[]> {
  const supabase = getServerClient();
  const safeDays = Math.min(Math.max(days, 7), 90); // Cap between 7-90 days
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - safeDays);

  const { data } = await supabase
    .from('orders')
    .select('created_at, currency, amount_paid, payment_status')
    .gte('created_at', startDate.toISOString())
    .order('created_at', { ascending: true });

  // Build date map
  const dateMap = new Map<string, { orders: number; revenue_usd: number; revenue_xaf: number }>();

  // Initialize all days
  for (let i = safeDays; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    dateMap.set(dateStr, { orders: 0, revenue_usd: 0, revenue_xaf: 0 });
  }

  // Aggregate data
  if (data) {
    for (const order of data) {
      const dateStr = order.created_at.split('T')[0];
      const existing = dateMap.get(dateStr);
      if (existing) {
        existing.orders++;
        if (order.payment_status === 'paid') {
          if (order.currency === 'USD') {
            existing.revenue_usd += order.amount_paid || 0;
          } else if (order.currency === 'XAF') {
            existing.revenue_xaf += order.amount_paid || 0;
          }
        }
      }
    }
  }

  // Build response
  const trends: TrendDataPoint[] = [];
  for (let i = safeDays; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const dayData = dateMap.get(dateStr) || { orders: 0, revenue_usd: 0, revenue_xaf: 0 };

    trends.push({
      date: dateStr,
      label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      orders: dayData.orders,
      revenue_usd: dayData.revenue_usd,
      revenue_xaf: dayData.revenue_xaf,
    });
  }

  return trends;
}

/**
 * Get top performing packages
 */
export async function getTopPackages(limit: number = 5): Promise<{
  package_slug: string;
  total_orders: number;
  total_revenue: number;
  avg_completion_days: number | null;
}[]> {
  const supabase = getServerClient();
  const safeLimit = Math.min(limit, 20);

  const { data } = await supabase
    .from('orders')
    .select('package_slug, amount_paid, payment_status, status, created_at, updated_at')
    .eq('payment_status', 'paid');

  if (!data) return [];

  // Aggregate
  const packageStats = new Map<string, {
    total_orders: number;
    total_revenue: number;
    completion_days: number[];
  }>();

  for (const order of data) {
    const pkg = order.package_slug || 'unknown';
    const existing = packageStats.get(pkg) || {
      total_orders: 0,
      total_revenue: 0,
      completion_days: [],
    };

    existing.total_orders++;
    existing.total_revenue += order.amount_paid || 0;

    // Track completion time
    if (order.status === 'completed' || order.status === 'delivered') {
      const created = new Date(order.created_at);
      const updated = new Date(order.updated_at);
      const days = Math.ceil((updated.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
      if (days >= 0 && days < 365) {
        existing.completion_days.push(days);
      }
    }

    packageStats.set(pkg, existing);
  }

  return Array.from(packageStats.entries())
    .map(([pkg, stats]) => ({
      package_slug: pkg,
      total_orders: stats.total_orders,
      total_revenue: stats.total_revenue,
      avg_completion_days: stats.completion_days.length > 0
        ? Math.round(stats.completion_days.reduce((a, b) => a + b, 0) / stats.completion_days.length)
        : null,
    }))
    .sort((a, b) => b.total_revenue - a.total_revenue)
    .slice(0, safeLimit);
}

/**
 * Get customer acquisition trends (new customers per period)
 */
export async function getCustomerAcquisitionTrends(days: number = 30): Promise<{
  date: string;
  label: string;
  new_customers: number;
}[]> {
  const supabase = getServerClient();
  const safeDays = Math.min(Math.max(days, 7), 90);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - safeDays);

  const { data } = await supabase
    .from('profiles')
    .select('created_at')
    .is('admin_role', null)
    .gte('created_at', startDate.toISOString())
    .order('created_at', { ascending: true });

  // Build date map
  const dateMap = new Map<string, number>();
  for (let i = safeDays; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    dateMap.set(date.toISOString().split('T')[0], 0);
  }

  // Count customers
  if (data) {
    for (const profile of data) {
      const dateStr = profile.created_at.split('T')[0];
      if (dateMap.has(dateStr)) {
        dateMap.set(dateStr, (dateMap.get(dateStr) || 0) + 1);
      }
    }
  }

  // Build response
  const trends: { date: string; label: string; new_customers: number }[] = [];
  for (let i = safeDays; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    trends.push({
      date: dateStr,
      label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      new_customers: dateMap.get(dateStr) || 0,
    });
  }

  return trends;
}

// ============================================
// CUSTOMER MANAGEMENT FUNCTIONS
// ============================================

export interface CustomerListItem {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string | null;
  order_count: number;
  total_spent_usd: number;
  total_spent_xaf: number;
  last_order_date: string | null;
}

export interface CustomerFilters {
  search?: string;
  has_orders?: boolean;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
  sort_by?: 'created_at' | 'full_name' | 'order_count' | 'total_spent';
  sort_order?: 'asc' | 'desc';
}

/**
 * Get customers with filters and pagination
 */
export async function getCustomers(filters: CustomerFilters = {}): Promise<{
  customers: CustomerListItem[];
  total: number;
  page: number;
  limit: number;
}> {
  const supabase = getServerClient();

  // Validate pagination
  const page = Math.max(1, filters.page || 1);
  const limit = Math.min(
    ADMIN_CONFIG.PAGINATION.MAX_SIZE,
    Math.max(1, filters.limit || ADMIN_CONFIG.PAGINATION.DEFAULT_SIZE)
  );
  const offset = (page - 1) * limit;

  // Cap offset
  if (offset > ADMIN_CONFIG.PAGINATION.MAX_OFFSET) {
    return { customers: [], total: 0, page, limit };
  }

  // Build query for profiles (non-admin users)
  let query = supabase
    .from('profiles')
    .select('*', { count: 'exact' })
    .is('admin_role', null);

  // Search filter
  if (filters.search) {
    const sanitized = sanitizeString(filters.search, ADMIN_CONFIG.SECURITY.MAX_SEARCH_LENGTH)
      .replace(/[%_\\]/g, '\\$&');
    query = query.or(`email.ilike.%${sanitized}%,full_name.ilike.%${sanitized}%`);
  }

  // Date filters
  if (filters.date_from) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (dateRegex.test(filters.date_from)) {
      query = query.gte('created_at', filters.date_from);
    }
  }
  if (filters.date_to) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (dateRegex.test(filters.date_to)) {
      query = query.lte('created_at', filters.date_to);
    }
  }

  // Sorting (only simple columns for now)
  const sortBy = filters.sort_by === 'full_name' ? 'full_name' : 'created_at';
  query = query.order(sortBy, { ascending: filters.sort_order === 'asc' });

  // Pagination
  query = query.range(offset, offset + limit - 1);

  const { data: profiles, count, error } = await query;

  if (error || !profiles) {
    console.error('[ADMIN] Error fetching customers:', error?.code);
    return { customers: [], total: 0, page, limit };
  }

  // Get order stats for each customer
  const customerIds = profiles.map(p => p.id);

  if (customerIds.length === 0) {
    return { customers: [], total: count || 0, page, limit };
  }

  const { data: orders } = await supabase
    .from('orders')
    .select('customer_id, currency, amount_paid, payment_status, created_at')
    .in('customer_id', customerIds);

  // Aggregate order data
  const orderStats = new Map<string, {
    order_count: number;
    total_spent_usd: number;
    total_spent_xaf: number;
    last_order_date: string | null;
  }>();

  if (orders) {
    for (const order of orders) {
      const stats = orderStats.get(order.customer_id) || {
        order_count: 0,
        total_spent_usd: 0,
        total_spent_xaf: 0,
        last_order_date: null,
      };

      stats.order_count++;

      if (order.payment_status === 'paid') {
        if (order.currency === 'USD') {
          stats.total_spent_usd += order.amount_paid || 0;
        } else if (order.currency === 'XAF') {
          stats.total_spent_xaf += order.amount_paid || 0;
        }
      }

      if (!stats.last_order_date || order.created_at > stats.last_order_date) {
        stats.last_order_date = order.created_at;
      }

      orderStats.set(order.customer_id, stats);
    }
  }

  // Build response
  let customers: CustomerListItem[] = profiles.map(profile => {
    const stats = orderStats.get(profile.id) || {
      order_count: 0,
      total_spent_usd: 0,
      total_spent_xaf: 0,
      last_order_date: null,
    };

    return {
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name,
      phone: profile.phone,
      created_at: profile.created_at,
      updated_at: profile.updated_at,
      ...stats,
    };
  });

  // Filter by has_orders if needed
  if (filters.has_orders === true) {
    customers = customers.filter(c => c.order_count > 0);
  } else if (filters.has_orders === false) {
    customers = customers.filter(c => c.order_count === 0);
  }

  // Sort by computed fields if needed
  if (filters.sort_by === 'order_count') {
    customers.sort((a, b) =>
      filters.sort_order === 'asc'
        ? a.order_count - b.order_count
        : b.order_count - a.order_count
    );
  } else if (filters.sort_by === 'total_spent') {
    customers.sort((a, b) => {
      const aTotal = a.total_spent_usd + (a.total_spent_xaf / 650);
      const bTotal = b.total_spent_usd + (b.total_spent_xaf / 650);
      return filters.sort_order === 'asc' ? aTotal - bTotal : bTotal - aTotal;
    });
  }

  return {
    customers,
    total: count || 0,
    page,
    limit,
  };
}

/**
 * Get customer detail with order history
 */
export async function getCustomerDetail(customerId: string): Promise<{
  customer: any;
  orders: OrderListItem[];
  stats: {
    total_orders: number;
    total_spent_usd: number;
    total_spent_xaf: number;
    completed_orders: number;
    avg_order_value: number;
  };
} | null> {
  if (!isValidUUID(customerId)) {
    return null;
  }

  const supabase = getServerClient();

  // Fetch customer profile
  const { data: customer, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', customerId)
    .is('admin_role', null)
    .single();

  if (error || !customer) {
    return null;
  }

  // Fetch customer's orders
  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(100);

  const orderList = orders || [];

  // Calculate stats
  let totalSpentUSD = 0;
  let totalSpentXAF = 0;
  let completedOrders = 0;

  for (const order of orderList) {
    if (order.payment_status === 'paid') {
      if (order.currency === 'USD') {
        totalSpentUSD += order.amount_paid || 0;
      } else if (order.currency === 'XAF') {
        totalSpentXAF += order.amount_paid || 0;
      }
    }
    if (order.status === 'completed' || order.status === 'delivered') {
      completedOrders++;
    }
  }

  const paidOrders = orderList.filter(o => o.payment_status === 'paid').length;
  const avgOrderValue = paidOrders > 0
    ? (totalSpentUSD + (totalSpentXAF / 650)) / paidOrders
    : 0;

  return {
    customer,
    orders: orderList,
    stats: {
      total_orders: orderList.length,
      total_spent_usd: totalSpentUSD,
      total_spent_xaf: totalSpentXAF,
      completed_orders: completedOrders,
      avg_order_value: Math.round(avgOrderValue),
    },
  };
}

// ============================================
// CONTENT MANAGEMENT FUNCTIONS
// ============================================

export interface ConfigPackage {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price_usd: number;
  price_xaf: number;
  song_length_min: number;
  song_length_max: number;
  includes_discovery_call: boolean;
  revision_count: number;
  includes_instrumental: boolean;
  includes_full_rights: boolean;
  delivery_days_min: number;
  delivery_days_max: number;
  display_order: number;
  is_popular: boolean;
  is_active: boolean;
}

export interface ConfigOccasion {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  tagline: string | null;
  icon: string | null;
  meta_title: string | null;
  meta_description: string | null;
  display_order: number;
  is_active: boolean;
}

export interface ConfigFAQ {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  display_order: number;
  is_active: boolean;
  locale: string;
}

export interface ConfigTestimonial {
  id: string;
  customer_name: string;
  customer_location: string | null;
  occasion: string | null;
  quote: string;
  rating: number | null;
  image_url: string | null;
  display_order: number;
  is_featured: boolean;
  is_active: boolean;
}

/**
 * Get all packages for content management
 */
export async function getContentPackages(): Promise<ConfigPackage[]> {
  const supabase = getServerClient();
  const { data } = await supabase
    .from('config_packages')
    .select('*')
    .order('display_order', { ascending: true });
  return data || [];
}

/**
 * Get all occasions for content management
 */
export async function getContentOccasions(): Promise<ConfigOccasion[]> {
  const supabase = getServerClient();
  const { data } = await supabase
    .from('config_occasions')
    .select('*')
    .order('display_order', { ascending: true });
  return data || [];
}

/**
 * Get all FAQ items for content management
 */
export async function getContentFAQ(): Promise<ConfigFAQ[]> {
  const supabase = getServerClient();
  const { data } = await supabase
    .from('config_faq')
    .select('*')
    .order('display_order', { ascending: true });
  return data || [];
}

/**
 * Get all testimonials for content management
 */
export async function getContentTestimonials(): Promise<ConfigTestimonial[]> {
  const supabase = getServerClient();
  const { data } = await supabase
    .from('config_testimonials')
    .select('*')
    .order('display_order', { ascending: true });
  return data || [];
}

/**
 * Toggle active status for content items
 */
export async function toggleContentActive(
  table: 'config_packages' | 'config_occasions' | 'config_faq' | 'config_testimonials',
  id: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  if (!isValidUUID(id)) {
    return { success: false, error: 'Invalid ID' };
  }

  const supabase = getServerClient();
  const { error } = await supabase
    .from(table)
    .update({ is_active: isActive })
    .eq('id', id);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Update package pricing
 */
export async function updatePackagePricing(
  id: string,
  priceUsd: number,
  priceXaf: number
): Promise<{ success: boolean; error?: string }> {
  if (!isValidUUID(id)) {
    return { success: false, error: 'Invalid ID' };
  }

  if (priceUsd < 0 || priceXaf < 0) {
    return { success: false, error: 'Prices must be positive' };
  }

  const supabase = getServerClient();
  const { error } = await supabase
    .from('config_packages')
    .update({
      price_usd: priceUsd,
      price_xaf: priceXaf,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Get site settings
 */
export async function getSiteSettings(): Promise<Record<string, any>> {
  const supabase = getServerClient();
  const { data } = await supabase.from('config_settings').select('*');

  if (!data) return {};

  const settings: Record<string, any> = {};
  for (const row of data) {
    settings[row.key] = row.value;
  }
  return settings;
}

/**
 * Update a site setting
 */
export async function updateSiteSetting(
  key: string,
  value: any,
  adminId: string
): Promise<{ success: boolean; error?: string }> {
  const sanitizedKey = sanitizeString(key, 100);
  if (!sanitizedKey) {
    return { success: false, error: 'Invalid key' };
  }

  const supabase = getServerClient();
  const { error } = await supabase
    .from('config_settings')
    .upsert({
      key: sanitizedKey,
      value,
      updated_at: new Date().toISOString(),
      updated_by: adminId,
    });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
