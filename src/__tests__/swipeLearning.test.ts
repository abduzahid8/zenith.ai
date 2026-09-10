/**
 * Swipe learning mechanic — domain invariants (§32).
 * Pure tests over SessionBlueprint -> learningCards -> flow reducer.
 */
import type { LessonContent } from '../data/lessonContent';
import {
    budgetForMinutes,
    buildLearningCards,
    buildResultData,
    canAdvanceFrom,
    flowTransition,
    initialFlowState,
    splitBodyToIdeas,
    statusOf,
} from '../domain/sessions/learningCards';
import { evaluateSession } from '../domain/sessions/outcomePolicy';
import {
    buildSessionBlueprint,
    normalizeKind,
    parseSessionParams,
    parseVerdict,
} from '../domain/sessions/sessionBlueprint';
import { resolveCompletionPlan } from '../domain/sessions/sessionCompletion';

const lesson = (overrides: Partial<LessonContent> = {}): LessonContent => ({
    id: 'python_d15',
    hobby: 'python',
    day: 15,
    learn: {
        title: 'Why functions?',
        body: 'Functions let you package reusable logic into one named block that you can call again and again. They take inputs called parameters and hand outputs back to the rest of your program. Example: def greet(name): return "Hi " + name shows a tiny function with one parameter. Without a function you repeat print("Hi Ana") and print("Hi Bob") everywhere. With a function you simply call greet("Ana") and greet("Bob") whenever you need a greeting. Remember that return sends a value back to the caller. Values that are only printed can never be reused in later calculations.',
        keywords: ['function', 'return'],
    },
    do: {
        type: 'code',
        prompt: 'Write a function double(x) that returns twice its input.',
        starterCode: 'def double(x):\n    ',
    },
    tests: [
        {
            type: 'multiple_choice',
            prompt: 'What does `return` do?',
            options: ['Sends a value back', 'Prints the value', 'Repeats the function'],
            correctOptionIndex: 0,
        },
    ],
    deepen1: { type: 'free_text', prompt: 'When would you NOT use a function?' },
    ...overrides,
});

const bp = (minutes: number, hasTests = true) =>
    buildSessionBlueprint({ minutes, lessonTitle: 'Functions', hasTests });

describe('blueprint -> card phases', () => {
    it.each([5, 15, 30])('%d-min cards only use blueprint phases', (minutes: number) => {
        const blueprint = bp(minutes);
        const cards = buildLearningCards({ blueprint, lesson: lesson(), kind: 'structured', minutes });
        expect(cards.length).toBeGreaterThan(0);
        for (const c of cards) {
            expect(blueprint.phases).toContain(c.phase);
        }
    });

    it('15-min session has no invented validate phase cards', () => {
        const blueprint = bp(15);
        expect(blueprint.phases).not.toContain('validate');
        const cards = buildLearningCards({ blueprint, lesson: lesson(), kind: 'structured', minutes: 15 });
        expect(cards.some(c => c.phase === 'validate')).toBe(false);
    });
});

describe('card count scales with session length', () => {
    it('5-minute session produces fewer cards than 30-minute', () => {
        const short = buildLearningCards({ blueprint: bp(5), lesson: lesson(), kind: 'structured', minutes: 5 });
        const long = buildLearningCards({ blueprint: bp(30), lesson: lesson(), kind: 'structured', minutes: 30 });
        expect(short.length).toBeGreaterThanOrEqual(4);
        expect(short.length).toBeLessThanOrEqual(6);
        expect(long.length).toBeGreaterThan(short.length);
        expect(long.length).toBeLessThanOrEqual(14);
    });

    it('budgets grow monotonically-ish without filler', () => {
        expect(budgetForMinutes(5, 'structured').recalls).toBe(1);
        expect(budgetForMinutes(30, 'structured').applies).toBeGreaterThan(
            budgetForMinutes(5, 'structured').applies,
        );
    });
});

