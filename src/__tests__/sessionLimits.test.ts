/**
 * sessionLimits.test.ts
 * Лимиты сессий: free — 3 в день, Premium — безлимит.
 */

// Мокируем zustand persist чтобы тесты работали без AsyncStorage
jest.mock('zustand/middleware', () => ({
    persist: (fn: any) => fn,
    createJSONStorage: () => ({}),
}));

// Мокируем AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
}));

import { useGamificationStore, FREE_DAILY_SESSION_LIMIT } from '../store/gamificationStore';

const todayString = () => new Date().toISOString().split('T')[0];

/** Вспомогательная функция: получить состояние стора */
function getState() {
    return useGamificationStore.getState();
}

/** Сбросить счётчик сессий перед каждым тестом */
function resetSessionCounter() {
    useGamificationStore.setState({
        sessionsCompletedToday: 0,
        lastSessionDate: null,
    });
}

beforeEach(() => {
    jest.clearAllMocks();
    resetSessionCounter();
});

describe('session limits', () => {
    it('exposes a free daily limit of 3', () => {
        expect(FREE_DAILY_SESSION_LIMIT).toBe(3);
    });

    it('allows a free user to start when nothing completed today', () => {
        expect(getState().canStartSession(false)).toBe(true);
    });

    it('allows a free user to complete 3 sessions, blocks the 4th', () => {
        const today = todayString();
        expect(getState().canStartSession(false)).toBe(true);

        getState().incrementSessionsCompleted();
        expect(getState().canStartSession(false)).toBe(true);

        getState().incrementSessionsCompleted();
        expect(getState().canStartSession(false)).toBe(true);

        getState().incrementSessionsCompleted();
        expect(useGamificationStore.getState().sessionsCompletedToday).toBe(3);
        expect(useGamificationStore.getState().lastSessionDate).toBe(today);
        expect(useGamificationStore.getState().canStartSession(false)).toBe(false);
    });

    it('resets the free allowance on a new day', () => {
        useGamificationStore.setState({
            sessionsCompletedToday: 3,
            lastSessionDate: '2000-01-01',
        });
        expect(getState().canStartSession(false)).toBe(true);

        // Первая сессия нового дня снова начинает счёт с 1
        getState().incrementSessionsCompleted();
        expect(useGamificationStore.getState().sessionsCompletedToday).toBe(1);
        expect(useGamificationStore.getState().lastSessionDate).toBe(todayString());
    });

    it('never blocks Premium users', () => {
        useGamificationStore.setState({
            sessionsCompletedToday: 99,
            lastSessionDate: todayString(),
        });
        expect(getState().canStartSession(true)).toBe(true);
    });
});
