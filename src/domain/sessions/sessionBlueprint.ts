import { TaskType } from '../../services/supabase/types';

/**
 * Session blueprint — one Learning Objective per session, time-scaled phases.
 *
 * Every session exists to prove a single objective:
 *   Understand → Recall → Apply → Validate → (Improve) → Complete
 *   i.e. Learn → Try → Check → Improve → Prove.
 *
 * The available minutes decide which phases run AND what counts:
 * - micro (<=10):  understand + recall → review-only, never full completion
 * - standard:      + apply → full completion on attempt
 * - deep (>=30):   + validate UI when the lesson has tests, strict grading
 * - mastery (>=45): deep + retry budget for failed work
 *
 * Rewards (day advancement, session count, target-task credit) are granted
 * only for validated outcomes — never for failed or skipped work.
 */

export type SessionPhase = 'understand' | 'recall' | 'apply' | 'validate' | 'complete';

/** Rendered step ids (superset of phases — validate may reuse apply grading). */
export type SessionStepId = 'learn' | 'recall' | 'do' | 'tests' | 'deepen1' | 'deepen2' | 'complete';

export type StepOutcome = 'pass' | 'partial' | 'fail' | 'unknown' | 'skipped';

export interface SessionBlueprint {
    /** Single learning objective the whole session must prove. */
    learningObjective: string;
    /** Ordered phases, always starting with understand, ending with complete. */
    phases: SessionPhase[];
    /** Micro sessions are review-only: no day advance, no task credit. */
    countsAsFullCompletion: boolean;
    /** Deep sessions grade strictly (validate phase present). */
    requiresValidation: boolean;
    /** Retry budget for failed apply/validate work (Improve loop). */
    maxRetries: number;
    timeboxMinutes: number;
}

export interface BlueprintInput {
    minutes: number;
    taskTitle?: string | null;
    taskType?: TaskType | null;
    lessonTitle?: string | null;
    hasTests?: boolean;
    /**
     * Review lock: run the time-scaled phases but never grant progression
     * (skill-targeted review bites revisit old material instead of
     * advancing the frontier).
     */
    reviewOnly?: boolean;
    t?: (key: string) => string;
}

const MICRO_MAX = 10;
const STANDARD_MAX = 20;
const DEEP_MAX = 44;

export function buildSessionBlueprint(input: BlueprintInput): SessionBlueprint {
    const { taskTitle, lessonTitle } = input;
    const minutes = Math.max(1, Math.floor(input.minutes || 30));
    const learningObjective = (taskTitle || lessonTitle || '').trim();
    const lockReview = input.reviewOnly === true;

    if (minutes <= MICRO_MAX) {
        return {
            learningObjective,
            phases: ['understand', 'recall', 'complete'],
            countsAsFullCompletion: false,
            requiresValidation: false,
            maxRetries: 0,
            timeboxMinutes: minutes,
        };
    }
    if (minutes <= STANDARD_MAX) {
        return {
            learningObjective,
            phases: ['understand', 'recall', 'apply', 'complete'],
            countsAsFullCompletion: !lockReview,
            requiresValidation: false,
            maxRetries: 0,
            timeboxMinutes: minutes,
        };
    }
    const phases: SessionPhase[] = ['understand', 'recall', 'apply'];
    if (input.hasTests) phases.push('validate');
    phases.push('complete');
    return {
        learningObjective,
        phases,
        countsAsFullCompletion: !lockReview,
        requiresValidation: input.hasTests === true && !lockReview,
        maxRetries: minutes > DEEP_MAX ? 2 : 1,
        timeboxMinutes: minutes,
    };
}

/**
 * Parse the machine-readable verdict the AI grader is instructed to put
 * first in its feedback (👍 correct / 🤔 partial / ❌ wrong).
 * Also understands the explicit `[verdict:X]` prefix that session code
 * prepends when persisting artifacts — so stored evidence keeps its
 * verdict even when the emoji is missing or buried in text.
 * Unknown covers offline fallbacks and free-form answers.
 */
export function parseVerdict(feedback: string | null | undefined): StepOutcome {
    if (!feedback) return 'unknown';
    const tagged = feedback.match(/^\s*\[verdict:(pass|partial|fail|skipped|unknown)\]/i);
    if (tagged) return tagged[1].toLowerCase() as StepOutcome;
    const trimmed = feedback.trimStart();
    if (trimmed.startsWith('👍')) return 'pass';
    if (trimmed.startsWith('🤔')) return 'partial';
    if (trimmed.startsWith('❌')) return 'fail';
    return 'unknown';
}

/** Where a session was started — drives completion return routing, never the engine. */
export type SessionOrigin =
    | 'home_start'
    | 'your_day'
    | 'quick_session'
    | 'certification_milestone';

