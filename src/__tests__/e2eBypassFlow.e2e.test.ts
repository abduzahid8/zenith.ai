/**
 * E2E by the bypass path — covers everything EXCEPT login and quiz.
 *
 * Simulates a dev bundle with EXPO_PUBLIC_E2E_BYPASS_AUTH=1:
 *  1. authStore.initialize() signs in the mock user (no network)
 *  2. taskStore.fetchDailyPlan() seeds demo tasks from the real engine
 *  3. task completion works fully offline on demo ids
 *  4. new-feature flow: goals → minutes → experience → recommendation
 *     → Quick Session, driven by the SEEDED store tasks (quiz answers
 *     are pre-seeded as given input, not exercised here)
 */
import { useAuthStore } from '../store/authStore';
import { useTaskStore } from '../store/taskStore';
import { useUserProfileStore } from '../store/userProfileStore';
import { useQuizStore } from '../store/quizStore';
import { useUserGoalsStore } from '../store/userGoalsStore';
import { matchHobbies } from '../services/hobbyMatcher';
import { buildSessionBlueprint, parseSessionParams } from '../domain/sessions/sessionBlueprint';
import { findNextIncompleteTask } from '../domain/sessions/sessionCompletion';
import type { Task } from '../services/supabase/types';
import { isE2EBypassEnabled, E2E_MOCK_USER_ID } from '../utils/e2eBypass';
import { getAutoTasksPerDay } from '../domain/tasks/rules';

// ─── Mocks: simulate "no network" + skip native-only modules ───
// The real taskStore/taskEngine/stores under test stay real; only the
// server boundary (taskService) rejects like an offline device, and the
// sibling stores + expo ESM modules (untransformable in jest, same reason
// authStore.test.ts can't load) are stubbed — none are on the paths tested.
jest.mock('../services/taskService', () => ({
    taskService: {
        getDailyPlan: () => Promise.reject(new Error('offline')),
        createManualTask: () => Promise.reject(new Error('offline')),
        completeTask: () => Promise.reject(new Error('offline')),
        uncompleteTask: () => Promise.reject(new Error('offline')),
        skipTask: () => Promise.reject(new Error('offline')),
    },
}));

jest.mock('../store/hobbyTimeStore', () => ({
    useHobbyTimeStore: { getState: () => ({ reset: jest.fn() }) },
}));
jest.mock('../store/screenTimeStore', () => ({
    useScreenTimeStore: { getState: () => ({ reset: jest.fn() }) },
}));
jest.mock('../store/earningsStore', () => ({
    useEarningsStore: { getState: () => ({ reset: jest.fn() }) },
}));
jest.mock('../store/contentStore', () => ({
    useContentStore: { getState: () => ({ reset: jest.fn() }) },
}));
jest.mock('../store/deviceScreenTimeStore', () => ({
    useDeviceScreenTimeStore: { getState: () => ({ reset: jest.fn() }) },
}));
jest.mock('../store/subscriptionStore', () => ({
    useSubscriptionStore: { getState: () => ({ reset: jest.fn() }) },
}));

jest.mock('expo-auth-session', () => ({ makeRedirectUri: jest.fn(() => 'e2e://redirect') }));
jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: jest.fn() }));
jest.mock('expo-apple-authentication', () => ({}));
jest.mock('expo-crypto', () => ({ digestStringAsync: jest.fn() }));

const g = globalThis as Record<string, unknown>;
const prevDev = g.__DEV__;
const prevFlag = process.env.EXPO_PUBLIC_E2E_BYPASS_AUTH;

beforeAll(() => {
    g.__DEV__ = true;
    process.env.EXPO_PUBLIC_E2E_BYPASS_AUTH = '1';
});

afterAll(() => {
    g.__DEV__ = prevDev;
    if (prevFlag === undefined) delete process.env.EXPO_PUBLIC_E2E_BYPASS_AUTH;
    else process.env.EXPO_PUBLIC_E2E_BYPASS_AUTH = prevFlag;
    useTaskStore.getState().resetTasks();
    useUserGoalsStore.getState().resetGoals();
    useQuizStore.getState().resetQuiz();
});

