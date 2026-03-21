// Screen Time Store
// Zustand store for screen time tracking state management

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { screenTimeService } from '../services/screenTimeService';
import { ScreenTimeLog, ScreenTimeLimit } from '../services/supabase';

interface ScreenTimeState {
    // Data
    todayLogs: ScreenTimeLog[];
    weeklyLogs: ScreenTimeLog[];
    limits: ScreenTimeLimit[];

    // Computed
    todayTotalSeconds: number;
    socialMediaSeconds: number;
    topApps: Array<{ app: string; seconds: number }>;

    // Loading states
    isLoading: boolean;
    error: string | null;

    // Notification state
    lastNotificationId: string | null;
    notificationEffectiveness: {
        total: number;
        accepted: number;
        dismissed: number;
        acceptance_rate: number;
    } | null;

    // Actions
    initialize: (userId: string) => Promise<void>;
    logUsage: (userId: string, appName: string, durationSeconds: number) => Promise<void>;
    refreshTodayData: (userId: string) => Promise<void>;
    refreshWeeklyData: (userId: string) => Promise<void>;
    checkLimits: (userId: string, appName?: string) => Promise<any[]>;
    setLimit: (userId: string, limit: Omit<ScreenTimeLimit, 'id' | 'user_id' | 'created_at'>) => Promise<void>;
    createDefaultLimits: (userId: string) => Promise<void>;
    generateSubstituteNotification: (userId: string, app: string, hobby?: string) => Promise<void>;
    recordNotificationResponse: (action: 'accepted' | 'dismissed' | 'snoozed', responseTime?: number) => Promise<void>;
    clearError: () => void;
    reset: () => void;
}

const initialState = {
    todayLogs: [],
    weeklyLogs: [],
    limits: [],
    todayTotalSeconds: 0,
    socialMediaSeconds: 0,
    topApps: [],
    isLoading: false,
    error: null,
    lastNotificationId: null,
    notificationEffectiveness: null,
};

export const useScreenTimeStore = create<ScreenTimeState>()(
    persist(
        (set, get) => ({
            ...initialState,

            initialize: async (userId: string) => {
                try {
                    set({ isLoading: true, error: null });

                    // Load today's data
                    const todayLogs = await screenTimeService.getTodaySummary(userId);
                    const limits = await screenTimeService.checkLimits(userId);

                    // Calculate totals
                    const socialMediaSeconds = todayLogs.by_category?.social_media || 0;

                    set({
                        todayTotalSeconds: todayLogs.total_seconds,
                        socialMediaSeconds,
                        topApps: todayLogs.top_apps,
                        isLoading: false,
                    });

                    // Load notification effectiveness
                    const effectiveness = await screenTimeService.getNotificationEffectiveness(userId);
                    set({ notificationEffectiveness: effectiveness });

                } catch (error) {
                    console.error('Screen time init error:', error);
                    set({ error: 'Failed to load screen time data', isLoading: false });
                }
            },

            logUsage: async (userId: string, appName: string, durationSeconds: number) => {
                try {
                    await screenTimeService.logUsage(userId, appName, durationSeconds);
                    // Refresh today's data after logging
                    await get().refreshTodayData(userId);
                } catch (error) {
                    console.error('Log usage error:', error);
                    set({ error: 'Failed to record usage' });
                }
            },

            refreshTodayData: async (userId: string) => {
                try {
                    const summary = await screenTimeService.getTodaySummary(userId);
                    set({
                        todayTotalSeconds: summary.total_seconds,
                        socialMediaSeconds: summary.by_category?.social_media || 0,
                        topApps: summary.top_apps,
                    });
                } catch (error) {
                    console.error('Refresh today data error:', error);
                }
            },

            refreshWeeklyData: async (userId: string) => {
                try {
                    const trends = await screenTimeService.getWeeklyTrends(userId);
                    // Store weekly data as needed
                } catch (error) {
                    console.error('Refresh weekly data error:', error);
                }
            },

            checkLimits: async (userId: string, appName?: string) => {
                try {
                    return await screenTimeService.checkLimits(userId, appName);
                } catch (error) {
                    console.error('Check limits error:', error);
                    return [];
                }
            },

            setLimit: async (userId: string, limit) => {
                try {
                    await screenTimeService.setScreenTimeLimit(userId, limit);
                    // Refresh limits
                    const newLimits = await screenTimeService.checkLimits(userId);
                    set({ limits: newLimits.map(v => v.limit) });
                } catch (error) {
                    console.error('Set limit error:', error);
                    set({ error: 'Failed to set limit' });
                }
            },

            createDefaultLimits: async (userId: string) => {
                try {
                    await screenTimeService.createDefaultLimits(userId);
                    const newLimits = await screenTimeService.checkLimits(userId);
                    set({ limits: newLimits.map(v => v.limit) });
                } catch (error) {
                    console.error('Create default limits error:', error);
                }
            },

            generateSubstituteNotification: async (userId: string, app: string, hobby?: string) => {
                try {
                    const notification = await screenTimeService.generateSubstituteNotification(
                        userId,
                        app,
                        hobby
                    );
                    if (notification) {
                        set({ lastNotificationId: notification.id || null });
                    }
                } catch (error) {
                    console.error('Generate notification error:', error);
                }
            },

            recordNotificationResponse: async (action, responseTime) => {
                const { lastNotificationId } = get();
                if (!lastNotificationId) return;

                try {
                    await screenTimeService.recordNotificationResponse(
                        lastNotificationId,
                        action,
                        responseTime
                    );
                    set({ lastNotificationId: null });
                } catch (error) {
                    console.error('Record response error:', error);
                }
            },

            clearError: () => set({ error: null }),

            reset: () => set(initialState),
        }),
        {
            name: 'screen-time-storage',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({
                todayTotalSeconds: state.todayTotalSeconds,
                socialMediaSeconds: state.socialMediaSeconds,
            }),
        }
    )
);

export default useScreenTimeStore;
