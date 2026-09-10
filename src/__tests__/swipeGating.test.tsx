/**
 * Swipe gating — real component wiring (not the reducer in isolation).
 * Renders SwipeLearningSession with the real useSwipeSession hook against
 * seeded stores, then drives the exact FlatList gesture callbacks the
 * container wires (momentum + viewability, mirroring a real scroll) and
 * asserts authorization behavior through visible UI state.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SwipeLearningSession } from '../components/session/swipe/SwipeLearningSession';
import { useUserProfileStore } from '../store/userProfileStore';
import { useGamificationStore } from '../store/gamificationStore';
import { useTaskStore } from '../store/taskStore';
import { getLessonByDay } from '../data/lessonContent';
import { buildSessionBlueprint } from '../domain/sessions/sessionBlueprint';
import { buildLearningCards } from '../domain/sessions/learningCards';

jest.mock('expo-blur', () => ({ BlurView: () => null }), { virtual: true });
jest.mock('react-native-webview', () => ({ WebView: () => null }), { virtual: true });
jest.mock('react-native-url-polyfill/auto', () => ({}), { virtual: true });
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }), { virtual: true });
jest.mock('expo-auth-session', () => ({ makeRedirectUri: jest.fn(() => 'test://') }), { virtual: true });
jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: jest.fn() }), { virtual: true });
jest.mock('expo-apple-authentication', () => ({}), { virtual: true });
jest.mock('expo-crypto', () => ({}), { virtual: true });
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(), notificationAsync: jest.fn() }), { virtual: true });
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
    const Text = ({ children, ...props }: any) => React.createElement('Text', props, children);
    const ScrollView = ({ children, ...props }: any) => React.createElement('ScrollView', props, children);
    return {
        __esModule: true,
        default: { View, Text, ScrollView },
        View,
        Text,
        ScrollView,
        useSharedValue: (v: any) => ({ value: v }),
        useAnimatedStyle: (fn: any) => fn(),
        useAnimatedProps: () => ({}),
        withSpring: (v: any) => v,
        withTiming: (v: any) => v,
        withDelay: (_d: any, v: any) => v,
        withSequence: (...args: any[]) => args[args.length - 1],
        runOnJS: (fn: any) => fn,
        runOnUI: (fn: any) => fn,
        Easing: { out: () => jest.fn(), in: () => jest.fn(), ease: jest.fn(), linear: jest.fn() },
        Extrapolate: { CLAMP: 'clamp' },
        interpolate: jest.fn(() => 0),
        cancelAnimation: jest.fn(),
    };
});
// Chess board is not on this test's path (python lesson); stub the native view.
jest.mock('../components/session/ChessBoard', () => () => null);
jest.mock('../services/supabase/sessions', () => ({
    sessionService: { saveSession: jest.fn(async () => null), getUserSessions: jest.fn(async () => []) },
}));
jest.mock('../services/taskService', () => ({
    taskService: {
        getDailyPlan: jest.fn(async () => []),
        createManualTask: jest.fn(async () => null),
        completeTask: jest.fn(async () => null),
        uncompleteTask: jest.fn(async () => null),
        skipTask: jest.fn(async () => null),
    },
}));
jest.mock('../store/authStore', () => ({
    useAuthStore: Object.assign((selector: any) => selector({ user: null }), {
        getState: () => ({ user: null }),
    }),
}));
jest.mock('../theme/useAppTheme', () => ({
    useAppTheme: () => ({
        colors: {
            background: '#EDF2F7',
            text: '#1A253C',
            textSecondary: '#64748B',
            primary: '#37A0EF',
            surfaceLight: '#FFFFFF',
            buttonPrimary: '#0F2147',
            buttonSecondary: '#E8E8EE',
            buttonTextPrimary: '#FFFFFF',
            theoryCard: '#D6EEFF',
            white: '#FFFFFF',
            sessionTimer: { background: '#EDF2F7', text: '#1A253C', primary: '#37A0EF' },
            weeklyPlan: {},
        },
        isDark: false,
    }),
}));
// Clock frozen: no background ticks inside the test.
jest.mock('../components/session/swipe/SessionClock', () => ({
    SessionClock: () => null,
}));
jest.mock('../services/ai', () => ({
    aiService: {
        sendMessage: jest.fn(async () => '👍 Отлично! Верно.'),
        gradeAnswer: jest.fn(),
    },
}));

const DIM_H = 844;

// The exact card order the runtime builds (deterministic from the bank).
function expectedCards() {
    const lesson = getLessonByDay('python' as any, 3)!;
    const blueprint = buildSessionBlueprint({ minutes: 15, lessonTitle: lesson.learn.title });
    return buildLearningCards({ blueprint, lesson, kind: 'structured', minutes: 15 });
}

describe('swipe gating through real wiring', () => {
    beforeEach(() => {
        useUserProfileStore.setState({ selectedHobby: 'python', isPremium: false } as any);
        const g = useGamificationStore.getState();
        useGamificationStore.setState({ ...g, currentDay: { ...g.currentDay, python: 3 } });
        useTaskStore.setState({ dailyTasks: [] } as any);
    });

    it('first card renders immediately; far drag cannot pass unanswered required recall; PASS authorizes', async () => {
        const cards = expectedCards();
        const recallIdx = cards.findIndex(c => c.type === 'recall');
        expect(recallIdx).toBeGreaterThan(0);

        const onExit = jest.fn();
        const screen = await render(
            <SwipeLearningSession kind="structured" origin="your_day" minutes={15} onExit={onExit} />,
        );
        // Learning begins immediately: no timer screen, first useful card.
        const counter = await screen.findByText(new RegExp(`^1 / ${cards.length}$`));
        expect(counter).toBeTruthy();

        const list = screen.getByTestId('swipe-card-list');
        // A real scroll fires momentum + viewability together.
        const swipeTo = async (index: number) => {
            await fireEvent(list, 'onMomentumScrollEnd', { nativeEvent: { contentOffset: { y: DIM_H * index } } });
            await fireEvent(list, 'onViewableItemsChanged', {
                viewableItems: [{ item: cards[index], index }],
                changed: [],
            });
        };

        // Far drag while recall is unanswered: must stay at the frontier.
        await swipeTo(10);
        expect(screen.getByText(`1 / ${cards.length}`)).toBeTruthy();

        // Answer the recall through the real DoStep UI (mocked AI grades pass).
        // The recall card precedes apply cards, so the first input/check wins.
        const inputs = screen.root!.queryAll((node: any) => node.type === 'TextInput');
        expect(inputs.length).toBeGreaterThan(0);
        await fireEvent.changeText(inputs[0], 'int хранит целые числа');
        await fireEvent.press(screen.getAllByText('Проверить')[0]);
        await screen.findByText('Далее', {}, { timeout: 10000 });
        await fireEvent.press(screen.getAllByText('Далее')[0]);

        // The answered recall authorizes reaching the apply card — but a far
        // drag still cannot jump PAST the next unanswered required card.
        await swipeTo(recallIdx + 1);
        await screen.findByText(new RegExp(`^${recallIdx + 2} / ${cards.length}$`));
        await swipeTo(10);
        expect(screen.getByText(`${recallIdx + 2} / ${cards.length}`)).toBeTruthy();
        expect(onExit).not.toHaveBeenCalled();
        screen.unmount();
    }, 30000);
});
