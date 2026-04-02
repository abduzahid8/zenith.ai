import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { t } from './languageStore';

// Subscription level type for dynamic text display
export type SubscriptionLevel = 'free' | 'trial' | 'premium';

// Helper to get subscription display text (English for UI)
export const getSubscriptionDisplayText = (level: SubscriptionLevel): string => {
    switch (level) {
        case 'premium':
            return 'Premium';
        case 'trial':
            return 'Trial';
        case 'free':
        default:
            return 'Free';
    }
};

// Helper to get time-based greeting
export const getGreeting = (userName?: string): string => {
    const hour = new Date().getHours();
    let greeting = '';

    if (hour < 6) {
        greeting = t('Доброй ночи');
    } else if (hour < 12) {
        greeting = t('Доброе утро');
    } else if (hour < 18) {
        greeting = t('Добрый день');
    } else {
        greeting = t('Добрый вечер');
    }

    if (userName) {
        return `${greeting}, ${userName}!`;
    }
    return `${greeting}!`;
};



interface UserProfileState {
    // True once AsyncStorage has finished rehydrating the persisted slice.
    // The nav guard must not redirect until this is true.
    _hasHydrated: boolean;

    // Profile data
    userName: string;
    streakDays: number;
    subscriptionLevel: SubscriptionLevel;
    lastSessionDate: string | null;
    isPremium: boolean;
    selectedHobby: string | null;
    hasCompletedOnboarding: boolean;

    // Actions
    setUserName: (name: string) => void;
    setStreakDays: (days: number) => void;
    incrementStreak: () => void;
    resetStreak: () => void;
    setSubscriptionLevel: (level: SubscriptionLevel) => void;
    updateLastSessionDate: () => void;
    setPremium: (isPremium: boolean) => void;
    setSelectedHobby: (hobbyId: string) => void;
    completeOnboarding: () => void;

    // Reset (called on sign out)
    resetProfile: () => void;
}

// NOTE: _hasHydrated is intentionally NOT in initialProfileState so that
// resetProfile() (called on sign-out) does not reset it back to false.
const initialProfileState = {
    userName: '',
    streakDays: 0,
    subscriptionLevel: 'free' as SubscriptionLevel,
    lastSessionDate: null as string | null,
    isPremium: false,
    selectedHobby: null as string | null,
    hasCompletedOnboarding: false,
};

export const useUserProfileStore = create<UserProfileState>()(
    persist(
        (set, get) => ({
            _hasHydrated: false,
            ...initialProfileState,

            setUserName: (userName) => {
                console.log('[userProfileStore] setUserName:', userName);
                set({ userName });
            },

            setStreakDays: (streakDays) => {
                console.log('[userProfileStore] setStreakDays:', streakDays);
                set({ streakDays });
            },

            incrementStreak: () => {
                const today = new Date().toDateString();
                const { lastSessionDate, streakDays } = get();

                // If already logged session today, don't increment
                if (lastSessionDate === today) {
                    console.log('[userProfileStore] incrementStreak skipped - already logged today');
                    return;
                }

                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);

                // If last session was yesterday, increment streak
                // If last session was before yesterday, reset to 1
                if (lastSessionDate === yesterday.toDateString()) {
                    console.log('[userProfileStore] incrementStreak - continuing streak:', streakDays + 1);
                    set({ streakDays: streakDays + 1, lastSessionDate: today });
                } else {
                    console.log('[userProfileStore] incrementStreak - new streak started: 1');
                    set({ streakDays: 1, lastSessionDate: today });
                }
            },

            resetStreak: () => {
                console.log('[userProfileStore] resetStreak called');
                set({ streakDays: 0, lastSessionDate: null });
            },

            setSubscriptionLevel: (subscriptionLevel) => {
                console.log('[userProfileStore] setSubscriptionLevel:', subscriptionLevel);
                set({
                    subscriptionLevel,
                    isPremium: subscriptionLevel === 'premium',
                });
            },

            updateLastSessionDate: () => {
                console.log('[userProfileStore] updateLastSessionDate called');
                set({
                    lastSessionDate: new Date().toDateString()
                });
            },

            setPremium: (isPremium) => {
                console.log('[userProfileStore] setPremium:', isPremium);
                set({
                    isPremium,
                    subscriptionLevel: isPremium ? 'premium' : get().subscriptionLevel,
                });
            },

            setSelectedHobby: (hobbyId) => {
                console.log('[userProfileStore] setSelectedHobby:', hobbyId);
                set({ selectedHobby: hobbyId });
            },

            completeOnboarding: () => {
                console.log('[userProfileStore] completeOnboarding called');
                set({ hasCompletedOnboarding: true });
            },



            resetProfile: () => {
                console.log('[userProfileStore] resetProfile called');
                set(initialProfileState);
            }
        }),
        {
            name: 'user-profile-storage',
            storage: createJSONStorage(() => AsyncStorage),
            onRehydrateStorage: () => (_state, error) => {
                if (!error) {
                    useUserProfileStore.setState({ _hasHydrated: true });
                }
            },
            partialize: (state) => ({
                isPremium: state.isPremium,
                selectedHobby: state.selectedHobby,
                hasCompletedOnboarding: state.hasCompletedOnboarding,
                userName: state.userName,
                streakDays: state.streakDays,
                subscriptionLevel: state.subscriptionLevel,
                lastSessionDate: state.lastSessionDate,
            }),
        }
    )
);

export default useUserProfileStore;
