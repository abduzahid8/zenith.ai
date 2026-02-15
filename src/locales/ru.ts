/**
 * Russian locale — all UI strings in one place.
 * This is the foundation for future i18n support.
 * To add a new language, duplicate this file as e.g. en.ts and translate all values.
 */

const ru = {
    // Common
    common: {
        loading: 'Загрузка...',
        cancel: 'Отмена',
        confirm: 'Подтвердить',
        save: 'Сохранить',
        back: 'Назад',
        continue: 'Продолжить',
        start: 'Начать',
        error: 'Ошибка',
        retry: 'Повторить',
    },

    // Auth
    auth: {
        login: 'Войти',
        register: 'Зарегистрироваться',
        email: 'Email',
        password: 'Пароль',
        forgotPassword: 'Забыли пароль?',
        noAccount: 'Нет аккаунта?',
        hasAccount: 'Уже есть аккаунт?',
        invalidCredentials: 'Неверный email или пароль.',
        emailNotConfirmed: 'Email не подтвержден. Проверьте почту.',
        continueWithApple: 'Войти через Apple',
        continueWithGoogle: 'Войти через Google',
        or: 'или',
    },

    // Welcome
    welcome: {
        title: 'Добро пожаловать !',
        subtitle: 'Достигни своего\nзенита',
        start: 'Начать',
    },

    // Quiz Intro
    quizIntro: {
        title: 'Найди своё дело',
        subtitle: 'Ответь на несколько вопросов\nи мы подберём занятие, которое\nподойдёт именно тебе.',
        start: 'Приступим',
    },

    // Quiz
    quiz: {
        next: 'Далее',
        finish: 'Завершить',
    },

    // Hobby Selection
    hobbySelection: {
        title: 'Выбери хобби',
        subtitle: 'Мы подобрали для тебя несколько вариантов',
        confirm: 'Подтвердить выбор',
    },

    // Subscription
    subscription: {
        title: 'Выбери формат, который подходит тебе',
        free: 'Free',
        premium: 'Premium',
        perMonth: '/месяц',
        getPremium: 'Оформить Premium',
        continueFree: 'Продолжить с Free',
        freeFeatures: [
            'Подбор хобби по характеру (анкета + AI)',
            'Выбор 1 хобби',
            'Ежедневная цель по хобби',
            'Трекер экранного времени (базовый)',
            'Прогресс в процентах',
            'AI-наставник — 2 диалога в день',
        ],
        premiumFeatures: [
            'Всё из Free',
            'Глубокий AI-наставник (без ограничений)',
            'Персональный план развития',
            'План на неделю',
            'Анализ прогресса и объяснения',
            'Объяснение прогресса',
            'Недельный AI-отчёт',
        ],
    },

    // Home
    home: {
        greeting: {
            morning: 'Доброе утро',
            afternoon: 'Добрый день',
            evening: 'Добрый вечер',
            night: 'Доброй ночи',
        },
        screenTime: 'Экранное время',
        dailyTasks: 'Ежедневные задания',
        startSession: 'Начать сессию',
    },

    // Session Timer
    sessionTimer: {
        start: 'Старт',
        pause: 'Пауза',
        resume: 'Продолжить',
        stop: 'Стоп',
        reset: 'Сброс',
        sessionComplete: 'Сессия завершена!',
    },

    // Statistics
    statistics: {
        title: 'Статистика',
        screenTime: 'Экранное время',
        hobbyTime: 'Время на хобби',
        weeklyOverview: 'Обзор за неделю',
    },

    // AI Coach
    aiCoach: {
        title: 'AI-наставник',
        placeholder: 'Задай вопрос...',
    },

    // Weekly Plan
    weeklyPlan: {
        title: 'План на неделю',
    },

    // Phone Analysis
    phoneAnalysis: {
        title: 'Data Analysis',
        appUsage: 'App Usage (Last 24h)',
        smsAnalysis: 'Recent SMS Analysis',
        enableUsage: 'Enable Usage Access',
        grantSms: 'Grant SMS Permission',
        refreshData: 'Refresh Data',
        noUsageData: 'No usage data available (or refresh needed)',
        noSms: 'No SMS found',
        checkScreenTime: 'Check Screen Time',
        iosPrivacy: "Due to Apple's privacy policy, we need you to check your data in Settings.",
        openSettings: 'Open Settings',
        alreadyHaveData: 'I already have the data',
        enterYourData: 'Enter Your Data',
        totalScreenTime: 'Total Screen Time (Today)',
        mostUsedApp: 'Most Used App',
        saveData: 'Save Data',
    },

    // Warning Modal
    warningModal: {
        confirm: 'Подтвердить',
        cancel: 'Отмена',
    },

    // Error Boundary
    errorBoundary: {
        title: 'Что-то пошло не так',
        message: 'В приложении произошла ошибка.',
        retry: 'Попробовать ещё',
    },
} as const;

export default ru;
export type LocaleStrings = typeof ru;
