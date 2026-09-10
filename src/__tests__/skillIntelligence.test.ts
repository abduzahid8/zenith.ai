/**
 * Phase 3B intelligence — Skill State projection + Next Best Action (§29).
 * Pure, deterministic, no stores/UI. Legacy certificate math untouched.
 */
import { getProgram } from '../domain/credentials/catalog';
import type { MasteryOutcome } from '../domain/sessions/outcomePolicy';
import type { LearningEvent } from '../domain/sessions/learningEvents';
import { buildAttemptEvent } from '../domain/sessions/learningEvents';
import { projectSkillState } from '../domain/sessions/skillState';
import { getNextBestLearningAction } from '../domain/sessions/nextBestAction';
import { routeForRecommendation } from '../domain/sessions/sessionRouting';
import { buildProgressionDecision } from '../domain/sessions/progressionPolicy';
import { sessionCapabilities } from '../domain/sessions/sessionCapabilities';
import { buildSessionBlueprint } from '../domain/sessions/sessionBlueprint';
import { flowTransition, initialFlowState } from '../domain/sessions/learningCards';
import { buildLearningCards } from '../domain/sessions/learningCards';
import { reasonCopy } from '../utils/learningCopy';

jest.mock('../services/ai', () => ({
    aiService: { sendMessage: jest.fn(), gradeAnswer: jest.fn() },
}));

const program = getProgram('python-foundations')!;

let clock = 0;
const at = () => `2026-09-${String(10 + Math.floor(clock / 10)).padStart(2, '0')}T10:${String(clock++ % 60).padStart(2, '0')}:00.000Z`;

interface AttemptSpec {
    session: string;
    card: string;
    attempt?: number;
    outcome: MasteryOutcome;
    phase?: 'recall' | 'apply' | 'validate';
    day: number;
    kind?: 'structured' | 'certificate_review' | 'discovery';
}

const ev = (s: AttemptSpec): LearningEvent =>
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

const project = (events: LearningEvent[]) => projectSkillState({ program, events }).skills;
const logicOf = (events: LearningEvent[]) => project(events).find(s => s.skillKey === 'logic')!;
const functionsOf = (events: LearningEvent[]) => project(events).find(s => s.skillKey === 'functions')!;

const recommend = (events: LearningEvent[], over: any = {}) =>
    getNextBestLearningAction({
        hobbyId: 'python',
        program,
        skillStates: project(events),
        currentCurriculumDay: 8,
        availableMinutes: 15,
        dailyTasks: [],
        ...over,
    });

describe('1 — no events means UNSEEN, never failed', () => {
    it('all skills unseen with null mastery and no confidence', () => {
        const skills = project([]);
        expect(skills.length).toBeGreaterThan(0);
        for (const s of skills) {
            expect(s.stage).toBe('unseen');
            expect(s.masteryEstimate).toBeNull();
            expect(s.confidence).toBe(0);
            expect(s.confidenceLevel).toBe('none');
        }
    });
});

describe('2 — exposure alone cannot produce mastery', () => {
    it('concept exposure gives coverage but no estimate', () => {
        const skills = project([
            {
                schemaVersion: 1 as const,
                id: 's:concept_exposed:c:0',
                sessionId: 's',
                ownerId: 'u1',
                hobbyId: 'python',
                programSlug: 'python-foundations',
                programVersion: '1.0',
                curriculumDay: 9,
                sessionKind: 'structured' as const,
                source: 'structured_session' as const,
                eventType: 'concept_exposed' as const,
                evidenceStrength: 'none' as const,
                occurredAt: at(),
            },
        ]);
        const logic = skills.find(s => s.skillKey === 'logic')!;
        expect(logic.stage).toBe('learning');
        expect(logic.masteryEstimate).toBeNull();
        expect(logic.exposure.coverage).toBeGreaterThan(0);
    });
});

