import { getSupabase } from './client';
import { UserHobby } from './types';

export const hobbyService = {
    saveHobby: async (userId: string, hobbyId: string, isPrimary: boolean = false) => {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('user_hobbies')
            .insert({ user_id: userId, hobby_id: hobbyId, is_primary: isPrimary })
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    getUserHobbies: async (userId: string): Promise<UserHobby[]> => {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('user_hobbies')
            .select('*')
            .eq('user_id', userId);
        if (error) throw error;
        return data || [];
    },

    setPrimaryHobby: async (userId: string, hobbyId: string) => {
        const supabase = getSupabase();
        await supabase
            .from('user_hobbies')
            .update({ is_primary: false })
            .eq('user_id', userId);
        const { data, error } = await supabase
            .from('user_hobbies')
            .update({ is_primary: true })
            .eq('user_id', userId)
            .eq('hobby_id', hobbyId)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    updateHobbyProgress: async (userId: string, hobbyId: string, minutesToAdd: number) => {
        const supabase = getSupabase();
        const { data: current } = await supabase
            .from('user_hobbies')
            .select('total_practice_minutes')
            .eq('user_id', userId)
            .eq('hobby_id', hobbyId)
            .single();

        const newTotal = (current?.total_practice_minutes || 0) + minutesToAdd;
        const { data, error } = await supabase
            .from('user_hobbies')
            .update({ total_practice_minutes: newTotal })
            .eq('user_id', userId)
            .eq('hobby_id', hobbyId)
            .select()
            .single();
        if (error) throw error;
        return data;
    },
};
