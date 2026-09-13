import '@testing-library/jest-native/extend-expect';
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { CoachActionBar, CoachActionModel } from '../components/coach/CoachActionBar';

function modelWithPrimary(): { model: CoachActionModel; onPrimary: jest.Mock } {
    const onPrimary = jest.fn();
    return {
        onPrimary,
        model: {
            primary: { label: 'Start session', icon: '▶️', onPress: onPrimary },
            secondaries: [
                { id: 'plan', label: "Today's plan", icon: '📋', onPress: jest.fn() },
                { id: 'ask', label: 'Ask me', icon: '💬', onPress: jest.fn() },
            ],
        },
    };
}

describe('CoachActionBar — exactly one primary next action (Phase 1, cases 21-22)', () => {
    it('21. renders exactly one primary CTA when a canonical action exists', async () => {
        const { model } = modelWithPrimary();
        const screen = await render(<CoachActionBar model={model} />);
        expect(screen.getAllByTestId('coach-primary-action')).toHaveLength(1);
        expect(screen.getByText('▶️ Start session')).toBeTruthy();
    });

    it('renders no primary CTA when the journey owns it (no competing action)', async () => {
        const screen = await render(
            <CoachActionBar
                model={{
                    primary: null,
                    secondaries: [{ id: 'plan', label: "Today's plan", icon: '📋', onPress: jest.fn() }],
                }}
            />,
        );
        expect(screen.queryByTestId('coach-primary-action')).toBeNull();
        expect(screen.getAllByTestId('coach-secondary-action')).toHaveLength(1);
    });

    it('22. secondary information never carries a competing session action', async () => {
        const onPlan = jest.fn();
        const onAsk = jest.fn();
        const screen = await render(
            <CoachActionBar
                model={{
                    primary: { label: 'Practice Rules', icon: '▶️', onPress: jest.fn() },
                    secondaries: [
                        { id: 'plan', label: "Today's plan", icon: '📋', onPress: onPlan },
                        { id: 'ask', label: 'Ask me', icon: '💬', onPress: onAsk },
                    ],
                }}
            />,
        );
        // Secondaries navigate to info / input only — pressing them must not
        // start a session (their handlers are the info ones we passed).
        await fireEvent.press(screen.getByText('📋 Today\'s plan'));
        expect(onPlan).toHaveBeenCalledTimes(1);
        await fireEvent.press(screen.getByText('💬 Ask me'));
        expect(onAsk).toHaveBeenCalledTimes(1);
        expect(screen.getAllByTestId('coach-primary-action')).toHaveLength(1);
    });

    it('pressing the primary fires exactly the canonical handler', async () => {
        const { model, onPrimary } = modelWithPrimary();
        const screen = await render(<CoachActionBar model={model} />);
        await fireEvent.press(screen.getByTestId('coach-primary-action'));
        expect(onPrimary).toHaveBeenCalledTimes(1);
    });
});
