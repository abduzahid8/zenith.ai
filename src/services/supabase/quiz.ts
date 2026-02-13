import { getSupabase } from './client';

export const quizService = {
    saveQuizAnswers: async (userId: string, answers: Record<number, number>) => {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('quiz_answers')
            .insert({ user_id: userId, answers })
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    getQuizAnswers: async (userId: string) => {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('quiz_answers')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
        if (error && error.code !== 'PGRST116') throw error;
        return data;
    },
};
