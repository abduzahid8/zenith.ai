// Device Screen Time Store
// Zustand store for native device screen time data using device-activity module

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import {
    hasScreenTimePermission,
    requestScreenTimePermission,
    getTodayScreenTime,
    getWeeklyScreenTime,
    getAuthorizationStatus,
    getTodayUsageSummary,
    getTopApps,
    setCategoryLimit,
    clearAllLimits,
    isScreenTimeAvailable,
    DailyUsageSummary,
    AppUsageData,
} from '../../modules/device-activity';

interface DeviceScreenTimeState {
    // Permission state
    isAuthorized: boolean;
    isChecking: boolean;

    // Today's data
    todayTotalSeconds: number;
    todayUsageSummary: DailyUsageSummary | null;
    topApps: AppUsageData[];

    // Weekly data
    weeklyData: { date: string; seconds: number }[];

    // Computed stats
    averageDailySeconds: number;
    changeFromLastWeek: number; // percentage

    // Loading states
    isLoading: boolean;
    error: string | null;
    lastUpdated: number | null;

    // Actions
    checkPermission: () => Promise<boolean>;
    requestPermission: () => Promise<boolean>;
    fetchTodayData: () => Promise<void>;
    fetchWeeklyData: () => Promise<void>;
    setCategoryLimit: (category: string, seconds: number) => Promise<boolean>;
    clearLimits: () => Promise<boolean>;
    refresh: () => Promise<void>;
    syncToSupabase: () => Promise<void>;
    reset: () => void;
}

const initialState = {
    isAuthorized: false,
    isChecking: false,
    todayTotalSeconds: 0,
    todayUsageSummary: null,
    topApps: [],
    weeklyData: [],
    averageDailySeconds: 0,
    changeFromLastWeek: 0,
    isLoading: false,
    error: null,
    lastUpdated: null,
};

