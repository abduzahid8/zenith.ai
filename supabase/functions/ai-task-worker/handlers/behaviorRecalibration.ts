import { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { GeminiClient } from '../ai/client.ts';
import { Logger } from '../utils/logger.ts';
import { BehaviorRecalibrationOutputSchema, BehaviorRecalibrationJSONSchema } from '../validators/schemas.ts';

export async function handleBehaviorRecalibration(
    supabase: SupabaseClient,
    job: any,
    gemini: GeminiClient,
    logger: Logger
) {
    logger.info('Starting Behavior Recalibration');

    // 1. Fetch snapshot
    const { data: snapshot, error: snapshotError } = await supabase
        .from('user_state_snapshot')
        .select('*')
        .eq('user_id', job.user_id)
        .single();

    if (snapshotError) throw new Error(`Fetch snapshot failed: ${snapshotError.message}`);

    // 2. Decide on recalibration
    const prompt = `Snapshot: ${JSON.stringify(snapshot)}
User has missed days or is struggling.
Suggest a new difficulty level (1-10) and a motivating message.`;

    const result = await gemini.generate(
        prompt,
        'You are a behavioral psychologist.',
        BehaviorRecalibrationOutputSchema,
        BehaviorRecalibrationJSONSchema
    );

    logger.info('Recalibration Complete', { result });

    // 3. Update snapshot
    if (result.new_skill_level) {
        const { error: updateError } = await supabase.from('user_state_snapshot').update({
            skill_level: result.new_skill_level,
            ai_focus_area: result.message
        }).eq('user_id', job.user_id);

        if (updateError) {
            logger.error('Failed to update snapshot', { error: updateError });
            throw new Error('Database update failed');
        }
    }

    return result;
}
