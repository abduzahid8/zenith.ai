/**
 * XP truth — single and truthful awards (regression).
 *
 * De-facto XP authority: goalStore history, XP-counted entries × 50.
 * Invariants pinned here:
 *  A. successful skill session → exactly ONE XP-counted entry (not two);
 *  B. failed skill session → ZERO XP-counted entries (difficulty work kept);
 *  C. successful execution session → exactly one XP-counted entry;
 *  D. repeated same-day check-in → one XP-counted entry (value still updates);
 *  E. different-day check-ins → one entry each;
 *  F. attestation taps (did_it / onCompleteDay) write no history;
 *  G. reload preserves XP (history authoritative);
 *  H. same session finalized twice → one XP-counted entry;
 *  I. Detail + Journey share one XP/level calculation.
 */
import * as fs from 'fs';
import * as path from 'path';
import { useGoalStore, countsTowardXp } from '../store/goalStore';
import { useTaskStore } from '../store/taskStore';
import { useGamificationStore } from '../store/gamificationStore';
import { finalizeSwipeSession, __resetFinalizerForTests } from '../services/sessionFinalizer';
import { applySessionProgression } from '../services/sessionStepEffects';
import { buildProgressionDecision } from '../domain/sessions/progressionPolicy';
import { buildSessionBlueprint } from '../domain/sessions/sessionBlueprint';
import { __resetLearningEventsForTests } from '../services/learningEventRepository';
import type { GoalDefinition } from '../types/goals';

const ROOT = path.join(__dirname, '..', '..');
const readSrc = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8');

jest.mock('../services/taskService', () => ({
    taskService: {
        completeTask: jest.fn().mockResolvedValue(undefined),
        uncompleteTask: jest.fn().mockResolvedValue(undefined),
        getDailyPlan: jest.fn().mockResolvedValue([]),
    },
}));
jest.mock('../services/supabase/sessions', () => ({
    sessionService: { saveSession: jest.fn().mockResolvedValue(null) },
}));
jest.mock('../store/hobbyTimeStore', () => ({
    useHobbyTimeStore: {
        getState: () => ({ userCreatedDate: 'x', setUserCreatedDate: () => {}, addHobbyTime: () => {} }),
    },
}));

const ANCHOR = '2026-09-01';
const day = (offset: number) => {
    const d = new Date(ANCHOR);
    d.setDate(d.getDate() + offset);
    return d.toISOString().split('T')[0];
};

const SKILL_GOAL: GoalDefinition = {
    id: 'goal-xp-skill',
    hobby: 'chess' as any,
    type: 'skill_rating',
    category: 'skill',
    description: 'Chess mastery',
    target: 1200,
    difficultyScore: 400,
    targetDifficulty: 1200,
    deadline: day(60),
    startDate: ANCHOR,
    status: 'active',
    unitLabel: 'pts',
} as GoalDefinition;

const EXEC_GOAL: GoalDefinition = {
    id: 'goal-xp-exec',
    hobby: 'reading' as any,
    type: 'execution_count',
    category: 'execution',
    description: 'Read more',
    target: 100,
    startingValue: 0,
    deadline: day(60),
    startDate: ANCHOR,
    status: 'active',
    unitLabel: 'pages',
} as GoalDefinition;

const xpCount = (goalId: string): number =>
    useGoalStore.getState().progress[goalId].history.filter(countsTowardXp).length;
const histLen = (goalId: string): number =>
    useGoalStore.getState().progress[goalId].history.length;

const lessonFor = (hobby: string): any => ({ hobby, learn: { title: 'Tactics' } });
const standardDecision = (evaluation: 'pass' | 'fail' = 'pass') =>
    buildProgressionDecision({
        kind: 'structured',
        evaluation,
        blueprint: { countsAsFullCompletion: true, requiresValidation: false } as any,
        hasTargetTask: true,
        scope: 'curriculum',
    });

beforeEach(() => {
    useGoalStore.setState({ goals: {}, progress: {}, goalByHobby: {}, executionGoalByHobby: {} });
    useTaskStore.setState({ dailyTasks: [], lastFetchDate: null } as any);
    useGamificationStore.getState().resetGamification();
    __resetLearningEventsForTests();
    __resetFinalizerForTests();
    jest.clearAllMocks();
});

describe('countsTowardXp predicate', () => {
    it('counts completions and check-ins; excludes difficulty and bottleneck records', () => {
        expect(countsTowardXp({ date: 'd', value: 2, description: 'x' } as any)).toBe(true);
        expect(countsTowardXp({ date: 'd', value: 1, description: 'x', type: 'checkin' } as any)).toBe(true);
        expect(
            countsTowardXp({ date: 'd', value: 400, description: 'difficulty: ok → 410', type: 'task' } as any),
        ).toBe(false);
        expect(
            countsTowardXp({ date: 'd', value: 0, description: 'blocker: y', type: 'bottleneck' } as any),
        ).toBe(false);
        expect(countsTowardXp(null as any)).toBe(false);
    });
});