describe('3-4 — discovery weightless, bites formative', () => {
    it('discovery attempts never enter mastery or exposure', () => {
        const skills = project([
            ev({ session: 'd1', card: 'c', outcome: 'pass', phase: 'apply', day: 10, kind: 'discovery' }),
        ]);
        const logic = skills.find(s => s.skillKey === 'logic')!;
        expect(logic.stage).toBe('unseen');
        expect(logic.masteryEstimate).toBeNull();
    });

    it('review bite evidence is weak, never strong', () => {
        const skills = project([
            ev({ session: 'b1', card: 'c', outcome: 'pass', phase: 'apply', day: 10, kind: 'certificate_review' }),
        ]);
        const logic = skills.find(s => s.skillKey === 'logic')!;
        expect(logic.application.samples).toBe(1);
        expect(logic.application.score).toBe(100);
        // One weak sample: estimate exists, confidence stays low.
        expect(logic.confidenceLevel).toBe('low');
    });
});

describe('5-7 — retries collapse, struggle remembered, sessions matter', () => {
    it('FAIL->PASS retry is one mastery sample, not two', () => {
        const s = logicOf([
            ev({ session: 's1', card: 'r', attempt: 1, outcome: 'fail', phase: 'recall', day: 10 }),
            ev({ session: 's1', card: 'r', attempt: 2, outcome: 'pass', phase: 'recall', day: 10 }),
        ]);
        expect(s.recall.samples).toBe(1);
        expect(s.recall.score).toBe(100);
    });

    it('original failure survives as struggle memory', () => {
        const s = logicOf([
            ev({ session: 's1', card: 'r', attempt: 1, outcome: 'fail', phase: 'recall', day: 10 }),
            ev({ session: 's1', card: 'r', attempt: 2, outcome: 'pass', phase: 'recall', day: 10 }),
        ]);
        expect(s.recoveredStruggles).toBe(1);
        expect(s.days.find(d => d.day === 10)?.struggled).toBe(true);
    });

    it('independent sessions beat same-card retries for confidence', () => {
        const retryHeavy = logicOf(
            [1, 2, 3, 4, 5].map(n => ev({ session: 's1', card: 'r', attempt: n, outcome: n === 1 ? 'fail' : 'pass', phase: 'recall', day: 10 })),
        );
        const spread = logicOf([
            ev({ session: 's1', card: 'r', outcome: 'pass', phase: 'recall', day: 10 }),
            ev({ session: 's2', card: 'r', outcome: 'pass', phase: 'recall', day: 11 }),
            ev({ session: 's3', card: 'r', outcome: 'pass', phase: 'recall', day: 12 }),
        ]);
        expect(retryHeavy.independentSessions).toBe(1);
        expect(spread.independentSessions).toBe(3);
        expect(spread.confidence).toBeGreaterThan(retryHeavy.confidence);
    });
});

describe('8-9 — channel weights and order', () => {
    const full = (outcomes: { r: MasteryOutcome; a: MasteryOutcome; v: MasteryOutcome }) =>
        functionsOf([
            ev({ session: 's1', card: 'r', outcome: outcomes.r, phase: 'recall', day: 16 }),
            ev({ session: 's1', card: 'a', outcome: outcomes.a, phase: 'apply', day: 16 }),
            ev({ session: 's1', card: 'c', outcome: outcomes.v, phase: 'validate', day: 17 }),
        ]);

    it('validation failure hurts most, recall failure least', () => {
        const recallFail = full({ r: 'fail', a: 'pass', v: 'pass' }).masteryEstimate!;
        const appFail = full({ r: 'pass', a: 'fail', v: 'pass' }).masteryEstimate!;
        const valFail = full({ r: 'pass', a: 'pass', v: 'fail' }).masteryEstimate!;
        expect(recallFail).toBe(80);
        expect(appFail).toBe(65);
        expect(valFail).toBe(55);
        expect(valFail).toBeLessThan(appFail);
        expect(appFail).toBeLessThan(recallFail);
    });
});

describe('10-11 — no double counting', () => {
    it('task/session completion events add zero mastery', () => {
        const base = [ev({ session: 's1', card: 'a', outcome: 'pass', phase: 'apply', day: 16 })];
        const withMeta = [
            ...base,
            {
                schemaVersion: 1 as const,
                id: 's1:task_completed:t:0',
                sessionId: 's1',
                ownerId: 'u1',
                hobbyId: 'python',
                programSlug: 'python-foundations',
                programVersion: '1.0',
                curriculumDay: 16,
                skillKey: 'functions',
                sessionKind: 'structured' as const,
                source: 'daily_task' as const,
                eventType: 'task_completed' as const,
                outcome: 'pass' as const,
                outcomeValue: 1,
                evidenceStrength: 'medium' as const,
                occurredAt: at(),
            },
            {
                schemaVersion: 1 as const,
                id: 's1:session_completed:-:0',
                sessionId: 's1',
                ownerId: 'u1',
                hobbyId: 'python',
                sessionKind: 'structured' as const,
                source: 'structured_session' as const,
                eventType: 'session_completed' as const,
                outcome: 'pass' as const,
                outcomeValue: 1,
                evidenceStrength: 'none' as const,
                occurredAt: at(),
            },
        ];
        expect(functionsOf(withMeta).masteryEstimate).toBe(functionsOf(base).masteryEstimate);
        expect(functionsOf(withMeta).application.samples).toBe(1);
    });
});

