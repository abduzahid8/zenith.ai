import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { authService, dbService } from '../services/supabase';
import { useUserProfileStore } from './userProfileStore';

interface AuthState {
    user: User | null;
    session: Session | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    error: string | null;

    // Actions
    setUser: (user: User | null) => void;
    setSession: (session: Session | null) => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    signIn: (email: string, password: string) => Promise<void>;
    signUp: (email: string, password: string) => Promise<void>;
    signOut: () => Promise<void>;
    initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
    (set) => ({
        user: null,
        session: null,
        isLoading: true,
        isAuthenticated: false,
        error: null,

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

        setError: (error) => set({ error }),

        signIn: async (email, password) => {
            try {
                set({ isLoading: true, error: null });
                const { session, user } = await authService.signIn(email, password);

                const profileStore = useUserProfileStore.getState();
                profileStore.setUserName(user?.email?.split('@')[0] || '');

                // Fetch user hobbies to check if onboarding is complete
                try {
                    const hobbies = await dbService.getUserHobbies(user.id);
                    const hasOnboarded = hobbies && hobbies.length > 0;
                    profileStore.completeOnboarding();
                    if (!hasOnboarded) {
                        // Reset onboarding flag if no hobbies
                        useUserProfileStore.setState({ hasCompletedOnboarding: false });
                    }
                } catch (dbError) {
                    console.warn('Failed to fetch user hobbies:', dbError);
                }

                set({
                    session,
                    user,
                    isAuthenticated: true,
                    isLoading: false,
                });
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
                set({ isLoading: true, error: null });
                const { session, user } = await authService.signUp(email, password);

                const profileStore = useUserProfileStore.getState();
                profileStore.setUserName(user?.email?.split('@')[0] || '');

                set({
                    session,
                    user,
                    isAuthenticated: !!session,
                    isLoading: false,
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

                // Reset profile store
                useUserProfileStore.getState().resetProfile();

                set({
                    user: null,
                    session: null,
                    isAuthenticated: false,
                    isLoading: false,
                });
            } catch (error: any) {
                set({ error: error.message, isLoading: false });
            }
        },

        initialize: async () => {
            try {
                const session = await authService.getSession();
                if (session) {
                    const profileStore = useUserProfileStore.getState();
                    if (!profileStore.userName) {
                        profileStore.setUserName(session.user?.email?.split('@')[0] || '');
                    }
                    // Sync onboarding state and selected hobby from server (multi-device / reinstall)
                    try {
                        const hobbies = await dbService.getUserHobbies(session.user.id);
                        const hasOnboarded = hobbies && hobbies.length > 0;
                        const primaryHobby = hobbies?.find((h: { is_primary?: boolean }) => h.is_primary) || hobbies?.[0];
                        useUserProfileStore.setState({
                            hasCompletedOnboarding: hasOnboarded,
                            ...(primaryHobby && { selectedHobby: primaryHobby.hobby_id }),
                        });
                    } catch (dbError) {
                        console.warn('Failed to sync onboarding state:', dbError);
                    }

                    set({
                        session,
                        user: session.user,
                        isAuthenticated: true,
                        isLoading: false,
                    });
                } else {
                    set({ isLoading: false });
                }
            } catch (error) {
                set({ isLoading: false });
            }
        },
    })
);

export default useAuthStore;

// Backward-compatible re-exports from userProfileStore
// Consumers can gradually migrate to importing directly from userProfileStore
export {
    getGreeting,
    getSubscriptionDisplayText,
    useUserProfileStore,
} from './userProfileStore';
export type { SubscriptionLevel, WeeklyTask } from './userProfileStore';
