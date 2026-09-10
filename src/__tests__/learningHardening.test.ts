/**
 * Phase 3A.1 hardening — progression decision, finalization idempotency,
 * owner-scoped repository, pinned versions, full history.
 */
import { buildSessionBlueprint } from '../domain/sessions/sessionBlueprint';
import { buildProgressionDecision } from '../domain/sessions/progressionPolicy';
import {
    buildAttemptEvent,
    buildExposureEvent,
    buildSessionCompletedEvent,
    buildTaskCompletedEvent,
} from '../domain/sessions/learningEvents';
import { finalizeSwipeSession, __resetFinalizerForTests } from '../services/sessionFinalizer';
import { applySessionProgression } from '../services/sessionStepEffects';
import {
    __resetLearningEventsForTests,
    appendLearningEvent,
    appendLearningEvents,
    eventsByHobby,
    eventsBySession,
    learningEventCount,
    recentLearningEvents,
} from '../services/learningEventRepository';

jest.mock('../services/ai', () => ({
    aiService: { sendMessage: jest.fn(), gradeAnswer: jest.fn() },
}));

const goalCalls = { recordDailyAction: 0, adjustDifficulty: 0 };
const gameCalls = {
    advanceDay: 0,
    incrementSessionsCompleted: 0,
    recordChessSolve: 0,
    completeTask: 0,
    saveSession: 0,
};

jest.mock('../store/goalStore', () => ({
    useGoalStore: {
        getState: () => ({
            recordDailyAction: () => { goalCalls.recordDailyAction++; },
            adjustDifficulty: () => { goalCalls.adjustDifficulty++; },
        }),
    },
}));

jest.mock('../store/gamificationStore', () => ({
    useGamificationStore: {
        getState: () => ({
            markStepComplete: () => {},
            saveArtifact: () => 'artifact_x',
            advanceDay: () => { gameCalls.advanceDay++; },
            incrementSessionsCompleted: () => { gameCalls.incrementSessionsCompleted++; },
            recordChessSolve: () => { gameCalls.recordChessSolve++; },
        }),
    },
}));

jest.mock('../store/taskStore', () => ({
    useTaskStore: {
        getState: () => ({
            completeTask: async () => { gameCalls.completeTask++; return null; },
            dailyTasks: [],
        }),
    },
}));

jest.mock('../services/supabase/sessions', () => ({
    sessionService: {
        saveSession: async () => { gameCalls.saveSession++; return null; },
    },
}));

jest.mock('../store/hobbyTimeStore', () => ({
    useHobbyTimeStore: {
        getState: () => ({ userCreatedDate: 'x', setUserCreatedDate: () => {}, addHobbyTime: () => {} }),
    },
}));

const resetAll = () => {
    goalCalls.recordDailyAction = 0;
    goalCalls.adjustDifficulty = 0;
    gameCalls.advanceDay = 0;
    gameCalls.incrementSessionsCompleted = 0;
    gameCalls.recordChessSolve = 0;
    gameCalls.completeTask = 0;
    gameCalls.saveSession = 0;
    __resetLearningEventsForTests();
    __resetFinalizerForTests();
};

const lesson: any = { id: 'python_d15', hobby: 'python', day: 15, learn: { title: 'Functions' } };
const microBp = { countsAsFullCompletion: false, requiresValidation: false };
const standardBp = { countsAsFullCompletion: true, requiresValidation: false };
const strictBp = { countsAsFullCompletion: true, requiresValidation: true };

