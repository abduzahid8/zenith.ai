import 'react-native-url-polyfill/auto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Supabase configuration
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

let supabaseInstance: SupabaseClient | null = null;

const getSupabase = (): SupabaseClient => {
    if (supabaseInstance) return supabaseInstance;

    if (!SUPABASE_URL || !SUPABASE_URL.startsWith('http')) {
        console.warn('Supabase URL is invalid or missing. Check your .env file.');
        // Return a dummy/mock client to prevent crash, or allow createClient to throw?
        // createClient WILL throw if URL is invalid.
        // We must NOT call createClient if URL is bad.
        throw new Error('Supabase Configuration Error: Invalid URL in .env');
    }

    supabaseInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
            storage: AsyncStorage,
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: false,
        },
    });
    return supabaseInstance;
};

// Auth helpers
export const authService = {
    // Sign up with email
    signUp: async (email: string, password: string) => {
        const supabase = getSupabase();
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
        });
        if (error) throw error;
        return data;
    },

    // Sign in with email
    signIn: async (email: string, password: string) => {
        const supabase = getSupabase();
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        if (error) throw error;
        return data;
    },

    // Sign out
    signOut: async () => {
        const supabase = getSupabase();
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    },

    // Get current session
    getSession: async () => {
        try {
            const supabase = getSupabase();
            const { data, error } = await supabase.auth.getSession();
            if (error) throw error;
            return data.session;
        } catch (e) {
            console.warn('Supabase init skipped or failed:', e);
            return null;
        }
    },

    // Get current user
    getUser: async () => {
        const supabase = getSupabase();
        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;
        return data.user;
    },
};

// Database types
export interface QuizAnswer {
    id?: string;
    user_id: string;
    answers: Record<number, number>;
    created_at?: string;
}

export interface UserHobby {
    id?: string;
    user_id: string;
    hobby_id: string;
    selected_at?: string;
}

export interface Session {
    id?: string;
    user_id: string;
    hobby_id: string;
    duration_seconds: number;
    completed_at?: string;
}

export interface UserProfile {
    id?: string;
    user_id: string;
    is_premium: boolean;
    created_at?: string;
}

// Database helpers
export const dbService = {
    // Save quiz answers
    saveQuizAnswers: async (userId: string, answers: Record<number, number>) => {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('quiz_answers')
            .insert({ user_id: userId, answers })
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    // Get quiz answers
    getQuizAnswers: async (userId: string) => {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('quiz_answers')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
        if (error && error.code !== 'PGRST116') throw error;
        return data;
    },

    // Save selected hobby
    saveHobby: async (userId: string, hobbyId: string) => {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('user_hobbies')
            .insert({ user_id: userId, hobby_id: hobbyId })
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    // Get user's hobbies
    getUserHobbies: async (userId: string) => {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('user_hobbies')
            .select('*')
            .eq('user_id', userId);
        if (error) throw error;
        return data;
    },

    // Save session
    saveSession: async (userId: string, hobbyId: string, durationSeconds: number) => {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('sessions')
            .insert({ user_id: userId, hobby_id: hobbyId, duration_seconds: durationSeconds })
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    // Get user sessions
    getUserSessions: async (userId: string, limit: number = 10) => {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('sessions')
            .select('*')
            .eq('user_id', userId)
            .order('completed_at', { ascending: false })
            .limit(limit);
        if (error) throw error;
        return data;
    },

    // Get/create user profile
    getOrCreateProfile: async (userId: string) => {
        const supabase = getSupabase();
        let { data, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error && error.code === 'PGRST116') {
            // Profile doesn't exist, create it
            const { data: newProfile, error: createError } = await supabase
                .from('user_profiles')
                .insert({ user_id: userId, is_premium: false })
                .select()
                .single();
            if (createError) throw createError;
            return newProfile;
        }

        if (error) throw error;
        return data;
    },

    // Update premium status
    updatePremiumStatus: async (userId: string, isPremium: boolean) => {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('user_profiles')
            .update({ is_premium: isPremium })
            .eq('user_id', userId)
            .select()
            .single();
        if (error) throw error;
        return data;
    },
};

// Export getSupabase for direct usage if needed, but prefer services
export { getSupabase };
