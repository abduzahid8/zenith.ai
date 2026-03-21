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
import { useAuthStore } from './authStore';
import { screenTimeService } from '../services/screenTimeService';

type WeeklyPoint = { date: string; seconds: number };

const toIsoDate = (date: Date): string => date.toISOString().split('T')[0];

const coerceWeeklyPoints = (weeklyData: WeeklyPoint[]): WeeklyPoint[] => (
    Array.isArray(weeklyData)
        ? weeklyData.filter(day => day && typeof day.seconds === 'number' && typeof day.date === 'string')
        : []
);

const fillLastDays = (weeklyData: WeeklyPoint[], days: number): WeeklyPoint[] => {
    const totalsByDate = new Map<string, number>();
    coerceWeeklyPoints(weeklyData).forEach((day) => {
        const current = totalsByDate.get(day.date) ?? 0;
        totalsByDate.set(day.date, current + Math.max(0, Math.round(day.seconds)));
    });

    const now = new Date();
    const filled: WeeklyPoint[] = [];
    for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(now.getDate() - i);
        const key = toIsoDate(date);
        filled.push({ date: key, seconds: totalsByDate.get(key) ?? 0 });
    }
    return filled;
};

const computeWeeklyMetrics = (allData: WeeklyPoint[]): {
    averageDailySeconds: number;
    changeFromLastWeek: number;
} => {
    const sorted = [...coerceWeeklyPoints(allData)].sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const thisWeek = sorted.slice(-7);
    const lastWeek = sorted.slice(-14, -7);

    const avgThis = thisWeek.length > 0
        ? thisWeek.reduce((s, d) => s + d.seconds, 0) / thisWeek.length
        : 0;
    const avgLast = lastWeek.length > 0
        ? lastWeek.reduce((s, d) => s + d.seconds, 0) / lastWeek.length
        : 0;

    return {
        averageDailySeconds: Math.round(avgThis),
        changeFromLastWeek: avgLast > 0
            ? Math.round(((avgThis - avgLast) / avgLast) * 100)
            : 0,
    };
};

const mapDailyTotalsToWeeklyPoints = (dailyTotals: Record<string, number> | undefined): WeeklyPoint[] => {
    if (!dailyTotals) return [];
    return Object.entries(dailyTotals).map(([date, seconds]) => ({
        date,
        seconds: typeof seconds === 'number' ? Math.max(0, Math.round(seconds)) : 0,
    }));
};

