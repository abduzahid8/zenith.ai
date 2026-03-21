import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { authService, dbService } from '../services/supabase';
import { useUserProfileStore } from './userProfileStore';
import { useTaskStore } from './taskStore';
import { toAppError } from '../shared/errors';

interface AuthState {
    user: User | null;
    session: Session | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    isResettingPassword: boolean;
    error: string | null;

    // Actions
    setUser: (user: User | null) => void;
    setSession: (session: Session | null) => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    setResettingPassword: (isResetting: boolean) => void;
    signIn: (email: string, password: string) => Promise<void>;
    signUp: (email: string, password: string) => Promise<void>;
    signInWithGoogle: () => Promise<void>;
    signInWithApple: () => Promise<void>;
    signOut: () => Promise<void>;
    initialize: () => Promise<void>;
    updatePassword: (password: string) => Promise<void>;
    deleteAccount: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
    (set, get) => ({
        user: null,
        session: null,
        isLoading: true,
        isAuthenticated: false,
        isResettingPassword: false,
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

        setResettingPassword: (isResettingPassword) => set({ isResettingPassword }),

        signIn: async (email, password) => {
            try {
                set({ isLoading: true, error: null });

                // Clear previous account data before signing in
                const previousUser = get().user;
                const { session, user } = await authService.signIn(email, password);

                if (previousUser && previousUser.id !== user?.id) {
                    useUserProfileStore.getState().resetProfile();
                    useTaskStore.getState().resetTasks();
                }

                const profileStore = useUserProfileStore.getState();
                profileStore.setUserName(user?.email?.split('@')[0] || '');

                // Fetch user hobbies to determine if onboarding is complete
                try {
                    const hobbies = await dbService.getUserHobbies(user.id);
                    const hasOnboarded = hobbies && hobbies.length > 0;
                    if (hasOnboarded) {
                        profileStore.completeOnboarding();
                    } else {
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
            } catch (error: unknown) {
                console.error('Login error:', error);
                const hasStructuredMessage =
                    error instanceof Error ||
                    (typeof error === 'object' &&
                        error !== null &&
                        'message' in error &&
                        typeof (error as { message?: unknown }).message === 'string');
                let errorMessage = hasStructuredMessage
                    ? toAppError(error).message
                    : 'Unknown error';

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
            } catch (error: unknown) {
                console.error('Signup error:', error);
                const appError = toAppError(error);
                set({ error: appError.message, isLoading: false });
                throw error;
            }
        },

        signInWithGoogle: async () => {
            try {
                set({ isLoading: true, error: null });
                const data = await authService.signInWithGoogle();
                const session = data?.session ?? null;
                const user = data?.user ?? session?.user ?? null;

                if (user) {
                    const profileStore = useUserProfileStore.getState();
                    profileStore.setUserName(user.email?.split('@')[0] || '');
                }

                set({
                    session,
                    user,
                    isAuthenticated: !!session,
                    isLoading: false,
                });
            } catch (error: unknown) {
                console.error('Google sign-in error:', error);
                const appError = toAppError(error);
                set({ error: appError.message, isLoading: false });
                throw error;
            }
        },

        signInWithApple: async () => {
            try {
                set({ isLoading: true, error: null });
                const data = await authService.signInWithApple();
                const session = data?.session ?? null;
                const user = data?.user ?? session?.user ?? null;

                if (user) {
                    const profileStore = useUserProfileStore.getState();
                    profileStore.setUserName(user.email?.split('@')[0] || '');
                }

                set({
                    session,
                    user,
                    isAuthenticated: !!session,
                    isLoading: false,
                });
            } catch (error: unknown) {
                console.error('Apple sign-in error:', error);
                const appError = toAppError(error);
                set({ error: appError.message, isLoading: false });
                throw error;
            }
        },

        signOut: async () => {
            try {
                set({ isLoading: true });
                await authService.signOut();

                // Reset all stores to clear previous account data
                useUserProfileStore.getState().resetProfile();
                useTaskStore.getState().resetTasks();

                set({
                    user: null,
                    session: null,
                    isAuthenticated: false,
                    isLoading: false,
                });
            } catch (error: unknown) {
                const appError = toAppError(error);
                set({ error: appError.message, isLoading: false });
            }
        },

        initialize: async () => {
            try {
                // Set up listener for auth changes
                const { getSupabase } = require('../services/supabase/client');
                const s = getSupabase();
                s.auth.onAuthStateChange(async (event: string, session: any) => {
                    if (event === 'SIGNED_IN') {
                        const user = session?.user || null;
                        set({ session, user, isAuthenticated: true });

                        // Sync user profile and onboarding state when signed in
                        if (user) {
                            const profileStore = useUserProfileStore.getState();
                            if (!profileStore.userName) {
                                profileStore.setUserName(user.email?.split('@')[0] || '');
                            }

                            // Check onboarding status
                            try {
                                const hobbies = await dbService.getUserHobbies(user.id);
                                const hasOnboarded = hobbies && hobbies.length > 0;
                                const primaryHobby = hobbies?.find((h: { is_primary?: boolean }) => h.is_primary) || hobbies?.[0];
                                useUserProfileStore.setState({
                                    hasCompletedOnboarding: hasOnboarded,
                                    ...(primaryHobby && { selectedHobby: primaryHobby.hobby_id }),
                                });
                            } catch (error) {
                                console.warn('Failed to sync onboarding state on sign in:', error);
                            }
                        }
                    } else if (event === 'SIGNED_OUT') {
                        set({ session: null, user: null, isAuthenticated: false, isResettingPassword: false });
                    } else if (event === 'PASSWORD_RECOVERY') {
                        set({ isResettingPassword: true });
                    }
                });

                const sessionPromise = authService.getSession();
                const timeoutPromise = new Promise<null>((resolve) =>
                    setTimeout(() => resolve(null), 5000)
                );
                const session = await Promise.race([sessionPromise, timeoutPromise]);
                if (session) {
                    const profileStore = useUserProfileStore.getState();
                    if (!profileStore.userName) {
                        profileStore.setUserName(session.user?.email?.split('@')[0] || '');
                    }

                    // Unblock UI immediately — hobbies sync runs in background
                    set({
                        session,
                        user: session.user,
                        isAuthenticated: true,
                        isLoading: false,
                    });

                    // Sync onboarding state from server in background (multi-device / reinstall)
                    dbService.getUserHobbies(session.user.id).then((hobbies) => {
                        const hasOnboarded = hobbies && hobbies.length > 0;
                        const primaryHobby = hobbies?.find((h: { is_primary?: boolean }) => h.is_primary) || hobbies?.[0];
                        useUserProfileStore.setState({
                            hasCompletedOnboarding: hasOnboarded,
                            ...(primaryHobby && { selectedHobby: primaryHobby.hobby_id }),
                        });
                    }).catch((dbError) => {
                        console.warn('Failed to sync onboarding state:', dbError);
                    });
                } else {
                    set({ isLoading: false });
                }
            } catch (error) {
                set({ isLoading: false });
            }
        },

        updatePassword: async (password: string) => {
            try {
                set({ isLoading: true, error: null });
                await authService.updatePassword(password);
                set({ isResettingPassword: false, isLoading: false });
            } catch (error: unknown) {
                console.error('Update password error:', error);
                const appError = toAppError(error);
                set({ error: appError.message, isLoading: false });
                throw error;
            }
        },

        deleteAccount: async () => {
            try {
                set({ isLoading: true, error: null });
                await authService.deleteAccount();
                await get().signOut();
            } catch (error: unknown) {
                console.error('Delete account error:', error);
                const appError = toAppError(error);
                set({ error: appError.message, isLoading: false });
                throw error;
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
