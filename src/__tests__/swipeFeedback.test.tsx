/**
 * Feedback retry wiring — the support card offers a direct path back to its
 * unresolved proof (no manual backward-swipe knowledge required).
 * Pure props in, real component behavior out; barrier math itself is covered
 * in runtimeIntegrity.test.ts.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { LearningCardRenderer } from '../components/session/swipe/LearningCardRenderer';
import type { LearningCard } from '../domain/sessions/learningCards';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }), { virtual: true });
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(), notificationAsync: jest.fn() }), { virtual: true });
jest.mock('react-native-webview', () => ({ WebView: () => null }), { virtual: true });
jest.mock('react-native-gesture-handler', () => {
    const React = require('react');
    return {
        ScrollView: ({ children, ...props }: any) => React.createElement('ScrollView', props, children),
        Gesture: { Pan: jest.fn() },
        GestureDetector: ({ children }: any) => children,
    };
});
jest.mock('react-native-reanimated', () => {
    const React = require('react');
    const View = ({ children, ...props }: any) => React.createElement('View', props, children);
    return { __esModule: true, default: { View }, View, useSharedValue: (v: any) => ({ value: v }), useAnimatedStyle: (fn: any) => fn() };
});
jest.mock('../components/session/ChessBoard', () => () => null);
jest.mock('../theme/useAppTheme', () => ({
    useAppTheme: () => ({
        colors: {
            background: '#fff', text: '#000', textSecondary: '#888', primary: '#00f',
            surfaceLight: '#eee', buttonPrimary: '#000', theoryCard: '#def', white: '#fff',
        },
        isDark: false,
    }),
}));

const noop = () => {};
const base = {
    hobbyId: 'python',
    hobbyEyebrow: 'Python',
    isPremium: false,
    result: null,
    resultContinueLabel: 'Далее',
    onResultContinue: noop,
    onAnswer: noop,
    onAnswerFeedback: noop,
    onTestsDone: noop,
    onSolved: noop,
    onAdvance: noop,
};

const feedbackCard = (blockedBy: string | null): LearningCard => ({
    id: 'recall-0-feedback',
    type: 'feedback',
    phase: 'recall',
    title: 'Смотри внимательнее',
    order: 1,
    required: false,
    feedback: {
        body: 'return sends a value back.',
        verdict: 'fail',
        ...(blockedBy ? { blockedByCardId: blockedBy } : {}),
    } as any,
});

describe('feedback retry path', () => {
    it('offers retry back to the unresolved proof card', async () => {
        const onRetryProof = jest.fn();
        const screen = await render(
            <LearningCardRenderer
                {...base}
                card={feedbackCard('recall-0')}
                status={{ completed: false, attempts: 0 }}
                statusByCard={{ 'recall-0': { completed: false, attempts: 1 } }}
                onRetryProof={onRetryProof}
            />,
        );
        fireEvent.press(screen.getByText('Попробовать снова'));
        expect(onRetryProof).toHaveBeenCalledWith('recall-0');
        screen.unmount();
    });

    it('hides retry once the proof is resolved', async () => {
        const screen = await render(
            <LearningCardRenderer
                {...base}
                card={feedbackCard('recall-0')}
                status={{ completed: false, attempts: 0 }}
                statusByCard={{ 'recall-0': { completed: true, attempts: 2 } }}
                onRetryProof={jest.fn()}
            />,
        );
        expect(screen.queryAllByText('Попробовать снова')).toHaveLength(0);
        screen.unmount();
    });
});
