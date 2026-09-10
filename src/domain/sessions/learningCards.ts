import type { LessonContent, TaskStep } from '../../data/lessonContent';
import type {
    SessionBlueprint,
    SessionKind,
    SessionPhase,
    SessionStepId,
    StepOutcome,
} from './sessionBlueprint';
import type { LearningStrategy } from './sessionIntent';

/**
 * Swipe learning cards — pure presentation model over SessionBlueprint.
 *
 * Contract:
 * - SessionBlueprint determines the phases. The builder NEVER emits a card
 *   whose phase is not in blueprint.phases (no invented phases).
 * - Cards are built ONLY from real content (lesson body/keywords/tasks).
 *   No AI calls, no randomness, no Date.now — same input => same cards.
 * - One card = one idea: long bodies are split deterministically.
 * - Interactive cards (recall/apply/challenge) report outcomes back into
 *   the EXISTING engine (parseVerdict / resolveCompletionPlan). The swipe
 *   layer owns no scoring.
 */

export type LearningCardType =
    | 'concept'
    | 'example'
    | 'key_idea'
    | 'recall'
    | 'apply'
    | 'challenge'
    | 'feedback'
    | 'result';

export interface RecallPayload {
    prompt: string;
    options?: string[];
    correctOptionIndex?: number;
    /** Expected answer text (for AI-graded free-text recall). */
    correctAnswer?: string;
    hint?: string;
    /** Full test list when the lesson has several (e.g. chess: all 5). */
    tests?: TaskStep[];
    /** Where the recall came from — always real content. */
    source: 'lesson_test' | 'keyword' | 'title_recap';
}

export interface TaskPayload {
    task: TaskStep;
}

export interface FeedbackPayload {
    /** Real explanation: correct answer / AI feedback / success text. */
    body: string;
    verdict: StepOutcome;
}

export interface LearningCard {
    id: string;
    type: LearningCardType;
    phase: SessionPhase;
    title?: string;
    body?: string;
    /** Cards per viewport position (0-based). */
    order: number;
    /** Required cards gate forward swipe until completed. */
    required: boolean;
    sourceStepId?: SessionStepId;
    recall?: RecallPayload;
    task?: TaskStep;
    /** Full test list for challenge cards (hosted TestStepper). */
    taskTests?: TaskStep[];
    feedback?: FeedbackPayload;
}

export interface CardBudget {
    concepts: number;
    examples: number;
    keyIdeas: number;
    recalls: number;
    applies: number;
    challenges: number;
}

/** Card budget scales with session length — never filler, capped by content. */
export function budgetForMinutes(minutes: number, kind: SessionKind): CardBudget {
    if (kind === 'discovery') {
        return { concepts: 3, examples: 1, keyIdeas: 0, recalls: 1, applies: 1, challenges: 0 };
    }
    if (kind === 'certificate_review') {
        if (minutes <= 10) return { concepts: 2, examples: 1, keyIdeas: 1, recalls: 1, applies: 1, challenges: 0 };
        return { concepts: 3, examples: 1, keyIdeas: 1, recalls: 1, applies: 2, challenges: 1 };
    }
    if (minutes <= 5) return { concepts: 2, examples: 1, keyIdeas: 0, recalls: 1, applies: 0, challenges: 0 };
    if (minutes <= 10) return { concepts: 3, examples: 1, keyIdeas: 1, recalls: 1, applies: 0, challenges: 0 };
    if (minutes <= 20) return { concepts: 3, examples: 1, keyIdeas: 1, recalls: 1, applies: 1, challenges: 0 };
    if (minutes <= 30) return { concepts: 4, examples: 1, keyIdeas: 1, recalls: 1, applies: 2, challenges: 1 };
    return { concepts: 5, examples: 2, keyIdeas: 2, recalls: 2, applies: 3, challenges: 1 };
}

const EXAMPLE_MARKERS = ['```', 'Пример:', 'пример:', 'Example:', 'example:', 'например', 'e.g.', 'def ', 'print(', '→'];

function isExampleChunk(text: string): boolean {
    return EXAMPLE_MARKERS.some(m => text.includes(m));
}

