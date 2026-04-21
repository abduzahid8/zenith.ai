/**
 * Shared constants and utilities used across the app.
 * Centralizes FIGMA_WIDTH, scale(), TABS config, and common icon helpers.
 */
import { Dimensions, Platform } from 'react-native';

// Figma design reference width
export const FIGMA_WIDTH = 402;

// Screen dimensions (cached at module load)
export const SCREEN_WIDTH = Dimensions.get('window').width;
export const SCREEN_HEIGHT = Dimensions.get('window').height;

// Detect if device is a tablet
export const IS_TABLET = Platform.OS === 'ios' 
    ? SCREEN_WIDTH >= 768 
    : SCREEN_WIDTH >= 600;

// Maximum content width for tablets
export const MAX_CONTENT_WIDTH = 620;

// Side padding for tablets to center content
export const TABLET_SIDE_PADDING = IS_TABLET 
    ? (SCREEN_WIDTH - MAX_CONTENT_WIDTH) / 2 
    : 0;

/**
 * Scale a pixel value from the 402px Figma artboard to the device's actual width.
 * Capped at 1.35x for tablets to prevent oversized UI elements.
 */
export const scale = (size: number): number => {
    const scaleFactor = SCREEN_WIDTH / FIGMA_WIDTH;
    const cappedScale = IS_TABLET ? Math.min(scaleFactor, 1.35) : scaleFactor;
    return cappedScale * size;
};

export const PRIVACY_POLICY_URL = 'https://zenyth-ai-privacy.vercel.app/';
export const TERMS_OF_USE_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

/**
 * Tab configuration — re-exported from config/navigation.ts (single source of truth).
 */
import { APP_TAB_ROUTES } from '../config/navigation';
export { APP_TAB_ROUTES as TABS };
export type { AppTabKey } from '../config/navigation';
export type TabConfig = (typeof APP_TAB_ROUTES)[number];
