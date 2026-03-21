const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://rxnquxqknzbbtfepvtxk.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4bnF1eHFrbnpiYnRmZXB2dHhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyOTc2NjAsImV4cCI6MjA4Mzg3MzY2MH0.ZqcbDyrr9w5x4NJvhGEmNVn2-lsT5--Grwdb534ufrY';

async function test() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  // Just invoke it anonymously to see if we get a 401 or network error
  const { data, error } = await supabase.functions.invoke('delete-account');
  console.log('Invoke result:', { data, error });
}
test();