/** Split a body into idea-sized chunks (<= ~60 words each), deterministic. */
export function splitBodyToIdeas(body: string): { text: string; isExample: boolean }[] {
    const normalized = (body || '').trim();
    if (!normalized) return [];
    const paragraphs = normalized.split(/\n+/).map(p => p.trim()).filter(Boolean);
    const sentences: string[] = [];
    for (const p of paragraphs) {
        const parts = p.match(/[^.!?]+[.!?]+/g);
        if (parts && parts.length > 1) {
            for (const s of parts) {
                const t = s.trim();
                if (t) sentences.push(t);
            }
        } else {
            sentences.push(p);
        }
    }
    const chunks: string[] = [];
    let current = '';
    const pushCurrent = () => {
        const t = current.trim();
        if (t) chunks.push(t);
        current = '';
    };
    for (const s of sentences) {
        const words = (current + ' ' + s).trim().split(/\s+/).length;
        if (words > 60 && current) {
            pushCurrent();
            current = s;
        } else {
            current = current ? `${current} ${s}` : s;
        }
    }
    pushCurrent();
    return chunks.map(text => ({ text, isExample: isExampleChunk(text) }));
}

export interface BuildCardsInput {
    blueprint: SessionBlueprint;
    lesson: LessonContent | null;
    kind: SessionKind;
    minutes: number;
    /** Premium unlocks deepen tasks (mirrors legacy gating). */
    isPremium?: boolean;
    /** Recall prompt language (UI copy only, content stays as authored). */
    language?: 'ru' | 'en';
    /**
     * Learning strategy: changes emphasis (fewer passive cards for
     * practice/proof), never invents phases or content. Default continue_curriculum.
     */
    strategy?: LearningStrategy;
}

function phaseAllowed(phases: readonly SessionPhase[], phase: SessionPhase): boolean {
    return phases.includes(phase);
}

