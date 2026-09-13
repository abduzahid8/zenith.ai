import '@testing-library/jest-native/extend-expect';
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { useGoalStore } from '../store/goalStore';
import asyncStorageMock from './__mocks__/asyncStorage';

// ─── Mocks ───────────────────────────────────────────────
// Same ai surface as GoalDetailScreen.test so daily-content generation
// resolves through its sync fallback path (no network in jsdom).
jest.mock('../services/ai', () => ({
    aiService: {
        proposeMetrics: jest.fn().mockResolvedValue([]),
        breakDownMilestones: jest.fn().mockResolvedValue([]),
        generatePlanOfAttack: jest.fn().mockResolvedValue({ summary: 'Mock plan', steps: [] }),
        decomposeDailyAction: jest.fn().mockResolvedValue('Mock action'),
        sendMessage: jest.fn().mockResolvedValue('Mock response'),
        recommendToolsForBottleneck: jest.fn().mockResolvedValue([]),
        generateDailyCoaching: jest.fn().mockResolvedValue(''),
        generateDailyContent: jest.fn().mockResolvedValue(null),
        getHobbyRecommendations: jest.fn().mockResolvedValue([]),
        generateDailyTasks: jest.fn().mockResolvedValue([]),
        getContentRecommendations: jest.fn().mockResolvedValue([]),
        getPersonalizedEarningIdeas: jest.fn().mockResolvedValue([]),
        generateWeeklyPlan: jest.fn().mockResolvedValue([]),
        generateSubstituteContent: jest.fn().mockResolvedValue({ type: 'reminder', message: '', action: '' }),
        analyzeUserProfile: jest.fn().mockResolvedValue({}),
        gradeAnswer: jest.fn().mockResolvedValue('{}'),
    },
    default: { sendMessage: jest.fn().mockResolvedValue('Mock response') },
}));
jest.mock('../services/agentOrchestrator', () => ({
    // NOTE: assets must be non-empty — the screen re-orchestrates until a
    // stored plan has both steps AND assets (production always builds
    // assets; an empty mock would spin the effect forever).
    orchestrateDailyPlan: jest.fn().mockResolvedValue({
        steps: [
            { step: 1, title: 'Warm up', description: 'Easy tactics', duration: '5 min', type: 'practice', assetRefs: ['a1'] },
        ],
        assets: [
            { id: 'a1', type: 'summary', title: 'Warm-up brief', description: 'Brief', action: 'Start', supportsStep: 1 },
        ],
    }),
}));
jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn(() => ({})) }));
jest.mock('react-native-url-polyfill/auto', () => ({}), { virtual: true });
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
// Extend the mapped mock rather than replacing it.
jest.mock('react-native', () => {
    const actual = jest.requireActual('./__mocks__/reactNativeComponent') as any;
    const RN = actual.default ?? actual;
    return {
        ...RN,
        LayoutAnimation: {
            configureNext: jest.fn(),
            create: jest.fn(),
            Presets: { easeInEaseOut: 'easeInEaseOut', linear: 'linear', spring: 'spring' },
        },
        Linking: { ...(RN.Linking ?? {}), openURL: jest.fn() },
        UIManager: { ...((RN as any).UIManager ?? {}), setLayoutAnimationEnabledExperimental: jest.fn() },
    };
});
jest.mock('react-native-svg', () => {
    const React = require('react');
    const mk = (name: string) => (props: any) =>
        React.createElement('View', { ...props, 'data-svg': name }, props.children);
    return {
        __esModule: true,
        default: 'SvgMock',
        Svg: mk('Svg'),
        Circle: mk('Circle'),
        Path: mk('Path'),
        Defs: mk('Defs'),
        LinearGradient: mk('LinearGradient'),
        Stop: mk('Stop'),
        Polyline: mk('Polyline'),
        Line: mk('Line'),
        Polygon: mk('Polygon'),
        G: mk('G'),
    };
});

