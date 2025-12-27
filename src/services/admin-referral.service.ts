/**
 * Admin Referral Management Service
 * Handles admin-facing referral/affiliate system operations
 * Security: Input validation, SQL injection prevention, XSS sanitization
 */

import { getServerClient } from '../lib/supabase/server';
import { sanitizeString, isValidUUID } from '../lib/security/validation';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

export interface AgentListItem {
  id: string;
  referral_code: string;
  program_id: string | null;
  program_name: string | null;
  parent_referrer_id: string | null;
  parent_code: string | null;
  total_earnings_usd: number;
  total_earnings_xaf: number;
  current_balance_usd: number;
  current_balance_xaf: number;
  payout_method: string | null;
  tier_level: number;
  status: string;
  created_at: string;
  updated_at: string;
  // Computed stats
  referral_count?: number;
  conversion_count?: number;
  pending_commission_usd?: number;
  pending_commission_xaf?: number;
}

export interface AgentFilters {
  program?: string;
  status?: string;
  tier?: number;
  search?: string;
  has_earnings?: boolean;
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface AgentDetail extends AgentListItem {
  email: string;
  full_name: string | null;
  phone: string | null;
  payout_details: any;
  notes: string | null;
  suspended_reason: string | null;
  suspended_at: string | null;
  stats: {
    total_referrals: number;
    active_referrals: number;
    converted_referrals: number;
    total_commissions: number;
    paid_commissions: number;
    pending_commissions: number;
    rejected_commissions: number;
    total_payouts: number;
    conversion_rate: number;
  };
}

export interface CommissionListItem {
  id: string;
  order_id: string;
  order_number: string;
  referrer_id: string;
  referrer_code: string;
  level: number;
  amount: number;
  currency: string;
  order_amount: number;
  rate_snapshot: number;
  rate_type_snapshot: string;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  paid_at: string | null;
}

export interface CommissionFilters {
  status?: string;
  currency?: string;
  referrer_id?: string;
  order_id?: string;
  level?: number;
  min_amount?: number;
  max_amount?: number;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface PayoutListItem {
  id: string;
  user_id: string;
  referrer_code: string;
  amount: number;
  currency: string;
  status: string;
  payment_method: string | null;
  payment_details: any;
  transaction_reference: string | null;
  processed_by: string | null;
  processed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
}

export interface PayoutFilters {
  status?: string;
  currency?: string;
  user_id?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface FraudSignal {
  id: string;
  referrer_id: string;
  referrer_code: string;
  signal_type: string;
  severity: string;
  data: any;
  resolved: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

const VALID_AGENT_STATUSES = ['active', 'suspended', 'pending'];
const VALID_COMMISSION_STATUSES = ['pending', 'approved', 'paid', 'rejected'];
const VALID_PAYOUT_STATUSES = ['requested', 'processing', 'paid', 'rejected'];
const VALID_CURRENCIES = ['USD', 'XAF'];
const VALID_PAYOUT_METHODS = ['mobile_money', 'bank_transfer', 'paypal'];

function validateAgentFilters(filters: AgentFilters): AgentFilters {
  const validated: AgentFilters = {};

  if (filters.program) validated.program = sanitizeString(filters.program, 100);
  if (filters.status && VALID_AGENT_STATUSES.includes(filters.status)) {
    validated.status = filters.status;
  }
  if (filters.tier && filters.tier > 0 && filters.tier <= 10) {
    validated.tier = filters.tier;
  }
  if (filters.search) {
    validated.search = sanitizeString(filters.search, 200).replace(/[%_\\]/g, '\\$&');
  }
  if (filters.has_earnings !== undefined) validated.has_earnings = filters.has_earnings;

  validated.page = Math.max(1, filters.page || 1);
  validated.limit = Math.min(100, Math.max(1, filters.limit || 20));
  validated.sort_by = filters.sort_by || 'created_at';
  validated.sort_order = filters.sort_order === 'asc' ? 'asc' : 'desc';

  return validated;
}

function validateCommissionFilters(filters: CommissionFilters): CommissionFilters {
  const validated: CommissionFilters = {};

  if (filters.status && VALID_COMMISSION_STATUSES.includes(filters.status)) {
    validated.status = filters.status;
  }
  if (filters.currency && VALID_CURRENCIES.includes(filters.currency)) {
    validated.currency = filters.currency;
  }
  if (filters.referrer_id && isValidUUID(filters.referrer_id)) {
    validated.referrer_id = filters.referrer_id;
  }
  if (filters.order_id && isValidUUID(filters.order_id)) {
    validated.order_id = filters.order_id;
  }
  if (filters.level && filters.level > 0 && filters.level <= 10) {
    validated.level = filters.level;
  }
  if (filters.min_amount !== undefined && filters.min_amount >= 0) {
    validated.min_amount = filters.min_amount;
  }
  if (filters.max_amount !== undefined && filters.max_amount >= 0) {
    validated.max_amount = filters.max_amount;
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (filters.date_from && dateRegex.test(filters.date_from)) {
    validated.date_from = filters.date_from;
  }
  if (filters.date_to && dateRegex.test(filters.date_to)) {
    validated.date_to = filters.date_to;
  }

  validated.page = Math.max(1, filters.page || 1);
  validated.limit = Math.min(100, Math.max(1, filters.limit || 20));
  validated.sort_by = filters.sort_by || 'created_at';
  validated.sort_order = filters.sort_order === 'asc' ? 'asc' : 'desc';

  return validated;
}

function validatePayoutFilters(filters: PayoutFilters): PayoutFilters {
  const validated: PayoutFilters = {};

  if (filters.status && VALID_PAYOUT_STATUSES.includes(filters.status)) {
    validated.status = filters.status;
  }
  if (filters.currency && VALID_CURRENCIES.includes(filters.currency)) {
    validated.currency = filters.currency;
  }
  if (filters.user_id && isValidUUID(filters.user_id)) {
    validated.user_id = filters.user_id;
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (filters.date_from && dateRegex.test(filters.date_from)) {
    validated.date_from = filters.date_from;
  }
  if (filters.date_to && dateRegex.test(filters.date_to)) {
    validated.date_to = filters.date_to;
  }

  validated.page = Math.max(1, filters.page || 1);
  validated.limit = Math.min(100, Math.max(1, filters.limit || 20));
  validated.sort_by = filters.sort_by || 'created_at';
  validated.sort_order = filters.sort_order === 'asc' ? 'asc' : 'desc';

  return validated;
}

// =============================================================================
// AGENT MANAGEMENT FUNCTIONS
// =============================================================================

/**
 * Get paginated list of agents with filters
 */
export async function getAgentsList(filters: AgentFilters = {}): Promise<{
  agents: AgentListItem[];
  total: number;
  page: number;
  limit: number;
}> {
  const supabase = getServerClient();
  const validated = validateAgentFilters(filters);
  const page = validated.page!;
  const limit = validated.limit!;
  const offset = (page - 1) * limit;

  // Build query
  let query = supabase
    .from('referral_profiles')
    .select('*, referral_programs!inner(name)', { count: 'exact' });

  // Apply filters
  if (validated.program) {
    query = query.eq('referral_programs.slug', validated.program);
  }
  if (validated.status) {
    query = query.eq('status', validated.status);
  }
  if (validated.tier) {
    query = query.eq('tier_level', validated.tier);
  }
  if (validated.search) {
    query = query.ilike('referral_code', `%${validated.search}%`);
  }
  if (validated.has_earnings === true) {
    query = query.or('total_earnings_usd.gt.0,total_earnings_xaf.gt.0');
  } else if (validated.has_earnings === false) {
    query = query.eq('total_earnings_usd', 0).eq('total_earnings_xaf', 0);
  }

  // Sorting
  query = query.order(validated.sort_by!, { ascending: validated.sort_order === 'asc' });

  // Pagination
  query = query.range(offset, offset + limit - 1);

  const { data, count, error } = await query;

  if (error) {
    console.error('[ADMIN REFERRAL] Error fetching agents:', error);
    return { agents: [], total: 0, page, limit };
  }

  // Get parent codes
  const parentIds = data?.map((a: any) => a.parent_referrer_id).filter(Boolean) || [];
  let parentCodesMap = new Map<string, string>();

  if (parentIds.length > 0) {
    const { data: parents } = await supabase
      .from('referral_profiles')
      .select('id, referral_code')
      .in('id', parentIds);

    if (parents) {
      parentCodesMap = new Map(parents.map((p) => [p.id, p.referral_code]));
    }
  }

  // Get referral stats
  const agentIds = data?.map((a: any) => a.id) || [];
  const referralStats = await getReferralStatsForAgents(agentIds);
  const commissionStats = await getCommissionStatsForAgents(agentIds);

  const agents: AgentListItem[] = (data || []).map((agent: any) => ({
    id: agent.id,
    referral_code: agent.referral_code,
    program_id: agent.program_id,
    program_name: agent.referral_programs?.name || null,
    parent_referrer_id: agent.parent_referrer_id,
    parent_code: agent.parent_referrer_id ? parentCodesMap.get(agent.parent_referrer_id) || null : null,
    total_earnings_usd: agent.total_earnings_usd || 0,
    total_earnings_xaf: agent.total_earnings_xaf || 0,
    current_balance_usd: agent.current_balance_usd || 0,
    current_balance_xaf: agent.current_balance_xaf || 0,
    payout_method: agent.payout_method,
    tier_level: agent.tier_level || 1,
    status: agent.status,
    created_at: agent.created_at,
    updated_at: agent.updated_at,
    referral_count: referralStats.get(agent.id)?.total || 0,
    conversion_count: referralStats.get(agent.id)?.converted || 0,
    pending_commission_usd: commissionStats.get(agent.id)?.pending_usd || 0,
    pending_commission_xaf: commissionStats.get(agent.id)?.pending_xaf || 0,
  }));

  return {
    agents,
    total: count || 0,
    page,
    limit,
  };
}

/**
 * Get detailed agent information by ID
 */
export async function getAgentById(id: string): Promise<AgentDetail | null> {
  if (!isValidUUID(id)) return null;

  const supabase = getServerClient();

  // Get agent profile
  const { data: agent, error } = await supabase
    .from('referral_profiles')
    .select('*, referral_programs(name)')
    .eq('id', id)
    .single();

  if (error || !agent) return null;

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('email, full_name, phone')
    .eq('id', id)
    .single();

  // Get parent code
  let parentCode = null;
  if (agent.parent_referrer_id) {
    const { data: parent } = await supabase
      .from('referral_profiles')
      .select('referral_code')
      .eq('id', agent.parent_referrer_id)
      .single();
    parentCode = parent?.referral_code || null;
  }

  // Get stats
  const stats = await getAgentStats(id);

  return {
    id: agent.id,
    referral_code: agent.referral_code,
    program_id: agent.program_id,
    program_name: agent.referral_programs?.name || null,
    parent_referrer_id: agent.parent_referrer_id,
    parent_code: parentCode,
    total_earnings_usd: agent.total_earnings_usd || 0,
    total_earnings_xaf: agent.total_earnings_xaf || 0,
    current_balance_usd: agent.current_balance_usd || 0,
    current_balance_xaf: agent.current_balance_xaf || 0,
    payout_method: agent.payout_method,
    payout_details: agent.payout_details || {},
    tier_level: agent.tier_level || 1,
    status: agent.status,
    notes: agent.notes,
    suspended_reason: agent.suspended_reason,
    suspended_at: agent.suspended_at,
    created_at: agent.created_at,
    updated_at: agent.updated_at,
    email: profile?.email || '',
    full_name: profile?.full_name || null,
    phone: profile?.phone || null,
    stats,
  };
}

/**
 * Update agent information
 */
export async function updateAgent(
  id: string,
  updates: {
    program_id?: string;
    tier_level?: number;
    payout_method?: string;
    payout_details?: any;
    notes?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  if (!isValidUUID(id)) {
    return { success: false, error: 'Invalid agent ID' };
  }

  const supabase = getServerClient();
  const updateData: any = { updated_at: new Date().toISOString() };

  if (updates.program_id !== undefined) {
    if (updates.program_id && !isValidUUID(updates.program_id)) {
      return { success: false, error: 'Invalid program ID' };
    }
    updateData.program_id = updates.program_id;
  }

  if (updates.tier_level !== undefined) {
    if (updates.tier_level < 1 || updates.tier_level > 10) {
      return { success: false, error: 'Tier level must be between 1 and 10' };
    }
    updateData.tier_level = updates.tier_level;
  }

  if (updates.payout_method !== undefined) {
    if (updates.payout_method && !VALID_PAYOUT_METHODS.includes(updates.payout_method)) {
      return { success: false, error: 'Invalid payout method' };
    }
    updateData.payout_method = updates.payout_method;
  }

  if (updates.payout_details !== undefined) {
    updateData.payout_details = updates.payout_details;
  }

  if (updates.notes !== undefined) {
    updateData.notes = sanitizeString(updates.notes || '', 2000);
  }

  const { error } = await supabase
    .from('referral_profiles')
    .update(updateData)
    .eq('id', id);

  if (error) {
    console.error('[ADMIN REFERRAL] Error updating agent:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Suspend an agent
 */
export async function suspendAgent(
  id: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  if (!isValidUUID(id)) {
    return { success: false, error: 'Invalid agent ID' };
  }

  const sanitizedReason = sanitizeString(reason, 500);
  if (!sanitizedReason) {
    return { success: false, error: 'Suspension reason is required' };
  }

  const supabase = getServerClient();

  const { error } = await supabase
    .from('referral_profiles')
    .update({
      status: 'suspended',
      suspended_reason: sanitizedReason,
      suspended_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    console.error('[ADMIN REFERRAL] Error suspending agent:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Unsuspend an agent
 */
export async function unsuspendAgent(id: string): Promise<{ success: boolean; error?: string }> {
  if (!isValidUUID(id)) {
    return { success: false, error: 'Invalid agent ID' };
  }

  const supabase = getServerClient();

  const { error } = await supabase
    .from('referral_profiles')
    .update({
      status: 'active',
      suspended_reason: null,
      suspended_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    console.error('[ADMIN REFERRAL] Error unsuspending agent:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

// =============================================================================
// COMMISSION MANAGEMENT FUNCTIONS
// =============================================================================

/**
 * Get paginated list of commissions with filters
 */
export async function getCommissionsList(filters: CommissionFilters = {}): Promise<{
  commissions: CommissionListItem[];
  total: number;
  page: number;
  limit: number;
}> {
  const supabase = getServerClient();
  const validated = validateCommissionFilters(filters);
  const page = validated.page!;
  const limit = validated.limit!;
  const offset = (page - 1) * limit;

  // Build query
  let query = supabase
    .from('commissions')
    .select('*, orders!inner(order_number), referral_profiles!inner(referral_code)', { count: 'exact' });

  // Apply filters
  if (validated.status) {
    query = query.eq('status', validated.status);
  }
  if (validated.currency) {
    query = query.eq('currency', validated.currency);
  }
  if (validated.referrer_id) {
    query = query.eq('referrer_id', validated.referrer_id);
  }
  if (validated.order_id) {
    query = query.eq('order_id', validated.order_id);
  }
  if (validated.level) {
    query = query.eq('level', validated.level);
  }
  if (validated.min_amount !== undefined) {
    query = query.gte('amount', validated.min_amount);
  }
  if (validated.max_amount !== undefined) {
    query = query.lte('amount', validated.max_amount);
  }
  if (validated.date_from) {
    query = query.gte('created_at', validated.date_from);
  }
  if (validated.date_to) {
    query = query.lte('created_at', validated.date_to);
  }

  // Sorting
  query = query.order(validated.sort_by!, { ascending: validated.sort_order === 'asc' });

  // Pagination
  query = query.range(offset, offset + limit - 1);

  const { data, count, error } = await query;

  if (error) {
    console.error('[ADMIN REFERRAL] Error fetching commissions:', error);
    return { commissions: [], total: 0, page, limit };
  }

  const commissions: CommissionListItem[] = (data || []).map((c: any) => ({
    id: c.id,
    order_id: c.order_id,
    order_number: c.orders?.order_number || '',
    referrer_id: c.referrer_id,
    referrer_code: c.referral_profiles?.referral_code || '',
    level: c.level,
    amount: c.amount,
    currency: c.currency,
    order_amount: c.order_amount,
    rate_snapshot: c.rate_snapshot,
    rate_type_snapshot: c.rate_type_snapshot,
    status: c.status,
    approved_by: c.approved_by,
    approved_at: c.approved_at,
    rejection_reason: c.rejection_reason,
    created_at: c.created_at,
    paid_at: c.paid_at,
  }));

  return {
    commissions,
    total: count || 0,
    page,
    limit,
  };
}

/**
 * Approve a commission
 */
export async function approveCommission(
  id: string,
  adminId: string
): Promise<{ success: boolean; error?: string }> {
  if (!isValidUUID(id)) {
    return { success: false, error: 'Invalid commission ID' };
  }

  const supabase = getServerClient();

  const { error } = await supabase
    .from('commissions')
    .update({
      status: 'approved',
      approved_by: adminId,
      approved_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'pending');

  if (error) {
    console.error('[ADMIN REFERRAL] Error approving commission:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Reject a commission
 */
export async function rejectCommission(
  id: string,
  adminId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  if (!isValidUUID(id)) {
    return { success: false, error: 'Invalid commission ID' };
  }

  const sanitizedReason = sanitizeString(reason, 500);
  if (!sanitizedReason) {
    return { success: false, error: 'Rejection reason is required' };
  }

  const supabase = getServerClient();

  const { error } = await supabase
    .from('commissions')
    .update({
      status: 'rejected',
      approved_by: adminId,
      approved_at: new Date().toISOString(),
      rejection_reason: sanitizedReason,
    })
    .eq('id', id)
    .eq('status', 'pending');

  if (error) {
    console.error('[ADMIN REFERRAL] Error rejecting commission:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Bulk approve commissions
 */
export async function bulkApproveCommissions(
  ids: string[],
  adminId: string
): Promise<{ success: boolean; approved: number; error?: string }> {
  if (ids.length === 0) {
    return { success: false, approved: 0, error: 'No commission IDs provided' };
  }

  if (ids.length > 100) {
    return { success: false, approved: 0, error: 'Maximum 100 commissions can be approved at once' };
  }

  // Validate all IDs
  for (const id of ids) {
    if (!isValidUUID(id)) {
      return { success: false, approved: 0, error: 'Invalid commission ID in list' };
    }
  }

  const supabase = getServerClient();

  const { data, error } = await supabase
    .from('commissions')
    .update({
      status: 'approved',
      approved_by: adminId,
      approved_at: new Date().toISOString(),
    })
    .in('id', ids)
    .eq('status', 'pending')
    .select('id');

  if (error) {
    console.error('[ADMIN REFERRAL] Error bulk approving commissions:', error);
    return { success: false, approved: 0, error: error.message };
  }

  return { success: true, approved: data?.length || 0 };
}

// =============================================================================
// PAYOUT MANAGEMENT FUNCTIONS
// =============================================================================

/**
 * Get paginated list of payout requests with filters
 */
export async function getPayoutsList(filters: PayoutFilters = {}): Promise<{
  payouts: PayoutListItem[];
  total: number;
  page: number;
  limit: number;
}> {
  const supabase = getServerClient();
  const validated = validatePayoutFilters(filters);
  const page = validated.page!;
  const limit = validated.limit!;
  const offset = (page - 1) * limit;

  // Build query
  let query = supabase
    .from('payout_requests')
    .select('*, referral_profiles!inner(referral_code)', { count: 'exact' });

  // Apply filters
  if (validated.status) {
    query = query.eq('status', validated.status);
  }
  if (validated.currency) {
    query = query.eq('currency', validated.currency);
  }
  if (validated.user_id) {
    query = query.eq('user_id', validated.user_id);
  }
  if (validated.date_from) {
    query = query.gte('created_at', validated.date_from);
  }
  if (validated.date_to) {
    query = query.lte('created_at', validated.date_to);
  }

  // Sorting
  query = query.order(validated.sort_by!, { ascending: validated.sort_order === 'asc' });

  // Pagination
  query = query.range(offset, offset + limit - 1);

  const { data, count, error } = await query;

  if (error) {
    console.error('[ADMIN REFERRAL] Error fetching payouts:', error);
    return { payouts: [], total: 0, page, limit };
  }

  const payouts: PayoutListItem[] = (data || []).map((p: any) => ({
    id: p.id,
    user_id: p.user_id,
    referrer_code: p.referral_profiles?.referral_code || '',
    amount: p.amount,
    currency: p.currency,
    status: p.status,
    payment_method: p.payment_method,
    payment_details: p.payment_details,
    transaction_reference: p.transaction_reference,
    processed_by: p.processed_by,
    processed_at: p.processed_at,
    rejection_reason: p.rejection_reason,
    created_at: p.created_at,
  }));

  return {
    payouts,
    total: count || 0,
    page,
    limit,
  };
}

/**
 * Process a payout request (mark as paid)
 */
export async function processPayoutRequest(
  id: string,
  adminId: string,
  transactionRef: string
): Promise<{ success: boolean; error?: string }> {
  if (!isValidUUID(id)) {
    return { success: false, error: 'Invalid payout request ID' };
  }

  const sanitizedRef = sanitizeString(transactionRef, 200);
  if (!sanitizedRef) {
    return { success: false, error: 'Transaction reference is required' };
  }

  const supabase = getServerClient();

  // Get payout details
  const { data: payout, error: fetchError } = await supabase
    .from('payout_requests')
    .select('user_id, amount, currency')
    .eq('id', id)
    .eq('status', 'requested')
    .single();

  if (fetchError || !payout) {
    return { success: false, error: 'Payout request not found or already processed' };
  }

  // Update payout status
  const { error: updateError } = await supabase
    .from('payout_requests')
    .update({
      status: 'paid',
      transaction_reference: sanitizedRef,
      processed_by: adminId,
      processed_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (updateError) {
    console.error('[ADMIN REFERRAL] Error processing payout:', updateError);
    return { success: false, error: updateError.message };
  }

  // Deduct from agent balance
  const balanceField = payout.currency === 'USD' ? 'current_balance_usd' : 'current_balance_xaf';
  const { error: balanceError } = await supabase.rpc('update_agent_balance_subtract', {
    agent_id: payout.user_id,
    field_name: balanceField,
    amount: payout.amount,
  });

  if (balanceError) {
    console.error('[ADMIN REFERRAL] Error updating balance:', balanceError);
    // Note: Payout marked as paid, but balance update failed - needs manual review
  }

  return { success: true };
}

/**
 * Reject a payout request
 */
export async function rejectPayoutRequest(
  id: string,
  adminId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  if (!isValidUUID(id)) {
    return { success: false, error: 'Invalid payout request ID' };
  }

  const sanitizedReason = sanitizeString(reason, 500);
  if (!sanitizedReason) {
    return { success: false, error: 'Rejection reason is required' };
  }

  const supabase = getServerClient();

  const { error } = await supabase
    .from('payout_requests')
    .update({
      status: 'rejected',
      rejection_reason: sanitizedReason,
      processed_by: adminId,
      processed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'requested');

  if (error) {
    console.error('[ADMIN REFERRAL] Error rejecting payout:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

// =============================================================================
// FRAUD DETECTION FUNCTIONS
// =============================================================================

/**
 * Get fraud signals
 */
export async function getFraudSignals(resolved?: boolean): Promise<FraudSignal[]> {
  const supabase = getServerClient();

  let query = supabase
    .from('referral_fraud_signals')
    .select('*, referral_profiles!inner(referral_code)')
    .order('created_at', { ascending: false })
    .limit(100);

  if (resolved !== undefined) {
    query = query.eq('resolved', resolved);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[ADMIN REFERRAL] Error fetching fraud signals:', error);
    return [];
  }

  return (data || []).map((s: any) => ({
    id: s.id,
    referrer_id: s.referrer_id,
    referrer_code: s.referral_profiles?.referral_code || '',
    signal_type: s.signal_type,
    severity: s.severity,
    data: s.data,
    resolved: s.resolved,
    resolved_by: s.resolved_by,
    resolved_at: s.resolved_at,
    created_at: s.created_at,
  }));
}

/**
 * Resolve a fraud signal
 */
export async function resolveFraudSignal(
  id: string,
  adminId: string
): Promise<{ success: boolean; error?: string }> {
  if (!isValidUUID(id)) {
    return { success: false, error: 'Invalid fraud signal ID' };
  }

  const supabase = getServerClient();

  const { error } = await supabase
    .from('referral_fraud_signals')
    .update({
      resolved: true,
      resolved_by: adminId,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    console.error('[ADMIN REFERRAL] Error resolving fraud signal:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get referral stats for multiple agents
 */
async function getReferralStatsForAgents(
  agentIds: string[]
): Promise<Map<string, { total: number; converted: number }>> {
  if (agentIds.length === 0) return new Map();

  const supabase = getServerClient();

  const { data } = await supabase
    .from('referrals')
    .select('referrer_id, converted_at')
    .in('referrer_id', agentIds);

  const stats = new Map<string, { total: number; converted: number }>();

  for (const r of data || []) {
    const existing = stats.get(r.referrer_id) || { total: 0, converted: 0 };
    existing.total++;
    if (r.converted_at) existing.converted++;
    stats.set(r.referrer_id, existing);
  }

  return stats;
}

/**
 * Get commission stats for multiple agents
 */
async function getCommissionStatsForAgents(
  agentIds: string[]
): Promise<Map<string, { pending_usd: number; pending_xaf: number }>> {
  if (agentIds.length === 0) return new Map();

  const supabase = getServerClient();

  const { data } = await supabase
    .from('commissions')
    .select('referrer_id, amount, currency')
    .in('referrer_id', agentIds)
    .eq('status', 'pending');

  const stats = new Map<string, { pending_usd: number; pending_xaf: number }>();

  for (const c of data || []) {
    const existing = stats.get(c.referrer_id) || { pending_usd: 0, pending_xaf: 0 };
    if (c.currency === 'USD') {
      existing.pending_usd += c.amount;
    } else {
      existing.pending_xaf += c.amount;
    }
    stats.set(c.referrer_id, existing);
  }

  return stats;
}

/**
 * Get detailed stats for a single agent
 */
async function getAgentStats(agentId: string): Promise<AgentDetail['stats']> {
  const supabase = getServerClient();

  // Get referral stats
  const { data: referrals } = await supabase
    .from('referrals')
    .select('status, converted_at')
    .eq('referrer_id', agentId);

  const totalReferrals = referrals?.length || 0;
  const activeReferrals = referrals?.filter((r) => r.status === 'active').length || 0;
  const convertedReferrals = referrals?.filter((r) => r.converted_at !== null).length || 0;

  // Get commission stats
  const { data: commissions } = await supabase
    .from('commissions')
    .select('status')
    .eq('referrer_id', agentId);

  const totalCommissions = commissions?.length || 0;
  const paidCommissions = commissions?.filter((c) => c.status === 'paid').length || 0;
  const pendingCommissions = commissions?.filter((c) => c.status === 'pending').length || 0;
  const rejectedCommissions = commissions?.filter((c) => c.status === 'rejected').length || 0;

  // Get payout stats
  const { data: payouts } = await supabase
    .from('payout_requests')
    .select('status')
    .eq('user_id', agentId)
    .eq('status', 'paid');

  const totalPayouts = payouts?.length || 0;

  // Calculate conversion rate
  const conversionRate = totalReferrals > 0 ? (convertedReferrals / totalReferrals) * 100 : 0;

  return {
    total_referrals: totalReferrals,
    active_referrals: activeReferrals,
    converted_referrals: convertedReferrals,
    total_commissions: totalCommissions,
    paid_commissions: paidCommissions,
    pending_commissions: pendingCommissions,
    rejected_commissions: rejectedCommissions,
    total_payouts: totalPayouts,
    conversion_rate: Math.round(conversionRate * 10) / 10,
  };
}