/** Build the deterministic swipe sequence. Empty when no lesson loaded. */
export function buildLearningCards(input: BuildCardsInput): LearningCard[] {
    const { blueprint, lesson, kind, minutes, isPremium, language } = input;
    const strategy = input.strategy ?? 'continue_curriculum';
    if (!lesson) return [];
    const phases = blueprint.phases;
    const base = budgetForMinutes(minutes, kind);
    // Strategy trims the minute budget toward the session's purpose.
    // Phases below still gate everything: no phase, no cards.
    const budget: CardBudget =
        strategy === 'repair_recall'
            ? { ...base, concepts: Math.min(base.concepts, 1), examples: Math.min(base.examples, 1), keyIdeas: 0, applies: minutes > 5 ? Math.min(base.applies, 1) : 0, challenges: 0 }
            : strategy === 'practice_application'
              ? { ...base, concepts: Math.min(base.concepts, 1), examples: Math.min(base.examples, 1), keyIdeas: Math.min(base.keyIdeas, 1), recalls: Math.min(base.recalls, 1) }
              : strategy === 'prove_skill'
                ? { ...base, concepts: Math.min(base.concepts, 1), examples: 0, keyIdeas: 0, recalls: Math.min(base.recalls, 1), applies: Math.min(Math.max(base.applies, 1), 2) }
                : strategy === 'review_skill'
                  ? { ...base, concepts: Math.min(base.concepts, 1), examples: 0, keyIdeas: 0, recalls: Math.min(base.recalls, 1), applies: minutes > 5 ? Math.min(base.applies, 1) : 0, challenges: 0 }
                  : base;
    const lang = language ?? 'ru';
    const cards: LearningCard[] = [];
    const push = (card: Omit<LearningCard, 'order'>) => {
        cards.push({ ...card, order: cards.length });
    };

    const hasPhase = (p: SessionPhase) => phaseAllowed(phases, p);
    const ideas = splitBodyToIdeas(lesson.learn.body);
    const usedIdea = new Set<number>();

    // --- Understand: concept / example / key idea cards (no duplicates) ---
    if (hasPhase('understand')) {
        const conceptIdx = ideas.map((idea, i) => ({ idea, i })).filter(x => !x.idea.isExample);
        const conceptCount = Math.min(budget.concepts, Math.max(conceptIdx.length, ideas.length > 0 ? 1 : 0));
        for (let i = 0; i < conceptCount; i++) {
            const pick = conceptIdx[i] ?? (i === 0 && ideas.length > 0 ? { idea: ideas[0], i: 0 } : null);
            if (!pick || usedIdea.has(pick.i)) break;
            usedIdea.add(pick.i);
            push({
                id: `understand-concept-${i}`,
                type: 'concept',
                phase: 'understand',
                title: i === 0 ? lesson.learn.title : undefined,
                body: pick.idea.text,
                required: false,
                sourceStepId: 'learn',
            });
        }
        let examples = 0;
        for (let i = 0; i < ideas.length && examples < budget.examples; i++) {
            if (!ideas[i].isExample || usedIdea.has(i)) continue;
            usedIdea.add(i);
            examples++;
            push({
                id: `understand-example-${examples - 1}`,
                type: 'example',
                phase: 'understand',
                title: 'Пример',
                body: ideas[i].text,
                required: false,
                sourceStepId: 'learn',
            });
        }
        const keywords = lesson.learn.keywords ?? [];
        for (let i = 0; i < Math.min(budget.keyIdeas, keywords.length); i++) {
            push({
                id: `understand-key-${i}`,
                type: 'key_idea',
                phase: 'understand',
                title: 'Запомни',
                body: keywords[i],
                required: false,
                sourceStepId: 'learn',
            });
        }
    }

    // --- Recall: one question from real content ---
    if (hasPhase('recall')) {
        for (let i = 0; i < budget.recalls; i++) {
            const recall = buildRecallPayload(lesson, i, kind, lang);
            if (!recall) break;
            push({
                id: `recall-${i}`,
                type: 'recall',
                phase: 'recall',
                title: 'Быстрое повторение',
                required: kind !== 'discovery',
                sourceStepId: 'recall',
                recall,
            });
        }
    }

    // --- Apply: the lesson's real do task (+ deepen for longer premium) ---
    if (hasPhase('apply')) {
        const applyTasks: TaskStep[] = [];
        if (lesson.do) applyTasks.push(lesson.do);
        if (minutes > 10 && isPremium) {
            if (lesson.deepen1) applyTasks.push(lesson.deepen1);
            if (minutes > 30 && lesson.deepen2) applyTasks.push(lesson.deepen2);
        }
        const count = Math.min(budget.applies, applyTasks.length);
        for (let i = 0; i < count; i++) {
            push({
                id: `apply-${i}`,
                type: 'apply',
                phase: 'apply',
                title: i === 0 ? 'Сделай' : 'Закрепи',
                required: kind === 'structured',
                sourceStepId: i === 0 ? 'do' : (`deepen${i}` as SessionStepId),
                task: applyTasks[i],
            });
        }
    }

    // --- Validate: challenge from real tests (never invented) ---
    if (hasPhase('validate')) {
        const tests = lesson.tests ?? [];
        if (tests.length > 0 && budget.challenges > 0) {
            push({
                id: 'validate-challenge-0',
                type: 'challenge',
                phase: 'validate',
                title: 'Вызов',
                required: kind === 'structured',
                sourceStepId: 'tests',
                taskTests: tests,
            });
        }
    }

    // --- Complete: result card (data filled by controller, never faked) ---
    if (hasPhase('complete')) {
        push({
            id: 'complete-result',
            type: 'result',
            phase: 'complete',
            required: false,
        });
    }

    return cards;
}

