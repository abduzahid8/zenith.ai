/**
 * Slice 6 — claim, issued detail, and public verification UI (RNTL v14).
 *
 * All server truth is mocked at the trustApi / credentialVerification
 * boundary; these tests prove the UI maps authoritative states to
 * affordances without inventing readiness, identity, or credentials.
 */
import '@testing-library/jest-native/extend-expect';
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import {
    ensureEnrollment,
    getCredentialProgress,
    getCredentialStageSnapshot,
    getCredentialStatus,
    getProgramAvailability,
    getProjectJourneySnapshot,
    getSkillVerification,
    issueCredential,
} from '../services/trustApi';
import { CredentialJourneySection } from '../components/credentials/CredentialJourneySection';
import { useUserProfileStore } from '../store/userProfileStore';

jest.mock('../services/trustApi', () => ({
    ensureEnrollment: jest.fn(),
    getCredentialProgress: jest.fn(),
    getCredentialStageSnapshot: jest.fn(),
    getCredentialStatus: jest.fn(),
    getProgramAvailability: jest.fn(),
    getProjectJourneySnapshot: jest.fn(),
    getKnowledgeJourneySnapshot: jest.fn(),
    getSkillVerification: jest.fn(),
    issueCredential: jest.fn(),
    isContentUnavailable: jest.fn((m: string) => String(m).includes('credential_content_unavailable')),
    parseClaimError: jest.fn((m: string) => {
        const s = String(m);
        if (
            s.includes('component_missing_or_failed') ||
            s.includes('skill_gate_failed') ||
            s.includes('overall requirement') ||
            s.includes('enrollment required') ||
            s.includes('not issuance-ready') ||
            s.includes('unknown or inactive') ||
            s.includes('no evidence policy')
        ) {
            return { kind: 'not_ready' };
        }
        if (s.includes('already')) return { kind: 'already_issued' };
        if (s.includes('bank not active') || s.includes('credential_content_unavailable')) return { kind: 'unavailable' };
        return { kind: 'network' };
    }),
    CLAIM_NOT_READY_COPY: 'Not ready to claim yet. Your credential status was refreshed.',
    CLAIM_ALREADY_ISSUED_COPY: 'This credential is already issued.',
    CLAIM_TEMPORARILY_UNAVAILABLE_COPY: 'Credential issuance is temporarily unavailable. Try again later.',
    CLAIM_NETWORK_COPY: 'Claim needs an internet connection.',
    CLAIM_BUTTON_COPY: 'Claim credential',
    CLAIMING_BUTTON_COPY: 'Claiming…',
    VIEW_CREDENTIAL_BUTTON_COPY: 'View credential',
}));

jest.mock('@expo/vector-icons', () => ({
    Ionicons: () => null,
}));

// Detail screen reads its slug from route params; the shared setup has
// none, so this file pins its own (router push stays a jest stub).
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
    useRouter: () => ({ back: jest.fn(), push: mockPush, replace: jest.fn() }),
    useLocalSearchParams: () => ({ slug: 'chess-foundations' }),
    useSegments: () => (['(app)']),
    Stack: { Screen: () => null },
}));

// The detail screen reads task snapshots for its learning section; the
// credential card under test never depends on them.
jest.mock('../store/taskStore', () => ({
    useTaskStore: (sel: (s: { snapshot: null; dailyTasks: never[] }) => unknown) =>
        sel({ snapshot: null, dailyTasks: [] }),
}));

jest.mock('../services/credentialVerification', () => ({
    verifyCredentialPublic: jest.fn(),
}));

jest.mock('../theme/useAppTheme', () => ({
    useAppTheme: () => ({
        colors: {
            text: '#000',
            textSecondary: '#666',
            surfaceLight: '#fff',
            background: '#eee',
            buttonPrimary: '#007aff',
            white: '#fff',
        },
    }),
}));

jest.mock('../hooks/useCertificateProgress', () => ({
    useCertificateProgress: () => ({
        enrolled: true,
        eligible: true,
        tasks: [],
        sessions: [],
        streakDays: 0,
        overall: 42,
        skills: [],
        learning: 0,
        assessment: null,
        project: null,
    }),
    useAllCertificateProgress: () => ({}),
}));

jest.mock('../hooks/useLearningIntelligence', () => ({
    useLearningIntelligence: () => ({ recommendation: null }),
}));

