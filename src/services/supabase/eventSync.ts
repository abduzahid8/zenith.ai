import { getSupabase } from './client';
import type { LearningEvent } from '../../domain/sessions/learningEvents';
import type { SyncTransport } from '../learningEventSync';

/**
 * Supabase transport for the learning-event sync queue.
 *
 * Maps the frozen client LearningEvent to the canonical learning_events
 * row and calls the idempotent upsert_learning_event RPC. NEVER sends
 * user_id: ownership is derived server-side from auth.uid() via trigger.
 * client_owner carries the queue's ownership assertion (uid string for
 * owned events, null for legacy unattributed rows).
 */
function toRow(event: LearningEvent, clientOwner: string | null): Record<string, unknown> {
    return {
        id: event.id,
        schema_version: event.schemaVersion,
        client_owner: clientOwner,
        session_id: event.sessionId,
        hobby_id: event.hobbyId,
        program_slug: event.programSlug ?? null,
        program_version: event.programVersion ?? null,
        lesson_id: event.lessonId ?? null,
        curriculum_day: event.curriculumDay ?? null,
        skill_key: event.skillKey ?? null,
        task_id: event.taskId ?? null,
        card_id: event.cardId ?? null,
        attempt_no: event.attemptNo ?? null,
        phase: event.phase ?? null,
        session_kind: event.sessionKind,
        origin: event.origin ?? null,
        scope: event.scope ?? null,
        strategy: event.strategy ?? null,
        reason_code: event.reasonCode ?? null,
        lesson_source: event.lessonSource ?? null,
        source: event.source,
        event_type: event.eventType,
        outcome: event.outcome ?? null,
        outcome_value: event.outcomeValue ?? null,
        evidence_strength: event.evidenceStrength,
        provenance: event.provenance ?? null,
        artifact_ref: event.artifactRef ?? null,
        occurred_at: event.occurredAt,
    };
}

export const supabaseEventTransport: SyncTransport = {
    async upload(event, clientOwner) {
        try {
            const supabase = getSupabase();
            const { error } = await supabase.rpc('upsert_learning_event', {
                p_event: toRow(event, clientOwner),
            });
            if (error) return 'retry';
            return 'ok';
        } catch {
            return 'retry';
        }
    },
};
