/**
 * Phase 3C.1 runtime integrity — resolution, capabilities, intent routing,
 * adaptive retries, closed loops. Pure domain + static architecture guards.
 */
import { getProgram } from '../domain/credentials/catalog';
import type { MasteryOutcome } from '../domain/sessions/outcomePolicy';
import type { LearningEvent } from '../domain/sessions/learningEvents';
import { buildAttemptEvent } from '../domain/sessions/learningEvents';
import { projectSkillState } from '../domain/sessions/skillState';
import { getNextBestLearningAction } from '../domain/sessions/nextBestAction';
import {
    authorizeStepIndex,
    buildLearningCards,
    canAdvanceFrom,
    flowTransition,
    initialFlowState,
    proofBarrierIndex,
} from '../domain/sessions/learningCards';
import { buildSessionBlueprint, normalizeKind, parseSessionParams } from '../domain/sessions/sessionBlueprint';
import { normalizeSessionIntent } from '../domain/sessions/sessionIntent';
import {
    buildSessionRoute,
    routeForRecommendation,
    sessionRouteForTask,
} from '../domain/sessions/sessionRouting';
import { sessionCapabilities } from '../domain/sessions/sessionCapabilities';
import { reasonCopy } from '../utils/learningCopy';

jest.mock('../services/ai', () => ({
    aiService: { sendMessage: jest.fn(), gradeAnswer: jest.fn() },
}));

const program = getProgram('python-foundations')!;

let clock = 0;
const at = () => `2026-09-${String(10 + Math.floor(clock / 10)).padStart(2, '0')}T10:${String(clock++ % 60).padStart(2, '0')}:00.000Z`;

const ev = (s: {
    session: string; card: string; attempt?: number; outcome: MasteryOutcome;
    phase?: 'recall' | 'apply' | 'validate'; day: number;
    kind?: 'structured' | 'certificate_review' | 'discovery';
}): LearningEvent =>
    buildAttemptEvent({
        sessionId: s.session,
        userId: 'u1',
        hobbyId: 'python',
        lessonId: `python_d${s.day}`,
        lessonDay: s.day,
        cardId: s.card,
        attemptNo: s.attempt ?? 1,
        phase: s.phase ?? 'apply',
        sessionKind: s.kind ?? 'structured',
        outcome: s.outcome,
        cardType: (s.phase ?? 'apply') === 'recall' ? 'recall' : s.phase === 'validate' ? 'challenge' : 'apply',
        occurredAt: at(),
    });

const lesson: any = {
    id: 'python_d15',
    hobby: 'python',
    day: 15,
    learn: { title: 'Functions', body: 'Functions package logic. Example: def f(): return 1.', keywords: ['function'] },
    do: { type: 'free_text', prompt: 'Explain functions.' },
};

describe('resolution — historical FAIL vs later PASS by strength', () => {
    it('medium FAIL survives one weak PASS, clears on medium PASS', () => {
        const failing = [
            ev({ session: 's1', card: 'a', outcome: 'fail', phase: 'apply', day: 16 }),
            ev({ session: 's2', card: 'a', outcome: 'pass', phase: 'apply', day: 16, kind: 'certificate_review' }),
        ];
        const stillWeak = projectSkillState({ program, events: failing }).skills
            .find(s => s.skillKey === 'functions')!;
        expect(stillWeak.days.find(d => d.day === 16)?.unresolved.applicationFails).toBe(1);
        const resolved = projectSkillState({
            program,
            events: [...failing, ev({ session: 's3', card: 'a', outcome: 'pass', phase: 'apply', day: 16 })],
        }).skills.find(s => s.skillKey === 'functions')!;
        expect(resolved.days.find(d => d.day === 16)?.unresolved.applicationFails).toBe(0);
    });

    it('20-sessions-ago failure is history, not a live blocker', () => {
        const old: LearningEvent[] = [ev({ session: 's-old', card: 'c', outcome: 'fail', phase: 'validate', day: 9 })];
        const fresh: LearningEvent[] = Array.from({ length: 20 }, (_, i) =>
            ev({ session: `s${i}`, card: 'r', outcome: 'pass', phase: 'recall', day: 10 + (i % 4) }),
        );
        const rec = getNextBestLearningAction({
            hobbyId: 'python',
            program,
            skillStates: projectSkillState({ program, events: [...old, ...fresh] }).skills,
            currentCurriculumDay: 14,
            availableMinutes: 15,
            dailyTasks: [],
        });
        expect(rec.reasonCode).not.toBe('recent_validation_failure');
        if (rec.curriculumDay !== undefined) {
            expect(rec.curriculumDay).not.toBe(9);
        }
    });
});

