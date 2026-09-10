-- =====================================================
-- 011 — Server trust layer: canonical learning_events
--
-- Persists the FROZEN client LearningEvent semantics (see
-- src/domain/sessions/learningEvents.ts) 1:1. No second evidence model.
-- The deterministic client event id is the PRIMARY KEY, so retries are
-- safe: same event submitted twice = one server row.
--
-- Ownership is DERIVED server-side (auth.uid), never trusted from the
-- client claim:
--   client_owner = auth.uid()  -> user_id := auth.uid() (owned row)
--   anything else              -> user_id := NULL (legacy/unattributed,
--                                 NEVER silently attributed to the caller)
-- Trust is DERIVED server-side too: only server-approved validation
-- provenance on registry-listed content becomes trusted=true.
-- generated_unverified can NEVER become trusted by client assertion.
-- Mirrors src/server/trust.ts isTrustedValidation.
-- =====================================================

CREATE TABLE IF NOT EXISTS learning_events (
    id TEXT PRIMARY KEY,
    schema_version INTEGER NOT NULL DEFAULT 1,
    user_id UUID NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    client_owner TEXT NULL,
    session_id TEXT NOT NULL,
    hobby_id TEXT NOT NULL,
    program_slug TEXT NULL,
    program_version TEXT NULL,
    lesson_id TEXT NULL,
    curriculum_day INTEGER NULL,
    skill_key TEXT NULL,
    task_id TEXT NULL,
    card_id TEXT NULL,
    attempt_no INTEGER NULL,
    phase TEXT NULL,
    session_kind TEXT NOT NULL,
    origin TEXT NULL,
    scope TEXT NULL,
    strategy TEXT NULL,
    reason_code TEXT NULL,
    lesson_source TEXT NULL,
    source TEXT NOT NULL,
    event_type TEXT NOT NULL,
    outcome TEXT NULL,
    outcome_value DOUBLE PRECISION NULL,
    evidence_strength TEXT NOT NULL,
    provenance TEXT NULL,
    artifact_ref TEXT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    trusted BOOLEAN NOT NULL DEFAULT FALSE
);

-- Server-approved validation content: curated static lessons whose tests
-- were verified against the frozen runtime capability contract
-- (lessonCapabilities known+hasTests). Seeded set below is the full
-- verified set as of this migration: chess days 1-7. Python/reading static
-- lessons carry no valid tests (free_text/practice only) and therefore
-- MUST NOT appear here. Generated content must NEVER be inserted here by
-- clients (no client write policies); future validated pipelines insert
-- via service role only.
CREATE TABLE IF NOT EXISTS trusted_validation_registry (
    hobby_id TEXT NOT NULL,
    curriculum_day INTEGER NOT NULL,
    lesson_id TEXT NOT NULL,
    provenance TEXT NOT NULL DEFAULT 'static_bank',
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (hobby_id, curriculum_day)
);

INSERT INTO trusted_validation_registry (hobby_id, curriculum_day, lesson_id, provenance)
VALUES
    ('chess', 1, 'chess_d1', 'static_bank'),
    ('chess', 2, 'chess_d2', 'static_bank'),
    ('chess', 3, 'chess_d3', 'static_bank'),
    ('chess', 4, 'chess_d4', 'static_bank'),
    ('chess', 5, 'chess_d5', 'static_bank'),
    ('chess', 6, 'chess_d6', 'static_bank'),
    ('chess', 7, 'chess_d7', 'static_bank')
ON CONFLICT (hobby_id, curriculum_day) DO NOTHING;

