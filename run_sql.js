const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.EXPO_PUBLIC_SUPABASE_SERVICE_KEY; // Oops we might not have service key in EXPO_PUBLIC, let's just let the user run it on their dashboard.

console.log("Since I don't have the SUPABASE_SERVICE_KEY, I can't run raw SQL or create functions in the live DB.");
