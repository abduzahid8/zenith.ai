-- =====================================================
-- 016 — Trust hardening: client events are NEVER proof-grade.
--
-- FORWARD-ONLY remediation over 011-015 (never edits them).
--
-- Core rule change: the client sync path can NO LONGER produce
-- trusted=true. The old trigger derived trust from client-supplied
-- (session_kind, phase, outcome, provenance, program, skill, day).
-- Any authenticated client could therefore fabricate proof-grade
-- evidence by sending pass/structured/validate/static_bank. That
-- bypass ends here: normal client ingest ALWAYS stores trusted=false.
--
-- Proof-grade evidence now comes ONLY from server-scored flows:
--   submit_trusted_validation  -> server-created learning_events row
--                                 (provenance server_scored, identity
--                                 derived from the server registry item,
--                                 NEVER from client fields)
--   submit_assessment          -> final_assessment component row
--   project_certification_results (service role) -> project component
--
-- Also: assessment attempts must start server-side (start_assessment);
-- direct client INSERT of attempts is revoked; submission takes a row
-- lock and re-binds attempt <-> question set <-> program version.
-- =====================================================

-- 1. Client ingest: trusted always FALSE; server_scored unreachable. ----
CREATE OR REPLACE FUNCTION learning_events_derive_ownership()
RETURNS TRIGGER AS $$
BEGIN
    IF current_setting('app.trusted_server', TRUE) = 'on' THEN
        RETURN NEW;
    END IF;
    IF NEW.client_owner IS NOT NULL AND NEW.client_owner = auth.uid()::text THEN
        NEW.user_id := auth.uid();
    ELSE
        -- Legacy/ownerless/mismatched claims stay unattributed AND untrusted.
        NEW.user_id := NULL;
    END IF;
    NEW.created_at := NOW();
    -- CRITICAL: no client-supplied combination may create proof-grade rows.
    NEW.trusted := FALSE;
    -- Clients can never mint server-side provenance.
    IF NEW.provenance = 'server_scored' THEN
        NEW.provenance := NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Registry v2: bind full immutable content identity. ------------------
-- A claim of "chess day 1" must not be re-labelable as another program
-- or skill. The server derives program/skill identity from this table.
ALTER TABLE trusted_validation_registry
    ADD COLUMN IF NOT EXISTS program_slug TEXT,
    ADD COLUMN IF NOT EXISTS program_version TEXT NOT NULL DEFAULT '1.0',
    ADD COLUMN IF NOT EXISTS skill_key TEXT,
    ADD COLUMN IF NOT EXISTS content_version TEXT NOT NULL DEFAULT 'static-1';

-- Backfill the verified static set (chess days 1-7 = rules & basics).
UPDATE trusted_validation_registry
SET program_slug = 'chess-foundations',
    program_version = '1.0',
    skill_key = 'rules',
    content_version = 'static-1'
WHERE program_slug IS NULL;

ALTER TABLE trusted_validation_registry
    ALTER COLUMN program_slug SET NOT NULL,
    ALTER COLUMN skill_key SET NOT NULL;

DROP INDEX IF EXISTS trusted_validation_registry_program_day_uidx;
CREATE UNIQUE INDEX IF NOT EXISTS trusted_validation_registry_program_day_uidx
    ON trusted_validation_registry (program_slug, program_version, curriculum_day);

-- 3. Server-owned trusted validation content + attempts. -----------------
-- Items carry the safe payload AND the hidden key. NO client policies:
-- clients only ever see payloads returned by start_trusted_validation.
CREATE TABLE IF NOT EXISTS trusted_validation_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_slug TEXT NOT NULL,
    program_version TEXT NOT NULL DEFAULT '1.0',
    hobby_id TEXT NOT NULL,
    curriculum_day INTEGER NOT NULL,
    skill_key TEXT NOT NULL,
    lesson_id TEXT NOT NULL,
    content_version TEXT NOT NULL DEFAULT 'static-1',
    payload JSONB NOT NULL DEFAULT '{}',
    answer_key JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (program_slug, program_version, curriculum_day)
);

CREATE TABLE IF NOT EXISTS trusted_validation_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES trusted_validation_items(id) ON DELETE RESTRICT,
    program_slug TEXT NOT NULL,
    program_version TEXT NOT NULL,
    skill_key TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'submitted')),
    passed BOOLEAN NULL,
    submitted_at TIMESTAMPTZ NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE trusted_validation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE trusted_validation_attempts ENABLE ROW LEVEL SECURITY;

