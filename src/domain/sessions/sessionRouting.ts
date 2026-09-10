import type { SessionKind, SessionOrigin } from './sessionBlueprint';
import type { LearningRecommendation } from './nextBestAction';
import type { LearningStrategy, ProgressionScope } from './sessionIntent';

export interface SessionRouteParams {
    minutes?: number | null;
    taskId?: string | null;
    discoveryId?: string | null;
    origin: SessionOrigin;
    kind: SessionKind;
    skillDay?: number | null;
    scope?: ProgressionScope;
    strategy?: LearningStrategy;
    reasonCode?: string | null;
}

/**
 * One shared session route builder — every entry point (Home, Your Day,
 * Quick Session, Credential, Coach) addresses the SAME swipe session.
 * No screen invents its own session URL shape. Scope/strategy/reasonCode
 * preserve the recommendation execution contract across navigation.
 */
export function buildSessionRoute(p: SessionRouteParams): string {
    const q: string[] = [];
    q.push(`minutes=${Math.max(1, Math.floor(p.minutes ?? 15))}`);
    if (p.taskId) q.push(`taskId=${p.taskId}`);
    if (p.discoveryId) q.push(`discoveryId=${p.discoveryId}`);
    q.push(`kind=${p.kind}`);
    q.push(`origin=${p.origin}`);
    if (p.skillDay != null) q.push(`skillDay=${p.skillDay}`);
    if (p.scope) q.push(`scope=${p.scope}`);
    if (p.strategy) q.push(`strategy=${p.strategy}`);
    if (p.reasonCode) q.push(`reason=${p.reasonCode}`);
    return `/session-timer?${q.join('&')}`;
}

interface TaskLike {
    id?: string | null;
    duration_minutes?: number | null;
}

/** Your Day / Home tap: real task ID, real duration, curriculum scope. */
export function sessionRouteForTask(
    task: TaskLike,
    origin: SessionOrigin,
    strategy: LearningStrategy = 'continue_curriculum',
): string {
    const minutes = task.duration_minutes && task.duration_minutes > 0 ? task.duration_minutes : 15;
    return buildSessionRoute({ minutes, taskId: task.id ?? null, kind: 'structured', origin, scope: 'curriculum', strategy });
}

/** Recommended practice bite: review-only, targeted at the encountered day. */
export function quickPracticeRoute(
    minutes: number,
    skillDay: number,
    strategy: LearningStrategy = 'practice_application',
): string {
    return buildSessionRoute({ minutes, kind: 'certificate_review', origin: 'quick_session', skillDay, scope: 'none', strategy });
}

/**
 * Targeted proof: structured evidence semantics on the encountered day
 * WITHOUT moving the frontier or an unrelated task.
 */
export function targetedProofRoute(
    minutes: number,
    skillDay: number,
    origin: SessionOrigin,
    reasonCode?: string | null,
): string {
    return buildSessionRoute({ minutes, kind: 'structured', origin, skillDay, scope: 'targeted', strategy: 'prove_skill', reasonCode: reasonCode ?? null });
}

/** Discovery: weightless micro-topic, never touches certification. */
export function discoveryRoute(minutes: number, discoveryId: string): string {
    return buildSessionRoute({ minutes, discoveryId, kind: 'discovery', origin: 'quick_session', scope: 'none', strategy: 'continue_curriculum' });
}

/**
 * Route adapter for LearningRecommendation — every recommendation type maps
 * to a REAL existing route. Repair/practice/review become review-only bites
 * on the encountered day; prove becomes a targeted structured session on
 * that day; continue follows the real DailyPlan task. Nothing is fabricated.
 */
export function routeForRecommendation(
    rec: LearningRecommendation,
    origin: SessionOrigin,
): string {
    if (
        rec.type === 'repair_recall' ||
        rec.type === 'practice_application' ||
        rec.type === 'review_skill'
    ) {
        // Encountered day is guaranteed by the engine for these types.
        return quickPracticeRoute(rec.minutes, rec.curriculumDay ?? 1, rec.type);
    }
    if (rec.type === 'prove_skill') {
        return targetedProofRoute(rec.minutes, rec.curriculumDay ?? 1, origin, rec.reasonCode);
    }
    if (rec.taskId) {
        return sessionRouteForTask({ id: rec.taskId, duration_minutes: rec.minutes }, origin);
    }
    return buildSessionRoute({ minutes: rec.minutes, kind: 'structured', origin, scope: 'curriculum', strategy: 'continue_curriculum' });
}
