import { requireNativeModule, Platform } from 'expo-modules-core';

// Lazily load the native module to prevent creating it at import time
// This allows the code to run even if the native module is not linked yet (e.g. in Expo Go or before rebuild)
let DeviceActivityModule: any = null;
let hasAttemptedLoad = false;

function getDeviceActivity() {
    if (DeviceActivityModule) return DeviceActivityModule;
    if (hasAttemptedLoad) return null;

    if (Platform.OS === 'ios' || Platform.OS === 'android') {
        hasAttemptedLoad = true;
        try {
            DeviceActivityModule = requireNativeModule('DeviceActivity');
        } catch (e) {
            console.warn('DeviceActivity native module is not available on this build.');
            DeviceActivityModule = null;
        }
    }
    return DeviceActivityModule;
}

function hasNativeDeviceActivityModule(): boolean {
    return !!getDeviceActivity();
}

// ============= Types =============

export interface UsageStats {
    packageName: string;
    totalTimeInForeground: number;
    lastTimeUsed: number;
}

export interface AppUsageData {
    bundleId: string;
    appName: string;
    totalTimeSeconds: number;
    category: string;
    lastUsedTimestamp: number;
}

export interface DailyUsageSummary {
    date: string;
    totalScreenTimeSeconds: number;
    socialMediaSeconds: number;
    entertainmentSeconds: number;
    productivitySeconds: number;
    gamesSeconds: number;
    otherSeconds: number;
    pickupCount: number;
    notificationCount: number;
}

export type AuthorizationStatus = 'notDetermined' | 'approved' | 'denied';

// ============= Android Functions =============

export function getUsageStats(startTime: number, endTime: number): UsageStats[] {
    const module = getDeviceActivity();
    if (Platform.OS !== 'android' || !module) return [];
    return module.getUsageStats(startTime, endTime);
}

export function requestUsagePermission(): Promise<boolean> {
    const module = getDeviceActivity();
    if (Platform.OS !== 'android' || !module) return Promise.resolve(false);
    try {
        const result = module.requestUsagePermission();
        // Native now returns a boolean, but Settings opens async so it may still be false.
        // The caller must re-check permission when the app returns to foreground.
        return Promise.resolve(result === true);
    } catch {
        return Promise.resolve(false);
    }
}

export function hasUsagePermission(): Promise<boolean> {
    const module = getDeviceActivity();
    if (Platform.OS !== 'android' || !module) return Promise.resolve(false);
    const result = module.hasUsagePermission();
    return Promise.resolve(!!result);
}

// ============= iOS Functions =============

/**
 * Get the current Screen Time authorization status (iOS only)
 */
export function getAuthorizationStatus(): AuthorizationStatus {
    const module = getDeviceActivity();
    if (Platform.OS !== 'ios' || !module) return 'notDetermined';
    return module.getAuthorizationStatus() as AuthorizationStatus;
}

/**
 * Request Screen Time authorization from user (iOS only)
 * Shows the FamilyControls authorization prompt
 */
export async function requestAuthorization(): Promise<boolean> {
    const module = getDeviceActivity();
    if (Platform.OS !== 'ios') {
        return false;
    }
    if (!module) {
        console.warn('DeviceActivity native module is null. Are you running in Expo Go?');
        return false;
    }
    try {
        const result = await module.requestAuthorization();
        return result;
    } catch (error) {
        console.error('Native requestAuthorization failed:', error);
        return false;
    }
}

/**
 * Check if Screen Time is authorized (iOS only)
 */
export function isAuthorized(): boolean {
    const module = getDeviceActivity();
    if (Platform.OS !== 'ios' || !module) return false;
    return module.isAuthorized();
}

/**
 * Get today's screen time usage summary (iOS only)
 */
export async function getTodayUsageSummary(): Promise<DailyUsageSummary | null> {
    const module = getDeviceActivity();
    if (Platform.OS !== 'ios' || !module) return null;
    return module.getTodayUsageSummary();
}

/**
 * Get usage data for a date range (iOS only)
 * @param startTimestamp - Start time in milliseconds
 * @param endTimestamp - End time in milliseconds
 */
export async function getUsageForDateRange(
    startTimestamp: number,
    endTimestamp: number
): Promise<DailyUsageSummary[]> {
    const module = getDeviceActivity();
    if (Platform.OS !== 'ios' || !module) return [];
    return module.getUsageForDateRange(startTimestamp, endTimestamp);
}

/**
 * Get the most used apps (iOS only)
 * @param limit - Maximum number of apps to return
 */
export async function getTopApps(limit: number = 10): Promise<AppUsageData[]> {
    const module = getDeviceActivity();
    if (Platform.OS !== 'ios' || !module) return [];
    return module.getTopApps(limit);
}

/**
 * Set a time limit for an app category (iOS only)
 * @param category - Category name: 'social', 'entertainment', 'games', 'productivity'
 * @param limitSeconds - Time limit in seconds
 */
