/**
 * Type declarations for the device-activity native module.
 * Eliminates all @ts-ignore directives when importing from this module.
 */
declare module 'device-activity' {
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

    export type AuthorizationStatus = 'authorized' | 'denied' | 'notDetermined';

    // Android
    export function getUsageStats(startTime: number, endTime: number): UsageStats[];
    export function requestUsagePermission(): Promise<boolean>;
    export function hasUsagePermission(): Promise<boolean>;

    // iOS
    export function getAuthorizationStatus(): AuthorizationStatus;
    export function requestAuthorization(): Promise<boolean>;
    export function isAuthorized(): boolean;
    export function getTodayUsageSummary(): Promise<DailyUsageSummary | null>;
    export function getUsageForDateRange(startTimestamp: number, endTimestamp: number): Promise<DailyUsageSummary[]>;
    export function getTopApps(limit?: number): Promise<AppUsageData[]>;
    export function setCategoryLimit(category: string, limitSeconds: number): Promise<boolean>;
    export function clearAllLimits(): Promise<boolean>;
    export function getWeeklyStats(): Promise<DailyUsageSummary[]>;

    // Cross-platform
    export function isScreenTimeAvailable(): boolean;
    export function requestScreenTimePermission(): Promise<boolean>;
    export function hasScreenTimePermission(): Promise<boolean>;
    export function getTodayScreenTime(): Promise<number>;
    export function getWeeklyScreenTime(): Promise<{ date: string; seconds: number }[]>;
}

/**
 * Type declarations for the sms-reader native module.
 */
declare module 'sms-reader' {
    export interface SmsMessage {
        address: string;
        body: string;
        date: number;
    }

    export function requestSmsPermission(): Promise<boolean>;
    export function getAllSms(limit?: number): Promise<SmsMessage[]>;
}
