/**
 * Goal Progress truth unification — regression contracts.
 *
 * Canonical rule: ONE Goal Progress authority → goalStore snapshot
 * (GoalSnapshot.percentComplete, handler math WITH the starting-value
 * offset). All surfaces presenting "Goal Progress / how close am I to my
 * goal" must derive from it. Goal Progress stays separate from Learning
 * Progress: task completion and learning events must not force it, and
 * goal check-ins must not create learning evidence.
 */
import * as fs from 'fs';
import * as path from 'path';
import { useGoalStore } from '../store/goalStore';
import { useTaskStore } from '../store/taskStore';
import {
    __resetLearningEventsForTests,
    appendLearningEvent,
    learningEventCount,
} from '../services/learningEventRepository';
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

const ANCHOR = '2026-09-01';
const day = (offset: number) => {
    const d = new Date(ANCHOR);
    d.setDate(d.getDate() + offset);
    return d.toISOString().split('T')[0];
};

const EXEC_GOAL: GoalDefinition = {
    id: 'goal-chess-exec',
    hobby: 'chess' as any,
    type: 'execution_count',
    category: 'execution',
    description: 'Become better at Chess',
    target: 100,
    startingValue: 20,
    deadline: day(60),
    startDate: ANCHOR,
    status: 'active',
    unitLabel: 'games',
} as GoalDefinition;

