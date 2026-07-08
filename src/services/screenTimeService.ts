// Screen Time Service
// Handles screen time tracking, limits, and the "Stimulus Shift" algorithm

import { dbService, ScreenTimeLog, ScreenTimeLimit, SubstituteNotification } from './supabase';
import { aiService } from './ai';
import { useGoalStore } from '../store/goalStore';

// App categories for classification
export const APP_CATEGORIES = {
    social_media: ['TikTok', 'Instagram', 'Facebook', 'Twitter', 'Snapchat', 'VK', 'Telegram'],
    entertainment: ['YouTube', 'Netflix', 'Twitch', 'Spotify', 'Disney+'],
    gaming: ['Games', 'Steam', 'Epic Games'],
    productivity: ['Notes', 'Calendar', 'Mail', 'Slack', 'Notion'],
    other: []
} as const;

// Classify an app into a category
export const classifyApp = (appName: string): ScreenTimeLog['category'] => {
    const normalizedName = appName.toLowerCase();

    for (const [category, apps] of Object.entries(APP_CATEGORIES)) {
        if (apps.some(app => normalizedName.includes(app.toLowerCase()))) {
            return category as ScreenTimeLog['category'];
        }
    }
    return 'other';
};

// Calculate usage percentage against limit
export const calculateUsagePercent = (usedSeconds: number, limitSeconds: number): number => {
    if (limitSeconds <= 0) return 0;
    return Math.min(100, Math.round((usedSeconds / limitSeconds) * 100));
};

// Get limit threshold level
export const getLimitLevel = (usagePercent: number): 'safe' | 'warning' | 'danger' | 'exceeded' => {
    if (usagePercent >= 100) return 'exceeded';
    if (usagePercent >= 80) return 'danger';
    if (usagePercent >= 50) return 'warning';
    return 'safe';
};

