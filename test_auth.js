const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://rxnquxqknzbbtfepvtxk.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4bnF1eHFrbnpiYnRmZXB2dHhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyOTc2NjAsImV4cCI6MjA4Mzg3MzY2MH0.ZqcbDyrr9w5x4NJvhGEmNVn2-lsT5--Grwdb534ufrY';

async function test() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  // 1. Sign up a fake user
  const email = `test_${Date.now()}@example.com`;
  console.log('Signing up', email);
  const { data: authData, error: signUpError } = await supabase.auth.signUp({
    email,
    password: 'password123',
  });
  if (signUpError) { console.error('Sign up error', signUpError); return; }

  console.log('User signed up and logged in. session?', !!authData.session);

  // 2. Try to invoke edge function
  console.log("Invoking delete-account...");
  try {
    const { data, error } = await supabase.functions.invoke('delete-account');
    if (error && error.context) {
       const body = await error.context.json();
       console.log('Error Body:', body);
    } else {
       console.log('Result:', { data, error });
    }
  } catch (err) {
    if (err.context) {
        console.error('Catch Body:', await err.context.json());
    } else {
        console.error('Catch Error:', err);
    }
  }
}

test().then(() => console.log('Done'));
