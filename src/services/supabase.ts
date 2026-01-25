import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Supabase configuration
// TODO: Replace with your actual Supabase URL and anon key
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://demo.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'demo-anon-key';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});

// Auth helpers
export const authService = {
    // Sign up with email
    signUp: async (email: string, password: string) => {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
        });
        if (error) throw error;
        return data;
    },

    // Sign in with email
    signIn: async (email: string, password: string) => {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        if (error) throw error;
        return data;
    },

    // Sign out
    signOut: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    },

    // Get current session
    getSession: async () => {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        return data.session;
    },

    // Get current user
    getUser: async () => {
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
        const { data, error } = await supabase
            .from('user_hobbies')
            .select('*')
            .eq('user_id', userId);
        if (error) throw error;
        return data;
    },

    // Save session
    saveSession: async (userId: string, hobbyId: string, durationSeconds: number) => {
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

export default supabase;
