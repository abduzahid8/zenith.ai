/**
 * Learning Progress truth — Detail hero regression (RNTL v14 async).
 *
 * The Detail "Learning journey" hero previously rendered
 * `cert.overall` (local certification projection) under the kicker
 * "Подтверждённый навык" (Verified skill): the label claimed one concept
 * while the math computed another. The hero now consumes the existing
 * `cert.learning` projection (curriculum consumed — concept B) under a
 * non-verified kicker. Verified numbers live only in the server
 * credential card. Hub cards keep rendering `overall` (contract preserved).
 */
import '@testing-library/jest-native/extend-expect';
import React from 'react';
import * as fs from 'fs';
import * as path from 'path';
import { render, waitFor } from '@testing-library/react-native';
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
jest.mock('../store/taskStore', () => ({
    useTaskStore: (sel: (s: unknown) => unknown) =>
        sel({ snapshot: null, dailyTasks: [] }),
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('expo-router', () => ({
    useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
    useLocalSearchParams: () => ({ slug: 'chess-foundations' }),
    useSegments: () => ['(app)'],
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
// overall (certification) and learning (curriculum consumed) deliberately
// differ so the hero source is observable.
jest.mock('../hooks/useCertificateProgress', () => ({
    useCertificateProgress: () => ({
        enrolled: true,
        eligible: true,
        tasks: [],
        sessions: [],
        streakDays: 0,
        overall: 80,
        skills: [],
        learning: 35,
        assessment: null,
        project: null,
    }),
    useAllCertificateProgress: () => ({ 'chess-foundations': { overall: 80 } }),
}));
jest.mock('../services/credentialVerification', () => ({
    verifyCredentialPublic: jest.fn(async () => ({ found: false, credential: null })),
}));

const mockProgress = getCredentialProgress as jest.Mock;
const mockStatus = getCredentialStatus as jest.Mock;
const mockAvailability = getProgramAvailability as jest.Mock;

const CHESS = 'chess-foundations';
const LOCKED = {
    state: 'locked',
    credentialId: null,
    score: null,
    grade: null,
    issuedAt: null,
    expiresAt: null,
};

beforeEach(() => {
    jest.clearAllMocks();
    useCredentialStore.setState({ programs: {} });
    mockAvailability.mockResolvedValue(
        ['chess-foundations', 'python-foundations', 'reading-mastery'].map(slug => ({
            slug,
            issuable: true,
            programVersion: 'v9',
        })),
    );
    mockStatus.mockImplementation(async () => ({ ...LOCKED }));
    // Server-enrolled chess; local cache stays empty (hero must not need it).
    mockProgress.mockImplementation(async (slug: string) =>
        slug === CHESS ? { status: 'active' } : null,
    );
});

describe('Detail Learning-journey hero truth', () => {
    it('hero shows curriculum-consumed learning, not the certification number', async () => {
        const screen = await render(<CredentialDetailScreen />);
        await waitFor(() => {
            expect(screen.getByText('Learning journey')).toBeTruthy();
        });
        expect(screen.getByText('35%')).toBeTruthy();
        expect(screen.queryByText('80%')).toBeNull();
    });

    it('local section makes no verified-skill claim', async () => {
        const screen = await render(<CredentialDetailScreen />);
        await waitFor(() => {
            expect(screen.getByText('Прогресс обучения')).toBeTruthy();
        });
        expect(screen.queryByText('Подтверждённый навык')).toBeNull();
    });

    it('consumer contract: Detail reads cert.learning, Hub keeps cert.overall', () => {
        const root = path.join(__dirname, '..', '..');
        const detail = fs.readFileSync(
            path.join(root, 'src/screens/CredentialDetailScreen.tsx'),
            'utf8',
        );
        const hub = fs.readFileSync(
            path.join(root, 'src/screens/CredentialsScreen.tsx'),
            'utf8',
        );
        expect(detail).toMatch(/cert\.learning/);
        expect(detail).not.toMatch(/cert\.overall/);
        expect(hub).toMatch(/Math\.round\(cert\.overall\)/);
    });
});

describe('Hub overall contract preserved', () => {
    it('Hub chess card still renders the certification number', async () => {
        const screen = await render(<CredentialsScreen />);
        await waitFor(() => {
            expect(screen.getByText('80%')).toBeTruthy();
        });
    });
});
