import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { authService, dbService, profileService } from '../services/supabase';
import { useUserProfileStore } from './userProfileStore';
import { useTaskStore } from './taskStore';
import { useHobbyTimeStore } from './hobbyTimeStore';
import { useQuizStore } from './quizStore';
import { useScreenTimeStore } from './screenTimeStore';
import { useEarningsStore } from './earningsStore';
import { useContentStore } from './contentStore';
import { useDeviceScreenTimeStore } from './deviceScreenTimeStore';
import { useSubscriptionStore } from './subscriptionStore';
import { toAppError } from '../shared/errors';

// Module-level guards — survive store re-creation in dev hot-reload
let _isInitialized = false;
let _authSubscription: { unsubscribe: () => void } | null = null;

/**
 * Fetch the user's hobbies from the DB and sync onboarding state.
 * Safe to call concurrently — supabase handles the request; worst case
 * the store receives two identical writes.
 */
async function syncUserProfile(userId: string): Promise<void> {
    try {
        // Ensure the profile row exists in the database
        await profileService.getOrCreateProfile(userId);

        const hobbies = await dbService.getUserHobbies(userId);
        const hasOnboarded = hobbies && hobbies.length > 0;
        const primaryHobby =
            hobbies?.find((h: { is_primary?: boolean }) => h.is_primary) ||
            hobbies?.[0];
        useUserProfileStore.setState({
            hasCompletedOnboarding: hasOnboarded,
            ...(primaryHobby && { selectedHobby: primaryHobby.hobby_id }),
        });
    } catch (err) {
        console.warn('[authStore] syncUserProfile failed:', err);
    }
}

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

        setUser: (user) => {
            console.log('[authStore] setUser called - user:', user?.email || 'null');
            set({
                user,
                isAuthenticated: !!user,
            });
        },

        setSession: (session) => {
            console.log('[authStore] setSession called - has session:', !!session);
            set({
                session,
                user: session?.user || null,
                isAuthenticated: !!session,
            });
        },

        setLoading: (isLoading) => {
            console.log('[authStore] setLoading:', isLoading);
            set({ isLoading });
        },

        setError: (error) => {
            console.log('[authStore] setError:', error);
            set({ error });
        },

        setResettingPassword: (isResettingPassword) => {
            console.log('[authStore] setResettingPassword:', isResettingPassword);
            set({ isResettingPassword });
        },

        signIn: async (email, password) => {
            console.log('[authStore] signIn started - email:', email);
            try {
                set({ isLoading: true, error: null });

                // Reset data when switching accounts
                const previousUser = get().user;
                const { session, user } = await authService.signIn(email, password);
                console.log('[authStore] signIn success - user:', user?.email);

                if (previousUser && previousUser.id !== user?.id) {
                    console.log('[authStore] Different user - resetting profile and tasks');
                    useUserProfileStore.getState().resetProfile();
                    useTaskStore.getState().resetTasks();
                }

                const profileStore = useUserProfileStore.getState();
                if (!profileStore.userName) {
                    profileStore.setUserName(user?.email?.split('@')[0] || '');
                }

                // Sync onboarding state from DB (authoritative source)
                await syncUserProfile(user.id);

                set({
                    session,
                    user,
                    isAuthenticated: true,
                    isLoading: false,
                });
            } catch (error: unknown) {
                console.log('[authStore] signIn error:', error);
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
            console.log('[authStore] signUp started - email:', email);
            try {
                set({ isLoading: true, error: null });
                const { session, user } = await authService.signUp(email, password);
                console.log('[authStore] signUp success - user:', user?.email);

                const profileStore = useUserProfileStore.getState();
                profileStore.setUserName(user?.email?.split('@')[0] || '');

                if (user) {
                    await profileService.getOrCreateProfile(user.id);
                }

                set({
                    session,
                    user,
                    isAuthenticated: !!session,
                    isLoading: false,
                });
            } catch (error: unknown) {
                console.log('[authStore] signUp error:', error);
                const appError = toAppError(error);
                set({ error: appError.message, isLoading: false });
                throw error;
            }
        },

        signInWithGoogle: async () => {
            console.log('[authStore] signInWithGoogle started');
            try {
                set({ isLoading: true, error: null });
                const data = await authService.signInWithGoogle();
                console.log('[authStore] signInWithGoogle success');
                const session = data?.session ?? null;
                const user = data?.user ?? session?.user ?? null;

                if (user) {
                    const profileStore = useUserProfileStore.getState();
                    if (!profileStore.userName) {
                        profileStore.setUserName(user.email?.split('@')[0] || '');
                    }
                    // Sync onboarding state — critical for returning users signing in via OAuth
                    await syncUserProfile(user.id);
                }

                set({
                    session,
                    user,
                    isAuthenticated: !!session,
                    isLoading: false,
                });
            } catch (error: unknown) {
                console.log('[authStore] signInWithGoogle error:', error);
                const appError = toAppError(error);
                set({ error: appError.message, isLoading: false });
                throw error;
            }
        },

        signInWithApple: async () => {
            console.log('[authStore] signInWithApple started');
            try {
                set({ isLoading: true, error: null });
                const data = await authService.signInWithApple();
                console.log('[authStore] signInWithApple success');
                const session = data?.session ?? null;
                const user = data?.user ?? session?.user ?? null;

                if (user) {
                    const profileStore = useUserProfileStore.getState();
                    if (!profileStore.userName) {
                        profileStore.setUserName(user.email?.split('@')[0] || '');
                    }
                    // Sync onboarding state — critical for returning users signing in via OAuth
                    await syncUserProfile(user.id);
                }

                set({
                    session,
                    user,
                    isAuthenticated: !!session,
                    isLoading: false,
                });
            } catch (error: unknown) {
                console.log('[authStore] signInWithApple error:', error);
                const appError = toAppError(error);
                set({ error: appError.message, isLoading: false });
                throw error;
            }
        },

        signOut: async () => {
            console.log('[authStore] signOut started');
            try {
                set({ isLoading: true });
                await authService.signOut();
                console.log('[authStore] signOut success');

                // Reset all stores to clear previous account data
                useUserProfileStore.getState().resetProfile();
                useTaskStore.getState().resetTasks();
                useHobbyTimeStore.getState().reset();
                useQuizStore.getState().resetQuiz();
                useScreenTimeStore.getState().reset();
                useEarningsStore.getState().reset();
                useContentStore.getState().reset();
                useDeviceScreenTimeStore.getState().reset();
                useSubscriptionStore.getState().reset();

                set({
                    user: null,
                    session: null,
                    isAuthenticated: false,
                    isLoading: false,
                });
            } catch (error: unknown) {
                console.log('[authStore] signOut error:', error);
                const appError = toAppError(error);
                set({ error: appError.message, isLoading: false });
            }
        },

        initialize: async () => {
            // ── Step 1: register the Supabase auth listener ───────────────────
            // Done at most once for the entire app lifetime so we never accumulate
            // duplicate listeners.  The guard is set BEFORE the try so that even a
            // failure (e.g. missing env vars in CI / tests) does not cause retries
            // that would pile up more listeners in production hot-reload scenarios.
            if (!_isInitialized) {
                _isInitialized = true;
                try {
                    _authSubscription?.unsubscribe();
                    const { getSupabase } = require('../services/supabase/client');
                    const s = getSupabase();
                    const { data: { subscription } } = s.auth.onAuthStateChange(
                        (event: string, session: any) => {
                            if (event === 'SIGNED_IN') {
                                // Explicit sign-in actions (signIn / signInWithGoogle /
                                // signInWithApple) already manage their own isLoading.
                                // This branch handles magic-link / deep-link sign-ins
                                // where no explicit action is in flight.
                                set({ session, user: session?.user || null, isAuthenticated: true });
                            } else if (event === 'TOKEN_REFRESHED') {
                                // Keep the session token current after a background refresh
                                set({ session, user: session?.user || null });
                            } else if (event === 'SIGNED_OUT') {
                                set({ session: null, user: null, isAuthenticated: false, isResettingPassword: false });
                            } else if (event === 'PASSWORD_RECOVERY') {
                                set({ isResettingPassword: true });
                            }
                        }
                    );
                    _authSubscription = subscription;
                } catch (listenerError) {
                    // Non-fatal: no env vars in CI / test environments.
                    // Session restoration below still runs via the mocked authService.
                    console.warn('[authStore] Could not register auth listener:', listenerError);
                }
            }

            // ── Step 2: restore any existing persisted session ────────────────
            // Runs every time initialize() is called so tests can call it
            // multiple times without the guard short-circuiting session logic.
            try {
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

                    // Sync onboarding state BEFORE unblocking the UI so the routing
                    // guard never sees stale hasCompletedOnboarding:false for a user
                    // who already completed onboarding (e.g. after a reinstall or
                    // password-reset deep-link flow).
                    await syncUserProfile(session.user.id);

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
                console.error('[authStore] initialize error:', error);
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
                console.log('[authStore] deleteAccount starting...');
                set({ isLoading: true, error: null });
                await authService.deleteAccount();
                console.log('[authStore] authService.deleteAccount() returned success! Proceeding to signOut().');

                // After deleting the user from auth.users, server-side signOut may fail.
                // We catch that gracefully and still clear all local state.
                try {
                    await get().signOut();
                } catch (signOutError) {
                    console.warn('[authStore] signOut() after deleteAccount failed (expected if user was removed):', signOutError);
                    // Manually reset all stores since signOut() threw before doing it
                    useUserProfileStore.getState().resetProfile();
                    useTaskStore.getState().resetTasks();
                    useHobbyTimeStore.getState().reset();
                    useQuizStore.getState().resetQuiz();
                    useScreenTimeStore.getState().reset();
                    useEarningsStore.getState().reset();
                    useContentStore.getState().reset();
                    useDeviceScreenTimeStore.getState().reset();
                    useSubscriptionStore.getState().reset();
                    set({
                        user: null,
                        session: null,
                        isAuthenticated: false,
                        isLoading: false,
                    });
                }
                console.log('[authStore] signOut() completed successfully.');
            } catch (error: unknown) {
                console.error('[authStore] Delete account error caught:', error);
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
export type { SubscriptionLevel } from './userProfileStore';
