/**
 * zenyth.ai Design System
 * Based on Figma design analysis
 */

export const colors = {
    // Primary gradient colors
    primary: '#1AFFD5',
    primaryGradient: {
        start: '#1AFFD5',
        middle: '#08CDC5',
        end: '#00B7BF',
    },

    // Buttons
    buttonPrimary: '#102852',
    buttonTextPrimary: '#FFFFFF',

    // Logo/Brand colors
    dark: '#15211F',

    // Backgrounds
    background: '#EAF0F8',
    surface: '#D9D9D9',
    surfaceLight: '#F5F5F5',

    // Text
    text: '#08132A', // Updated color
    textSecondary: '#666666',
    textLight: '#999999',

    // Status colors
    success: '#34C759',
    warning: '#FF9500',
    error: '#FF3B30',

    // Screen time colors
    decrease: '#34C759',  // Green for reduced screen time
    increase: '#FF3B30',  // Red for increased screen time

    // Component palette tokens (replaces hardcoded hex in individual screens)
    sessionTimer: {
        primary: '#37A0EF',
        primaryFaded: '#D6EBFD',
        background: '#EAF0F8',
        text: '#2E2E43',
        textDark: '#08132A',
        muted: '#B0B0B0',
        pausedPrimary: '#DA37EF',
        button: '#102852',
        buttonText: '#FFFFFF',
        dotActive: '#2E2E43',
        // Summary ring
        ringTrackA: '#B3C6F2',
        ringTrackB: '#B0D5F3',
        ringStrokeA: '#3975E5',
        ringStrokeB: '#43C2F8',
        // Stop modal
        stopRed: '#FF4B55',
        modalSurface: '#F5F5F5',
        modalBorder: '#C4C4C4',
        checkboxOff: '#E5E5EA',
        labelMuted: '#8E8E93',
        // Chat
        chatInput: '#E2E8F0',
        chatUser: '#102852',
        chatAssistant: '#FFFFFF',
        chatUserText: '#FFFFFF',
        chatAssistantText: '#1E1E2E',
        chatPlaceholder: '#A3A3A3',
        // Task drawer
        drawerBg: '#102852',
        drawerText: '#EAF0F8',
        taskBg: '#1E293B',
        taskDone: '#4ADE80',
        taskCheckbox: '#E2E8F0',
        taskMuted: '#94A3B8',
    },
    statistics: {
        screenTimeCard: '#8CDEFF',
        screenTimeCardDark: '#78BAFF',
        hobbyCardLight: '#F4C0FD',
        hobbyCardDark: '#E2D6F8',
        muted: '#C0C0C0',
        darkText: '#2E2E43',
    },
    aiCoach: {
        bubble: '#D6DEF8',
        bubbleFaded: 'rgba(214, 222, 248, 0.20)',
        text: '#4E4E4E',
        darkText: '#2E2E43',
    },
    home: {
        cardBorder: '#DCDCDC',
        darkText: '#1E1E2E',
        lightBg: '#F5F5F5',
    },
    errorBoundary: {
        background: '#F2F6FC',
        primary: '#37A0EF',
        text: '#2E2E43',
        muted: '#666',
        mutedLight: '#999',
    },

    // Global utility tokens
    link: '#007AFF',
    accent: '#00FFC2',
    border: '#C8C8C8',
    textMuted: '#444444',
    iconMuted: '#A0A0A0',
    black: '#000000',
    white: '#FFFFFF',
    darkSurface: '#1a1a2e',
    shadow: '#000000',

    // Bottom navigation / floating nav
    nav: {
        inactive: '#A3A3A3',
        active: '#000000',
        floatingBg: 'rgba(255, 255, 255, 0.95)',
        floatingBorder: 'rgba(0,0,0,0.05)',
    },

    // Weekly plan
    weeklyPlan: {
        theoryBg: '#8CDEFF',
        practiceBg: '#78BAFF',
        analysisBg: '#F4C0FD',
        tasksBg: '#F9A9FD',
        addTaskBg: '#D3DEEE',
        iconBg: '#08132A',
    },

    // Subscription
    subscription: {
        freeCardBg: '#C4DCFB',
        premiumAccent: '#00FFC2',
        confirmBg: '#E8E4DF',
    },

    // Hobby selection
    hobbySelection: {
        unselectedBg: '#C8D0DC',
        selectedBorderBg: '#DAE7F8',
        selectedBg: '#37A0EF',
    },

    // Phone analysis
    phoneAnalysis: {
        cardBg: '#f9f9f9',
        secondaryBg: '#f5f5f5',
        highlightBg: '#EAF4FF',
        actionBg: '#007AFF',
    },

    // Auth
    auth: {
        divider: '#C8C8C8',
        dividerText: '#999999',
        socialBorder: '#C8C8C8',
    },

    // Quiz
    quiz: {
        cardBg: '#F5F5F5',
        backButtonBg: '#F5F5F5',
    },

    // Warning modal
    warningModal: {
        surface: '#FFFFFF',
        shadow: '#000000',
        confirmDefault: '#E8E4DF',
    },
} as const;

