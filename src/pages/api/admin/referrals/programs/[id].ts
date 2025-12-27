import type { APIRoute } from 'astro';
import { updateReferralProgram, deleteReferralProgram, toggleProgramStatus } from '../../../../services/admin-referral.service';
import { createServerClientWithToken } from '../../../../lib/supabase/server';

export const PUT: APIRoute = async ({ request, params, cookies }) => {
    const { id } = params;
    if (!id) return new Response(JSON.stringify({ error: 'ID required' }), { status: 400 });

    const accessToken = cookies.get('sb-access-token')?.value;
    if (!accessToken) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    const supabase = createServerClientWithToken(accessToken);

    try {
        const body = await request.json();
        const updated = await updateReferralProgram(id, body, supabase);

        return new Response(JSON.stringify(updated), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
};

export const DELETE: APIRoute = async ({ request, params, cookies }) => {
    const { id } = params;
    if (!id) return new Response(JSON.stringify({ error: 'ID required' }), { status: 400 });

    const accessToken = cookies.get('sb-access-token')?.value;
    if (!accessToken) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    const supabase = createServerClientWithToken(accessToken);

    try {
        await deleteReferralProgram(id, supabase);
        return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
};

// PATCH for toggling status efficiently
}
