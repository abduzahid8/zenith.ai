import { getSupabase } from './client';
import { AiJob, AiJobType, AiJobStatus } from './types';

export const aiJobsDbService = {
    // Enqueue a new AI job
    enqueueJob: async (
        userId: string,
        type: AiJobType,
        priority: number = 0,
        retryCount: number = 0
    ): Promise<AiJob | null> => {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('ai_jobs')
            .insert({
                user_id: userId,
                type,
                priority,
                retry_count: retryCount,
                status: 'pending'
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    // Get pending or processing jobs for a user
    getPendingJobs: async (userId: string): Promise<AiJob[]> => {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('ai_jobs')
            .select('*')
            .eq('user_id', userId)
            .in('status', ['pending', 'processing'])
            .order('priority', { ascending: false });

        if (error) throw error;
        return data || [];
    },

    // Update job status and result
    updateJobStatus: async (
        jobId: string,
        status: AiJobStatus,
        resultJson?: Record<string, unknown>
    ): Promise<AiJob | null> => {
        const supabase = getSupabase();
        const updates: {
            status: AiJobStatus;
            started_at?: string;
            finished_at?: string;
            result_json?: Record<string, unknown>;
        } = { status };

        if (status === 'processing') {
            updates.started_at = new Date().toISOString();
        } else if (status === 'completed' || status === 'failed') {
            updates.finished_at = new Date().toISOString();
        }

        if (resultJson) {
            updates.result_json = resultJson;
        }

        const { data, error } = await supabase
            .from('ai_jobs')
            .update(updates)
            .eq('id', jobId)
            .select()
            .single();

        if (error) throw error;
        return data;
    },
};
