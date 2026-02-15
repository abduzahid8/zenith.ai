// Supabase Edge Function: AI Task Worker (Refactored)
// Processes background AI jobs: profile updates, daily rebuilds, behavior recalibration

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { config } from './config.ts';
import { Logger } from './utils/logger.ts';
import { GeminiClient } from './ai/client.ts';
import { handleProfileUpdate } from './handlers/profileUpdate.ts';
import { handleRebuildDay } from './handlers/rebuildDay.ts';
import { handleBehaviorRecalibration } from './handlers/behaviorRecalibration.ts';

Deno.serve(async (req) => {
    // 1. CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: config.CORS_HEADERS });
    }

    const { jobId } = await req.json().catch(() => ({ jobId: null }));
    const logger = Logger.create(jobId || 'unknown');

    try {
        if (!jobId) throw new Error('Missing jobId');

        // 2. Init Clients
        const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY);
        const gemini = new GeminiClient(logger);

        // 3. Get Job
        const { data: job, error: jobError } = await supabase.from('ai_jobs').select('*').eq('id', jobId).single();

        if (jobError || !job) {
            logger.error('Job not found or error fetching', { error: jobError });
            throw new Error('Job not found');
        }

        // Update Logger with User ID
        // Note: Logger implementation doesn't support dynamic update, so we just log context
        logger.info('Processing Job', { type: job.type, userId: job.user_id });

        // 4. Set Status to Processing
        await supabase.from('ai_jobs').update({ status: 'processing', started_at: new Date() }).eq('id', jobId);

        // 5. Route Job
        let result = {};
        switch (job.type) {
            case 'PROFILE_UPDATE':
                result = await handleProfileUpdate(supabase, job, gemini, logger);
                break;
            case 'REBUILD_DAY':
                result = await handleRebuildDay(supabase, job, gemini, logger);
                break;
            case 'BEHAVIOR_RECALIBRATION':
                result = await handleBehaviorRecalibration(supabase, job, gemini, logger);
                break;
            default:
                throw new Error(`Unknown job type: ${job.type}`);
        }

        // 6. Complete Job
        await supabase.from('ai_jobs').update({
            status: 'completed',
            finished_at: new Date(),
            result_json: result
        }).eq('id', jobId);

        logger.info('Job Completed Successfully');

        return new Response(JSON.stringify({ success: true, result }), {
            headers: { ...config.CORS_HEADERS, 'Content-Type': 'application/json' },
        });

    } catch (error: any) {
        logger.error('Job Failed', { error: error.message, stack: error.stack });

        // Try to update job status to failed if we have a valid jobId
        if (jobId) {
            const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY);
            await supabase.from('ai_jobs').update({
                status: 'failed',
                finished_at: new Date(),
                result_json: { error: error.message }
            }).eq('id', jobId);
        }

        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...config.CORS_HEADERS, 'Content-Type': 'application/json' },
        });
    }
});
