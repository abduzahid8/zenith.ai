import { aiJobsDbService } from './supabase/aiJobs';
import { userStateSnapshotService } from './supabase/userStateSnapshot';
import { UserStateSnapshot } from './supabase/types';

export const aiJobService = {
    // Check if we need to trigger an AI job based on user state
    checkTriggers: async (userId: string) => {
        const snapshot = await userStateSnapshotService.getSnapshot(userId);
        if (!snapshot) return;

        // Trigger 1: Streak Break (missed > 2 days in last 7)
        if (snapshot.missed_days_7d && snapshot.missed_days_7d > 2) {
            await aiJobService.enqueueIfNeeded(userId, 'BEHAVIOR_RECALIBRATION', 10); // High priority
        }

        // Trigger 2: Low Completion (< 50%)
        if (snapshot.avg_completion_7d && snapshot.avg_completion_7d < 50) {
            await aiJobService.enqueueIfNeeded(userId, 'REBUILD_DAY', 5);
        }

        // Trigger 3: New Profile (no AI focus area yet)
        if (!snapshot.ai_focus_area) {
            await aiJobService.enqueueIfNeeded(userId, 'PROFILE_UPDATE', 1);
        }
    },

    // Enqueue a job if one doesn't already exist in pending/processing state
    enqueueIfNeeded: async (userId: string, type: 'PROFILE_UPDATE' | 'REBUILD_DAY' | 'BEHAVIOR_RECALIBRATION', priority: number) => {
        const pendingJobs = await aiJobsDbService.getPendingJobs(userId);
        const exists = pendingJobs.some(job => job.type === type);

        if (!exists) {
            await aiJobsDbService.enqueueJob(userId, type, priority);
        }
    },

    // Process completed jobs and apply results
    applyCompletedJobs: async (userId: string) => {
        // This would typically validatethe results or update local state if needed
        // For now, the Edge Function does the heavy lifting of updating DB state
        // This function could verify and update local snapshot if we were not using subscription/re-fetch
        return true;
    }
};
