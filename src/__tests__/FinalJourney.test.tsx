/**
 * Slice 4 — Final Assessment experience (RNTL v14 async).
 *
 * Covers the 40 product proofs: shared-snapshot gate, pure final-state
 * derivation, one-action sequencing, safe final runner (questions keyed
 * by public id, no grading), server-deadline timer + reconcile, expiry,
 * pass/fail, rotation, unavailable/network split, cooldown/remediation
 * UX over the existing Verify flow, race handling, journey refresh,
 * Project teaser discipline, single CTA, and frozen-surface guards.
 */
import '@testing-library/jest-native/extend-expect';
import React from 'react';
import { render, fireEvent, waitFor, renderHook } from '@testing-library/react-native';
import {
    deriveFinalAssessmentState,
    deriveKnowledgeState,
    deriveNextAction,
    derivePracticalState,
    useCredentialJourney,
} from '../hooks/useCredentialJourney';
import { CredentialJourneySection } from '../components/credentials/CredentialJourneySection';
import {
    CredentialChallengeRunner,
    formatCountdown,
    parseFinalStartBlock,
    remainingSeconds,
} from '../components/credentials/CredentialChallengeRunner';
import {
    ensureEnrollment,
    getCredentialProgress,
    getCredentialStageSnapshot,
    getProgramAvailability,
    getSkillVerification,
    startAssessment,
    startKnowledgeAttempt,
    startPracticalAttempt,
    submitAssessment,
} from '../services/trustApi';

