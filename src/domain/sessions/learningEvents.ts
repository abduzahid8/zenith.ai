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
    /**
     * Canonical owner scope. Authenticated events carry the user id;
     * explicitly anonymous/local events carry 'local'. Events stored before
     * owner scoping have NO ownerId and are never auto-attributed.
     */
    ownerId?: string;
    userId?: string;
    hobbyId: string;
    programSlug?: string;
    /** Catalog version pinned at emission — history stays interpretable. */
    programVersion?: string;
    lessonId?: string;
    curriculumDay?: number;
    skillKey?: string | null;
    taskId?: string;
    cardId?: string;
    attemptNo?: number;
    phase?: SessionPhase;
    sessionKind: SessionKind;
    origin?: SessionOrigin;
    /**
     * Recommendation execution context (reason codes only, never UI text):
     * which strategy built this session and why. Enables later analysis of
     * recommendation -> session -> outcome without an analytics subsystem.
     */
    strategy?: string;
    reasonCode?: string;
    source: EvidenceSource;
    eventType: LearningEventType;
    outcome?: MasteryOutcome;
    /** Mastery weight of the outcome (pass 1.0, partial 0.5, else 0). */
    outcomeValue?: number;
    evidenceStrength: EvidenceStrength;
    /**
     * Validation content provenance. Static curated challenges stay strong;
     * generated/unverified validation never becomes strong silently.
     * Only set on challenge attempts; other events omit it.
     */
    provenance?: 'static_bank' | 'generated_unverified';
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
    programVersion?: string;
    curriculumDay?: number;
    skillKey?: string | null;
}

/**
 * Stable target mapping — never from display text. lessonDay comes from the
 * bank (lesson.day); skill resolves through the program's real day ranges.
 * Unknown hobby/day yields null skillKey (honest, never invented).
 * programVersion is pinned from the CURRENT catalog at emission time so the
 * event stays interpretable after later catalog changes.
 */
export function mapLearningTarget(hobbyId: string, lessonDay?: number | null): LearningTarget {
    const program = getProgramForHobby(hobbyId);
    if (!program) return {};
    const target: LearningTarget = { programSlug: program.slug, programVersion: program.version };
    if (typeof lessonDay === 'number' && Number.isFinite(lessonDay)) {
        target.curriculumDay = lessonDay;
        target.skillKey = program.skills.find(s => lessonDay >= s.dayRange[0] && lessonDay <= s.dayRange[1])?.key ?? null;
    }
    return target;
}

/** Explicit anonymous owner when no authenticated user exists. */
export const ANONYMOUS_OWNER = 'local' as const;

export function ownerFor(userId?: string | null): string {
    return userId ?? ANONYMOUS_OWNER;
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
    /**
     * Factual validation provenance from the loader. Challenge attempts
     * WITHOUT it are treated as generated_unverified (conservative) —
     * never silently strong. Non-challenge attempts omit it.
     */
    provenance?: 'static_bank' | 'generated_unverified';
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
    // Content provenance comes from the actual loader path, never from day
    // heuristics. Unverified validation must NOT become strong silently:
    // only explicitly static_bank challenges stay strong.
    const provenance: 'static_bank' | 'generated_unverified' | undefined =
        cardKind === 'challenge' ? (input.provenance ?? 'generated_unverified') : undefined;
    const baseStrength = strengthFor(input.sessionKind, cardKind);
    const evidenceStrength =
        cardKind === 'challenge' && provenance === 'generated_unverified' ? 'medium' : baseStrength;
    return {
        schemaVersion: LEARNING_EVENT_SCHEMA_VERSION,
        id: buildEventId(input.sessionId, 'attempt', input.cardId, input.attemptNo),
        sessionId: input.sessionId,
        ownerId: ownerFor(input.userId),
        userId: input.userId,
        hobbyId: input.hobbyId,
        programSlug: target.programSlug,
        programVersion: target.programVersion,
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
        evidenceStrength,
        provenance,
        artifactRef: input.artifactRef,
        occurredAt: input.occurredAt ?? new Date().toISOString(),
    };
}

export interface ExposureEventInput {
    sessionId: string;
    userId?: string;
    hobbyId: string;
    lessonId?: string;
    lessonDay?: number | null;
    taskId?: string | null;
    cardId: string;
    phase?: SessionPhase;
    sessionKind: SessionKind;
    origin?: SessionOrigin;
    occurredAt?: string;
}

