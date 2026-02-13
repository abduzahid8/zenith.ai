import { getSupabase } from './client';
import { ScreenTimeLog, ScreenTimeLimit } from './types';

export const screenTimeDbService = {
    logScreenTime: async (userId: string, log: Omit<ScreenTimeLog, 'id' | 'user_id' | 'logged_at'>) => {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('screen_time_logs')
            .insert({ user_id: userId, ...log })
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    syncDailyScreenTime: async (userId: string, date: string, logs: Array<Omit<ScreenTimeLog, 'id' | 'user_id' | 'logged_at' | 'date'>>) => {
        const supabase = getSupabase();

        const { error: deleteError } = await supabase
            .from('screen_time_logs')
            .delete()
            .eq('user_id', userId)
            .eq('date', date);

        if (deleteError) throw deleteError;

        if (logs.length === 0) return [];

        const { data, error } = await supabase
            .from('screen_time_logs')
            .insert(
                logs.map(log => ({
                    user_id: userId,
                    date: date,
                    ...log
                }))
            )
            .select();

        if (error) throw error;
        return data;
    },

    getDailyScreenTime: async (userId: string, date?: string): Promise<ScreenTimeLog[]> => {
        const supabase = getSupabase();
        const targetDate = date || new Date().toISOString().split('T')[0];
        const { data, error } = await supabase
            .from('screen_time_logs')
            .select('*')
            .eq('user_id', userId)
            .eq('date', targetDate);
        if (error) throw error;
        return data || [];
    },

    getWeeklyScreenTime: async (userId: string): Promise<ScreenTimeLog[]> => {
        const supabase = getSupabase();
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const { data, error } = await supabase
            .from('screen_time_logs')
            .select('*')
            .eq('user_id', userId)
            .gte('date', weekAgo.toISOString().split('T')[0])
            .order('date', { ascending: false });
        if (error) throw error;
        return data || [];
    },

    getScreenTimeLimits: async (userId: string): Promise<ScreenTimeLimit[]> => {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('screen_time_limits')
            .select('*')
            .eq('user_id', userId)
            .eq('is_active', true);
        if (error) throw error;
        return data || [];
    },

    setScreenTimeLimit: async (userId: string, limit: Omit<ScreenTimeLimit, 'id' | 'user_id' | 'created_at'>) => {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('screen_time_limits')
            .upsert({
                user_id: userId,
                ...limit
            }, {
                onConflict: 'user_id,app_name'
            })
            .select()
            .single();
        if (error) throw error;
        return data;
    },
};