describe('one card = one idea', () => {
    const longBody = [
        'Functions let you package reusable logic into one named block that you can call many times.',
        'They take inputs called parameters and produce outputs for the rest of the program to use.',
        'Example: def greet(name): return "Hi " + name shows a tiny function with one parameter.',
        'Without a function you repeat print("Hi Ana") and print("Hi Bob") everywhere in your code.',
        'With a function you simply call greet("Ana") and greet("Bob") whenever you need a greeting.',
        'Remember that return sends a value back to the caller instead of printing it to the screen.',
        'This distinction matters because printed text cannot be reused later in calculations.',
    ].join(' ');

    it('splits long bodies into <=60-word chunks', () => {
        const ideas = splitBodyToIdeas(longBody);
        expect(ideas.length).toBeGreaterThan(1);
        for (const i of ideas) {
            expect(i.text.split(/\s+/).length).toBeLessThanOrEqual(60);
        }
    });

    it('detects example chunks without inventing them', () => {
        const ideas = splitBodyToIdeas(lesson().learn.body);
        expect(ideas.some(i => i.isExample)).toBe(true);
        const plain = splitBodyToIdeas('Short idea. Another short idea.');
        expect(plain.every(i => !i.isExample)).toBe(true);
    });
});

describe('discovery contains no certificate/progression cards', () => {
    it('only concept/example/recall/apply/result, nothing required', () => {
        const blueprint = buildSessionBlueprint({ minutes: 10, lessonTitle: 'Contrails' });
        const cards = buildLearningCards({
            blueprint,
            lesson: { ...lesson(), id: 'discovery-contrails', learn: { title: 'Contrails', body: 'Cold air causes vapor to condense. Example: jets leave white trails.', keywords: [] } },
            kind: 'discovery',
            minutes: 10,
        });
        const allowed = ['concept', 'example', 'recall', 'apply', 'result'];
        for (const c of cards) {
            expect(allowed).toContain(c.type);
            expect(c.required).toBe(false);
        }
    });
});

describe('certificate_review stays review-only', () => {
    it('review blueprint never grants full completion', () => {
        const review = buildSessionBlueprint({ minutes: 30, lessonTitle: 'Loops', kind: 'certificate_review' });
        expect(review.countsAsFullCompletion).toBe(false);
        const plan = resolveCompletionPlan({
            blueprint: review,
            outcome: 'pass',
            tasks: [{ id: 't1', type: 'practice', status: 'pending' }],
            targetTaskId: 't1',
        });
        expect(plan.completeTask).toBe(false);
        expect(plan.advance).toBe(false);
    });

    it('structured validated session may complete the target task', () => {
        const full = buildSessionBlueprint({ minutes: 30, lessonTitle: 'Loops' });
        const plan = resolveCompletionPlan({
            blueprint: full,
            outcome: 'pass',
            tasks: [{ id: 't1', type: 'practice', status: 'pending' }],
            targetTaskId: 't1',
        });
        expect(plan.completeTask).toBe(true);
    });
});

describe('required cards gate advance', () => {
    it('unanswered required recall blocks, passive allows, result is terminal', () => {
        const cards = buildLearningCards({ blueprint: bp(15), lesson: lesson(), kind: 'structured', minutes: 15 });
        let flow = initialFlowState(cards);
        const recall = cards.find(c => c.type === 'recall')!;
        expect(recall.required).toBe(true);
        expect(canAdvanceFrom(flow, recall.id)).toBe(false);
        flow = flowTransition(flow, { type: 'ANSWER', id: recall.id, outcome: 'pass' }, 1);
        expect(canAdvanceFrom(flow, recall.id)).toBe(true);
        const concept = cards.find(c => c.type === 'concept')!;
        expect(canAdvanceFrom(flow, concept.id)).toBe(true);
        const result = cards.find(c => c.type === 'result')!;
        expect(canAdvanceFrom(flow, result.id)).toBe(false);
    });

    it('failed recall inserts one real explanation card then allows retry', () => {
        const cards = buildLearningCards({ blueprint: bp(15), lesson: lesson(), kind: 'structured', minutes: 15 });
        let flow = initialFlowState(cards);
        const recall = cards.find(c => c.type === 'recall')!;
        flow = flowTransition(
            flow,
            { type: 'ANSWER', id: recall.id, outcome: 'fail', explanation: 'return sends a value back.' },
            1,
        );
        expect(canAdvanceFrom(flow, recall.id)).toBe(false);
        const feedback = flow.cards.find(c => c.type === 'feedback');
        expect(feedback?.feedback?.body).toBe('return sends a value back.');
        expect(feedback?.phase).toBe(recall.phase);
        flow = flowTransition(flow, { type: 'ANSWER', id: recall.id, outcome: 'pass' }, 1);
        expect(canAdvanceFrom(flow, recall.id)).toBe(true);
        expect(statusOf(flow, recall.id).attempts).toBe(2);
    });
});

