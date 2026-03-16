import { getSupabase } from './client';

export const authService = {
    signUp: async (email: string, password: string) => {
        const supabase = getSupabase();
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        return data;
    },

    signIn: async (email: string, password: string) => {
        const supabase = getSupabase();
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return data;
    },

    signOut: async () => {
        const supabase = getSupabase();
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    },

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

    getUser: async () => {
        const supabase = getSupabase();
        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;
        return data.user;
    },

    forgotPassword: async (email: string) => {
        const supabase = getSupabase();
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;
    },
};