describe('review loop terminates — one review clears pending need', () => {
    it('recovered struggle reviews once, then moves on', () => {
        const history = [
            ev({ session: 's1', card: 'r', attempt: 1, outcome: 'fail', phase: 'recall', day: 10 }),
            ev({ session: 's1', card: 'r', attempt: 2, outcome: 'pass', phase: 'recall', day: 10 }),
        ];
        const base = {
            hobbyId: 'python', program, currentCurriculumDay: 12, availableMinutes: 10, dailyTasks: [],
        };
        const first = getNextBestLearningAction({
            ...base, skillStates: projectSkillState({ program, events: history }).skills,
        });
        expect(first.type).toBe('review_skill');
        // Successful independent review session afterwards...
        const reviewed = [
            ...history,
            ev({ session: 's2', card: 'r', outcome: 'pass', phase: 'recall', day: 10 }),
        ];
        const states = projectSkillState({ program, events: reviewed }).skills;
        expect(states.find(s => s.skillKey === 'logic')!.needsLightReview).toBe(false);
        expect(states.find(s => s.skillKey === 'logic')!.recoveredStruggles).toBe(1);
        const second = getNextBestLearningAction({ ...base, skillStates: states });
        expect(second.type).not.toBe('review_skill');
    });
});

describe('intent canonicalization', () => {
    it('forces safe combinations for malformed deep links', () => {
        expect(normalizeSessionIntent({ kind: 'structured', scope: 'curriculum', strategy: 'prove_skill' }))
            .toEqual({ kind: 'structured', scope: 'targeted', strategy: 'prove_skill' });
        expect(normalizeSessionIntent({ kind: 'certificate_review', scope: 'curriculum', strategy: 'prove_skill' }))
            .toEqual({ kind: 'structured', scope: 'targeted', strategy: 'prove_skill' });
        expect(normalizeSessionIntent({ kind: 'certificate_review', scope: 'curriculum', strategy: 'continue_curriculum' }))
            .toEqual({ kind: 'certificate_review', scope: 'none', strategy: 'review_skill' });
        expect(normalizeSessionIntent({ kind: 'discovery', scope: 'curriculum', strategy: 'prove_skill' }))
            .toEqual({ kind: 'discovery', scope: 'none', strategy: 'continue_curriculum' });
        expect(normalizeSessionIntent({ kind: 'structured', scope: 'curriculum', strategy: 'repair_recall' }))
            .toEqual({ kind: 'structured', scope: 'curriculum', strategy: 'repair_recall' });
    });

    it('parse applies canonicalization end to end', () => {
        const parsed = parseSessionParams({ minutes: '30', kind: 'certificate_review', scope: 'curriculum', origin: 'quick_session' });
        expect(parsed.scope).toBe('none');
        expect(parsed.context.kind).toBe('certificate_review');
        const malformed = parseSessionParams({ minutes: 'x', kind: 'godmode', origin: 'hacker' });
        expect(malformed.context.kind).toBe('structured');
        expect(malformed.scope).toBe('curriculum');
        expect(malformed.strategy).toBe('continue_curriculum');
    });
});

