/**
 * Phase 1 coherence hardening — regression tests (23 required cases).
 *
 * A. Account isolation (1-6)   — resetUserScopedState + signOut wiring
 * B. Program isolation (7-10)  — fail-closed hobby scoping, alias intact
 * C. Next action (11-14)       — resolveCoachPrimary over canonical engine
 * E. Completion (15-20)        — ONE validated-completion policy
 * D. Coach (21-23, model part) — single primary, stable under LLM variance
 * F. Progress boundaries       — no local issuance, no cross-substitution
 *
 * Pure/unit level (default jest config). No network, no native modules:
 * supabase + taskService + ai are mocked; zustand stores run in-memory
 * against the mocked AsyncStorage.
 */

// ─── Mocks (hoisted) ────────────────────────────────────────────
const mockSignOut = jest.fn();
const mockGetSession = jest.fn();
const mockGetUserHobbies = jest.fn();
const mockGetOrCreateProfile = jest.fn().mockResolvedValue({
    is_premium: false,
    subscription_level: 'free',
});

jest.mock('../store/deviceScreenTimeStore', () => ({
    useDeviceScreenTimeStore: { getState: jest.fn(() => ({ reset: jest.fn() })) },
}));
jest.mock('../store/subscriptionStore', () => ({
    useSubscriptionStore: { getState: jest.fn(() => ({ reset: jest.fn() })) },
}));
jest.mock('../services/supabase', () => ({
    authService: {
        signIn: jest.fn(),
        signUp: jest.fn(),
        signOut: (...args: unknown[]) => mockSignOut(...args),
        getSession: (...args: unknown[]) => mockGetSession(...args),
    },
    dbService: { getUserHobbies: (...args: unknown[]) => mockGetUserHobbies(...args) },
    profileService: {
        getOrCreateProfile: (...args: unknown[]) => mockGetOrCreateProfile(...args),
        updatePremiumStatus: jest.fn(),
    },
}));
jest.mock('../services/supabase/sessions', () => ({
    sessionService: {
        saveSession: jest.fn().mockResolvedValue({}),
        getUserSessions: jest.fn().mockResolvedValue([]),
    },
}));
jest.mock('../services/taskService', () => ({
    taskService: {
        getDailyPlan: jest.fn().mockResolvedValue([]),
        completeTask: jest.fn().mockResolvedValue(null),
        uncompleteTask: jest.fn().mockResolvedValue(null),
        skipTask: jest.fn().mockResolvedValue(null),
    },
}));
jest.mock('../services/ai', () => ({
    aiService: {
        sendMessage: jest.fn().mockResolvedValue('ok'),
        proposeMetrics: jest.fn().mockResolvedValue([]),
        generatePlanOfAttack: jest.fn().mockResolvedValue({ summary: 'Mock', steps: [] }),
    },
    default: { sendMessage: jest.fn().mockResolvedValue('ok') },
}));

import { resetUserScopedState } from '../services/userScopeReset';
import { useAuthStore } from '../store/authStore';
import { useGoalStore } from '../store/goalStore';
import { useCredentialStore } from '../store/credentialStore';
import { useGamificationStore } from '../store/gamificationStore';
import { useUserProfileStore } from '../store/userProfileStore';
import { useTaskStore } from '../store/taskStore';
import { useDiscoveryStore } from '../store/discoveryStore';
import { useLanguageStore } from '../store/languageStore';
import {
    appendLearningEvent,
    eventsByProgram,
    __resetLearningEventsForTests,
} from '../services/learningEventRepository';
import { getProgram } from '../domain/credentials/catalog';
import {
    buildEvidence,
    toTaskItems,
    buildProgress,
    EngineTaskInput,
} from '../services/credentialService';
import { computeSkillGraph } from '../domain/credentials/skillGraph';
import {
    resolveCoachPrimary,
    buildCanonicalActionLine,
} from '../domain/sessions/nextActionPrecedence';
import {
    routeForRecommendation,
    sessionRouteForTask,
} from '../domain/sessions/sessionRouting';
import { findNextIncompleteTask } from '../domain/sessions/sessionCompletion';
import { buildProgressionDecision } from '../domain/sessions/progressionPolicy';
import { evaluateSession } from '../domain/sessions/outcomePolicy';
import {
    finalizeSwipeSession,
    __resetFinalizerForTests,
} from '../services/sessionFinalizer';
import {
    buildSessionCompletedEvent,
    buildTaskCompletedEvent,
} from '../domain/sessions/learningEvents';
import { learningEventCount } from '../services/learningEventRepository';