const mockGoal: any = {
    id: 'test-goal-1',
    hobby: 'chess',
    type: 'execution_count',
    category: 'skill',
    description: 'Master chess tactics',
    target: 500,
    startingValue: 400,
    difficultyScore: 400,
    targetDifficulty: 500,
    deadline: '2026-12-31',
    status: 'active',
    unitLabel: 'pts',
    startDate: '2026-01-01',
};

const COLORS: any = {
    surface: '#fff',
    surfaceLight: '#f5f5f5',
    buttonPrimary: '#102852',
    accent: '#059669',
    text: '#000',
    textSecondary: '#666',
    border: '#eee',
};

const today = new Date().toISOString().split('T')[0];

function seedSkillGoal() {
    useGoalStore.getState().setGoal({ ...mockGoal });
}

function baseline() {
    const snap = useGoalStore.getState().getSnapshotById(mockGoal.id)!;
    return {
        historyLen: snap.progress.history.length,
        difficulty: snap.progress.currentDifficulty,
        completedAt: snap.progress.dailyContent?.[today]?.completedAt,
    };
}

// ─── 1-3. DailyGoalCard containment ───────────────────────
describe('Follow-up — DailyGoalCard tap paths are acknowledgement-only', () => {
    beforeEach(async () => {
        await asyncStorageMock.clear();
        useGoalStore.setState({ goals: {}, progress: {}, goalByHobby: {}, executionGoalByHobby: {} });
        jest.clearAllMocks();
        seedSkillGoal();
    });

    it('1. Done does not write validated progress (history/difficulty/store completion untouched)', async () => {
        const { DailyGoalCard } = require('../components/goal/DailyGoalCard');
        const snap = useGoalStore.getState().getSnapshot('chess' as any)!;
        const before = baseline();
        const screen = await render(<DailyGoalCard snapshot={snap} colors={COLORS} />);
        await screen.findByText('Skip');
        await fireEvent.press(screen.getByText('Done'));
        const after = baseline();
        expect(after.historyLen).toBe(before.historyLen);
        expect(after.difficulty).toBe(before.difficulty);
        expect(after.completedAt).toBeUndefined();
        // Acknowledgement flow preserved: rating UI appears.
        expect(await screen.findByText('Tricky')).toBeTruthy();
    });

    it('2. Skip dismisses without marking learning completed', async () => {
        const { DailyGoalCard } = require('../components/goal/DailyGoalCard');
        const snap = useGoalStore.getState().getSnapshot('chess' as any)!;
        const before = baseline();
        const screen = await render(<DailyGoalCard snapshot={snap} colors={COLORS} />);
        await screen.findByText('Skip');
        await fireEvent.press(screen.getByText('Skip'));
        const after = baseline();
        expect(after.historyLen).toBe(before.historyLen);
        expect(after.difficulty).toBe(before.difficulty);
        expect(after.completedAt).toBeUndefined();
        // Card dismisses to its done state (local acknowledgement).
        expect(await screen.findByText('✓')).toBeTruthy();
    });

    it('3. Rating is an input signal — no difficulty/progress write', async () => {
        const { DailyGoalCard } = require('../components/goal/DailyGoalCard');
        const snap = useGoalStore.getState().getSnapshot('chess' as any)!;
        const before = baseline();
        const screen = await render(<DailyGoalCard snapshot={snap} colors={COLORS} />);
        await screen.findByText('Skip');
        await fireEvent.press(screen.getByText('Done'));
        await screen.findByText('Tricky');
        await fireEvent.press(screen.getByText('Tricky'));
        const after = baseline();
        expect(after.historyLen).toBe(before.historyLen);
        expect(after.difficulty).toBe(before.difficulty);
        expect(after.completedAt).toBeUndefined();
    });
});

