// Barrel re-exports for backward compatibility
// Consumers can import from '../services/supabase' as before

export { getSupabase } from './client';

// Types
export type {
    QuizAnswer,
    UserHobby,
    Session,
    UserProfile,
    ScreenTimeLog,
    ScreenTimeLimit,
    ContentItem,
    UserContentHistory,
    EarningMethod,
    UserEarning,
    WeeklyPlan,
    DailyStats,
    SubstituteNotification,
    Task,
    TaskType,
    TaskStatus,
    AiJob,
    AiJobType,
    AiJobStatus,
    UserStateSnapshot,
} from './types';

// Services
export { authService } from './auth';
export { quizService } from './quiz';
export { hobbyService } from './hobbies';
export { sessionService } from './sessions';
export { profileService } from './profile';
export { screenTimeDbService } from './screenTime';
export { contentDbService } from './content';
export { earningsDbService } from './earnings';
export { weeklyPlanService } from './weeklyPlan';
export { statsService } from './stats';
export { notificationDbService } from './notifications';
export { tasksDbService } from './tasks';
export { userStateSnapshotService } from './userStateSnapshot';
export { aiJobsDbService } from './aiJobs';
export { metricService } from '../metricService';

// Backward-compatible composite dbService
// Composed from all individual services so existing consumers don't break
import { quizService } from './quiz';
import { hobbyService } from './hobbies';
import { sessionService } from './sessions';
import { profileService } from './profile';
import { screenTimeDbService } from './screenTime';
import { contentDbService } from './content';
import { earningsDbService } from './earnings';
import { weeklyPlanService } from './weeklyPlan';
import { statsService } from './stats';
import { notificationDbService } from './notifications';
import { tasksDbService } from './tasks';
import { userStateSnapshotService } from './userStateSnapshot';
import { aiJobsDbService } from './aiJobs';

export const dbService = {
    // Quiz
    saveQuizAnswers: quizService.saveQuizAnswers,
    getQuizAnswers: quizService.getQuizAnswers,
    // Hobbies
    saveHobby: hobbyService.saveHobby,
    getUserHobbies: hobbyService.getUserHobbies,
    setPrimaryHobby: hobbyService.setPrimaryHobby,
    updateHobbyProgress: hobbyService.updateHobbyProgress,
    // Sessions
    saveSession: sessionService.saveSession,
    getUserSessions: sessionService.getUserSessions,
    getSessionsByDateRange: sessionService.getSessionsByDateRange,
    // Profile
    getOrCreateProfile: profileService.getOrCreateProfile,
    updateProfile: profileService.updateProfile,
    updatePremiumStatus: profileService.updatePremiumStatus,
    updateProfileScores: profileService.updateProfileScores,
    incrementStreak: profileService.incrementStreak,
    // Screen Time
    logScreenTime: screenTimeDbService.logScreenTime,
    syncDailyScreenTime: screenTimeDbService.syncDailyScreenTime,
    getDailyScreenTime: screenTimeDbService.getDailyScreenTime,
    getWeeklyScreenTime: screenTimeDbService.getWeeklyScreenTime,
    getScreenTimeLimits: screenTimeDbService.getScreenTimeLimits,
    setScreenTimeLimit: screenTimeDbService.setScreenTimeLimit,
    // Content
    getRecommendedContent: contentDbService.getRecommendedContent,
    getUserContentHistory: contentDbService.getUserContentHistory,
    updateContentStatus: contentDbService.updateContentStatus,
    // Earnings
    getEarningMethods: earningsDbService.getEarningMethods,
    getUserEarnings: earningsDbService.getUserEarnings,
    startEarningPath: earningsDbService.startEarningPath,
    updateEarningProgress: earningsDbService.updateEarningProgress,
    // Weekly Plans
    getWeeklyPlan: weeklyPlanService.getWeeklyPlan,
    saveWeeklyPlan: weeklyPlanService.saveWeeklyPlan,
    updateWeeklyPlanTasks: weeklyPlanService.updateWeeklyPlanTasks,
    // Stats
    getDailyStats: statsService.getDailyStats,
    getWeeklyStats: statsService.getWeeklyStats,
    updateDailyStats: statsService.updateDailyStats,
    // Notifications
    logSubstituteNotification: notificationDbService.logSubstituteNotification,
    updateNotificationResponse: notificationDbService.updateNotificationResponse,
    getNotificationStats: notificationDbService.getNotificationStats,
    // Tasks
    getTasksByDate: tasksDbService.getTasksByDate,
    upsertTasks: tasksDbService.upsertTasks,
    updateTaskStatus: tasksDbService.updateTaskStatus,
    getTasksByDateRange: tasksDbService.getTasksByDateRange,
    // User State Snapshot
    getSnapshot: userStateSnapshotService.getSnapshot,
    upsertSnapshot: userStateSnapshotService.upsertSnapshot,
    // AI Jobs
    enqueueJob: aiJobsDbService.enqueueJob,
    getPendingJobs: aiJobsDbService.getPendingJobs,
    updateJobStatus: aiJobsDbService.updateJobStatus,
};