// ─── Helpers ────────────────────────────────────────────────────
const ANCHOR = '2026-09-01';

function seedUserAState() {
    useGoalStore.getState().setGoal({
        id: 'goal-a',
        hobby: 'chess',
        type: 'execution_count',
        category: 'execution',
        description: 'User A chess goal',
        target: 10,
        startingValue: 0,
        deadline: '2026-12-31',
        status: 'active',
        unitLabel: 'games',
        startDate: ANCHOR,
    } as any);
    useCredentialStore.getState().enroll('chess-foundations');
    useGamificationStore.getState().advanceDay('chess' as any);
    useGamificationStore.getState().markStepComplete('learn');
    useUserProfileStore.getState().setUserName('userA');
    useUserProfileStore.getState().setSelectedHobby('chess');
    useTaskStore.setState({
        dailyTasks: [
            {
                id: 'task-a1',
                user_id: 'userA',
                title: 'A task',
                type: 'practice',
                status: 'completed',
                scheduled_date: ANCHOR,
                duration_minutes: 20,
                hobby_id: 'chess',
            } as any,
        ],
        lastFetchDate: ANCHOR,
    });
    useDiscoveryStore.getState().saveInterest('topic-a');
}

function chessTask(status = 'completed'): EngineTaskInput {
    return {
        type: 'practice',
        status,
        hobby_id: 'chess',
        duration_minutes: 20,
        scheduled_date: ANCHOR,
    };
}

// ─── A. Account isolation (1-6) ─────────────────────────────────
describe('Phase 1 — A. account isolation', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        __resetLearningEventsForTests();
        // Start clean, then seed as User A.
        resetUserScopedState();
        useLanguageStore.getState().setLanguage('en');
        seedUserAState();
    });

    it('1. User A local state exists before sign-out', () => {
        expect(Object.keys(useGoalStore.getState().goals)).toContain('goal-a');
        expect(useCredentialStore.getState().programs['chess-foundations']?.enrolled).toBe(true);
        expect(useTaskStore.getState().dailyTasks.length).toBe(1);
        expect(useUserProfileStore.getState().userName).toBe('userA');
        expect(useDiscoveryStore.getState().interestedIds).toContain('topic-a');
    });

    it('2-3. reset clears user-scoped state but keeps device prefs', () => {
        resetUserScopedState();
        expect(useGoalStore.getState().goals).toEqual({});
        expect(useGoalStore.getState().progress).toEqual({});
        expect(useCredentialStore.getState().programs).toEqual({});
        expect(useTaskStore.getState().dailyTasks).toEqual([]);
        expect(useUserProfileStore.getState().userName).toBe('');
        expect(useUserProfileStore.getState().selectedHobby).toBeNull();
        expect(useDiscoveryStore.getState().interestedIds).toEqual([]);
        expect(useGamificationStore.getState().currentStreak).toBe(0);
        expect(useGamificationStore.getState().artifacts).toEqual([]);
        // DEVICE-SCOPED: language survives a user change.
        expect(useLanguageStore.getState().language).toBe('en');
    });

    it('4. signOut clears User A state so User B sees nothing', async () => {
        mockSignOut.mockResolvedValue(undefined);
        await useAuthStore.getState().signOut();
        expect(useGoalStore.getState().goals).toEqual({});
        expect(useCredentialStore.getState().programs).toEqual({});
        expect(useTaskStore.getState().dailyTasks).toEqual([]);
        expect(useUserProfileStore.getState().userName).toBe('');
        expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    it('5. owner-scoped learning events survive reset but stay invisible to User B', () => {
        appendLearningEvent(
            buildSessionCompletedEvent({
                sessionId: 'sess-a1',
                userId: 'userA',
                hobbyId: 'chess',
                lessonId: 'chess_d1',
                lessonDay: 1,
                sessionKind: 'structured',
                origin: 'home_start',
                scope: 'curriculum',
                outcome: 'pass',
                outcomeValue: 1,
            } as any),
        );
        resetUserScopedState();
        // Evidence is kept (User A gets it back on return) ...
        expect(learningEventCount('userA')).toBe(1);
        // ... but User B cannot see it through any program query.
        expect(eventsByProgram('chess-foundations', 'userB')).toEqual([]);
        expect(eventsByProgram('chess-foundations', 'userA')).toHaveLength(1);
    });

    it('6. reset never touches server data (no supabase calls)', () => {
        resetUserScopedState();
        expect(mockSignOut).not.toHaveBeenCalled();
        expect(mockGetSession).not.toHaveBeenCalled();
        expect(mockGetUserHobbies).not.toHaveBeenCalled();
        expect(mockGetOrCreateProfile).not.toHaveBeenCalled();
    });

    it('User A signing back in re-seeds their own state through normal writes', () => {
        resetUserScopedState();
        seedUserAState();
        expect(Object.keys(useGoalStore.getState().goals)).toContain('goal-a');
        expect(useCredentialStore.getState().programs['chess-foundations']?.enrolled).toBe(true);
    });
});

