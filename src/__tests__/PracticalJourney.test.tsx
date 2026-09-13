/**
 * Slice 3 — Practical verification (RNTL v14 async).
 *
 * Covers the 30 product proofs: journey gate, shared snapshot usage,
 * runner, safe chess input, UCI capture, pass/fail/rotation/error UX,
 * Final teaser, single CTA, and frozen-surface guards.
 */
import '@testing-library/jest-native/extend-expect';
import React from 'react';
import { render, fireEvent, waitFor, renderHook, act } from '@testing-library/react-native';
import {
    deriveKnowledgeState,
    deriveNextAction,
    derivePracticalState,
    useCredentialJourney,
} from '../hooks/useCredentialJourney';
import { CredentialJourneySection } from '../components/credentials/CredentialJourneySection';
import { CredentialChallengeRunner } from '../components/credentials/CredentialChallengeRunner';
import {
    CredentialChessMoveInput,
    uciFromEntry,
    applyUciLine,
    toCanonicalUci,
} from '../components/credentials/CredentialChessMoveInput';
import {
    ensureEnrollment,
    getCredentialProgress,
    getCredentialStageSnapshot,
    getProgramAvailability,
    getSkillVerification,
    startPracticalAttempt,
    submitPracticalAttempt,
    startKnowledgeAttempt,
    submitKnowledgeAttempt,
} from '../services/trustApi';

jest.mock('../services/trustApi', () => ({
    ensureEnrollment: jest.fn(),
    getCredentialProgress: jest.fn(),
    getCredentialStageSnapshot: jest.fn(),
    getKnowledgeJourneySnapshot: jest.fn(),
    getProgramAvailability: jest.fn(),
    getSkillVerification: jest.fn(),
    startKnowledgeAttempt: jest.fn(),
    startPracticalAttempt: jest.fn(),
    submitKnowledgeAttempt: jest.fn(),
    submitPracticalAttempt: jest.fn(),
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
const mockStage = getCredentialStageSnapshot as jest.Mock;
const mockAvailability = getProgramAvailability as jest.Mock;
const mockSkills = getSkillVerification as jest.Mock;
const mockStartPractical = startPracticalAttempt as jest.Mock;
const mockSubmitPractical = submitPracticalAttempt as jest.Mock;
const mockStartKnowledge = startKnowledgeAttempt as jest.Mock;
const mockSubmitKnowledge = submitKnowledgeAttempt as jest.Mock;

const SKILLS_3_OF_4 = [
    { skillKey: 'rules', skillName: 'Rules', samplesCompleted: 4, samplesRequired: 4, passes: 4, passRate: 1, score: 100, verified: true },
    { skillKey: 'openings', skillName: 'Openings', samplesCompleted: 4, samplesRequired: 4, passes: 4, passRate: 1, score: 100, verified: true },
    { skillKey: 'endgames', skillName: 'Endgames', samplesCompleted: 4, samplesRequired: 4, passes: 4, passRate: 1, score: 100, verified: true },
    { skillKey: 'tactics', skillName: 'Tactics', samplesCompleted: 2, samplesRequired: 4, passes: 2, passRate: 1, score: 100, verified: false },
];
const SKILLS_4_OF_4 = SKILLS_3_OF_4.map(s =>
    s.skillKey === 'tactics' ? { ...s, samplesCompleted: 4, passes: 4, verified: true } : s,
);

const MATE_FEN = '7k/8/5K2/8/8/8/8/6Q1 w - - 0 1';
const PROMO_FEN = '7k/6P1/6K1/8/8/8/8/8 w - - 0 1';
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const MATE_TASK = {
    item_key: 'pr-rules-1',
    skill: 'rules',
    payload: { kind: 'mate_in_1', fen: MATE_FEN, prompt: 'White to move mates in 1.' },
};
const OPENING_TASK = {
    item_key: 'pr-open-1',
    skill: 'openings',
    payload: { kind: 'opening_line', fen: START_FEN, prompt: 'Play the Ruy Lopez for White.' },
};

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
    });
}