// ─── 4-5. GoalJourneyScreen containment ───────────────────
describe('Follow-up — GoalJourneyScreen tap paths are acknowledgement-only', () => {
    beforeEach(async () => {
        await asyncStorageMock.clear();
        useGoalStore.setState({ goals: {}, progress: {}, goalByHobby: {}, executionGoalByHobby: {} });
        jest.clearAllMocks();
        seedSkillGoal();
    });

    it('4. Review "Mark Day Complete" does not advance validated progress', async () => {
        const { default: GoalJourneyScreen } = require('../screens/GoalJourneyScreen');
        const before = baseline();
        const screen = await render(<GoalJourneyScreen />);
        const btn = await screen.findByText('✓ Mark Day Complete');
        await fireEvent.press(btn);
        const after = baseline();
        expect(after.historyLen).toBe(before.historyLen);
        expect(after.difficulty).toBe(before.difficulty);
        expect(after.completedAt).toBeUndefined();
    });

    it('5. SessionOverlay "Mark Day Complete" does not advance validated progress', async () => {
        // Two local steps: the overlay only offers its own completion CTA
        // after its local checklist is done (single-step plans complete
        // straight into the parent callback instead).
        const { orchestrateDailyPlan } = require('../services/agentOrchestrator');
        (orchestrateDailyPlan as jest.Mock).mockResolvedValueOnce({
            steps: [
                { step: 1, title: 'Warm up', description: 'Easy tactics', duration: '5 min', type: 'practice', assetRefs: ['a1'] },
                { step: 2, title: 'Cool down', description: 'Review lines', duration: '5 min', type: 'review', assetRefs: ['a1'] },
            ],
            assets: [
                { id: 'a1', type: 'summary', title: 'Session brief', description: 'Brief', action: 'Start', supportsStep: 1 },
            ],
        });
        const { default: GoalJourneyScreen } = require('../screens/GoalJourneyScreen');
        const before = baseline();
        const screen = await render(<GoalJourneyScreen />);
        // Open the overlay via the plan page's session entry and walk its
        // two local steps. Completing the last local step fires the
        // parent onCompleteAll directly (the overlay's own completion view
        // is unreachable by construction) — the bypass under test.
        const starters = await screen.findAllByText(/Start session/i);
        expect(starters.length).toBeGreaterThan(0);
        await fireEvent.press(starters[0]);
        await screen.findByText('Mark Done & Continue →');
        await fireEvent.press(screen.getByText('Mark Done & Continue →'));
        await screen.findByText('Complete Step →');
        await fireEvent.press(screen.getByText('Complete Step →'));
        // Acknowledgement preserved: the celebration renders…
        expect(await screen.findByText('Day 1 Complete')).toBeTruthy();
        // …but no validated progress moved.
        const after = baseline();
        expect(after.historyLen).toBe(before.historyLen);
        expect(after.difficulty).toBe(before.difficulty);
        expect(after.completedAt).toBeUndefined();
    });
});

// ─── 7. GoalDetail did_it unchanged ───────────────────────
describe('Follow-up — GoalDetail did_it containment still holds', () => {
    const mockContent: any = {
        goalId: 'test-goal-1',
        date: today,
        mode: 'tactical',
        isFallback: false,
        learn: { title: 'Tactics intro', body: 'Learn forks. Practice pins.' },
        doNow: { title: 'Solve drills', instructions: 'Solve one. Review it.', estimatedMinutes: 15 },
        focusReason: 'Keep showing up — consistency compounds.',
    };

    beforeEach(async () => {
        await asyncStorageMock.clear();
        useGoalStore.setState({ goals: {}, progress: {}, goalByHobby: {}, executionGoalByHobby: {} });
        jest.clearAllMocks();
        seedSkillGoal();
        const snap = useGoalStore.getState().getSnapshotById(mockGoal.id);
        if (snap) {
            snap.progress.dailyContent = { [today]: mockContent };
            snap.progress.history = Array.from({ length: 3 }, (_, i) => ({
                date: new Date(Date.now() - i * 86400000).toISOString().split('T')[0],
                value: 1,
                description: 'Daily progress',
            }));
        }
    });

    it('7. did_it acknowledges without writing validated progress', async () => {
        const { default: GoalDetailScreen } = require('../screens/GoalDetailScreen');
        const before = baseline();
        const screen = await render(<GoalDetailScreen />);
        await screen.findByText('✓ Complete');
        await fireEvent.press(screen.getByText('✓ Complete'));
        const after = baseline();
        expect(after.historyLen).toBe(before.historyLen);
        expect(after.difficulty).toBe(before.difficulty);
        expect(after.completedAt).toBeUndefined();
    });
});

