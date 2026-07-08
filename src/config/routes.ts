/**
 * Typed route constants — single source of truth for all app routes.
 * Use these instead of raw strings to catch broken routes at compile time.
 */

export const ROUTES = {
    // Auth group
    AUTH: '/(auth)/',
    LOGIN: '/(auth)/login',
    REGISTER: '/(auth)/register',

    // App group
    APP: '/(app)/',

    // Onboarding flow
    QUIZ_INTRO: '/quiz-intro',
    QUIZ: '/quiz',
    HOBBY_SELECTION: '/hobby-selection',
    GOAL_SETUP: '/goal-setup',
    SUBSCRIPTION: '/subscription',

    // Standalone screens
    SESSION_TIMER: '/session-timer',
    PHONE_ANALYSIS: '/phone-analysis',
    MANAGE_SUBSCRIPTION: '/manage-subscription',
    GOAL_DETAIL: '/goal-detail',
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];
