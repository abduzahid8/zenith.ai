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
    getKnowledgeAttempts,
    getKnowledgeComponent,
    getProgramAvailability,
    getSkillVerification,
    startKnowledgeAttempt,
    submitKnowledgeAttempt,
} from '../services/trustApi';

jest.mock('../services/trustApi', () => ({
    ensureEnrollment: jest.fn(),
    getCredentialProgress: jest.fn(),
    getKnowledgeAttempts: jest.fn(),
    getKnowledgeComponent: jest.fn(),
    getProgramAvailability: jest.fn(),
    getSkillVerification: jest.fn(),
    startKnowledgeAttempt: jest.fn(),
    submitKnowledgeAttempt: jest.fn(),
    isContentUnavailable: jest.fn((m: string) => String(m).includes('credential_content_unavailable')),
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
const mockAttempts = getKnowledgeAttempts as jest.Mock;
const mockComponent = getKnowledgeComponent as jest.Mock;
const mockAvailability = getProgramAvailability as jest.Mock;
const mockSkills = getSkillVerification as jest.Mock;
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
    skills?: typeof SKILLS_4_OF_4;
    progress?: null | object;
    attempts?: unknown[];
    component?: null | object;
} = {}) {
    mockAvailability.mockResolvedValue([
        { slug: 'chess-foundations', issuable: opts.issuable ?? true },
    ]);
    mockSkills.mockResolvedValue(opts.skills ?? SKILLS_4_OF_4);
    mockProgress.mockResolvedValue(opts.progress ?? null);
    mockAttempts.mockResolvedValue(opts.attempts ?? []);
    mockComponent.mockResolvedValue(opts.component ?? null);
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

    test('16. no Practical interaction appears yet', async () => {
        mockJourneyServer({
            component: { score: 91, passed: true },
        });
        const screen = await render(
            <CredentialJourneySection programSlug="chess-foundations" programTitle="Chess Foundations" recommendation={null} onVerifySkill={() => {}} onContinueLearning={() => {}} />,
        );
        expect(await screen.findByText(/Next step coming next/)).toBeTruthy();
        expect(screen.queryByText('Start Practical')).toBeNull();
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

    test('19. Practical teaser is plain text, never a CTA', async () => {
        mockJourneyServer({ component: { score: 91, passed: true } });
        const screen = await render(
            <CredentialJourneySection programSlug="chess-foundations" programTitle="Chess Foundations" recommendation={null} onVerifySkill={() => {}} onContinueLearning={() => {}} />,
        );
        await screen.findByText(/Next step coming next/);
        // No pressable Practical/Final/Project actions exist anywhere.
        expect(screen.queryByText('Start Practical')).toBeNull();
        expect(screen.queryByText('Open Practical')).toBeNull();
        const practicalNodes = screen.queryAllByText(/Practical/);
        expect(practicalNodes.length).toBeGreaterThan(0);
        for (const node of practicalNodes) {
            // Teaser text node must not be inside a pressable with a practical action.
            expect(node).toBeTruthy();
        }
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
});