-- Ownership + trust derivation. Runs on every client insert; server
-- functions opt out via app.trusted_server (they set columns explicitly).
CREATE OR REPLACE FUNCTION learning_events_derive_ownership()
RETURNS TRIGGER AS $$
BEGIN
    IF current_setting('app.trusted_server', TRUE) = 'on' THEN
        RETURN NEW;
    END IF;
    IF NEW.client_owner IS NOT NULL AND NEW.client_owner = auth.uid()::text THEN
        NEW.user_id := auth.uid();
    ELSE
        -- Legacy / ownerless / mismatched claims stay unattributed.
        -- They are preserved (no event loss) but never feed trust.
        NEW.user_id := NULL;
    END IF;
    NEW.created_at := NOW();
    -- Discovery is zero certification authority and quick bites are weak
    -- formative only: only structured-session validation can be proof-grade.
    NEW.trusted := (
        NEW.event_type = 'attempt'
        AND NEW.session_kind = 'structured'
        AND NEW.phase = 'validate'
        AND NEW.outcome = 'pass'
        AND NEW.program_version IS NOT NULL
        AND NEW.provenance IN ('static_bank', 'generated_validated')
        AND EXISTS (
            SELECT 1 FROM trusted_validation_registry r
            WHERE r.hobby_id = NEW.hobby_id
              AND r.curriculum_day = NEW.curriculum_day
        )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS learning_events_derive_ownership ON learning_events;
CREATE TRIGGER learning_events_derive_ownership
    BEFORE INSERT ON learning_events
    FOR EACH ROW EXECUTE FUNCTION learning_events_derive_ownership();

ALTER TABLE learning_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE trusted_validation_registry ENABLE ROW LEVEL SECURITY;

-- Clients read their OWN rows only. Legacy unattributed rows (user_id NULL)
-- are invisible to every client role: continuity lives on-device, trust
-- lives in owned rows.
DROP POLICY IF EXISTS "users read own learning events" ON learning_events;
CREATE POLICY "users read own learning events"
    ON learning_events FOR SELECT
    USING (user_id = auth.uid());

-- Authenticated clients may insert; ownership/trust are derived by the
-- trigger, so a client can never insert on behalf of another user.
DROP POLICY IF EXISTS "users insert learning events" ON learning_events;
CREATE POLICY "users insert learning events"
    ON learning_events FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- No UPDATE / DELETE policies: the event log is append-only for clients.
-- Corrections are new events, never mutations.

-- Registry: readable so clients can explain proof readiness; writable by
-- service role only (no client insert/update/delete policies).
DROP POLICY IF EXISTS "registry readable by all" ON trusted_validation_registry;
CREATE POLICY "registry readable by all"
    ON trusted_validation_registry FOR SELECT
    USING (true);

-- Idempotent ingest: same deterministic id twice = one row, no error.
-- Ownership still derived by trigger; returns whether the row was new.
CREATE OR REPLACE FUNCTION upsert_learning_event(p_event JSONB)
RETURNS TABLE (inserted BOOLEAN) AS $$
DECLARE
    v_id TEXT := p_event ->> 'id';
BEGIN
    IF v_id IS NULL OR v_id = '' THEN
        RAISE EXCEPTION 'upsert_learning_event: missing event id';
    END IF;
    INSERT INTO learning_events (
        id, schema_version, client_owner, session_id, hobby_id,
        program_slug, program_version, lesson_id, curriculum_day,
        skill_key, task_id, card_id, attempt_no, phase, session_kind,
        origin, scope, strategy, reason_code, lesson_source, source,
        event_type, outcome, outcome_value, evidence_strength,
        provenance, artifact_ref, occurred_at
    ) VALUES (
        v_id,
        COALESCE((p_event ->> 'schema_version')::int, 1),
        p_event ->> 'client_owner',
        p_event ->> 'session_id',
        p_event ->> 'hobby_id',
        p_event ->> 'program_slug',
        p_event ->> 'program_version',
        p_event ->> 'lesson_id',
        (p_event ->> 'curriculum_day')::int,
        p_event ->> 'skill_key',
        p_event ->> 'task_id',
        p_event ->> 'card_id',
        (p_event ->> 'attempt_no')::int,
        p_event ->> 'phase',
        p_event ->> 'session_kind',
        p_event ->> 'origin',
        p_event ->> 'scope',
        p_event ->> 'strategy',
        p_event ->> 'reason_code',
        p_event ->> 'lesson_source',
        p_event ->> 'source',
        p_event ->> 'event_type',
        p_event ->> 'outcome',
        (p_event ->> 'outcome_value')::double precision,
        p_event ->> 'evidence_strength',
        p_event ->> 'provenance',
        p_event ->> 'artifact_ref',
        (p_event ->> 'occurred_at')::timestamptz
    )
    ON CONFLICT (id) DO NOTHING;
    IF FOUND THEN
        RETURN QUERY SELECT TRUE;
    ELSE
        RETURN QUERY SELECT FALSE;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION upsert_learning_event(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION upsert_learning_event(JSONB) TO authenticated;