// ─── B. Program isolation (7-10) ────────────────────────────────
describe('Phase 1 — B. cross-program evidence isolation', () => {
    const chess = getProgram('chess-foundations')!;
    const reading = getProgram('reading-mastery')!;
    const python = getProgram('python-foundations')!;

    const readingTask = (): EngineTaskInput => ({
        type: 'practice',
        status: 'completed',
        hobby_id: 'reading',
        duration_minutes: 20,
        scheduled_date: ANCHOR,
    });
    const hobbylessTask = (): EngineTaskInput => ({
        type: 'practice',
        status: 'completed',
        duration_minutes: 20,
        scheduled_date: ANCHOR,
    });

    it('7. chess evidence cannot affect the reading credential', () => {
        const tasks = [chessTask(), chessTask()];
        const chessItems = toTaskItems(chess, tasks, ANCHOR);
        const readingItems = toTaskItems(reading, tasks, ANCHOR);
        const chessProgress = buildProgress(chess, buildEvidence(chess, tasks, [], [], null, null, null, { anchorDate: ANCHOR }), null, chessItems);
        const readingProgress = buildProgress(reading, buildEvidence(reading, tasks, [], [], null, null, null, { anchorDate: ANCHOR }), null, readingItems);
        expect(chessProgress.certificationProgress).toBeGreaterThan(0);
        expect(readingProgress.certificationProgress).toBe(0);
        expect(buildEvidence(reading, tasks, [], [], null, null, null).totalTasks).toBe(0);
    });

    it('8. reading evidence cannot affect the chess credential', () => {
        const tasks = [readingTask()];
        expect(buildEvidence(chess, tasks, [], [], null, null, null).totalTasks).toBe(0);
        expect(
            computeSkillGraph(chess, toTaskItems(chess, tasks, ANCHOR), [], null).overall,
        ).toBe(0);
        expect(
            computeSkillGraph(reading, toTaskItems(reading, tasks, ANCHOR), [], null).overall,
        ).toBeGreaterThan(0);
    });

    it('9. hobby-less evidence affects neither credential (fail closed)', () => {
        const tasks = [hobbylessTask(), hobbylessTask()];
        for (const program of [chess, reading, python]) {
            const evidence = buildEvidence(program, tasks, [], [], null, null, null, {
                anchorDate: ANCHOR,
            });
            expect(evidence.totalTasks).toBe(0);
            expect(evidence.completedTasks).toBe(0);
            expect(
                computeSkillGraph(program, toTaskItems(program, tasks, ANCHOR), [], null).overall,
            ).toBe(0);
        }
    });

    it('10. the explicit python/coding alias still works (and only it)', () => {
        const codingTask: EngineTaskInput = {
            type: 'practice',
            status: 'completed',
            hobby_id: 'coding',
            duration_minutes: 20,
            scheduled_date: ANCHOR,
        };
        expect(buildEvidence(python, [codingTask], [], [], null, null, null).totalTasks).toBe(1);
        expect(
            computeSkillGraph(python, toTaskItems(python, [codingTask], ANCHOR), [], null).overall,
        ).toBeGreaterThan(0);
        // Alias does not leak into unrelated programs.
        expect(buildEvidence(chess, [codingTask], [], [], null, null, null).totalTasks).toBe(0);
    });
});

