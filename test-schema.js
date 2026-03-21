const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://rxnquxqknzbbtfepvtxk.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4bnF1eHFrbnpiYnRmZXB2dHhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyOTc2NjAsImV4cCI6MjA4Mzg3MzY2MH0.ZqcbDyrr9w5x4NJvhGEmNVn2-lsT5--Grwdb534ufrY";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function test() {
  const { data, error } = await supabase.from('sessions').select('*').limit(1);
  console.log(error || data);
}
test();