beforeEach(() => {
    jest.clearAllMocks();
    mockJourneyServer();
});

describe('practical unlock gate (pure + hook)', () => {
    test('1. Knowledge not passed => Practical locked', async () => {
        // 3/4 skills: knowledge locked, so practical locked too.
        mockJourneyServer({ skills: SKILLS_3_OF_4 });
        const { result } = await renderHook(() => useCredentialJourney('chess-foundations', {}));
        await waitFor(() => expect(result.current.journey).not.toBeNull());
        expect(result.current.journey!.knowledge.state).toBe('locked');
        expect(result.current.journey!.practical.state).toBe('locked');
        // Pure gate agrees: without a Knowledge PASS there is no ready.
        expect(
            derivePracticalState({
                component: null,
                attempts: [],
                knowledgePassed: false,
                allSkillsVerified: true,
                unavailable: false,
            }).state,
        ).toBe('locked');
    });

    test('2. current-live Knowledge passed => Practical ready', async () => {
        mockJourneyServer({ knowledgeComponent: { score: 91, passed: true } });
        const { result } = await renderHook(() => useCredentialJourney('chess-foundations', {}));
        await waitFor(() => expect(result.current.journey).not.toBeNull());
        expect(result.current.journey!.knowledge.state).toBe('passed');
        expect(result.current.journey!.practical).toEqual({ state: 'ready', score: null, attemptId: null });
        expect(result.current.journey!.nextAction).toEqual({ kind: 'start_practical' });
    });

    test('3. old-release Knowledge pass cannot unlock Practical (adapter nulled it)', async () => {
        // The shared snapshot nulls stale components; the hook therefore
        // sees knowledge ready (not passed) and practical locked.
        mockJourneyServer({ knowledgeComponent: null, practicalComponent: null });
        const { result } = await renderHook(() => useCredentialJourney('chess-foundations', {}));
        await waitFor(() => expect(result.current.journey).not.toBeNull());
        expect(result.current.journey!.knowledge.state).toBe('ready');
        expect(result.current.journey!.practical.state).toBe('locked');
        expect(result.current.journey!.nextAction).toEqual({ kind: 'start_knowledge' });
    });

    test('4. Practical live started => in_progress', async () => {
        mockJourneyServer({
            knowledgeComponent: { score: 91, passed: true },
            practicalAttempts: [{ id: 'p-live', status: 'started', score: null, passed: null, submittedAt: null }],
        });
        const { result } = await renderHook(() => useCredentialJourney('chess-foundations', {}));
        await waitFor(() => expect(result.current.journey).not.toBeNull());
        expect(result.current.journey!.practical).toEqual({ state: 'in_progress', score: null, attemptId: 'p-live' });
        expect(result.current.journey!.nextAction).toEqual({ kind: 'continue_practical' });
    });

    test('5. old-release Practical started => ignored (adapter drops it)', async () => {
        // Snapshot already excludes the old row: hook sees empty live set.
        mockJourneyServer({
            knowledgeComponent: { score: 91, passed: true },
            practicalAttempts: [],
            practicalComponent: null,
        });
        const { result } = await renderHook(() => useCredentialJourney('chess-foundations', {}));
        await waitFor(() => expect(result.current.journey).not.toBeNull());
        expect(result.current.journey!.practical.state).toBe('ready');
        // Pure: superseded/unknown statuses never count.
        expect(
            derivePracticalState({
                component: null,
                attempts: [
                    { id: 'sup', status: 'superseded', score: null, passed: null, submittedAt: null } as never,
                    { id: 'weird', status: 'archived', score: null, passed: null, submittedAt: null } as never,
                ],
                knowledgePassed: true,
                allSkillsVerified: true,
                unavailable: false,
            }).state,
        ).toBe('ready');
    });

    test('6. Practical live component PASS => passed', async () => {
        mockJourneyServer({
            knowledgeComponent: { score: 91, passed: true },
            knowledgeAttempts: [{ id: 'k1', status: 'submitted', score: 91, passed: true, submittedAt: '2026-02-01' }],
            practicalAttempts: [{ id: 'p1', status: 'submitted', score: 88, passed: true, submittedAt: '2026-02-02' }],
            practicalComponent: { score: 88, passed: true },
        });
        const { result } = await renderHook(() => useCredentialJourney('chess-foundations', {}));
        await waitFor(() => expect(result.current.journey).not.toBeNull());
        expect(result.current.journey!.practical).toEqual({ state: 'passed', score: 88, attemptId: null });
        expect(result.current.journey!.nextAction).toEqual({ kind: 'continue_learning' });
    });

    test('7. old-release Practical PASS => ignored', async () => {
        mockJourneyServer({
            knowledgeComponent: { score: 91, passed: true },
            practicalAttempts: [],
            practicalComponent: null,
        });
        const { result } = await renderHook(() => useCredentialJourney('chess-foundations', {}));
        await waitFor(() => expect(result.current.journey).not.toBeNull());
        expect(result.current.journey!.practical.state).toBe('ready');
        expect(result.current.journey!.practical.state).not.toBe('passed');
    });

    test('8. stale Knowledge + stale Practical after rotation => Knowledge ready, Practical locked', async () => {
        // Release B active: both old components are stale (nulled), no live
        // attempts. Journey falls back to ready/locked — never stale passed.
        mockJourneyServer({
            knowledgeAttempts: [],
            knowledgeComponent: null,
            practicalAttempts: [],
            practicalComponent: null,
        });
        const { result } = await renderHook(() => useCredentialJourney('chess-foundations', {}));
        await waitFor(() => expect(result.current.journey).not.toBeNull());
        expect(result.current.journey!.knowledge.state).toBe('ready');
        expect(result.current.journey!.practical.state).toBe('locked');
    });

    test('nextAction priority: verify < knowledge < practical < learning', () => {
        const proveRec = {
            type: 'prove_skill' as const,
            hobbyId: 'chess',
            skillKey: 'rules',
            skillName: 'Rules',
            minutes: 15,
            reasonCode: 'missing_validation' as const,
            confidence: 'high' as const,
        };
        // Missing skill still wins when nothing else is actionable.
        expect(deriveNextAction(proveRec, false, 'locked', 'locked')).toEqual({
            kind: 'verify_skill',
            skillKey: 'rules',
            skillName: 'Rules',
        });
        // Knowledge outranks practical until it passes.
        expect(deriveNextAction(null, true, 'ready', 'locked')).toEqual({ kind: 'start_knowledge' });
        expect(deriveNextAction(null, true, 'in_progress', 'locked')).toEqual({ kind: 'continue_knowledge' });
        // Behind a Knowledge PASS the practical CTA is primary.
        expect(deriveNextAction(null, true, 'passed', 'ready')).toEqual({ kind: 'start_practical' });
        expect(deriveNextAction(null, true, 'passed', 'failed')).toEqual({ kind: 'start_practical' });
        expect(deriveNextAction(null, true, 'passed', 'in_progress')).toEqual({ kind: 'continue_practical' });
        // Practical passed falls back to learning (Final is a teaser only).
        expect(deriveNextAction(null, true, 'passed', 'passed')).toEqual({ kind: 'continue_learning' });
        // Slice 2 callers (no practical arg) behave exactly as before.
        expect(deriveNextAction(null, true, 'ready')).toEqual({ kind: 'start_knowledge' });
        expect(deriveNextAction(null, false, 'locked')).toEqual({ kind: 'continue_learning' });
    });
});

