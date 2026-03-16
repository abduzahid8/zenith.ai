import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

if (Platform.OS !== 'web') {
    require('react-native-url-polyfill/auto');
}

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

let supabaseInstance: SupabaseClient | null = null;

export const getSupabase = (): SupabaseClient => {
    if (supabaseInstance) return supabaseInstance;

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        throw new Error(
            'Supabase configuration is missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env.'
        );
    }

    if (!SUPABASE_URL.startsWith('http')) {
        throw new Error('Supabase configuration error: EXPO_PUBLIC_SUPABASE_URL must be a valid URL.');
    }

    if (SUPABASE_ANON_KEY.startsWith('sb_secret_')) {
        throw new Error(
            'Supabase configuration error: service role key detected in client config. Use only EXPO_PUBLIC_SUPABASE_ANON_KEY on mobile/web clients.'
        );
    }

    const isWeb = Platform.OS === 'web';
    supabaseInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
            storage: isWeb ? undefined : AsyncStorage,
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: isWeb,
        },
    });
    return supabaseInstance;
};
