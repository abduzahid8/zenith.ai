import { getSupabase } from './client';
import { DailyStats } from './types';

export const statsService = {
    getDailyStats: async (userId: string, date?: string): Promise<DailyStats | null> => {
        const supabase = getSupabase();
        const targetDate = date || new Date().toISOString().split('T')[0];
        const { data, error } = await supabase
            .from('daily_stats')
            .select('*')
            .eq('user_id', userId)
            .eq('date', targetDate)
            .single();
        if (error && error.code !== 'PGRST116') throw error;
        return data || null;
    },

    getWeeklyStats: async (userId: string): Promise<DailyStats[]> => {
        const supabase = getSupabase();
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const { data, error } = await supabase
            .from('daily_stats')
            .select('*')
            .eq('user_id', userId)
            .gte('date', weekAgo.toISOString().split('T')[0])
            .order('date', { ascending: true });
        if (error) throw error;
        return data || [];
    },

    updateDailyStats: async (userId: string, date: string, updates: Partial<DailyStats>) => {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('daily_stats')
            .upsert({
                user_id: userId,
                date,
                ...updates
            }, {
                onConflict: 'user_id,date'
            })
            .select()
            .single();
        if (error) throw error;
        return data;
    },
};
