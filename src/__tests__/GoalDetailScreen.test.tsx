import '@testing-library/jest-native/extend-expect';
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { useGoalStore } from '../store/goalStore';
import { GoalDefinition, DailyGoalContent } from '../types/goals';
import asyncStorageMock from './__mocks__/asyncStorage';

// Mock aiService so generatePlanOfAttack doesn't make real fetch calls in jsdom
jest.mock('../services/ai', () => ({
    aiService: {
        proposeMetrics: jest.fn().mockResolvedValue([]),
        breakDownMilestones: jest.fn().mockResolvedValue([]),
        generatePlanOfAttack: jest
            .fn()
            .mockResolvedValue({ summary: 'Mock plan', steps: [] }),
        decomposeDailyAction: jest.fn().mockResolvedValue('Mock action'),
        sendMessage: jest.fn().mockResolvedValue('Mock response'),
        recommendToolsForBottleneck: jest.fn().mockResolvedValue([]),
        generateDailyCoaching: jest.fn().mockResolvedValue(''),
        getHobbyRecommendations: jest.fn().mockResolvedValue([]),
        generateDailyTasks: jest.fn().mockResolvedValue([]),
        getContentRecommendations: jest.fn().mockResolvedValue([]),
        getPersonalizedEarningIdeas: jest.fn().mockResolvedValue([]),
        generateWeeklyPlan: jest.fn().mockResolvedValue([]),
        generateSubstituteContent: jest.fn().mockResolvedValue({ type: 'reminder', message: '', action: '' }),
        analyzeUserProfile: jest.fn().mockResolvedValue({
            personality_type: 'Analyst',
            temperament: 'Balanced',
            motivation_style: 'Soft',
            strengths: [],
            growth_areas: [],
        }),
        gradeAnswer: jest.fn().mockResolvedValue('{}'),
    },
    default: {
        proposeMetrics: jest.fn().mockResolvedValue([]),
        breakDownMilestones: jest.fn().mockResolvedValue([]),
        generatePlanOfAttack: jest
            .fn()
            .mockResolvedValue({ summary: 'Mock plan', steps: [] }),
    },
}));

const mockGoal: GoalDefinition = {
    id: 'test-goal-1',
    hobby: 'coding' as any,
    type: 'execution_count',
    category: 'execution',
    description: 'Build a full-stack app',
    target: 100,
    startingValue: 0,
    deadline: '2026-12-31',
    status: 'active',
    unitLabel: 'commits',
    startDate: '2026-01-01',
};

const today = new Date().toISOString().split('T')[0];

const mockContent: DailyGoalContent = {
    goalId: 'test-goal-1',
    date: today,
    mode: 'tactical',
    isFallback: false,
    learn: {
        title: 'Plan your architecture',
        body: 'Start by sketching out the data model. Choose your tech stack. Set up the folder structure.',
    },
    doNow: {
        title: 'Initialize the project',
        instructions: 'Create the repo. Install dependencies. Wire up the database.',
        estimatedMinutes: 20,
    },
    focusReason: 'You are building momentum — keep the streak alive.',
};

function seedStore() {
    useGoalStore.getState().setGoal({ ...mockGoal });
    useGoalStore.getState().recordCheckin(10, 'Started working on the app', undefined, 'coding' as any);

    const snap = useGoalStore.getState().getSnapshotById(mockGoal.id);
    if (snap) {
        snap.progress.dailyContent = { [today]: mockContent };
        snap.progress.streak = 5;
        snap.progress.history = Array.from({ length: 7 }, (_, i) => ({
            date: new Date(Date.now() - i * 86400000).toISOString().split('T')[0],
            value: i * 10,
            description: 'Daily progress',
        }));
        // Attach a plan so the progress strip renders
        snap.progress.planOfAttack = {
            goalId: mockGoal.id,
            generatedAt: new Date().toISOString(),
            source: 'heuristic',
            summary: '40-step plan',
            steps: Array.from({ length: 40 }, (_, i) => ({
                index: i,
                day: i + 1,
                label: `Step ${i + 1}`,
                detail: `Do step ${i + 1}`,
                estimatedMinutes: 20,
            })),
            currentStepIndex: 0,
        };
    }
}

