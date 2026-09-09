/**
 * Onboarding 2.0 domain: user objectives + experience preference.
 * Pure constants + validation. No React / storage dependencies so this
 * module is trivially unit-testable.
 */

export const GOAL_IDS = [
    'learn_skills',
    'grow_professionally',
    'discover_hobbies',
    'become_creative',
    'improve_focus',
    'build_habits',
    'prepare_career',
    'less_scrolling',
    'explore_interests',
] as const;

export type UserGoalId = (typeof GOAL_IDS)[number];

export interface GoalOption {
    id: UserGoalId;
    /** English source string — wrapped in t() at render time for i18n. */
    label: string;
}

export const GOAL_OPTIONS: readonly GoalOption[] = [
    { id: 'learn_skills', label: 'Learn useful skills' },
    { id: 'grow_professionally', label: 'Grow professionally' },
    { id: 'discover_hobbies', label: 'Discover new hobbies' },
    { id: 'become_creative', label: 'Become more creative' },
    { id: 'improve_focus', label: 'Improve focus' },
    { id: 'build_habits', label: 'Build better habits' },
    { id: 'prepare_career', label: 'Prepare for my career' },
    { id: 'less_scrolling', label: 'Spend less time scrolling' },
    { id: 'explore_interests', label: 'Explore new interests' },
];

/** Max selectable objectives — keeps the step fast, avoids "select all" noise. */
export const MAX_GOALS = 5;

export const EXPERIENCE_IDS = ['from_zero', 'some_basics', 'intermediate', 'depends'] as const;

export type ExperiencePreference = (typeof EXPERIENCE_IDS)[number];

export interface ExperienceOption {
    id: ExperiencePreference;
    label: string;
    hint: string;
}

export const EXPERIENCE_OPTIONS: readonly ExperienceOption[] = [
    { id: 'from_zero', label: 'I usually start from zero', hint: 'Step-by-step from the basics' },
    { id: 'some_basics', label: 'I know some basics', hint: 'Quick refresh, then forward' },
    { id: 'intermediate', label: 'I often learn at an intermediate level', hint: 'Less theory, more practice' },
    { id: 'depends', label: 'It depends on the topic', hint: 'Ask me per skill' },
];

export function isValidGoalId(id: string): id is UserGoalId {
    return (GOAL_IDS as readonly string[]).includes(id);
}

export function isValidExperiencePreference(id: string): id is ExperiencePreference {
    return (EXPERIENCE_IDS as readonly string[]).includes(id);
}

/**
 * Validate + normalize raw goal selections before storage.
 * AI or UI must never write arbitrary values into the persistent profile.
 */
export function normalizeGoals(raw: unknown): UserGoalId[] {
    if (!Array.isArray(raw)) return [];
    const seen = new Set<UserGoalId>();
    for (const item of raw) {
        if (typeof item === 'string' && isValidGoalId(item) && !seen.has(item)) {
            seen.add(item);
            if (seen.size >= MAX_GOALS) break;
        }
    }
    return [...seen];
}

export function normalizeExperiencePreference(raw: unknown): ExperiencePreference | null {
    if (typeof raw === 'string' && isValidExperiencePreference(raw)) return raw;
    return null;
}

/**
 * Lightweight goal → hobby affinity used to bias (not decide) recommendations.
 * Deterministic, additive, small magnitude so quiz answers stay primary.
 */
const GOAL_HOBBY_AFFINITY: Record<UserGoalId, Record<string, number>> = {
    learn_skills: { python: 2, english: 2, chinese: 1, chess: 1, reading: 1 },
    grow_professionally: { python: 3, english: 2, chess: 1 },
    discover_hobbies: { reading: 2, chess: 2, chinese: 1, python: 1, english: 1 },
    become_creative: { reading: 2, chinese: 1, english: 1 },
    improve_focus: { chess: 3, reading: 1, python: 1 },
    build_habits: { reading: 2, chess: 1, english: 1 },
    prepare_career: { python: 3, english: 2 },
    less_scrolling: { chess: 2, reading: 2, python: 1 },
    explore_interests: { reading: 2, chinese: 2, english: 1, chess: 1, python: 1 },
};

/** Total affinity bonus per hobby for a set of goals (percent points, capped). */
export function goalAffinityBonus(goals: readonly UserGoalId[], hobbyId: string): number {
    let total = 0;
    for (const goal of goals) {
        total += GOAL_HOBBY_AFFINITY[goal]?.[hobbyId] ?? 0;
    }
    return Math.min(total, 8);
}
