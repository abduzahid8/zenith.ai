import { getSupabase } from './client';
import { ContentItem, UserContentHistory } from './types';

export const contentDbService = {
    getRecommendedContent: async (filters?: {
        content_type?: string;
        category?: string;
        difficulty_level?: string;
        hobby_ids?: string[];
        limit?: number;
    }): Promise<ContentItem[]> => {
        const supabase = getSupabase();
        let query = supabase
            .from('content_items')
            .select('*')
            .eq('is_active', true);

        if (filters?.content_type) {
            query = query.eq('content_type', filters.content_type);
        }
        if (filters?.category) {
            query = query.eq('category', filters.category);
        }
        if (filters?.difficulty_level) {
            query = query.eq('difficulty_level', filters.difficulty_level);
        }
        if (filters?.hobby_ids && filters.hobby_ids.length > 0) {
            query = query.overlaps('hobby_ids', filters.hobby_ids);
        }
        if (filters?.limit) {
            query = query.limit(filters.limit);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    },

    getUserContentHistory: async (userId: string): Promise<UserContentHistory[]> => {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('user_content_history')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    },

    updateContentStatus: async (
        userId: string,
        contentId: string,
        status: UserContentHistory['status'],
        extras?: { rating?: number; notes?: string; progress_percent?: number; started_at?: string; completed_at?: string }
    ) => {
        const supabase = getSupabase();
        const updates: Partial<UserContentHistory> = { status, ...extras };

        if (status === 'started' && !extras?.started_at) {
            (updates as any).started_at = new Date().toISOString();
        }
        if (status === 'completed' && !extras?.completed_at) {
            (updates as any).completed_at = new Date().toISOString();
            updates.progress_percent = 100;
        }

        const { data, error } = await supabase
            .from('user_content_history')
            .upsert({
                user_id: userId,
                content_id: contentId,
                ...updates
            }, {
                onConflict: 'user_id,content_id'
            })
            .select()
            .single();
        if (error) throw error;
        return data;
    },
};