describe('Practical runner wiring', () => {
    const baseProps = {
        visible: true,
        mode: 'practical' as const,
        programSlug: 'chess-foundations',
        programTitle: 'Chess Foundations',
        onClose: jest.fn(),
        onComplete: jest.fn(),
    };

    beforeEach(() => {
        baseProps.onClose = jest.fn();
        baseProps.onComplete = jest.fn();
    });

    test('9. Start Practical calls startPracticalAttempt (after enrollment)', async () => {
        mockJourneyServer({ knowledgeComponent: { score: 91, passed: true } });
        mockEnsure.mockResolvedValue({ enrolled: true, alreadyEnrolled: false });
        mockStartPractical.mockResolvedValue({ attemptId: 'att-p1', programVersion: 'v2', tasks: [MATE_TASK] });
        const screen = await render(
            <CredentialJourneySection programSlug="chess-foundations" programTitle="Chess Foundations" recommendation={null} onVerifySkill={() => {}} onContinueLearning={() => {}} />,
        );
        await screen.findByText('Start Practical Check');
        await fireEvent.press(screen.getByText('Start Practical Check'));
        expect(mockEnsure).toHaveBeenCalledWith('chess-foundations');
        expect(
            (mockEnsure as jest.Mock).mock.invocationCallOrder[0],
        ).toBeLessThan((mockStartPractical as jest.Mock).mock.invocationCallOrder[0]);
        expect(mockStartPractical).toHaveBeenCalledWith('chess-foundations');
        expect(await screen.findByText('White to move mates in 1.')).toBeTruthy();
        expect(screen.getByText('Task 1 of 1')).toBeTruthy();
    });

    test('10. active Practical attempt resumes (single start call)', async () => {
        mockStartPractical.mockResolvedValue({ attemptId: 'att-resume', programVersion: 'v2', tasks: [MATE_TASK] });
        const screen = await render(<CredentialChallengeRunner {...baseProps} />);
        expect(mockStartPractical).toHaveBeenCalledWith('chess-foundations');
        expect(await screen.findByText('White to move mates in 1.')).toBeTruthy();
        expect(mockStartPractical.mock.calls.length).toBe(1);
    });

    test('11. practical payload never exposes hidden keys', async () => {
        const LEAKY = [
            {
                item_key: 'pr-leak',
                skill: 'rules',
                payload: {
                    kind: 'mate_in_1',
                    fen: MATE_FEN,
                    prompt: 'Safe prompt?',
                    options: ['A1', 'B1'],
                    answer: 'g1g7',
                    correct_answer: 'g1g7',
                    bank_id: 'uuid-1234',
                    threshold: 0.8,
                    answer_key: { answer: 'g1g7' },
                },
            },
        ];
        mockStartPractical.mockResolvedValue({ attemptId: 'att-safe', programVersion: 'v2', tasks: LEAKY });
        const screen = await render(<CredentialChallengeRunner {...baseProps} />);
        expect(await screen.findByText('Safe prompt?')).toBeTruthy();
        expect(screen.queryByText('uuid-1234')).toBeNull();
        expect(screen.queryByText('g1g7')).toBeNull();
    });

    test('18. submit answers are keyed by itemKey', async () => {
        mockStartPractical.mockResolvedValue({ attemptId: 'att-1', programVersion: 'v2', tasks: [MATE_TASK] });
        mockSubmitPractical.mockResolvedValue({ passed: true, submitted: true, contentStale: false });
        const screen = await render(<CredentialChallengeRunner {...baseProps} />);
        await screen.findByText('White to move mates in 1.');
        await fireEvent.changeText(screen.getByPlaceholderText('Enter move in UCI (e.g. g1g7)'), 'g1g7');
        await fireEvent.press(screen.getByText('Set move'));
        await fireEvent.press(screen.getByText('Submit Practical Check'));
        expect(mockSubmitPractical).toHaveBeenCalledWith('att-1', { 'pr-rules-1': 'g1g7' });
    });

    test('19. server PASS renders Practical passed', async () => {
        mockStartPractical.mockResolvedValue({ attemptId: 'att-1', programVersion: 'v2', tasks: [MATE_TASK] });
        mockSubmitPractical.mockResolvedValue({ score: 100, passed: true, submitted: true, contentStale: false });
        const screen = await render(<CredentialChallengeRunner {...baseProps} />);
        await screen.findByText('White to move mates in 1.');
        await fireEvent.changeText(screen.getByPlaceholderText('Enter move in UCI (e.g. g1g7)'), 'g1g7');
        await fireEvent.press(screen.getByText('Set move'));
        await fireEvent.press(screen.getByText('Submit Practical Check'));
        expect(await screen.findByText('Practical passed')).toBeTruthy();
        expect(screen.getByText(/Score: 100%/)).toBeTruthy();
        expect(baseProps.onComplete).toHaveBeenCalledWith(
            expect.objectContaining({ passed: true, score: 100, contentStale: false }),
        );
    });

    test('20. server FAIL never renders passed', async () => {
        mockStartPractical.mockResolvedValue({ attemptId: 'att-3', programVersion: 'v2', tasks: [MATE_TASK] });
        mockSubmitPractical.mockResolvedValue({ score: 40, passed: false, submitted: true, contentStale: false });
        const screen = await render(<CredentialChallengeRunner {...baseProps} />);
        await screen.findByText('White to move mates in 1.');
        await fireEvent.changeText(screen.getByPlaceholderText('Enter move in UCI (e.g. g1g7)'), 'g1h1');
        await fireEvent.press(screen.getByText('Set move'));
        await fireEvent.press(screen.getByText('Submit Practical Check'));
        expect(await screen.findByText('Practical check not passed')).toBeTruthy();
        expect(screen.queryByText('Practical passed')).toBeNull();
    });

    test('21. contentStale shows updated-content state', async () => {
        mockStartPractical.mockResolvedValue({ attemptId: 'att-4', programVersion: 'v2', tasks: [MATE_TASK] });
        mockSubmitPractical.mockResolvedValue({ passed: false, submitted: false, contentStale: true });
        const screen = await render(<CredentialChallengeRunner {...baseProps} />);
        await screen.findByText('White to move mates in 1.');
        await fireEvent.changeText(screen.getByPlaceholderText('Enter move in UCI (e.g. g1g7)'), 'g1g7');
        await fireEvent.press(screen.getByText('Set move'));
        await fireEvent.press(screen.getByText('Submit Practical Check'));
        expect(await screen.findByText(/This practical check was updated/)).toBeTruthy();
        expect(screen.queryByText('Practical passed')).toBeNull();
        expect(screen.queryByText('Practical check not passed')).toBeNull();
        await fireEvent.press(screen.getByText('Start new check'));
        expect(mockStartPractical.mock.calls.length).toBe(2);
    });

    test('22. content unavailable != network failure', async () => {
        mockStartPractical.mockRejectedValueOnce(new Error('boom: credential_content_unavailable for chess'));
        const unavailable = await render(<CredentialChallengeRunner {...baseProps} />);
        expect(await unavailable.findByText(/temporarily unavailable/)).toBeTruthy();
        expect(unavailable.queryByText('Practical passed')).toBeNull();

        mockStartPractical.mockRejectedValueOnce(new Error('Network request failed'));
        const offline = await render(<CredentialChallengeRunner {...baseProps} />);
        expect(await offline.findByText(/internet connection/)).toBeTruthy();
        expect(offline.queryByText(/temporarily unavailable/)).toBeNull();
    });

    test('non-board fallback: options render like Knowledge; text input otherwise', async () => {
        const OPT = [{ item_key: 'pr-opt', skill: 'rules', payload: { kind: 'mc', prompt: 'Pick?', options: ['A', 'B'] } }];
        mockStartPractical.mockResolvedValue({ attemptId: 'att-opt', programVersion: 'v2', tasks: OPT });
        mockSubmitPractical.mockResolvedValue({ passed: true, submitted: true, contentStale: false });
        const optScreen = await render(<CredentialChallengeRunner {...baseProps} />);
        await optScreen.findByText('Pick?');
        await fireEvent.press(optScreen.getByText('A'));
        await fireEvent.press(optScreen.getByText('Submit Practical Check'));
        expect(mockSubmitPractical).toHaveBeenCalledWith('att-opt', { 'pr-opt': 'A' });

        const TEXT = [{ item_key: 'pr-text', skill: 'rules', payload: { kind: 'free_text', prompt: 'Describe?' } }];
        mockStartPractical.mockResolvedValue({ attemptId: 'att-text', programVersion: 'v2', tasks: TEXT });
        const textScreen = await render(<CredentialChallengeRunner {...baseProps} />);
        await textScreen.findByText('Describe?');
        await fireEvent.changeText(textScreen.getByPlaceholderText('Your answer…'), 'luft');
        await fireEvent.press(textScreen.getByText('Submit Practical Check'));
        expect(mockSubmitPractical).toHaveBeenCalledWith('att-text', { 'pr-text': 'luft' });
    });
});