jest.mock('../services/trustApi', () => ({
    ensureEnrollment: jest.fn(),
    getCredentialProgress: jest.fn(),
    getCredentialStageSnapshot: jest.fn(),
    getKnowledgeJourneySnapshot: jest.fn(),
    getProgramAvailability: jest.fn(),
    getSkillVerification: jest.fn(),
    startAssessment: jest.fn(),
    startKnowledgeAttempt: jest.fn(),
    startPracticalAttempt: jest.fn(),
    submitAssessment: jest.fn(),
    submitKnowledgeAttempt: jest.fn(),
    submitPracticalAttempt: jest.fn(),
    isContentUnavailable: jest.fn((m: string) => String(m).includes('credential_content_unavailable')),
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
const mockSkills = getSkillVerification as jest.Mock;
const mockStartFinal = startAssessment as jest.Mock;
const mockSubmitFinal = submitAssessment as jest.Mock;
const mockStartKnowledge = startKnowledgeAttempt as jest.Mock;

const SKILLS_4_OF_4 = [
    { skillKey: 'rules', skillName: 'Rules', samplesCompleted: 4, samplesRequired: 4, passes: 4, passRate: 1, score: 100, verified: true },
    { skillKey: 'openings', skillName: 'Openings', samplesCompleted: 4, samplesRequired: 4, passes: 4, passRate: 1, score: 100, verified: true },
    { skillKey: 'endgames', skillName: 'Endgames', samplesCompleted: 4, samplesRequired: 4, passes: 4, passRate: 1, score: 100, verified: true },
    { skillKey: 'tactics', skillName: 'Tactics', samplesCompleted: 4, samplesRequired: 4, passes: 4, passRate: 1, score: 100, verified: true },
];

const SKILL_NAMES = { rules: 'Rules', openings: 'Openings', endgames: 'Endgames', tactics: 'Tactics' };

const FINAL_QS = [
    { id: 'fq1', skill: 'rules', prompt: 'Final Q1?', options: ['A1', 'B1'] },
    { id: 'fq2', skill: 'rules', prompt: 'Final Q2?', options: ['A2', 'B2'] },
];

const futureDeadline = (msAhead: number) => new Date(Date.now() + msAhead).toISOString();

function finalStart(over: Record<string, unknown> = {}) {
    return {
        attemptId: 'att-f1',
        attemptNumber: 1,
        questionSetVersion: 'v2',
        timeLimitMinutes: 30,
        questions: FINAL_QS,
        deadline: futureDeadline(30 * 60 * 1000),
        retakeReason: 'first_attempt',
        ...over,
    };
}

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
}

const KP_PASS = {
    knowledgeComponent: { score: 91, passed: true },
    knowledgeAttempts: [{ id: 'k1', status: 'submitted', score: 91, passed: true, submittedAt: '2026-02-01' }],
    practicalAttempts: [{ id: 'p1', status: 'submitted', score: 88, passed: true, submittedAt: '2026-02-02' }],
    practicalComponent: { score: 88, passed: true },
};

beforeEach(() => {
    jest.clearAllMocks();
    mockJourneyServer();
});

describe('final gate (pure + hook)', () => {
    test('1. Practical not passed => Final locked', async () => {
        mockJourneyServer({ knowledgeComponent: { score: 91, passed: true } });
        const { result } = await renderHook(() => useCredentialJourney('chess-foundations', {}));
        await waitFor(() => expect(result.current.journey).not.toBeNull());
        expect(result.current.journey!.practical.state).toBe('ready');
        expect(result.current.journey!.finalAssessment.state).toBe('locked');
        expect(result.current.journey!.nextAction).toEqual({ kind: 'start_practical' });
        expect(
            deriveFinalAssessmentState({
                component: null,
                attempts: [],
                knowledgePassed: true,
                practicalPassed: false,
                allSkillsVerified: true,
                unavailable: false,
            }).state,
        ).toBe('locked');
    });

    test('2. current-live Practical PASS => Final ready', async () => {
        mockJourneyServer({ ...KP_PASS });
        const { result } = await renderHook(() => useCredentialJourney('chess-foundations', {}));
        await waitFor(() => expect(result.current.journey).not.toBeNull());
        expect(result.current.journey!.finalAssessment).toMatchObject({ state: 'ready', score: null });
        expect(result.current.journey!.nextAction).toEqual({ kind: 'start_final' });
    });

    test('3. stale K/P cannot unlock Final', async () => {
        mockJourneyServer({ knowledgeComponent: null, practicalComponent: null });
        const { result } = await renderHook(() => useCredentialJourney('chess-foundations', {}));
        await waitFor(() => expect(result.current.journey).not.toBeNull());
        expect(result.current.journey!.knowledge.state).toBe('ready');
        expect(result.current.journey!.practical.state).toBe('locked');
        expect(result.current.journey!.finalAssessment.state).toBe('locked');
        expect(
            deriveFinalAssessmentState({
                component: { score: 95, passed: true },
                attempts: [],
                knowledgePassed: false,
                practicalPassed: false,
                allSkillsVerified: true,
                unavailable: false,
            }).state,
        ).toBe('locked');
    });

    test('4. live Final started => in_progress (number + deadline exposed)', async () => {
        mockJourneyServer({
            ...KP_PASS,
            finalAttempts: [
                {
                    id: 'f1', attemptNumber: 2, status: 'started', score: null, passed: null,
                    deadline: '2026-03-01T10:30:00Z', submittedAt: null,
                },
            ],
        });
        const { result } = await renderHook(() => useCredentialJourney('chess-foundations', {}));
        await waitFor(() => expect(result.current.journey).not.toBeNull());
        expect(result.current.journey!.finalAssessment).toEqual({
            state: 'in_progress',
            score: null,
            attemptId: 'f1',
            attemptNumber: 2,
            deadline: '2026-03-01T10:30:00Z',
        });
        expect(result.current.journey!.nextAction).toEqual({ kind: 'continue_final' });
    });

    test('5. stale-bank Final started ignored by read model', async () => {
        // Adapter drops the stale row: hook sees an empty live set.
        mockJourneyServer({ ...KP_PASS, finalAttempts: [] });
        const { result } = await renderHook(() => useCredentialJourney('chess-foundations', {}));
        await waitFor(() => expect(result.current.journey).not.toBeNull());
        expect(result.current.journey!.finalAssessment.state).toBe('ready');
        expect(
            deriveFinalAssessmentState({
                component: null,
                attempts: [
                    { id: 's', attemptNumber: 1, status: 'superseded', score: null, passed: null, deadline: null, submittedAt: null } as never,
                ],
                knowledgePassed: true,
                practicalPassed: true,
                allSkillsVerified: true,
                unavailable: false,
            }).state,
        ).toBe('ready');
    });

    test('6. live Final PASS component => passed', async () => {
        mockJourneyServer({
            ...KP_PASS,
            finalAttempts: [
                {
                    id: 'f1', attemptNumber: 1, status: 'submitted', score: 92, passed: true,
                    deadline: '2026-03-01T10:30:00Z', submittedAt: '2026-03-01T10:20:00Z',
                },
            ],
            finalComponent: { score: 92, passed: true },
        });
        const { result } = await renderHook(() => useCredentialJourney('chess-foundations', {}));
        await waitFor(() => expect(result.current.journey).not.toBeNull());
        expect(result.current.journey!.finalAssessment).toMatchObject({ state: 'passed', score: 92 });
        expect(result.current.journey!.nextAction).toEqual({ kind: 'continue_learning' });
    });

    test('7. stale Final PASS ignored', async () => {
        mockJourneyServer({ ...KP_PASS, finalAttempts: [], finalComponent: null });
        const { result } = await renderHook(() => useCredentialJourney('chess-foundations', {}));
        await waitFor(() => expect(result.current.journey).not.toBeNull());
        expect(result.current.journey!.finalAssessment.state).toBe('ready');
        expect(result.current.journey!.nextAction).toEqual({ kind: 'start_final' });
    });

    test('unavailable + failed derivations', () => {
        const base = {
            component: null, attempts: [], knowledgePassed: true,
            practicalPassed: true, allSkillsVerified: true, unavailable: true,
        };
        expect(deriveFinalAssessmentState(base).state).toBe('temporarily_unavailable');
        expect(
            deriveFinalAssessmentState({
                ...base,
                unavailable: false,
                attempts: [
                    {
                        id: 'f9', attemptNumber: 3, status: 'submitted', score: 40, passed: false,
                        deadline: '2026-03-01T10:30:00Z', submittedAt: '2026-03-01T10:20:00Z',
                    },
                ],
            }),
        ).toMatchObject({ state: 'failed', score: 40 });
        // Full next-action chain keeps one CTA.
        expect(deriveNextAction(null, true, 'passed', 'passed', 'ready')).toEqual({ kind: 'start_final' });
        expect(deriveNextAction(null, true, 'passed', 'passed', 'failed')).toEqual({ kind: 'start_final' });
        expect(deriveNextAction(null, true, 'passed', 'passed', 'in_progress')).toEqual({ kind: 'continue_final' });
        expect(deriveNextAction(null, true, 'passed', 'passed', 'passed')).toEqual({ kind: 'continue_learning' });
        // Older callers behave exactly as before.
        expect(deriveNextAction(null, true, 'passed', 'passed')).toEqual({ kind: 'continue_learning' });
        expect(deriveNextAction(null, true, 'passed', 'ready')).toEqual({ kind: 'start_practical' });
    });
});

describe('final runner: start, resume, safe payload', () => {
    const baseProps = {
        visible: true,
        mode: 'final' as const,
        programSlug: 'chess-foundations',
        programTitle: 'Chess Foundations',
        onClose: jest.fn(),
        onComplete: jest.fn(),
        onVerifySkill: jest.fn(),
        skillNames: SKILL_NAMES,
    };

    beforeEach(() => {
        baseProps.onClose = jest.fn();
        baseProps.onComplete = jest.fn();
        baseProps.onVerifySkill = jest.fn();
    });

    test('8. Start Final calls startAssessment (Section, after enrollment)', async () => {
        mockJourneyServer({ ...KP_PASS });
        mockEnsure.mockResolvedValue({ enrolled: true, alreadyEnrolled: false });
        mockStartFinal.mockResolvedValue(finalStart());
        const screen = await render(
            <CredentialJourneySection programSlug="chess-foundations" programTitle="Chess Foundations" recommendation={null} onVerifySkill={() => {}} onContinueLearning={() => {}} />,
        );
        await screen.findByText('Start Final Assessment');
        await fireEvent.press(screen.getByText('Start Final Assessment'));
        expect(mockEnsure).toHaveBeenCalledWith('chess-foundations');
        expect(
            (mockEnsure as jest.Mock).mock.invocationCallOrder[0],
        ).toBeLessThan((mockStartFinal as jest.Mock).mock.invocationCallOrder[0]);
        expect(mockStartFinal).toHaveBeenCalledWith('chess-foundations');
        expect(await screen.findByText('Final Q1?')).toBeTruthy();
        expect(screen.getByText('Question 1 of 2')).toBeTruthy();
    });

    test('9. active attempt resumes same id/deadline', async () => {
        const deadline = futureDeadline(20 * 60 * 1000);
        mockStartFinal.mockResolvedValue(finalStart({ retakeReason: 'active_attempt', deadline }));
        const screen = await render(<CredentialChallengeRunner {...baseProps} />);
        expect(mockStartFinal).toHaveBeenCalledWith('chess-foundations');
        expect(await screen.findByText('Final Q1?')).toBeTruthy();
        expect(mockStartFinal.mock.calls.length).toBe(1);
        expect(screen.getByText(/Time left/)).toBeTruthy();
    });

    test('10. safe assigned question payload only', async () => {
        const LEAKY = [
            {
                id: 'fq1', skill: 'rules', prompt: 'Safe?', options: ['A', 'B'],
                answer: 'A', correct_answer: 'A', pass_score: 80, bank: 'bank-uuid-9',
            },
        ];
        mockStartFinal.mockResolvedValue(finalStart({ questions: LEAKY }));
        const screen = await render(<CredentialChallengeRunner {...baseProps} />);
        expect(await screen.findByText('Safe?')).toBeTruthy();
        expect(screen.queryByText('bank-uuid-9')).toBeNull();
        expect(screen.queryByText('pass_score')).toBeNull();
    });

    test('11. answers keyed by question id', async () => {
        mockStartFinal.mockResolvedValue(finalStart());
        mockSubmitFinal.mockResolvedValue({ passed: true, submitted: true, contentStale: false });
        const screen = await render(<CredentialChallengeRunner {...baseProps} />);
        await screen.findByText('Final Q1?');
        await fireEvent.press(screen.getByText('A1'));
        await fireEvent.press(screen.getByText('Continue'));
        await screen.findByText('Final Q2?');
        await fireEvent.press(screen.getByText('A2'));
        await fireEvent.press(screen.getByText('Submit Final Assessment'));
        expect(mockSubmitFinal).toHaveBeenCalledWith('att-f1', { fq1: 'A1', fq2: 'A2' });
    });

    test('12. no client grading: empty answers defer to the server', async () => {
        mockStartFinal.mockResolvedValue(finalStart({ questions: FINAL_QS.slice(0, 1) }));
        mockSubmitFinal.mockResolvedValue({ score: 40, passed: false, submitted: true, contentStale: false });
        const screen = await render(<CredentialChallengeRunner {...baseProps} />);
        await screen.findByText('Final Q1?');
        await fireEvent.press(screen.getByText('Submit Final Assessment'));
        expect(mockSubmitFinal).toHaveBeenCalledWith('att-f1', {});
        expect(await screen.findByText('Final Assessment not passed')).toBeTruthy();
        expect(screen.queryByText('Final Assessment passed')).toBeNull();
    });
});

describe('final runner: server-deadline timer', () => {
    const baseProps = {
        visible: true,
        mode: 'final' as const,
        programSlug: 'chess-foundations',
        programTitle: 'Chess Foundations',
        onClose: jest.fn(),
        onComplete: jest.fn(),
        onVerifySkill: jest.fn(),
        skillNames: SKILL_NAMES,
    };

    beforeEach(() => {
        baseProps.onClose = jest.fn();
        baseProps.onComplete = jest.fn();
        baseProps.onVerifySkill = jest.fn();
    });

    test('13/14. deadline uses the server deadline; countdown displays it', async () => {
        // Absurd local duration must never leak into the display.
        mockStartFinal.mockResolvedValue(finalStart({ timeLimitMinutes: 999, deadline: futureDeadline(150 * 1000) }));
        const screen = await render(<CredentialChallengeRunner {...baseProps} />);
        await screen.findByText('Final Q1?');
        expect(screen.getByText(/Time left 2:[0-5][0-9]/)).toBeTruthy();
    });

    test('15/16. countdown zero reconciles once; client never marks expiry', async () => {
        mockStartFinal
            .mockResolvedValueOnce(finalStart({ deadline: new Date(Date.now() - 5000).toISOString() }))
            .mockResolvedValueOnce({
                attemptId: 'att-f1',
                attemptNumber: 1,
                questionSetVersion: 'v2',
                timeLimitMinutes: 30,
                questions: [],
                deadline: new Date(Date.now() - 5000).toISOString(),
                retakeReason: 'expired_finalized',
            });
        mockSubmitFinal.mockResolvedValue({ passed: true, submitted: true, contentStale: false });
        const screen = await render(<CredentialChallengeRunner {...baseProps} />);
        // Server reconciliation runs exactly once, then expiry renders.
        // (The answering frame resolves in microtasks; assert the end state.)
        await waitFor(() => expect(mockStartFinal.mock.calls.length).toBe(2));
        expect(await screen.findByText('Time expired')).toBeTruthy();
        // Interval ticks must not reconcile again.
        await new Promise(resolve => setTimeout(resolve, 1200));
        expect(mockStartFinal.mock.calls.length).toBe(2);
        // Nothing decided locally: no submit, no fail title, no score.
        expect(mockSubmitFinal).not.toHaveBeenCalled();
        expect(screen.queryByText('Final Assessment not passed')).toBeNull();
        expect(screen.queryByText(/Score/)).toBeNull();
        expect(baseProps.onComplete).toHaveBeenCalledWith(
            expect.objectContaining({ passed: false, contentStale: false }),
        );
    });

    test('remainingSeconds/formatCountdown are pure display helpers', () => {
        expect(remainingSeconds(null, Date.now())).toBeNull();
        expect(remainingSeconds('not-a-date', Date.now())).toBeNull();
        expect(remainingSeconds(new Date(Date.now() + 90000).toISOString(), Date.now())).toBeGreaterThan(80);
        expect(remainingSeconds(new Date(Date.now() - 1000).toISOString(), Date.now())).toBe(0);
        expect(formatCountdown(29 * 60 + 42)).toBe('29:42');
        expect(formatCountdown(5)).toBe('0:05');
        expect(formatCountdown(3700)).toBe('1:01:40');
    });

    test('timer skew: same-identity resume reconciles once across ticks; submit stays server-owned', async () => {
        // Client clock already past the deadline, but the server still sees
        // the attempt as active and resumes the SAME id + deadline.
        const skewedDeadline = new Date(Date.now() - 5000).toISOString();
        mockStartFinal.mockResolvedValue(finalStart({ deadline: skewedDeadline, retakeReason: 'active_attempt' }));
        mockSubmitFinal.mockResolvedValue({ score: 92, passed: true, submitted: true, contentStale: false });
        const screen = await render(<CredentialChallengeRunner {...baseProps} />);
        // Initial start + exactly one auto-reconcile.
        await waitFor(() => expect(mockStartFinal.mock.calls.length).toBe(2));
        // At least 3 client timer ticks pass: no further automatic calls.
        // (Real timers: the 1s countdown interval must fire repeatedly.)
        await new Promise(resolve => setTimeout(resolve, 3200));
        expect(mockStartFinal.mock.calls.length).toBe(2);
        // No local failure invented; the attempt keeps rendering.
        expect(await screen.findByText('Final Q1?')).toBeTruthy();
        expect(screen.queryByText('Time expired')).toBeNull();
        expect(screen.queryByText('Final Assessment not passed')).toBeNull();
        expect(screen.queryByText(/Score/)).toBeNull();
        expect(mockSubmitFinal).not.toHaveBeenCalled();
        // Manual submit remains available and server-owned.
        await fireEvent.press(screen.getByText('A1'));
        await fireEvent.press(screen.getByText('Continue'));
        await fireEvent.press(screen.getByText('A2'));
        await fireEvent.press(screen.getByText('Submit Final Assessment'));
        expect(mockSubmitFinal).toHaveBeenCalledWith('att-f1', { fq1: 'A1', fq2: 'A2' });
        expect(await screen.findByText('Final Assessment passed')).toBeTruthy();
    });

    test('timer skew: different identity gets its own one-time reconcile', async () => {
        // Reconcile #1 returns a DIFFERENT attempt + deadline (also already
        // past on the client clock): the new identity may reconcile once,
        // then expiry resolves it.
        const pastA = new Date(Date.now() - 5000).toISOString();
        const pastB = new Date(Date.now() - 3000).toISOString();
        mockStartFinal
            .mockResolvedValueOnce(finalStart({ attemptId: 'att-a', deadline: pastA }))
            .mockResolvedValueOnce(
                finalStart({ attemptId: 'att-b', deadline: pastB, retakeReason: 'active_attempt' }),
            )
            .mockResolvedValue({
                attemptId: 'att-b',
                attemptNumber: 2,
                questionSetVersion: 'v2',
                timeLimitMinutes: 30,
                questions: [],
                deadline: pastB,
                retakeReason: 'expired_finalized',
            });
        const screen = await render(<CredentialChallengeRunner {...baseProps} />);
        // Initial start + reconcile(att-A) + reconcile(att-B) = 3 total.
        await waitFor(() => expect(mockStartFinal.mock.calls.length).toBe(3));
        expect(await screen.findByText('Time expired')).toBeTruthy();
        // Settled: no fourth call across further ticks.
        await new Promise(resolve => setTimeout(resolve, 1500));
        expect(mockStartFinal.mock.calls.length).toBe(3);
        expect(mockSubmitFinal).not.toHaveBeenCalled();
    });
});

describe('final runner: expiry, pass/fail, rotation, errors', () => {
    const baseProps = {
        visible: true,
        mode: 'final' as const,
        programSlug: 'chess-foundations',
        programTitle: 'Chess Foundations',
        onClose: jest.fn(),
        onComplete: jest.fn(),
        onVerifySkill: jest.fn(),
        skillNames: SKILL_NAMES,
    };

    beforeEach(() => {
        baseProps.onClose = jest.fn();
        baseProps.onComplete = jest.fn();
        baseProps.onVerifySkill = jest.fn();
    });

    test('17. expired_finalized shows Time expired (no invented score)', async () => {
        mockStartFinal.mockResolvedValue({
            attemptId: 'att-fx',
            attemptNumber: 3,
            questionSetVersion: 'v2',
            timeLimitMinutes: 30,
            questions: [],
            deadline: new Date(Date.now() - 1000).toISOString(),
            retakeReason: 'expired_finalized',
        });
        const screen = await render(<CredentialChallengeRunner {...baseProps} />);
        expect(await screen.findByText('Time expired')).toBeTruthy();
        expect(screen.getByText(/recorded as not passed/)).toBeTruthy();
        expect(screen.queryByText(/Score/)).toBeNull();
        expect(screen.queryByText('Final Assessment passed')).toBeNull();
        expect(screen.queryByText('Final Assessment not passed')).toBeNull();
        await fireEvent.press(screen.getByText('Continue learning'));
        expect(baseProps.onClose).toHaveBeenCalledTimes(1);
    });

    test('18. expired_finalized triggers journey refresh (Section)', async () => {
        mockJourneyServer({ ...KP_PASS });
        mockEnsure.mockResolvedValue({ enrolled: true, alreadyEnrolled: false });
        mockStartFinal.mockResolvedValue({
            attemptId: 'att-fx',
            attemptNumber: 3,
            questionSetVersion: 'v2',
            timeLimitMinutes: 30,
            questions: [],
            deadline: new Date(Date.now() - 1000).toISOString(),
            retakeReason: 'expired_finalized',
        });
        const screen = await render(
            <CredentialJourneySection programSlug="chess-foundations" programTitle="Chess Foundations" recommendation={null} onVerifySkill={() => {}} onContinueLearning={() => {}} />,
        );
        await screen.findByText('Start Final Assessment');
        const stageBefore = mockStage.mock.calls.length;
        await fireEvent.press(screen.getByText('Start Final Assessment'));
        expect(await screen.findByText('Time expired')).toBeTruthy();
        await waitFor(() => expect(mockStage.mock.calls.length).toBeGreaterThan(stageBefore));
    });

    test('19. normal server PASS renders passed', async () => {
        mockStartFinal.mockResolvedValue(finalStart());
        mockSubmitFinal.mockResolvedValue({ score: 92, passed: true, submitted: true, contentStale: false });
        const screen = await render(<CredentialChallengeRunner {...baseProps} />);
        await screen.findByText('Final Q1?');
        await fireEvent.press(screen.getByText('A1'));
        await fireEvent.press(screen.getByText('Continue'));
        await fireEvent.press(screen.getByText('A2'));
        await fireEvent.press(screen.getByText('Submit Final Assessment'));
        expect(await screen.findByText('Final Assessment passed')).toBeTruthy();
        expect(screen.getByText(/Score: 92%/)).toBeTruthy();
        expect(baseProps.onComplete).toHaveBeenCalledWith(
            expect.objectContaining({ passed: true, score: 92, contentStale: false }),
        );
    });

    test('20. normal server FAIL renders not passed', async () => {
        mockStartFinal.mockResolvedValue(finalStart({ questions: FINAL_QS.slice(0, 1) }));
        mockSubmitFinal.mockResolvedValue({ score: 40, passed: false, submitted: true, contentStale: false });
        const screen = await render(<CredentialChallengeRunner {...baseProps} />);
        await screen.findByText('Final Q1?');
        await fireEvent.press(screen.getByText('A1'));
        await fireEvent.press(screen.getByText('Submit Final Assessment'));
        expect(await screen.findByText('Final Assessment not passed')).toBeTruthy();
        expect(screen.getByText(/Score: 40%/)).toBeTruthy();
        expect(screen.queryByText('Final Assessment passed')).toBeNull();
    });

    test('21/22. stale submission renders updated state; returns to path only', async () => {
        mockStartFinal.mockResolvedValue(finalStart({ questions: FINAL_QS.slice(0, 1) }));
        mockSubmitFinal.mockResolvedValue({ passed: false, submitted: false, contentStale: true });
        const screen = await render(<CredentialChallengeRunner {...baseProps} />);
        await screen.findByText('Final Q1?');
        await fireEvent.press(screen.getByText('A1'));
        await fireEvent.press(screen.getByText('Submit Final Assessment'));
        expect(await screen.findByText(/Return to your credential path/)).toBeTruthy();
        // No score, no verdict, no direct restart offered.
        expect(screen.queryByText(/Score/)).toBeNull();
        expect(screen.queryByText('Final Assessment passed')).toBeNull();
        expect(screen.queryByText('Final Assessment not passed')).toBeNull();
        expect(screen.queryByText('Start new Final')).toBeNull();
        expect(screen.queryByText('Start new check')).toBeNull();
        await fireEvent.press(screen.getByText('Return to credential path'));
        expect(baseProps.onClose).toHaveBeenCalledTimes(1);
        expect(baseProps.onComplete).toHaveBeenCalledWith(
            expect.objectContaining({ contentStale: true }),
        );
    });

    test('23. content unavailable != network error', async () => {
        mockStartFinal.mockRejectedValueOnce(new Error('boom: credential_content_unavailable now'));
        const unavailable = await render(<CredentialChallengeRunner {...baseProps} />);
        expect(await unavailable.findByText(/temporarily unavailable/)).toBeTruthy();
        expect(unavailable.queryByText('Final Assessment passed')).toBeNull();

        mockStartFinal.mockRejectedValueOnce(new Error('Network request failed'));
        const offline = await render(<CredentialChallengeRunner {...baseProps} />);
        expect(await offline.findByText(/internet connection/)).toBeTruthy();
        expect(offline.queryByText(/temporarily unavailable/)).toBeNull();
    });
});

describe('final runner: retake blocks + race handling', () => {
    const baseProps = {
        visible: true,
        mode: 'final' as const,
        programSlug: 'chess-foundations',
        programTitle: 'Chess Foundations',
        onClose: jest.fn(),
        onComplete: jest.fn(),
        onVerifySkill: jest.fn(),
        skillNames: SKILL_NAMES,
    };

    beforeEach(() => {
        baseProps.onClose = jest.fn();
        baseProps.onComplete = jest.fn();
        baseProps.onVerifySkill = jest.fn();
    });

    test('24/25. cooldown error is parsed safely; timestamp is server-provided', () => {
        expect(parseFinalStartBlock('retake_blocked:cooldown:2026-09-14T10:30:16Z')).toEqual({
            kind: 'cooldown',
            until: '2026-09-14T10:30:16Z',
        });
        expect(parseFinalStartBlock('retake_blocked:remediation_required:rules,tactics')).toEqual({
            kind: 'remediation',
            skillKeys: ['rules', 'tactics'],
        });
        expect(parseFinalStartBlock('final_not_ready:knowledge')).toEqual({ kind: 'not_ready' });
        expect(parseFinalStartBlock('final_already_passed')).toEqual({ kind: 'already_passed' });
        expect(parseFinalStartBlock('x credential_content_unavailable y')).toEqual({ kind: 'content_unavailable' });
        expect(parseFinalStartBlock('Network request failed')).toEqual({ kind: 'network' });
    });

    test('cooldown UX shows safe copy with the server timestamp', async () => {
        mockStartFinal.mockRejectedValueOnce(new Error('retake_blocked:cooldown:2026-09-14T10:30:16Z'));
        const screen = await render(<CredentialChallengeRunner {...baseProps} />);
        expect(await screen.findByText(/Your next Final attempt will be available after/)).toBeTruthy();
        expect(screen.queryByText(/retake_blocked/)).toBeNull();
        expect(screen.queryByText(/credential_content_unavailable/)).toBeNull();
        await fireEvent.press(screen.getByText('Continue learning'));
        expect(baseProps.onClose).toHaveBeenCalledTimes(1);
    });

    test('26. cooldown never bypasses the server start', async () => {
        mockStartFinal.mockRejectedValueOnce(new Error('retake_blocked:cooldown:2026-09-14T10:30:16Z'));
        const screen = await render(<CredentialChallengeRunner {...baseProps} />);
        await screen.findByText(/Your next Final attempt will be available after/);
        expect(screen.queryByText('Final Q1?')).toBeNull();
        expect(mockSubmitFinal).not.toHaveBeenCalled();
        // Only the safe action exists; closing performs no hidden start.
        expect(mockStartFinal.mock.calls.length).toBe(1);
    });

    test('27/28/29. remediation maps keys to names and reuses Verify flow only', async () => {
        mockStartFinal.mockRejectedValueOnce(new Error('retake_blocked:remediation_required:rules,tactics'));
        const screen = await render(<CredentialChallengeRunner {...baseProps} />);
        expect(await screen.findByText(/complete a fresh skill check/)).toBeTruthy();
        expect(screen.getByText(/Rules, Tactics/)).toBeTruthy();
        expect(screen.queryByText(/retake_blocked/)).toBeNull();
        expect(screen.queryByText(/remediation_required/)).toBeNull();
        // ONE primary action through the existing Verify flow.
        await fireEvent.press(screen.getByText('Verify Rules'));
        expect(baseProps.onVerifySkill).toHaveBeenCalledWith({ skillKey: 'rules', skillName: 'Rules' });
        expect(baseProps.onClose).toHaveBeenCalledTimes(1);
        expect(screen.queryByText('Continue learning')).toBeNull();
        expect(screen.queryByText('Retry')).toBeNull();
    });

    test('30. final_not_ready triggers refresh, raw code hidden', async () => {
        mockStartFinal.mockRejectedValueOnce(new Error('start: final_not_ready:practical'));
        const screen = await render(<CredentialChallengeRunner {...baseProps} />);
        expect(await screen.findByText(/credential path changed/)).toBeTruthy();
        expect(screen.queryByText(/final_not_ready/)).toBeNull();
        expect(screen.queryByText(/practical/)).toBeNull();
        expect(baseProps.onComplete).toHaveBeenCalledWith(
            expect.objectContaining({ passed: false, contentStale: false }),
        );
    });

    test('31. final_already_passed triggers refresh, never an error', async () => {
        mockStartFinal.mockRejectedValueOnce(new Error('start: final_already_passed'));
        const screen = await render(<CredentialChallengeRunner {...baseProps} />);
        await waitFor(() => expect(baseProps.onClose).toHaveBeenCalledTimes(1));
        expect(baseProps.onComplete).toHaveBeenCalledWith(
            expect.objectContaining({ passed: true, contentStale: false }),
        );
        expect(screen.queryByText(/temporarily unavailable/)).toBeNull();
        expect(screen.queryByText(/internet connection/)).toBeNull();
        expect(screen.queryByText(/final_already_passed/)).toBeNull();
    });
});

describe('final journey UX: refresh, Project teaser, single CTA', () => {
    test('32. Final completion refreshes canonical journey', async () => {
        mockJourneyServer({ ...KP_PASS });
        mockEnsure.mockResolvedValue({ enrolled: true, alreadyEnrolled: false });
        mockStartFinal.mockResolvedValue(finalStart({ questions: FINAL_QS.slice(0, 1) }));
        mockSubmitFinal.mockResolvedValue({ score: 92, passed: true, submitted: true, contentStale: false });
        const screen = await render(
            <CredentialJourneySection programSlug="chess-foundations" programTitle="Chess Foundations" recommendation={null} onVerifySkill={() => {}} onContinueLearning={() => {}} />,
        );
        await screen.findByText('Start Final Assessment');
        const progressBefore = mockProgress.mock.calls.length;
        const stageBefore = mockStage.mock.calls.length;
        await fireEvent.press(screen.getByText('Start Final Assessment'));
        await screen.findByText('Final Q1?');
        await fireEvent.press(screen.getByText('A1'));
        await fireEvent.press(screen.getByText('Submit Final Assessment'));
        expect(await screen.findByText('Final Assessment passed')).toBeTruthy();
        await waitFor(() => expect(mockProgress.mock.calls.length).toBeGreaterThan(progressBefore));
        expect(mockStage.mock.calls.length).toBeGreaterThan(stageBefore);
    });

    test('33/34. Project teaser appears only after Final PASS; stays non-interactive', async () => {
        // Practical passed alone: Final ready, Project hidden.
        mockJourneyServer({ ...KP_PASS });
        const ready = await render(
            <CredentialJourneySection programSlug="chess-foundations" programTitle="Chess Foundations" recommendation={null} onVerifySkill={() => {}} onContinueLearning={() => {}} />,
        );
        await ready.findByText('Start Final Assessment');
        expect(ready.queryByText('Project')).toBeNull();

        // Final passed: Project teaser + Continue learning, zero actions.
        mockJourneyServer({
            ...KP_PASS,
            finalAttempts: [
                {
                    id: 'f1', attemptNumber: 1, status: 'submitted', score: 92, passed: true,
                    deadline: '2026-03-01T10:30:00Z', submittedAt: '2026-03-01T10:20:00Z',
                },
            ],
            finalComponent: { score: 92, passed: true },
        });
        const done = await render(
            <CredentialJourneySection programSlug="chess-foundations" programTitle="Chess Foundations" recommendation={null} onVerifySkill={() => {}} onContinueLearning={() => {}} />,
        );
        expect(await done.findByText(/Project/)).toBeTruthy();
        expect(await done.findByText(/Next step/)).toBeTruthy();
        expect(await done.findByText('Continue learning')).toBeTruthy();
        expect(done.queryByText('Start Project')).toBeNull();
        expect(done.queryByText('Open Project')).toBeNull();
        expect(done.queryByText('Submit Project')).toBeNull();
    });

    test('35. one primary official CTA remains', async () => {
        mockJourneyServer({ ...KP_PASS });
        const final = await render(
            <CredentialJourneySection programSlug="chess-foundations" programTitle="Chess Foundations" recommendation={null} onVerifySkill={() => {}} onContinueLearning={() => {}} />,
        );
        await final.findByText('Start Final Assessment');
        expect(final.queryByText('Start Knowledge Check')).toBeNull();
        expect(final.queryByText('Start Practical Check')).toBeNull();
        expect(final.queryByText('Continue Final Assessment')).toBeNull();
        expect(final.queryByText('Continue learning')).toBeNull();

        mockJourneyServer({
            ...KP_PASS,
            finalAttempts: [
                {
                    id: 'f1', attemptNumber: 1, status: 'submitted', score: 92, passed: true,
                    deadline: '2026-03-01T10:30:00Z', submittedAt: '2026-03-01T10:20:00Z',
                },
            ],
            finalComponent: { score: 92, passed: true },
        });
        const passed = await render(
            <CredentialJourneySection programSlug="chess-foundations" programTitle="Chess Foundations" recommendation={null} onVerifySkill={() => {}} onContinueLearning={() => {}} />,
        );
        await passed.findByText('Continue learning');
        expect(passed.queryByText('Start Final Assessment')).toBeNull();
        expect(passed.queryByText('Start Knowledge Check')).toBeNull();
        expect(passed.queryByText('Start Practical Check')).toBeNull();
    });

    test('36/37. Knowledge + Practical behavior unchanged', async () => {
        expect(
            deriveKnowledgeState({ component: null, attempts: [], allSkillsVerified: true, unavailable: false }).state,
        ).toBe('ready');
        expect(
            derivePracticalState({
                component: null, attempts: [], knowledgePassed: true,
                allSkillsVerified: true, unavailable: false,
            }).state,
        ).toBe('ready');
        mockStartKnowledge.mockResolvedValue({
            attemptId: 'att-k1',
            programVersion: 'v2',
            questions: [{ item_key: 'k1', skill: 'rules', payload: { prompt: 'Q1?', options: ['A1', 'B1'] } }],
        });
        const screen = await render(
            <CredentialChallengeRunner
                visible={true}
                mode="knowledge"
                programSlug="chess-foundations"
                programTitle="Chess Foundations"
                onClose={() => {}}
                onComplete={() => {}}
            />,
        );
        expect(await screen.findByText('Q1?')).toBeTruthy();
        expect(screen.getByText('Question 1 of 1')).toBeTruthy();
    });

    test('38. no Home changes', () => {
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
            expect(content).not.toMatch(/useCredentialJourney|CredentialJourney|startAssessment|submitAssessment/);
        }
    });

    test('39. no migrations / backend RPC changes', () => {
        const fs = require('fs');
        const path = require('path');
        const dir = path.join(process.cwd(), 'supabase', 'migrations');
        const files: string[] = fs.readdirSync(dir).filter((f: string) => f.endsWith('.sql'));
        expect(files.length).toBeGreaterThan(0);
        const beyond = files.filter(f => {
            const m = /^(\d+)_/.exec(f);
            return m != null && Number(m[1]) > 37;
        });
        expect(beyond).toEqual([]);
        const api: string = fs.readFileSync(path.join(process.cwd(), 'src/services/trustApi.ts'), 'utf8');
        expect(api).toMatch(/start_assessment/);
        expect(api).toMatch(/submit_assessment/);
    });
});
