/**
 * Referral Service - Agent-Facing Operations
 * Handles all agent/affiliate dashboard operations
 */

import { getServerClient } from '../lib/supabase/server';
import type { Database } from '../types/database.types';

type ReferralProfile = Database['public']['Tables']['referral_profiles']['Row'];
type Referral = Database['public']['Tables']['referrals']['Row'];
type Commission = Database['public']['Tables']['commissions']['Row'];
type PayoutRequest = Database['public']['Tables']['payout_requests']['Row'];

export interface AgentProfile {
  id: string;
  referral_code: string;
  program_id: string | null;
  program_name: string | null;
  parent_referrer_id: string | null;
  total_earnings_usd: number;
  total_earnings_xaf: number;
  current_balance_usd: number;
  current_balance_xaf: number;
  payout_method: string | null;
  payout_details: Record<string, any>;
  tier_level: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface AgentStats {
  total_referrals: number;
  active_referrals: number;
  converted_referrals: number;
  conversion_rate: number;
  total_commissions_usd: number;
  total_commissions_xaf: number;
  pending_commissions_usd: number;
  pending_commissions_xaf: number;
  paid_commissions_usd: number;
  paid_commissions_xaf: number;
  total_orders: number;
}

export interface DashboardStats {
  profile: AgentProfile;
  stats: AgentStats;
  referral_link: string;
  minimum_payout_usd: number;
  minimum_payout_xaf: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CommissionFilters {
  status?: 'pending' | 'approved' | 'paid' | 'rejected';
  currency?: 'USD' | 'XAF';
  startDate?: string;
  endDate?: string;
  level?: number;
}

/**
 * Get agent profile with program details
 */
export async function getAgentProfile(userId: string): Promise<AgentProfile | null> {
  const supabase = getServerClient();

  const { data, error } = await supabase
    .from('referral_profiles')
    .select(`
      *,
      program:referral_programs(name)
    `)
    .eq('id', userId)
    .single();

  if (error) {
    console.error('[getAgentProfile] Error:', error);
    return null;
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    referral_code: data.referral_code,
    program_id: data.program_id,
    program_name: (data.program as any)?.name || null,
    parent_referrer_id: data.parent_referrer_id,
    total_earnings_usd: Number(data.total_earnings_usd || 0),
    total_earnings_xaf: Number(data.total_earnings_xaf || 0),
    current_balance_usd: Number(data.current_balance_usd || 0),
    current_balance_xaf: Number(data.current_balance_xaf || 0),
    payout_method: data.payout_method,
    payout_details: data.payout_details || {},
    tier_level: data.tier_level || 1,
    status: data.status,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

/**
 * Get agent statistics
 */
export async function getAgentStats(userId: string): Promise<AgentStats | null> {
  const supabase = getServerClient();

  // Get referral counts
  const { data: referralData, error: referralError } = await supabase
    .from('referrals')
    .select('id, status, converted_at', { count: 'exact' })
    .eq('referrer_id', userId);

  if (referralError) {
    console.error('[getAgentStats] Referral error:', referralError);
    return null;
  }

  const totalReferrals = referralData?.length || 0;
  const activeReferrals = referralData?.filter(r => r.status === 'active').length || 0;
  const convertedReferrals = referralData?.filter(r => r.converted_at !== null).length || 0;
  const conversionRate = totalReferrals > 0 ? (convertedReferrals / totalReferrals) * 100 : 0;

  // Get commission stats
  const { data: commissions, error: commissionError } = await supabase
    .from('commissions')
    .select('amount, currency, status, order_id')
    .eq('referrer_id', userId);

  if (commissionError) {
    console.error('[getAgentStats] Commission error:', commissionError);
    return null;
  }

  const totalCommissionsUsd = commissions
    ?.filter(c => c.currency === 'USD')
    .reduce((sum, c) => sum + Number(c.amount), 0) || 0;

  const totalCommissionsXaf = commissions
    ?.filter(c => c.currency === 'XAF')
    .reduce((sum, c) => sum + Number(c.amount), 0) || 0;

  const pendingCommissionsUsd = commissions
    ?.filter(c => c.currency === 'USD' && c.status === 'pending')
    .reduce((sum, c) => sum + Number(c.amount), 0) || 0;

  const pendingCommissionsXaf = commissions
    ?.filter(c => c.currency === 'XAF' && c.status === 'pending')
    .reduce((sum, c) => sum + Number(c.amount), 0) || 0;

  const paidCommissionsUsd = commissions
    ?.filter(c => c.currency === 'USD' && c.status === 'paid')
    .reduce((sum, c) => sum + Number(c.amount), 0) || 0;

  const paidCommissionsXaf = commissions
    ?.filter(c => c.currency === 'XAF' && c.status === 'paid')
    .reduce((sum, c) => sum + Number(c.amount), 0) || 0;

  // Count unique orders
  const uniqueOrders = new Set(commissions?.map(c => c.order_id)).size;

  return {
    total_referrals: totalReferrals,
    active_referrals: activeReferrals,
    converted_referrals: convertedReferrals,
    conversion_rate: Math.round(conversionRate * 100) / 100,
    total_commissions_usd: totalCommissionsUsd,
    total_commissions_xaf: totalCommissionsXaf,
    pending_commissions_usd: pendingCommissionsUsd,
    pending_commissions_xaf: pendingCommissionsXaf,
    paid_commissions_usd: paidCommissionsUsd,
    paid_commissions_xaf: paidCommissionsXaf,
    total_orders: uniqueOrders,
  };
}

/**
 * Get dashboard stats (profile + stats + referral link)
 */
export async function getAgentDashboardStats(userId: string, baseUrl: string): Promise<DashboardStats | null> {
  const [profile, stats] = await Promise.all([
    getAgentProfile(userId),
    getAgentStats(userId),
  ]);

  if (!profile || !stats) {
    return null;
  }

  // Get program minimum payout thresholds
  const supabase = getServerClient();
  const { data: program } = await supabase
    .from('referral_programs')
    .select('minimum_payout_usd, minimum_payout_xaf')
    .eq('id', profile.program_id!)
    .single();

  const referralLink = `${baseUrl}?ref=${profile.referral_code}`;

  return {
    profile,
    stats,
    referral_link: referralLink,
    minimum_payout_usd: Number(program?.minimum_payout_usd || 10),
    minimum_payout_xaf: Number(program?.minimum_payout_xaf || 5000),
  };
}

/**
 * Get paginated list of referred customers
 */
export async function getAgentReferrals(
  userId: string,
  page: number = 1,
  limit: number = 20
): Promise<PaginatedResult<Referral> | null> {
  const supabase = getServerClient();
  const offset = (page - 1) * limit;

  // Get total count
  const { count, error: countError } = await supabase
    .from('referrals')
    .select('*', { count: 'exact', head: true })
    .eq('referrer_id', userId);

  if (countError) {
    console.error('[getAgentReferrals] Count error:', countError);
    return null;
  }

  // Get paginated data
  const { data, error } = await supabase
    .from('referrals')
    .select('*')
    .eq('referrer_id', userId)
    .order('attributed_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('[getAgentReferrals] Error:', error);
    return null;
  }

  const total = count || 0;
  const totalPages = Math.ceil(total / limit);

  return {
    data: data || [],
    total,
    page,
    limit,
    totalPages,
  };
}

/**
 * Get paginated and filtered commissions
 */
export async function getAgentCommissions(
  userId: string,
  filters: CommissionFilters = {},
  page: number = 1,
  limit: number = 20
): Promise<PaginatedResult<Commission> | null> {
  const supabase = getServerClient();
  const offset = (page - 1) * limit;

  // Build query
  let query = supabase
    .from('commissions')
    .select('*, order:orders(order_number, customer_email)', { count: 'exact' })
    .eq('referrer_id', userId);

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  if (filters.currency) {
    query = query.eq('currency', filters.currency);
  }

  if (filters.level) {
    query = query.eq('level', filters.level);
  }

  if (filters.startDate) {
    query = query.gte('created_at', filters.startDate);
  }

  if (filters.endDate) {
    query = query.lte('created_at', filters.endDate);
  }

  // Get count
  const { count, error: countError } = await query;

  if (countError) {
    console.error('[getAgentCommissions] Count error:', countError);
    return null;
  }

  // Get paginated data
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('[getAgentCommissions] Error:', error);
    return null;
  }

  const total = count || 0;
  const totalPages = Math.ceil(total / limit);

  return {
    data: data || [],
    total,
    page,
    limit,
    totalPages,
  };
}

/**
 * Get agent payout history
 */
export async function getAgentPayouts(userId: string): Promise<PayoutRequest[]> {
  const supabase = getServerClient();

  const { data, error } = await supabase
    .from('payout_requests')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[getAgentPayouts] Error:', error);
    return [];
  }

  return data || [];
}

/**
 * Request a payout
 */
export async function requestPayout(
  userId: string,
  amount: number,
  currency: 'USD' | 'XAF'
): Promise<{ success: boolean; error?: string; data?: PayoutRequest }> {
  const supabase = getServerClient();

  // Get agent profile and program
  const profile = await getAgentProfile(userId);
  if (!profile) {
    return { success: false, error: 'Agent profile not found' };
  }

  // Get program minimum thresholds
  const { data: program, error: programError } = await supabase
    .from('referral_programs')
    .select('minimum_payout_usd, minimum_payout_xaf')
    .eq('id', profile.program_id!)
    .single();

  if (programError || !program) {
    return { success: false, error: 'Program configuration not found' };
  }

  // Validate minimum threshold
  const minPayout = currency === 'USD'
    ? Number(program.minimum_payout_usd)
    : Number(program.minimum_payout_xaf);

  if (amount < minPayout) {
    return {
      success: false,
      error: `Minimum payout is ${minPayout} ${currency}`,
    };
  }

  // Validate available balance
  const balance = currency === 'USD'
    ? profile.current_balance_usd
    : profile.current_balance_xaf;

  if (amount > balance) {
    return {
      success: false,
      error: `Insufficient balance. Available: ${balance} ${currency}`,
    };
  }

  // Check payout method is set
  if (!profile.payout_method) {
    return {
      success: false,
      error: 'Please set your payout method before requesting a payout',
    };
  }

  // Create payout request
  const { data, error } = await supabase
    .from('payout_requests')
    .insert({
      user_id: userId,
      amount,
      currency,
      payment_method: profile.payout_method,
      payment_details: profile.payout_details,
      status: 'requested',
    })
    .select()
    .single();

  if (error) {
    console.error('[requestPayout] Error:', error);
    return { success: false, error: 'Failed to create payout request' };
  }

  // Deduct from balance (optimistic - will be reversed if payout is rejected)
  const balanceField = currency === 'USD' ? 'current_balance_usd' : 'current_balance_xaf';
  await supabase
    .from('referral_profiles')
    .update({ [balanceField]: balance - amount })
    .eq('id', userId);

  return { success: true, data };
}

/**
 * Update payout settings
 */
export async function updatePayoutSettings(
  userId: string,
  method: 'mobile_money' | 'bank_transfer' | 'paypal',
  details: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  const supabase = getServerClient();

  // Validate details based on method
  if (method === 'mobile_money') {
    if (!details.phone || !details.operator) {
      return { success: false, error: 'Phone number and operator required for mobile money' };
    }
  } else if (method === 'bank_transfer') {
    if (!details.account_number || !details.bank_name || !details.account_name) {
      return { success: false, error: 'Account details required for bank transfer' };
    }
  } else if (method === 'paypal') {
    if (!details.email) {
      return { success: false, error: 'Email required for PayPal' };
    }
  }

  const { error } = await supabase
    .from('referral_profiles')
    .update({
      payout_method: method,
      payout_details: details,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    console.error('[updatePayoutSettings] Error:', error);
    return { success: false, error: 'Failed to update payout settings' };
  }

  return { success: true };
}