describe('12 — one recall PASS is not high-confidence mastery', () => {
    it('estimate exists but confidence stays low', () => {
        const s = logicOf([ev({ session: 's1', card: 'r', outcome: 'pass', phase: 'recall', day: 10 })]);
        expect(s.masteryEstimate).toBe(100);
        expect(s.confidenceLevel).toBe('low');
        expect(s.confidence).toBeLessThan(0.7);
    });
});

describe('13 — version mismatch excluded, versionless excluded by default', () => {
    it('explicit mismatch never feeds state; versionless needs opt-in', () => {
        const mismatch = buildAttemptEvent({
            sessionId: 's', userId: 'u1', hobbyId: 'python', lessonId: 'python_d10', lessonDay: 10,
            cardId: 'c', attemptNo: 1, phase: 'apply', sessionKind: 'structured', outcome: 'pass', cardType: 'apply',
        });
        const oldVersion = { ...mismatch, id: 'x', programVersion: '0.9' };
        expect(logicOf([oldVersion]).stage).toBe('unseen');
        const versionless = { ...mismatch, id: 'y', programVersion: undefined };
        // Strict default: unversioned legacy evidence stays out of state.
        expect(logicOf([versionless]).stage).toBe('unseen');
        // Explicit compat analysis may still read it — never product intelligence.
        const compat = projectSkillState({ program, events: [versionless], includeLegacyUnversioned: true }).skills;
        expect(compat.find(s => s.skillKey === 'logic')!.application.samples).toBe(1);
    });
});

describe('30 — Functions & Data worked example', () => {
    const history = [
        ev({ session: 's15', card: 'r', attempt: 1, outcome: 'fail', phase: 'recall', day: 15 }),
        ev({ session: 's15', card: 'r', attempt: 2, outcome: 'pass', phase: 'recall', day: 15 }),
        ev({ session: 's15', card: 'a', outcome: 'partial', phase: 'apply', day: 15 }),
        ev({ session: 's16', card: 'r', outcome: 'pass', phase: 'recall', day: 16 }),
        ev({ session: 's16', card: 'a', outcome: 'pass', phase: 'apply', day: 16 }),
        ev({ session: 's17', card: 'c', outcome: 'fail', phase: 'validate', day: 17 }),
    ];

    it('projects proving state with medium confidence, not 100% mastered', () => {
        const fns = functionsOf(history);
        expect(fns.exposure.daysCovered).toBe(3);
        expect(fns.recall.score).toBe(100);
        expect(fns.application.score).toBe(75);
        expect(fns.validation.score).toBe(0);
        expect(fns.masteryEstimate).toBeLessThan(100);
        expect(fns.confidenceLevel).toBe('medium');
        expect(fns.stage).toBe('proving');
    });

    it('next action targets day 17 for recent validation failure', () => {
        const rec = recommend(history);
        expect(rec.type).toBe('practice_application');
        expect(rec.skillKey).toBe('functions');
        expect(rec.curriculumDay).toBe(17);
        expect(rec.reasonCode).toBe('recent_validation_failure');
    });
});

describe('31/16 — new user continues the path', () => {
    it('no evidence means continue at the frontier, never weakest-skill', () => {
        const rec = recommend([]);
        expect(rec.type).toBe('continue_curriculum');
        expect(rec.curriculumDay).toBe(8);
        expect(rec.reasonCode).toBe('insufficient_evidence');
        expect(rec.confidence).toBe('low');
        expect(rec.skillKey).toBeUndefined();
    });
});