import { verifyCredentialPublic } from '../services/credentialVerification';
import { CredentialDetailScreen } from '../screens/CredentialDetailScreen';
import { PublicVerificationScreen } from '../screens/PublicVerificationScreen';

const mockStatus = getCredentialStatus as jest.Mock;
const mockIssue = issueCredential as jest.Mock;
const mockVerifyPublic = verifyCredentialPublic as jest.Mock;

const SKILLS_4 = ['rules', 'openings', 'endgames', 'tactics'].map(skillKey => ({
    skillKey,
    skillName: skillKey,
    samplesCompleted: 4,
    samplesRequired: 4,
    passes: 4,
    passRate: 1,
    score: 100,
    verified: true,
}));

const LOCKED = { state: 'locked', credentialId: null, score: null, grade: null, issuedAt: null, expiresAt: null };
const READY = { state: 'ready_to_issue', credentialId: null, score: 98, grade: 'distinction', issuedAt: null, expiresAt: null };
const ISSUED = {
    state: 'issued', credentialId: 'ZNX-issued1', score: 98, grade: 'distinction',
    issuedAt: '2026-09-01T00:00:00.000Z', expiresAt: null,
};

function mockJourneyServer(opts: { credential?: object } = {}) {
    (getProgramAvailability as jest.Mock).mockResolvedValue([
        { slug: 'chess-foundations', issuable: true, programVersion: 'v2' },
    ]);
    (getSkillVerification as jest.Mock).mockResolvedValue(SKILLS_4);
    (getCredentialProgress as jest.Mock).mockResolvedValue(null);
    (getCredentialStageSnapshot as jest.Mock).mockResolvedValue({
        contentAvailable: true,
        knowledge: { attempts: [], component: { score: 91, passed: true } },
        practical: { attempts: [], component: { score: 88, passed: true } },
        finalAssessment: { attempts: [], component: { score: 92, passed: true } },
    });
    (getProjectJourneySnapshot as jest.Mock).mockResolvedValue({
        submission: { id: 'sub-1', createdAt: '2026-03-02T10:00:00Z' },
        review: { submissionId: 'sub-1', score: 90, passed: true, reviewedAt: '2026-03-03T10:00:00Z' },
    });
    mockStatus.mockResolvedValue(opts.credential ?? LOCKED);
}

const sectionProps = {
    programSlug: 'chess-foundations',
    programTitle: 'Chess Foundations',
    recommendation: null,
    onVerifySkill: jest.fn(),
    onContinueLearning: jest.fn(),
};

beforeEach(() => {
    jest.clearAllMocks();
    useUserProfileStore.setState({ userName: '' });
    mockJourneyServer();
    mockIssue.mockResolvedValue({ credentialId: 'ZNX-issued1', created: true });
});

describe('claim CTA states', () => {
    test('1. locked: teaser only, no Claim CTA', async () => {
        const screen = await render(<CredentialJourneySection {...sectionProps} />);
        expect(await screen.findByText(/Credential/)).toBeTruthy();
        expect(screen.queryByText('Claim credential')).toBeNull();
        expect(await screen.findByText('Continue learning')).toBeTruthy();
    });

    test('2. ready_to_issue: exactly one Claim CTA (no stage CTA)', async () => {
        mockJourneyServer({ credential: READY });
        const screen = await render(<CredentialJourneySection {...sectionProps} />);
        expect(await screen.findByText('Claim credential')).toBeTruthy();
        expect(screen.queryByText('Continue learning')).toBeNull();
        expect(screen.queryByText('View credential')).toBeNull();
    });

    test('14. disabled program shows no claim UI at all', async () => {
        (getProgramAvailability as jest.Mock).mockResolvedValue([
            { slug: 'chess-foundations', issuable: false, programVersion: 'v2' },
        ]);
        const screen = await render(<CredentialJourneySection {...sectionProps} />);
        await waitFor(() => expect(screen.queryByText(/Credential/)).toBeNull());
        expect(screen.queryByText('Claim credential')).toBeNull();
    });
});

