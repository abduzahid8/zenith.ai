/**
 * Streak truth — session-start inflation fix (regression).
 *
 * Invariant: the global gamification streak advances ONLY on
 * valid/rewarding progression (the policy's own count/advance outcome),
 * never on session mount. updateStreak's date/freeze math is untouched;
 * only WHEN it runs changed.
 *
 * A–E. mount/open/abandon (any kind) → no streak change.
 * F. failed session → no streak change.
 * G. qualifying structured completion → advances exactly once.
 * H. duplicate finalization → advances once.
 * I. two qualifying sessions same day → one streak day.
 * J. freeze consumed only by qualifying progression.
 * K. discovery weightlessness (existing suites, cited in report).
 */
import * as fs from 'fs';
import * as path from 'path';
import { useGamificationStore } from '../store/gamificationStore';
import { useGoalStore } from '../store/goalStore';
import { useTaskStore } from '../store/taskStore';
import { finalizeSwipeSession, __resetFinalizerForTests } from '../services/sessionFinalizer';
import { buildSessionBlueprint } from '../domain/sessions/sessionBlueprint';
import { __resetLearningEventsForTests } from '../services/learningEventRepository';

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

const dayStr = (offsetDays: number): string => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().split('T')[0];
};
const TODAY = () => dayStr(0);

const streakOf = () => useGamificationStore.getState().currentStreak;
const lastActive = () => useGamificationStore.getState().lastActiveDate;

function seedTask() {
    useTaskStore.setState({
        dailyTasks: [
            {
                id: 'task-1',
                user_id: 'u1',
                title: 'Tactics',
                type: 'practice',
                status: 'pending',
                scheduled_date: dayStr(0),
                hobby_id: 'chess',
                duration_minutes: 15,
            } as any,
        ],
        lastFetchDate: dayStr(0),
    } as any);
}

const finalizeInput = (sessionId: string, outcome: 'pass' | 'fail' = 'pass') => ({
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
        'recall-0': { completed: true, attempts: 1, outcome },
        'apply-0': { completed: true, attempts: 1, outcome },
    } as any,
    targetTaskId: 'task-1',
    targetTaskTitle: 'Tactics',
    elapsedSeconds: 600,
    chessSolved: false,
});

beforeEach(() => {
    useGamificationStore.getState().resetGamification();
    useGoalStore.setState({ goals: {}, progress: {}, goalByHobby: {}, executionGoalByHobby: {} });
    useTaskStore.setState({ dailyTasks: [], lastFetchDate: null } as any);
    __resetLearningEventsForTests();
    __resetFinalizerForTests();
    jest.clearAllMocks();
});

describe('A–E — mount/open/abandon never advances the streak', () => {
    it('A. startSession on a new day: checklist resets, streak untouched', () => {
        const g = () => useGamificationStore.getState();
        g().startSession('chess' as any);
        expect(streakOf()).toBe(0);
        expect(lastActive()).toBeNull();
        expect(g().freezeActivatedToday).toBe(false);
        expect(g().weeklyFreezeUsed).toBe(false);
        // Legitimate start-of-session work still happens.
        expect(g().currentSessionHobby).toBe('chess');
        expect(g().dailyChecklist).toEqual({ learn: false, do: false, deepen1: false, deepen2: false });
        expect(g().lastChecklistDate).toBe(TODAY());
        // Repeat opens still change nothing.
        g().startSession('chess' as any);
        expect(streakOf()).toBe(0);
        expect(lastActive()).toBeNull();
    });

    it('B–D. mount path carries no kind-gated streak logic; hook never calls updateStreak', () => {
        // Discovery / bite / quick all mount through the same swipe effect,
        // which has no kind branch: the only gamification call there is
        // startSession (session init), proven neutral above.
        const hook = readSrc('src/hooks/useSwipeSession.ts');
        expect(hook).not.toMatch(/updateStreak/);
        expect(hook).toMatch(/g\.startSession\(hobby\)/);
    });

    it('E. open-then-abandon (mount with no finish) leaves no trace', () => {
        useGamificationStore.getState().startSession('reading' as any);
        expect(streakOf()).toBe(0);
        expect(lastActive()).toBeNull();
        expect(useGamificationStore.getState().weeklyFreezeUsed).toBe(false);
    });

    it('startSession body contains no streak mutation', () => {
        const src = readSrc('src/store/gamificationStore.ts');
        const start = src.indexOf('startSession: (hobby');
        const end = src.indexOf('── markStepComplete ──');
        expect(start).toBeGreaterThan(-1);
        const body = src.slice(start, end);
        // Call syntax only: the explanatory comment names updateStreak to
        // document where it moved, so bare-word matching false-positives.
        expect(body).not.toMatch(/get\(\)\.updateStreak\(\)|g\.updateStreak\(\)/);
    });
});

