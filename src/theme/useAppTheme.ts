import { lightColors, fonts, getTypography, spacing, borderRadius, screen } from './index';

/**
 * A hook that returns the app theme (colors, typography, etc.)
 * Now only supports light mode.
 */
export const useAppTheme = () => {
    return {
        colors: lightColors,
        isDark: false,
        themeMode: 'light' as const,
        fonts,
        typography: getTypography(lightColors),
        spacing,
        borderRadius,
        screen,
    };
};

export default useAppTheme;
