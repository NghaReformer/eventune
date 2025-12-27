import type { APIRoute } from 'astro';
import { createReferralProgram, getReferralPrograms } from '../../../../services/admin-referral.service';
import { createServerClientWithToken } from '../../../../lib/supabase/server';

export const GET: APIRoute = async ({ request, cookies }) => {
    try {
        // Auth Check
        const accessToken = cookies.get('sb-access-token')?.value;
        if (!accessToken) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
        }

        // Create authenticated client
        const supabase = createServerClientWithToken(accessToken);

        const programs = await getReferralPrograms(supabase);
        return new Response(JSON.stringify(programs), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
};

export const POST: APIRoute = async ({ request, cookies }) => {
    try {
        // Auth Check
        const accessToken = cookies.get('sb-access-token')?.value;
        if (!accessToken) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
        }

        const supabase = createServerClientWithToken(accessToken);

        const body = await request.json();
        const program = await createReferralProgram(body, supabase);

        return new Response(JSON.stringify(program), {
            status: 201,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
};