/** Recall payload strictly from real content: lesson test > keyword > title. */
function buildRecallPayload(
    lesson: LessonContent,
    index: number,
    kind: SessionKind,
    language: 'ru' | 'en' = 'ru',
): RecallPayload | null {
    const tests = lesson.tests ?? [];
    if (index === 0 && tests.length > 1) {
        // Keep the whole real test list together (e.g. all 5 chess tests).
        return { prompt: tests[0].prompt, tests, source: 'lesson_test' };
    }
    const test = tests[index];
    if (test) {
        if (test.options && test.options.length > 0 && typeof test.correctOptionIndex === 'number') {
            return {
                prompt: test.prompt,
                options: test.options,
                correctOptionIndex: test.correctOptionIndex,
                hint: test.hints?.[0],
                source: 'lesson_test',
            };
        }
        return {
            prompt: test.prompt,
            correctAnswer: test.correctAnswer,
            hint: test.hints?.[0],
            source: 'lesson_test',
        };
    }
    if (index > 0) return null;
    const keywords = lesson.learn.keywords ?? [];
    const ru = language !== 'en';
    if (keywords.length > 0) {
        const ideas = splitBodyToIdeas(lesson.learn.body);
        const hit = ideas.find(i => i.text.includes(keywords[0]));
        return {
            prompt: ru
                ? `Что означает «${keywords[0]}»? Объясни коротко.`
                : `What does "${keywords[0]}" mean? Explain briefly.`,
            correctAnswer: hit?.text,
            source: 'keyword',
        };
    }
    if (kind === 'discovery') return null;
    const ideas = splitBodyToIdeas(lesson.learn.body);
    return {
        prompt: ru
            ? `Своими словами: о чём «${lesson.learn.title}»?`
            : `In your own words: what was "${lesson.learn.title}" about?`,
        correctAnswer: ideas[0]?.text,
        source: 'title_recap',
    };
}

// ---------------------------------------------------------------------------
// Flow state: pure reducer for gating + deterministic adaptive branching.
// wrong recall -> insert explanation card -> retry once (blueprint maxRetries)
// ---------------------------------------------------------------------------

export interface CardStatus {
    completed: boolean;
    outcome?: StepOutcome;
    attempts: number;
}

export interface FlowState {
    cards: LearningCard[];
    index: number;
    /** Highest card position the user may navigate to. */
    maxUnlocked: number;
    status: Record<string, CardStatus>;
}

export function initialFlowState(cards: LearningCard[]): FlowState {
    return { cards, index: 0, maxUnlocked: 0, status: {} };
}

export function statusOf(state: FlowState, id: string): CardStatus {
    return state.status[id] ?? { completed: false, attempts: 0 };
}

/** Passive cards and completed required cards allow advancing. */
export function canAdvanceFrom(state: FlowState, id: string): boolean {
    const card = state.cards.find(c => c.id === id);
    if (!card) return false;
    if (card.type === 'result') return false;
    if (!card.required) return true;
    return statusOf(state, id).completed;
}

export type FlowEvent =
    | { type: 'VIEW'; id: string }
    | { type: 'ANSWER'; id: string; outcome: StepOutcome; explanation?: string }
    | { type: 'GOTO'; index: number };

/**
 * Forward-navigation authorization — the single gate for swipe movement.
 * - at/below the high-water mark: always allowed (revisiting).
 * - exactly one past it: allowed only when the frontier card permits exit
 *   (passive cards and completed required cards do; unanswered required
 *   cards and the terminal result do not).
 * - anything further: denied, stay where you are.
 * Viewing never grants permission beyond this rule.
 */
export function authorizeStepIndex(state: FlowState, target: number): number {
    const last = state.cards.length - 1;
    if (last < 0) return 0;
    const t = Math.max(0, Math.min(target, last));
    if (t <= state.maxUnlocked) return t;
    if (t === state.maxUnlocked + 1) {
        const frontier = state.cards[state.maxUnlocked];
        if (frontier && canAdvanceFrom(state, frontier.id)) return t;
    }
    return state.index;
}

/**
 * Deterministic flow transitions.
 * - VIEW/GOTO move only through authorizeStepIndex: dragging toward the
 *   next card never unlocks an unanswered required card.
 * - PASS completes the proof card.
 * - PARTIAL/FAIL with retries left insert one real-explanation support card
 *   and keep the card open for retry; with budget exhausted (or no support
 *   content) the card completes truthfully with its actual outcome.
 * - UNKNOWN/SKIPPED complete without evidence (skip must not trap the user;
 *   evaluation treats them as non-rewarding).
 */
