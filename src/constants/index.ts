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

// iPad detection
export const IS_IPAD = Platform.OS === 'ios' && Platform.isPad;
export const IS_TABLET = IS_IPAD || SCREEN_WIDTH >= 768;

// Responsive breakpoints
export const TABLET_BREAKPOINT = 768;
export const DESKTOP_BREAKPOINT = 1024;

/**
 * On tablet the raw scale factor (SCREEN_WIDTH / 402) is ~1.9–2.5×, which
 * makes every element grotesquely large.  We cap it at 1.35 so the UI stays
 * proportional while still being comfortably larger than on a phone.
 */
const RAW_SCALE = SCREEN_WIDTH / FIGMA_WIDTH;
const SCALE_FACTOR = IS_TABLET ? Math.min(RAW_SCALE, 1.35) : RAW_SCALE;

/**
 * Scale a pixel value from the 402px Figma artboard to the device's actual width.
 */
export const scale = (size: number): number => Math.round(size * SCALE_FACTOR);

/**
 * Maximum content width for tablet – keeps text columns readable and
 * centres them horizontally on large screens.
 */
export const MAX_CONTENT_WIDTH = IS_TABLET ? 620 : SCREEN_WIDTH;

/**
 * Horizontal padding that, on tablet, centres a MAX_CONTENT_WIDTH column.
 * On phone it is 0 because each screen handles its own horizontal padding.
 */
export const TABLET_SIDE_PADDING = IS_TABLET
    ? Math.max((SCREEN_WIDTH - MAX_CONTENT_WIDTH) / 2, 0)
    : 0;

/**
 * Tab configuration — re-exported from config/navigation.ts (single source of truth).
 */
import { APP_TAB_ROUTES } from '../config/navigation';
export { APP_TAB_ROUTES as TABS };
export type { AppTabKey } from '../config/navigation';
export type TabConfig = (typeof APP_TAB_ROUTES)[number];
