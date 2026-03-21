const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
// just mock a client and print the keys exist
console.log(!!SUPABASE_URL, !!SUPABASE_ANON_KEY);