export function normalizeOrigin(raw: unknown): SessionOrigin {
    const known: SessionOrigin[] = ['home_start', 'your_day', 'quick_session', 'certification_milestone'];
    if (typeof raw === 'string' && (known as string[]).includes(raw)) return raw as SessionOrigin;
    // Back-compat with the previous vocabulary (migrated call sites, deep links).
    if (raw === 'main') return 'home_start';
    if (raw === 'daily_task') return 'your_day';
    if (raw === 'quick_path' || raw === 'quick_discovery') return 'quick_session';
    if (raw === 'assessment' || raw === 'project') return 'certification_milestone';
    return 'home_start';
}

/** Completion exit per origin: daily work returns to Your Day, quick to Home. */
export function resolveExitRoute(origin: SessionOrigin): string {
    if (origin === 'your_day') return '/(app)/weekly-plan';
    return '/(app)/';
}

/**
 * WHAT the session is — the only thing completion behavior may depend on.
 * Structured sessions prove DailyPlan tasks; discovery is always review-only;
 * final_assessment/project are owned by the credential flows.
 */
export type SessionKind = 'structured' | 'discovery' | 'final_assessment' | 'project';

export function normalizeKind(raw: unknown, fallback: SessionKind = 'structured'): SessionKind {
    const known: SessionKind[] = ['structured', 'discovery', 'final_assessment', 'project'];
    return typeof raw === 'string' && (known as string[]).includes(raw) ? (raw as SessionKind) : fallback;
}

export interface SessionContext {
    kind: SessionKind;
    origin: SessionOrigin;
    taskId?: string | null;
    discoveryId?: string | null;
    learningPathId?: string | null;
    skillId?: string | null;
    topicId?: string | null;
    durationMinutes?: number | null;
}

const TASK_ID_RE = /^[A-Za-z0-9_-]+$/;

/**
 * Single validated parse of session route params. Unknown values fall back
 * to safe defaults instead of breaking the session.
 */
export function parseSessionParams(raw: {
    minutes?: string | string[] | null;
    taskId?: string | string[] | null;
    discoveryId?: string | string[] | null;
    origin?: string | string[] | null;
    kind?: string | string[] | null;
    skillDay?: string | string[] | null;
}): { minutes?: number; taskId: string | null; discoveryId: string | null; skillDay: number | null; context: SessionContext } {
    const first = (v: string | string[] | null | undefined): string | null => {
        if (Array.isArray(v)) return v[0] ?? null;
        return v ?? null;
    };
    const minutesRaw = first(raw.minutes);
    const parsed = minutesRaw !== null ? parseInt(minutesRaw, 10) : NaN;
    const taskId = first(raw.taskId);
    const discoveryId = first(raw.discoveryId);
    const skillDayRaw = first(raw.skillDay);
    const skillDayParsed = skillDayRaw !== null ? parseInt(skillDayRaw, 10) : NaN;
    const kind = normalizeKind(first(raw.kind), discoveryId ? 'discovery' : 'structured');
    return {
        minutes: Number.isFinite(parsed) && parsed > 0 ? parsed : undefined,
        taskId: taskId && TASK_ID_RE.test(taskId) ? taskId : null,
        discoveryId: discoveryId && TASK_ID_RE.test(discoveryId) ? discoveryId : null,
        skillDay:
            Number.isFinite(skillDayParsed) && skillDayParsed >= 1 && skillDayParsed <= 28
                ? Math.floor(skillDayParsed)
                : null,
        context: {
            kind,
            origin: normalizeOrigin(first(raw.origin)),
            taskId: taskId && TASK_ID_RE.test(taskId) ? taskId : null,
            discoveryId: discoveryId && TASK_ID_RE.test(discoveryId) ? discoveryId : null,
            durationMinutes: Number.isFinite(parsed) && parsed > 0 ? parsed : null,
        },
    };
}

/** Outcomes that earn progression (day advance, session count, task credit). */
export function isRewardedOutcome(outcome: StepOutcome): boolean {
    return outcome === 'pass' || outcome === 'partial' || outcome === 'unknown';
}

/** A quick formative check built from any lesson — no bank content needed. */
export function buildRecallTask(t: (key: string) => string): {
    type: 'free_text';
    prompt: string;
} {
    return { type: 'free_text', prompt: t('quick_recall_prompt') };
}

const PHASE_LABEL_KEYS: Record<Exclude<SessionPhase, 'complete'>, string> = {
    understand: 'phase_understand',
    recall: 'phase_recall',
    apply: 'phase_apply',
    validate: 'phase_validate',
};

export function phaseLabelKey(phase: SessionPhase): string | null {
    if (phase === 'complete') return null;
    return PHASE_LABEL_KEYS[phase];
}
