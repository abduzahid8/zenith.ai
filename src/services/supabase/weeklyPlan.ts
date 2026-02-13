import { getSupabase } from './client';
import { WeeklyPlan } from './types';

export const weeklyPlanService = {
    getWeeklyPlan: async (userId: string, weekStart: string, hobbyId?: string): Promise<WeeklyPlan | null> => {
        const supabase = getSupabase();
        let query = supabase
            .from('weekly_plans')
            .select('*')
            .eq('user_id', userId)
            .eq('week_start', weekStart);

        if (hobbyId) {
            query = query.eq('hobby_id', hobbyId);
        }

        const { data, error } = await query.single();
        if (error && error.code !== 'PGRST116') throw error;
        return data || null;
    },

    saveWeeklyPlan: async (userId: string, plan: Omit<WeeklyPlan, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
        const supabase = getSupabase();
        const tasksCount = plan.tasks?.length || 0;
        const completedCount = plan.tasks?.filter(t => t.completed).length || 0;

        const { data, error } = await supabase
            .from('weekly_plans')
            .upsert({
                user_id: userId,
                ...plan,
                total_tasks: tasksCount,
                completed_tasks: completedCount
            }, {
                onConflict: 'user_id,week_start,hobby_id'
            })
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    updateWeeklyPlanTasks: async (userId: string, weekStart: string, tasks: WeeklyPlan['tasks'], hobbyId?: string) => {
        const supabase = getSupabase();
        const tasksCount = tasks?.length || 0;
        const completedCount = tasks?.filter(t => t.completed).length || 0;

        let query = supabase
            .from('weekly_plans')
            .update({
                tasks,
                total_tasks: tasksCount,
                completed_tasks: completedCount
            })
            .eq('user_id', userId)
            .eq('week_start', weekStart);

        if (hobbyId) {
            query = query.eq('hobby_id', hobbyId);
        }

        const { data, error } = await query.select().single();
        if (error) throw error;
        return data;
    },
};
