import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase/client';
import { getSession } from '../../../lib/auth/session';

export const POST: APIRoute = async ({ request, cookies }) => {
    const session = await getSession(cookies);
    if (!session.success) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    try {
        // Call the RPC function we created
        const { data, error } = await supabase.rpc('join_referral_program', {
            program_slug: 'standard' // Default to standard for now
        });

        if (error) {
            return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }

        return new Response(JSON.stringify({ success: true, userId: data }), { status: 200 });
    } catch (e) {
        return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
    }
};
