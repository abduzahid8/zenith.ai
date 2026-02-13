import { getSupabase } from './client';
import { Task, TaskStatus } from './types';

export const tasksDbService = {
    // Get tasks for a specific date
    getTasksByDate: async (userId: string, date: string): Promise<Task[]> => {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('tasks')
            .select('*')
            .eq('user_id', userId)
            .eq('scheduled_date', date)
            .order('created_at', { ascending: true });

        if (error) throw error;
        return data || [];
    },

    // Upsert multiple tasks (for daily plan generation)
    upsertTasks: async (userId: string, tasks: Partial<Task>[]): Promise<Task[]> => {
        const supabase = getSupabase();

        // Ensure user_id is set on all tasks
        const tasksWithUser = tasks.map(t => ({ ...t, user_id: userId }));

        const { data, error } = await supabase
            .from('tasks')
            .upsert(tasksWithUser, { onConflict: 'id' })
            .select();

        if (error) throw error;
        return data || [];
    },

    // Update the status of a single task
    updateTaskStatus: async (userId: string, taskId: string, status: TaskStatus): Promise<Task | null> => {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('tasks')
            .update({ status })
            .eq('id', taskId)
            .eq('user_id', userId)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    // Get tasks within a date range (for weekly stats or history)
    getTasksByDateRange: async (userId: string, startDate: string, endDate: string): Promise<Task[]> => {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('tasks')
            .select('*')
            .eq('user_id', userId)
            .gte('scheduled_date', startDate)
            .lte('scheduled_date', endDate)
            .order('scheduled_date', { ascending: true });

        if (error) throw error;
        return data || [];
    },
};