describe('e2e bypass: skip login, everything else works', () => {
    it('signs in the mock user with no network', async () => {
        expect(isE2EBypassEnabled()).toBe(true);
        await useAuthStore.getState().initialize();
        const { isAuthenticated, isLoading, user } = useAuthStore.getState();
        expect(isLoading).toBe(false);
        expect(isAuthenticated).toBe(true);
        expect(user?.id).toBe(E2E_MOCK_USER_ID);
    });

    it('seeds demo tasks from the real engine for the selected hobby', async () => {
        useTaskStore.getState().resetTasks();
        useUserProfileStore.getState().setSelectedHobby('python');

        await useTaskStore.getState().fetchDailyPlan(E2E_MOCK_USER_ID);

        const { dailyTasks, error } = useTaskStore.getState();
        expect(error).toBeNull();
        expect(dailyTasks.length).toBeGreaterThanOrEqual(getAutoTasksPerDay());
        expect(dailyTasks.every((t) => t.id?.startsWith('demo-'))).toBe(true);
        expect(dailyTasks.every((t) => t.hobby_id === 'python')).toBe(true);
        expect(dailyTasks.every((t) => (t.duration_minutes ?? 0) > 0)).toBe(true);
    });

    it('completes / uncompletes / skips demo tasks fully offline', async () => {
        const { dailyTasks } = useTaskStore.getState();
        expect(dailyTasks.length).toBeGreaterThanOrEqual(2);
        const [first, second] = dailyTasks;

        await useTaskStore.getState().completeTask(E2E_MOCK_USER_ID, first.id!);
        expect(useTaskStore.getState().dailyTasks.find((t) => t.id === first.id)?.status).toBe(
            'completed',
        );

        await useTaskStore.getState().uncompleteTask(E2E_MOCK_USER_ID, first.id!);
        expect(useTaskStore.getState().dailyTasks.find((t) => t.id === first.id)?.status).toBe(
            'pending',
        );

        await useTaskStore.getState().skipTask(E2E_MOCK_USER_ID, second.id!);
        expect(useTaskStore.getState().dailyTasks.find((t) => t.id === second.id)?.status).toBe(
            'skipped',
        );
        expect(useTaskStore.getState().error).toBeNull();
    });

    it('drives goals → next task → structured session context', () => {
        // Quiz answers are taken as given input here (quiz itself out of scope).
        useQuizStore.getState().resetQuiz();
        for (let q = 1; q <= 10; q++) useQuizStore.getState().setAnswer(q, 0);

        // Onboarding 2.0 extension.
        useUserGoalsStore.getState().setGoals(['grow_professionally', 'prepare_career']);
        useUserGoalsStore.getState().setPreferredSessionMinutes(15);
        useUserGoalsStore.getState().setExperiencePreference('from_zero');
        useUserGoalsStore.getState().markExtensionCompleted();

        // Recommendation profile → suggested skill.
        const { answers } = useQuizStore.getState();
        const { goals, preferredSessionMinutes } = useUserGoalsStore.getState();
        const matches = matchHobbies(answers, 3, goals);
        expect(matches[0].hobby.id).toBe('python');

        // ONE DailyPlan: Home Start and Your Day resolve the same next task.
        const { dailyTasks } = useTaskStore.getState();
        const pending = dailyTasks.filter((t) => t.status !== 'completed' && t.status !== 'skipped');
        expect(pending.length).toBeGreaterThan(0);
        const next = findNextIncompleteTask(dailyTasks);
        expect(next).not.toBeNull();

        // Structured session context for that task at the preferred timebox.
        const minutes = preferredSessionMinutes ?? 15;
        const bp = buildSessionBlueprint({
            minutes,
            taskTitle: next!.title,
            taskType: next!.type as Task['type'],
            lessonTitle: 'L1',
        });
        expect(bp.learningObjective).toBe(next!.title);
        expect(bp.countsAsFullCompletion).toBe(true);

        // Quick is discovery-only: same minutes, review-only blueprint.
        const discovery = buildSessionBlueprint({ minutes, lessonTitle: 'Why planes leave trails' });
        void discovery;
        const ctx = parseSessionParams({ minutes: String(minutes), origin: 'quick_session', kind: 'discovery' });
        expect(ctx.context).toMatchObject({ kind: 'discovery', origin: 'quick_session' });
    });
});
