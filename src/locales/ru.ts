/**
 * Default locale strings — all UI strings in English.
 * This is the foundation for future i18n support.
 * To add a new language, duplicate this file as e.g. ru.ts and translate all values.
 */

const ru = {
    // Common
    common: {
        loading: 'Loading...',
        cancel: 'Cancel',
        confirm: 'Confirm',
        save: 'Save',
        back: 'Back',
        continue: 'Continue',
        start: 'Start',
        error: 'Error',
        retry: 'Retry',
    },

    // Auth
    auth: {
        login: 'Sign In',
        register: 'Sign Up',
        email: 'Email',
        password: 'Password',
        forgotPassword: 'Forgot password?',
        noAccount: 'No account?',
        hasAccount: 'Already have an account?',
        invalidCredentials: 'Incorrect email or password.',
        emailNotConfirmed: 'Email not confirmed. Please check your inbox.',
        continueWithApple: 'Sign in with Apple',
        continueWithGoogle: 'Sign in with Google',
        or: 'or',
    },

    // Welcome
    welcome: {
        title: 'Welcome!',
        subtitle: 'Reach your\nzenyth',
        start: 'Start',
    },

    // Quiz Intro
    quizIntro: {
        title: 'Find your thing',
        subtitle: 'Answer a few questions\nand we\'ll find an activity\nthat suits you perfectly.',
        start: "Let's go",
    },

    // Quiz
    quiz: {
        next: 'Next',
        finish: 'Finish',
    },

    // Hobby Selection
    hobbySelection: {
        title: 'Choose a hobby',
        subtitle: 'We picked a few options for you',
        confirm: 'Confirm selection',
    },

    // Subscription
    subscription: {
        title: 'Choose the plan that works for you',
        free: 'Free',
        premium: 'Premium',
        perMonth: '/month',
        getPremium: 'Get Premium',
        continueFree: 'Continue with Free',
        freeFeatures: [
            'Hobby matching by personality (quiz + AI)',
            'Choose 1 hobby',
            'Daily hobby goal',
            'Progress in percentages',
            'AI Coach — 2 chats per day',
        ],
        premiumFeatures: [
            'Everything in Free',
            'Deep AI Coach (unlimited)',
            'Personalized growth plan',
            'Weekly plan',
            'Progress analysis & explanations',
            'Progress breakdown',
            'Weekly AI report',
        ],
    },

    // Home
    home: {
        greeting: {
            morning: 'Good morning',
            afternoon: 'Good afternoon',
            evening: 'Good evening',
            night: 'Good night',
        },
        screenTime: 'Screen Time',
        dailyTasks: 'Daily Tasks',
        startSession: 'Start session',
    },

    // Session Timer
    sessionTimer: {
        start: 'Start',
        pause: 'Pause',
        resume: 'Resume',
        stop: 'Stop',
        reset: 'Reset',
        sessionComplete: 'Session complete!',
    },

    // Statistics
    statistics: {
        title: 'Statistics',
        hobbyTime: 'Hobby time',
        weeklyOverview: 'Weekly overview',
    },

    // AI Coach
    aiCoach: {
        title: 'AI Coach',
        placeholder: 'Ask a question...',
    },

    // Weekly Plan
    weeklyPlan: {
        title: 'Weekly Plan',
        yourDayTitle: 'Твой день',
        theoryTitle: 'Узнай',
        practiceTitle: 'Сделай',
        analysisTitle: 'Углуби 1',
        puzzlesTitle: 'Углуби 2',
        taskTitle: 'Задача',
        noTasksTitle: 'Нет задач на сегодня',
        noTasksSubtitle: 'Добавьте первую задачу, чтобы начать свой день продуктивно.',
        addTask: '+ Добавить задачу',
        loadingPlan: 'Загружаем план...',
        errorLoading: 'Не удалось загрузить план',
        retry: 'Повторить',
    },

    // Phone Analysis
    phoneAnalysis: {
        title: 'Data Analysis',
        appUsage: 'App Usage (Last 24h)',
        smsAnalysis: 'Recent SMS Analysis',
        enableUsage: 'Enable Usage Access',
        grantSms: 'Grant SMS Permission',
        refreshData: 'Refresh Data',
        noSms: 'No SMS found',
        iosPrivacy: "Due to Apple's privacy policy, we need you to check your data in Settings.",
        openSettings: 'Open Settings',
        alreadyHaveData: 'I already have the data',
        enterYourData: 'Enter Your Data',
        mostUsedApp: 'Most Used App',
        saveData: 'Save Data',
    },

    // Warning Modal
    warningModal: {
        confirm: 'Confirm',
        cancel: 'Cancel',
    },

    // Error Boundary
    errorBoundary: {
        title: 'Something went wrong',
        message: 'An error occurred in the app.',
        retry: 'Try again',
    },
} as const;

export default ru;
export type LocaleStrings = typeof ru;