export const useDeviceScreenTimeStore = create<DeviceScreenTimeState>()(
    persist(
        (set, get) => ({
            ...initialState,

            checkPermission: async () => {
                if (!isScreenTimeAvailable()) {
                    set({ isAuthorized: false, error: 'Screen Time not available on this device' });
                    return false;
                }

                set({ isChecking: true });
                try {
                    const authorized = await hasScreenTimePermission();
                    set({ isAuthorized: authorized, isChecking: false });
                    return authorized;
                } catch (error) {
                    console.error('Check permission error:', error);
                    set({ isChecking: false, error: 'Failed to check permission' });
                    return false;
                }
            },

            requestPermission: async () => {
                set({ isChecking: true, error: null });
                try {
                    const granted = await requestScreenTimePermission();
                    set({ isAuthorized: granted, isChecking: false });

                    if (granted) {
                        // Auto-fetch data after permission granted
                        await get().refresh();
                    }

                    return granted;
                } catch (error) {
                    console.error('Request permission error:', error);
                    set({ isChecking: false, error: 'Failed to request permission' });
                    return false;
                }
            },

            fetchTodayData: async () => {
                set({ isLoading: true, error: null });
                try {
                    const totalSeconds = await getTodayScreenTime();

                    let summary: DailyUsageSummary | null = null;
                    let apps: AppUsageData[] = [];

                    // iOS-specific detailed data
                    if (Platform.OS === 'ios') {
                        summary = await getTodayUsageSummary();
                        apps = await getTopApps(10);
                    }

                    // Sync to Supabase if we have a user
                    // We need to access auth store, but since we are in a store, 
                    // we can't easily access another store's state directly inside the action 
                    // without passing it or improved architecture.
                    // For now, let's assume the caller or a subscriber will handle sync, 
                    // OR we import the auth store directly (circular dependency risk?).
                    // Actually, Zustand stores are singletons, so importing useAuthStore is fine 
                    // as long as we use getState().

                    // Note: We'll implement a separate sync action that the UI can call 
                    // or we call it here if we resolve the dependency.
                    // For simplicity, let's add a sync method to the store.

                    set({
                        todayTotalSeconds: totalSeconds,
                        todayUsageSummary: summary,
                        topApps: apps,
                        isLoading: false,
                        lastUpdated: Date.now(),
                    });

                    // Auto-sync if data exists
                    if (apps.length > 0) {
                        get().syncToSupabase();
                    }

                } catch (error) {
                    console.error('Fetch today data error:', error);
                    set({ isLoading: false, error: 'Failed to fetch screen time data' });
                }
            },

            syncToSupabase: async () => {
                try {
                    // Import here to avoid circular dependency issues at top level if possible
                    const { useAuthStore } = require('./authStore');
                    const user = useAuthStore.getState().user;

                    if (!user) return;

                    const { topApps } = get();
                    if (topApps.length === 0) return;

                    // Dynamically import service to avoid circular dependency
                    const { screenTimeService } = require('../services/screenTimeService');

                    await screenTimeService.syncNativeData(user.id, topApps);
                    // Screen time data synced to Supabase
                } catch (error) {
                    console.error('Sync to Supabase error:', error);
                    // Don't set global error state for background sync failures
                }
            },

            fetchWeeklyData: async () => {
                set({ isLoading: true, error: null });
                try {
                    const weeklyData = await getWeeklyScreenTime();

                    // Ensure weeklyData is valid array
                    const validData = Array.isArray(weeklyData)
                        ? weeklyData.filter(day => day && typeof day.seconds === 'number')
                        : [];

                    // Calculate averages
                    const totalSeconds = validData.reduce((sum, day) => sum + (day.seconds || 0), 0);
                    const averageDailySeconds = validData.length > 0
                        ? Math.round(totalSeconds / validData.length)
                        : 0;

                    // Calculate change (compare this week's average to last week's simulated)
                    // In real implementation, this would compare to actual last week data
                    const changeFromLastWeek = 0; // Placeholder

                    set({
                        weeklyData: validData,
                        averageDailySeconds,
                        changeFromLastWeek,
                        isLoading: false,
                        lastUpdated: Date.now(),
                    });
                } catch (error) {
                    console.error('Fetch weekly data error:', error);
                    set({ isLoading: false, error: 'Failed to fetch weekly data' });
                }
            },

            setCategoryLimit: async (category: string, seconds: number) => {
                if (Platform.OS !== 'ios') return false;

                try {
                    const success = await setCategoryLimit(category, seconds);
                    return success;
                } catch (error) {
                    console.error('Set limit error:', error);
                    set({ error: 'Failed to set app limit' });
                    return false;
                }
            },

            clearLimits: async () => {
                if (Platform.OS !== 'ios') return false;

                try {
                    const success = await clearAllLimits();
                    return success;
                } catch (error) {
                    console.error('Clear limits error:', error);
                    set({ error: 'Failed to clear limits' });
                    return false;
                }
            },

            refresh: async () => {
                const { isAuthorized, fetchTodayData, fetchWeeklyData } = get();

                if (!isAuthorized) {
                    const authorized = await get().checkPermission();
                    if (!authorized) return;
                }

                await Promise.all([
                    fetchTodayData(),
                    fetchWeeklyData(),
                ]);
            },

            reset: () => set(initialState),
        }),
        {
            name: 'device-screen-time-storage',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({
                todayTotalSeconds: state.todayTotalSeconds,
                averageDailySeconds: state.averageDailySeconds,
                lastUpdated: state.lastUpdated,
            }),
        }
    )
);

// Helper function to format seconds to readable time
export const formatScreenTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
        return `${hours}ч ${minutes}м`;
    }
    return `${minutes}м`;
};

// Helper function to format seconds to hours with decimal
export const formatScreenTimeHours = (seconds: number): string => {
    const hours = seconds / 3600;
    return `${hours.toFixed(1)}ч`;
};

export default useDeviceScreenTimeStore;
