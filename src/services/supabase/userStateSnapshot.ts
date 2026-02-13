import { getSupabase } from './client';
import { UserStateSnapshot } from './types';

export const userStateSnapshotService = {
    // Get the current snapshot for a user
    getSnapshot: async (userId: string): Promise<UserStateSnapshot | null> => {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('user_state_snapshot')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "no rows returned"
        return data || null;
    },

    // Create or update the snapshot
    upsertSnapshot: async (userId: string, data: Partial<UserStateSnapshot>): Promise<UserStateSnapshot | null> => {
        const supabase = getSupabase();
        const { data: result, error } = await supabase
            .from('user_state_snapshot')
            .upsert({ user_id: userId, ...data })
            .select()
            .single();

        if (error) throw error;
        return result;
    },
};
