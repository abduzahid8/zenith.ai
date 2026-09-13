/**
 * Goal Progress truth — card rendering (RNTL v14 async).
 *
 * GoalProgressBar (used unchanged by Home, Your Day, Coach, legacy
 * coach) must render the canonical snapshot.percentComplete — including
 * the starting-value offset — and never recompute current/target itself.
 * Seeded state: target 100, startingValue 20, currentValue 60 →
 * canonical 50%. The old duplicate rendered 60%.
 */
import '@testing-library/jest-native/extend-expect';
import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { useGoalStore } from '../store/goalStore';
import GoalProgressBar from '../components/goal/GoalProgressBar';
import type { GoalDefinition } from '../types/goals';

jest.mock('../theme/useAppTheme', () => ({
    useAppTheme: () => ({
        colors: { text: '#000', surface: '#fff', surfaceLight: '#eee' },
    }),
}));
jest.mock('../hooks/useGoalCardState', () => ({
    useGoalCardState: () => ({ liveProgress: null }),
}));

const GOAL = {
    id: 'goal-card-truth',
    hobby: 'chess',
    type: 'execution_count',
    category: 'execution',
    description: 'Become better at Chess',
    target: 100,
    startingValue: 20,
    deadline: '2026-12-31',
    startDate: '2026-09-01',
    status: 'active',
    unitLabel: 'games',
} as GoalDefinition;

beforeEach(() => {
    useGoalStore.setState({ goals: {}, progress: {}, goalByHobby: {}, executionGoalByHobby: {} });
    useGoalStore.setState(state => ({
        goals: { ...state.goals, [GOAL.id]: { ...GOAL } },
        progress: {
            ...state.progress,
            [GOAL.id]: {
                goalId: GOAL.id,
                currentValue: 60,
                lastUpdated: '2026-09-01',
                dailyActions: 1,
                streak: 1,
                history: [],
                currentMode: 'milestone',
                milestones: [],
                currentMilestoneIndex: 0,
            },
        },
        executionGoalByHobby: { ...state.executionGoalByHobby, chess: GOAL.id },
    }));
});

describe('GoalProgressBar canonical percent', () => {
    it('renders snapshot.percentComplete (50%), not naive current/target (60%)', async () => {
        const snapshot = useGoalStore.getState().getSnapshot('chess' as any);
        expect(snapshot?.percentComplete).toBe(50);
        const screen = await render(<GoalProgressBar snapshot={snapshot!} />);
        await waitFor(() => {
            expect(screen.getByText('📊 50%')).toBeTruthy();
        });
        expect(screen.queryByText('📊 60%')).toBeNull();
    });
});