describe('GoalDetailScreen – coaching message layout', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        seedStore();
    });

    it('renders the goal description in the coach bubble', async () => {
        const screen = await render(React.createElement(require('../screens/GoalDetailScreen').default));
        expect(screen.getByText('Build a full-stack app')).toBeTruthy();
    });

    it('renders the focus reason inside the coach bubble', async () => {
        const screen = await render(React.createElement(require('../screens/GoalDetailScreen').default));
        expect(screen.getByText('You are building momentum — keep the streak alive.')).toBeTruthy();
    });

    it('renders the learn section without a label', async () => {
        const screen = await render(React.createElement(require('../screens/GoalDetailScreen').default));
        expect(screen.queryByText('Learn')).toBeNull();
        expect(screen.getByText('Plan your architecture')).toBeTruthy();
        expect(screen.getByText('• Start by sketching out the data model.')).toBeTruthy();
        expect(screen.getByText('• Choose your tech stack.')).toBeTruthy();
        expect(screen.getByText('• Set up the folder structure.')).toBeTruthy();
    });

    it('renders the practice section without a label', async () => {
        const screen = await render(React.createElement(require('../screens/GoalDetailScreen').default));
        expect(screen.queryByText('Practice')).toBeNull();
        expect(screen.getByText('Initialize the project')).toBeTruthy();
        expect(screen.getByText('Create the repo')).toBeTruthy();
        expect(screen.getByText('Install dependencies')).toBeTruthy();
        expect(screen.getByText('Wire up the database')).toBeTruthy();
    });

    it('shows the Done button disabled when no steps checked', async () => {
        const screen = await render(React.createElement(require('../screens/GoalDetailScreen').default));
        expect(screen.getByText('Check off each step above')).toBeTruthy();
    });

    it('enables Done after checking all steps, then shows completion', async () => {
        const screen = await render(React.createElement(require('../screens/GoalDetailScreen').default));

        const steps = ['Create the repo', 'Install dependencies', 'Wire up the database'];
        for (const stepText of steps) {
            const step = screen.getByText(stepText);
            await fireEvent.press(step);
        }

        expect(screen.getByText("✓ Done — I'm finished")).toBeTruthy();

        await fireEvent.press(screen.getByText("✓ Done — I'm finished"));

        expect(screen.getByText("Today's work done.")).toBeTruthy();
        expect(screen.getByText('You learned + practiced. One more day closer to your goal.')).toBeTruthy();
        expect(screen.getByText('🔥5')).toBeTruthy();
    });

    it('shows day count and percentage in the header', async () => {
        const screen = await render(React.createElement(require('../screens/GoalDetailScreen').default));
        expect(screen.getByText('Day 7 · 10%')).toBeTruthy();
    });

    it('renders step progress strip (no label)', async () => {
        const screen = await render(React.createElement(require('../screens/GoalDetailScreen').default));
        expect(screen.queryByText('Plan progress')).toBeNull();
    });

    it('renders quick reply chips', async () => {
        const screen = await render(React.createElement(require('../screens/GoalDetailScreen').default));
        expect(screen.getByText('✓ Done')).toBeTruthy();
        expect(screen.getByText('⚡ Too much')).toBeTruthy();
        expect(screen.getByText('🔄 Give me another')).toBeTruthy();
        expect(screen.getByText('🔍 Research')).toBeTruthy();
    });

    it('shows agent tool buttons for coding hobby', async () => {
        const screen = await render(React.createElement(require('../screens/GoalDetailScreen').default));
        // coding hobby should show "Open code-runner" or "Start 15-min timer"
        expect(screen.getByText('Start 15-min timer')).toBeTruthy();
        expect(screen.getByText('Open code-runner')).toBeTruthy();
    });
});

describe('GoalDetailScreen – edge states', () => {
    beforeEach(async () => {
        await asyncStorageMock.clear();
        useGoalStore.setState({ goals: {}, progress: {}, goalByHobby: {}, executionGoalByHobby: {} });
        jest.clearAllMocks();
    });

    it('shows "Goal not found" when no goal is set', async () => {
        const screen = await render(React.createElement(require('../screens/GoalDetailScreen').default));
        expect(screen.getByText('Goal not found')).toBeTruthy();
    });

    it('shows completed state', async () => {
        useGoalStore.getState().setGoal({ ...mockGoal, status: 'completed' });
        useGoalStore.getState().recordCheckin(100, 'Finished!', undefined, 'coding' as any);
        const screen = await render(React.createElement(require('../screens/GoalDetailScreen').default));
        expect(screen.getByText('100/100 commits')).toBeTruthy();
    });

    it('shows paused state with resume button', async () => {
        useGoalStore.getState().setGoal({ ...mockGoal, status: 'paused' });
        const screen = await render(React.createElement(require('../screens/GoalDetailScreen').default));
        expect(screen.getByText('Resume')).toBeTruthy();
    });
});
