import { Dimensions, PixelRatio } from 'react-native';

// Base design dimensions from Figma
const BASE_WIDTH = 402;
const BASE_HEIGHT = 874;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Scale factors
const widthScale = SCREEN_WIDTH / BASE_WIDTH;
const heightScale = SCREEN_HEIGHT / BASE_HEIGHT;

/**
 * Scale a value based on screen width
 * Use for horizontal measurements (width, marginHorizontal, paddingHorizontal)
 */
export const scaleWidth = (size: number): number => {
    return Math.round(PixelRatio.roundToNearestPixel(size * widthScale));
};

/**
 * Scale a value based on screen height
 * Use for vertical measurements (height, marginVertical, paddingVertical)
 */
export const scaleHeight = (size: number): number => {
    return Math.round(PixelRatio.roundToNearestPixel(size * heightScale));
};

/**
 * Scale font sizes based on screen width with a moderate scale factor
 * This prevents fonts from becoming too large on bigger screens
 */
export const scaleFont = (size: number): number => {
    const scale = Math.min(widthScale, heightScale);
    const newSize = size * scale;
    return Math.round(PixelRatio.roundToNearestPixel(newSize));
};

/**
 * Scale based on the smaller dimension for consistent sizing
 */
export const scale = (size: number): number => {
    const minScale = Math.min(widthScale, heightScale);
    return Math.round(PixelRatio.roundToNearestPixel(size * minScale));
};

/**
 * Moderate scale - uses average of width and height scales
 * Good for elements that should scale proportionally but not too aggressively
 */
export const moderateScale = (size: number, factor: number = 0.5): number => {
    return size + (scale(size) - size) * factor;
};

export const responsive = {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    isSmallDevice: SCREEN_WIDTH < 375,
    isMediumDevice: SCREEN_WIDTH >= 375 && SCREEN_WIDTH < 414,
    isLargeDevice: SCREEN_WIDTH >= 414,
    scaleWidth,
    scaleHeight,
    scaleFont,
    scale,
    moderateScale,
};

export default responsive;
