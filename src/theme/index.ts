/**
 * zenyth.ai Design System
 * Based on Figma design analysis
 */

export const lightColors = {
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
        lightBg: '#EAF0F8',
    },
    errorBoundary: {
        background: '#EAF0F8',
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
        premiumAccent: '#43C2F8',
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
        cardBg: '#EAF0F8',
        secondaryBg: '#EAF0F8',
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

    // Gamification — шахматные тесты и геймификация (Frames 650-660)
    gamification: {
        // Карточка теории (Frame 651)
        theoryCard: '#D6EEFF',          // Голубой фон карточки теории
        theoryCardBorder: '#B8D8F0',    // Граница карточки
        termChip: '#C5DCEF',            // Фон капсулы термина
        termChipText: '#08132A',        // Текст капсулы термина
        zenythIcon: '#5BA3E6',          // Цвет иконки Zenyth.AI (звезда)

        // Тест: варианты ABCD (Frame 652/655/656)
        optionDefault: '#DDE8F4',       // Фон варианта по умолчанию (светло-голубой)
        optionDefaultText: '#08132A',   // Текст варианта по умолчанию
        optionCorrect: '#4ADE80',       // Зелёный при правильном ответе
        optionCorrectText: '#065F46',   // Текст на зелёном фоне
        optionIncorrect: '#F87171',     // Красный при неверном ответе
        optionIncorrectText: '#FFFFFF', // Текст на красном фоне

        // Тест: вставка слов (Frame 653/657/658)
        blankSlot: '#E2E8F0',           // Пустой пропуск в тексте
        blankSlotBorder: '#94A3B8',     // Рамка пропуска
        wordChip: '#DDE8F4',            // Слово-чип в пуле
        wordChipText: '#08132A',        // Текст слова-чипа
        wordChipFilled: '#4ADE80',      // Верно вставленное слово (зелёное)
        wordChipFilledText: '#065F46',  // Текст верного слова
        wordChipWrong: '#F87171',       // Неверно вставленное слово (красное)
        wordChipWrongText: '#FFFFFF',   // Текст неверного слова

        // Тест: свободный ответ (Frame 654/659/660)
        freeTextBg: '#F5F7FA',          // Фон поля ввода по умолчанию
        freeTextBorder: '#CBD5E1',      // Рамка поля ввода
        freeTextCorrect: '#4ADE80',     // Зелёный фон при верном ответе
        freeTextCorrectBorder: '#22C55E',
        freeTextIncorrect: '#F87171',   // Красный фон при неверном ответе
        freeTextIncorrectBorder: '#EF4444',

        // Баннер подбадривания
        encourageCorrectBg: '#D1FAE5',  // Светло-зелёный
        encourageCorrectText: '#065F46',
        encourageIncorrectBg: '#FFF3E0', // Тёплый оранжевый
        encourageIncorrectText: '#92400E',

        // Шахматная доска (Frame 650)
        boardLight: '#D6EEFF',          // Светлые клетки (фирменный голубой)
        boardDark: '#5BA3E6',           // Тёмные клетки (синий)
        boardSelected: '#FFE082',       // Выбранная клетка (золотая)
        boardIncorrect: '#FFCDD2',      // Неверный ход (розоватый)
        boardCorrect: '#C8E6C9',        // Верный ход (светло-зелёный)
        boardHint: '#FFF9C4',           // Подсказка (светло-жёлтый)
        boardBorder: 'transparent',     // Без жёсткой рамки

        // Прогресс-бар тестов
        progressActive: '#5BA3E6',      // Активная точка прогресса
        progressDone: '#4ADE80',        // Завершённая точка
        progressFailed: '#F87171',      // Неверно отвеченная точка
        progressInactive: '#DDE8F4',    // Неактивная точка

        // Кнопки внутри тестов
        buttonConfirm: '#102852',       // «Подтвердить» / «Далее» (тёмно-синий)
        buttonConfirmText: '#FFFFFF',
        buttonConfirmDisabled: '#CBD5E1',
        buttonConfirmDisabledText: '#94A3B8',
    },
};

export type Colors = typeof lightColors;

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

export const getTypography = (currentColors: Colors) => ({
    // Welcome Screen
    welcomeTitle: {
        fontFamily: fonts.heading.bold,
        fontSize: 28,
        lineHeight: 38,
        color: currentColors.text,
    },
    welcomeSubtitle: {
        fontFamily: fonts.body.light,
        fontSize: 20,
        lineHeight: 25,
        color: currentColors.text,
    },

    // Buttons
    buttonText: {
        fontFamily: fonts.heading.bold,
        fontSize: 20,
        lineHeight: 28,
        color: currentColors.text,
    },
    buttonTextSmall: {
        fontFamily: fonts.heading.medium,
        fontSize: 16,
        lineHeight: 22,
        color: currentColors.text,
    },

    // Quiz
    quizQuestion: {
        fontFamily: fonts.heading.bold,
        fontSize: 24,
        lineHeight: 32,
        color: currentColors.text,
    },
    quizOption: {
        fontFamily: fonts.body.regular,
        fontSize: 16,
        lineHeight: 22,
        color: currentColors.text,
    },

    // Labels
    label: {
        fontFamily: fonts.body.regular,
        fontSize: 14,
        lineHeight: 20,
        color: currentColors.textSecondary,
    },

    // Headings
    h1: {
        fontFamily: fonts.heading.bold,
        fontSize: 28,
        lineHeight: 38,
        color: currentColors.text,
    },
    h2: {
        fontFamily: fonts.heading.bold,
        fontSize: 22,
        lineHeight: 30,
        color: currentColors.text,
    },
    h3: {
        fontFamily: fonts.heading.medium,
        fontSize: 18,
        lineHeight: 26,
        color: currentColors.text,
    },

    // Body text
    body: {
        fontFamily: fonts.body.regular,
        fontSize: 16,
        lineHeight: 24,
        color: currentColors.text,
    },
    bodySmall: {
        fontFamily: fonts.body.regular,
        fontSize: 14,
        lineHeight: 20,
        color: currentColors.textSecondary,
    },
} as const);

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
    lightColors,
    fonts,
    getTypography,
    spacing,
    borderRadius,
    screen,
};