describe('wiring — container defers to authorizeStepIndex', () => {
    const cardsFor = () => {
        const bp = buildSessionBlueprint({ minutes: 15, lessonTitle: 'F' });
        return buildLearningCards({ blueprint: bp, lesson, kind: 'structured', minutes: 15 });
    };

    it('drag toward required recall never authorizes; PASS does (container event flow)', () => {
        const cards = cardsFor();
        let flow = initialFlowState(cards);
        const recallIdx = cards.findIndex(c => c.type === 'recall');
        expect(recallIdx).toBeGreaterThan(0);
        // Passive cards before it authorize by viewing.
        for (let i = 0; i < recallIdx; i++) {
            const at = authorizeStepIndex(flow, i);
            expect(at).toBe(i);
            flow = flowTransition(flow, { type: 'VIEW', id: cards[i].id }, 1);
        }
        // Entering the unanswered required card is allowed (to answer it),
        // but swiping PAST it is blocked: the gate holds at the frontier.
        expect(authorizeStepIndex(flow, recallIdx)).toBe(recallIdx);
        expect(authorizeStepIndex(flow, recallIdx + 1)).toBe(flow.index);
        flow = flowTransition(flow, { type: 'GOTO', index: recallIdx + 1 }, 1);
        expect(flow.index).toBeLessThanOrEqual(flow.maxUnlocked);
        // Answer PASS: next becomes reachable through the same gate.
        flow = flowTransition(flow, { type: 'ANSWER', id: cards[recallIdx].id, outcome: 'pass' }, 1);
        expect(canAdvanceFrom(flow, cards[recallIdx].id)).toBe(true);
        expect(authorizeStepIndex(flow, recallIdx + 1)).toBe(recallIdx + 1);
    });

    it('partial with budget opens support + retry, not final completion', () => {
        const cards = cardsFor();
        let flow = initialFlowState(cards);
        const recall = cards.find(c => c.type === 'recall')!;
        flow = flowTransition(flow, { type: 'ANSWER', id: recall.id, outcome: 'partial', explanation: 'Half right.' }, 2);
        expect(flow.status[recall.id].completed).toBe(false);
        expect(flow.cards.some(c => c.type === 'feedback')).toBe(true);
        const retry = flowTransition(flow, { type: 'ANSWER', id: recall.id, outcome: 'pass' }, 2);
        expect(retry.status[recall.id]).toMatchObject({ completed: true, outcome: 'pass', attempts: 2 });
    });

    it('no budget leaves partial as truthful final', () => {
        const cards = cardsFor();
        let flow = initialFlowState(cards);
        const recall = cards.find(c => c.type === 'recall')!;
        flow = flowTransition(flow, { type: 'ANSWER', id: recall.id, outcome: 'partial', explanation: 'Half.' }, 0);
        expect(flow.status[recall.id]).toMatchObject({ completed: true, outcome: 'partial' });
    });
});

describe('closed loops — recommendation executes and resolves', () => {
    it('quick review -> curriculum continuation route shape', () => {
        const rec = getNextBestLearningAction({
            hobbyId: 'python',
            program,
            skillStates: projectSkillState({
                program,
                events: [
                    ev({ session: 's1', card: 'r', outcome: 'fail', phase: 'recall', day: 12 }),
                    ev({ session: 's2', card: 'r', outcome: 'fail', phase: 'recall', day: 12 }),
                ],
            }).skills,
            currentCurriculumDay: 14,
            availableMinutes: 5,
            dailyTasks: [{ id: 't-next', title: 'Next', type: 'practice', status: 'pending' }],
        });
        expect(rec.type).toBe('repair_recall');
        // After the bite, the DailyPlan continuation is a structured route.
        const cont = sessionRouteForTask({ id: 't-next', duration_minutes: 15 }, 'quick_session');
        expect(cont).toMatch(/kind=structured/);
        expect(cont).toMatch(/scope=curriculum/);
        expect(cont).toMatch(/taskId=t-next/);
    });

    it('generated lesson without tests can never promise proof', () => {
        const strong = [
            ev({ session: 's1', card: 'r', outcome: 'pass', phase: 'recall', day: 25 }),
            ev({ session: 's1', card: 'a', outcome: 'pass', phase: 'apply', day: 25 }),
            ev({ session: 's2', card: 'r', outcome: 'pass', phase: 'recall', day: 26 }),
            ev({ session: 's2', card: 'a', outcome: 'pass', phase: 'apply', day: 26 }),
        ];
        const toStaticDays = () => ({ known: true, hasTests: false, hasDoTask: true });
        const rec = getNextBestLearningAction({
            hobbyId: 'python',
            program,
            skillStates: projectSkillState({ program, events: strong }).skills,
            currentCurriculumDay: 26,
            availableMinutes: 30,
            dailyTasks: [],
            lessonCaps: toStaticDays,
        });
        expect(rec.type).not.toBe('prove_skill');
        // Runtime blueprint agrees: the emitted session has no validate phase.
        const runtime = sessionCapabilities({ minutes: 30, kind: 'structured', scope: 'targeted', hasTests: false, hasDoTask: true });
        expect(runtime.canValidate).toBe(false);
    });
});

