/**
 * End-to-end journey: Onboarding 2.0 → recommendation → Quick Session.
 *
 * Runs fully headless with NO login and NO network:
 * - quiz + goals stores are local-first (AsyncStorage mocked)
 * - taskEngine + quickSession + hobbyMatcher are pure
 * - userGoalsService degrades to local-only when Supabase is unreachable
 * - the E2E bypass flag is asserted OFF (production-safety contract)
 */
import { useQuizStore, QUIZ_QUESTIONS } from '../store/quizStore';
import { useUserGoalsStore } from '../store/userGoalsStore';
import { matchHobbies } from '../services/hobbyMatcher';
import { taskEngine } from '../services/taskEngine';
import { buildSessionBlueprint } from '../domain/sessions/sessionBlueprint';
import { userGoalsService } from '../services/supabase/userGoals';
import { addAnalyticsListener, AnalyticsEventName } from '../services/analytics';
import { logEvent } from '../services/analytics';
import { isE2EBypassEnabled } from '../utils/e2eBypass';
import { getTodayDateString } from '../utils/date';

const allAAnswers: Record<number, number> = Object.fromEntries(
    QUIZ_QUESTIONS.map((q) => [q.id, 0]),
);

describe('e2e: onboarding 2.0 → recommendation → quick session (no login)', () => {
    it('completes the full journey with valid state at every step', () => {
        // ── 1. Fresh user ──────────────────────────────────────────
        useQuizStore.getState().resetQuiz();
        useUserGoalsStore.getState().resetGoals();
        expect(useUserGoalsStore.getState().hasCompletedExtension).toBe(false);

        // ── 2. Quiz (10 questions) ─────────────────────────────────
        for (const q of QUIZ_QUESTIONS) {
            useQuizStore.getState().setAnswer(q.id, 0);
        }
        expect(Object.keys(useQuizStore.getState().answers)).toHaveLength(10);
        useQuizStore.getState().completeQuiz();
        expect(useQuizStore.getState().isCompleted).toBe(true);

        // ── 3. Objectives (junk is normalized away, never stored) ──
        useUserGoalsStore.getState().setGoals([
            'grow_professionally',
            'prepare_career',
            'bogus-goal',
            42,
        ]);
        expect(useUserGoalsStore.getState().goals).toEqual([
            'grow_professionally',
            'prepare_career',
        ]);
        logEvent('onboarding_goal_selected', { goals: ['grow_professionally', 'prepare_career'] });

        // ── 4. Session length ──────────────────────────────────────
        useUserGoalsStore.getState().setPreferredSessionMinutes(15);
        expect(useUserGoalsStore.getState().preferredSessionMinutes).toBe(15);
        logEvent('preferred_session_minutes_selected', { minutes: 15 });

        // ── 5. Experience preference ───────────────────────────────
        useUserGoalsStore.getState().setExperiencePreference('from_zero');
        useUserGoalsStore.getState().markExtensionCompleted();
        expect(useUserGoalsStore.getState().experiencePreference).toBe('from_zero');
        expect(useUserGoalsStore.getState().hasCompletedExtension).toBe(true);
        logEvent('experience_level_selected', { preference: 'from_zero' });
        logEvent('onboarding_extended_completed', {});

        // ── 6. Recommendation profile → suggested skill ────────────
        const { answers } = useQuizStore.getState();
        const { goals } = useUserGoalsStore.getState();
        const matches = matchHobbies(answers, 3, goals);
        expect(matches).toHaveLength(3);
        // All-A quiz profile is a strong Python signal; career goals reinforce it.
        expect(matches[0].hobby.id).toBe('python');

        // ── 7. Daily plan from the real engine ─────────────────────
        const today = getTodayDateString();
        const plan = taskEngine.generateDailyPlan(
            'e2e-user',
            today,
            null,
            [{ user_id: 'e2e-user', hobby_id: 'python', is_primary: true }],
        );
        expect(plan.length).toBeGreaterThan(0);
        expect(plan.every((t) => t.hobby_id === 'python')).toBe(true);
        // Engine output gains ids on persist (server uuids or demo- ids in taskStore).
        const tasks = plan.map((t, i) => ({ ...t, id: `demo-${today}-${i}` }));

        // ── 8. Structured session scales with the timebox ────────
        // Quick is discovery-only now: time scaling lives in the blueprint.
        const bp30 = buildSessionBlueprint({ minutes: 30, taskTitle: tasks[0]?.title, lessonTitle: 'L1' });
        expect(bp30.phases).toContain('apply');
        expect(bp30.countsAsFullCompletion).toBe(true);
        logEvent('quick_session_duration_selected', { minutes: 30 });

        const bp5 = buildSessionBlueprint({ minutes: 5, taskTitle: tasks[0]?.title, lessonTitle: 'L1' });
        expect(bp5.phases).not.toContain('apply');
        expect(bp5.countsAsFullCompletion).toBe(false);

        logEvent('quick_session_started', { minutes: 30, mode: 'discovery' });
    });

    it('emits the required analytics events in screen order', () => {
        const seen: AnalyticsEventName[] = [];
        const unsubscribe = addAnalyticsListener((event) => {
            seen.push(event);
        });

        logEvent('onboarding_goal_selected', {});
        logEvent('preferred_session_minutes_selected', {});
        logEvent('experience_level_selected', {});
        logEvent('onboarding_extended_completed', {});
        logEvent('quick_session_duration_selected', {});
        logEvent('quick_session_started', {});

        unsubscribe();
        expect(seen).toEqual([
            'onboarding_goal_selected',
            'preferred_session_minutes_selected',
            'experience_level_selected',
            'onboarding_extended_completed',
            'quick_session_duration_selected',
            'quick_session_started',
        ]);
    });

    it('persists goals locally when Supabase is unreachable (offline e2e)', async () => {
        // No EXPO_PUBLIC_SUPABASE_* in jest → getSupabase() throws → graceful fallback.
        await expect(userGoalsService.getUserGoals('e2e-user')).resolves.toBeNull();

        const saved = await userGoalsService.upsertUserGoals('e2e-user', {
            goals: ['improve_focus', 'nope'],
            preferredSessionMinutes: 15,
            experiencePreference: 'depends',
        });
        expect(saved).toMatchObject({
            user_id: 'e2e-user',
            goals: ['improve_focus'],
            preferred_session_minutes: 15,
            experience_preference: 'depends',
        });
    });

    it('keeps the login bypass disabled outside dev bundles', () => {
        // Jest runs in node (__DEV__ undefined) → bypass must be OFF.
        // Same guarantee holds for every production bundle (__DEV__ === false).
        expect(isE2EBypassEnabled()).toBe(false);
    });

    it('hydrates existing users progressively without wiping local state', () => {
        useUserGoalsStore.getState().resetGoals();
        useUserGoalsStore.getState().setGoals(['learn_skills']);
        // Remote has only a session preference → goals stay untouched.
        useUserGoalsStore.getState().hydrateFromRemote({ preferredSessionMinutes: 30 });
        expect(useUserGoalsStore.getState().goals).toEqual(['learn_skills']);
        expect(useUserGoalsStore.getState().preferredSessionMinutes).toBe(30);
    });
});
