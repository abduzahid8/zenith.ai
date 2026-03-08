import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Subscription level type for dynamic text display
export type SubscriptionLevel = 'free' | 'trial' | 'premium';

// Helper to get subscription display text (English for UI)
export const getSubscriptionDisplayText = (level: SubscriptionLevel): string => {
    switch (level) {
        case 'premium':
            return 'Premium';
        case 'trial':
        default:
            return 'Free';
    }
};

// Helper to get time-based greeting
export const getGreeting = (userName?: string): string => {
    const hour = new Date().getHours();
    let greeting = '';

    if (hour < 6) {
        greeting = 'Доброй ночи';
    } else if (hour < 12) {
        greeting = 'Доброе утро';
    } else if (hour < 18) {
        greeting = 'Добрый день';
    } else {
        greeting = 'Добрый вечер';
    }

    if (userName) {
        return `${greeting}, ${userName}!`;
    }
    return `${greeting}!`;
};

export interface WeeklyTask {
    text: string;
    completed: boolean;
}

interface UserProfileState {
    // Profile data
    userName: string;
    streakDays: number;
    subscriptionLevel: SubscriptionLevel;
    lastSessionDate: string | null;
    isPremium: boolean;
    selectedHobby: string | null;
    hasCompletedOnboarding: boolean;

    // Weekly Tasks
    weeklyTasks: WeeklyTask[];

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
    setWeeklyTasks: (tasks: WeeklyTask[]) => void;
    toggleWeeklyTask: (index: number) => void;

    // Reset (called on sign out)
    resetProfile: () => void;
}

const initialProfileState = {
    userName: '',
    streakDays: 0,
    subscriptionLevel: 'free' as SubscriptionLevel,
    lastSessionDate: null as string | null,
    isPremium: false,
    selectedHobby: null as string | null,
    hasCompletedOnboarding: false,
    weeklyTasks: [] as WeeklyTask[],
};

export const useUserProfileStore = create<UserProfileState>()(
    persist(
        (set, get) => ({
            ...initialProfileState,

            setUserName: (userName) => set({ userName }),

            setStreakDays: (streakDays) => set({ streakDays }),

            incrementStreak: () => {
                const today = new Date().toDateString();
                const { lastSessionDate, streakDays } = get();

                // If already logged session today, don't increment
                if (lastSessionDate === today) return;

                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);

                // If last session was yesterday, increment streak
                // If last session was before yesterday, reset to 1
                if (lastSessionDate === yesterday.toDateString()) {
                    set({ streakDays: streakDays + 1, lastSessionDate: today });
                } else {
                    set({ streakDays: 1, lastSessionDate: today });
                }
            },

            resetStreak: () => set({ streakDays: 0, lastSessionDate: null }),

            setSubscriptionLevel: (subscriptionLevel) => set({
                subscriptionLevel,
                isPremium: subscriptionLevel === 'premium',
            }),

            updateLastSessionDate: () => set({
                lastSessionDate: new Date().toDateString()
            }),

            setPremium: (isPremium) => set({
                isPremium,
                subscriptionLevel: isPremium ? 'premium' : get().subscriptionLevel,
            }),

            setSelectedHobby: (hobbyId) => set({ selectedHobby: hobbyId, weeklyTasks: [] }),

            completeOnboarding: () => set({ hasCompletedOnboarding: true }),

            setWeeklyTasks: (weeklyTasks) => set({ weeklyTasks }),

            toggleWeeklyTask: (index) => set((state) => {
                const newTasks = [...state.weeklyTasks];
                if (newTasks[index]) {
                    newTasks[index].completed = !newTasks[index].completed;
                }
                return { weeklyTasks: newTasks };
            }),

            resetProfile: () => set(initialProfileState),
        }),
        {
            name: 'user-profile-storage',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({
                isPremium: state.isPremium,
                selectedHobby: state.selectedHobby,
                hasCompletedOnboarding: state.hasCompletedOnboarding,
                userName: state.userName,
                streakDays: state.streakDays,
                subscriptionLevel: state.subscriptionLevel,
                lastSessionDate: state.lastSessionDate,
                weeklyTasks: state.weeklyTasks,
            }),
        }
    )
);

export default useUserProfileStore;
