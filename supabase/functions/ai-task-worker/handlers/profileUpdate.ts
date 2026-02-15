import { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { GeminiClient } from '../ai/client.ts';
import { Logger } from '../utils/logger.ts';
import { ProfileUpdateOutputSchema, ProfileUpdateJSONSchema } from '../validators/schemas.ts';

export async function handleProfileUpdate(
    supabase: SupabaseClient,
    job: any,
    gemini: GeminiClient,
    logger: Logger
) {
    logger.info('Starting Profile Update');

    // 1. Fetch user data
    const { data: snapshot, error: snapshotError } = await supabase
        .from('user_state_snapshot')
        .select('*')
        .eq('user_id', job.user_id)
        .single();

    if (snapshotError) {
        logger.error('Failed to fetch snapshot', { error: snapshotError });
        throw new Error('Failed to fetch user snapshot');
    }

    const { data: recentTasks, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', job.user_id)
        .order('created_at', { ascending: false })
        .limit(20);

    if (tasksError) {
        logger.error('Failed to fetch recent tasks', { error: tasksError });
        // Non-fatal, can proceed with just snapshot if needed, but better to fail
        throw new Error('Failed to fetch recent tasks');
    }

    // 2. Analyze with AI
    const prompt = `Current Snapshot: ${JSON.stringify(snapshot)}
Recent Tasks: ${JSON.stringify(recentTasks)}

Analyze the user's recent performance. 
- Identify a new focus area (e.g., "Endgame tactics", "Color consistency", "Focus endurance").
- Calculate a confidence score (0.0 - 1.0).
- Suggest weakness tags to add/remove.`;

    const result = await gemini.generate(
        prompt,
        'You are a chess/hobby coach analyst.',
        ProfileUpdateOutputSchema,
        ProfileUpdateJSONSchema
    );

    logger.info('AI Analysis Complete', { result });

    // 3. Update Snapshot
    const { error: updateError } = await supabase.from('user_state_snapshot').upsert({
        user_id: job.user_id,
        ai_focus_area: result.ai_focus_area || snapshot.ai_focus_area,
        ai_confidence_score: result.ai_confidence_score || 0.8,
        weakness_tags: result.weakness_tags || snapshot.weakness_tags || [],
        last_ai_update_at: new Date().toISOString()
    });

    if (updateError) {
        logger.error('Failed to update snapshot', { error: updateError });
        throw new Error('Database update failed');
    }

    return result;
}