describe('F–I — progression-gated advancement', () => {
    it('F. failed session advances nothing (streak, date, freeze untouched)', async () => {
        seedTask();
        await finalizeSwipeSession(finalizeInput('s-fail', 'fail'));
        expect(streakOf()).toBe(0);
        expect(lastActive()).toBeNull();
        expect(useGamificationStore.getState().weeklyFreezeUsed).toBe(false);
    });

    it('G. qualifying structured completion advances exactly once', async () => {
        seedTask();
        const res = await finalizeSwipeSession(finalizeInput('s-pass'));
        expect(res.decision.countSession).toBe(true);
        expect(streakOf()).toBe(1);
        expect(lastActive()).toBe(TODAY());
    });

    it('H. duplicate finalization of the same session advances once', async () => {
        seedTask();
        const first = await finalizeSwipeSession(finalizeInput('s-dup'));
        const second = await finalizeSwipeSession(finalizeInput('s-dup'));
        expect(second).toBe(first);
        expect(streakOf()).toBe(1);
        expect(lastActive()).toBe(TODAY());
    });

    it('I. two qualifying sessions on one calendar day count as one streak day', async () => {
        seedTask();
        await finalizeSwipeSession(finalizeInput('s-day-a'));
        await finalizeSwipeSession(finalizeInput('s-day-b'));
        expect(streakOf()).toBe(1);
        expect(lastActive()).toBe(TODAY());
    });
});

describe('J — freeze consumed only by qualifying progression', () => {
    it('mount with a 2-day gap burns nothing; qualifying completion then applies freeze rules', async () => {
        useGamificationStore.setState({
            currentStreak: 5,
            lastActiveDate: dayStr(-2),
            weeklyFreezeUsed: false,
            weeklyFreezeWeekStart: null,
            freezeActivatedToday: false,
        });
        // Merely opening a session today: freeze untouched.
        useGamificationStore.getState().startSession('chess' as any);
        expect(streakOf()).toBe(5);
        expect(useGamificationStore.getState().weeklyFreezeUsed).toBe(false);
        expect(useGamificationStore.getState().freezeActivatedToday).toBe(false);
        // Qualifying progression: existing freeze math runs (gap of exactly
        // one missed day → streak preserved, freeze consumed).
        seedTask();
        await finalizeSwipeSession(finalizeInput('s-freeze'));
        expect(streakOf()).toBe(5);
        expect(useGamificationStore.getState().weeklyFreezeUsed).toBe(true);
        expect(lastActive()).toBe(TODAY());
    });
});

describe('scope guards — other streaks and Home untouched', () => {
    it('no updateStreak/startSession in Home surfaces', () => {
        for (const rel of [
            'src/screens/tabs/HomeTab.tsx',
            'src/screens/HomeScreen.tsx',
            'src/screens/MainTabsScreen.tsx',
        ]) {
            const src = readSrc(rel);
            expect(src).not.toMatch(/updateStreak/);
            expect(src).not.toMatch(/\.startSession\(/);
        }
    });

    it('streak math functions are unchanged (single gated call site in progression)', () => {
        const effects = readSrc('src/services/sessionStepEffects.ts');
        const calls = effects.match(/\.updateStreak\(\)/g) ?? [];
        expect(calls).toHaveLength(1);
        const at = effects.indexOf('.updateStreak()');
        const gate = effects.slice(Math.max(0, at - 600), at);
        expect(gate).toMatch(/decision\.countSession \|\| decision\.advanceCurriculum/);
    });
});