export const fonts = {
    // Gramatika - Headings
    heading: {
        black: 'Gramatika-Black',
        bold: 'Gramatika-Bold',
        medium: 'Gramatika-Medium',
        regular: 'Gramatika-Regular',
        light: 'Gramatika-Light',
        extraLight: 'Gramatika-ExtraLight',
    },
    // Geometria - Body
    body: {
        regular: 'Geometria-Light', // Using Light as regular fallback
        light: 'Geometria-Light',
        medium: 'Geometria-Medium',
        extraLight: 'Geometria-Light',
    },
    // System font for status bar
    system: 'System',
} as const;

export const typography = {
    // Welcome Screen
    welcomeTitle: {
        fontFamily: fonts.heading.bold,
        fontSize: 28,
        lineHeight: 38,
        color: colors.text,
    },
    welcomeSubtitle: {
        fontFamily: fonts.body.light,
        fontSize: 20,
        lineHeight: 25,
        color: colors.text,
    },

    // Buttons
    buttonText: {
        fontFamily: fonts.heading.bold,
        fontSize: 20,
        lineHeight: 28,
        color: colors.text,
    },
    buttonTextSmall: {
        fontFamily: fonts.heading.medium,
        fontSize: 16,
        lineHeight: 22,
        color: colors.text,
    },

    // Quiz
    quizQuestion: {
        fontFamily: fonts.heading.bold,
        fontSize: 24,
        lineHeight: 32,
        color: colors.text,
    },
    quizOption: {
        fontFamily: fonts.body.regular,
        fontSize: 16,
        lineHeight: 22,
        color: colors.text,
    },

    // Labels
    label: {
        fontFamily: fonts.body.regular,
        fontSize: 14,
        lineHeight: 20,
        color: colors.textSecondary,
    },

    // Headings
    h1: {
        fontFamily: fonts.heading.bold,
        fontSize: 28,
        lineHeight: 38,
        color: colors.text,
    },
    h2: {
        fontFamily: fonts.heading.bold,
        fontSize: 22,
        lineHeight: 30,
        color: colors.text,
    },
    h3: {
        fontFamily: fonts.heading.medium,
        fontSize: 18,
        lineHeight: 26,
        color: colors.text,
    },

    // Body text
    body: {
        fontFamily: fonts.body.regular,
        fontSize: 16,
        lineHeight: 24,
        color: colors.text,
    },
    bodySmall: {
        fontFamily: fonts.body.regular,
        fontSize: 14,
        lineHeight: 20,
        color: colors.textSecondary,
    },
} as const;

export const spacing = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
} as const;

export const borderRadius = {
    sm: 8,
    md: 16,
    lg: 25,
    full: 100,
} as const;

// Screen dimensions (from Figma)
export const screen = {
    width: 402,
    height: 874,
} as const;

export default {
    colors,
    fonts,
    typography,
    spacing,
    borderRadius,
    screen,
};
