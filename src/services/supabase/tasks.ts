import { getSupabase } from './client';
import { Task, TaskStatus, TaskType } from './types';

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
        const rows = data || [];
        return rows.map(row => ({
            ...row,
            type: mapDbTypeToEngine(row.type as string)
        }));
    },

    // Upsert multiple tasks (for daily plan generation / manual additions)
    upsertTasks: async (userId: string, tasks: Partial<Task>[]): Promise<Task[]> => {
        const supabase = getSupabase();

        // Ensure user_id is set on all tasks and strip any client-only fields
        const tasksWithUser = tasks.map(t => {
            // `is_manual` exists in the TS type and client state, but the DB table
            // currently does not have this column, so we must not send it.
            const { is_manual, ...rest } = t as any;
            const engineType = rest.type as TaskType | undefined;
            const dbType = engineType ? mapEngineTypeToDb(engineType) : undefined;
            return {
                ...rest,
                ...(dbType ? { type: dbType } : {}),
                user_id: userId
            };
        });

        const { data, error } = await supabase
            .from('tasks')
            .upsert(tasksWithUser, { onConflict: 'id' })
            .select();

        if (error) throw error;
        const rows = data || [];
        return rows.map(row => ({
            ...row,
            type: mapDbTypeToEngine(row.type as string)
        }));
    },

    // Update the status and other fields of a single task
    updateTaskStatus: async (userId: string, taskId: string, status: TaskStatus, updates: Partial<Task> = {}): Promise<Task | null> => {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('tasks')
            .update({ status, ...updates })
            .eq('id', taskId)
            .eq('user_id', userId)
            .select()
            .maybeSingle();

        if (error) throw error;
        if (!data) return null;
        return {
            ...data,
            type: mapDbTypeToEngine(data.type as string),
        };
    },

    // Delete all auto-generated tasks for a specific date (used when hobby changes)
    deleteAutoTasksByDate: async (userId: string, date: string): Promise<void> => {
        const supabase = getSupabase();
        await supabase
            .from('tasks')
            .delete()
            .eq('user_id', userId)
            .eq('scheduled_date', date)
            .eq('is_manual', false);
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
        const rows = data || [];
        return rows.map(row => ({
            ...row,
            type: mapDbTypeToEngine(row.type as string)
        }));
    },
};

// -------------------------------------------------------------------
// Type mapping between legacy DB constraint and new engine TaskType
// -------------------------------------------------------------------

const mapEngineTypeToDb = (type: TaskType): string => {
    switch (type) {
        case 'theory':
            return 'learning';
        case 'practice':
            return 'practice';
        case 'analysis':
            return 'wellbeing';
        case 'puzzles':
            return 'action';
        default:
            return type;
    }
};

const mapDbTypeToEngine = (dbType: string): TaskType => {
    switch (dbType) {
        case 'learning':
            return 'theory';
        case 'practice':
            return 'practice';
        case 'wellbeing':
            return 'analysis';
        case 'action':
            return 'puzzles';
        default:
            // Fallback: if DB already migrated, it might store new types directly
            return dbType as TaskType;
    }
};
