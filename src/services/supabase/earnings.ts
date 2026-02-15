import { getSupabase } from './client';
import { EarningMethod, UserEarning } from './types';

export const earningsDbService = {
    getEarningMethods: async (filters?: {
        category?: string;
        difficulty_level?: string;
        related_hobbies?: string[];
    }): Promise<EarningMethod[]> => {
        const supabase = getSupabase();
        let query = supabase
            .from('earning_methods')
            .select('*')
            .eq('is_active', true);

        if (filters?.category) {
            query = query.eq('category', filters.category);
        }
        if (filters?.difficulty_level) {
            query = query.eq('difficulty_level', filters.difficulty_level);
        }
        if (filters?.related_hobbies && filters.related_hobbies.length > 0) {
            query = query.overlaps('related_hobbies', filters.related_hobbies);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    },

    getUserEarnings: async (userId: string): Promise<UserEarning[]> => {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('user_earnings')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    },

    startEarningPath: async (userId: string, earningMethodId: string) => {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('user_earnings')
            .insert({
                user_id: userId,
                earning_method_id: earningMethodId,
                status: 'interested'
            })
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    updateEarningProgress: async (userId: string, earningMethodId: string, updates: {
        status?: UserEarning['status'];
        current_step?: number;
        progress_notes?: string;
        total_earned?: number;
        first_earning_date?: string;
    }) => {
        const supabase = getSupabase();

        if (updates.status === 'earning' && updates.total_earned && updates.total_earned > 0) {
            const { data: current } = await supabase
                .from('user_earnings')
                .select('first_earning_date')
                .eq('user_id', userId)
                .eq('earning_method_id', earningMethodId)
                .single();

            if (!current?.first_earning_date) {
                updates.first_earning_date = new Date().toISOString().split('T')[0];
            }
        }

        const { data, error } = await supabase
            .from('user_earnings')
            .update(updates)
            .eq('user_id', userId)
            .eq('earning_method_id', earningMethodId)
            .select()
            .single();
        if (error) throw error;
        return data;
    },
};