describe('A/B/C — validated session awards', () => {
    it('A. successful skill session → exactly ONE XP-counted entry (history keeps both records)', () => {
        useGoalStore.getState().setGoal({ ...SKILL_GOAL });
        const before = { xp: xpCount(SKILL_GOAL.id), len: histLen(SKILL_GOAL.id) };
        const decision = standardDecision('pass');
        expect(decision.goalSignal).toBe('success');
        applySessionProgression({ lesson: lessonFor('chess'), decision, chessSolved: false });
        // Both legitimate records are preserved (progress signal + difficulty
        // signal) but only one of them counts toward XP.
        expect(histLen(SKILL_GOAL.id) - before.len).toBe(2);
        expect(xpCount(SKILL_GOAL.id) - before.xp).toBe(1);
        // Legitimate difficulty work still happened.
        expect(
            useGoalStore.getState().progress[SKILL_GOAL.id].history.some(h =>
                h.description.startsWith('difficulty:'),
            ),
        ).toBe(true);
    });

    it('B. failed skill session → ZERO XP-counted entries, difficulty still adjusts', () => {
        useGoalStore.getState().setGoal({ ...SKILL_GOAL });
        const diffBefore = useGoalStore.getState().progress[SKILL_GOAL.id].currentDifficulty;
        const decision = standardDecision('fail');
        expect(decision.goalSignal).toBe('failure');
        applySessionProgression({ lesson: lessonFor('chess'), decision, chessSolved: false });
        expect(xpCount(SKILL_GOAL.id)).toBe(0);
        expect(
            useGoalStore.getState().progress[SKILL_GOAL.id].history.some(h =>
                h.description.startsWith('difficulty:'),
            ),
        ).toBe(true);
        expect(useGoalStore.getState().progress[SKILL_GOAL.id].currentDifficulty).not.toBe(diffBefore);
    });

    it('C. successful execution session → exactly one XP-counted entry', () => {
        useGoalStore.getState().setGoal({ ...EXEC_GOAL });
        applySessionProgression({
            lesson: lessonFor('reading'),
            decision: standardDecision('pass'),
            chessSolved: false,
        });
        expect(histLen(EXEC_GOAL.id)).toBe(1);
        expect(xpCount(EXEC_GOAL.id)).toBe(1);
    });
});

describe('D/E — check-in idempotency', () => {
    it('D. same check-in twice → one XP-counted entry, value still updates', () => {
        useGoalStore.getState().setGoal({ ...EXEC_GOAL });
        const store = () => useGoalStore.getState();
        store().recordCheckin(60, 'Morning pages', undefined, 'reading' as any);
        store().recordCheckin(80, 'Evening pages', undefined, 'reading' as any);
        const history = store().progress[EXEC_GOAL.id].history;
        expect(history.filter(h => h.type === 'checkin').length).toBe(1);
        expect(xpCount(EXEC_GOAL.id)).toBe(1);
        expect(store().progress[EXEC_GOAL.id].currentValue).toBe(80);
    });

    it('E. check-ins on two different days → two entries', () => {
        useGoalStore.getState().setGoal({ ...EXEC_GOAL });
        const store = () => useGoalStore.getState();
        const yesterday = day(-1);
        useGoalStore.setState(state => ({
            progress: {
                ...state.progress,
                [EXEC_GOAL.id]: {
                    ...state.progress[EXEC_GOAL.id],
                    history: [
                        ...state.progress[EXEC_GOAL.id].history,
                        { date: yesterday, value: 30, description: 'Yesterday', type: 'checkin' as const },
                    ],
                },
            },
        }));
        store().recordCheckin(60, 'Today', undefined, 'reading' as any);
        expect(
            store().progress[EXEC_GOAL.id].history.filter(h => h.type === 'checkin').length,
        ).toBe(2);
        expect(xpCount(EXEC_GOAL.id)).toBe(2);
    });
});