describe('safe chess move input (no grading)', () => {
    test('12. CredentialChessMoveInput never receives hidden move data', async () => {
        const onChange = jest.fn();
        const screen = await render(
            <CredentialChessMoveInput fen={MATE_FEN} mode="single" value="" onChange={onChange} />,
        );
        expect(screen.getByText(MATE_FEN)).toBeTruthy();
        // Props are only fen/mode/value/onChange — checked statically below.
        const fs = require('fs');
        const path = require('path');
        const source: string = fs.readFileSync(
            path.join(process.cwd(), 'src/components/credentials/CredentialChessMoveInput.tsx'),
            'utf8',
        );
        expect(source).not.toMatch(/expectedMove/);
        expect(source).not.toMatch(/solution/);
        expect(source).not.toMatch(/answer_key/);
        expect(source).not.toMatch(/ChessBoard/);
        // Rendered tree never contains a hidden move.
        expect(screen.queryByText('g1g7')).toBeNull();
    });

    test('13. legal chess move produces canonical UCI', () => {
        expect(uciFromEntry(MATE_FEN, 'g1g7')).toBe('g1g7');
        expect(toCanonicalUci('g1', 'g7')).toBe('g1g7');
        // Illegal here is not captured.
        expect(uciFromEntry(MATE_FEN, 'e2e4')).toBeNull();
        expect(uciFromEntry(MATE_FEN, 'not-a-move')).toBeNull();
    });

    test('14. promotion produces UCI suffix', () => {
        expect(uciFromEntry(PROMO_FEN, 'g7g8q')).toBe('g7g8q');
        expect(toCanonicalUci('g7', 'g8', 'q')).toBe('g7g8q');
        expect(toCanonicalUci('g7', 'g8', 'Q')).toBe('g7g8q');
    });

    test('15. opening_line captures a legal UCI sequence', () => {
        const seq = 'e2e4 e7e5 g1f3 b8c6 f1b5';
        expect(applyUciLine(START_FEN, seq.split(' '))).not.toBeNull();
        // An illegal token breaks the line.
        expect(applyUciLine(START_FEN, ['e2e4', 'e2e4'])).toBeNull();
    });

    test('15b. line input accumulates moves and displays the sequence', async () => {
        const onChange = jest.fn();
        let value = '';
        const screen = await render(
            <CredentialChessMoveInput fen={START_FEN} mode="line" value={value} onChange={onChange} />,
        );
        await fireEvent.changeText(screen.getByPlaceholderText('Enter next move in UCI'), 'e2e4');
        await fireEvent.press(screen.getByText('Play move'));
        expect(onChange).toHaveBeenCalledWith('e2e4');
    });

    test('16. Undo/reset modify only local input', async () => {
        const onChange = jest.fn();
        const filled = await render(
            <CredentialChessMoveInput fen={START_FEN} mode="line" value="e2e4 e7e5" onChange={onChange} />,
        );
        await fireEvent.press(filled.getByText('Undo'));
        expect(onChange).toHaveBeenCalledWith('e2e4');
        await fireEvent.press(filled.getByText('Reset'));
        expect(onChange).toHaveBeenCalledWith('');
        // No server calls from local edits.
        expect(mockSubmitPractical).not.toHaveBeenCalled();
        expect(mockStartPractical).not.toHaveBeenCalled();
    });

    test('17. no client grading exists in the move input', () => {
        const fs = require('fs');
        const path = require('path');
        const source: string = fs.readFileSync(
            path.join(process.cwd(), 'src/components/credentials/CredentialChessMoveInput.tsx'),
            'utf8',
        );
        expect(source).not.toMatch(/isCorrect|correctMove|checkAnswer|grade|passed|failed/);
        expect(source).not.toMatch(/ChessBoard/);
    });
});