// Service for screen time operations
export const screenTimeService = {
    // Log screen time usage
    logUsage: async (userId: string, appName: string, durationSeconds: number) => {
        const category = classifyApp(appName);
        return dbService.logScreenTime(userId, {
            app_name: appName,
            category,
            duration_seconds: durationSeconds,
            date: new Date().toISOString().split('T')[0]
        });
    },

    // Sync native device data to Supabase
    syncNativeData: async (userId: string, apps: Array<{ appName: string; totalTimeSeconds: number }>) => {
        const date = new Date().toISOString().split('T')[0];

        const logs = apps.map(app => ({
            app_name: app.appName,
            app_package: undefined, // Native module might not provide package name in the summarized view yet
            category: classifyApp(app.appName),
            duration_seconds: app.totalTimeSeconds,
        }));

        return dbService.syncDailyScreenTime(userId, date, logs);
    },

    // Get today's usage summary
    getTodaySummary: async (userId: string) => {
        const logs = await dbService.getDailyScreenTime(userId);

        const summary = {
            total_seconds: 0,
            by_category: {} as Record<string, number>,
            by_app: {} as Record<string, number>,
            top_apps: [] as Array<{ app: string; seconds: number }>
        };

        for (const log of logs) {
            summary.total_seconds += log.duration_seconds;

            const cat = log.category || 'other';
            summary.by_category[cat] = (summary.by_category[cat] || 0) + log.duration_seconds;

            summary.by_app[log.app_name] = (summary.by_app[log.app_name] || 0) + log.duration_seconds;
        }

        // Sort apps by usage
        summary.top_apps = Object.entries(summary.by_app)
            .map(([app, seconds]) => ({ app, seconds }))
            .sort((a, b) => b.seconds - a.seconds)
            .slice(0, 5);

        return summary;
    },

    // Get weekly usage trends
    getWeeklyTrends: async (userId: string) => {
        const logs = await dbService.getWeeklyScreenTime(userId);

        const dailyTotals: Record<string, number> = {};
        const categoryTotals: Record<string, number> = {};

        for (const log of logs) {
            const date = log.date || new Date().toISOString().split('T')[0];
            dailyTotals[date] = (dailyTotals[date] || 0) + log.duration_seconds;

            const cat = log.category || 'other';
            categoryTotals[cat] = (categoryTotals[cat] || 0) + log.duration_seconds;
        }

        const days = Object.keys(dailyTotals).sort();
        const avgDaily = days.length > 0
            ? Object.values(dailyTotals).reduce((a, b) => a + b, 0) / days.length
            : 0;

        return {
            daily_totals: dailyTotals,
            category_totals: categoryTotals,
            average_daily_seconds: Math.round(avgDaily),
            trend: days.length >= 2
                ? (dailyTotals[days[days.length - 1]] < dailyTotals[days[0]] ? 'decreasing' : 'increasing')
                : 'stable'
        };
    },

    // Check if user is approaching or exceeding limits
    checkLimits: async (userId: string, appName?: string) => {
        const limits = await dbService.getScreenTimeLimits(userId);
        const todayLogs = await dbService.getDailyScreenTime(userId);

        // Calculate current usage by app and category
        const usageByApp: Record<string, number> = {};
        const usageByCategory: Record<string, number> = {};

        for (const log of todayLogs) {
            usageByApp[log.app_name] = (usageByApp[log.app_name] || 0) + log.duration_seconds;
            const cat = log.category || 'other';
            usageByCategory[cat] = (usageByCategory[cat] || 0) + log.duration_seconds;
        }

        const violations: Array<{
            type: 'app' | 'category';
            name: string;
            used_seconds: number;
            limit_seconds: number;
            level: ReturnType<typeof getLimitLevel>;
            limit: ScreenTimeLimit;
        }> = [];

        for (const limit of limits) {
            let used = 0;
            let name = '';
            let type: 'app' | 'category' = 'app';

            if (limit.app_name) {
                if (appName && limit.app_name !== appName) continue;
                used = usageByApp[limit.app_name] || 0;
                name = limit.app_name;
                type = 'app';
            } else if (limit.category) {
                used = usageByCategory[limit.category] || 0;
                name = limit.category;
                type = 'category';
            }

            const limitSeconds = limit.daily_limit_seconds || 0;
            if (limitSeconds > 0) {
                const percent = calculateUsagePercent(used, limitSeconds);
                const level = getLimitLevel(percent);

                if (level !== 'safe') {
                    violations.push({
                        type,
                        name,
                        used_seconds: used,
                        limit_seconds: limitSeconds,
                        level,
                        limit
                    });
                }
            }
        }

        return violations;
    },

    // Create a default set of limits for a new user
    createDefaultLimits: async (userId: string) => {
        const defaults: Array<Omit<ScreenTimeLimit, 'id' | 'user_id' | 'created_at'>> = [
            {
                category: 'social_media',
                daily_limit_seconds: 60 * 60, // 1 hour
                limit_type: 'soft',
                notification_message: 'Ты провёл час в соцсетях. Может, пора заняться хобби?',
                is_active: true
            },
            {
                category: 'entertainment',
                daily_limit_seconds: 90 * 60, // 1.5 hours
                limit_type: 'soft',
                notification_message: 'Время развлечений подходит к концу. Есть идеи для практики?',
                is_active: true
            },
            {
                category: 'gaming',
                daily_limit_seconds: 60 * 60, // 1 hour
                limit_type: 'medium',
                notification_message: 'Игровая сессия завершается. Переключимся на саморазвитие?',
                is_active: true
            }
        ];

        const results = [];
        for (const limit of defaults) {
            try {
                const result = await dbService.setScreenTimeLimit(userId, limit);
                results.push(result);
            } catch (e) {
                console.error('Failed to create default limit:', e);
            }
        }
        return results;
    },

    // Set a screen time limit
    setScreenTimeLimit: async (
        userId: string,
        limit: Omit<ScreenTimeLimit, 'id' | 'user_id' | 'created_at'>
    ) => {
        return dbService.setScreenTimeLimit(userId, limit);
    },

    // Generate a substitute notification when limit is approached
    generateSubstituteNotification: async (
        userId: string,
        triggeredByApp: string,
        userHobby?: string
    ): Promise<SubstituteNotification | null> => {
        try {
            // Get AI-generated content
            const content = await aiService.generateSubstituteContent(
                triggeredByApp,
                userHobby || 'general'
            );

            // Inject goal context into notification
            let message = content.message;
            let action = content.action;
            if (userHobby) {
                const snapshot = useGoalStore.getState().getSnapshot(userHobby as any);
                if (snapshot) {
                    message = `[${snapshot.percentComplete}% toward "${snapshot.definition.description}"] ${message}`;
                    action = `Complete today's ${userHobby} step — ${snapshot.unitsRemaining} ${snapshot.definition.type === 'reading_books' ? 'books' : 'units'} remain`;
                }
            }

            const notification: Omit<SubstituteNotification, 'id' | 'user_id' | 'created_at'> = {
                triggered_by_app: triggeredByApp,
                notification_type: (content.type || 'reminder') as 'reminder' | 'challenge' | 'insight' | 'motivation',
                notification_content: message,
                suggested_action: action
            };

            return dbService.logSubstituteNotification(userId, notification);
        } catch (e) {
            console.error('Failed to generate substitute notification:', e);

            // Fallback with goal context
            let fallbackMessage = 'Хочешь заняться чем-то полезным?';
            let fallbackAction = 'Открой приложение и начни сессию';
            if (userHobby) {
                const snapshot = useGoalStore.getState().getSnapshot(userHobby as any);
                if (snapshot) {
                    fallbackMessage = `Your next step toward "${snapshot.definition.description}" — ${snapshot.unitsRemaining} ${snapshot.definition.type === 'reading_books' ? 'books' : 'units'} remain`;
                    fallbackAction = `Start today's ${userHobby} lesson`;
                }
            }

            const fallback: Omit<SubstituteNotification, 'id' | 'user_id' | 'created_at'> = {
                triggered_by_app: triggeredByApp,
                notification_type: 'reminder',
                notification_content: fallbackMessage,
                suggested_action: fallbackAction
            };
            return dbService.logSubstituteNotification(userId, fallback);
        }
    },

    // Record user's response to a notification
    recordNotificationResponse: async (
        notificationId: string,
        action: SubstituteNotification['action_taken'],
        responseTimeSeconds?: number
    ) => {
        return dbService.updateNotificationResponse(notificationId, action, responseTimeSeconds);
    },

    // Get notification effectiveness stats
    getNotificationEffectiveness: async (userId: string, days: number = 7) => {
        const stats = await dbService.getNotificationStats(userId, days);

        return {
            ...stats,
            acceptance_rate: stats.total > 0
                ? Math.round((stats.accepted / stats.total) * 100)
                : 0,
            effectiveness: stats.total > 0
                ? (stats.accepted > stats.dismissed ? 'good' : 'needs_improvement')
                : 'no_data'
        };
    },

    // Stimulus Shift Algorithm - generate micro-tasks to replace dopamine hits
    getStimulusShiftContent: async (userId: string, currentApp: string, hobby?: string) => {
        // This would generate quick, engaging content to replace social media scrolling
        const microTasks = [
            { type: 'insight', content: 'Знал ли ты? 🧠', duration: '30 сек' },
            { type: 'challenge', content: 'Мини-челлендж', duration: '2 мин' },
            { type: 'progress', content: 'Твой прогресс', duration: '1 мин' },
            { type: 'tip', content: 'Совет дня', duration: '30 сек' }
        ];

        // Return a random micro-task or generate one via AI
        const randomTask = microTasks[Math.floor(Math.random() * microTasks.length)];

        try {
            // Try to get AI-generated content
            const aiContent = await aiService.generateSubstituteContent(currentApp, hobby || 'general');
            return {
                ...randomTask,
                content: aiContent.message,
                action: aiContent.action
            };
        } catch {
            return randomTask;
        }
    }
};

export default screenTimeService;
