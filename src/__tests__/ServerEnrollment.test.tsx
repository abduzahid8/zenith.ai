/**
 * Enrollment truth unification — behavioral contracts (RNTL v14 async).
 *
 * Proves against the REAL screens + REAL credentialStore + REAL local
 * projection hook (only the network layer and the engine history fetch are
 * stubbed) that:
 *   A. server-enrolled + empty local cache → UI says enrolled;
 *   B. local flag true + server unenrolled → UI does NOT claim enrollment;
 *   C. tap CTA → existing server ensureEnrollment → refresh → enrolled UI,
 *      with no optimistic fake enrollment while the call is pending;
 *   G. Hub and Detail agree per program (same shared server read-model).
 */
import '@testing-library/jest-native/extend-expect';
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { CREDENTIAL_PROGRAMS } from '../domain/credentials/catalog';
import { useCredentialStore } from '../store/credentialStore';
import { CredentialsScreen } from '../screens/CredentialsScreen';
import { CredentialDetailScreen } from '../screens/CredentialDetailScreen';
import {
    ensureEnrollment,
    getCredentialProgress,
    getCredentialStatus,
    getProgramAvailability,
} from '../services/trustApi';

jest.mock('../services/trustApi', () => ({
    ensureEnrollment: jest.fn(),
    getCredentialProgress: jest.fn(),
    getCredentialStatus: jest.fn(),
    getProgramAvailability: jest.fn(),
}));
jest.mock('../theme/useAppTheme', () => ({
    useAppTheme: () => ({
        colors: { text: '#000', background: '#eee', surfaceLight: '#fff' },
    }),
}));
jest.mock('../store/languageStore', () => ({
    useT: () => (s: string) => s,
    useLanguageStore: () => ({ language: 'en' }),
    t: (s: string) => s,
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
// Detail imports credentialVerification → supabase/client →
// react-native-url-polyfill/auto (untransformed ESM in node_modules).
// Verification is out of scope here (locked status ⇒ never called).
jest.mock('../services/credentialVerification', () => ({
    verifyCredentialPublic: jest.fn(async () => ({ found: false, credential: null })),
}));
jest.mock('expo-router', () => ({
    useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
    useLocalSearchParams: () => ({ slug: 'chess-foundations' }),
    useSegments: () => ['(app)'],
}));
jest.mock('../store/taskStore', () => ({
    useTaskStore: (sel: (s: unknown) => unknown) =>
        sel({ snapshot: null, dailyTasks: [] }),
}));
jest.mock('../hooks/useCredentialEngine', () => ({
    useCredentialEngine: () => ({
        tasks: [],
        sessions: [],
        streakDays: 0,
        userId: 'u',
        currentDay: {},
        unitProgress: {},
    }),
}));
jest.mock('../hooks/useLearningIntelligence', () => ({
    useLearningIntelligence: () => ({ recommendation: null, program: null }),
}));

const mockEnsure = ensureEnrollment as jest.Mock;
const mockProgress = getCredentialProgress as jest.Mock;
const mockStatus = getCredentialStatus as jest.Mock;
const mockAvailability = getProgramAvailability as jest.Mock;

const CHESS = 'chess-foundations';
const AVAIL_ALL = () =>
    CREDENTIAL_PROGRAMS.map(p => ({ slug: p.slug, issuable: true, programVersion: 'v9' }));
const LOCKED = {
    state: 'locked',
    credentialId: null,
    score: null,
    grade: null,
    issuedAt: null,
    expiresAt: null,
};

function mockServer(opts: { enrolledSlugs?: string[] } = {}) {
    mockAvailability.mockResolvedValue(AVAIL_ALL());
    mockStatus.mockImplementation(async () => ({ ...LOCKED }));
    mockProgress.mockImplementation(async (slug: string) =>
        opts.enrolledSlugs?.includes(slug) ? { status: 'active' } : null,
    );
}

beforeEach(() => {
    jest.clearAllMocks();
    useCredentialStore.setState({ programs: {} });
    mockEnsure.mockResolvedValue({ enrolled: true, alreadyEnrolled: false });
    mockServer();
});

describe('Hub enrollment truth', () => {
    it('A+G: server-enrolled chess shows enrolled even with an empty local cache', async () => {
        mockServer({ enrolledSlugs: [CHESS] });
        const screen = await render(<CredentialsScreen />);
        await waitFor(() => {
            // Chess enrolled → detail affordance; the other four → enroll CTA.
            expect(screen.getAllByText('Подробнее')).toHaveLength(1);
            expect(screen.getAllByText('Начать проверку')).toHaveLength(
                CREDENTIAL_PROGRAMS.length - 1,
            );
        });
        expect(mockEnsure).not.toHaveBeenCalled();
    });

    it('B: stale local flags for every program do NOT claim enrollment', async () => {
        for (const p of CREDENTIAL_PROGRAMS) useCredentialStore.getState().enroll(p.slug);
        const screen = await render(<CredentialsScreen />);
        await waitFor(() => {
            expect(screen.getAllByText('Начать проверку')).toHaveLength(CREDENTIAL_PROGRAMS.length);
        });
        expect(screen.queryByText('Подробнее')).toBeNull();
        expect(mockEnsure).not.toHaveBeenCalled();
    });

    it('C: tap CTA → server ensureEnrollment → refresh → enrolled UI, never optimistic', async () => {
        const target = CREDENTIAL_PROGRAMS[0].slug;
        let resolveEnsure!: (v: unknown) => void;
        mockEnsure.mockImplementation(
            () =>
                new Promise(resolve => {
                    resolveEnsure = resolve;
                }),
        );
        const screen = await render(<CredentialsScreen />);
        await waitFor(() => {
            expect(screen.getAllByText('Начать проверку')).toHaveLength(CREDENTIAL_PROGRAMS.length);
        });

        await fireEvent.press(screen.getAllByText('Начать проверку')[0]);
        expect(mockEnsure).toHaveBeenCalledWith(target);
        // Pending: no fake enrollment anywhere.
        expect(useCredentialStore.getState().programs[target]?.enrolled ?? false).toBe(false);

        // Server confirms; refresh re-reads truth (now enrolled).
        mockProgress.mockImplementation(async (slug: string) =>
            slug === target ? { status: 'active' } : null,
        );
        await act(async () => {
            resolveEnsure({ enrolled: true, alreadyEnrolled: false });
        });
        await waitFor(() => {
            expect(screen.getAllByText('Подробнее')).toHaveLength(1);
        });
        // Post-authority local cache mirror (cache only, never authority).
        expect(useCredentialStore.getState().programs[target]?.enrolled).toBe(true);
    });
});

describe('Detail enrollment truth', () => {
    it('A+G: server-enrolled chess shows the journey with an empty local cache', async () => {
        mockServer({ enrolledSlugs: [CHESS] });
        const screen = await render(<CredentialDetailScreen />);
        await waitFor(() => {
            expect(screen.getByText('Learning journey')).toBeTruthy();
        });
        expect(screen.queryByText('Начать проверку')).toBeNull();
        expect(mockEnsure).not.toHaveBeenCalled();
    });

    it('B: stale local flag does NOT claim enrollment on Detail', async () => {
        useCredentialStore.getState().enroll(CHESS);
        const screen = await render(<CredentialDetailScreen />);
        await waitFor(() => {
            expect(screen.getByText('Начать проверку')).toBeTruthy();
        });
        expect(screen.queryByText('Learning journey')).toBeNull();
        expect(mockEnsure).not.toHaveBeenCalled();
    });

    it('C: Detail CTA enrolls via server, then refreshes — never optimistic', async () => {
        let resolveEnsure!: (v: unknown) => void;
        mockEnsure.mockImplementation(
            () =>
                new Promise(resolve => {
                    resolveEnsure = resolve;
                }),
        );
        const screen = await render(<CredentialDetailScreen />);
        await waitFor(() => {
            expect(screen.getByText('Начать проверку')).toBeTruthy();
        });

        await fireEvent.press(screen.getByText('Начать проверку'));
        expect(mockEnsure).toHaveBeenCalledWith(CHESS);
        expect(useCredentialStore.getState().programs[CHESS]?.enrolled ?? false).toBe(false);

        mockProgress.mockImplementation(async () => ({ status: 'active' }));
        await act(async () => {
            resolveEnsure({ enrolled: true, alreadyEnrolled: false });
        });
        await waitFor(() => {
            expect(screen.getByText('Learning journey')).toBeTruthy();
        });
        expect(useCredentialStore.getState().programs[CHESS]?.enrolled).toBe(true);
    });
});