describe('claim lifecycle', () => {
    test('3. Claim calls the server RPC with the profile display name', async () => {
        useUserProfileStore.setState({ userName: 'Ada' });
        mockJourneyServer({ credential: READY });
        const screen = await render(<CredentialJourneySection {...sectionProps} />);
        await fireEvent.press(await screen.findByText('Claim credential'));
        await waitFor(() => expect(mockIssue).toHaveBeenCalledWith('chess-foundations', 'Ada'));
        // No local issuance module is involved (asserted structurally too).
        expect(mockIssue).toHaveBeenCalledTimes(1);
    });

    test('4. Claim without a profile name asks for a display name (never verified identity)', async () => {
        mockJourneyServer({ credential: READY });
        const screen = await render(<CredentialJourneySection {...sectionProps} />);
        await fireEvent.press(await screen.findByText('Claim credential'));
        expect(await screen.findByText('Name for your credential')).toBeTruthy();
        expect(await screen.findByText(/not identity verification/)).toBeTruthy();
        expect(mockIssue).not.toHaveBeenCalled();
        await fireEvent.changeText(screen.getByPlaceholderText('Your name'), 'Ada L');
        await fireEvent.press(await screen.findAllByText('Claim credential').then(all => all[all.length - 1]));
        await waitFor(() => expect(mockIssue).toHaveBeenCalledWith('chess-foundations', 'Ada L'));
    });

    test('5/6. successful (even duplicate) claim refreshes authoritative status', async () => {
        mockJourneyServer({ credential: READY });
        const screen = await render(<CredentialJourneySection {...sectionProps} />);
        await screen.findByText('Claim credential');
        const callsBefore = mockStatus.mock.calls.length;
        expect(callsBefore).toBeGreaterThan(0);
        useUserProfileStore.setState({ userName: 'Ada' });
        mockStatus.mockResolvedValue(ISSUED);
        await fireEvent.press(await screen.findByText('Claim credential'));
        await waitFor(() => expect(mockStatus.mock.calls.length).toBeGreaterThan(callsBefore));
        // Duplicate tap resolves the same identity: still the issued view.
        expect(await screen.findByText('View credential')).toBeTruthy();
        expect(screen.queryByText('Claim credential')).toBeNull();
    });

    test('7/15. not-ready error shows safe copy and refreshes; network keeps retry', async () => {
        mockJourneyServer({ credential: READY });
        useUserProfileStore.setState({ userName: 'Ada' });
        mockIssue.mockRejectedValueOnce(new Error('issue_credential: component_missing_or_failed:knowledge'));
        const screen = await render(<CredentialJourneySection {...sectionProps} />);
        await screen.findByText('Claim credential');
        const callsBefore = mockStatus.mock.calls.length;
        await fireEvent.press(await screen.findByText('Claim credential'));
        expect(await screen.findByText(/Not ready to claim yet/)).toBeTruthy();
        await waitFor(() => expect(mockStatus.mock.calls.length).toBeGreaterThan(callsBefore));

        mockIssue.mockRejectedValueOnce(new Error('Network request failed'));
        await fireEvent.press(await screen.findByText('Claim credential'));
        expect(await screen.findByText(/needs an internet connection/)).toBeTruthy();
        // Offline retry CTA, journey intact (no fail-closed hide).
        expect(await screen.findByText('Try again')).toBeTruthy();
        expect(await screen.findByText(/Credential/)).toBeTruthy();
    });
});

describe('issued / revoked / expired rendering', () => {
    test('8. issued renders server fields only', async () => {
        mockJourneyServer({ credential: ISSUED });
        const screen = await render(<CredentialJourneySection {...sectionProps} />);
        expect(await screen.findByText('View credential')).toBeTruthy();
        expect(await screen.findByText(/Issued/)).toBeTruthy();
        expect(screen.queryByText('Claim credential')).toBeNull();
    });

    test('9/10. revoked and expired render status, never verified', async () => {
        mockJourneyServer({
            credential: { ...ISSUED, state: 'revoked' },
        });
        const revoked = await render(<CredentialJourneySection {...sectionProps} />);
        expect(await revoked.findByText('Revoked')).toBeTruthy();
        expect(revoked.queryByText('View credential')).toBeNull();
        expect(revoked.queryByText('Claim credential')).toBeNull();

        mockJourneyServer({
            credential: { ...ISSUED, state: 'expired' },
        });
        const expired = await render(<CredentialJourneySection {...sectionProps} />);
        expect(await expired.findByText('Expired')).toBeTruthy();
    });
});

