import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session, User } from '@supabase/supabase-js';

interface AuthState {
    user: User | null;
    session: Session | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    isPremium: boolean;
    selectedHobby: string | null;
    hasCompletedOnboarding: boolean;

    // Actions
    setUser: (user: User | null) => void;
    setSession: (session: Session | null) => void;
    setLoading: (loading: boolean) => void;
    setPremium: (isPremium: boolean) => void;
    setSelectedHobby: (hobbyId: string) => void;
    completeOnboarding: () => void;
    signOut: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            session: null,
            isLoading: true,
            isAuthenticated: false,
            isPremium: false,
            selectedHobby: null,
            hasCompletedOnboarding: false,

            setUser: (user) =>
                set({
                    user,
                    isAuthenticated: !!user,
                }),

            setSession: (session) =>
                set({
                    session,
                    user: session?.user || null,
                    isAuthenticated: !!session,
                }),

            setLoading: (isLoading) => set({ isLoading }),

            setPremium: (isPremium) => set({ isPremium }),

            setSelectedHobby: (hobbyId) => set({ selectedHobby: hobbyId }),

            completeOnboarding: () => set({ hasCompletedOnboarding: true }),

            signOut: () =>
                set({
                    user: null,
                    session: null,
                    isAuthenticated: false,
                    isPremium: false,
                    selectedHobby: null,
                    hasCompletedOnboarding: false,
                }),
        }),
        {
            name: 'auth-storage',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({
                isPremium: state.isPremium,
                selectedHobby: state.selectedHobby,
                hasCompletedOnboarding: state.hasCompletedOnboarding,
            }),
        }
    )
);

export default useAuthStore;