describe('9 — review / micro / strict invariants', () => {
    it('certificate_review PASS: weak evidence, zero advance, zero task', () => {
        const d = buildProgressionDecision({ kind: 'certificate_review', evaluation: 'pass', blueprint: standardBp, hasTargetTask: true });
        expect(d).toEqual({ completeDailyTask: false, advanceCurriculum: false, countSession: true, goalSignal: 'success' });
    });

    it('certificate_review PARTIAL: weak partial, zero advance', () => {
        const d = buildProgressionDecision({ kind: 'certificate_review', evaluation: 'partial', blueprint: standardBp, hasTargetTask: false });
        expect(d.advanceCurriculum).toBe(false);
        expect(d.completeDailyTask).toBe(false);
        expect(d.countSession).toBe(true);
        expect(d.goalSignal).toBe('struggled');
    });

    it('structured 5-minute PASS: no advance, no task completion', () => {
        const d = buildProgressionDecision({ kind: 'structured', evaluation: 'pass', blueprint: microBp, hasTargetTask: true });
        expect(d.advanceCurriculum).toBe(false);
        expect(d.completeDailyTask).toBe(false);
    });

    it('structured standard PASS: one advance + task when targeted', () => {
        const d = buildProgressionDecision({ kind: 'structured', evaluation: 'pass', blueprint: standardBp, hasTargetTask: true });
        expect(d).toEqual({ completeDailyTask: true, advanceCurriculum: true, countSession: true, goalSignal: 'success' });
    });

    it('strict PARTIAL: no advance, no task, struggled signal kept', () => {
        const d = buildProgressionDecision({ kind: 'structured', evaluation: 'partial', blueprint: strictBp, hasTargetTask: true });
        expect(d).toEqual({ completeDailyTask: false, advanceCurriculum: false, countSession: true, goalSignal: 'struggled' });
    });

    it('strict PASS: advance + task completion', () => {
        const d = buildProgressionDecision({ kind: 'structured', evaluation: 'pass', blueprint: strictBp, hasTargetTask: true });
        expect(d.completeDailyTask).toBe(true);
        expect(d.advanceCurriculum).toBe(true);
    });

    it('discovery / fail / non-rewarding: nothing moves', () => {
        const disco = buildProgressionDecision({ kind: 'discovery', evaluation: 'pass', blueprint: microBp, hasTargetTask: false });
        expect(disco).toEqual({ completeDailyTask: false, advanceCurriculum: false, countSession: false, goalSignal: null });
        const fail = buildProgressionDecision({ kind: 'structured', evaluation: 'fail', blueprint: standardBp, hasTargetTask: true });
        expect(fail.advanceCurriculum).toBe(false);
        expect(fail.completeDailyTask).toBe(false);
        expect(fail.countSession).toBe(false);
        // Discovery sessions cannot even evaluate to pass (no required cards).
        const bp = buildSessionBlueprint({ minutes: 10, lessonTitle: 'T' });
        expect(bp.countsAsFullCompletion).toBe(false);
    });
});

describe('10 — finalization idempotency', () => {
    beforeEach(resetAll);

    const baseInput = (sessionId: string) => ({
        sessionId,
        userId: 'u1',
        hobby: 'python' as const,
        lesson,
        kind: 'structured' as const,
        origin: 'your_day' as const,
        blueprint: buildSessionBlueprint({ minutes: 30, lessonTitle: 'Functions' }),
        cards: [
            { id: 'recall-0', type: 'recall', phase: 'recall', order: 0, required: true },
            { id: 'apply-0', type: 'apply', phase: 'apply', order: 1, required: true },
        ] as any[],
        status: {
            'recall-0': { completed: true, attempts: 1, outcome: 'pass' as const },
            'apply-0': { completed: true, attempts: 1, outcome: 'pass' as const },
        },
        targetTaskId: 'task-1',
        targetTaskTitle: 'Loops',
        elapsedSeconds: 600,
        chessSolved: false,
    });

    it('same session finalized twice: one advance, one count, one task, one event', async () => {
        const first = await finalizeSwipeSession(baseInput('s-once'));
        const second = await finalizeSwipeSession(baseInput('s-once'));
        expect(first).toBe(second);
        expect(gameCalls.advanceDay).toBe(1);
        expect(gameCalls.incrementSessionsCompleted).toBe(1);
        expect(gameCalls.completeTask).toBe(1);
        expect(eventsBySession('s-once', 'u1')).toHaveLength(2); // task + session events
    });

    it('concurrent finalizations share one operation', async () => {
        const [a, b] = await Promise.all([
            finalizeSwipeSession(baseInput('s-race')),
            finalizeSwipeSession(baseInput('s-race')),
        ]);
        expect(a).toBe(b);
        expect(gameCalls.advanceDay).toBe(1);
        expect(gameCalls.completeTask).toBe(1);
        expect(gameCalls.incrementSessionsCompleted).toBe(1);
    });

    it('fail/unknown sessions advance nothing and complete nothing', async () => {
        const input = {
            ...baseInput('s-fail'),
            status: {
                'recall-0': { completed: true, attempts: 1, outcome: 'fail' as const },
                'apply-0': { completed: true, attempts: 1, outcome: 'fail' as const },
            },
        };
        const res = await finalizeSwipeSession(input);
        expect(res.decision.advanceCurriculum).toBe(false);
        expect(res.taskCompleted).toBe(false);
        expect(gameCalls.advanceDay).toBe(0);
        expect(gameCalls.completeTask).toBe(0);
        expect(gameCalls.incrementSessionsCompleted).toBe(0);
        expect(goalCalls.recordDailyAction).toBe(0);
    });

    it('strict partial advances nothing and completes nothing', async () => {
        const input = {
            ...baseInput('s-strict-partial'),
            blueprint: buildSessionBlueprint({ minutes: 30, lessonTitle: 'L', hasTests: true }),
            status: {
                'recall-0': { completed: true, attempts: 1, outcome: 'pass' as const },
                'apply-0': { completed: true, attempts: 1, outcome: 'partial' as const },
            },
        };
        expect(input.blueprint.requiresValidation).toBe(true);
        const res = await finalizeSwipeSession(input);
        expect(res.taskCompleted).toBe(false);
        expect(res.advancedDay).toBe(false);
        expect(gameCalls.completeTask).toBe(0);
        expect(gameCalls.advanceDay).toBe(0);
    });

    it('decision-driven progression equivalents stay exact', () => {
        const res = applySessionProgression({
            lesson,
            decision: buildProgressionDecision({ kind: 'structured', evaluation: 'pass', blueprint: standardBp, hasTargetTask: false }),
            chessSolved: true,
        });
        expect(res).toEqual({ progressed: true, advancedDay: true });
        expect(gameCalls.recordChessSolve).toBe(1);
    });
});