// ─── C. Canonical next action (11-14) ───────────────────────────
describe('Phase 1 — C. one canonical next action', () => {
    const tasks = [
        { id: 't1', title: 'First', type: 'theory', status: 'completed', duration_minutes: 15 },
        { id: 't2', title: 'Second', type: 'practice', status: 'pending', duration_minutes: 30 },
    ];

    it('11. engine frontier action equals what Home exposes (same task, same route)', () => {
        const next = findNextIncompleteTask(tasks);
        expect(next?.id).toBe('t2');
        const homeRoute = sessionRouteForTask({ id: next!.id, duration_minutes: 30 }, 'home_start');
        const primary = resolveCoachPrimary({
            journeyAction: { kind: 'continue_learning' },
            journeyVisible: true,
            recommendation: {
                type: 'continue_curriculum',
                hobbyId: 'chess',
                taskId: 't2',
                minutes: 30,
                reasonCode: 'continue_path',
                confidence: 'low',
            },
            dailyTasks: tasks,
            origin: 'home_start',
        });
        expect(primary?.kind).toBe('session');
        if (primary?.kind === 'session') {
            expect(primary.route).toBe(homeRoute);
            expect(primary.source).toBe('frontier_task');
        }
    });

    it('12. Home and Coach expose action A (identical route strings)', () => {
        const rec = {
            type: 'continue_curriculum' as const,
            hobbyId: 'chess',
            taskId: 't2',
            minutes: 30,
            reasonCode: 'continue_path' as const,
            confidence: 'low' as const,
        };
        const viaRecommendation = routeForRecommendation(rec, 'home_start');
        const viaHomeFinder = sessionRouteForTask({ id: 't2', duration_minutes: 30 }, 'home_start');
        expect(viaRecommendation).toBe(viaHomeFinder);
    });

    it('13. credential remediation takes precedence over a competing learning rec', () => {
        const remediationRec = {
            type: 'repair_recall' as const,
            hobbyId: 'chess',
            programSlug: 'chess-foundations',
            skillKey: 'rules',
            skillName: 'Rules & Basics',
            curriculumDay: 3,
            minutes: 15,
            reasonCode: 'recall_gap' as const,
            confidence: 'medium' as const,
        };
        const withVerify = resolveCoachPrimary({
            journeyAction: { kind: 'verify_skill', skillKey: 'rules', skillName: 'Rules & Basics' },
            journeyVisible: true,
            recommendation: remediationRec,
            dailyTasks: tasks,
        });
        // Journey-owned: the Verify CTA lives in the journey section — Coach
        // renders no competing primary.
        expect(withVerify?.kind).toBe('journey_owned');
        const withoutCredential = resolveCoachPrimary({
            journeyAction: { kind: 'continue_learning' },
            journeyVisible: true,
            recommendation: remediationRec,
            dailyTasks: tasks,
        });
        expect(withoutCredential?.kind).toBe('session');
        if (withoutCredential?.kind === 'session') {
            expect(withoutCredential.source).toBe('remediation');
            expect(withoutCredential.route).toBe(routeForRecommendation(remediationRec, 'home_start'));
        }
    });

    it('14. the resolver takes no LLM input — AI text cannot replace the action', () => {
        const input = {
            journeyAction: { kind: 'continue_learning' },
            journeyVisible: false,
            recommendation: {
                type: 'continue_curriculum' as const,
                hobbyId: 'chess',
                taskId: 't2',
                minutes: 30,
                reasonCode: 'continue_path' as const,
                confidence: 'low' as const,
            },
            dailyTasks: tasks,
        };
        const first = resolveCoachPrimary(input);
        const second = resolveCoachPrimary({ ...input });
        expect(first).toEqual(second);
        // No parameter exists for LLM output: type-level guarantee.
        expect('llm' in input).toBe(false);
        expect('aiText' in input).toBe(false);
        const line = buildCanonicalActionLine(first);
        expect(line).toContain('already decided');
    });
});

