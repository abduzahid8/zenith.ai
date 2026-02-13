/**
 * Shared constants and utilities used across the app.
 * Centralizes FIGMA_WIDTH, scale(), TABS config, and common icon helpers.
 */
import { Dimensions } from 'react-native';

// Figma design reference width
export const FIGMA_WIDTH = 402;

// Screen width (cached at module load)
export const SCREEN_WIDTH = Dimensions.get('window').width;

/**
 * Scale a pixel value from the 402px Figma artboard to the device's actual width.
 */
export const scale = (size: number): number =>
    (SCREEN_WIDTH / FIGMA_WIDTH) * size;

/**
 * Tab configuration used by MainTabsScreen and SessionTimerScreen bottom nav.
 */
export const TABS = [
    { key: 'home', icon: 'home', iconOutline: 'home-outline', type: 'ionicon' as const },
    { key: 'weekly-plan', icon: 'clipboard-text', iconOutline: 'clipboard-text-outline', type: 'material' as const },
    { key: 'ai-coach', icon: 'lightbulb', iconOutline: 'lightbulb-outline', type: 'material' as const },
    { key: 'statistics', icon: 'bar-chart', iconOutline: 'bar-chart-outline', type: 'ionicon' as const },
] as const;

export type TabConfig = typeof TABS[number];