describe('one builder means one builder (static)', () => {
    it('no screen hand-builds session URLs', () => {
        const fs = require('fs') as typeof import('fs');
        const path = require('path') as typeof import('path');
        const root = path.join(__dirname, '..', '..');
        const read = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf8');
        for (const rel of [
            'src/screens/tabs/HomeTab.tsx',
            'src/screens/tabs/WeeklyPlanTab.tsx',
            'src/screens/QuickSessionScreen.tsx',
            'src/screens/CredentialDetailScreen.tsx',
            'src/screens/SessionTimerScreen.tsx',
            'src/screens/tabs/AICoachTab.tsx',
        ]) {
            expect(`${rel}: ${read(rel)}`).not.toMatch(/\/session-timer\?/);
        }
    });

    it('normalizeKind still accepts legacy aliases', () => {
        expect(normalizeKind('final_assessment')).toBe('assessment');
        expect(normalizeKind('certificate_review')).toBe('certificate_review');
    });

    it('reason copy stays bilingual at the boundary', () => {
        expect(reasonCopy('missing_validation', { skillName: 'F', day: 17 })).toMatch(/Готов/);
        expect(reasonCopy('missing_validation', { skillName: 'F', day: 17 }, 'en')).toMatch(/Ready/);
    });

    it('prove route carries skill + reason for traceability', () => {
        const route = routeForRecommendation(
            {
                type: 'prove_skill',
                hobbyId: 'python',
                programSlug: 'python-foundations',
                skillKey: 'functions',
                skillName: 'Functions',
                curriculumDay: 17,
                minutes: 30,
                reasonCode: 'missing_validation',
                reasonData: { skillName: 'Functions', day: 17 },
                confidence: 'medium',
            },
            'quick_session',
        );
        expect(route).toMatch(/kind=structured/);
        expect(route).toMatch(/scope=targeted/);
        expect(route).toMatch(/skillDay=17/);
        expect(route).toMatch(/skill=functions/);
        expect(route).toMatch(/reason=missing_validation/);
        const parsed = parseSessionParams(
            Object.fromEntries(new URLSearchParams(route.split('?')[1]).entries()),
        );
        expect(parsed.context.kind).toBe('structured');
        expect(parsed.scope).toBe('targeted');
        expect(parsed.strategy).toBe('prove_skill');
        expect(parsed.skillDay).toBe(17);
        expect(parsed.skillKey).toBe('functions');
        expect(parsed.reasonCode).toBe('missing_validation');
    });
});

describe('closure — adaptive barrier, provenance, normalization', () => {
    const barrierLesson: any = {
        id: 'python_d15',
        hobby: 'python',
        day: 15,
        learn: { title: 'Functions', body: 'Functions package logic. Example: def f(): return 1.', keywords: ['function'] },
        do: { type: 'free_text', prompt: 'Explain functions.' },
    };

    const barrierCards = () => {
        const bp = buildSessionBlueprint({ minutes: 15, lessonTitle: 'Functions' });
        return buildLearningCards({ blueprint: bp, lesson: barrierLesson, kind: 'structured', minutes: 15 });
    };

    it('PARTIAL support cannot be bypassed; retry PASS resolves', () => {
        const cards = barrierCards();
        let flow = initialFlowState(cards);
        const recall = cards.find(c => c.type === 'recall')!;
        const feedbackIdx = cards.findIndex(c => c.id === recall.id) + 1;
        flow = flowTransition(flow, { type: 'ANSWER', id: recall.id, outcome: 'partial', explanation: 'Half right.' }, 2);
        const feedback = flow.cards.find(c => c.type === 'feedback');
        expect(feedback?.feedback?.blockedByCardId).toBe(recall.id);
        // Past the support is denied while the proof is open...
        expect(authorizeStepIndex(flow, feedbackIdx + 1)).toBe(flow.index);
        expect(proofBarrierIndex(flow)).toBe(feedbackIdx);
        // ...but the feedback itself and the proof retry stay reachable.
        expect(authorizeStepIndex(flow, feedbackIdx)).toBe(feedbackIdx);
        // Retry PASS lifts the barrier.
        const retry = flowTransition(flow, { type: 'ANSWER', id: recall.id, outcome: 'pass' }, 2);
        expect(proofBarrierIndex(retry)).toBe(-1);
        expect(authorizeStepIndex(retry, feedbackIdx + 1)).toBe(feedbackIdx + 1);
    });

    it('FAIL behaves the same: no escape, retry resolves', () => {
        const cards = barrierCards();
        let flow = initialFlowState(cards);
        const recall = cards.find(c => c.type === 'recall')!;
        flow = flowTransition(flow, { type: 'ANSWER', id: recall.id, outcome: 'fail', explanation: 'Wrong.' }, 2);
        const feedbackIdx = flow.cards.findIndex(c => c.type === 'feedback');
        expect(feedbackIdx).toBeGreaterThan(0);
        expect(authorizeStepIndex(flow, feedbackIdx + 1)).toBe(flow.index);
        const retry = flowTransition(flow, { type: 'ANSWER', id: recall.id, outcome: 'pass' }, 2);
        expect(proofBarrierIndex(retry)).toBe(-1);
    });

    it('partial with budget opens support, not final completion', () => {
        const cards = barrierCards();
        let flow = initialFlowState(cards);
        const recall = cards.find(c => c.type === 'recall')!;
        flow = flowTransition(flow, { type: 'ANSWER', id: recall.id, outcome: 'partial', explanation: 'Half.' }, 2);
        expect(flow.status[recall.id].completed).toBe(false);
        expect(flow.cards.some(c => c.type === 'feedback')).toBe(true);
        const exhausted = flowTransition(flow, { type: 'ANSWER', id: recall.id, outcome: 'partial', explanation: 'Half.' }, 0);
        expect(exhausted.status[recall.id]).toMatchObject({ completed: true, outcome: 'partial' });
    });

    it('provenance is factual: static strong, generated medium, omitted conservative', () => {
        const mk = (prov: any, day: number) =>
            buildAttemptEvent({
                sessionId: 's', userId: 'u1', hobbyId: 'chess', lessonId: `chess_d${day}`, lessonDay: day,
                cardId: 'c', attemptNo: 1, phase: 'validate', sessionKind: 'structured', outcome: 'pass',
                cardType: 'challenge', ...(prov === undefined ? {} : { provenance: prov }),
            });
        expect(mk('static_bank', 4).evidenceStrength).toBe('strong');
        expect(mk('static_bank', 4).provenance).toBe('static_bank');
        expect(mk('generated_unverified', 20).evidenceStrength).toBe('medium');
        expect(mk(undefined, 20).evidenceStrength).toBe('medium');
        expect(mk(undefined, 20).provenance).toBe('generated_unverified');
    });
});

