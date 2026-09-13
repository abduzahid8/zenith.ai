/**
 * Slice 2 — credential journey + knowledge check (RNTL v14 async).
 */
import '@testing-library/jest-native/extend-expect';
import React from 'react';
import { render, fireEvent, waitFor, renderHook, act } from '@testing-library/react-native';
import {
    deriveKnowledgeState,
    deriveNextAction,
    useCredentialJourney,
} from '../hooks/useCredentialJourney';
import { CredentialJourneySection } from '../components/credentials/CredentialJourneySection';
import { CredentialChallengeRunner } from '../components/credentials/CredentialChallengeRunner';
import {
    ensureEnrollment,
    getCredentialProgress,
    getCredentialStageSnapshot,
    getCredentialStatus,
    getProjectJourneySnapshot,
    getKnowledgeJourneySnapshot,
    getProgramAvailability,
    getSkillVerification,
    issueCredential,
    startKnowledgeAttempt,
    submitKnowledgeAttempt,
} from '../services/trustApi';

jest.mock('../services/trustApi', () => ({
    ensureEnrollment: jest.fn(),
    getCredentialProgress: jest.fn(),
    getCredentialStageSnapshot: jest.fn(),
    getCredentialStatus: jest.fn(),
    getProjectJourneySnapshot: jest.fn(),
    getKnowledgeJourneySnapshot: jest.fn(),
    getProgramAvailability: jest.fn(),
    getSkillVerification: jest.fn(),
    issueCredential: jest.fn(),
    startKnowledgeAttempt: jest.fn(),
    startPracticalAttempt: jest.fn(),
    submitKnowledgeAttempt: jest.fn(),
    submitPracticalAttempt: jest.fn(),
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
const mockSnapshot = getKnowledgeJourneySnapshot as jest.Mock;
const mockStage = getCredentialStageSnapshot as jest.Mock;
const mockProject = getProjectJourneySnapshot as jest.Mock;
const mockAvailability = getProgramAvailability as jest.Mock;
const mockSkills = getSkillVerification as jest.Mock;
const mockCredentialStatus = getCredentialStatus as jest.Mock;
const mockIssueCredential = issueCredential as jest.Mock;
const mockStart = startKnowledgeAttempt as jest.Mock;
const mockSubmit = submitKnowledgeAttempt as jest.Mock;

const SKILLS_3_OF_4 = [
    { skillKey: 'rules', skillName: 'Rules', samplesCompleted: 4, samplesRequired: 4, passes: 4, passRate: 1, score: 100, verified: true },
    { skillKey: 'openings', skillName: 'Openings', samplesCompleted: 4, samplesRequired: 4, passes: 4, passRate: 1, score: 100, verified: true },
    { skillKey: 'endgames', skillName: 'Endgames', samplesCompleted: 4, samplesRequired: 4, passes: 4, passRate: 1, score: 100, verified: true },
    { skillKey: 'tactics', skillName: 'Tactics', samplesCompleted: 2, samplesRequired: 4, passes: 2, passRate: 1, score: 100, verified: false },
];
const SKILLS_4_OF_4 = SKILLS_3_OF_4.map(s =>
    s.skillKey === 'tactics'
        ? { ...s, samplesCompleted: 4, passes: 4, verified: true }
        : s,
);

const QUESTIONS = [
    { item_key: 'k1', skill: 'rules', payload: { prompt: 'Q1?', options: ['A1', 'B1'] } },
    { item_key: 'k2', skill: 'rules', payload: { prompt: 'Q2?', options: ['A2', 'B2'] } },
];

function mockJourneyServer(opts: {
    issuable?: boolean;
    version?: string | null;
    skills?: typeof SKILLS_4_OF_4;
    progress?: null | object;
    /** Live-release snapshot; attempts/component are already live-scoped. */
    contentAvailable?: boolean;
    attempts?: unknown[];
    component?: null | object;
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
    mockSnapshot.mockResolvedValue({
        contentAvailable,
        attempts: opts.attempts ?? [],
        component: opts.component ?? null,
    });
    // Shared live snapshot: ONE release identity for every stage. The
    // knowledge slice mirrors the legacy snapshot so Slice 2 assertions
    // keep passing; practical/final/project default to locked.
    mockStage.mockResolvedValue({
        contentAvailable,
        knowledge: {
            attempts: opts.attempts ?? [],
            component: opts.component ?? null,
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
        mockProject.mockRejectedValue(new Error('offline'));
    } else {
        mockProject.mockResolvedValue({
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

beforeEach(() => {
    jest.clearAllMocks();
    mockJourneyServer();
});

describe('deriveKnowledgeState (pure server-fact mapping)', () => {
    test('locked without full verification; ready only at 4/4', () => {
        expect(
            deriveKnowledgeState({ component: null, attempts: [], allSkillsVerified: false, unavailable: false }).state,
        ).toBe('locked');
        expect(
            deriveKnowledgeState({ component: null, attempts: [], allSkillsVerified: true, unavailable: false }).state,
        ).toBe('ready');
    });

    test('passed component wins; active attempt resumes; failed shows last score', () => {
        expect(
            deriveKnowledgeState({
                component: { score: 87, passed: true },
                attempts: [],
                allSkillsVerified: true,
                unavailable: false,
            }),
        ).toEqual({ state: 'passed', score: 87, attemptId: null });
        expect(
            deriveKnowledgeState({
                component: null,
                attempts: [{ id: 'a1', status: 'started', score: null, passed: null, submittedAt: null }],
                allSkillsVerified: true,
                unavailable: false,
            }),
        ).toEqual({ state: 'in_progress', score: null, attemptId: 'a1' });
        expect(
            deriveKnowledgeState({
                component: null,
                attempts: [{ id: 'a1', status: 'submitted', score: 62, passed: false, submittedAt: '2026-01-02' }],
                allSkillsVerified: true,
                unavailable: false,
            }),
        ).toEqual({ state: 'failed', score: 62, attemptId: null });
    });

    test('nextAction mapping favors one primary action', () => {
        expect(deriveNextAction(null, false, 'locked')).toEqual({ kind: 'continue_learning' });
        expect(deriveNextAction(null, true, 'ready')).toEqual({ kind: 'start_knowledge' });
        expect(deriveNextAction(null, true, 'in_progress')).toEqual({ kind: 'continue_knowledge' });
        expect(deriveNextAction(null, true, 'failed')).toEqual({ kind: 'start_knowledge' });
        expect(
            deriveNextAction(
                { type: 'prove_skill', hobbyId: 'chess', skillKey: 'rules', skillName: 'Rules', minutes: 15, reasonCode: 'missing_validation', confidence: 'high' },
                false,
                'locked',
            ),
        ).toEqual({ kind: 'verify_skill', skillKey: 'rules', skillName: 'Rules' });
    });
});

describe('useCredentialJourney read model', () => {
    test('1. 3/4 verified skills => Knowledge locked', async () => {
        mockJourneyServer({ skills: SKILLS_3_OF_4 });
        const { result } = await renderHook(() => useCredentialJourney('chess-foundations', {}));
        await waitFor(() => expect(result.current.journey).not.toBeNull());
        expect(result.current.journey!.available).toBe(true);
        expect(result.current.journey!.verifiedSkillCount).toBe(3);
        expect(result.current.journey!.knowledge.state).toBe('locked');
        expect(result.current.journey!.nextAction).toEqual({ kind: 'continue_learning' });
    });

    test('2. 4/4 verified skills => Knowledge ready', async () => {
        const { result } = await renderHook(() => useCredentialJourney('chess-foundations', {}));
        await waitFor(() => expect(result.current.journey).not.toBeNull());
        expect(result.current.journey!.knowledge.state).toBe('ready');
        expect(result.current.journey!.nextAction).toEqual({ kind: 'start_knowledge' });
    });

    test('3/17. forged local state cannot unlock Knowledge; learning events are not proof', async () => {
        // Stuff every local store with "proof": the hook must ignore all of it.
        const { useCredentialStore } = require('../store/credentialStore');
        useCredentialStore.getState().setIdentityVerified?.('chess-foundations', true);
        const { appendLearningEvent } = require('../services/learningEventRepository');
        const { buildAttemptEvent } = require('../domain/sessions/learningEvents');
        appendLearningEvent(
            buildAttemptEvent({
                sessionId: 'forge', hobbyId: 'chess', lessonId: 'chess_d1', lessonDay: 1,
                cardId: 'r', attemptNo: 1, phase: 'recall', sessionKind: 'structured',
                outcome: 'pass', cardType: 'recall', occurredAt: '2026-09-01T10:00:00.000Z',
            }),
        );
        mockJourneyServer({ skills: SKILLS_3_OF_4 });
        const { result } = await renderHook(() => useCredentialJourney('chess-foundations', {}));
        await waitFor(() => expect(result.current.journey).not.toBeNull());
        expect(result.current.journey!.knowledge.state).toBe('locked');
    });

    test('4. issuance-disabled program hides the journey', async () => {
        mockJourneyServer({ issuable: false });
        const { result } = await renderHook(() => useCredentialJourney('python-foundations', {}));
        await waitFor(() => expect(result.current.journey).not.toBeNull());
        expect(result.current.journey!.available).toBe(false);
        expect(result.current.journey!.visible).toBe(false);
    });

    test('15. refresh re-reads server truth', async () => {
        mockJourneyServer({ skills: SKILLS_3_OF_4 });
        const { result } = await renderHook(() => useCredentialJourney('chess-foundations', {}));
        await waitFor(() => expect(result.current.journey).not.toBeNull());
        expect(result.current.journey!.knowledge.state).toBe('locked');
        const callsBefore = (mockSkills as jest.Mock).mock.calls.length;
        mockJourneyServer();
        await act(async () => {
            result.current.refresh();
        });
        await waitFor(() => expect((mockSkills as jest.Mock).mock.calls.length).toBeGreaterThan(callsBefore));
    });

    test('version. journey exposes programVersion and pins reads to it', async () => {
        mockJourneyServer();
        const { result } = await renderHook(() => useCredentialJourney('chess-foundations', {}));
        await waitFor(() => expect(result.current.journey).not.toBeNull());
        expect(result.current.journey!.programVersion).toBe('v2');
        expect(mockProgress).toHaveBeenCalledWith('chess-foundations', 'v2');
        expect(mockStage).toHaveBeenCalledWith('chess-foundations', 'v2');
    });

    test('version. missing server version hides the journey (fail closed)', async () => {
        mockJourneyServer({ version: null });
        const { result } = await renderHook(() => useCredentialJourney('chess-foundations', {}));
        await waitFor(() => expect(result.current.journey).not.toBeNull());
        expect(result.current.journey!.available).toBe(false);
        expect(result.current.journey!.visible).toBe(false);
    });

    test('version. superseded attempts never render in_progress', () => {
        expect(
            deriveKnowledgeState({
                component: null,
                attempts: [
                    { id: 'old', status: 'superseded', score: null, passed: null, submittedAt: null } as never,
                    { id: 'weird', status: 'archived', score: null, passed: null, submittedAt: null } as never,
                ],
                allSkillsVerified: false,
                unavailable: false,
            }).state,
        ).toBe('locked');
    });

    test('version. v1 rows do not leak into the current v2 journey', async () => {
        // Server answers per requested version: v2 is clean, v1 carries
        // a live attempt and a passed component. The hook must ask for v2 —
        // the snapshot adapter (unit-tested separately) filters by release.
        mockAvailability.mockResolvedValue([{ slug: 'chess-foundations', issuable: true, programVersion: 'v2' }]);
        mockSkills.mockResolvedValue(SKILLS_3_OF_4);
        mockProgress.mockImplementation((slug: string, version: string) =>
            Promise.resolve(version === 'v2' ? null : { programVersion: 'v1' }),
        );
        const stageFor = (version: string) =>
            version === 'v2'
                ? {
                    contentAvailable: true,
                    knowledge: { attempts: [], component: null },
                    practical: { attempts: [], component: null },
                    finalAssessment: { attempts: [], component: null },
                }
                : {
                    contentAvailable: true,
                    knowledge: {
                        attempts: [{ id: 'v1-live', status: 'started', score: null, passed: null, submittedAt: null }],
                        component: { score: 95, passed: true },
                    },
                    practical: { attempts: [], component: null },
                    finalAssessment: { attempts: [], component: null },
                };
        mockStage.mockImplementation((slug: string, version: string) => Promise.resolve(stageFor(version)));
        mockSnapshot.mockImplementation((slug: string, version: string) =>
            Promise.resolve(
                version === 'v2'
                    ? { contentAvailable: true, attempts: [], component: null }
                    : {
                        contentAvailable: true,
                        attempts: [{ id: 'v1-live', status: 'started', score: null, passed: null, submittedAt: null }],
                        component: { score: 95, passed: true },
                    },
            ),
        );
        const { result } = await renderHook(() => useCredentialJourney('chess-foundations', {}));
        await waitFor(() => expect(result.current.journey).not.toBeNull());
        const journey = result.current.journey!;
        expect(mockStage).toHaveBeenCalledWith('chess-foundations', 'v2');
        // v1 started attempt does NOT surface as in_progress…
        expect(journey.knowledge.state).toBe('locked');
        // …v1 passed component does NOT mark v2 passed…
        expect(journey.knowledge.state).not.toBe('passed');
        // …and the old-version progress row is NOT current enrollment.
        expect(journey.enrolled).toBe(false);
    });

    test('version. v2 live attempt renders in_progress; v2 pass renders passed', async () => {
        mockJourneyServer({
            skills: SKILLS_4_OF_4,
            attempts: [{ id: 'v2-live', status: 'started', score: null, passed: null, submittedAt: null }],
        });
        const live = await renderHook(() => useCredentialJourney('chess-foundations', {}));
        await waitFor(() => expect(live.result.current.journey).not.toBeNull());
        expect(live.result.current.journey!.knowledge.state).toBe('in_progress');

        mockJourneyServer({ component: { score: 91, passed: true } });
        const passed = await renderHook(() => useCredentialJourney('chess-foundations', {}));
        await waitFor(() => expect(passed.result.current.journey).not.toBeNull());
        expect(passed.result.current.journey!.knowledge.state).toBe('passed');
    });

    test('version. current-version progress row means enrolled', async () => {
        mockJourneyServer({ progress: { programVersion: 'v2' } });
        const { result } = await renderHook(() => useCredentialJourney('chess-foundations', {}));
        await waitFor(() => expect(result.current.journey).not.toBeNull());
        expect(result.current.journey!.enrolled).toBe(true);
    });

    test('refresh. 3/4 → final skill verified → refresh yields 4/4 Ready', async () => {
        mockJourneyServer({ skills: SKILLS_3_OF_4 });
        const { result } = await renderHook(() => useCredentialJourney('chess-foundations', {}));
        await waitFor(() => expect(result.current.journey).not.toBeNull());
        expect(result.current.journey!.verifiedSkillCount).toBe(3);
        expect(result.current.journey!.knowledge.state).toBe('locked');
        // Server completes the final gate; the UI re-reads (no local patch).
        mockJourneyServer({ skills: SKILLS_4_OF_4 });
        await act(async () => {
            result.current.refresh();
        });
        await waitFor(() => expect(result.current.journey!.verifiedSkillCount).toBe(4));
        expect(result.current.journey!.knowledge.state).toBe('ready');
        expect(result.current.journey!.nextAction).toEqual({ kind: 'start_knowledge' });
    });

    test('refresh. parent refreshToken re-reads server truth', async () => {
        mockJourneyServer({ skills: SKILLS_3_OF_4 });
        const { result, rerender } = await renderHook(
            ({ token }: { token: number }) => useCredentialJourney('chess-foundations', { refreshToken: token }),
            { initialProps: { token: 0 } },
        );
        await waitFor(() => expect(result.current.journey).not.toBeNull());
        const callsBefore = mockSkills.mock.calls.length;
        mockJourneyServer();
        await rerender({ token: 1 });
        await waitFor(() => expect(mockSkills.mock.calls.length).toBeGreaterThan(callsBefore));
    });

    test('refresh. failed verification still refreshes sample state', async () => {
        const before = [...SKILLS_3_OF_4];
        mockJourneyServer({ skills: before });
        const { result } = await renderHook(() => useCredentialJourney('chess-foundations', {}));
        await waitFor(() => expect(result.current.journey).not.toBeNull());
        const tacticsBefore = result.current.journey!.skills.find(s => s.key === 'tactics')!;
        expect(tacticsBefore.samplesCompleted).toBe(2);
        // A failed sample still moves samplesCompleted server-side.
        mockJourneyServer({
            skills: SKILLS_3_OF_4.map(s =>
                s.skillKey === 'tactics' ? { ...s, samplesCompleted: 3 } : s,
            ),
        });
        await act(async () => {
            result.current.refresh();
        });
        await waitFor(() =>
            expect(result.current.journey!.skills.find(s => s.key === 'tactics')!.samplesCompleted).toBe(3),
        );
        expect(result.current.journey!.knowledge.state).toBe('locked');
    });
});

describe('live-release Knowledge authority (snapshot-scoped)', () => {
    test('1. live started attempt => in_progress', async () => {
        mockJourneyServer({
            skills: SKILLS_4_OF_4,
            attempts: [{ id: 'live-a', status: 'started', score: null, passed: null, submittedAt: null }],
        });
        const { result } = await renderHook(() => useCredentialJourney('chess-foundations', {}));
        await waitFor(() => expect(result.current.journey).not.toBeNull());
        expect(result.current.journey!.knowledge).toEqual({
            state: 'in_progress',
            score: null,
            attemptId: 'live-a',
        });
    });

    test('2/3. retired-release rows never surface (adapter excludes them)', async () => {
        // The snapshot adapter drops non-live attempts/components; the hook
        // therefore sees an empty live set: no in_progress, no stale score.
        mockJourneyServer({ skills: SKILLS_4_OF_4, attempts: [], component: null });
        const { result } = await renderHook(() => useCredentialJourney('chess-foundations', {}));
        await waitFor(() => expect(result.current.journey).not.toBeNull());
        expect(result.current.journey!.knowledge.state).toBe('ready');
        expect(result.current.journey!.knowledge.score).toBeNull();
    });

    test('4/7. live component PASS => passed', async () => {
        mockJourneyServer({ component: { score: 91, passed: true } });
        const { result } = await renderHook(() => useCredentialJourney('chess-foundations', {}));
        await waitFor(() => expect(result.current.journey).not.toBeNull());
        expect(result.current.journey!.knowledge).toEqual({
            state: 'passed',
            score: 91,
            attemptId: null,
        });
    });

    test('5/6. stale component (nulled by adapter) + verified skills => ready', async () => {
        mockJourneyServer({ skills: SKILLS_4_OF_4, component: null });
        const { result } = await renderHook(() => useCredentialJourney('chess-foundations', {}));
        await waitFor(() => expect(result.current.journey).not.toBeNull());
        expect(result.current.journey!.knowledge.state).toBe('ready');
        expect(result.current.journey!.nextAction).toEqual({ kind: 'start_knowledge' });
    });

    test('8. superseded attempt remains ignored', async () => {
        mockJourneyServer({
            skills: SKILLS_3_OF_4,
            attempts: [
                { id: 'sup', status: 'superseded', score: null, passed: null, submittedAt: null } as never,
            ],
        });
        const { result } = await renderHook(() => useCredentialJourney('chess-foundations', {}));
        await waitFor(() => expect(result.current.journey).not.toBeNull());
        expect(result.current.journey!.knowledge.state).toBe('locked');
    });

    test('9/10. no single live release => temporarily_unavailable, journey stays visible', async () => {
        mockJourneyServer({ contentAvailable: false });
        const { result } = await renderHook(() => useCredentialJourney('chess-foundations', {}));
        await waitFor(() => expect(result.current.journey).not.toBeNull());
        const journey = result.current.journey!;
        expect(journey.knowledge.state).toBe('temporarily_unavailable');
        // The journey is NOT hidden: verified skill state stays visible.
        expect(journey.available).toBe(true);
        expect(journey.visible).toBe(true);
        expect(journey.verifiedSkillCount).toBe(4);
        expect(journey.totalSkillCount).toBe(4);
    });

    test('13. internal contentVersion never appears in the journey model', async () => {
        mockJourneyServer({
            attempts: [{ id: 'live-a', status: 'started', score: null, passed: null, submittedAt: null }],
            component: { score: 91, passed: true },
        });
        const { result } = await renderHook(() => useCredentialJourney('chess-foundations', {}));
        await waitFor(() => expect(result.current.journey).not.toBeNull());
        const keys: string[] = [];
        const walk = (value: unknown) => {
            if (Array.isArray(value)) {
                value.forEach(walk);
            } else if (value != null && typeof value === 'object') {
                for (const [k, v] of Object.entries(value)) {
                    keys.push(k);
                    walk(v);
                }
            }
        };
        walk(result.current.journey);
        const leaked = keys.filter(k =>
            /content_version|contentversion|reference_id|artifact|bank|release|machine_qa|human_review/i.test(k),
        );
        expect(leaked).toEqual([]);
        expect(JSON.stringify(result.current.journey)).not.toMatch(
            /content_version|contentVersion|reference_id/i,
        );
    });
});

describe('CredentialJourneySection', () => {
    test('5/6. Start ensures enrollment, then starts the server attempt', async () => {
        mockEnsure.mockResolvedValue({ enrolled: true, alreadyEnrolled: false });
        mockStart.mockResolvedValue({ attemptId: 'att-k1', programVersion: '1.0', questions: QUESTIONS });
        const screen = await render(
            <CredentialJourneySection programSlug="chess-foundations" programTitle="Chess Foundations" recommendation={null} onVerifySkill={() => {}} onContinueLearning={() => {}} />,
        );
        await screen.findByText('Start Knowledge Check');
        await fireEvent.press(screen.getByText('Start Knowledge Check'));
        expect(mockEnsure).toHaveBeenCalledWith('chess-foundations');
        expect(
            (mockEnsure as jest.Mock).mock.invocationCallOrder[0]
        ).toBeLessThan((mockStart as jest.Mock).mock.invocationCallOrder[0]);
        expect(mockStart).toHaveBeenCalledWith('chess-foundations');
        expect(await screen.findByText('Q1?')).toBeTruthy();
    });

    test('enrollment. successful ensureEnrollment triggers journey refresh (no local patch)', async () => {
        mockEnsure.mockResolvedValue({ enrolled: true, alreadyEnrolled: false });
        mockStart.mockResolvedValue({ attemptId: 'att-k1', programVersion: '1.0', questions: QUESTIONS });
        const screen = await render(
            <CredentialJourneySection programSlug="chess-foundations" programTitle="Chess Foundations" recommendation={null} onVerifySkill={() => {}} onContinueLearning={() => {}} />,
        );
        await screen.findByText('Start Knowledge Check');
        const progressReadsBefore = mockProgress.mock.calls.length;
        const snapshotReadsBefore = mockStage.mock.calls.length;
        await fireEvent.press(screen.getByText('Start Knowledge Check'));
        // Canonical refresh re-reads server truth after enrollment…
        await waitFor(() => expect(mockProgress.mock.calls.length).toBeGreaterThan(progressReadsBefore));
        expect(mockStage.mock.calls.length).toBeGreaterThan(snapshotReadsBefore);
        // …and enrolled is still derived from the server progress row
        // (null here), never optimistically patched to true locally.
        expect(mockProgress).toHaveBeenCalledWith('chess-foundations', 'v2');
    });

    test('16. Knowledge PASS unlocks Practical (Slice 3: practical CTA replaces teaser)', async () => {
        mockJourneyServer({
            component: { score: 91, passed: true },
        });
        const screen = await render(
            <CredentialJourneySection programSlug="chess-foundations" programTitle="Chess Foundations" recommendation={null} onVerifySkill={() => {}} onContinueLearning={() => {}} />,
        );
        // Slice 3: Knowledge PASS makes Practical ready — one primary CTA.
        expect(await screen.findByText('Start Practical Check')).toBeTruthy();
        expect(screen.queryByText('Start Final')).toBeNull();
        expect(screen.queryByText('Start Project')).toBeNull();
    });

    test('17/18. submit completes then refreshed server truth drives passed UI', async () => {
        // Submit via the standalone runner (server verdict only), then prove
        // the journey read model re-read from server drives the passed UI.
        mockStart.mockResolvedValue({ attemptId: 'att-k9', programVersion: '1.0', questions: QUESTIONS.slice(0, 1) });
        mockSubmit.mockResolvedValue({ score: 90, passed: true, submitted: true, contentStale: false });
        const onComplete = jest.fn();
        const runner = await render(
            <CredentialChallengeRunner
                visible={true}
                mode="knowledge"
                programSlug="chess-foundations"
                programTitle="Chess Foundations"
                onClose={() => {}}
                onComplete={onComplete}
            />,
        );
        await runner.findByText('Q1?');
        await fireEvent.press(runner.getByText('A1'));
        await fireEvent.press(runner.getByText('Submit answers'));
        expect(await runner.findByText('Knowledge passed')).toBeTruthy();
        // Container contract: completion triggers a server refresh (no local patch).
        expect(onComplete).toHaveBeenCalledWith(
            expect.objectContaining({ passed: true, score: 90, contentStale: false }),
        );
        // Refresh re-reads server truth: now the component snapshot says passed.
        mockJourneyServer({ component: { score: 90, passed: true } });
        const { result } = await renderHook(() => useCredentialJourney('chess-foundations', {}));
        await waitFor(() => expect(result.current.journey).not.toBeNull());
        // Simulate post-submit refresh result driving the block (not local patch).
        expect(result.current.journey!.knowledge.state).toBe('passed');
        expect(result.current.journey!.knowledge.score).toBe(90);
    });

    test('19. Practical PASS unlocks the Final CTA; Project waits for Final PASS (Slice 4)', async () => {
        mockJourneyServer({
            component: { score: 91, passed: true },
            practicalComponent: { score: 88, passed: true },
            practicalAttempts: [{ id: 'p1', status: 'submitted', score: 88, passed: true, submittedAt: '2026-02-01' }],
        });
        const screen = await render(
            <CredentialJourneySection programSlug="chess-foundations" programTitle="Chess Foundations" recommendation={null} onVerifySkill={() => {}} onContinueLearning={() => {}} />,
        );
        // Slice 4: the single CTA moves to the Final; Project stays hidden.
        expect(await screen.findByText('Start Final Assessment')).toBeTruthy();
        expect(screen.queryByText('Start Project')).toBeNull();
        expect(screen.queryByText(/Project/)).toBeNull();
        const finalNodes = screen.queryAllByText(/Final Assessment/);
        expect(finalNodes.length).toBeGreaterThan(0);
        for (const node of finalNodes) {
            expect(node).toBeTruthy();
        }
    });

    test('enrollment. generic failure shows safe connectivity copy with retry', async () => {
        mockEnsure.mockRejectedValueOnce(new Error('Network request failed'));
        const screen = await render(
            <CredentialJourneySection programSlug="chess-foundations" programTitle="Chess Foundations" recommendation={null} onVerifySkill={() => {}} onContinueLearning={() => {}} />,
        );
        await screen.findByText('Start Knowledge Check');
        await fireEvent.press(screen.getByText('Start Knowledge Check'));
        // User-visible, safe — never the raw RPC string, never silent.
        expect(await screen.findByText('Knowledge check needs an internet connection.')).toBeTruthy();
        expect(screen.queryByText(/Network request failed/)).toBeNull();
        // Retry re-attempts the canonical flow.
        mockEnsure.mockResolvedValue({ enrolled: true, alreadyEnrolled: true });
        mockStart.mockResolvedValue({ attemptId: 'att-retry', programVersion: 'v2', questions: QUESTIONS });
        await fireEvent.press(screen.getByText('Try again'));
        expect(await screen.findByText('Q1?')).toBeTruthy();
    });

    test('enrollment. content-unavailable uses the temporary copy', async () => {
        mockEnsure.mockRejectedValueOnce(new Error('enroll: credential_content_unavailable'));
        const screen = await render(
            <CredentialJourneySection programSlug="chess-foundations" programTitle="Chess Foundations" recommendation={null} onVerifySkill={() => {}} onContinueLearning={() => {}} />,
        );
        await screen.findByText('Start Knowledge Check');
        await fireEvent.press(screen.getByText('Start Knowledge Check'));
        // Both stages fail closed to the temporary copy (shared snapshot).
        expect(await screen.findByText('Knowledge check is temporarily unavailable. Try again later.')).toBeTruthy();
        expect(screen.queryByText('Knowledge check needs an internet connection.')).toBeNull();
    });

    test('refresh. refreshToken prop re-reads the journey', async () => {
        const screen = await render(
            <CredentialJourneySection
                programSlug="chess-foundations"
                programTitle="Chess Foundations"
                recommendation={null}
                onVerifySkill={() => {}}
                onContinueLearning={() => {}}
                refreshToken={0}
            />,
        );
        await screen.findByText('Start Knowledge Check');
        const callsBefore = mockSkills.mock.calls.length;
        mockJourneyServer();
        await screen.rerender(
            <CredentialJourneySection
                programSlug="chess-foundations"
                programTitle="Chess Foundations"
                recommendation={null}
                onVerifySkill={() => {}}
                onContinueLearning={() => {}}
                refreshToken={1}
            />,
        );
        await waitFor(() => expect(mockSkills.mock.calls.length).toBeGreaterThan(callsBefore));
    });
});

describe('CredentialChallengeRunner (knowledge only)', () => {
    const baseProps = {
        visible: true,
        mode: 'knowledge' as const,
        programSlug: 'chess-foundations',
        programTitle: 'Chess Foundations',
        onClose: jest.fn(),
        onComplete: jest.fn(),
    };

    beforeEach(() => {
        baseProps.onClose = jest.fn();
        baseProps.onComplete = jest.fn();
    });

    test('7/8. active attempt resumes; server questions render', async () => {
        mockStart.mockResolvedValue({ attemptId: 'att-resume', programVersion: '1.0', questions: QUESTIONS });
        const screen = await render(<CredentialChallengeRunner {...baseProps} />);
        expect(mockStart).toHaveBeenCalledWith('chess-foundations');
        expect(await screen.findByText('Q1?')).toBeTruthy();
        expect(screen.getByText('Question 1 of 2')).toBeTruthy();
        expect(mockStart.mock.calls.length).toBe(1);
    });

    test('9. answers submit keyed by public item key', async () => {
        mockStart.mockResolvedValue({ attemptId: 'att-1', programVersion: '1.0', questions: QUESTIONS });
        mockSubmit.mockResolvedValue({ passed: true, submitted: true, contentStale: false });
        const screen = await render(<CredentialChallengeRunner {...baseProps} />);
        await screen.findByText('Q1?');
        await fireEvent.press(screen.getByText('A1'));
        await fireEvent.press(screen.getByText('Next'));
        await screen.findByText('Q2?');
        await fireEvent.press(screen.getByText('A2'));
        await fireEvent.press(screen.getByText('Submit answers'));
        expect(mockSubmit).toHaveBeenCalledWith('att-1', { k1: 'A1', k2: 'A2' });
    });

    test('10/11. server score renders as-is on PASS', async () => {
        mockStart.mockResolvedValue({ attemptId: 'att-1', programVersion: '1.0', questions: QUESTIONS });
        mockSubmit.mockResolvedValue({ score: 87, passed: true, submitted: true, contentStale: false });
        const screen = await render(<CredentialChallengeRunner {...baseProps} />);
        await screen.findByText('Q1?');
        await fireEvent.press(screen.getByText('A1'));
        await fireEvent.press(screen.getByText('Next'));
        await fireEvent.press(screen.getByText('A2'));
        await fireEvent.press(screen.getByText('Submit answers'));
        // The displayed score is the server's verbatim value — the client
        // computes nothing (submit answers were incomplete by design).
        expect(await screen.findByText('Knowledge passed')).toBeTruthy();
        expect(screen.getByText(/Score: 87%/)).toBeTruthy();
        expect(baseProps.onComplete).toHaveBeenCalledWith(
            expect.objectContaining({ passed: true, score: 87, contentStale: false }),
        );
    });

    test('12. server FAIL never renders passed', async () => {
        mockStart.mockResolvedValue({ attemptId: 'att-3', programVersion: '1.0', questions: QUESTIONS.slice(0, 1) });
        mockSubmit.mockResolvedValue({ passed: false, submitted: true, contentStale: false });
        const screen = await render(<CredentialChallengeRunner {...baseProps} />);
        await screen.findByText('Q1?');
        await fireEvent.press(screen.getByText('A1'));
        await fireEvent.press(screen.getByText('Submit answers'));
        expect(await screen.findByText('Knowledge check not passed')).toBeTruthy();
        expect(screen.queryByText('Knowledge passed')).toBeNull();
    });

    test('13. stale content renders the updated state with a fresh start', async () => {
        mockStart.mockResolvedValue({ attemptId: 'att-4', programVersion: '1.0', questions: QUESTIONS.slice(0, 1) });
        mockSubmit.mockResolvedValue({ passed: false, submitted: false, contentStale: true });
        const screen = await render(<CredentialChallengeRunner {...baseProps} />);
        await screen.findByText('Q1?');
        await fireEvent.press(screen.getByText('A1'));
        await fireEvent.press(screen.getByText('Submit answers'));
        expect(await screen.findByText(/This check was updated/)).toBeTruthy();
        expect(screen.queryByText('Knowledge passed')).toBeNull();
        expect(screen.queryByText('Knowledge check not passed')).toBeNull();
        await fireEvent.press(screen.getByText('Start new check'));
        expect(mockStart.mock.calls.length).toBe(2);
    });

    test('14. content-unavailable start renders temporary copy, learning unaffected', async () => {
        mockStart.mockRejectedValueOnce(new Error('boom: credential_content_unavailable for chess'));
        const screen = await render(<CredentialChallengeRunner {...baseProps} />);
        expect(await screen.findByText(/temporarily unavailable/)).toBeTruthy();
        expect(screen.queryByText('Knowledge passed')).toBeNull();
    });

    test('14b. network failure renders network copy, not unavailable copy', async () => {
        mockStart.mockRejectedValueOnce(new Error('Network request failed'));
        const screen = await render(<CredentialChallengeRunner {...baseProps} />);
        expect(await screen.findByText(/internet connection/)).toBeTruthy();
        expect(screen.queryByText(/temporarily unavailable/)).toBeNull();
    });

    test('9b. only safe server payload is rendered (no keys, no bank ids)', async () => {
        const LEAKY = [
            {
                item_key: 'k1',
                skill: 'rules',
                payload: {
                    prompt: 'Safe prompt?',
                    options: ['A1', 'B1'],
                    answer: 'A1',
                    correct_answer: 'A1',
                    bank_id: 'uuid-1234',
                    threshold: 0.8,
                },
            },
        ];
        mockStart.mockResolvedValue({ attemptId: 'att-safe', programVersion: '1.0', questions: LEAKY });
        const screen = await render(<CredentialChallengeRunner {...baseProps} />);
        expect(await screen.findByText('Safe prompt?')).toBeTruthy();
        expect(screen.queryByText('uuid-1234')).toBeNull();
        expect(screen.queryByText('threshold')).toBeNull();
        // Options render, but the leaked answer key as a standalone secret is not surfaced.
        expect(screen.getByText('A1')).toBeTruthy();
    });

    test('11b. no client grading: empty answers still defer to server verdict', async () => {
        mockStart.mockResolvedValue({ attemptId: 'att-nograde', programVersion: '1.0', questions: QUESTIONS.slice(0, 1) });
        mockSubmit.mockResolvedValue({ score: 40, passed: false, submitted: true, contentStale: false });
        const screen = await render(<CredentialChallengeRunner {...baseProps} />);
        await screen.findByText('Q1?');
        // Submit without choosing anything — client must not block or grade.
        await fireEvent.press(screen.getByText('Submit answers'));
        expect(mockSubmit).toHaveBeenCalledWith('att-nograde', {});
        expect(await screen.findByText('Knowledge check not passed')).toBeTruthy();
        expect(screen.queryByText('Knowledge passed')).toBeNull();
    });

    test('20. Home screen stays journey-free (no credential imports)', () => {
        const fs = require('fs');
        const path = require('path');
        const homeCandidates = [
            'src/screens/tabs/HomeTab.tsx',
            'src/screens/HomeScreen.tsx',
            'src/screens/tabs/Home.tsx',
        ];
        const existing = homeCandidates
            .map(p => path.join(process.cwd(), p))
            .filter(p => fs.existsSync(p));
        expect(existing.length).toBeGreaterThan(0);
        for (const file of existing) {
            const content: string = fs.readFileSync(file, 'utf8');
            expect(content).not.toMatch(/useCredentialJourney|CredentialJourney|startKnowledgeAttempt/);
        }
    });

    test('migrations. no backend changes: nothing beyond 038', () => {
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
    });
});