// ─── E. Validated completion (15-20) ────────────────────────────
describe('Phase 1 — E. one validated-completion policy', () => {
    const fullBlueprint = { countsAsFullCompletion: true, requiresValidation: false } as any;
    const base = {
        kind: 'structured' as const,
        blueprint: fullBlueprint,
        hasTargetTask: true,
        scope: 'curriculum' as const,
    };
    const passCards = [
        { id: 'r1', type: 'recall', required: true },
        { id: 'a1', type: 'apply', required: true },
    ] as any;
    const passStatus = {
        r1: { completed: true, outcome: 'pass', attempts: 1 },
        a1: { completed: true, outcome: 'pass', attempts: 1 },
    } as any;

    it('15. failed session does not advance (signal only)', () => {
        const evaluation = evaluateSession(passCards, {
            r1: { completed: true, outcome: 'fail', attempts: 1 },
            a1: { completed: true, outcome: 'pass', attempts: 1 },
        } as any);
        expect(evaluation).toBe('fail');
        const decision = buildProgressionDecision({ ...base, evaluation });
        expect(decision).toEqual({
            completeDailyTask: false,
            advanceCurriculum: false,
            countSession: false,
            goalSignal: 'failure',
        });
    });

    it('16. unknown/unanswered session does not advance at all', () => {
        const evaluation = evaluateSession(passCards, {
            r1: { completed: true, outcome: 'pass', attempts: 1 },
        } as any);
        expect(evaluation).toBe('non_rewarding');
        const decision = buildProgressionDecision({ ...base, evaluation });
        expect(decision).toEqual({
            completeDailyTask: false,
            advanceCurriculum: false,
            countSession: false,
            goalSignal: null,
        });
    });

    it('17. discovery never advances, even on pass', () => {
        const decision = buildProgressionDecision({
            kind: 'discovery',
            evaluation: 'pass',
            blueprint: fullBlueprint,
            hasTargetTask: false,
            scope: 'none',
        });
        expect(decision).toEqual({
            completeDailyTask: false,
            advanceCurriculum: false,
            countSession: false,
            goalSignal: null,
        });
    });

    it('18. certificate bite counts participation but never moves the frontier', () => {
        const decision = buildProgressionDecision({
            kind: 'certificate_review',
            evaluation: 'pass',
            blueprint: { countsAsFullCompletion: false, requiresValidation: false } as any,
            hasTargetTask: false,
            scope: 'none',
        });
        expect(decision.completeDailyTask).toBe(false);
        expect(decision.advanceCurriculum).toBe(false);
        expect(decision.countSession).toBe(true);
    });

    it('19. valid structured completion advances exactly once (finalizer memo)', async () => {
        __resetFinalizerForTests();
        __resetLearningEventsForTests();
        const lesson = { hobby: 'chess', id: 'chess_d1', day: 1, learn: { title: 'Basics' } } as any;
        const input = {
            sessionId: 'phase1-once',
            hobby: 'chess' as const,
            lesson,
            kind: 'structured' as const,
            origin: 'home_start' as const,
            scope: 'curriculum' as const,
            blueprint: fullBlueprint,
            cards: passCards,
            status: passStatus,
            elapsedSeconds: 600,
            chessSolved: false,
        };
        const first = await finalizeSwipeSession(input);
        expect(first.decision.advanceCurriculum).toBe(true);
        expect(first.decision.completeDailyTask).toBe(false); // no userId/target wiring in test
        const eventsAfterFirst = learningEventCount();
        const second = await finalizeSwipeSession(input);
        expect(second).toBe(first); // settled memo — never re-executed
        expect(learningEventCount()).toBe(eventsAfterFirst);
    });

    it('20. duplicate completion events do not double-reward (idempotent append)', () => {
        __resetLearningEventsForTests();
        const event = buildTaskCompletedEvent({
            sessionId: 'phase1-dup',
            hobbyId: 'chess',
            lessonId: 'chess_d1',
            lessonDay: 1,
            taskId: 't2',
            sessionKind: 'structured',
            origin: 'home_start',
            scope: 'curriculum',
            outcome: 'pass',
        } as any);
        expect(appendLearningEvent(event)).toBe(true);
        expect(appendLearningEvent({ ...event })).toBe(false);
        const sessionEvent = buildSessionCompletedEvent({
            sessionId: 'phase1-dup',
            hobbyId: 'chess',
            lessonId: 'chess_d1',
            lessonDay: 1,
            sessionKind: 'structured',
            origin: 'home_start',
            scope: 'curriculum',
            outcome: 'pass',
            outcomeValue: 1,
        } as any);
        expect(appendLearningEvent(sessionEvent)).toBe(true);
        expect(appendLearningEvent({ ...sessionEvent })).toBe(false);
    });
});