describe('11 — owner-scoped repository, versions, full history', () => {
    beforeEach(resetAll);

    const owned = (owner: string, session: string) =>
        buildAttemptEvent({
            sessionId: session, userId: owner === 'local' ? undefined : owner,
            hobbyId: 'python', cardId: 'c', attemptNo: 1,
            sessionKind: 'structured', outcome: 'pass', cardType: 'apply',
        });

    it('User A events never appear in User B queries', () => {
        appendLearningEvent(owned('user-a', 'sa'));
        appendLearningEvent(owned('user-b', 'sb'));
        expect(eventsByHobby('python', 'user-a')).toHaveLength(1);
        expect(eventsByHobby('python', 'user-b')).toHaveLength(1);
        expect(eventsBySession('sa', 'user-b')).toHaveLength(0);
    });

    it('anonymous events carry an explicit local owner', () => {
        const e = owned('local', 's-anon');
        expect(e.ownerId).toBe('local');
        appendLearningEvent(e);
        expect(eventsBySession('s-anon', 'local')).toHaveLength(1);
        expect(eventsBySession('s-anon', 'user-a')).toHaveLength(0);
    });

    it('history is never truncated at the old boundary', () => {
        const batch = Array.from({ length: 5200 }, (_, i) =>
            buildAttemptEvent({
                sessionId: `bulk-${Math.floor(i / 10)}`, userId: 'u1', hobbyId: 'python',
                cardId: `c${i % 10}`, attemptNo: 1, sessionKind: 'structured', outcome: 'pass', cardType: 'apply',
            }),
        );
        expect(appendLearningEvents(batch)).toBe(5200);
        expect(learningEventCount('u1')).toBe(5200);
        expect(recentLearningEvents('u1', 10)).toHaveLength(10);
    });

    it('every mappable event pins programSlug + programVersion + skillKey', () => {
        const attempt = buildAttemptEvent({
            sessionId: 's', userId: 'u1', hobbyId: 'python', lessonId: 'python_d15', lessonDay: 15,
            cardId: 'a', attemptNo: 1, sessionKind: 'structured', outcome: 'pass', cardType: 'apply',
        });
        expect(attempt.programSlug).toBe('python-foundations');
        expect(attempt.programVersion).toBe('1.0');
        expect(attempt.skillKey).toBe('functions');
        expect(attempt.ownerId).toBe('u1');
        const exposure = buildExposureEvent({
            sessionId: 's', userId: 'u1', hobbyId: 'python', lessonId: 'python_d15', lessonDay: 15,
            cardId: 'concept-0', sessionKind: 'structured',
        });
        expect(exposure.programVersion).toBe('1.0');
        expect(exposure.skillKey).toBe('functions');
        const completed = buildSessionCompletedEvent({
            sessionId: 's', userId: 'u1', hobbyId: 'python', lessonId: 'python_d15', lessonDay: 15,
            sessionKind: 'structured', outcome: 'pass', outcomeValue: 1,
        });
        expect(completed.programVersion).toBe('1.0');
        const tasked = buildTaskCompletedEvent({
            sessionId: 's', userId: 'u1', hobbyId: 'python', lessonId: 'python_d15', lessonDay: 15,
            taskId: 't', sessionKind: 'structured', outcome: 'pass',
        });
        expect(tasked.programVersion).toBe('1.0');
        expect(tasked.source).toBe('daily_task');
    });

    it('unknown program stays honestly unmapped', () => {
        const e = buildAttemptEvent({
            sessionId: 's', userId: 'u1', hobbyId: 'klingon', cardId: 'c', attemptNo: 1,
            sessionKind: 'structured', outcome: 'pass', cardType: 'apply',
        });
        expect(e.programSlug).toBeUndefined();
        expect(e.programVersion).toBeUndefined();
        expect(e.skillKey).toBeUndefined();
    });

    it('retries are separate, duplicates deduplicated', () => {
        const mk = (n: number) =>
            buildAttemptEvent({
                sessionId: 's', userId: 'u1', hobbyId: 'python', cardId: 'c', attemptNo: n,
                sessionKind: 'structured', outcome: n === 1 ? 'fail' : 'pass', cardType: 'recall',
            });
        expect(appendLearningEvents([mk(1), mk(2), mk(1)])).toBe(2);
        expect(eventsBySession('s', 'u1').map(e => e.outcome)).toEqual(['fail', 'pass']);
    });
});
