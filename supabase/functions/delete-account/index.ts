import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
            throw new Error('Supabase environment variables not set');
        }

        // Initialize admin client
        const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        });

        // Get the auth header
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
            throw new Error('Missing authorization header');
        }

        // Verify the user token to get their ID
        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
        
        if (userError || !user) {
            throw new Error('Invalid user token: ' + (userError?.message || 'User not found'));
        }

        console.log(`Deleting user account: ${user.id}`);

        // Delete the user from auth.users using the admin API
        // This will cascade and delete all associated data in other tables
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);

        if (deleteError) {
            throw new Error('Failed to delete user: ' + deleteError.message);
        }

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Delete account error:', message);

        return new Response(JSON.stringify({ error: message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
