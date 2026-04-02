import {
    getGreeting,
    getSubscriptionDisplayText,
} from '../store/userProfileStore';
import type { SubscriptionLevel } from '../store/userProfileStore';
import { useUserProfileStore } from '../store/userProfileStore';

// Reset the store before each test to ensure clean state
beforeEach(() => {
    useUserProfileStore.setState({
        userName: '',
        streakDays: 0,
        subscriptionLevel: 'free',
        lastSessionDate: null,
        isPremium: false,
        selectedHobby: null,
        hasCompletedOnboarding: false,
    });
});

// ─── Helper functions ────────────────────────────────

describe('getSubscriptionDisplayText', () => {
    it('returns "Free" for free', () => {
        expect(getSubscriptionDisplayText('free')).toBe('Free');
    });

    it('returns "Trial" for trial', () => {
        expect(getSubscriptionDisplayText('trial')).toBe('Trial');
    });

    it('returns "Premium" for premium', () => {
        expect(getSubscriptionDisplayText('premium')).toBe('Premium');
    });
});

describe('getGreeting', () => {
    it('includes the name when provided', () => {
        const result = getGreeting('Алексей');
        expect(result).toContain('Алексей');
        expect(result).toMatch(/!$/);
    });

    it('ends with "!" when no name given', () => {
        const result = getGreeting();
        expect(result).toMatch(/!$/);
    });

    it('returns one of the known greetings', () => {
        const result = getGreeting();
        const knownGreetings = [
            'Доброй ночи!',
            'Доброе утро!',
            'Добрый день!',
            'Добрый вечер!',
        ];
        expect(knownGreetings).toContain(result);
    });
});

// ─── Store actions ───────────────────────────────────

describe('useUserProfileStore — incrementStreak', () => {
    it('sets streak to 1 on first call', () => {
        const store = useUserProfileStore.getState();
        store.incrementStreak();

        const { streakDays, lastSessionDate } = useUserProfileStore.getState();
        expect(streakDays).toBe(1);
        expect(lastSessionDate).toBe(new Date().toDateString());
    });

    it('does not increment again on same day', () => {
        const store = useUserProfileStore.getState();
        store.incrementStreak();
        store.incrementStreak();
        store.incrementStreak();

        expect(useUserProfileStore.getState().streakDays).toBe(1);
    });

    it('increments streak when yesterday was the last session', () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        useUserProfileStore.setState({
            streakDays: 3,
            lastSessionDate: yesterday.toDateString(),
        });

        useUserProfileStore.getState().incrementStreak();
        expect(useUserProfileStore.getState().streakDays).toBe(4);
    });

    it('resets streak to 1 when there is a gap', () => {
        const twoDaysAgo = new Date();
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

        useUserProfileStore.setState({
            streakDays: 5,
            lastSessionDate: twoDaysAgo.toDateString(),
        });

        useUserProfileStore.getState().incrementStreak();
        expect(useUserProfileStore.getState().streakDays).toBe(1);
    });
});

describe('useUserProfileStore — setSubscriptionLevel', () => {
    it('sets isPremium to true when level is "premium"', () => {
        useUserProfileStore.getState().setSubscriptionLevel('premium');
        const { isPremium, subscriptionLevel } = useUserProfileStore.getState();
        expect(isPremium).toBe(true);
        expect(subscriptionLevel).toBe('premium');
    });

    it('sets isPremium to false when level is "free"', () => {
        useUserProfileStore.getState().setSubscriptionLevel('free');
        expect(useUserProfileStore.getState().isPremium).toBe(false);
    });

    it('sets isPremium to false when level is "trial"', () => {
        useUserProfileStore.getState().setSubscriptionLevel('trial');
        expect(useUserProfileStore.getState().isPremium).toBe(false);
    });
});

describe('useUserProfileStore — resetProfile', () => {
    it('resets all profile data to defaults', () => {
        // Set some state
        useUserProfileStore.setState({
            userName: 'Test',
            streakDays: 10,
            subscriptionLevel: 'premium',
            isPremium: true,
            selectedHobby: 'chess',
            hasCompletedOnboarding: true,
        });

        useUserProfileStore.getState().resetProfile();
        const state = useUserProfileStore.getState();

        expect(state.userName).toBe('');
        expect(state.streakDays).toBe(0);
        expect(state.subscriptionLevel).toBe('free');
        expect(state.isPremium).toBe(false);
        expect(state.selectedHobby).toBeNull();
        expect(state.hasCompletedOnboarding).toBe(false);
    });
});
