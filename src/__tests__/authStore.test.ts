import { useAuthStore } from '../store/authStore';
import { useUserProfileStore } from '../store/userProfileStore';

// ─── Mock services ───────────────────────────────────
const mockSignIn = jest.fn();
const mockSignUp = jest.fn();
const mockSignOut = jest.fn();
const mockGetSession = jest.fn();
const mockGetUserHobbies = jest.fn();

jest.mock('../services/supabase', () => ({
    authService: {
        signIn: (...args: unknown[]) => mockSignIn(...args),
        signUp: (...args: unknown[]) => mockSignUp(...args),
        signOut: (...args: unknown[]) => mockSignOut(...args),
        getSession: (...args: unknown[]) => mockGetSession(...args),
    },
    dbService: {
        getUserHobbies: (...args: unknown[]) => mockGetUserHobbies(...args),
    },
}));

// ─── Helpers ─────────────────────────────────────────

const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    aud: 'authenticated',
    created_at: '2023-01-01',
};

const mockSession = {
    user: mockUser,
    access_token: 'token-abc',
    refresh_token: 'refresh-xyz',
};

// ─── Reset ───────────────────────────────────────────

beforeEach(() => {
    jest.clearAllMocks();

    useAuthStore.setState({
        user: null,
        session: null,
        isLoading: false,
        isAuthenticated: false,
        error: null,
    });

    useUserProfileStore.setState({
        userName: '',
        streakDays: 0,
        subscriptionLevel: 'free',
        lastSessionDate: null,
        isPremium: false,
        selectedHobby: null,
        hasCompletedOnboarding: false,
        weeklyTasks: [],
    });
});

// ─── signIn ──────────────────────────────────────────

describe('useAuthStore — signIn', () => {
    it('sets authenticated state on success', async () => {
        mockSignIn.mockResolvedValue({ session: mockSession, user: mockUser });
        mockGetUserHobbies.mockResolvedValue([{ hobby_id: 'chess', is_primary: true }]);

        await useAuthStore.getState().signIn('test@example.com', 'password');

        const state = useAuthStore.getState();
        expect(state.isAuthenticated).toBe(true);
        expect(state.user?.id).toBe('user-123');
        expect(state.session).toBeTruthy();
        expect(state.isLoading).toBe(false);
        expect(state.error).toBeNull();
    });

    it('sets userName from email prefix', async () => {
        mockSignIn.mockResolvedValue({ session: mockSession, user: mockUser });
        mockGetUserHobbies.mockResolvedValue([]);

        await useAuthStore.getState().signIn('test@example.com', 'password');

        expect(useUserProfileStore.getState().userName).toBe('test');
    });

    it('maps "Invalid login credentials" to Russian error', async () => {
        mockSignIn.mockRejectedValue(new Error('Invalid login credentials'));

        await expect(
            useAuthStore.getState().signIn('bad@email.com', 'wrong')
        ).rejects.toThrow('Неверный email или пароль.');

        expect(useAuthStore.getState().error).toBe('Неверный email или пароль.');
        expect(useAuthStore.getState().isLoading).toBe(false);
    });

    it('maps "Email not confirmed" to Russian error', async () => {
        mockSignIn.mockRejectedValue(new Error('Email not confirmed'));

        await expect(
            useAuthStore.getState().signIn('un@confirmed.com', 'pass')
        ).rejects.toThrow('Email не подтвержден. Проверьте почту.');
    });

    it('handles non-Error throw gracefully', async () => {
        mockSignIn.mockRejectedValue('network failure');

        await expect(
            useAuthStore.getState().signIn('a@b.com', 'p')
        ).rejects.toThrow('Unknown error');

        expect(useAuthStore.getState().error).toBe('Unknown error');
    });
});

// ─── signUp ──────────────────────────────────────────

describe('useAuthStore — signUp', () => {
    it('sets authenticated state on success with session', async () => {
        mockSignUp.mockResolvedValue({ session: mockSession, user: mockUser });

        await useAuthStore.getState().signUp('new@user.com', 'password123');

        const state = useAuthStore.getState();
        expect(state.isAuthenticated).toBe(true);
        expect(state.user?.id).toBe('user-123');
        expect(state.isLoading).toBe(false);
    });

    it('handles signup without session (email confirmation required)', async () => {
        mockSignUp.mockResolvedValue({ session: null, user: mockUser });

        await useAuthStore.getState().signUp('new@user.com', 'password123');

        const state = useAuthStore.getState();
        expect(state.isAuthenticated).toBe(false);
        expect(state.isLoading).toBe(false);
    });

    it('re-throws on error and sets error state', async () => {
        mockSignUp.mockRejectedValue(new Error('User already registered'));

        await expect(
            useAuthStore.getState().signUp('existing@user.com', 'pass')
        ).rejects.toThrow();

        expect(useAuthStore.getState().error).toBe('User already registered');
    });
});

// ─── signOut ─────────────────────────────────────────

describe('useAuthStore — signOut', () => {
    it('clears auth state on success', async () => {
        // Pre-populate logged-in state
        useAuthStore.setState({
            user: mockUser as any,
            session: mockSession as any,
            isAuthenticated: true,
        });

        mockSignOut.mockResolvedValue(undefined);

        await useAuthStore.getState().signOut();

        const state = useAuthStore.getState();
        expect(state.user).toBeNull();
        expect(state.session).toBeNull();
        expect(state.isAuthenticated).toBe(false);
    });

    it('sets error when signOut fails', async () => {
        mockSignOut.mockRejectedValue(new Error('Network error'));

        await useAuthStore.getState().signOut();

        expect(useAuthStore.getState().error).toBe('Network error');
        expect(useAuthStore.getState().isLoading).toBe(false);
    });
});

// ─── initialize ──────────────────────────────────────

describe('useAuthStore — initialize', () => {
    it('restores session on init', async () => {
        mockGetSession.mockResolvedValue(mockSession);
        mockGetUserHobbies.mockResolvedValue([{ hobby_id: 'chess', is_primary: true }]);

        await useAuthStore.getState().initialize();

        const state = useAuthStore.getState();
        expect(state.isAuthenticated).toBe(true);
        expect(state.user?.id).toBe('user-123');
        expect(state.isLoading).toBe(false);
    });

    it('stays unauthenticated when no session', async () => {
        mockGetSession.mockResolvedValue(null);

        await useAuthStore.getState().initialize();

        const state = useAuthStore.getState();
        expect(state.isAuthenticated).toBe(false);
        expect(state.isLoading).toBe(false);
    });

    it('syncs onboarding state from hobbies', async () => {
        mockGetSession.mockResolvedValue(mockSession);
        mockGetUserHobbies.mockResolvedValue([
            { hobby_id: 'chess', is_primary: true },
        ]);

        await useAuthStore.getState().initialize();

        const profile = useUserProfileStore.getState();
        expect(profile.hasCompletedOnboarding).toBe(true);
        expect(profile.selectedHobby).toBe('chess');
    });

    it('handles getSession failure gracefully', async () => {
        mockGetSession.mockRejectedValue(new Error('Network down'));

        await useAuthStore.getState().initialize();

        expect(useAuthStore.getState().isLoading).toBe(false);
    });
});