export function flowTransition(state: FlowState, event: FlowEvent, maxRetries: number): FlowState {
    switch (event.type) {
        case 'VIEW': {
            const idx = state.cards.findIndex(c => c.id === event.id);
            if (idx < 0) return state;
            const at = authorizeStepIndex(state, idx);
            return { ...state, index: at, maxUnlocked: Math.max(state.maxUnlocked, at) };
        }
        case 'GOTO': {
            const at = authorizeStepIndex(state, event.index);
            return { ...state, index: at, maxUnlocked: Math.max(state.maxUnlocked, at) };
        }
        case 'ANSWER': {
            const idx = state.cards.findIndex(c => c.id === event.id);
            if (idx < 0) return state;
            const card = state.cards[idx];
            const prev = statusOf(state, event.id);
            const attempts = prev.attempts + 1;
            const done = (outcome: StepOutcome) => ({
                ...state,
                status: { ...state.status, [event.id]: { completed: true, outcome, attempts } },
                maxUnlocked: Math.max(state.maxUnlocked, idx + 1),
            });
            if (!card.required) {
                return done(event.outcome);
            }
            if (event.outcome === 'pass') {
                return done('pass');
            }
            if (event.outcome === 'unknown' || event.outcome === 'skipped') {
                return done(event.outcome);
            }
            // PARTIAL/FAIL: retry while budget remains, else truthful final.
            if (prev.attempts >= maxRetries) {
                return done(event.outcome);
            }
            // Adaptive hook: insert one explanation card, retry stays on this card.
            const explanation = (event.explanation || card.recall?.correctAnswer || '').trim();
            if (!explanation) {
                return done(event.outcome);
            }
            const feedbackId = `${event.id}-feedback`;
            if (state.cards.some(c => c.id === feedbackId)) {
                return {
                    ...state,
                    status: { ...state.status, [event.id]: { ...prev, outcome: event.outcome, attempts } },
                };
            }
            const feedback: LearningCard = {
                id: feedbackId,
                type: 'feedback',
                phase: card.phase,
                title: 'Смотри внимательнее',
                required: false,
                order: idx + 1,
                feedback: { body: explanation, verdict: event.outcome },
            };
            const cards = [...state.cards];
            cards.splice(idx + 1, 0, feedback);
            cards.forEach((c, i) => { c.order = i; });
            return {
                ...state,
                cards,
                status: { ...state.status, [event.id]: { ...prev, outcome: event.outcome, attempts } },
                maxUnlocked: Math.max(state.maxUnlocked, idx + 1),
            };
        }
    }
}
export interface SessionResultData {
    kind: SessionKind;
    objectiveTitle: string;
    hobbyLabel: string;
    minutesFocused: number;
    stepsCompleted: number;
    answersVerified: number | null;
    taskCompleted: boolean;
    taskTitle: string | null;
    nextTitle: string | null;
}

/**
 * Result data from REAL session values only. Counts/values that do not
 * exist stay null and must be omitted by the UI — never fabricated.
 */
export function buildResultData(input: {
    kind: SessionKind;
    objectiveTitle: string;
    hobbyLabel: string;
    minutesFocused: number;
    status: Record<string, CardStatus>;
    cards: LearningCard[];
    taskCompleted: boolean;
    taskTitle?: string | null;
    nextTitle?: string | null;
}): SessionResultData {
    const interactive = input.cards.filter(c => c.type === 'recall' || c.type === 'apply' || c.type === 'challenge');
    // Verified = PASS only. Partial is weaker evidence, never "verified".
    const verified = interactive.filter(c => input.status[c.id]?.outcome === 'pass').length;
    const stepsCompleted = input.cards.filter(c => c.type !== 'result' && input.status[c.id]?.completed).length;
    return {
        kind: input.kind,
        objectiveTitle: input.objectiveTitle,
        hobbyLabel: input.hobbyLabel,
        minutesFocused: Math.max(0, Math.floor(input.minutesFocused)),
        stepsCompleted,
        answersVerified: interactive.length > 0 ? verified : null,
        taskCompleted: input.taskCompleted,
        taskTitle: input.taskTitle ?? null,
        nextTitle: input.nextTitle ?? null,
    };
}
