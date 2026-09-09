import type { SessionKind, SessionOrigin } from './sessionBlueprint';

export interface SessionRouteParams {
    minutes?: number | null;
    taskId?: string | null;
    discoveryId?: string | null;
    origin: SessionOrigin;
    kind: SessionKind;
    skillDay?: number | null;
}

/**
 * One shared session route builder — every entry point (Home, Your Day,
 * Quick Session, Credential, Coach) addresses the SAME swipe session.
 * No screen invents its own session URL shape.
 */
export function buildSessionRoute(p: SessionRouteParams): string {
    const q: string[] = [];
    q.push(`minutes=${Math.max(1, Math.floor(p.minutes ?? 15))}`);
    if (p.taskId) q.push(`taskId=${p.taskId}`);
    if (p.discoveryId) q.push(`discoveryId=${p.discoveryId}`);
    q.push(`kind=${p.kind}`);
    q.push(`origin=${p.origin}`);
    if (p.skillDay != null) q.push(`skillDay=${p.skillDay}`);
    return `/session-timer?${q.join('&')}`;
}

interface TaskLike {
    id?: string | null;
    duration_minutes?: number | null;
}

/** Your Day / Home tap: real task ID, real duration, structured kind. */
export function sessionRouteForTask(task: TaskLike, origin: SessionOrigin): string {
    const minutes = task.duration_minutes && task.duration_minutes > 0 ? task.duration_minutes : 15;
    return buildSessionRoute({ minutes, taskId: task.id ?? null, kind: 'structured', origin });
}

/** Credential / Quick recommended practice: review-only weak-skill bite. */
export function quickPracticeRoute(minutes: number, skillDay: number): string {
    return buildSessionRoute({ minutes, kind: 'certificate_review', origin: 'quick_session', skillDay });
}

/** Discovery: weightless micro-topic, never touches certification. */
export function discoveryRoute(minutes: number, discoveryId: string): string {
    return buildSessionRoute({ minutes, discoveryId, kind: 'discovery', origin: 'quick_session' });
}
