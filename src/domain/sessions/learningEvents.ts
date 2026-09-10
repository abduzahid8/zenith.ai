import { getProgramForHobby } from '../credentials/catalog';
import type { SessionKind, SessionOrigin, SessionPhase } from './sessionBlueprint';
import { evidenceValueOf } from './outcomePolicy';
import type { MasteryOutcome } from './outcomePolicy';

/**
 * Canonical learning events — append-only history of what really happened.
 * Schema v1. Raw user answers NEVER live here (see artifactRef); outcome
 * metadata does. Phase 3B will project Skill State from this history.
 */

export const LEARNING_EVENT_SCHEMA_VERSION = 1 as const;

export type EvidenceSource =
    | 'daily_task'
    | 'structured_session'
    | 'quick_bite'
    | 'knowledge_check'
    | 'discovery'
    | 'final_assessment'
    | 'project';

export type LearningEventType =
    | 'concept_exposed'
    | 'attempt'
    | 'session_completed'
    | 'task_completed';

export type EvidenceStrength = 'none' | 'weak' | 'medium' | 'strong' | 'summative';

export interface LearningEvent {
    schemaVersion: typeof LEARNING_EVENT_SCHEMA_VERSION;
    /** Deterministic: sessionId:eventType:cardId:attemptNo (or session/task variant). */
    id: string;
    sessionId: string;
    userId?: string;
    hobbyId: string;
    programSlug?: string;
    lessonId?: string;
    curriculumDay?: number;
    skillKey?: string | null;
    taskId?: string;
    cardId?: string;
    attemptNo?: number;
    phase?: SessionPhase;
    sessionKind: SessionKind;
    origin?: SessionOrigin;
    source: EvidenceSource;
    eventType: LearningEventType;
    outcome?: MasteryOutcome;
    /** Mastery weight of the outcome (pass 1.0, partial 0.5, else 0). */
    outcomeValue?: number;
    evidenceStrength: EvidenceStrength;
    /** Artifact id in the artifact system — never raw answer text. */
    artifactRef?: string;
    occurredAt: string;
}

/** Deterministic idempotent event id. Retries are NEW attempts (new ids). */
export function buildEventId(
    sessionId: string,
    eventType: LearningEventType,
    cardId?: string | null,
    attemptNo?: number | null,
): string {
    const parts = [sessionId, eventType, cardId ?? '-', attemptNo ?? 0];
    return parts.join(':');
}

export type InteractiveCardKind = 'recall' | 'apply' | 'challenge';

/**
 * Canonical strength mapping. Discovery is always none; review bites are
 * weak formative; structured apply beats recall; challenges are strong.
 * Assessment/project map to summative for future emitters.
 */
export function strengthFor(sessionKind: SessionKind, cardKind: InteractiveCardKind | 'exposure'): EvidenceStrength {
    if (sessionKind === 'discovery') return 'none';
    if (sessionKind === 'certificate_review') return 'weak';
    if (sessionKind === 'assessment' || sessionKind === 'final_assessment' || sessionKind === 'project') {
        return 'summative';
    }
    if (cardKind === 'exposure') return 'none';
    if (cardKind === 'recall') return 'weak';
    if (cardKind === 'apply') return 'medium';
    return 'strong';
}

/** Source mapping per session kind (assessment/project reserved for later). */
export function sourceFor(sessionKind: SessionKind): EvidenceSource {
    if (sessionKind === 'certificate_review') return 'quick_bite';
    if (sessionKind === 'discovery') return 'discovery';
    if (sessionKind === 'assessment' || sessionKind === 'final_assessment') return 'final_assessment';
    if (sessionKind === 'project') return 'project';
    return 'structured_session';
}

export interface LearningTarget {
    programSlug?: string;
    curriculumDay?: number;
    skillKey?: string | null;
}

/**
 * Stable target mapping — never from display text. lessonDay comes from the
 * bank (lesson.day); skill resolves through the program's real day ranges.
 * Unknown hobby/day yields null skillKey (honest, never invented).
 */
export function mapLearningTarget(hobbyId: string, lessonDay?: number | null): LearningTarget {
    const program = getProgramForHobby(hobbyId);
    if (!program) return {};
    const target: LearningTarget = { programSlug: program.slug };
    if (typeof lessonDay === 'number' && Number.isFinite(lessonDay)) {
        target.curriculumDay = lessonDay;
        target.skillKey = program.skills.find(s => lessonDay >= s.dayRange[0] && lessonDay <= s.dayRange[1])?.key ?? null;
    }
    return target;
}

export interface AttemptEventInput {
    sessionId: string;
    userId?: string;
    hobbyId: string;
    lessonId?: string;
    lessonDay?: number | null;
    taskId?: string | null;
    cardId: string;
    attemptNo: number;
    phase?: SessionPhase;
    sessionKind: SessionKind;
    origin?: SessionOrigin;
    outcome: MasteryOutcome;
    artifactRef?: string;
    occurredAt?: string;
}

const CARD_KIND_BY_TYPE: Record<string, InteractiveCardKind> = {
    recall: 'recall',
    apply: 'apply',
    challenge: 'challenge',
};

/** Build a validated attempt event (pure, testable). */
export function buildAttemptEvent(input: AttemptEventInput & { cardType: string }): LearningEvent {
    const cardKind = CARD_KIND_BY_TYPE[input.cardType] ?? 'recall';
    const target = mapLearningTarget(input.hobbyId, input.lessonDay);
    return {
        schemaVersion: LEARNING_EVENT_SCHEMA_VERSION,
        id: buildEventId(input.sessionId, 'attempt', input.cardId, input.attemptNo),
        sessionId: input.sessionId,
        userId: input.userId,
        hobbyId: input.hobbyId,
        programSlug: target.programSlug,
        lessonId: input.lessonId,
        curriculumDay: target.curriculumDay,
        skillKey: target.skillKey,
        taskId: input.taskId ?? undefined,
        cardId: input.cardId,
        attemptNo: input.attemptNo,
        phase: input.phase,
        sessionKind: input.sessionKind,
        origin: input.origin,
        source: sourceFor(input.sessionKind),
        eventType: 'attempt',
        outcome: input.outcome,
        outcomeValue: evidenceValueOf(input.outcome),
        evidenceStrength: strengthFor(input.sessionKind, cardKind),
        artifactRef: input.artifactRef,
        occurredAt: input.occurredAt ?? new Date().toISOString(),
    };
}