describe('closure — generated lesson normalization is honest', () => {
    const { normalizeLessonContent } = require('../services/sessionLesson') as typeof import('../services/sessionLesson');

    it('malformed tests are excluded, lesson stays usable, no validation', () => {
        const lesson: any = {
            id: 'python_gen_d9',
            hobby: 'python',
            day: 9,
            learn: { title: 'Loops', body: 'Loop concepts explained here.', keywords: ['loop'] },
            do: { type: 'free_text', prompt: 'Explain loops.' },
            tests: [
                { type: 'multiple_choice', prompt: 'Pick one', options: ['a'], correctOptionIndex: 5 },
                { type: 'multiple_choice', prompt: '', options: ['a', 'b'], correctOptionIndex: 0 },
                { type: 'mystery_type', prompt: '???' },
                { type: 'free_text', prompt: 'Real question.', correctAnswer: 'Real answer.' },
            ],
        };
        const out = normalizeLessonContent(lesson, 'generated');
        expect(out.lesson).not.toBeNull();
        expect(out.lesson!.tests).toHaveLength(1);
        expect(out.lesson!.tests![0].prompt).toBe('Real question.');
        expect(out.capabilities.hasValidation).toBe(true);
        expect(out.capabilities.hasConcept).toBe(true);
        expect(out.capabilities.hasApplication).toBe(true);
        expect(out.validationProvenance).toBe('generated_unverified');
    });

    it('lesson without any valid tests advertises no validation', () => {
        const out = normalizeLessonContent(
            {
                id: 'x',
                hobby: 'python',
                day: 9,
                learn: { title: 'T', body: 'Body here.', keywords: [] },
                do: { type: 'free_text', prompt: 'Do it.' },
                tests: [{ type: 'multiple_choice', prompt: 'Bad', options: ['only'], correctOptionIndex: 9 }],
            } as any,
            'generated',
        );
        expect(out.lesson).not.toBeNull();
        expect(out.capabilities.hasValidation).toBe(false);
        expect(out.validationProvenance).toBe('none');
    });

    it('static lessons keep trusted static provenance', () => {
        const out = normalizeLessonContent(
            {
                id: 'chess_d4',
                hobby: 'chess',
                day: 4,
                learn: { title: 'T', body: 'Body here.', keywords: [] },
                do: { type: 'chess_puzzle', prompt: 'Solve.', puzzleFen: 'fen', puzzleMoves: ['e2e4'] },
                tests: [
                    { type: 'multiple_choice', prompt: 'Q?', options: ['a', 'b'], correctOptionIndex: 0 },
                ],
            } as any,
            'static_bank',
        );
        expect(out.validationProvenance).toBe('static_bank');
        expect(out.capabilities.hasValidation).toBe(true);
    });
});