describe('outcomes flow into existing engine logic', () => {
    it('AI verdicts parse to outcomes; required-card evaluation needs every proof', () => {
        expect(parseVerdict('👍 great')).toBe('pass');
        expect(parseVerdict('🤔 partial')).toBe('partial');
        expect(parseVerdict('❌ wrong')).toBe('fail');
        const cards = buildLearningCards({ blueprint: bp(30), lesson: lesson(), kind: 'structured', minutes: 30 });
        const required = cards.filter(c => c.required && c.type !== 'result');
        expect(required.length).toBeGreaterThan(0);
        // One PASS cannot mask an unanswered required card.
        const partial = { [required[0].id]: { completed: true, attempts: 1, outcome: 'pass' as const } };
        expect(evaluateSession(cards, partial)).toBe('non_rewarding');
    });

    it('a passing recall plus a failing challenge is session FAIL, not PASS', () => {
        const cards = buildLearningCards({ blueprint: bp(30), lesson: lesson(), kind: 'structured', minutes: 30 });
        const recall = cards.find(c => c.type === 'recall')!;
        const apply = cards.find(c => c.type === 'apply')!;
        const status = {
            [recall.id]: { completed: true, attempts: 1, outcome: 'pass' as const },
            [apply.id]: { completed: true, attempts: 1, outcome: 'fail' as const },
        };
        expect(evaluateSession(cards, status)).toBe('fail');
    });

    it('failed session earns nothing', () => {
        const full = buildSessionBlueprint({ minutes: 30, lessonTitle: 'Loops' });
        const plan = resolveCompletionPlan({
            blueprint: full,
            outcome: 'fail',
            tasks: [{ id: 't1', type: 'practice', status: 'pending' }],
            targetTaskId: 't1',
        });
        expect(plan.completeTask).toBe(false);
        expect(plan.advance).toBe(false);
    });
});

describe('structured session retains the DailyPlan task id', () => {
    it('parseSessionParams preserves taskId/kind/origin', () => {
        const parsed = parseSessionParams({ minutes: '15', taskId: 'task-1', kind: 'structured', origin: 'home' });
        expect(parsed.context.taskId).toBe('task-1');
        expect(parsed.context.kind).toBe('structured');
        expect(parsed.minutes).toBe(15);
        expect(normalizeKind('certificate_review')).toBe('certificate_review');
    });
});

describe('result card never fabricates percentages', () => {
    it('omits what does not exist; contains no invented progress', () => {
        const data = buildResultData({
            kind: 'structured',
            objectiveTitle: 'Functions',
            hobbyLabel: 'Python',
            minutesFocused: 14.7,
            status: {},
            cards: [],
            taskCompleted: false,
        });
        expect(data.minutesFocused).toBe(14);
        expect(data.answersVerified).toBeNull();
        expect(data.taskTitle).toBeNull();
        expect(data.nextTitle).toBeNull();
        expect(JSON.stringify(data)).not.toMatch(/%/);
    });
});

describe('determinism', () => {
    it('same lesson + blueprint => identical cards', () => {
        const input = { blueprint: bp(30), lesson: lesson(), kind: 'structured' as const, minutes: 30 };
        expect(buildLearningCards(input)).toEqual(buildLearningCards(input));
    });
});