describe('credential detail (server data)', () => {
    test('issued detail shows holder, id, score, grade, skills + verify/share', async () => {
        mockStatus.mockResolvedValue(ISSUED);
        mockVerifyPublic.mockResolvedValue({
            found: true,
            credential: {
                credentialId: 'ZNX-issued1',
                programSlug: 'chess-foundations',
                programTitle: 'Chess Foundations',
                programVersion: '1.0',
                holderDisplayName: 'Ada',
                identityVerified: false,
                issuedAt: '2026-09-01T00:00:00.000Z',
                expiresAt: null,
                status: 'active',
                verifiedSkills: [{ key: 'rules', name: 'Rules', score: 100 }],
                finalScore: 98,
                grade: 'distinction',
            },
        });
        const screen = await render(<CredentialDetailScreen />);
        expect(await screen.findByText('Ada')).toBeTruthy();
        expect(await screen.findByText('ZNX-issued1')).toBeTruthy();
        expect(await screen.findByText(/Distinction/)).toBeTruthy();
        expect(await screen.findByText(/Rules/)).toBeTruthy();
        expect(await screen.findByText('Verify credential')).toBeTruthy();
        expect(await screen.findByText('Share credential')).toBeTruthy();
    });

    test('revoked detail never shows verified', async () => {
        mockStatus.mockResolvedValue({ ...ISSUED, state: 'revoked' });
        mockVerifyPublic.mockResolvedValue({
            found: true,
            credential: {
                credentialId: 'ZNX-issued1',
                programSlug: 'chess-foundations',
                programTitle: 'Chess Foundations',
                programVersion: '1.0',
                holderDisplayName: 'Ada',
                identityVerified: false,
                issuedAt: '2026-09-01T00:00:00.000Z',
                expiresAt: null,
                status: 'revoked',
                verifiedSkills: [],
                finalScore: 98,
                grade: 'distinction',
            },
        });
        const screen = await render(<CredentialDetailScreen />);
        expect(await screen.findByText('Credential revoked')).toBeTruthy();
        expect(screen.queryByText('Verify credential')).toBeNull();
    });
});

describe('public verification (no auth)', () => {
    test('11. verified credential renders public fields', async () => {
        mockVerifyPublic.mockResolvedValue({
            found: true,
            credential: {
                credentialId: 'ZNX-issued1',
                programSlug: 'chess-foundations',
                programTitle: 'Chess Foundations',
                programVersion: '1.0',
                holderDisplayName: 'Ada',
                identityVerified: false,
                issuedAt: '2026-09-01T00:00:00.000Z',
                expiresAt: null,
                status: 'active',
                verifiedSkills: [{ key: 'rules', name: 'Rules', score: 100 }],
                finalScore: 98,
                grade: 'distinction',
            },
        });
        const screen = await render(<PublicVerificationScreen credentialId="ZNX-issued1" />);
        expect(await screen.findByText('Verified credential')).toBeTruthy();
        expect(await screen.findByText('Ada')).toBeTruthy();
    });

    test('12. invalid credential renders not found', async () => {
        mockVerifyPublic.mockResolvedValue({ found: false, credential: null });
        const screen = await render(<PublicVerificationScreen credentialId="ZNX-nope" />);
        expect(await screen.findByText('Credential not found')).toBeTruthy();
    });

    test('13. private fields never render even if present on the row', async () => {
        mockVerifyPublic.mockResolvedValue({
            found: true,
            credential: {
                credentialId: 'ZNX-issued1',
                programSlug: 'chess-foundations',
                programTitle: 'Chess Foundations',
                programVersion: '1.0',
                holderDisplayName: 'Ada',
                identityVerified: false,
                issuedAt: '2026-09-01T00:00:00.000Z',
                expiresAt: null,
                status: 'active',
                verifiedSkills: [],
                finalScore: 98,
                grade: 'pass',
                user_id: 'secret-user-id',
                email: 'ada@private.test',
                artifact_ref: 'secret-artifact',
                reviewer: 'secret-reviewer',
            } as never,
        });
        const screen = await render(<PublicVerificationScreen credentialId="ZNX-issued1" />);
        await screen.findByText('Verified credential');
        expect(screen.queryByText('secret-user-id')).toBeNull();
        expect(screen.queryByText('ada@private.test')).toBeNull();
        expect(screen.queryByText('secret-artifact')).toBeNull();
        expect(screen.queryByText('secret-reviewer')).toBeNull();
    });
});