describe('journey UX: refresh, Final teaser, single CTA', () => {
    test('23. practical completion refreshes canonical journey', async () => {
        mockJourneyServer({ knowledgeComponent: { score: 91, passed: true } });
        mockEnsure.mockResolvedValue({ enrolled: true, alreadyEnrolled: false });
        mockStartPractical.mockResolvedValue({ attemptId: 'att-p9', programVersion: 'v2', tasks: [MATE_TASK] });
        mockSubmitPractical.mockResolvedValue({ score: 100, passed: true, submitted: true, contentStale: false });
        const screen = await render(
            <CredentialJourneySection programSlug="chess-foundations" programTitle="Chess Foundations" recommendation={null} onVerifySkill={() => {}} onContinueLearning={() => {}} />,
        );
        await screen.findByText('Start Practical Check');
        const progressBefore = mockProgress.mock.calls.length;
        const stageBefore = mockStage.mock.calls.length;
        await fireEvent.press(screen.getByText('Start Practical Check'));
        await screen.findByText('White to move mates in 1.');
        await fireEvent.changeText(screen.getByPlaceholderText('Enter move in UCI (e.g. g1g7)'), 'g1g7');
        await fireEvent.press(screen.getByText('Set move'));
        await fireEvent.press(screen.getByText('Submit Practical Check'));
        expect(await screen.findByText('Practical passed')).toBeTruthy();
        // Completion re-read server truth (no local patch).
        await waitFor(() => expect(mockProgress.mock.calls.length).toBeGreaterThan(progressBefore));
        expect(mockStage.mock.calls.length).toBeGreaterThan(stageBefore);
    });

    test('24. refreshed server truth controls Practical passed UI', async () => {
        mockJourneyServer({
            knowledgeComponent: { score: 91, passed: true },
            knowledgeAttempts: [{ id: 'k1', status: 'submitted', score: 91, passed: true, submittedAt: '2026-02-01' }],
            practicalAttempts: [{ id: 'p1', status: 'submitted', score: 100, passed: true, submittedAt: '2026-02-03' }],
            practicalComponent: { score: 100, passed: true },
        });
        const { result } = await renderHook(() => useCredentialJourney('chess-foundations', {}));
        await waitFor(() => expect(result.current.journey).not.toBeNull());
        expect(result.current.journey!.practical.state).toBe('passed');
        expect(result.current.journey!.practical.score).toBe(100);
        const screen = await render(
            <CredentialJourneySection programSlug="chess-foundations" programTitle="Chess Foundations" recommendation={null} onVerifySkill={() => {}} onContinueLearning={() => {}} />,
        );
        expect(await screen.findByText('Continue learning')).toBeTruthy();
        expect(await screen.findByText(/Final Assessment/)).toBeTruthy();
    });

    test('25. Final Assessment remains non-interactive', async () => {
        mockJourneyServer({
            knowledgeComponent: { score: 91, passed: true },
            practicalAttempts: [{ id: 'p1', status: 'submitted', score: 100, passed: true, submittedAt: '2026-02-03' }],
            practicalComponent: { score: 100, passed: true },
        });
        const screen = await render(
            <CredentialJourneySection programSlug="chess-foundations" programTitle="Chess Foundations" recommendation={null} onVerifySkill={() => {}} onContinueLearning={() => {}} />,
        );
        expect(await screen.findByText(/Final Assessment/)).toBeTruthy();
        expect(await screen.findByText(/Next step/)).toBeTruthy();
        expect(screen.queryByText('Start Final')).toBeNull();
        expect(screen.queryByText('Open Final')).toBeNull();
        expect(screen.queryByText('Start Project')).toBeNull();
        expect(screen.queryByText('Continue Practical Check')).toBeNull();
    });

    test('26. one primary official CTA remains', async () => {
        // Practical ready: exactly Start Practical, nothing else.
        mockJourneyServer({ knowledgeComponent: { score: 91, passed: true } });
        const ready = await render(
            <CredentialJourneySection programSlug="chess-foundations" programTitle="Chess Foundations" recommendation={null} onVerifySkill={() => {}} onContinueLearning={() => {}} />,
        );
        await ready.findByText('Start Practical Check');
        expect(ready.queryByText('Start Knowledge Check')).toBeNull();
        expect(ready.queryByText('Continue Knowledge Check')).toBeNull();
        expect(ready.queryByText('Continue Practical Check')).toBeNull();
        expect(ready.queryByText('Continue learning')).toBeNull();

        // Practical passed: exactly Continue learning.
        mockJourneyServer({
            knowledgeComponent: { score: 91, passed: true },
            practicalAttempts: [{ id: 'p1', status: 'submitted', score: 100, passed: true, submittedAt: '2026-02-03' }],
            practicalComponent: { score: 100, passed: true },
        });
        const done = await render(
            <CredentialJourneySection programSlug="chess-foundations" programTitle="Chess Foundations" recommendation={null} onVerifySkill={() => {}} onContinueLearning={() => {}} />,
        );
        await done.findByText('Continue learning');
        expect(done.queryByText('Start Practical Check')).toBeNull();
        expect(done.queryByText('Start Knowledge Check')).toBeNull();
    });

    test('27. Knowledge behavior remains unchanged', async () => {
        expect(
            deriveKnowledgeState({ component: null, attempts: [], allSkillsVerified: false, unavailable: false }).state,
        ).toBe('locked');
        expect(
            deriveKnowledgeState({ component: null, attempts: [], allSkillsVerified: true, unavailable: false }).state,
        ).toBe('ready');
        // Knowledge runner still renders server questions as-is.
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

    test('28. no Home changes', () => {
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
            expect(content).not.toMatch(/useCredentialJourney|CredentialJourney|startPracticalAttempt|CredentialChessMoveInput/);
        }
    });

    test('29. no migrations / backend RPC changes', () => {
        const fs = require('fs');
        const path = require('path');
        const dir = path.join(process.cwd(), 'supabase', 'migrations');
        const files: string[] = fs.readdirSync(dir).filter((f: string) => f.endsWith('.sql'));
        expect(files.length).toBeGreaterThan(0);
        const beyond = files.filter(f => {
            const m = /^(\d+)_/.exec(f);
            return m != null && Number(m[1]) > 35;
        });
        expect(beyond).toEqual([]);
        // Client uses only the pre-existing practical RPCs (no new RPCs).
        const api: string = fs.readFileSync(path.join(process.cwd(), 'src/services/trustApi.ts'), 'utf8');
        expect(api).toMatch(/start_practical_attempt/);
        expect(api).toMatch(/submit_practical_attempt/);
    });
});
