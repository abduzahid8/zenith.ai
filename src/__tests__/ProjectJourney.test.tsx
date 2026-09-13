/**
 * Slice 5 — Project experience (RNTL v14 async).
 *
 * Final PASS -> Project Ready -> submit -> Under review ->
 * Needs revision / Passed -> Credential teaser (non-interactive).
 * Server owns readiness, idempotency, revisions, and review authority;
 * the client only transports safe payloads and renders safe copy.
 */
import '@testing-library/jest-native/extend-expect';
import React from 'react';
import { render, fireEvent, waitFor, renderHook } from '@testing-library/react-native';
import {
    deriveFinalAssessmentState,
    deriveKnowledgeState,
    deriveNextAction,
    derivePracticalState,
    deriveProjectState,
    useCredentialJourney,
} from '../hooks/useCredentialJourney';
import { CredentialJourneySection } from '../components/credentials/CredentialJourneySection';
import {
    ensureEnrollment,
    getCredentialProgress,
    getCredentialStageSnapshot,
    getCredentialStatus,
    getProgramAvailability,
    getProjectJourneySnapshot,
    getSkillVerification,
    issueCredential,
    submitProject,
} from '../services/trustApi';

jest.mock('../services/trustApi', () => ({
    ensureEnrollment: jest.fn(),
    getCredentialProgress: jest.fn(),
    getCredentialStageSnapshot: jest.fn(),
    getCredentialStatus: jest.fn(),
    getKnowledgeJourneySnapshot: jest.fn(),
    getProgramAvailability: jest.fn(),
    getProjectJourneySnapshot: jest.fn(),
    getSkillVerification: jest.fn(),
    issueCredential: jest.fn(),
    startAssessment: jest.fn(),
    startKnowledgeAttempt: jest.fn(),
    startPracticalAttempt: jest.fn(),
    submitAssessment: jest.fn(),
    submitKnowledgeAttempt: jest.fn(),
    submitPracticalAttempt: jest.fn(),
    submitProject: jest.fn(),
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
    parseRetakeBlock: jest.fn((m: string) => {
        const match = /^retake_blocked:(cooldown|remediation_required)(?::(.*))?$/.exec(String(m));
        if (!match) return null;
        return { blocked: true, reason: match[1], detail: match[2] ?? null };
    }),
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

const mockEnsure = ensureEnrollment as jest.Mock;
const mockProgress = getCredentialProgress as jest.Mock;
const mockStage = getCredentialStageSnapshot as jest.Mock;
const mockAvailability = getProgramAvailability as jest.Mock;
const mockProjectSnap = getProjectJourneySnapshot as jest.Mock;
const mockSkills = getSkillVerification as jest.Mock;
const mockSubmitProject = submitProject as jest.Mock;
const mockCredentialStatus = getCredentialStatus as jest.Mock;
const mockIssueCredential = issueCredential as jest.Mock;

const SKILLS_4_OF_4 = [
    { skillKey: 'rules', skillName: 'Rules', samplesCompleted: 4, samplesRequired: 4, passes: 4, passRate: 1, score: 100, verified: true },
    { skillKey: 'openings', skillName: 'Openings', samplesCompleted: 4, samplesRequired: 4, passes: 4, passRate: 1, score: 100, verified: true },
    { skillKey: 'endgames', skillName: 'Endgames', samplesCompleted: 4, samplesRequired: 4, passes: 4, passRate: 1, score: 100, verified: true },
    { skillKey: 'tactics', skillName: 'Tactics', samplesCompleted: 4, samplesRequired: 4, passes: 4, passRate: 1, score: 100, verified: true },
];

function mockJourneyServer(opts: {
    issuable?: boolean;
    version?: string | null;
    skills?: typeof SKILLS_4_OF_4;
    progress?: null | object;
    contentAvailable?: boolean;
    knowledgeAttempts?: unknown[];
    knowledgeComponent?: null | object;
    practicalAttempts?: unknown[];
    practicalComponent?: null | object;
    finalAttempts?: unknown[];
    finalComponent?: null | object;
    projectSubmission?: null | object;
    projectReview?: null | object;
    projectFails?: boolean;
    /** Slice 6 server claim state. Defaults to locked (no claim UI). */
    credential?: null | object;
} = {}) {
    mockAvailability.mockResolvedValue([
        {
            slug: 'chess-foundations',
            issuable: opts.issuable ?? true,
            programVersion: 'version' in opts ? opts.version : 'v2',
        },
    ]);
    mockSkills.mockResolvedValue(opts.skills ?? SKILLS_4_OF_4);
    mockProgress.mockResolvedValue(opts.progress ?? null);
    const contentAvailable = opts.contentAvailable ?? true;
    mockStage.mockResolvedValue({
        contentAvailable,
        knowledge: {
            attempts: opts.knowledgeAttempts ?? [],
            component: opts.knowledgeComponent ?? null,
        },
        practical: {
            attempts: opts.practicalAttempts ?? [],
            component: opts.practicalComponent ?? null,
        },
        finalAssessment: {
            attempts: opts.finalAttempts ?? [],
            component: opts.finalComponent ?? null,
        },
    });
    if (opts.projectFails) {
        mockProjectSnap.mockRejectedValue(new Error('offline'));
    } else {
        mockProjectSnap.mockResolvedValue({
            submission: opts.projectSubmission ?? null,
            review: opts.projectReview ?? null,
        });
    }
    mockCredentialStatus.mockResolvedValue(
        opts.credential ?? {
            state: 'locked', credentialId: null, score: null, grade: null, issuedAt: null, expiresAt: null,
        },
    );
}

const K_PASS = {
    knowledgeComponent: { score: 91, passed: true },
    knowledgeAttempts: [{ id: 'k1', status: 'submitted', score: 91, passed: true, submittedAt: '2026-02-01' }],
};
const P_PASS = {
    practicalAttempts: [{ id: 'p1', status: 'submitted', score: 88, passed: true, submittedAt: '2026-02-02' }],
    practicalComponent: { score: 88, passed: true },
};
const F_PASS = {
    finalAttempts: [
        {
            id: 'f1', attemptNumber: 1, status: 'submitted', score: 92, passed: true,
            deadline: '2026-03-01T10:30:00Z', submittedAt: '2026-03-01T10:20:00Z',
        },
    ],
    finalComponent: { score: 92, passed: true },
};
const FULL_PASS = { ...K_PASS, ...P_PASS, ...F_PASS };
const SUB1 = { id: 'sub-1', createdAt: '2026-03-02T10:00:00Z' };
const FAIL_REV = { submissionId: 'sub-1', score: 40, passed: false, reviewedAt: '2026-03-03T10:00:00Z' };
const PASS_REV = { submissionId: 'sub-1', score: 90, passed: true, reviewedAt: '2026-03-03T10:00:00Z' };

const sectionProps = {
    programSlug: 'chess-foundations',
    programTitle: 'Chess Foundations',
    recommendation: null,
    onVerifySkill: jest.fn(),
    onContinueLearning: jest.fn(),
};

beforeEach(() => {
    jest.clearAllMocks();
    mockJourneyServer();
    sectionProps.onVerifySkill = jest.fn();
    sectionProps.onContinueLearning = jest.fn();
});

describe('project gate (pure + hook)', () => {
    test('1. Final not passed + no submission => Project locked', async () => {
        mockJourneyServer({ knowledgeComponent: { score: 91, passed: true } });
        const { result } = await renderHook(() => useCredentialJourney('chess-foundations', {}));
        await waitFor(() => expect(result.current.journey).not.toBeNull());
        expect(result.current.journey!.finalAssessment.state).toBe('locked');
        expect(result.current.journey!.project.state).toBe('locked');
        expect(
            deriveProjectState({ submission: null, review: null, finalPassed: false, unavailable: false }).state,
        ).toBe('locked');
        const screen = await render(<CredentialJourneySection {...sectionProps} />);
        await screen.findByText('Start Practical Check');
        expect(screen.queryByText('Project')).toBeNull();
    });

    test('2. current Final PASS + no submission => Project ready', async () => {
        mockJourneyServer({ ...FULL_PASS });
        const { result } = await renderHook(() => useCredentialJourney('chess-foundations', {}));
        await waitFor(() => expect(result.current.journey).not.toBeNull());
        expect(result.current.journey!.project).toMatchObject({ state: 'ready', submissionId: null });
        expect(result.current.journey!.nextAction).toEqual({ kind: 'submit_project' });
    });

    test('3. ready Project => single Submit Project CTA', async () => {
        mockJourneyServer({ ...FULL_PASS });
        const screen = await render(<CredentialJourneySection {...sectionProps} />);
        await screen.findByText('Submit Project');
        expect(screen.queryByText('Revise Project')).toBeNull();
        expect(screen.queryByText('Continue learning')).toBeNull();
        expect(screen.queryByText('Start Final Assessment')).toBeNull();
    });

    test('4. latest pending submission => under_review', async () => {
        mockJourneyServer({ ...FULL_PASS, projectSubmission: SUB1 });
        const { result } = await renderHook(() => useCredentialJourney('chess-foundations', {}));
        await waitFor(() => expect(result.current.journey).not.toBeNull());
        expect(result.current.journey!.project).toMatchObject({
            state: 'under_review',
            submissionId: 'sub-1',
            submittedAt: '2026-03-02T10:00:00Z',
        });
        const screen = await render(<CredentialJourneySection {...sectionProps} />);
        expect(await screen.findByText('Under review')).toBeTruthy();
    });

    test('5. under_review => no duplicate Project submit CTA', async () => {
        mockJourneyServer({ ...FULL_PASS, projectSubmission: SUB1 });
        const screen = await render(<CredentialJourneySection {...sectionProps} />);
        await screen.findByText('Under review');
        expect(await screen.findByText('Continue learning')).toBeTruthy();
        expect(screen.queryByText('Submit Project')).toBeNull();
        expect(screen.queryByText('Revise Project')).toBeNull();
    });

    test('6. latest reviewed FAIL => needs_revision', async () => {
        mockJourneyServer({ ...FULL_PASS, projectSubmission: SUB1, projectReview: FAIL_REV });
        const { result } = await renderHook(() => useCredentialJourney('chess-foundations', {}));
        await waitFor(() => expect(result.current.journey).not.toBeNull());
        expect(result.current.journey!.project).toMatchObject({
            state: 'needs_revision',
            score: 40,
            reviewedAt: '2026-03-03T10:00:00Z',
        });
        expect(result.current.journey!.nextAction).toEqual({ kind: 'revise_project' });
    });

    test('7. needs_revision => Revise Project CTA', async () => {
        mockJourneyServer({ ...FULL_PASS, projectSubmission: SUB1, projectReview: FAIL_REV });
        const screen = await render(<CredentialJourneySection {...sectionProps} />);
        expect(await screen.findByText(/Needs revision/)).toBeTruthy();
        expect(await screen.findByText('Revise Project')).toBeTruthy();
        expect(screen.queryByText('Submit Project')).toBeNull();
    });

    test('8. latest reviewed PASS => passed', async () => {
        mockJourneyServer({ ...FULL_PASS, projectSubmission: SUB1, projectReview: PASS_REV });
        const { result } = await renderHook(() => useCredentialJourney('chess-foundations', {}));
        await waitFor(() => expect(result.current.journey).not.toBeNull());
        expect(result.current.journey!.project).toMatchObject({ state: 'passed', score: 90 });
        expect(result.current.journey!.nextAction).toEqual({ kind: 'continue_learning' });
    });

    test('9. passed => Credential teaser', async () => {
        mockJourneyServer({ ...FULL_PASS, projectSubmission: SUB1, projectReview: PASS_REV });
        const screen = await render(<CredentialJourneySection {...sectionProps} />);
        expect(await screen.findByText(/Credential/)).toBeTruthy();
        expect(await screen.findByText(/Next step/)).toBeTruthy();
        expect(await screen.findByText(/✓ Passed/)).toBeTruthy();
    });

    test('10. Credential teaser is non-interactive', async () => {
        mockJourneyServer({ ...FULL_PASS, projectSubmission: SUB1, projectReview: PASS_REV });
        const screen = await render(<CredentialJourneySection {...sectionProps} />);
        await screen.findByText(/Credential/);
        expect(screen.queryByText('Claim Credential')).toBeNull();
        expect(screen.queryByText('Issue Credential')).toBeNull();
        expect(screen.queryByText('Share')).toBeNull();
        expect(screen.queryByText('Verify Credential')).toBeNull();
        expect(await screen.findByText('Continue learning')).toBeTruthy();
    });

    test('11/12/13. old results never carry to a newer pending submission', () => {
        const pending = { id: 'sub-2', createdAt: '2026-03-05T10:00:00Z' };
        // Old FAIL + newer pending => under_review (not needs_revision).
        expect(
            deriveProjectState({
                submission: pending,
                review: { submissionId: 'sub-1', score: 40, passed: false, reviewedAt: '2026-03-03T10:00:00Z' },
                finalPassed: true,
                unavailable: false,
            }).state,
        ).toBe('under_review');
        // Old PASS + newer pending => under_review (never inherits pass).
        expect(
            deriveProjectState({
                submission: pending,
                review: { submissionId: 'sub-1', score: 95, passed: true, reviewedAt: '2026-03-03T10:00:00Z' },
                finalPassed: true,
                unavailable: false,
            }).state,
        ).toBe('under_review');
    });

    test('14/15. Project read error isolates: stages stay, project unavailable', async () => {
        mockJourneyServer({ ...FULL_PASS, projectFails: true });
        const { result } = await renderHook(() => useCredentialJourney('chess-foundations', {}));
        await waitFor(() => expect(result.current.journey).not.toBeNull());
        const journey = result.current.journey!;
        expect(journey.available).toBe(true);
        expect(journey.knowledge.state).toBe('passed');
        expect(journey.practical.state).toBe('passed');
        expect(journey.finalAssessment.state).toBe('passed');
        expect(journey.project.state).toBe('temporarily_unavailable');
        const screen = await render(<CredentialJourneySection {...sectionProps} />);
        expect(await screen.findByText('Project status is temporarily unavailable.')).toBeTruthy();
    });
});

describe('project submission sheet + RPC flow', () => {
    test('9b. sheet shows program requirement metadata (display only)', async () => {
        mockJourneyServer({ ...FULL_PASS });
        mockEnsure.mockResolvedValue({ enrolled: true, alreadyEnrolled: false });
        mockSubmitProject.mockResolvedValue('sub-9');
        const screen = await render(<CredentialJourneySection {...sectionProps} />);
        await fireEvent.press(await screen.findByText('Submit Project'));
        expect(await screen.findByText('Game analysis')).toBeTruthy();
        expect(screen.getByText(/annotated game/)).toBeTruthy();
    });

    test('16. Submit Project uses submitProject RPC', async () => {
        mockJourneyServer({ ...FULL_PASS });
        mockEnsure.mockResolvedValue({ enrolled: true, alreadyEnrolled: false });
        mockSubmitProject.mockResolvedValue('sub-9');
        const screen = await render(<CredentialJourneySection {...sectionProps} />);
        await fireEvent.press(await screen.findByText('Submit Project'));
        await fireEvent.changeText(screen.getByPlaceholderText('https://…'), 'https://example.com/game');
        await fireEvent.changeText(screen.getByPlaceholderText(/Paste your PGN/), '1. e4 e5 *');
        await fireEvent.press(screen.getAllByText('Submit Project')[1]);
        expect(mockSubmitProject).toHaveBeenCalledWith(
            'chess-foundations',
            'https://example.com/game',
            '1. e4 e5 *',
        );
    });

    test('17/18/19. client never directly writes project_submissions', () => {
        const fs = require('fs');
        const path = require('path');
        for (const file of [
            'src/services/trustApi.ts',
            'src/components/credentials/CredentialJourneySection.tsx',
            'src/components/credentials/CredentialProjectSubmission.tsx',
            'src/hooks/useCredentialJourney.ts',
        ]) {
            const content: string = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
            expect(content).not.toMatch(/INSERT INTO project_submissions/);
            expect(content).not.toMatch(/UPDATE project_submissions SET/);
            expect(content).not.toMatch(/DELETE FROM project_submissions/);
        }
    });

    test('20. artifact-only submission allowed', async () => {
        mockJourneyServer({ ...FULL_PASS });
        mockEnsure.mockResolvedValue({ enrolled: true, alreadyEnrolled: false });
        mockSubmitProject.mockResolvedValue('sub-9');
        const screen = await render(<CredentialJourneySection {...sectionProps} />);
        await fireEvent.press(await screen.findByText('Submit Project'));
        await fireEvent.changeText(screen.getByPlaceholderText('https://…'), 'https://example.com/game');
        await fireEvent.press(screen.getAllByText('Submit Project')[1]);
        expect(mockSubmitProject).toHaveBeenCalledWith('chess-foundations', 'https://example.com/game', '');
    });

    test('21. notes-only submission allowed', async () => {
        mockJourneyServer({ ...FULL_PASS });
        mockEnsure.mockResolvedValue({ enrolled: true, alreadyEnrolled: false });
        mockSubmitProject.mockResolvedValue('sub-9');
        const screen = await render(<CredentialJourneySection {...sectionProps} />);
        await fireEvent.press(await screen.findByText('Submit Project'));
        await fireEvent.changeText(screen.getByPlaceholderText(/Paste your PGN/), 'My month review');
        await fireEvent.press(screen.getAllByText('Submit Project')[1]);
        expect(mockSubmitProject).toHaveBeenCalledWith('chess-foundations', '', 'My month review');
    });

    test('22. empty/whitespace submission blocked client-side', async () => {
        mockJourneyServer({ ...FULL_PASS });
        mockEnsure.mockResolvedValue({ enrolled: true, alreadyEnrolled: false });
        mockSubmitProject.mockResolvedValue('sub-9');
        const screen = await render(<CredentialJourneySection {...sectionProps} />);
        await fireEvent.press(await screen.findByText('Submit Project'));
        await fireEvent.changeText(screen.getByPlaceholderText('https://…'), '   ');
        await fireEvent.press(screen.getAllByText('Submit Project')[1]);
        expect(await screen.findByText('Add a project reference or your project notes.')).toBeTruthy();
        expect(mockSubmitProject).not.toHaveBeenCalled();
    });

    test('23. submit button disabled while submitting', async () => {
        mockJourneyServer({ ...FULL_PASS });
        mockEnsure.mockResolvedValue({ enrolled: true, alreadyEnrolled: false });
        let resolveSubmit!: (v: string) => void;
        mockSubmitProject.mockImplementationOnce(
            () => new Promise<string>(resolve => {
                resolveSubmit = resolve;
            }),
        );
        const screen = await render(<CredentialJourneySection {...sectionProps} />);
        await fireEvent.press(await screen.findByText('Submit Project'));
        await fireEvent.changeText(screen.getByPlaceholderText('https://…'), 'https://example.com/game');
        const root = screen.root as unknown as {
            queryAll: (pred: (n: { type: unknown; props: { disabled?: unknown } }) => boolean) => unknown[];
        };
        const disabledCount = () =>
            root.queryAll(n => n.type === 'TouchableOpacity' && n.props.disabled === true).length;
        expect(disabledCount()).toBe(0);
        await fireEvent.press(screen.getAllByText('Submit Project')[1]);
        // Busy: exactly one touchable is disabled; the in-flight RPC is single.
        expect(disabledCount()).toBe(1);
        expect(mockSubmitProject.mock.calls.length).toBe(1);
        resolveSubmit('sub-9');
        await waitFor(() => expect(screen.queryByPlaceholderText('https://…')).toBeNull());
    });

    test('24. returned pending id causes canonical refresh', async () => {
        mockJourneyServer({ ...FULL_PASS });
        mockEnsure.mockResolvedValue({ enrolled: true, alreadyEnrolled: false });
        mockSubmitProject.mockResolvedValue('sub-9');
        const screen = await render(<CredentialJourneySection {...sectionProps} />);
        await fireEvent.press(await screen.findByText('Submit Project'));
        const stageBefore = mockStage.mock.calls.length;
        const projectBefore = mockProjectSnap.mock.calls.length;
        await fireEvent.changeText(screen.getByPlaceholderText('https://…'), 'https://example.com/game');
        await fireEvent.press(screen.getAllByText('Submit Project')[1]);
        await waitFor(() => expect(mockProjectSnap.mock.calls.length).toBeGreaterThan(projectBefore));
        expect(mockStage.mock.calls.length).toBeGreaterThan(stageBefore);
        await waitFor(() => expect(screen.queryByPlaceholderText('https://…')).toBeNull());
    });

    test('25. no local optimistic under_review mutation', async () => {
        // Server still reports no submission after our submit resolves:
        // the UI must NOT invent Under review.
        mockJourneyServer({ ...FULL_PASS });
        mockEnsure.mockResolvedValue({ enrolled: true, alreadyEnrolled: false });
        mockSubmitProject.mockResolvedValue('sub-9');
        const screen = await render(<CredentialJourneySection {...sectionProps} />);
        await fireEvent.press(await screen.findByText('Submit Project'));
        await fireEvent.changeText(screen.getByPlaceholderText('https://…'), 'https://example.com/game');
        await fireEvent.press(screen.getAllByText('Submit Project')[1]);
        await waitFor(() => expect(screen.queryByPlaceholderText('https://…')).toBeNull());
        expect(await screen.findByText('Submit Project')).toBeTruthy();
        expect(screen.queryByText('Under review')).toBeNull();
    });

    test('26/27/28. revision uses the same RPC, mutates nothing, refreshes to pending', async () => {
        mockJourneyServer({ ...FULL_PASS, projectSubmission: SUB1, projectReview: FAIL_REV });
        mockEnsure.mockResolvedValue({ enrolled: true, alreadyEnrolled: false });
        mockSubmitProject.mockResolvedValue('sub-2');
        const screen = await render(<CredentialJourneySection {...sectionProps} />);
        await fireEvent.press(await screen.findByText('Revise Project'));
        // Clean fields: old values are context-free, never pre-submitted.
        await fireEvent.changeText(screen.getByPlaceholderText('https://…'), 'https://example.com/v2');
        await fireEvent.press(screen.getAllByText('Submit revision')[0]);
        expect(mockSubmitProject).toHaveBeenCalledWith('chess-foundations', 'https://example.com/v2', '');
        // Old id travels nowhere: the RPC takes no submission identity.
        for (const call of mockSubmitProject.mock.calls) {
            expect(JSON.stringify(call)).not.toContain('sub-1');
        }
        // Server now reports the new pending revision.
        mockJourneyServer({
            ...FULL_PASS,
            projectSubmission: { id: 'sub-2', createdAt: '2026-03-06T10:00:00Z' },
        });
        await waitFor(() => expect(screen.queryByPlaceholderText('https://…')).toBeNull());
    });
});

describe('project error UX + frozen surfaces', () => {
    test('29/30. project_not_ready hides the code and refreshes the journey', async () => {
        mockJourneyServer({ ...FULL_PASS });
        mockEnsure.mockResolvedValue({ enrolled: true, alreadyEnrolled: false });
        mockSubmitProject.mockRejectedValueOnce(new Error('submit: project_not_ready:final'));
        const screen = await render(<CredentialJourneySection {...sectionProps} />);
        await fireEvent.press(await screen.findByText('Submit Project'));
        const stageBefore = mockStage.mock.calls.length;
        await fireEvent.changeText(screen.getByPlaceholderText('https://…'), 'https://example.com/game');
        await fireEvent.press(screen.getAllByText('Submit Project')[1]);
        expect(await screen.findByText(/credential path changed/)).toBeTruthy();
        expect(screen.queryByText(/project_not_ready/)).toBeNull();
        await waitFor(() => expect(mockStage.mock.calls.length).toBeGreaterThan(stageBefore));
        // Form closed: no sheet inputs remain.
        expect(screen.queryByPlaceholderText('https://…')).toBeNull();
    });

    test('31. project_already_passed triggers silent refresh', async () => {
        mockJourneyServer({ ...FULL_PASS });
        mockEnsure.mockResolvedValue({ enrolled: true, alreadyEnrolled: false });
        mockSubmitProject.mockRejectedValueOnce(new Error('submit: project_already_passed'));
        const screen = await render(<CredentialJourneySection {...sectionProps} />);
        await fireEvent.press(await screen.findByText('Submit Project'));
        const stageBefore = mockStage.mock.calls.length;
        await fireEvent.changeText(screen.getByPlaceholderText('https://…'), 'https://example.com/game');
        await fireEvent.press(screen.getAllByText('Submit Project')[1]);
        await waitFor(() => expect(mockStage.mock.calls.length).toBeGreaterThan(stageBefore));
        expect(screen.queryByPlaceholderText('https://…')).toBeNull();
        expect(screen.queryByText(/credential path changed/)).toBeNull();
        expect(screen.queryByText(/project_already_passed/)).toBeNull();
    });

    test('32. project_unavailable safe copy', async () => {
        mockJourneyServer({ ...FULL_PASS });
        mockEnsure.mockResolvedValue({ enrolled: true, alreadyEnrolled: false });
        mockSubmitProject.mockRejectedValueOnce(new Error('project_unavailable'));
        const screen = await render(<CredentialJourneySection {...sectionProps} />);
        await fireEvent.press(await screen.findByText('Submit Project'));
        await fireEvent.changeText(screen.getByPlaceholderText('https://…'), 'https://example.com/game');
        await fireEvent.press(screen.getAllByText('Submit Project')[1]);
        expect(await screen.findByText(/temporarily unavailable/)).toBeTruthy();
        expect(screen.queryByText(/project_unavailable/)).toBeNull();
        expect(screen.queryByPlaceholderText('https://…')).toBeNull();
    });

    test('33. content unavailable safe copy', async () => {
        mockJourneyServer({ ...FULL_PASS });
        mockEnsure.mockResolvedValue({ enrolled: true, alreadyEnrolled: false });
        mockSubmitProject.mockRejectedValueOnce(new Error('x credential_content_unavailable y'));
        const screen = await render(<CredentialJourneySection {...sectionProps} />);
        await fireEvent.press(await screen.findByText('Submit Project'));
        await fireEvent.changeText(screen.getByPlaceholderText('https://…'), 'https://example.com/game');
        await fireEvent.press(screen.getAllByText('Submit Project')[1]);
        expect(await screen.findByText(/temporarily unavailable/)).toBeTruthy();
        expect(screen.queryByText(/credential_content_unavailable/)).toBeNull();
    });

    test('34. network failure safe copy with retry', async () => {
        mockJourneyServer({ ...FULL_PASS });
        mockEnsure.mockResolvedValue({ enrolled: true, alreadyEnrolled: false });
        mockSubmitProject.mockRejectedValueOnce(new Error('Network request failed'));
        const screen = await render(<CredentialJourneySection {...sectionProps} />);
        await fireEvent.press(await screen.findByText('Submit Project'));
        await fireEvent.changeText(screen.getByPlaceholderText('https://…'), 'https://example.com/game');
        await fireEvent.press(screen.getAllByText('Submit Project')[1]);
        expect(await screen.findByText(/needs an internet connection/)).toBeTruthy();
        expect(screen.queryByText(/Network request failed/)).toBeNull();
        // Sheet stays open: the same action retries.
        mockSubmitProject.mockResolvedValue('sub-9');
        await fireEvent.press(screen.getAllByText('Submit Project')[1]);
        expect(mockSubmitProject.mock.calls.length).toBe(2);
        await waitFor(() => expect(screen.queryByPlaceholderText('https://…')).toBeNull());
    });

    test('35/36. official review score rendered as-is; no client grading', async () => {
        mockJourneyServer({ ...FULL_PASS, projectSubmission: SUB1, projectReview: FAIL_REV });
        const screen = await render(<CredentialJourneySection {...sectionProps} />);
        expect(await screen.findByText(/Needs revision/)).toBeTruthy();
        expect(screen.getByText(/Score: 40%/)).toBeTruthy();
        const fs = require('fs');
        const path = require('path');
        const sheet: string = fs.readFileSync(
            path.join(process.cwd(), 'src/components/credentials/CredentialProjectSubmission.tsx'),
            'utf8',
        );
        expect(sheet).not.toMatch(/Score:/);
        expect(sheet).not.toMatch(/Math\.(round|max|min|floor)/);
        expect(sheet).not.toMatch(/passed\s*===?\s*(true|false)/);
    });

    test('37. upstream state still has priority over Project CTA after rotation', async () => {
        // Final went stale (ready again) while a submission stays pending:
        // display keeps Under review, CTA returns upstream.
        mockJourneyServer({
            knowledgeComponent: { score: 91, passed: true },
            practicalComponent: { score: 88, passed: true },
            practicalAttempts: [{ id: 'p1', status: 'submitted', score: 88, passed: true, submittedAt: '2026-02-02' }],
            projectSubmission: SUB1,
        });
        const { result } = await renderHook(() => useCredentialJourney('chess-foundations', {}));
        await waitFor(() => expect(result.current.journey).not.toBeNull());
        expect(result.current.journey!.finalAssessment.state).toBe('ready');
        expect(result.current.journey!.project.state).toBe('under_review');
        expect(result.current.journey!.nextAction).toEqual({ kind: 'start_final' });
        const screen = await render(<CredentialJourneySection {...sectionProps} />);
        expect(await screen.findByText('Under review')).toBeTruthy();
        expect(await screen.findByText('Start Final Assessment')).toBeTruthy();
        expect(screen.queryByText('Submit Project')).toBeNull();
    });

    test('38. one primary official CTA remains', async () => {
        mockJourneyServer({ ...FULL_PASS });
        const ready = await render(<CredentialJourneySection {...sectionProps} />);
        await ready.findByText('Submit Project');
        expect(ready.queryByText('Revise Project')).toBeNull();
        expect(ready.queryByText('Continue learning')).toBeNull();
        expect(ready.queryByText('Start Final Assessment')).toBeNull();

        mockJourneyServer({ ...FULL_PASS, projectSubmission: SUB1 });
        const waiting = await render(<CredentialJourneySection {...sectionProps} />);
        await waiting.findByText('Continue learning');
        expect(waiting.queryByText('Submit Project')).toBeNull();
        expect(waiting.queryByText('Revise Project')).toBeNull();
    });

    test('39/40/41. Knowledge, Practical, Final unchanged', async () => {
        expect(
            deriveKnowledgeState({ component: null, attempts: [], allSkillsVerified: true, unavailable: false }).state,
        ).toBe('ready');
        expect(
            derivePracticalState({
                component: null, attempts: [], knowledgePassed: true,
                allSkillsVerified: true, unavailable: false,
            }).state,
        ).toBe('ready');
        expect(
            deriveFinalAssessmentState({
                component: null, attempts: [], knowledgePassed: true, practicalPassed: true,
                allSkillsVerified: true, unavailable: false,
            }).state,
        ).toBe('ready');
        // Older next-action call shapes behave exactly as before.
        expect(deriveNextAction(null, true, 'passed', 'passed', 'passed')).toEqual({ kind: 'continue_learning' });
        expect(deriveNextAction(null, true, 'passed', 'passed')).toEqual({ kind: 'continue_learning' });
    });

    test('42/43. Slice 6: ready credential shows one Claim CTA backed by the server RPC', async () => {
        mockJourneyServer({
            ...FULL_PASS,
            projectSubmission: SUB1,
            projectReview: PASS_REV,
            credential: { state: 'ready_to_issue', credentialId: null, score: 98, grade: 'distinction', issuedAt: null, expiresAt: null },
        });
        const screen = await render(<CredentialJourneySection {...sectionProps} />);
        expect(await screen.findByText('Claim credential')).toBeTruthy();
        // Exactly one primary CTA: the stage action is suppressed.
        expect(screen.queryByText('Continue learning')).toBeNull();
        expect(screen.queryByText('Issue Credential')).toBeNull();
        const fs = require('fs');
        const path = require('path');
        // Claim flows through the server RPC only — no local issuance.
        const section: string = fs.readFileSync(path.join(process.cwd(), 'src/components/credentials/CredentialJourneySection.tsx'), 'utf8');
        expect(section).toMatch(/issueCredential/);
        expect(section).not.toMatch(/credentialService/);
        expect(section).not.toMatch(/tryIssue/);
        expect(section).not.toMatch(/verifyLocal/);
        const block: string = fs.readFileSync(path.join(process.cwd(), 'src/components/credentials/CredentialJourneyBlock.tsx'), 'utf8');
        expect(block).not.toMatch(/credentialService/);
    });

    test('44. no Home changes', () => {
        const fs = require('fs');
        const path = require('path');
        const homeCandidates = [
            'src/screens/tabs/HomeTab.tsx',
            'src/screens/HomeScreen.tsx',
            'src/screens/tabs/Home.tsx',
        ];
        const existing = homeCandidates
            .map((p: string) => path.join(process.cwd(), p))
            .filter((p: string) => fs.existsSync(p));
        expect(existing.length).toBeGreaterThan(0);
        for (const file of existing) {
            const content: string = fs.readFileSync(file, 'utf8');
            expect(content).not.toMatch(/useCredentialJourney|CredentialJourney|submitProject|CredentialProject/);
        }
    });

    test('45. no migrations / backend RPC changes', () => {
        const fs = require('fs');
        const path = require('path');
        const dir = path.join(process.cwd(), 'supabase', 'migrations');
        const files: string[] = fs.readdirSync(dir).filter((f: string) => f.endsWith('.sql'));
        expect(files.length).toBeGreaterThan(0);
        const beyond = files.filter(f => {
            const m = /^(\d+)_/.exec(f);
            return m != null && Number(m[1]) > 38;
        });
        expect(beyond).toEqual([]);
        const api: string = fs.readFileSync(path.join(process.cwd(), 'src/services/trustApi.ts'), 'utf8');
        expect(api).toMatch(/submit_project/);
    });
});