/** Concept exposure carries identity + targets, never mastery strength. */
export function buildExposureEvent(input: ExposureEventInput): LearningEvent {
    const target = mapLearningTarget(input.hobbyId, input.lessonDay);
    return {
        schemaVersion: LEARNING_EVENT_SCHEMA_VERSION,
        id: buildEventId(input.sessionId, 'concept_exposed', input.cardId, 0),
        sessionId: input.sessionId,
        ownerId: ownerFor(input.userId),
        userId: input.userId,
        hobbyId: input.hobbyId,
        programSlug: target.programSlug,
        programVersion: target.programVersion,
        lessonId: input.lessonId,
        curriculumDay: target.curriculumDay,
        skillKey: target.skillKey,
        taskId: input.taskId ?? undefined,
        cardId: input.cardId,
        attemptNo: 0,
        phase: input.phase,
        sessionKind: input.sessionKind,
        origin: input.origin,
        source: sourceFor(input.sessionKind),
        eventType: 'concept_exposed',
        evidenceStrength: 'none',
        occurredAt: input.occurredAt ?? new Date().toISOString(),
    };
}

export interface CompletionEventInput {
    sessionId: string;
    userId?: string;
    hobbyId: string;
    lessonId?: string;
    lessonDay?: number | null;
    /** Explicit recommendation-time skill: preferred over re-derivation. */
    explicitSkillKey?: string | null;
    taskId?: string | null;
    sessionKind: SessionKind;
    origin?: SessionOrigin;
    strategy?: string;
    reasonCode?: string | null;
    occurredAt?: string;
}

function resolvedSkillKey(target: LearningTarget, explicit?: string | null): string | null | undefined {
    if (explicit && explicit.length > 0) return explicit;
    return target.skillKey;
}

/** Session-completed event: final evaluation, no mastery strength itself. */
export function buildSessionCompletedEvent(
    input: CompletionEventInput & { outcome: MasteryOutcome; outcomeValue: number },
): LearningEvent {
    const target = mapLearningTarget(input.hobbyId, input.lessonDay);
    return {
        schemaVersion: LEARNING_EVENT_SCHEMA_VERSION,
        id: buildEventId(input.sessionId, 'session_completed', null, 0),
        sessionId: input.sessionId,
        ownerId: ownerFor(input.userId),
        userId: input.userId,
        hobbyId: input.hobbyId,
        programSlug: target.programSlug,
        programVersion: target.programVersion,
        lessonId: input.lessonId,
        curriculumDay: target.curriculumDay,
        skillKey: resolvedSkillKey(target, input.explicitSkillKey),
        taskId: input.taskId ?? undefined,
        sessionKind: input.sessionKind,
        origin: input.origin,
        strategy: input.strategy,
        reasonCode: input.reasonCode ?? undefined,
        source: sourceFor(input.sessionKind),
        eventType: 'session_completed',
        outcome: input.outcome,
        outcomeValue: input.outcomeValue,
        evidenceStrength: 'none',
        occurredAt: input.occurredAt ?? new Date().toISOString(),
    };
}

/** DailyPlan task-completed event: medium evidence of real completion. */
export function buildTaskCompletedEvent(
    input: CompletionEventInput & { outcome: 'pass' | 'partial' },
): LearningEvent {
    const target = mapLearningTarget(input.hobbyId, input.lessonDay);
    return {
        schemaVersion: LEARNING_EVENT_SCHEMA_VERSION,
        id: `${input.sessionId}:task_completed:${input.taskId ?? 'unknown'}:0`,
        sessionId: input.sessionId,
        ownerId: ownerFor(input.userId),
        userId: input.userId,
        hobbyId: input.hobbyId,
        programSlug: target.programSlug,
        programVersion: target.programVersion,
        lessonId: input.lessonId,
        curriculumDay: target.curriculumDay,
        skillKey: resolvedSkillKey(target, input.explicitSkillKey),
        taskId: input.taskId ?? undefined,
        sessionKind: input.sessionKind,
        origin: input.origin,
        strategy: input.strategy,
        reasonCode: input.reasonCode ?? undefined,
        source: 'daily_task',
        eventType: 'task_completed',
        outcome: input.outcome,
        outcomeValue: input.outcome === 'pass' ? 1 : 0.5,
        evidenceStrength: 'medium',
        occurredAt: input.occurredAt ?? new Date().toISOString(),
    };
}
