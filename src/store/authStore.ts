import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session, User } from '@supabase/supabase-js';

// Subscription level type for dynamic text display
export type SubscriptionLevel = 'free' | 'trial' | 'premium';

// Helper to get subscription display text
export const getSubscriptionDisplayText = (level: SubscriptionLevel): string => {
    switch (level) {
        case 'premium':
            return 'Премиум';
        case 'trial':
            return 'Пробный период';
        default:
            return 'Бесплатный';
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

interface AuthState {
    user: User | null;
    session: Session | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    isPremium: boolean;
    selectedHobby: string | null;
    hasCompletedOnboarding: boolean;

    // Dynamic user data for text display
    userName: string;
    streakDays: number;
    subscriptionLevel: SubscriptionLevel;
    lastSessionDate: string | null;

    // Actions
    setUser: (user: User | null) => void;
    setSession: (session: Session | null) => void;
    setLoading: (loading: boolean) => void;
    setPremium: (isPremium: boolean) => void;
    setSelectedHobby: (hobbyId: string) => void;
    completeOnboarding: () => void;

    // Auth Async Actions
    signIn: (email: string, password: string) => Promise<void>;
    signUp: (email: string, password: string) => Promise<void>;
    signOut: () => Promise<void>;
    initialize: () => Promise<void>;
    error: string | null;
    setError: (error: string | null) => void;

    // New actions for dynamic data
    setUserName: (name: string) => void;
    setStreakDays: (days: number) => void;
    incrementStreak: () => void;
    resetStreak: () => void;
    setSubscriptionLevel: (level: SubscriptionLevel) => void;
    updateLastSessionDate: () => void;
    // Weekly Tasks
    weeklyTasks: WeeklyTask[];
    setWeeklyTasks: (tasks: WeeklyTask[]) => void;
    toggleWeeklyTask: (index: number) => void;
}

export interface WeeklyTask {
    text: string;
    completed: boolean;
}

// Import authService
import { authService, dbService } from '../services/supabase';

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            session: null,
            isLoading: true,
            isAuthenticated: false,
            isPremium: false,
            selectedHobby: null,
            hasCompletedOnboarding: false,
            error: null,

            // Default values for dynamic user data
            userName: '',
            streakDays: 0,
            subscriptionLevel: 'free' as SubscriptionLevel,
            lastSessionDate: null,

            setUser: (user) =>
                set({
                    user,
                    isAuthenticated: !!user,
                    userName: user?.email?.split('@')[0] || get().userName,
                }),

            setSession: (session) =>
                set({
                    session,
                    user: session?.user || null,
                    isAuthenticated: !!session,
                }),

            setLoading: (isLoading) => set({ isLoading }),

            setError: (error) => set({ error }),

            setPremium: (isPremium) => set({
                isPremium,
                subscriptionLevel: isPremium ? 'premium' : get().subscriptionLevel,
            }),

            setSelectedHobby: (hobbyId) => set({ selectedHobby: hobbyId }),

            completeOnboarding: () => set({ hasCompletedOnboarding: true }),

            signIn: async (email, password) => {
                try {
                    console.log('Attempting login for:', email);
                    set({ isLoading: true, error: null });
                    const { session, user } = await authService.signIn(email, password);
                    console.log('Login successful, user:', user?.id);

                    // Fetch user hobbies to check if onboarding is complete
                    try {
                        const hobbies = await dbService.getUserHobbies(user.id);
                        const hasOnboarded = hobbies && hobbies.length > 0;

                        set({
                            session,
                            user,
                            isAuthenticated: true,
                            isLoading: false,
                            hasCompletedOnboarding: hasOnboarded,
                            userName: user?.email?.split('@')[0] || ''
                        });
                    } catch (dbError) {
                        console.warn('Failed to fetch user hobbies:', dbError);
                        // Fallback: still log in, but might show onboarding again
                        set({
                            session,
                            user,
                            isAuthenticated: true,
                            isLoading: false,
                            userName: user?.email?.split('@')[0] || ''
                        });
                    }
                } catch (error: any) {
                    console.error('Login error:', error);
                    let errorMessage = error.message;

                    if (errorMessage.includes('Email not confirmed')) {
                        errorMessage = 'Email не подтвержден. Проверьте почту.';
                    } else if (errorMessage.includes('Invalid login credentials')) {
                        errorMessage = 'Неверный email или пароль.';
                    }

                    set({ error: errorMessage, isLoading: false });
                    throw new Error(errorMessage);
                }
            },

            signUp: async (email, password) => {
                try {
                    console.log('Attempting signup for:', email);
                    set({ isLoading: true, error: null });
                    const { session, user } = await authService.signUp(email, password);
                    console.log('Signup successful, user:', user?.id);

                    set({
                        session,
                        user,
                        isAuthenticated: !!session, // Session might be null if email confirmation needed
                        isLoading: false,
                        userName: user?.email?.split('@')[0] || ''
                    });
                } catch (error: any) {
                    console.error('Signup error:', error);
                    set({ error: error.message, isLoading: false });
                    throw error;
                }
            },

            signOut: async () => {
                try {
                    set({ isLoading: true });
                    await authService.signOut();
                    set({
                        user: null,
                        session: null,
                        isAuthenticated: false,
                        isPremium: false,
                        selectedHobby: null,
                        hasCompletedOnboarding: false,
                        userName: '',
                        streakDays: 0,
                        subscriptionLevel: 'free',
                        lastSessionDate: null,
                        isLoading: false
                    });
                } catch (error: any) {
                    set({ error: error.message, isLoading: false });
                }
            },

            initialize: async () => {
                try {
                    const session = await authService.getSession();
                    if (session) {
                        set({
                            session,
                            user: session.user,
                            isAuthenticated: true,
                            userName: session.user?.email?.split('@')[0] || '',
                            isLoading: false
                        });
                    } else {
                        set({ isLoading: false });
                    }
                } catch (error) {
                    set({ isLoading: false });
                }
            },

            // New actions for dynamic data
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
                // If last session was today or before yesterday, reset to 1
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

            // Weekly Tasks Implementation
            weeklyTasks: [
                { text: 'Изучить 1 базовый дебют', completed: false },
                { text: 'Сыграть 2 партии без отвлечений', completed: false },
            ],

            setWeeklyTasks: (weeklyTasks) => set({ weeklyTasks }),

            toggleWeeklyTask: (index) => set((state) => {
                const newTasks = [...state.weeklyTasks];
                if (newTasks[index]) {
                    newTasks[index].completed = !newTasks[index].completed;
                }
                return { weeklyTasks: newTasks };
            }),
        }),
        {
            name: 'auth-storage',
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

export default useAuthStore;
