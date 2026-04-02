import { getSupabase } from './client';
import { UserProfile } from './types';

export const profileService = {
    getOrCreateProfile: async (userId: string): Promise<UserProfile> => {
        const supabase = getSupabase();
        let { data, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error && error.code === 'PGRST116') {
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

    updateProfile: async (userId: string, updates: Partial<UserProfile>) => {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('user_profiles')
            .update(updates)
            .eq('user_id', userId)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    updatePremiumStatus: async (userId: string, isPremium: boolean) => {
        return profileService.updateProfile(userId, {
            is_premium: isPremium,
            subscription_level: isPremium ? 'premium' : 'free'
        });
    },

    updateProfileScores: async (userId: string, scores: {
        mental_score?: number;
        creative_score?: number;
        physical_score?: number;
        structure_score?: number;
        freedom_score?: number;
        individual_score?: number;
        social_score?: number;
        quick_score?: number;
        long_score?: number;
    }) => {
        return profileService.updateProfile(userId, scores);
    },

    incrementStreak: async (userId: string) => {
        const supabase = getSupabase();
        const today = new Date().toISOString().split('T')[0];

        const { data: profile } = await supabase
            .from('user_profiles')
            .select('streak_days, last_session_date')
            .eq('user_id', userId)
            .single();

        if (!profile) return null;

        const lastDate = profile.last_session_date;
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        let newStreak: number;
        if (lastDate === today) {
            return null; // already incremented today — signal no-op to caller
        } else if (lastDate === yesterdayStr) {
            newStreak = (profile.streak_days || 0) + 1;
        } else {
            newStreak = 1;
        }

        return profileService.updateProfile(userId, {
            streak_days: newStreak,
            last_session_date: today
        });
    },
};