describe('32 — five minutes repairs, never proves', () => {
    const recallFails = [
        ev({ session: 's1', card: 'r', outcome: 'fail', phase: 'recall', day: 12 }),
        ev({ session: 's2', card: 'r', outcome: 'fail', phase: 'recall', day: 12 }),
    ];

    it('repair_recall on day 12, not prove_skill', () => {
        const rec = recommend(recallFails, { availableMinutes: 5 });
        expect(rec.type).toBe('repair_recall');
        expect(rec.skillKey).toBe('logic');
        expect(rec.curriculumDay).toBe(12);
        expect(rec.minutes).toBe(5);
    });
});

describe('33/22 — thirty minutes may prove when validation is missing', () => {
    it('strong recall+app without validation yields prove_skill at 30 min', () => {
        const strong = [
            ev({ session: 's1', card: 'r', outcome: 'pass', phase: 'recall', day: 16 }),
            ev({ session: 's1', card: 'a', outcome: 'pass', phase: 'apply', day: 16 }),
            ev({ session: 's2', card: 'r', outcome: 'pass', phase: 'recall', day: 17 }),
            ev({ session: 's2', card: 'a', outcome: 'pass', phase: 'apply', day: 17 }),
        ];
        const rec = recommend(strong, { availableMinutes: 30 });
        expect(rec.type).toBe('prove_skill');
        expect(rec.skillKey).toBe('functions');
    });

    it('same state at 5 minutes never proves', () => {
        const strong = [
            ev({ session: 's1', card: 'r', outcome: 'pass', phase: 'recall', day: 16 }),
            ev({ session: 's1', card: 'a', outcome: 'pass', phase: 'apply', day: 16 }),
            ev({ session: 's2', card: 'r', outcome: 'pass', phase: 'recall', day: 17 }),
            ev({ session: 's2', card: 'a', outcome: 'pass', phase: 'apply', day: 17 }),
        ];
        expect(recommend(strong, { availableMinutes: 5 }).type).not.toBe('prove_skill');
    });
});

describe('17/19/20 — remediation targets encountered days, frontier kept', () => {
    it('targets a real encountered day, never an unseen future one', () => {
        const rec = recommend(
            [ev({ session: 's9', card: 'c', outcome: 'fail', phase: 'validate', day: 20 })],
            { currentCurriculumDay: 8 },
        );
        expect(rec.curriculumDay).toBe(20);
        expect(rec.type).toBe('practice_application');
    });

    it('isolated old weakness becomes a light review, not a blocker', () => {
        const rec = recommend(
            [ev({ session: 's1', card: 'r', outcome: 'fail', phase: 'recall', day: 9 })],
            { currentCurriculumDay: 20 },
        );
        // Single old recall fail: light revisit, never a repair block.
        expect(rec.type).toBe('review_skill');
        expect(rec.curriculumDay).toBe(9);
    });

    it('repeated application struggle outranks continuation', () => {
        const rec = recommend(
            [
                ev({ session: 's1', card: 'a', outcome: 'partial', phase: 'apply', day: 16 }),
                ev({ session: 's2', card: 'a', outcome: 'fail', phase: 'apply', day: 16 }),
            ],
            {
                currentCurriculumDay: 17,
                dailyTasks: [{ id: 't9', title: 'Next', type: 'practice', status: 'pending' }],
            },
        );
        expect(rec.type).toBe('practice_application');
        expect(rec.reasonCode).toBe('repeated_application_struggle');
    });
});

describe('18/25 — routes are real, task IDs unchanged', () => {
    it('repair maps to a review bite on the encountered day', () => {
        const rec = recommend([
            ev({ session: 's1', card: 'r', outcome: 'fail', phase: 'recall', day: 12 }),
            ev({ session: 's2', card: 'r', outcome: 'fail', phase: 'recall', day: 12 }),
        ]);
        const route = routeForRecommendation(rec, 'quick_session');
        expect(route).toMatch(/kind=certificate_review/);
        expect(route).toMatch(/skillDay=12/);
    });

    it('continue maps to the real DailyPlan task', () => {
        const rec = recommend([], {
            dailyTasks: [{ id: 'real-1', title: 'T', type: 'theory', status: 'pending', duration_minutes: 12 }],
        });
        expect(rec.taskId).toBe('real-1');
        expect(routeForRecommendation(rec, 'your_day')).toMatch(/taskId=real-1/);
    });
});

