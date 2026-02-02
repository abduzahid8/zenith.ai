import { requireNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

// It loads the native module object from the JSI or falls back to
// the bridge module (from NativeModulesProxy) if the remote debugger is on.
const DeviceActivity = Platform.OS === 'android' ? requireNativeModule('DeviceActivity') : null;

export interface UsageStats {
    packageName: string;
    totalTimeInForeground: number;
    lastTimeUsed: number;
}

export function getUsageStats(startTime: number, endTime: number): UsageStats[] {
    if (!DeviceActivity) return [];
    return DeviceActivity.getUsageStats(startTime, endTime);
}

export function requestUsagePermission(): Promise<boolean> {
    if (!DeviceActivity) return Promise.resolve(false);
    return DeviceActivity.requestUsagePermission();
}

export function hasUsagePermission(): Promise<boolean> {
    if (!DeviceActivity) return Promise.resolve(false);
    return DeviceActivity.hasUsagePermission();
}
