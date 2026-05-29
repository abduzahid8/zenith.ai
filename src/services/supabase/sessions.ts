import { getSupabase } from './client';
import { Session } from './types';

export const sessionService = {
    saveSession: async (
        userId: string,
        hobbyId: string,
        durationSeconds: number,
        options?: { qualityRating?: number; focusScore?: number; notes?: string; tasksCompleted?: string[] }
    ) => {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('sessions')
            .insert({
                user_id: userId,
                hobby_id: hobbyId,
                duration_seconds: durationSeconds,
                focus_score: options?.focusScore,
                notes: options?.notes,
            })
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    getUserSessions: async (userId: string, limit: number = 10): Promise<Session[]> => {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('sessions')
            .select('*')
            .eq('user_id', userId)
            .order('completed_at', { ascending: false })
            .limit(limit);
        if (error) throw error;
        return data || [];
    },

    getSessionsByDateRange: async (userId: string, startDate: string, endDate: string): Promise<Session[]> => {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('sessions')
            .select('*')
            .eq('user_id', userId)
            .gte('completed_at', startDate)
            .lte('completed_at', endDate)
            .order('completed_at', { ascending: false });
        if (error) throw error;
        return data || [];
    },
};
