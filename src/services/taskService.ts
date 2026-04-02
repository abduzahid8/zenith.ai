import { tasksDbService } from './supabase/tasks';
import { userStateSnapshotService } from './supabase/userStateSnapshot';
import { metricService } from './metricService';
import { dbService } from './supabase'; // Access to all other services
import { taskEngine } from './taskEngine';
import { aiJobService } from './aiJobService';
import { Task, TaskStatus, TaskType } from './supabase/types';
import { getTodayDateString } from '../utils/date';
import { shouldIncrementStreak, getMaxTasksPerDay, getAutoTasksPerDay } from '../domain/tasks/rules';

export const taskService = {
    // Get or generate the daily plan
    getDailyPlan: async (userId: string, date: string, isPremium: boolean = false): Promise<Task[]> => {
        // 1. Fetch current primary hobby and existing tasks in parallel
        const [existingTasks, hobbies] = await Promise.all([
            tasksDbService.getTasksByDate(userId, date),
            dbService.getUserHobbies(userId),
        ]);

        const primaryHobby = hobbies.find(h => h.is_primary) || hobbies[0];
        const primaryHobbyId = primaryHobby?.hobby_id;

        // 2. Detect stale tasks: existing auto-tasks belong to a different hobby
        const autoTasks = existingTasks.filter(t => !t.is_manual);
        const hobbyMismatch = autoTasks.length > 0 &&
            primaryHobbyId &&
            autoTasks.some(t => t.hobby_id !== primaryHobbyId);

        if (hobbyMismatch) {
            // Clear stale tasks from the old hobby before regenerating
            await tasksDbService.deleteAutoTasksByDate(userId, date);
            const manualTasks = existingTasks.filter(t => t.is_manual);
            // Fall through to regenerate with correct hobby
            const [snapshot, earningMethods, userEarnings] = await Promise.all([
                userStateSnapshotService.getSnapshot(userId),
                dbService.getEarningMethods(),
                dbService.getUserEarnings(userId),
            ]);
            const newTasks = taskEngine.generateDailyPlan(userId, date, snapshot, hobbies, userEarnings, earningMethods, isPremium);
            const savedTasks = await tasksDbService.upsertTasks(userId, newTasks);
            return [...manualTasks, ...savedTasks];
        }

        // 3. Return cached tasks if we have a full set for the right hobby
        if (autoTasks.length >= getAutoTasksPerDay()) {
            return existingTasks;
        }

        // 4. Not enough tasks — generate new ones
        const [snapshot, earningMethods, userEarnings] = await Promise.all([
            userStateSnapshotService.getSnapshot(userId),
            dbService.getEarningMethods(),
            dbService.getUserEarnings(userId),
        ]);

        const newTasks = taskEngine.generateDailyPlan(userId, date, snapshot, hobbies, userEarnings, earningMethods, isPremium);

        // Filter out types already present to avoid duplicates
        const existingTypes = new Set(existingTasks.map(t => t.type));
        const tasksToInsert = newTasks.filter(t => !existingTypes.has(t.type));

        if (tasksToInsert.length > 0) {
            const savedTasks = await tasksDbService.upsertTasks(userId, tasksToInsert);
            return [...existingTasks, ...savedTasks];
        }

        return existingTasks;
    },

    // Create a manual task
    createManualTask: async (userId: string, type: TaskType, date: string, template?: { title: string; duration: number }): Promise<Task> => {
        const [snapshot, hobbies] = await Promise.all([
            userStateSnapshotService.getSnapshot(userId),
            dbService.getUserHobbies(userId),
        ]);

        const newTask = taskEngine.generateTaskByType(userId, type, date, snapshot, hobbies, template);

        const [savedTask] = await tasksDbService.upsertTasks(userId, [newTask]);
        return savedTask;
    },

    // Complete a task
    completeTask: async (userId: string, taskId: string, feedback?: {
        difficulty_rating?: number;
        engagement_rating?: number;
        user_notes?: string;
    }): Promise<Task | null> => {
        // Update status and feedback
        const updates: Partial<Pick<Task, 'status' | 'difficulty_rating' | 'engagement_rating' | 'user_notes'>> = { status: 'completed' };
        if (feedback) {
            if (feedback.difficulty_rating) updates.difficulty_rating = feedback.difficulty_rating;
            if (feedback.engagement_rating) updates.engagement_rating = feedback.engagement_rating;
            if (feedback.user_notes) updates.user_notes = feedback.user_notes;
        }

        const updatedTask = await tasksDbService.updateTaskStatus(userId, taskId, 'completed', updates);

        if (updatedTask) {
            // Update stats
            const today = getTodayDateString();
            const currentStats = await dbService.getDailyStats(userId, today);
            const newCount = (currentStats?.tasks_completed || 0) + 1;

            await dbService.updateDailyStats(userId, today, { tasks_completed: newCount });

            // Sync Data Quality Metrics (fire and forget)
            if (updatedTask.scheduled_date) {
                metricService.syncDailyMetrics(userId, updatedTask.scheduled_date).catch((err: unknown) =>
                    console.error('Background metric sync failed', err)
                );
            }

            // check Streak: increments only when all non-manual tasks are completed
            const dailyTasks = await tasksDbService.getTasksByDate(userId, today);
            if (shouldIncrementStreak(dailyTasks)) {
                await dbService.incrementStreak(userId);
            }

            // Check AI triggers
            await aiJobService.checkTriggers(userId);
        }

        return updatedTask;
    },

    // Un-complete a task
    uncompleteTask: async (userId: string, taskId: string): Promise<Task | null> => {
        // Update status to pending
        const updatedTask = await tasksDbService.updateTaskStatus(userId, taskId, 'pending');

        if (updatedTask) {
            // Update stats
            const today = getTodayDateString();
            const currentStats = await dbService.getDailyStats(userId, today);
            const newCount = Math.max(0, (currentStats?.tasks_completed || 0) - 1);

            await dbService.updateDailyStats(userId, today, { tasks_completed: newCount });

            // check Streak: decrementing isn't strictly necessary for a simple un-complete 
            // since streak increments on the first time they finish all tasks.
            // If they uncomplete, they still hit the streak that day unless we want strict retraction.
            // For now, decreasing tasks counts is enough.
        }

        return updatedTask;
    },

    // Skip a task
    skipTask: async (userId: string, taskId: string): Promise<Task | null> => {
        return await tasksDbService.updateTaskStatus(userId, taskId, 'skipped');
    },

    // Refresh plan (e.g., after AI rebuild)
    refreshPlan: async (userId: string, date: string): Promise<Task[]> => {
        // Force fetch from DB (assuming AI worker updated it)
        return await tasksDbService.getTasksByDate(userId, date);
    }
};
