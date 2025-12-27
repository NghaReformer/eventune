```typescript
import { supabase as globalSupabase } from '../lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

// Helper type for client
type Client = SupabaseClient<any, "public", any>;

export interface ReferralStats {
    totalAgents: number;
    totalPaid: number;
    totalPending: number;
    activePrograms: number;
}

export async function getReferralStats(client: Client = globalSupabase): Promise<ReferralStats> {
    // 1. Total Agents
    const { count: totalAgents } = await client
        .from('referral_profiles')
        .select('*', { count: 'exact', head: true });

    // 2. Active Programs
    const { count: activePrograms } = await client
        .from('referral_programs')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

    // 3. Financials (Paid)
    const { data: paidCommissions } = await client
        .from('commissions')
        .select('amount')
        .eq('status', 'paid');

    const totalPaid = paidCommissions?.reduce((sum, c) => sum + Number(c.amount), 0) || 0;

    // 4. Financials (Pending)
    const { data: pendingCommissions } = await client
        .from('commissions')
        .select('amount')
        .eq('status', 'pending');

    const totalPending = pendingCommissions?.reduce((sum, c) => sum + Number(c.amount), 0) || 0;

    return {
        totalAgents: totalAgents || 0,
        totalPaid,
        totalPending,
        activePrograms: activePrograms || 0
    };
}

export async function getRecentReferrals(limit = 5, client: Client = globalSupabase) {
    // Fetch referrals
    const { data: referrals, error } = await client
        .from('referrals')
        .select('*')
        .order('attributed_at', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('Error fetching referrals:', error);
        return [];
    }

    if (!referrals || referrals.length === 0) return [];

    // Fetch related profiles manually since we don't have direct FK to profiles table
    const userIds = referrals.map(r => r.referee_id);
    const referrerProfileIds = referrals.map(r => r.referrer_id);

    const { data: refereeProfiles } = await client
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

    const { data: referrerProfiles } = await client
        .from('referral_profiles')
        .select('id, referral_code')
        .in('id', referrerProfileIds);

    // Merge data
    return referrals.map(r => {
        const referee = refereeProfiles?.find(p => p.id === r.referee_id);
        const referrer = referrerProfiles?.find(p => p.id === r.referrer_id);
        return {
            ...r,
            referee_name: referee?.full_name || 'Unknown',
            referee_email: referee?.email || 'Unknown',
            referrer_code: referrer?.referral_code || 'Unknown'
        };
    });
}

export async function getRecentCommissions(limit = 5, client: Client = globalSupabase) {
    const { data: commissions, error } = await client
        .from('commissions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('Error fetching commissions:', error);
        return [];
    }

    if (!commissions || commissions.length === 0) return [];

    // Fetch referrer codes
    const referrerIds = commissions.map(c => c.referrer_id);
    const { data: referrers } = await client
        .from('referral_profiles')
        .select('id, referral_code')
        .in('id', referrerIds);

    return commissions.map(c => {
        const referrer = referrers?.find(r => r.id === c.referrer_id);
        return {
            ...c,
            referrer_code: referrer?.referral_code || 'Unknown'
        };
    });
}

// Programs Management

export async function getReferralPrograms(client: Client = globalSupabase) {
    const { data, error } = await client
        .from('referral_programs')
        .select(`
    *,
    levels: referral_program_levels(*)
        `)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching programs:', error);
        throw error;
    }

    return data;
}

export async function createReferralProgram(program: any, client: Client = globalSupabase) {
    const { name, slug, description, config, levels } = program;

    // 1. Create Program
    const { data: newProgram, error: programError } = await client
        .from('referral_programs')
        .insert({
            name,
            slug,
            description,
            config,
            is_active: true
        })
        .select()
        .single();

    if (programError) throw programError;

    // 2. Create Levels
    if (levels && levels.length > 0) {
        const levelsData = levels.map((l: any) => ({
            program_id: newProgram.id,
            level: l.level,
            commission_type: l.commission_type,
            commission_value: l.commission_value
        }));

        const { error: levelsError } = await client
            .from('referral_program_levels')
            .insert(levelsData);

        if (levelsError) throw levelsError;
    }

    return newProgram;
}

export async function updateReferralProgram(id: string, updates: any, client: Client = globalSupabase) {
    const { levels, ...programUpdates } = updates;

    // 1. Update Program details
    const { data: updatedProgram, error: programError } = await client
        .from('referral_programs')
        .update(programUpdates)
        .eq('id', id)
        .select()
        .single();

    if (programError) throw programError;

    // 2. Update Levels (Replace strategy for simplicity: Delete all for program, then re-create)
    // Note: In production, might want 'upsert' or diffing to preserve IDs if referenced elsewhere, 
    // but levels are mostly config.
    if (levels) {
        // Delete old levels
        await client
            .from('referral_program_levels')
            .delete()
            .eq('program_id', id);

        // Insert new levels
        if (levels.length > 0) {
            const levelsData = levels.map((l: any) => ({
                program_id: id,
                level: l.level,
                commission_type: l.commission_type,
                commission_value: l.commission_value
            }));

            const { error: levelsError } = await client
                .from('referral_program_levels')
                .insert(levelsData);

            if (levelsError) throw levelsError;
        }
    }

    return updatedProgram;
}

export async function deleteReferralProgram(id: string, client: Client = globalSupabase) {
    // Soft delete (deactivate) or hard delete?
    // Let's do hard delete for now as per schema cascading, 
    // but usually archiving is better. 
    // User requested "not see them", let's support delete.
    const { error } = await client
        .from('referral_programs')
        .delete()
        .eq('id', id);

    if (error) throw error;
    return true;
}

export async function toggleProgramStatus(id: string, isActive: boolean, client: Client = globalSupabase) {
    const { data, error } = await client
        .from('referral_programs')
        .update({ is_active: isActive })
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
}
