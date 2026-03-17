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
 * Tab configuration — re-exported from config/navigation.ts (single source of truth).
 */
import { APP_TAB_ROUTES } from '../config/navigation';
export { APP_TAB_ROUTES as TABS };
export type { AppTabKey } from '../config/navigation';
export type TabConfig = (typeof APP_TAB_ROUTES)[number];
