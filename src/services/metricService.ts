import { getSupabase } from './supabase/client';
import { Task } from './supabase/types';

export const metricService = {
    /**
     * Calculates and saves daily metrics for a user based on their tasks for a specific date.
     * @param userId The ID of the user.
     * @param date The date string (YYYY-MM-DD).
     * @param timezone Optional timezone string.
     */
    syncDailyMetrics: async (userId: string, date: string, timezone?: string) => {
        try {
            const supabase = getSupabase();

            // 1. Fetch all tasks for the day
            const { data: tasks, error: tasksError } = await supabase
                .from('tasks')
                .select('*')
                .eq('user_id', userId)
                .eq('scheduled_date', date);

            if (tasksError) throw tasksError;

            if (!tasks || tasks.length === 0) return;

            // 2. Calculate Metrics
            const totalTasks = tasks.length;
            const completedTasks = tasks.filter(t => t.status === 'completed');
            const completionRate = totalTasks > 0 ? (completedTasks.length / totalTasks) * 100 : 0;

            // Calculate averages excluding nulls
            const difficultyRatings = completedTasks.filter(t => t.difficulty_rating).map(t => t.difficulty_rating!);
            const engagementRatings = completedTasks.filter(t => t.engagement_rating).map(t => t.engagement_rating!);

            const avgDifficulty = difficultyRatings.length > 0
                ? difficultyRatings.reduce((a, b) => a + b, 0) / difficultyRatings.length
                : null;

            const avgEngagement = engagementRatings.length > 0
                ? engagementRatings.reduce((a, b) => a + b, 0) / engagementRatings.length
                : null;

            // Prepare tasks_completed array (lite version)
            const tasksCompletedSummary = completedTasks.map(t => ({
                task_id: t.id,
                duration: t.duration_minutes,
                difficulty: t.difficulty_rating,
                engagement: t.engagement_rating,
                type: t.type
            }));

            // 3. Upsert into user_metrics_history
            // check if record exists first to update or insert
            const { data: existing, error: fetchError } = await supabase
                .from('user_metrics_history')
                .select('id')
                .eq('user_id', userId)
                .eq('metric_date', date)
                .single();

            const payload: any = {
                user_id: userId,
                metric_date: date,
                completion_rate: completionRate,
                tasks_completed: tasksCompletedSummary,
            };

            if (timezone) payload.timezone = timezone;

            // Store average ratings in the context JSONB field (not as top-level columns)
            payload.context = {
                avg_difficulty: avgDifficulty,
                avg_engagement: avgEngagement
            };

            // Also calculate avg_session_minutes (actual duration if tracking, or planned)
            // For now use planned duration of completed tasks
            const totalDuration = completedTasks.reduce((acc, t) => acc + (t.duration_minutes || 0), 0);
            const avgSession = completedTasks.length > 0 ? Math.round(totalDuration / completedTasks.length) : 0;
            payload.avg_session_minutes = avgSession;

            const { error: upsertError } = await supabase
                .from('user_metrics_history')
                .upsert(payload, { onConflict: 'user_id, metric_date' });

            if (upsertError) throw upsertError;

            console.log(`[MetricService] Synced metrics for ${date}: ${Math.round(completionRate)}% complete`);

        } catch (error) {
            console.error('[MetricService] Failed to sync metrics:', error);
            // Don't modify return logic, just log error so UI doesn't break
        }
    }
};