// ─── 6/8/9. Canonical path + semantics + idempotency ──────
describe('Follow-up — canonical completion still works, semantics unchanged', () => {
    it('8. failed/unknown/discovery/bites still never advance the frontier', () => {
        const { buildProgressionDecision } = require('../domain/sessions/progressionPolicy');
        const { evaluateSession } = require('../domain/sessions/outcomePolicy');
        const full = { countsAsFullCompletion: true, requiresValidation: false };
        const cards = [
            { id: 'r1', type: 'recall', required: true },
            { id: 'a1', type: 'apply', required: true },
        ];
        const pass = { r1: { completed: true, outcome: 'pass', attempts: 1 }, a1: { completed: true, outcome: 'pass', attempts: 1 } };
        expect(evaluateSession(cards, pass)).toBe('pass');
        const failed = buildProgressionDecision({
            kind: 'structured', evaluation: 'fail', blueprint: full, hasTargetTask: true, scope: 'curriculum',
        });
        expect(failed.advanceCurriculum).toBe(false);
        expect(failed.completeDailyTask).toBe(false);
        const unknown = buildProgressionDecision({
            kind: 'structured', evaluation: 'non_rewarding', blueprint: full, hasTargetTask: true, scope: 'curriculum',
        });
        expect(unknown).toEqual({ completeDailyTask: false, advanceCurriculum: false, countSession: false, goalSignal: null });
        const discovery = buildProgressionDecision({
            kind: 'discovery', evaluation: 'pass', blueprint: full, hasTargetTask: false, scope: 'none',
        });
        expect(discovery.advanceCurriculum).toBe(false);
        expect(discovery.countSession).toBe(false);
        const bite = buildProgressionDecision({
            kind: 'certificate_review', evaluation: 'pass',
            blueprint: { countsAsFullCompletion: false, requiresValidation: false },
            hasTargetTask: false, scope: 'none',
        });
        expect(bite.advanceCurriculum).toBe(false);
        expect(bite.completeDailyTask).toBe(false);
    });

    it('6. canonical finalizer still advances exactly once on valid completion', async () => {
        const { finalizeSwipeSession, __resetFinalizerForTests } = require('../services/sessionFinalizer');
        const { __resetLearningEventsForTests, learningEventCount } = require('../services/learningEventRepository');
        __resetFinalizerForTests();
        __resetLearningEventsForTests();
        const lesson = { hobby: 'chess', id: 'chess_d1', day: 1, learn: { title: 'Basics' } };
        const cards = [
            { id: 'r1', type: 'recall', required: true },
            { id: 'a1', type: 'apply', required: true },
        ];
        const status = {
            r1: { completed: true, outcome: 'pass', attempts: 1 },
            a1: { completed: true, outcome: 'pass', attempts: 1 },
        };
        const input = {
            sessionId: 'followup-once', hobby: 'chess', lesson,
            kind: 'structured', origin: 'home_start', scope: 'curriculum',
            blueprint: { countsAsFullCompletion: true, requiresValidation: false },
            cards, status, elapsedSeconds: 600, chessSolved: false,
        };
        const first = await finalizeSwipeSession(input);
        expect(first.decision.advanceCurriculum).toBe(true);
        const count = learningEventCount();
        expect(await finalizeSwipeSession(input)).toBe(first);
        expect(learningEventCount()).toBe(count);
    });

    it('9. duplicate events never double-reward', () => {
        const { appendLearningEvent, __resetLearningEventsForTests } = require('../services/learningEventRepository');
        const { buildTaskCompletedEvent } = require('../domain/sessions/learningEvents');
        __resetLearningEventsForTests();
        const event = buildTaskCompletedEvent({
            sessionId: 'followup-dup', hobbyId: 'chess', lessonId: 'chess_d1',
            lessonDay: 1, taskId: 't9', sessionKind: 'structured',
            origin: 'home_start', scope: 'curriculum', outcome: 'pass',
        });
        expect(appendLearningEvent(event)).toBe(true);
        expect(appendLearningEvent({ ...event })).toBe(false);
    });
});
