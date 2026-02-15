export const config = {
    SUPABASE_URL: Deno.env.get('SUPABASE_URL') ?? '',
    SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    GEMINI_API_KEY: Deno.env.get('GEMINI_API_KEY') ?? '',
    GEMINI_MODEL: 'gemini-1.5-flash',
    CORS_HEADERS: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    }
};