export async function setCategoryLimit(
    category: string,
    limitSeconds: number
): Promise<boolean> {
    const module = getDeviceActivity();
    if (Platform.OS !== 'ios' || !module) return false;
    return module.setCategoryLimit(category, limitSeconds);
}

/**
 * Remove all app limits (iOS only)
 */
export async function clearAllLimits(): Promise<boolean> {
    const module = getDeviceActivity();
    if (Platform.OS !== 'ios' || !module) return false;
    return module.clearAllLimits();
}

/**
 * Get weekly usage statistics (iOS only)
 */
export async function getWeeklyStats(): Promise<DailyUsageSummary[]> {
    const module = getDeviceActivity();
    if (Platform.OS !== 'ios' || !module) return [];
    const result = await module.getWeeklyStats();
    return Array.isArray(result) ? result : [];
}

/**
 * Start DeviceActivityCenter daily monitoring schedule (iOS only)
 * Should be called after FamilyControls authorization is granted.
 * Records monitoring start time in App Groups for the JS side to read.
 */
export async function setupMonitoring(): Promise<boolean> {
    const module = getDeviceActivity();
    if (Platform.OS !== 'ios' || !module) return false;
    try {
        return await module.setupMonitoring();
    } catch (e) {
        console.warn('setupMonitoring error:', e);
        return false;
    }
}

/**
 * Returns the Unix timestamp (seconds) when monitoring was first started, or 0 (iOS only)
 */
export function getMonitoringStartedAt(): number {
    const module = getDeviceActivity();
    if (Platform.OS !== 'ios' || !module) return 0;
    try {
        return module.getMonitoringStartedAt() ?? 0;
    } catch {
        return 0;
    }
}

/**
 * Force the DeviceActivityReport extension to render and write fresh usage data
 * to App Groups. Call this before reading today/weekly data to ensure it's current.
 * Waits ~3s internally for the extension to finish writing. (iOS only)
 */
export async function triggerReportUpdate(): Promise<boolean> {
    const module = getDeviceActivity();
    if (Platform.OS !== 'ios' || !module) return false;
    try {
        return await module.triggerReportUpdate();
    } catch (e) {
        console.warn('triggerReportUpdate error:', e);
        return false;
    }
}

// ============= Cross-Platform Functions =============

/**
 * Check if screen time tracking is available on this device
 */
export function isScreenTimeAvailable(): boolean {
    if (Platform.OS === 'ios') {
        return hasNativeDeviceActivityModule();
    }
    if (Platform.OS === 'android') {
        return hasNativeDeviceActivityModule();
    }
    return false;
}

/**
 * Request screen time permission (cross-platform)
 */
export async function requestScreenTimePermission(): Promise<boolean> {
    if (Platform.OS === 'ios') {
        return requestAuthorization();
    }
    if (Platform.OS === 'android') {
        return requestUsagePermission();
    }
    return false;
}

/**
 * Check if screen time permission is granted (cross-platform)
 */
export async function hasScreenTimePermission(): Promise<boolean> {
    if (Platform.OS === 'ios') {
        // Prefer explicit status when available, then fallback to boolean check.
        const status = getAuthorizationStatus();
        if (status === 'approved') return true;
        if (status === 'denied') return false;
        return isAuthorized();
    }
    if (Platform.OS === 'android') {
        return hasUsagePermission();
    }
    return false;
}

/**
 * Get today's total screen time in seconds (cross-platform)
 */
export async function getTodayScreenTime(): Promise<number> {
    if (Platform.OS === 'ios') {
        const summary = await getTodayUsageSummary();
        return summary?.totalScreenTimeSeconds || 0;
    }
    if (Platform.OS === 'android') {
        const now = Date.now();
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const stats = getUsageStats(startOfDay.getTime(), now);
        return stats.reduce((total, app) => total + Math.floor(app.totalTimeInForeground / 1000), 0);
    }
    return 0;
}

/**
 * Get weekly screen time data (cross-platform)
 * Returns array of daily totals in seconds for the past 7 days
 */
export async function getWeeklyScreenTime(): Promise<{ date: string; seconds: number }[]> {
    const result: { date: string; seconds: number }[] = [];

    if (Platform.OS === 'ios') {
        const stats = await getWeeklyStats();
        if (!Array.isArray(stats)) {
            console.error('getWeeklyStats returned non-array:', stats);
            return [];
        }
        return stats
            .filter(s => s !== null && s !== undefined && typeof s === 'object')
            .map(s => ({
                date: s.date || new Date().toISOString().split('T')[0],
                seconds: s.totalScreenTimeSeconds || 0
            }));
    }

    if (Platform.OS === 'android') {
        const now = Date.now();
        for (let i = 6; i >= 0; i--) {
            const date = new Date(now - i * 24 * 60 * 60 * 1000);
            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);

            const stats = getUsageStats(startOfDay.getTime(), endOfDay.getTime());
            const totalSeconds = stats.reduce((total, app) =>
                total + Math.floor(app.totalTimeInForeground / 1000), 0
            );

            result.push({
                date: date.toISOString().split('T')[0],
                seconds: totalSeconds
            });
        }
    }

    return result;
}