describe('23/24 — consumers use the one source, no blind selection', () => {
    it('Quick no longer ranks via the legacy graph', () => {
        const fs = require('fs') as typeof import('fs');
        const path = require('path') as typeof import('path');
        const src = fs.readFileSync(path.join(__dirname, '..', 'screens', 'QuickSessionScreen.tsx'), 'utf8');
        expect(src).not.toMatch(/weakestOpenSkill/);
        expect(src).toMatch(/useLearningIntelligence/);
    });

    it('Credential next action never selects dayRange[0] blindly', () => {
        const fs = require('fs') as typeof import('fs');
        const path = require('path') as typeof import('path');
        const src = fs.readFileSync(path.join(__dirname, '..', 'screens', 'CredentialDetailScreen.tsx'), 'utf8');
        expect(src).not.toMatch(/dayRange\[0\]/);
        expect(src).toMatch(/routeForRecommendation/);
    });
});

describe('36 — execution capability matches the runtime', () => {
    const appWeakness = [
        ev({ session: 's1', card: 'a', outcome: 'partial', phase: 'apply', day: 16 }),
        ev({ session: 's2', card: 'a', outcome: 'fail', phase: 'apply', day: 16 }),
    ];

    it('10-minute runtime cannot promise Apply: repair instead', () => {
        const rec = recommend(appWeakness, { availableMinutes: 10 });
        expect(rec.type).toBe('repair_recall');
        expect(rec.curriculumDay).toBe(16);
        // The emitted session truly has no apply phase.
        const bp = buildSessionBlueprint({ minutes: 10, lessonTitle: 'T' });
        expect(bp.phases).not.toContain('apply');
        expect(
            sessionCapabilities({ minutes: 10, kind: 'certificate_review', scope: 'none', hasTests: false, hasDoTask: true }).canApply,
        ).toBe(false);
    });

    it('same weakness at 15 minutes keeps targeted practice', () => {
        const rec = recommend(appWeakness, { availableMinutes: 15 });
        expect(rec.type).toBe('practice_application');
    });

    it('prove_skill requires a lesson that can genuinely validate', () => {
        const strong = [
            ev({ session: 's1', card: 'r', outcome: 'pass', phase: 'recall', day: 16 }),
            ev({ session: 's1', card: 'a', outcome: 'pass', phase: 'apply', day: 16 }),
            ev({ session: 's2', card: 'r', outcome: 'pass', phase: 'recall', day: 17 }),
            ev({ session: 's2', card: 'a', outcome: 'pass', phase: 'apply', day: 17 }),
        ];
        const noTests = () => ({ known: true, hasTests: false, hasDoTask: true });
        const downgraded = recommend(strong, { availableMinutes: 30, lessonCaps: noTests });
        expect(downgraded.type).not.toBe('prove_skill');
        expect(downgraded.type).toBe('practice_application');
        const proven = recommend(strong, {
            availableMinutes: 30,
            lessonCaps: () => ({ known: true, hasTests: true, hasDoTask: true }),
        });
        expect(proven.type).toBe('prove_skill');
        expect(proven.curriculumDay).toBe(17);
        expect(routeForRecommendation(proven, 'quick_session')).toMatch(/skillDay=17/);
        expect(routeForRecommendation(proven, 'quick_session')).toMatch(/scope=targeted/);
    });

    it('targeted proof advances nothing and completes nothing', async () => {
        const d = buildProgressionDecision({
            kind: 'structured',
            evaluation: 'pass',
            blueprint: { countsAsFullCompletion: true, requiresValidation: false },
            hasTargetTask: true,
            scope: 'targeted',
        });
        expect(d.advanceCurriculum).toBe(false);
        expect(d.completeDailyTask).toBe(false);
        expect(d.countSession).toBe(true);
    });
});