interface DeviceScreenTimeState {
    // Permission state
    isAuthorized: boolean;
    isChecking: boolean;
    dataSource: 'native' | 'supabase' | null;

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
    dataSource: null as 'native' | 'supabase' | null,
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
                    set({
                        isAuthorized: false,
                        isChecking: false,
                        error: 'Screen Time module unavailable. Use a dev/prod build instead of Expo Go.',
                    });
                    return false;
                }

                set({ isChecking: true, error: null });
                try {
                    const authorized = await hasScreenTimePermission();
                    const status = Platform.OS === 'ios' ? getAuthorizationStatus() : null;
                    const deniedError = !authorized
                        ? (Platform.OS === 'ios' && status === 'denied'
                            ? 'Screen Time access is disabled. Enable it in Settings > Screen Time.'
                            : 'No device data access. Grant permission to see full analytics.')
                        : null;

                    set({ isAuthorized: authorized, isChecking: false, error: deniedError });
                    return authorized;
                } catch (error) {
                    console.error('Check permission error:', error);
                    set({ isChecking: false, error: 'Failed to check permission' });
                    return false;
                }
            },

            requestPermission: async () => {
                if (!isScreenTimeAvailable()) {
                    set({
                        isAuthorized: false,
                        isChecking: false,
                        error: 'Screen Time module unavailable. Build the app via EAS/dev build.',
                    });
                    return false;
                }

                set({ isChecking: true, error: null });
                try {
                    await requestScreenTimePermission();
                    const granted = await hasScreenTimePermission();
                    set({
                        isAuthorized: granted,
                        isChecking: false,
                        error: granted
                            ? null
                            : 'Access not granted. Using server-side analytics if data is available.',
                    });

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
                    const user = useAuthStore.getState().user;
                    if (!get().isAuthorized && user) {
                        const summary = await screenTimeService.getTodaySummary(user.id);
                        set({
                            todayTotalSeconds: summary.total_seconds,
                            todayUsageSummary: null,
                            topApps: summary.top_apps.map((item) => ({
                                bundleId: '',
                                appName: item.app,
                                totalTimeSeconds: item.seconds,
                                category: 'other',
                                lastUsedTimestamp: 0,
                            })),
                            isLoading: false,
                            dataSource: 'supabase',
                            lastUpdated: Date.now(),
                        });
                        return;
                    }

                    const totalSeconds = await getTodayScreenTime();

                    let summary: DailyUsageSummary | null = null;
                    let apps: AppUsageData[] = [];

                    // iOS-specific detailed data
                    if (Platform.OS === 'ios') {
                        summary = await getTodayUsageSummary();
                        apps = await getTopApps(10);
                    }

                    if (user && totalSeconds === 0) {
                        const fallbackSummary = await screenTimeService.getTodaySummary(user.id);
                        if (fallbackSummary.total_seconds > 0) {
                            set({
                                todayTotalSeconds: fallbackSummary.total_seconds,
                                todayUsageSummary: null,
                                topApps: fallbackSummary.top_apps.map((item) => ({
                                    bundleId: '',
                                    appName: item.app,
                                    totalTimeSeconds: item.seconds,
                                    category: 'other',
                                    lastUsedTimestamp: 0,
                                })),
                                isLoading: false,
                                dataSource: 'supabase',
                                lastUpdated: Date.now(),
                            });
                            return;
                        }
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
                        dataSource: 'native',
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
                    const user = useAuthStore.getState().user;
                    if (!user) return;

                    const { topApps } = get();
                    if (topApps.length === 0) return;

                    await screenTimeService.syncNativeData(user.id, topApps);
                } catch (error) {
                    console.error('Sync to Supabase error:', error);
                }
            },

            fetchWeeklyData: async () => {
                set({ isLoading: true, error: null });
                try {
                    const user = useAuthStore.getState().user;
                    if (!get().isAuthorized && user) {
                        const trends = await screenTimeService.getWeeklyTrends(user.id);
                        const filledWeeklyData = fillLastDays(mapDailyTotalsToWeeklyPoints(trends.daily_totals), 7);
                        const { averageDailySeconds, changeFromLastWeek } = computeWeeklyMetrics(filledWeeklyData);
                        set({
                            weeklyData: filledWeeklyData,
                            averageDailySeconds,
                            changeFromLastWeek,
                            isLoading: false,
                            dataSource: 'supabase',
                            lastUpdated: Date.now(),
                        });
                        return;
                    }

                    const nativeData = await getWeeklyScreenTime();
                    const userHasNativeData = nativeData.some((day) => (day?.seconds ?? 0) > 0);

                    if (user && !userHasNativeData) {
                        const trends = await screenTimeService.getWeeklyTrends(user.id);
                        const fallbackPoints = fillLastDays(mapDailyTotalsToWeeklyPoints(trends.daily_totals), 7);
                        const hasFallbackData = fallbackPoints.some((day) => day.seconds > 0);
                        if (hasFallbackData) {
                            const { averageDailySeconds, changeFromLastWeek } = computeWeeklyMetrics(fallbackPoints);
                            set({
                                weeklyData: fallbackPoints,
                                averageDailySeconds,
                                changeFromLastWeek,
                                isLoading: false,
                                dataSource: 'supabase',
                                lastUpdated: Date.now(),
                            });
                            return;
                        }
                    }

                    const filledWeeklyData = fillLastDays(nativeData, 7);
                    const { averageDailySeconds, changeFromLastWeek } = computeWeeklyMetrics(nativeData);

                    set({
                        weeklyData: filledWeeklyData,
                        averageDailySeconds,
                        changeFromLastWeek,
                        isLoading: false,
                        dataSource: 'native',
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
                    await get().checkPermission();
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
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
};

// Helper function to format seconds to hours with decimal
export const formatScreenTimeHours = (seconds: number): string => {
    const hours = seconds / 3600;
    return `${hours.toFixed(1)}h`;
};

export default useDeviceScreenTimeStore;