-- Clients may READ their own validation attempts (status/result feedback).
DROP POLICY IF EXISTS "users read own validation attempts" ON trusted_validation_attempts;
CREATE POLICY "users read own validation attempts"
    ON trusted_validation_attempts FOR SELECT USING (user_id = auth.uid());
-- No client INSERT/UPDATE/DELETE on items or attempts: server functions only.

-- Server chooses the exact trusted challenge; client receives safe payload.
CREATE OR REPLACE FUNCTION start_trusted_validation(p_program_slug TEXT, p_curriculum_day INTEGER)
RETURNS TABLE (attempt_id UUID, skill_key TEXT, program_version TEXT, payload JSONB) AS $$
DECLARE
    v_program credential_programs%ROWTYPE;
    v_item trusted_validation_items%ROWTYPE;
    v_attempt_id UUID := gen_random_uuid();
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'start_trusted_validation: authentication required';
    END IF;
    SELECT * INTO v_program FROM credential_programs
    WHERE slug = p_program_slug AND status = 'active';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'start_trusted_validation: unknown or inactive program';
    END IF;
    SELECT * INTO v_item FROM trusted_validation_items
    WHERE trusted_validation_items.program_slug = p_program_slug
      AND trusted_validation_items.program_version = v_program.version
      AND trusted_validation_items.curriculum_day = p_curriculum_day;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'start_trusted_validation: no trusted content for this program/day';
    END IF;
    PERFORM set_config('app.trusted_server', 'on', TRUE);
    INSERT INTO trusted_validation_attempts
        (id, user_id, item_id, program_slug, program_version, skill_key, status)
    VALUES
        (v_attempt_id, auth.uid(), v_item.id, v_program.slug, v_program.version, v_item.skill_key, 'started');
    RETURN QUERY SELECT v_attempt_id, v_item.skill_key, v_program.version, v_item.payload;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION start_trusted_validation(TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION start_trusted_validation(TEXT, INTEGER) TO authenticated;

-- Server scores against the hidden key; on pass it creates the
-- authoritative trusted evidence row (identity from the ITEM, never the
-- client). Concurrent submits: row lock -> exactly one winner.
CREATE OR REPLACE FUNCTION submit_trusted_validation(p_attempt_id UUID, p_answer JSONB)
RETURNS TABLE (passed BOOLEAN, submitted BOOLEAN, trusted_event_id TEXT) AS $$
DECLARE
    v_attempt trusted_validation_attempts%ROWTYPE;
    v_item trusted_validation_items%ROWTYPE;
    v_ok BOOLEAN;
    v_event_id TEXT;
BEGIN
    SELECT * INTO v_attempt FROM trusted_validation_attempts
    WHERE id = p_attempt_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'submit_trusted_validation: attempt not found';
    END IF;
    IF v_attempt.user_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'submit_trusted_validation: not the attempt owner';
    END IF;
    IF v_attempt.status = 'submitted' THEN
        RETURN QUERY
        SELECT v_attempt.passed, FALSE,
            (SELECT e.id FROM learning_events e
             WHERE e.id = 'srv:trusted:' || p_attempt_id::text || ':0');
        RETURN;
    END IF;
    SELECT * INTO v_item FROM trusted_validation_items WHERE id = v_attempt.item_id;
    v_ok := (p_answer ->> 'answer') IS NOT NULL
        AND (p_answer ->> 'answer') <> ''
        AND (p_answer ->> 'answer') = (v_item.answer_key ->> 'answer');
    PERFORM set_config('app.trusted_server', 'on', TRUE);
    UPDATE trusted_validation_attempts
    SET status = 'submitted', passed = v_ok, submitted_at = NOW()
    WHERE id = p_attempt_id;
    v_event_id := NULL;
    IF v_ok THEN
        -- Authoritative evidence: every identity field from the server item.
        v_event_id := 'srv:trusted:' || p_attempt_id::text || ':0';
        INSERT INTO learning_events (
            id, schema_version, client_owner, user_id, session_id,
            hobby_id, program_slug, program_version, lesson_id, curriculum_day,
            skill_key, card_id, attempt_no, phase, session_kind, source,
            event_type, outcome, outcome_value, evidence_strength,
            provenance, occurred_at, trusted
        ) VALUES (
            v_event_id, 1, NULL, auth.uid(), 'srv:' || p_attempt_id::text,
            v_item.hobby_id, v_item.program_slug, v_item.program_version,
            v_item.lesson_id, v_item.curriculum_day, v_item.skill_key,
            v_item.id::text, 1, 'validate', 'structured', 'structured_session',
            'attempt', 'pass', 1.0, 'strong',
            'server_scored', NOW(), TRUE
        )
        ON CONFLICT (id) DO NOTHING;
    END IF;
    RETURN QUERY SELECT v_ok, TRUE, v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION submit_trusted_validation(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION submit_trusted_validation(UUID, JSONB) TO authenticated;

-- 4. Assessment attempts start server-side. ------------------------------
DROP POLICY IF EXISTS "users start own assessment attempts" ON assessment_attempts;

CREATE OR REPLACE FUNCTION start_assessment(p_program_slug TEXT)
RETURNS TABLE (
    attempt_id UUID, attempt_number INTEGER, question_set_version TEXT,
    time_limit_minutes INTEGER, questions JSONB
) AS $$
DECLARE
    v_program credential_programs%ROWTYPE;
    v_set assessment_question_sets%ROWTYPE;
    v_num INTEGER;
    v_attempt_id UUID := gen_random_uuid();
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'start_assessment: authentication required';
    END IF;
    SELECT * INTO v_program FROM credential_programs
    WHERE slug = p_program_slug AND status = 'active';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'start_assessment: unknown or inactive program';
    END IF;
    -- Server chooses the set for EXACTLY the pinned program version.
    SELECT * INTO v_set FROM assessment_question_sets
    WHERE program_slug = p_program_slug AND version = v_program.version
    ORDER BY created_at DESC LIMIT 1;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'start_assessment: no question set for this program/version';
    END IF;
    PERFORM set_config('app.trusted_server', 'on', TRUE);
    -- Authoritative enrollment for the pinned version (required for issue).
    INSERT INTO user_credential_progress (user_id, program_slug, program_version, status)
    VALUES (auth.uid(), v_program.slug, v_program.version, 'in_assessment')
    ON CONFLICT (user_id, program_slug) DO UPDATE
        SET program_version = EXCLUDED.program_version,
            status = 'in_assessment',
            updated_at = NOW();
    SELECT COALESCE(MAX(assessment_attempts.attempt_number), 0) + 1 INTO v_num
    FROM assessment_attempts
    WHERE assessment_attempts.user_id = auth.uid() AND assessment_attempts.program_slug = p_program_slug;
    INSERT INTO assessment_attempts
        (id, user_id, program_slug, question_set_id, question_set_version,
         attempt_number, status, answers, score, passed)
    VALUES
        (v_attempt_id, auth.uid(), v_program.slug, v_set.id, v_set.version,
         v_num, 'started', NULL, NULL, NULL);
    RETURN QUERY SELECT v_attempt_id, v_num, v_set.version, v_set.time_limit_minutes, v_set.questions;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION start_assessment(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION start_assessment(TEXT) TO authenticated;

-- 5. Hardened final submission: row lock + program binding. --------------
CREATE OR REPLACE FUNCTION submit_assessment(p_attempt_id UUID, p_answers JSONB)
RETURNS TABLE (score NUMERIC, passed BOOLEAN, submitted BOOLEAN) AS $$
DECLARE
    v_attempt assessment_attempts%ROWTYPE;
    v_program credential_programs%ROWTYPE;
    v_set assessment_question_sets%ROWTYPE;
    v_key JSONB;
    v_ids JSONB;
    v_qid TEXT;
    v_correct INTEGER := 0;
    v_total INTEGER := 0;
    v_score NUMERIC;
    v_passed BOOLEAN;
BEGIN
    -- Row lock: concurrent submits serialize; exactly one finalizes.
    SELECT * INTO v_attempt FROM assessment_attempts
    WHERE id = p_attempt_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'submit_assessment: attempt not found';
    END IF;
    IF v_attempt.user_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'submit_assessment: not the attempt owner';
    END IF;
    IF v_attempt.status = 'submitted' THEN
        RETURN QUERY SELECT v_attempt.score, v_attempt.passed, FALSE;
        RETURN;
    END IF;
    -- Cross-program substitution defense: attempt, set, and pinned program
    -- version must all agree, or the submission is rejected.
    SELECT * INTO v_program FROM credential_programs
    WHERE slug = v_attempt.program_slug AND status = 'active';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'submit_assessment: unknown or inactive program';
    END IF;
    SELECT * INTO v_set FROM assessment_question_sets
    WHERE id = v_attempt.question_set_id;
    IF NOT FOUND
       OR v_set.program_slug <> v_attempt.program_slug
       OR v_set.version <> v_attempt.question_set_version
       OR v_set.version <> v_program.version THEN
        RAISE EXCEPTION 'submit_assessment: question set does not match attempt program/version';
    END IF;
    SELECT k.answers, k.question_ids INTO v_key, v_ids
    FROM assessment_answer_keys k WHERE k.question_set_id = v_attempt.question_set_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'submit_assessment: question set has no key';
    END IF;
    FOR v_qid IN SELECT jsonb_array_elements_text(v_ids) LOOP
        v_total := v_total + 1;
        IF p_answers ->> v_qid IS NOT NULL
           AND (p_answers ->> v_qid) <> ''
           AND (p_answers ->> v_qid) = (v_key ->> v_qid) THEN
            v_correct := v_correct + 1;
        END IF;
    END LOOP;
    IF v_total = 0 THEN
        v_score := 0;
    ELSE
        v_score := ROUND((v_correct::numeric / v_total::numeric) * 100, 1);
    END IF;
    v_passed := v_total > 0 AND v_score >= v_set.pass_score;
    PERFORM set_config('app.trusted_server', 'on', TRUE);
    UPDATE assessment_attempts
    SET answers = p_answers,
        score = v_score,
        passed = v_passed,
        status = 'submitted',
        submitted_at = NOW()
    WHERE id = p_attempt_id;
    -- Authoritative final_assessment component (never client-supplied).
    INSERT INTO credential_component_results
        (user_id, program_slug, program_version, component, score,
         authority_source, reference_id)
    VALUES
        (v_attempt.user_id, v_attempt.program_slug, v_attempt.question_set_version,
         'final_assessment', v_score, 'server_scored_assessment', p_attempt_id::text)
    ON CONFLICT (user_id, program_slug, program_version, component)
    DO UPDATE SET score = EXCLUDED.score,
                  authority_source = EXCLUDED.authority_source,
                  reference_id = EXCLUDED.reference_id,
                  created_at = NOW();
    UPDATE user_credential_progress
    SET status = CASE WHEN v_passed THEN 'ready' ELSE 'remediation' END,
        updated_at = NOW()
    WHERE user_id = v_attempt.user_id AND program_slug = v_attempt.program_slug;
    RETURN QUERY SELECT v_score, v_passed, TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION submit_assessment(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION submit_assessment(UUID, JSONB) TO authenticated;

-- 6. Authoritative component results (server-written only). --------------
CREATE TABLE IF NOT EXISTS credential_component_results (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    program_slug TEXT NOT NULL,
    program_version TEXT NOT NULL DEFAULT '1.0',
    component TEXT NOT NULL CHECK (component IN ('knowledge', 'practical', 'final_assessment', 'project')),
    score NUMERIC NOT NULL,
    authority_source TEXT NOT NULL,
    reference_id TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, program_slug, program_version, component)
);

ALTER TABLE credential_component_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own component results" ON credential_component_results;
CREATE POLICY "users read own component results"
    ON credential_component_results FOR SELECT USING (user_id = auth.uid());
-- No client write policies: only server/service-role functions write here.

-- Project certification feeds the authoritative project component.
CREATE OR REPLACE FUNCTION project_certification_feed_component()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO credential_component_results
        (user_id, program_slug, program_version, component, score,
         authority_source, reference_id)
    VALUES
        (NEW.user_id, NEW.program_slug, NEW.version, 'project',
         NEW.authoritative_score, 'server_certified_project', NEW.id::text)
    ON CONFLICT (user_id, program_slug, program_version, component)
    DO UPDATE SET score = EXCLUDED.score,
                  authority_source = EXCLUDED.authority_source,
                  reference_id = EXCLUDED.reference_id,
                  created_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS project_certification_feed_component ON project_certification_results;
CREATE TRIGGER project_certification_feed_component
    AFTER INSERT OR UPDATE ON project_certification_results
    FOR EACH ROW EXECUTE FUNCTION project_certification_feed_component();

REVOKE ALL ON FUNCTION project_certification_feed_component() FROM PUBLIC, anon, authenticated;
