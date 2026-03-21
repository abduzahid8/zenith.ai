const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://rxnquxqknzbbtfepvtxk.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4bnF1eHFrbnpiYnRmZXB2dHhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyOTc2NjAsImV4cCI6MjA4Mzg3MzY2MH0.ZqcbDyrr9w5x4NJvhGEmNVn2-lsT5--Grwdb534ufrY';

async function testDelete() {
  // Let's sign in a test account or just try to see if the RPC exists
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  // We can't sign in without creds, let's just make the rpc call anonymously to see if we get a 404 (not found) or 401 (not authenticated)
  const { data, error } = await supabase.rpc('delete_user_account');
  console.log('Result:', error ? error.message : 'Success');
  if (error) console.log(JSON.stringify(error, null, 2));
}

testDelete();
