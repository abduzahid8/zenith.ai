import { tasksDbService } from './supabase/tasks';
import { userStateSnapshotService } from './supabase/userStateSnapshot';
import { metricService } from './metricService';
import { dbService } from './supabase'; // Access to all other services
import { taskEngine } from './taskEngine';
import { aiJobService } from './aiJobService';
import { Task, TaskStatus, TaskType } from './supabase/types';
import { getTodayDateString } from '../utils/date';
import { shouldIncrementStreak } from '../domain/tasks/rules';

export const taskService = {
    // Get or generate the daily plan
    getDailyPlan: async (userId: string, date: string): Promise<Task[]> => {
        // 1. Try to fetch existing tasks
        const existingTasks = await tasksDbService.getTasksByDate(userId, date);
        if (existingTasks.length >= 2) {
            return existingTasks;
        }

        // 2. If not enough tasks, generate new ones via deterministic engine

        // Fetch required data
        const [snapshot, hobbies, earningMethods, userEarnings] = await Promise.all([
            userStateSnapshotService.getSnapshot(userId),
            dbService.getUserHobbies(userId),
            dbService.getEarningMethods(),
            dbService.getUserEarnings(userId)
        ]);

        // Generate tasks
        const newTasks = taskEngine.generateDailyPlan(
            userId,
            date,
            snapshot,
            hobbies,
            userEarnings,
            earningMethods
        );

        // Save to DB
        // Check if we need to filter out existing ones to avoid duplicates if partial plan existed
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
