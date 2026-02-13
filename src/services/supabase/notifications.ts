import { getSupabase } from './client';
import { SubstituteNotification } from './types';

export const notificationDbService = {
    logSubstituteNotification: async (userId: string, notification: Omit<SubstituteNotification, 'id' | 'user_id' | 'created_at'>) => {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('substitute_notifications')
            .insert({ user_id: userId, ...notification })
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    updateNotificationResponse: async (notificationId: string, actionTaken: SubstituteNotification['action_taken'], responseTimeSeconds?: number) => {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('substitute_notifications')
            .update({ action_taken: actionTaken, response_time_seconds: responseTimeSeconds })
            .eq('id', notificationId)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    getNotificationStats: async (userId: string, days: number = 7): Promise<{ total: number; accepted: number; dismissed: number }> => {
        const supabase = getSupabase();
        const sinceDate = new Date();
        sinceDate.setDate(sinceDate.getDate() - days);

        const { data, error } = await supabase
            .from('substitute_notifications')
            .select('action_taken')
            .eq('user_id', userId)
            .gte('created_at', sinceDate.toISOString());

        if (error) throw error;

        const stats = {
            total: data?.length || 0,
            accepted: data?.filter(n => n.action_taken === 'accepted').length || 0,
            dismissed: data?.filter(n => n.action_taken === 'dismissed').length || 0
        };
        return stats;
    },
};