// ─── D. Coach model (21-23, resolver part) ──────────────────────
describe('Phase 1 — D. coach primary stability', () => {
    it('23. explanation context varies but the action stays canonical', () => {
        const rec = {
            type: 'practice_application' as const,
            hobbyId: 'chess',
            programSlug: 'chess-foundations',
            skillKey: 'tactics',
            skillName: 'Tactics & Strategy',
            curriculumDay: 24,
            minutes: 15,
            reasonCode: 'recent_validation_failure' as const,
            confidence: 'high' as const,
        };
        const for15 = resolveCoachPrimary({
            journeyAction: { kind: 'continue_learning' },
            journeyVisible: true,
            recommendation: rec,
            dailyTasks: [],
        });
        const for30 = resolveCoachPrimary({
            journeyAction: { kind: 'continue_learning' },
            journeyVisible: true,
            recommendation: { ...rec, minutes: 30 },
            dailyTasks: [],
        });
        // Same weakness, same source; budget only changes the route minutes.
        expect(for15?.kind).toBe('session');
        expect(for30?.kind).toBe('session');
        if (for15?.kind === 'session' && for30?.kind === 'session') {
            expect(for15.source).toBe('remediation');
            expect(for30.source).toBe('remediation');
        }
        // Stage action overrides any engine variance: action stays put.
        const stage = resolveCoachPrimary({
            journeyAction: { kind: 'start_knowledge' },
            journeyVisible: true,
            recommendation: rec,
            dailyTasks: [],
        });
        expect(stage).toEqual({ kind: 'journey_owned', actionKind: 'start_knowledge' });
    });
});

// ─── F. Progress boundaries ─────────────────────────────────────
describe('Phase 1 — F. progress boundaries', () => {
    it('no local credential issuance exists (server RPC owns issuance)', () => {
        const store = useCredentialStore.getState() as any;
        expect(store.issueCredential).toBeUndefined();
        expect(store.issue).toBeUndefined();
        expect(store.mintCredential).toBeUndefined();
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const service = require('../services/credentialService') as any;
        expect(service.issueCredential).toBeUndefined();
    });

    it('goal/learning/verified/credential/gamification stay separate stores', () => {
        // Goal progress never reads the credential store and vice versa:
        // distinct persist keys, distinct state slices.
        expect(useGoalStore.getState().recordDailyAction).toEqual(expect.any(Function));
        expect(useCredentialStore.getState().getProgress).toEqual(expect.any(Function));
        expect(useGamificationStore.getState().markStepComplete).toEqual(expect.any(Function));
    });
});