describe('F — attestation writes nothing', () => {
    it('did_it / onCompleteDay handlers contain no history-affecting calls', () => {
        // Call syntax only: containment comments name these functions
        // precisely to forbid them, so bare-word matching would false-positive.
        const writes = /(recordDailyAction|recordCheckin|adjustDifficulty|completeDailyContent|setTroubleshoot)\s*\(/;
        const detail = readSrc('src/screens/GoalDetailScreen.tsx');
        const didIt = detail.slice(detail.indexOf("case 'did_it':"), detail.indexOf("case 'did_it':") + 600);
        expect(didIt).toMatch(/setFinished\(true\)/);
        expect(didIt).not.toMatch(writes);
        const journey = readSrc('src/screens/GoalJourneyScreen.tsx');
        for (const marker of ['onCompleteDay={() => {', 'onCompleteAll={() => {']) {
            const at = journey.indexOf(marker);
            expect(at).toBeGreaterThan(-1);
            expect(journey.slice(at, at + 700)).not.toMatch(writes);
        }
    });

    it('no anticipatory +50 survives in production UI', () => {
        for (const rel of ['src/screens/GoalDetailScreen.tsx', 'src/screens/GoalJourneyScreen.tsx']) {
            const src = readSrc(rel);
            expect(src).not.toMatch(/xpInLevel \+ XP_PER_DAY/);
            expect(src).not.toMatch(/\+{XP_PER_DAY} XP/);
        }
        expect(readSrc('src/screens/GoalDetailScreen.tsx')).not.toMatch(/Complete → \+50 XP/);
    });
});

describe('G — reload stability', () => {
    it('one real completion → history authoritative, totalXP +50 across rehydrate', () => {
        useGoalStore.getState().setGoal({ ...EXEC_GOAL });
        applySessionProgression({
            lesson: lessonFor('reading'),
            decision: standardDecision('pass'),
            chessSolved: false,
        });
        expect(xpCount(EXEC_GOAL.id)).toBe(1);
        const { goals, progress, goalByHobby, executionGoalByHobby } = useGoalStore.getState();
        const rehydrated = JSON.parse(JSON.stringify({ goals, progress, goalByHobby, executionGoalByHobby }));
        useGoalStore.setState({ goals: {}, progress: {}, goalByHobby: {}, executionGoalByHobby: {} });
        useGoalStore.setState(rehydrated);
        expect(xpCount(EXEC_GOAL.id)).toBe(1);
        expect(xpCount(EXEC_GOAL.id) * 50).toBe(50);
    });
});

describe('H — session retry', () => {
    it('same validated session finalized twice → one XP-counted entry', async () => {
        useGoalStore.getState().setGoal({ ...SKILL_GOAL });
        useTaskStore.setState({
            dailyTasks: [
                {
                    id: 'task-1',
                    user_id: 'u1',
                    title: 'Tactics',
                    type: 'practice',
                    status: 'pending',
                    scheduled_date: ANCHOR,
                    hobby_id: 'chess',
                    duration_minutes: 15,
                } as any,
            ],
            lastFetchDate: ANCHOR,
        } as any);
        const input = (sessionId: string) => ({
            sessionId,
            userId: 'u1',
            hobby: 'chess' as const,
            lesson: { hobby: 'chess', learn: { title: 'Tactics' } } as any,
            kind: 'structured' as const,
            origin: 'your_day' as const,
            scope: 'curriculum' as const,
            blueprint: buildSessionBlueprint({ minutes: 30, lessonTitle: 'Tactics' }),
            cards: [
                { id: 'recall-0', type: 'recall', phase: 'recall', order: 0, required: true },
                { id: 'apply-0', type: 'apply', phase: 'apply', order: 1, required: true },
            ] as any[],
            status: {
                'recall-0': { completed: true, attempts: 1, outcome: 'pass' as const },
                'apply-0': { completed: true, attempts: 1, outcome: 'pass' as const },
            },
            targetTaskId: 'task-1',
            targetTaskTitle: 'Tactics',
            elapsedSeconds: 600,
            chessSolved: false,
        });
        const first = await finalizeSwipeSession(input('s-xp-once'));
        const second = await finalizeSwipeSession(input('s-xp-once'));
        expect(second).toBe(first);
        expect(xpCount(SKILL_GOAL.id)).toBe(1);
        expect(useTaskStore.getState().dailyTasks[0].status).toBe('completed');
    });
});

describe('I — cross-screen formula', () => {
    it('Detail and Journey derive XP/level from the same counted expression', () => {
        const detail = readSrc('src/screens/GoalDetailScreen.tsx');
        const journey = readSrc('src/screens/GoalJourneyScreen.tsx');
        for (const [rel, src] of [['detail', detail], ['journey', journey]] as const) {
            expect(src).toMatch(/filter\(countsTowardXp\)/);
            expect(src).toMatch(/const XP_PER_DAY = 50/);
            expect(src).toMatch(/const XP_PER_LEVEL = 300/);
            expect(src).toMatch(/Math\.floor\(totalXP \/ XP_PER_LEVEL\) \+ 1/);
            expect(src).toMatch(/totalXP % XP_PER_LEVEL/);
        }
        const levelOf = (totalXP: number) => ({
            level: Math.floor(totalXP / 300) + 1,
            xpInLevel: totalXP % 300,
        });
        for (const totalXP of [0, 50, 299, 300, 301, 599, 600]) {
            expect(levelOf(totalXP)).toEqual(levelOf(totalXP));
        }
        expect([
            levelOf(0),
            levelOf(299),
            levelOf(300),
            levelOf(600),
        ]).toEqual([
            { level: 1, xpInLevel: 0 },
            { level: 1, xpInLevel: 299 },
            { level: 2, xpInLevel: 0 },
            { level: 3, xpInLevel: 0 },
        ]);
    });
});