describe('37 — adaptive flow stays finite and honest', () => {
    const lesson: any = {
        id: 'python_d15',
        hobby: 'python',
        day: 15,
        learn: { title: 'Functions', body: 'Functions package logic. Example: def f(): return 1.', keywords: ['function'] },
        do: { type: 'free_text', prompt: 'Explain functions.' },
    };

    const cardsFor = (minutes: number, kind: 'structured' = 'structured') => {
        const bp = buildSessionBlueprint({ minutes, lessonTitle: 'Functions' });
        return buildLearningCards({ blueprint: bp, lesson, kind, minutes });
    };

    it('recall FAIL inserts finite support + retry; PASS inserts none', () => {
        const cards = cardsFor(15);
        let flow = initialFlowState(cards);
        const recall = cards.find(c => c.type === 'recall')!;
        flow = flowTransition(flow, { type: 'ANSWER', id: recall.id, outcome: 'fail', explanation: 'Real explanation.' }, 1);
        expect(flow.cards.some(c => c.type === 'feedback')).toBe(true);
        const retry = flowTransition(flow, { type: 'ANSWER', id: recall.id, outcome: 'pass' }, 1);
        expect(retry.cards.filter(c => c.type === 'feedback')).toHaveLength(1);
    });

    it('retry exhaustion terminates truthfully', () => {
        const cards = cardsFor(15);
        let flow = initialFlowState(cards);
        const recall = cards.find(c => c.type === 'recall')!;
        flow = flowTransition(flow, { type: 'ANSWER', id: recall.id, outcome: 'fail', explanation: 'Why.' }, 1);
        flow = flowTransition(flow, { type: 'ANSWER', id: recall.id, outcome: 'fail', explanation: 'Why.' }, 1);
        const st = flow.status[recall.id];
        expect(st.completed).toBe(true);
        expect(st.outcome).toBe('fail');
        expect(flow.cards.filter(c => c.type === 'feedback')).toHaveLength(1);
    });

    it('support cards add no mastery evidence', () => {
        const skills = projectSkillState({
            program,
            events: [
                ev({ session: 's1', card: 'r', outcome: 'fail', phase: 'recall', day: 16 }),
                ev({ session: 's1', card: 'r', attempt: 2, outcome: 'pass', phase: 'recall', day: 16 }),
            ],
        }).skills;
        const fns = skills.find(s => s.skillKey === 'functions')!;
        expect(fns.recall.samples).toBe(1);
        expect(fns.recall.score).toBe(100);
        expect(fns.recoveredStruggles).toBe(1);
    });
});

describe('closed loop — validation failure resolves and the engine moves on', () => {
    it('FAIL day 17 -> target 17 -> targeted PASS -> blocker gone', () => {
        const before = [
            ev({ session: 's1', card: 'c', outcome: 'fail', phase: 'validate', day: 17 }),
        ];
        const recBefore = recommend(before);
        expect(recBefore.type).toBe('practice_application');
        expect(recBefore.curriculumDay).toBe(17);
        expect(recBefore.reasonCode).toBe('recent_validation_failure');

        const after = [
            ...before,
            ev({ session: 's2', card: 'c', outcome: 'pass', phase: 'validate', day: 17 }),
        ];
        const fns = functionsOf(after);
        expect(fns.validation.score).toBeGreaterThan(0);
        const recAfter = recommend(after);
        expect(recAfter.reasonCode).not.toBe('recent_validation_failure');
        // History preserved: both finals visible in events, one mastery sample.
        expect(fns.validation.samples).toBe(2);
    });

    it('application struggle -> practice -> independent PASS resolves', () => {
        const struggle = [
            ev({ session: 's1', card: 'a', outcome: 'partial', phase: 'apply', day: 16 }),
            ev({ session: 's2', card: 'a', outcome: 'fail', phase: 'apply', day: 16 }),
        ];
        expect(recommend(struggle).type).toBe('practice_application');
        const resolved = [
            ...struggle,
            ev({ session: 's3', card: 'a', outcome: 'pass', phase: 'apply', day: 16 }),
            ev({ session: 's4', card: 'a', outcome: 'pass', phase: 'apply', day: 16 }),
        ];
        const rec = recommend(resolved);
        expect(rec.reasonCode).not.toBe('repeated_application_struggle');
        const fns = functionsOf(resolved);
        expect(fns.application.score).toBeGreaterThan(50);
    });
});

describe('reason copy respects language at the UI boundary', () => {
    it('ru by default, en on request, codes stay in domain', () => {
        expect(reasonCopy('recall_gap', { skillName: 'Logic', day: 12 })).toMatch(/Пробел/);
        expect(reasonCopy('recall_gap', { skillName: 'Logic', day: 12 }, 'en')).toMatch(/Gap/);
        expect(reasonCopy('continue_path', undefined, 'en')).toBe('Continuing the path');
    });
});
