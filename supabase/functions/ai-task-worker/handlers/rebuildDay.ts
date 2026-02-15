import { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { GeminiClient } from '../ai/client.ts';
import { Logger } from '../utils/logger.ts';
import { RebuildDayOutputSchema, RebuildDayJSONSchema, RebuildDayOutput } from '../validators/schemas.ts';
import { DateUtils } from '../utils/dateUtils.ts';

export async function handleRebuildDay(
    supabase: SupabaseClient,
    job: any,
    gemini: GeminiClient,
    logger: Logger
) {
    logger.info('Starting Rebuild Day');

    // 1. Fetch current tasks and snapshot
    const today = new Date().toISOString().split('T')[0]; // TODO: Use Timezone

    const { data: tasks, error: taskError } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', job.user_id)
        .eq('scheduled_date', today);

    if (taskError) throw new Error(`Fetch tasks failed: ${taskError.message}`);

    const { data: snapshot, error: snapshotError } = await supabase
        .from('user_state_snapshot')
        .select('*')
        .eq('user_id', job.user_id)
        .single();

    if (snapshotError) throw new Error(`Fetch snapshot failed: ${snapshotError.message}`);

    // 2. Generate new tasks
    const prompt = `User Snapshot: ${JSON.stringify(snapshot)}
Current Tasks: ${JSON.stringify(tasks)}
Reason: User has low completion rate or requested a rebuild.

Generate 2 replacement tasks attempting to recover the day (easier or more engaging).`;

    const newTasksData = await gemini.generate<RebuildDayOutput>(
        prompt,
        'You are a supportive coach.',
        RebuildDayOutputSchema,
        RebuildDayJSONSchema
    );

    logger.info('Generated New Tasks', { count: newTasksData.length });

    if (newTasksData.length > 0) {
        // 3. Mark old pending tasks as replaced
        // TODO: Transactional safety in future phase
        const { error: updateError } = await supabase.from('tasks')
            .update({ status: 'replaced' })
            .eq('user_id', job.user_id)
            .eq('scheduled_date', today)
            .eq('status', 'pending');

        if (updateError) {
            logger.error('Failed to replace old tasks', { error: updateError });
            throw new Error('Database update failed');
        }

        // 4. Insert new tasks
        const tasksToInsert = newTasksData.map((t) => ({
            user_id: job.user_id,
            title: t.title,
            type: t.type || 'practice',
            status: 'pending',
            scheduled_date: today,
            duration_minutes: t.duration_minutes || 10,
            is_ai_generated: true,
            ai_rationale: t.ai_rationale
        }));

        const { error: insertError } = await supabase.from('tasks').insert(tasksToInsert);

        if (insertError) {
            logger.error('Failed to insert new tasks', { error: insertError });
            throw new Error('Database insert failed');
        }
    }

    return { replaced_count: tasks?.length, new_count: newTasksData.length };
}