const SKILL_GOAL: GoalDefinition = {
    id: 'goal-chess-skill',
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

function seedGoal(goal: GoalDefinition, currentValue: number, extraProgress: any = {}) {
    useGoalStore.setState(state => ({
        goals: { ...state.goals, [goal.id]: { ...goal } },
        progress: {
            ...state.progress,
            [goal.id]: {
                goalId: goal.id,
                currentValue,
                lastUpdated: ANCHOR,
                dailyActions: 1,
                streak: 1,
                history: [{ date: ANCHOR, value: currentValue, description: 'seed', type: 'checkin' }],
                currentMode: 'milestone',
                milestones: [],
                currentMilestoneIndex: 0,
                ...extraProgress,
            },
        },
        executionGoalByHobby:
            goal.category === 'execution'
                ? { ...state.executionGoalByHobby, [goal.hobby]: goal.id }
                : state.executionGoalByHobby,
        goalByHobby:
            goal.category === 'skill'
                ? { ...state.goalByHobby, [goal.hobby]: goal.id }
                : state.goalByHobby,
    }));
}

function seedTask(id: string, status = 'pending') {
    useTaskStore.setState({
        dailyTasks: [
            {
                id,
                user_id: 'u',
                title: 'Tactics set',
                type: 'practice',
                status,
                scheduled_date: ANCHOR,
                hobby_id: 'chess',
                duration_minutes: 15,
            } as any,
        ],
        lastFetchDate: ANCHOR,
    } as any);
}

beforeEach(() => {
    useGoalStore.setState({ goals: {}, progress: {}, goalByHobby: {}, executionGoalByHobby: {} });
    useTaskStore.setState({ dailyTasks: [], lastFetchDate: null } as any);
    __resetLearningEventsForTests();
    jest.clearAllMocks();
});

describe('canonical authority (scenarios: one goal, one percentage)', () => {
    it('1. execution snapshot honors the starting-value offset', () => {
        // covered = 60-20 = 40 of 80 → 50%. The old duplicate showed 60/100 = 60%.
        seedGoal(EXEC_GOAL, 60);
        expect(useGoalStore.getState().getSnapshot('chess' as any)?.percentComplete).toBe(50);
    });

    it('1. skill snapshot honors the difficulty offset', () => {
        // covered = 800-400 = 400 of 800 → 50%. The old duplicate showed 800/1200 = 67%.
        seedGoal(SKILL_GOAL, 0, { currentDifficulty: 800 });
        expect(useGoalStore.getState().getSnapshot('chess' as any)?.percentComplete).toBe(50);
    });

    it('2. snapshot percent is authoritative and derived (never a stored cache)', () => {
        seedGoal(EXEC_GOAL, 60);
        const record = useGoalStore.getState().progress[EXEC_GOAL.id] as any;
        expect(record).not.toHaveProperty('percentComplete');
        expect(useGoalStore.getState().getSnapshot('chess' as any)?.percentComplete).toBe(50);
        expect(useGoalStore.getState().getSnapshotById(EXEC_GOAL.id)?.percentComplete).toBe(50);
    });

    it('1+2. all Goal Progress consumers derive from the snapshot (no duplicate formula)', () => {
        for (const rel of [
            'src/components/goal/GoalProgressBar.tsx',
            'src/screens/GoalDetailScreen.tsx',
            'src/screens/GoalJourneyScreen.tsx',
        ]) {
            const src = readSrc(rel);
            expect(src).toMatch(/snapshot\.percentComplete/);
            // The old duplicate divided raw current by raw target, ignoring offsets.
            expect(src).not.toMatch(/currentVal \/ Math\.max\(1, targetVal\)/);
        }
        // Weekly Plan already used the canonical value — still does.
        expect(readSrc('src/screens/tabs/WeeklyPlanTab.tsx')).toMatch(/\.percentComplete/);
    });
});

describe('Goal vs Learning boundary (scenarios 3, 4, 5)', () => {
    it('3. DailyPlan task completion does not force Goal Progress', async () => {
        seedGoal(EXEC_GOAL, 60);
        seedTask('task-t1');
        await useTaskStore.getState().completeTask('u', 'task-t1');
        expect(useTaskStore.getState().dailyTasks[0].status).toBe('completed');
        expect(useGoalStore.getState().getSnapshot('chess' as any)?.percentComplete).toBe(50);
    });

    it('4. goal check-in creates no learning evidence', () => {
        seedGoal(EXEC_GOAL, 20);
        const before = learningEventCount();
        useGoalStore.getState().recordCheckin(60, 'Played ten games', undefined, 'chess' as any);
        expect(learningEventCount()).toBe(before);
        // …but the check-in itself moves Goal Progress through goal semantics.
        expect(useGoalStore.getState().getSnapshot('chess' as any)?.percentComplete).toBe(50);
    });

    it('5. validated learning events do not bypass goal semantics', () => {
        seedGoal(EXEC_GOAL, 60);
        appendLearningEvent({
            id: 'sess_1:session_completed:final:1',
            sessionId: 'sess_1',
            ownerId: 'u',
            hobbyId: 'chess',
            programSlug: 'chess-foundations',
            eventType: 'session_completed',
            outcome: 'pass',
            evidenceStrength: 'none',
        } as any);
        expect(learningEventCount()).toBe(1);
        expect(useGoalStore.getState().getSnapshot('chess' as any)?.percentComplete).toBe(50);
    });
});

describe('lifecycle integrity (scenarios 6, 7, 8, 9)', () => {
    it('6. editing a goal preserves intended progress', () => {
        seedGoal(EXEC_GOAL, 60);
        useGoalStore.getState().updateGoal(EXEC_GOAL.id, { description: 'Become much better at Chess' });
        const snap = useGoalStore.getState().getSnapshot('chess' as any);
        expect(snap?.progress.currentValue).toBe(60);
        expect(snap?.percentComplete).toBe(50);
    });

    it('7. a new goal starts fresh and never inherits previous progress', () => {
        seedGoal(EXEC_GOAL, 60);
        useGoalStore.getState().setGoal({ ...EXEC_GOAL, id: 'goal-chess-exec-2' } as any);
        const fresh = useGoalStore.getState().getSnapshotById('goal-chess-exec-2');
        expect(fresh?.progress.currentValue).toBe(EXEC_GOAL.startingValue);
        expect(fresh?.percentComplete).toBe(0);
        // The old record is untouched (orphan cleanup is a separate block).
        expect(useGoalStore.getState().progress[EXEC_GOAL.id].currentValue).toBe(60);
    });

    it('8. pause/resume does not change progress', () => {
        seedGoal(EXEC_GOAL, 60);
        useGoalStore.getState().pauseGoal(EXEC_GOAL.id);
        useGoalStore.getState().resumeGoal(EXEC_GOAL.id);
        const snap = useGoalStore.getState().getSnapshotById(EXEC_GOAL.id);
        expect(snap?.progress.currentValue).toBe(60);
        expect(snap?.percentComplete).toBe(50);
    });

    it('9. reload/hydration preserves the same Goal Progress (derived, not cached)', async () => {
        seedGoal(EXEC_GOAL, 60);
        // Simulate a cold start: serialize persisted slices and restore them.
        const { goals, progress, goalByHobby, executionGoalByHobby } = useGoalStore.getState();
        const rehydrated = JSON.parse(JSON.stringify({ goals, progress, goalByHobby, executionGoalByHobby }));
        useGoalStore.setState({ goals: {}, progress: {}, goalByHobby: {}, executionGoalByHobby: {} });
        useGoalStore.setState(rehydrated);
        expect(useGoalStore.getState().getSnapshot('chess' as any)?.percentComplete).toBe(50);
    });
});

describe('Home freeze (scenario 10)', () => {
    it('10. Home files contain no goal-percentage formula and still use the card', () => {
        const homeTab = readSrc('src/screens/tabs/HomeTab.tsx');
        expect(homeTab).toMatch(/GoalProgressBar/);
        expect(homeTab).not.toMatch(/barPercent|barPct|percentComplete/);
        expect(homeTab).not.toMatch(/currentVal \/ Math\.max/);
        expect(readSrc('src/screens/HomeScreen.tsx')).not.toMatch(
            /barPercent|barPct|percentComplete/,
        );
    });
});
