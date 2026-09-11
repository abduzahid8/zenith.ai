-- =====================================================
-- 035 — Attempt-lifecycle correctness: reuse, supersede, submit checks.
--
-- Problems fixed (fail-closed, history-preserving):
--   1. start_trusted_validation minted a NEW attempt per call, allowing
--      free bank enumeration (preview/close/reopen). Now at most ONE
--      `started` trusted attempt per (user, program, version, skill):
--      advisory lock + partial unique index; reopening resumes the
--      exact attempt when it is still live.
--   2. New `superseded` attempt state on all four attempt tables.
--      Rotation supersedes stale `started` attempts instead of leaving
--      them authoritative forever (a PASS on retired content could
--      never issue, yet blocked retakes).
--   3. Submits re-validate the pinned content against the live release.
--      Stale submits atomically mark the attempt `superseded`, create
--      ZERO proof/component rows, and return content_stale=TRUE
--      (structured result, never an exception-after-write).
--   4. Stale component passes never block fresh attempts; best-wins
--      applies only among currently-authoritative results.
--   5. Missing bank rows under an otherwise live release report the
--      same safe `credential_content_unavailable` condition.
--   6. Live-release helpers are internal: no direct client EXECUTE.
--
-- Forward-only. No Home/runtime/NBA/Skill-State/scoring/evidence/
-- issuance/bank changes.
-- =====================================================

-- 0. Attempt status gains `superseded` on all four tables. -------------
DO $$
DECLARE
    c TEXT;
BEGIN
    -- Fallback lookup scoped correctly per table below.
    SELECT conname INTO c FROM pg_constraint
    WHERE conrelid = 'trusted_validation_attempts'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%''started''%''submitted''%';
    IF c IS NOT NULL THEN
        EXECUTE format('ALTER TABLE trusted_validation_attempts DROP CONSTRAINT %I', c);
    END IF;
    SELECT conname INTO c FROM pg_constraint
    WHERE conrelid = 'knowledge_attempts'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%''started''%''submitted''%';
    IF c IS NOT NULL THEN
        EXECUTE format('ALTER TABLE knowledge_attempts DROP CONSTRAINT %I', c);
    END IF;
    SELECT conname INTO c FROM pg_constraint
    WHERE conrelid = 'practical_attempts'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%''started''%''submitted''%';
    IF c IS NOT NULL THEN
        EXECUTE format('ALTER TABLE practical_attempts DROP CONSTRAINT %I', c);
    END IF;
    SELECT conname INTO c FROM pg_constraint
    WHERE conrelid = 'assessment_attempts'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%''started''%''submitted''%';
    IF c IS NOT NULL THEN
        EXECUTE format('ALTER TABLE assessment_attempts DROP CONSTRAINT %I', c);
    END IF;
END
$$;

ALTER TABLE trusted_validation_attempts
    ADD CONSTRAINT trusted_validation_attempts_status_check
    CHECK (status IN ('started', 'submitted', 'superseded'));
ALTER TABLE knowledge_attempts
    ADD CONSTRAINT knowledge_attempts_status_check
    CHECK (status IN ('started', 'submitted', 'superseded'));
ALTER TABLE practical_attempts
    ADD CONSTRAINT practical_attempts_status_check
    CHECK (status IN ('started', 'submitted', 'superseded'));
ALTER TABLE assessment_attempts
    ADD CONSTRAINT assessment_attempts_status_check
    CHECK (status IN ('started', 'submitted', 'superseded'));

-- 1. Nullable live resolver (internal; never raises). -------------------
CREATE OR REPLACE FUNCTION live_content_version_or_null(p_program_slug TEXT, p_program_version TEXT)
RETURNS TEXT AS $$
DECLARE
    v_count INTEGER;
    v_live TEXT;
BEGIN
    SELECT COUNT(*), MIN(rel.content_version)
    INTO v_count, v_live
    FROM credential_content_releases rel
    WHERE rel.program_slug = p_program_slug
      AND rel.program_version = p_program_version
      AND rel.status = 'active'
      AND rel.machine_qa_status = 'passed'
      AND rel.human_review_status = 'approved';
    IF v_count != 1 THEN
        RETURN NULL;
    END IF;
    RETURN v_live;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION live_content_version_or_null(TEXT, TEXT) FROM PUBLIC, anon, authenticated;

-- 034 helper becomes a thin raising wrapper (grants revoked: internal).
CREATE OR REPLACE FUNCTION current_live_content_version(p_program_slug TEXT, p_program_version TEXT)
RETURNS TEXT AS $$
DECLARE
    v_live TEXT;
BEGIN
    SELECT live_content_version_or_null(p_program_slug, p_program_version) INTO v_live;
    IF v_live IS NULL THEN
        RAISE EXCEPTION 'credential_content_unavailable';
    END IF;
    RETURN v_live;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION current_live_content_version(TEXT, TEXT) FROM PUBLIC, anon, authenticated;

-- 2. Component reference backing version (NULL = unjudgeable/legacy). ---
CREATE OR REPLACE FUNCTION component_reference_version(p_component TEXT, p_reference_id TEXT)
RETURNS TEXT AS $$
DECLARE
    v_ver TEXT;
BEGIN
    IF p_reference_id IS NULL THEN
        RETURN NULL;
    END IF;
    IF p_component = 'knowledge' THEN
        SELECT content_version INTO v_ver FROM knowledge_attempts WHERE id::text = p_reference_id;
        RETURN v_ver;
    ELSIF p_component = 'practical' THEN
        SELECT content_version INTO v_ver FROM practical_attempts WHERE id::text = p_reference_id;
        RETURN v_ver;
    ELSIF p_component = 'final_assessment' THEN
        SELECT bank_version INTO v_ver FROM assessment_attempts WHERE id::text = p_reference_id;
        RETURN v_ver;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION component_reference_version(TEXT, TEXT) FROM PUBLIC, anon, authenticated;

-- 3. Best-wins only among authoritative results. ------------------------
-- A passed row backed by retired/compromised content yields to the fresh
-- result; legacy/unresolvable references keep legacy sticky behavior.
CREATE OR REPLACE FUNCTION component_best_wins()
RETURNS TRIGGER AS $$
DECLARE
    v_old_ver TEXT;
    v_live_now TEXT;
BEGIN
    IF current_setting('app.component_override', TRUE) = 'on' THEN
        RETURN NEW;
    END IF;
    IF NEW.component = 'project' THEN
        RETURN NEW;
    END IF;
    IF TG_OP = 'UPDATE'
       AND OLD.passed IS TRUE
       AND (NEW.passed IS DISTINCT FROM TRUE OR NEW.score <= OLD.score) THEN
        IF OLD.reference_id IS NOT NULL THEN
            SELECT component_reference_version(OLD.component, OLD.reference_id) INTO v_old_ver;
            IF v_old_ver IS NOT NULL THEN
                SELECT live_content_version_or_null(OLD.program_slug, OLD.program_version) INTO v_live_now;
                IF v_live_now IS NOT NULL AND v_old_ver IS DISTINCT FROM v_live_now THEN
                    RETURN NEW;
                END IF;
            END IF;
        END IF;
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION component_best_wins() FROM PUBLIC, anon, authenticated;

-- 4. One active attempt guards (trusted + assessment; knowledge and
-- practical already have theirs from 025). ------------------------------
DROP INDEX IF EXISTS trusted_attempts_one_active_uidx;
CREATE UNIQUE INDEX IF NOT EXISTS trusted_attempts_one_active_uidx
    ON trusted_validation_attempts (user_id, program_slug, program_version, skill_key)
    WHERE status = 'started';

DROP INDEX IF EXISTS assessment_attempts_one_active_uidx;
CREATE UNIQUE INDEX IF NOT EXISTS assessment_attempts_one_active_uidx
    ON assessment_attempts (user_id, program_slug, question_set_version)
    WHERE status = 'started';

-- 5. Trusted start v4: reuse-or-supersede + live gate. ------------------
CREATE OR REPLACE FUNCTION start_trusted_validation(p_program_slug TEXT, p_skill_key TEXT)
RETURNS TABLE (attempt_id UUID, skill_key TEXT, program_version TEXT, payload JSONB) AS $$
DECLARE
    v_program credential_programs%ROWTYPE;
    v_item_id UUID;
    v_item_skill TEXT;
    v_item_version TEXT;
    v_attempt_id UUID := gen_random_uuid();
    v_existing trusted_validation_attempts%ROWTYPE;
    v_live TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'start_trusted_validation: authentication required';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtext(auth.uid()::text || '|trusted-validation|' || p_program_slug || '|' || p_skill_key));
    SELECT * INTO v_program FROM credential_programs
    WHERE slug = p_program_slug AND status = 'active';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'start_trusted_validation: unknown or inactive program';
    END IF;
    SELECT * INTO v_existing FROM trusted_validation_attempts
    WHERE trusted_validation_attempts.user_id = auth.uid()
      AND trusted_validation_attempts.program_slug = p_program_slug
      AND trusted_validation_attempts.program_version = v_program.version
      AND trusted_validation_attempts.skill_key = p_skill_key
      AND trusted_validation_attempts.status = 'started'
    ORDER BY started_at DESC LIMIT 1;
    SELECT current_live_content_version(p_program_slug, v_program.version) INTO v_live;
    IF FOUND THEN
        IF v_existing.content_version IS NOT DISTINCT FROM v_live THEN
            RETURN QUERY
            SELECT v_existing.id, v_existing.skill_key, v_existing.program_version,
                (SELECT trusted_validation_items.payload FROM trusted_validation_items
                 WHERE trusted_validation_items.id = v_existing.item_id);
            RETURN;
        END IF;
        PERFORM set_config('app.trusted_server', 'on', TRUE);
        UPDATE trusted_validation_attempts SET status = 'superseded'
        WHERE id = v_existing.id AND status = 'started';
    END IF;
    SELECT i.id, i.skill_key, i.content_version INTO v_item_id, v_item_skill, v_item_version
    FROM trusted_validation_items i
    LEFT JOIN trusted_validation_attempts a
      ON a.item_id = i.id AND a.user_id = auth.uid()
    WHERE i.program_slug = p_program_slug
      AND i.program_version = v_program.version
      AND i.skill_key = p_skill_key
      AND i.status = 'active'
      AND i.content_version = v_live
    GROUP BY i.id, i.skill_key, i.content_version, i.created_at
    ORDER BY MAX(a.started_at) NULLS FIRST, i.created_at, i.id
    LIMIT 1;
    IF v_item_id IS NULL THEN
        RAISE EXCEPTION 'credential_content_unavailable';
    END IF;
    PERFORM set_config('app.trusted_server', 'on', TRUE);
    BEGIN
        INSERT INTO trusted_validation_attempts
            (id, user_id, item_id, program_slug, program_version, skill_key, status, content_version)
        VALUES
            (v_attempt_id, auth.uid(), v_item_id, v_program.slug, v_program.version, v_item_skill, 'started', v_item_version);
    EXCEPTION WHEN unique_violation THEN
        -- Lost a same-key race: resume the winner when live.
        SELECT * INTO v_existing FROM trusted_validation_attempts
        WHERE trusted_validation_attempts.user_id = auth.uid()
          AND trusted_validation_attempts.program_slug = p_program_slug
          AND trusted_validation_attempts.program_version = v_program.version
          AND trusted_validation_attempts.skill_key = p_skill_key
          AND trusted_validation_attempts.status = 'started'
        ORDER BY started_at DESC LIMIT 1;
        IF FOUND AND v_existing.content_version IS NOT DISTINCT FROM v_live THEN
            RETURN QUERY
            SELECT v_existing.id, v_existing.skill_key, v_existing.program_version,
                (SELECT trusted_validation_items.payload FROM trusted_validation_items
                 WHERE trusted_validation_items.id = v_existing.item_id);
            RETURN;
        END IF;
        RAISE;
    END;
    RETURN QUERY
    SELECT v_attempt_id, v_item_skill, v_program.version,
        (SELECT trusted_validation_items.payload FROM trusted_validation_items
         WHERE trusted_validation_items.id = v_item_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION start_trusted_validation(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION start_trusted_validation(TEXT, TEXT) TO authenticated;

-- 6. Knowledge start v4. -------------------------------------------------
CREATE OR REPLACE FUNCTION start_knowledge_attempt(p_program_slug TEXT)
RETURNS TABLE (attempt_id UUID, program_version TEXT, questions JSONB) AS $$
DECLARE
    v_program credential_programs%ROWTYPE;
    v_skill JSONB;
    v_ids UUID[] := '{}';
    vAid UUID;
    v_attempt_id UUID := gen_random_uuid();
    v_existing knowledge_attempts%ROWTYPE;
    v_comp_passed BOOLEAN;
    v_comp_ref TEXT;
    v_ref_ver TEXT;
    v_live TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'start_knowledge_attempt: authentication required';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtext(auth.uid()::text || '|knowledge|' || p_program_slug));
    SELECT * INTO v_program FROM credential_programs
    WHERE slug = p_program_slug AND status = 'active';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'start_knowledge_attempt: unknown or inactive program';
    END IF;
    SELECT current_live_content_version(p_program_slug, v_program.version) INTO v_live;
    SELECT c.passed, c.reference_id INTO v_comp_passed, v_comp_ref FROM credential_component_results c
    WHERE c.user_id = auth.uid()
      AND c.program_slug = p_program_slug
      AND c.program_version = v_program.version
      AND c.component = 'knowledge';
    IF v_comp_passed IS TRUE THEN
        -- Only a live-backed pass blocks: stale references never strand a retake.
        IF v_comp_ref IS NOT NULL THEN
            SELECT component_reference_version('knowledge', v_comp_ref) INTO v_ref_ver;
            IF v_ref_ver IS NOT NULL AND v_ref_ver IS DISTINCT FROM v_live THEN
                v_comp_passed := FALSE;
            END IF;
        END IF;
        IF v_comp_passed IS TRUE THEN
            RAISE EXCEPTION 'start_knowledge_attempt: component already passed';
        END IF;
    END IF;
    SELECT * INTO v_existing FROM knowledge_attempts
    WHERE knowledge_attempts.user_id = auth.uid()
      AND knowledge_attempts.program_slug = p_program_slug
      AND knowledge_attempts.program_version = v_program.version
      AND knowledge_attempts.status = 'started'
    ORDER BY started_at DESC LIMIT 1;
    IF FOUND THEN
        IF v_existing.content_version IS NOT DISTINCT FROM v_live THEN
            RETURN QUERY SELECT v_existing.id, v_existing.program_version,
                (SELECT jsonb_agg(jsonb_build_object('item_key', k.item_key, 'skill', k.skill_key, 'payload', k.payload) ORDER BY k.skill_key)
                 FROM knowledge_items k WHERE k.id::text IN (SELECT jsonb_array_elements_text(v_existing.assigned_item_ids)));
            RETURN;
        END IF;
        PERFORM set_config('app.trusted_server', 'on', TRUE);
        UPDATE knowledge_attempts SET status = 'superseded'
        WHERE id = v_existing.id AND status = 'started';
    END IF;
    FOR v_skill IN SELECT jsonb_array_elements(v_program.skills) LOOP
        FOR vAid IN
            SELECT i.id FROM knowledge_items i
            LEFT JOIN knowledge_attempts a
              ON a.program_slug = i.program_slug
             AND a.user_id = auth.uid()
             AND i.id::text IN (SELECT jsonb_array_elements_text(a.assigned_item_ids))
            WHERE i.program_slug = p_program_slug
              AND i.program_version = v_program.version
              AND i.skill_key = (v_skill ->> 'key')
              AND i.status = 'active'
              AND i.content_version = v_live
            GROUP BY i.id, i.created_at
            ORDER BY MAX(a.started_at) NULLS FIRST, i.created_at
            LIMIT 2
        LOOP
            v_ids := v_ids || vAid;
        END LOOP;
    END LOOP;
    IF array_length(v_ids, 1) IS NULL THEN
        RAISE EXCEPTION 'credential_content_unavailable';
    END IF;
    PERFORM set_config('app.trusted_server', 'on', TRUE);
    BEGIN
        INSERT INTO knowledge_attempts (id, user_id, program_slug, program_version, assigned_item_ids, status, content_version)
        VALUES (v_attempt_id, auth.uid(), v_program.slug, v_program.version,
                (SELECT jsonb_agg(x) FROM UNNEST(v_ids) x), 'started',
                (SELECT CASE WHEN COUNT(DISTINCT i.content_version) = 1
                             THEN MIN(i.content_version) ELSE 'mixed' END
                 FROM knowledge_items i WHERE i.id = ANY (v_ids)));
    EXCEPTION WHEN unique_violation THEN
        SELECT * INTO v_existing FROM knowledge_attempts
        WHERE knowledge_attempts.user_id = auth.uid()
          AND knowledge_attempts.program_slug = p_program_slug
          AND knowledge_attempts.program_version = v_program.version
          AND knowledge_attempts.status = 'started'
        ORDER BY started_at DESC LIMIT 1;
        IF FOUND AND v_existing.content_version IS NOT DISTINCT FROM v_live THEN
            RETURN QUERY SELECT v_existing.id, v_existing.program_version,
                (SELECT jsonb_agg(jsonb_build_object('item_key', k.item_key, 'skill', k.skill_key, 'payload', k.payload) ORDER BY k.skill_key)
                 FROM knowledge_items k WHERE k.id::text IN (SELECT jsonb_array_elements_text(v_existing.assigned_item_ids)));
            RETURN;
        END IF;
        RAISE;
    END;
    RETURN QUERY SELECT v_attempt_id, v_program.version,
        (SELECT jsonb_agg(jsonb_build_object('item_key', k.item_key, 'skill', k.skill_key, 'payload', k.payload) ORDER BY k.skill_key)
         FROM knowledge_items k WHERE k.id = ANY (v_ids));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION start_knowledge_attempt(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION start_knowledge_attempt(TEXT) TO authenticated;

-- 7. Practical start v4. -------------------------------------------------
CREATE OR REPLACE FUNCTION start_practical_attempt(p_program_slug TEXT)
RETURNS TABLE (attempt_id UUID, program_version TEXT, tasks JSONB) AS $$
DECLARE
    v_program credential_programs%ROWTYPE;
    v_skill JSONB;
    v_ids UUID[] := '{}';
    vAid UUID;
    v_attempt_id UUID := gen_random_uuid();
    v_existing practical_attempts%ROWTYPE;
    v_comp_passed BOOLEAN;
    v_comp_ref TEXT;
    v_ref_ver TEXT;
    v_live TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'start_practical_attempt: authentication required';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtext(auth.uid()::text || '|practical|' || p_program_slug));
    SELECT * INTO v_program FROM credential_programs
    WHERE slug = p_program_slug AND status = 'active';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'start_practical_attempt: unknown or inactive program';
    END IF;
    SELECT current_live_content_version(p_program_slug, v_program.version) INTO v_live;
    SELECT c.passed, c.reference_id INTO v_comp_passed, v_comp_ref FROM credential_component_results c
    WHERE c.user_id = auth.uid()
      AND c.program_slug = p_program_slug
      AND c.program_version = v_program.version
      AND c.component = 'practical';
    IF v_comp_passed IS TRUE THEN
        IF v_comp_ref IS NOT NULL THEN
            SELECT component_reference_version('practical', v_comp_ref) INTO v_ref_ver;
            IF v_ref_ver IS NOT NULL AND v_ref_ver IS DISTINCT FROM v_live THEN
                v_comp_passed := FALSE;
            END IF;
        END IF;
        IF v_comp_passed IS TRUE THEN
            RAISE EXCEPTION 'start_practical_attempt: component already passed';
        END IF;
    END IF;
    SELECT * INTO v_existing FROM practical_attempts
    WHERE practical_attempts.user_id = auth.uid()
      AND practical_attempts.program_slug = p_program_slug
      AND practical_attempts.program_version = v_program.version
      AND practical_attempts.status = 'started'
    ORDER BY started_at DESC LIMIT 1;
    IF FOUND THEN
        IF v_existing.content_version IS NOT DISTINCT FROM v_live THEN
            RETURN QUERY SELECT v_existing.id, v_existing.program_version,
                (SELECT jsonb_agg(jsonb_build_object('item_key', k.item_key, 'skill', k.skill_key, 'payload', k.payload) ORDER BY k.skill_key)
                 FROM practical_items k WHERE k.id::text IN (SELECT jsonb_array_elements_text(v_existing.assigned_item_ids)));
            RETURN;
        END IF;
        PERFORM set_config('app.trusted_server', 'on', TRUE);
        UPDATE practical_attempts SET status = 'superseded'
        WHERE id = v_existing.id AND status = 'started';
    END IF;
    FOR v_skill IN SELECT jsonb_array_elements(v_program.skills) LOOP
        FOR vAid IN
            SELECT i.id FROM practical_items i
            LEFT JOIN practical_attempts a
              ON a.program_slug = i.program_slug
             AND a.user_id = auth.uid()
             AND i.id::text IN (SELECT jsonb_array_elements_text(a.assigned_item_ids))
            WHERE i.program_slug = p_program_slug
              AND i.program_version = v_program.version
              AND i.skill_key = (v_skill ->> 'key')
              AND i.status = 'active'
              AND i.content_version = v_live
            GROUP BY i.id, i.created_at
            ORDER BY MAX(a.started_at) NULLS FIRST, i.created_at
            LIMIT 2
        LOOP
            v_ids := v_ids || vAid;
        END LOOP;
    END LOOP;
    IF array_length(v_ids, 1) IS NULL THEN
        RAISE EXCEPTION 'credential_content_unavailable';
    END IF;
    PERFORM set_config('app.trusted_server', 'on', TRUE);
    BEGIN
        INSERT INTO practical_attempts (id, user_id, program_slug, program_version, assigned_item_ids, status, content_version)
        VALUES (v_attempt_id, auth.uid(), v_program.slug, v_program.version,
                (SELECT jsonb_agg(x) FROM UNNEST(v_ids) x), 'started',
                (SELECT CASE WHEN COUNT(DISTINCT i.content_version) = 1
                             THEN MIN(i.content_version) ELSE 'mixed' END
                 FROM practical_items i WHERE i.id = ANY (v_ids)));
    EXCEPTION WHEN unique_violation THEN
        SELECT * INTO v_existing FROM practical_attempts
        WHERE practical_attempts.user_id = auth.uid()
          AND practical_attempts.program_slug = p_program_slug
          AND practical_attempts.program_version = v_program.version
          AND practical_attempts.status = 'started'
        ORDER BY started_at DESC LIMIT 1;
        IF FOUND AND v_existing.content_version IS NOT DISTINCT FROM v_live THEN
            RETURN QUERY SELECT v_existing.id, v_existing.program_version,
                (SELECT jsonb_agg(jsonb_build_object('item_key', k.item_key, 'skill', k.skill_key, 'payload', k.payload) ORDER BY k.skill_key)
                 FROM practical_items k WHERE k.id::text IN (SELECT jsonb_array_elements_text(v_existing.assigned_item_ids)));
            RETURN;
        END IF;
        RAISE;
    END;
    RETURN QUERY SELECT v_attempt_id, v_program.version,
        (SELECT jsonb_agg(jsonb_build_object('item_key', k.item_key, 'skill', k.skill_key, 'payload', k.payload) ORDER BY k.skill_key)
         FROM practical_items k WHERE k.id = ANY (v_ids));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION start_practical_attempt(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION start_practical_attempt(TEXT) TO authenticated;

-- 8. Assessment start v5: supersede-or-resume + live set. ----------------
CREATE OR REPLACE FUNCTION start_assessment(p_program_slug TEXT)
RETURNS TABLE (
    attempt_id UUID, attempt_number INTEGER, question_set_version TEXT,
    time_limit_minutes INTEGER, questions JSONB, deadline TIMESTAMPTZ, retake_reason TEXT
) AS $$
DECLARE
    v_program credential_programs%ROWTYPE;
    v_set assessment_question_sets%ROWTYPE;
    v_old_set assessment_question_sets%ROWTYPE;
    v_bank JSONB;
    v_assigned JSONB;
    v_num INTEGER;
    v_attempt_id UUID := gen_random_uuid();
    v_existing assessment_attempts%ROWTYPE;
    v_submitted INTEGER;
    v_last_submitted TIMESTAMPTZ;
    v_last_breakdown JSONB;
    v_skill JSONB;
    v_skill_key TEXT;
    v_min NUMERIC;
    v_got NUMERIC;
    v_tot NUMERIC;
    v_missing TEXT[] := '{}';
    v_live TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'start_assessment: authentication required';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtext(auth.uid()::text || '|' || p_program_slug));
    SELECT * INTO v_program FROM credential_programs
    WHERE slug = p_program_slug AND status = 'active';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'start_assessment: unknown or inactive program';
    END IF;
    SELECT * INTO v_existing FROM assessment_attempts
    WHERE assessment_attempts.user_id = auth.uid()
      AND assessment_attempts.program_slug = p_program_slug
      AND assessment_attempts.question_set_version = v_program.version
      AND assessment_attempts.status = 'started'
    ORDER BY started_at DESC LIMIT 1;
    SELECT current_live_content_version(p_program_slug, v_program.version) INTO v_live;
    IF FOUND THEN
        IF v_existing.bank_version IS NOT DISTINCT FROM v_live THEN
            SELECT * INTO v_old_set FROM assessment_question_sets
            WHERE id = v_existing.question_set_id;
            RETURN QUERY SELECT v_existing.id, v_existing.attempt_number,
                v_existing.question_set_version, v_old_set.time_limit_minutes,
                (SELECT COALESCE(
                    (SELECT jsonb_agg(q) FROM jsonb_array_elements(v_old_set.questions) q
                     WHERE q ->> 'id' IN (SELECT jsonb_array_elements_text(v_existing.assigned_question_ids))),
                    '[]'::jsonb)),
                v_existing.deadline, 'active_attempt'::text;
            RETURN;
        END IF;
        PERFORM set_config('app.trusted_server', 'on', TRUE);
        UPDATE assessment_attempts SET status = 'superseded'
        WHERE id = v_existing.id AND status = 'started';
    END IF;
    SELECT * INTO v_set FROM assessment_question_sets
    WHERE program_slug = p_program_slug AND version = v_program.version
      AND status = 'active'
      AND content_version = v_live
    ORDER BY created_at DESC LIMIT 1;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'credential_content_unavailable';
    END IF;
    SELECT COUNT(*), MAX(submitted_at) INTO v_submitted, v_last_submitted
    FROM assessment_attempts
    WHERE assessment_attempts.user_id = auth.uid()
      AND assessment_attempts.program_slug = p_program_slug
      AND assessment_attempts.question_set_version = v_program.version
      AND assessment_attempts.status = 'submitted';
    IF v_submitted >= 1 AND v_last_submitted + INTERVAL '24 hours' > NOW() THEN
        RAISE EXCEPTION 'retake_blocked:cooldown:%',
            TO_CHAR(v_last_submitted + INTERVAL '24 hours', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
    END IF;
    IF v_submitted >= 2 THEN
        SELECT skill_breakdown INTO v_last_breakdown FROM assessment_attempts
        WHERE assessment_attempts.user_id = auth.uid()
          AND assessment_attempts.program_slug = p_program_slug
          AND assessment_attempts.question_set_version = v_program.version
          AND assessment_attempts.status = 'submitted'
        ORDER BY submitted_at DESC LIMIT 1;
        FOR v_skill IN SELECT jsonb_array_elements(v_program.skills) LOOP
            v_skill_key := v_skill ->> 'key';
            v_min := COALESCE((v_skill ->> 'minimumScore')::numeric, 65);
            v_got := COALESCE((v_last_breakdown -> v_skill_key ->> 'correct')::numeric, -1);
            v_tot := COALESCE((v_last_breakdown -> v_skill_key ->> 'total')::numeric, 0);
            IF v_tot <= 0 OR (v_got / v_tot) * 100 < v_min THEN
                PERFORM 1 FROM trusted_validation_attempts a
                JOIN trusted_validation_items i ON i.id = a.item_id
                WHERE a.user_id = auth.uid()
                  AND i.program_slug = p_program_slug
                  AND i.program_version = v_program.version
                  AND i.skill_key = v_skill_key
                  AND i.status = 'active'
                  AND a.status = 'submitted' AND a.passed = TRUE
                  AND a.submitted_at > v_last_submitted
                  AND NOT EXISTS (
                      SELECT 1 FROM trusted_validation_attempts older
                      WHERE older.user_id = auth.uid()
                        AND older.item_id = a.item_id
                        AND older.status = 'submitted'
                        AND older.submitted_at <= v_last_submitted)
                LIMIT 1;
                IF NOT FOUND THEN
                    v_missing := v_missing || v_skill_key;
                END IF;
            END IF;
        END LOOP;
        IF array_length(v_missing, 1) > 0 THEN
            RAISE EXCEPTION 'retake_blocked:remediation_required:%', array_to_string(v_missing, ',');
        END IF;
    END IF;
    PERFORM set_config('app.trusted_server', 'on', TRUE);
    INSERT INTO user_credential_progress (user_id, program_slug, program_version, status)
    VALUES (auth.uid(), v_program.slug, v_program.version, 'in_assessment')
    ON CONFLICT (user_id, program_slug, program_version) DO UPDATE
        SET status = 'in_assessment', updated_at = NOW();
    SELECT COALESCE(MAX(assessment_attempts.attempt_number), 0) + 1 INTO v_num
    FROM assessment_attempts
    WHERE assessment_attempts.user_id = auth.uid() AND assessment_attempts.program_slug = p_program_slug;
    v_bank := COALESCE(v_set.questions, '[]'::jsonb);
    SELECT COALESCE(jsonb_agg(x.qid ORDER BY x.r), '[]'::jsonb) INTO v_assigned
    FROM (
        SELECT s.qid, RANDOM() AS r FROM (
            SELECT (q ->> 'id') AS qid,
                   ROW_NUMBER() OVER (PARTITION BY (q ->> 'skill') ORDER BY RANDOM()) AS rn
            FROM jsonb_array_elements(v_bank) q
            WHERE (q ->> 'id') IS NOT NULL
        ) s WHERE s.rn <= 5
    ) x;
    IF jsonb_array_length(v_assigned) = 0 THEN
        SELECT jsonb_agg(q ->> 'id') INTO v_assigned
        FROM jsonb_array_elements(v_bank) q;
    END IF;
    BEGIN
        INSERT INTO assessment_attempts
            (id, user_id, program_slug, question_set_id, question_set_version,
             attempt_number, status, answers, score, passed,
             assigned_question_ids, deadline, skill_breakdown, bank_version)
        VALUES
            (v_attempt_id, auth.uid(), v_program.slug, v_set.id, v_set.version,
             v_num, 'started', NULL, NULL, NULL,
             v_assigned, NOW() + (v_set.time_limit_minutes || ' minutes')::interval, NULL,
             v_set.content_version);
    EXCEPTION WHEN unique_violation THEN
        NULL;
    END;
    SELECT * INTO v_existing FROM assessment_attempts WHERE id = v_attempt_id;
    IF NOT FOUND THEN
        SELECT * INTO v_existing FROM assessment_attempts
        WHERE assessment_attempts.user_id = auth.uid()
          AND assessment_attempts.program_slug = p_program_slug
          AND assessment_attempts.question_set_version = v_program.version
          AND assessment_attempts.status = 'started'
        ORDER BY started_at DESC LIMIT 1;
    END IF;
    RETURN QUERY SELECT v_existing.id, v_existing.attempt_number,
        v_existing.question_set_version, v_set.time_limit_minutes,
        (SELECT COALESCE(
            (SELECT jsonb_agg(q) FROM jsonb_array_elements(v_set.questions) q
             WHERE q ->> 'id' IN (SELECT jsonb_array_elements_text(v_existing.assigned_question_ids))),
            '[]'::jsonb)),
        v_existing.deadline, CASE WHEN v_submitted = 0 THEN 'first_attempt' ELSE 'allowed' END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION start_assessment(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION start_assessment(TEXT) TO authenticated;

-- 9. Trusted submit v2: release re-check, stale supersede, no proof. -----
-- Return-type change (content_stale) requires DROP + CREATE.
DROP FUNCTION IF EXISTS submit_trusted_validation(UUID, JSONB);
CREATE OR REPLACE FUNCTION submit_trusted_validation(p_attempt_id UUID, p_answer JSONB)
RETURNS TABLE (passed BOOLEAN, submitted BOOLEAN, trusted_event_id TEXT, content_stale BOOLEAN) AS $$
DECLARE
    v_attempt trusted_validation_attempts%ROWTYPE;
    v_item trusted_validation_items%ROWTYPE;
    v_ok BOOLEAN;
    v_event_id TEXT;
    v_prior INTEGER;
    v_live TEXT;
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
             WHERE e.id = 'srv:trusted:' || p_attempt_id::text || ':0'),
            FALSE;
        RETURN;
    END IF;
    IF v_attempt.status = 'superseded' THEN
        RETURN QUERY SELECT FALSE, FALSE, NULL::text, TRUE;
        RETURN;
    END IF;
    SELECT * INTO v_item FROM trusted_validation_items WHERE id = v_attempt.item_id;
    SELECT current_live_content_version(v_attempt.program_slug, v_attempt.program_version) INTO v_live;
    IF v_item.content_version IS DISTINCT FROM v_live THEN
        -- Rotation won the race: retire the attempt, create ZERO proof.
        -- Structured result (never raise-after-write: the transition commits).
        PERFORM set_config('app.trusted_server', 'on', TRUE);
        UPDATE trusted_validation_attempts SET status = 'superseded'
        WHERE id = p_attempt_id AND status = 'started';
        RETURN QUERY SELECT FALSE, FALSE, NULL::text, TRUE;
        RETURN;
    END IF;
    v_ok := (p_answer ->> 'answer') IS NOT NULL
        AND (p_answer ->> 'answer') <> ''
        AND (p_answer ->> 'answer') = (v_item.answer_key ->> 'answer');
    PERFORM set_config('app.trusted_server', 'on', TRUE);
    UPDATE trusted_validation_attempts
    SET status = 'submitted', passed = v_ok, submitted_at = NOW()
    WHERE id = p_attempt_id;
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
        'attempt', CASE WHEN v_ok THEN 'pass' ELSE 'fail' END,
        CASE WHEN v_ok THEN 1.0 ELSE 0.0 END, 'strong',
        'server_scored', NOW(), TRUE
    )
    ON CONFLICT (id) DO NOTHING;
    SELECT COUNT(*) INTO v_prior FROM trusted_validation_attempts
    WHERE user_id = auth.uid() AND item_id = v_item.id AND status = 'submitted';
    INSERT INTO trusted_item_results
        (user_id, program_slug, program_version, skill_key, item_id,
         content_version, finalized_passed, attempts, last_submitted_at)
    VALUES
        (auth.uid(), v_item.program_slug, v_item.program_version, v_item.skill_key,
         v_item.id, COALESCE(v_attempt.content_version, v_item.content_version),
         v_ok, v_prior, NOW())
    ON CONFLICT (user_id, program_slug, program_version, item_id) DO NOTHING;
    RETURN QUERY SELECT v_ok, TRUE, v_event_id, FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION submit_trusted_validation(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION submit_trusted_validation(UUID, JSONB) TO authenticated;

-- 10. Knowledge submit v2. -------------------------------------------------
DROP FUNCTION IF EXISTS submit_knowledge_attempt(UUID, JSONB);
CREATE OR REPLACE FUNCTION submit_knowledge_attempt(p_attempt_id UUID, p_answers JSONB)
RETURNS TABLE (score NUMERIC, passed BOOLEAN, submitted BOOLEAN, content_stale BOOLEAN) AS $$
DECLARE
    v_attempt knowledge_attempts%ROWTYPE;
    v_correct INTEGER := 0;
    v_total INTEGER := 0;
    v_iid TEXT;
    v_key JSONB;
    v_ikey TEXT;
    v_score NUMERIC;
    v_passed BOOLEAN;
    v_live TEXT;
    v_all_live BOOLEAN;
BEGIN
    SELECT * INTO v_attempt FROM knowledge_attempts WHERE id = p_attempt_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'submit_knowledge_attempt: attempt not found';
    END IF;
    IF v_attempt.user_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'submit_knowledge_attempt: not the attempt owner';
    END IF;
    IF v_attempt.status = 'submitted' THEN
        RETURN QUERY SELECT v_attempt.score, v_attempt.passed, FALSE, FALSE;
        RETURN;
    END IF;
    IF v_attempt.status = 'superseded' THEN
        RETURN QUERY SELECT NULL::numeric, FALSE, FALSE, TRUE;
        RETURN;
    END IF;
    SELECT current_live_content_version(v_attempt.program_slug, v_attempt.program_version) INTO v_live;
    SELECT bool_and(k.content_version = v_live) INTO v_all_live FROM knowledge_items k
    WHERE k.id::text IN (SELECT jsonb_array_elements_text(v_attempt.assigned_item_ids));
    IF v_all_live IS DISTINCT FROM TRUE THEN
        PERFORM set_config('app.trusted_server', 'on', TRUE);
        UPDATE knowledge_attempts SET status = 'superseded'
        WHERE id = p_attempt_id AND status = 'started';
        RETURN QUERY SELECT NULL::numeric, FALSE, FALSE, TRUE;
        RETURN;
    END IF;
    FOR v_iid IN SELECT jsonb_array_elements_text(v_attempt.assigned_item_ids) LOOP
        SELECT k.answer_key, k.item_key INTO v_key, v_ikey FROM knowledge_items k WHERE k.id::text = v_iid;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'submit_knowledge_attempt: assigned item missing';
        END IF;
        v_total := v_total + 1;
        IF (p_answers ->> v_ikey) IS NOT NULL
           AND (p_answers ->> v_ikey) <> ''
           AND (p_answers ->> v_ikey) = (v_key ->> 'answer') THEN
            v_correct := v_correct + 1;
        END IF;
    END LOOP;
    IF v_total = 0 THEN v_score := 0;
    ELSE v_score := ROUND((v_correct::numeric / v_total::numeric) * 100, 1); END IF;
    v_passed := v_total > 0 AND v_score >= 80;
    PERFORM set_config('app.trusted_server', 'on', TRUE);
    UPDATE knowledge_attempts
    SET score = v_score, passed = v_passed, status = 'submitted', submitted_at = NOW()
    WHERE id = p_attempt_id;
    INSERT INTO credential_component_results
        (user_id, program_slug, program_version, component, score, passed,
         authority_source, reference_id)
    VALUES (v_attempt.user_id, v_attempt.program_slug, v_attempt.program_version,
            'knowledge', v_score, v_passed, 'server_scored_knowledge', p_attempt_id::text)
    ON CONFLICT (user_id, program_slug, program_version, component)
    DO UPDATE SET score = EXCLUDED.score, passed = EXCLUDED.passed,
                  authority_source = EXCLUDED.authority_source,
                  reference_id = EXCLUDED.reference_id, created_at = NOW();
    RETURN QUERY SELECT v_score, v_passed, TRUE, FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION submit_knowledge_attempt(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION submit_knowledge_attempt(UUID, JSONB) TO authenticated;

-- 11. Practical submit v2. -------------------------------------------------
DROP FUNCTION IF EXISTS submit_practical_attempt(UUID, JSONB);
CREATE OR REPLACE FUNCTION submit_practical_attempt(p_attempt_id UUID, p_answers JSONB)
RETURNS TABLE (score NUMERIC, passed BOOLEAN, submitted BOOLEAN, content_stale BOOLEAN) AS $$
DECLARE
    v_attempt practical_attempts%ROWTYPE;
    v_correct INTEGER := 0;
    v_total INTEGER := 0;
    v_iid TEXT;
    v_key JSONB;
    v_ikey TEXT;
    v_score NUMERIC;
    v_passed BOOLEAN;
    v_live TEXT;
    v_all_live BOOLEAN;
BEGIN
    SELECT * INTO v_attempt FROM practical_attempts WHERE id = p_attempt_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'submit_practical_attempt: attempt not found';
    END IF;
    IF v_attempt.user_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'submit_practical_attempt: not the attempt owner';
    END IF;
    IF v_attempt.status = 'submitted' THEN
        RETURN QUERY SELECT v_attempt.score, v_attempt.passed, FALSE, FALSE;
        RETURN;
    END IF;
    IF v_attempt.status = 'superseded' THEN
        RETURN QUERY SELECT NULL::numeric, FALSE, FALSE, TRUE;
        RETURN;
    END IF;
    SELECT current_live_content_version(v_attempt.program_slug, v_attempt.program_version) INTO v_live;
    SELECT bool_and(k.content_version = v_live) INTO v_all_live FROM practical_items k
    WHERE k.id::text IN (SELECT jsonb_array_elements_text(v_attempt.assigned_item_ids));
    IF v_all_live IS DISTINCT FROM TRUE THEN
        PERFORM set_config('app.trusted_server', 'on', TRUE);
        UPDATE practical_attempts SET status = 'superseded'
        WHERE id = p_attempt_id AND status = 'started';
        RETURN QUERY SELECT NULL::numeric, FALSE, FALSE, TRUE;
        RETURN;
    END IF;
    FOR v_iid IN SELECT jsonb_array_elements_text(v_attempt.assigned_item_ids) LOOP
        SELECT k.answer_key, k.item_key INTO v_key, v_ikey FROM practical_items k WHERE k.id::text = v_iid;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'submit_practical_attempt: assigned item missing';
        END IF;
        v_total := v_total + 1;
        IF (p_answers ->> v_ikey) IS NOT NULL
           AND (p_answers ->> v_ikey) <> ''
           AND (p_answers ->> v_ikey) = (v_key ->> 'answer') THEN
            v_correct := v_correct + 1;
        END IF;
    END LOOP;
    IF v_total = 0 THEN v_score := 0;
    ELSE v_score := ROUND((v_correct::numeric / v_total::numeric) * 100, 1); END IF;
    v_passed := v_total > 0 AND v_score >= 80;
    PERFORM set_config('app.trusted_server', 'on', TRUE);
    UPDATE practical_attempts
    SET score = v_score, passed = v_passed, status = 'submitted', submitted_at = NOW()
    WHERE id = p_attempt_id;
    INSERT INTO credential_component_results
        (user_id, program_slug, program_version, component, score, passed,
         authority_source, reference_id)
    VALUES (v_attempt.user_id, v_attempt.program_slug, v_attempt.program_version,
            'practical', v_score, v_passed, 'server_scored_practical', p_attempt_id::text)
    ON CONFLICT (user_id, program_slug, program_version, component)
    DO UPDATE SET score = EXCLUDED.score, passed = EXCLUDED.passed,
                  authority_source = EXCLUDED.authority_source,
                  reference_id = EXCLUDED.reference_id, created_at = NOW();
    RETURN QUERY SELECT v_score, v_passed, TRUE, FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION submit_practical_attempt(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION submit_practical_attempt(UUID, JSONB) TO authenticated;

-- 12. Assessment submit v2: stale finals create zero component. ------------
DROP FUNCTION IF EXISTS submit_assessment(UUID, JSONB);
CREATE OR REPLACE FUNCTION submit_assessment(p_attempt_id UUID, p_answers JSONB)
RETURNS TABLE (score NUMERIC, passed BOOLEAN, submitted BOOLEAN, content_stale BOOLEAN) AS $$
DECLARE
    v_attempt assessment_attempts%ROWTYPE;
    v_program credential_programs%ROWTYPE;
    v_set assessment_question_sets%ROWTYPE;
    v_key JSONB;
    v_qid TEXT;
    v_correct INTEGER := 0;
    v_total INTEGER := 0;
    v_score NUMERIC;
    v_passed BOOLEAN;
    v_break JSONB := '{}'::jsonb;
    v_qskill TEXT;
    v_c INTEGER;
    v_t INTEGER;
    v_live TEXT;
BEGIN
    SELECT * INTO v_attempt FROM assessment_attempts
    WHERE id = p_attempt_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'submit_assessment: attempt not found';
    END IF;
    IF v_attempt.user_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'submit_assessment: not the attempt owner';
    END IF;
    IF v_attempt.status = 'submitted' THEN
        RETURN QUERY SELECT v_attempt.score, v_attempt.passed, FALSE, FALSE;
        RETURN;
    END IF;
    IF v_attempt.status = 'superseded' THEN
        RETURN QUERY SELECT NULL::numeric, FALSE, FALSE, TRUE;
        RETURN;
    END IF;
    IF v_attempt.deadline IS NOT NULL AND NOW() > v_attempt.deadline THEN
        RAISE EXCEPTION 'submit_assessment: deadline_exceeded';
    END IF;
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
    SELECT current_live_content_version(v_attempt.program_slug, v_attempt.question_set_version) INTO v_live;
    IF v_set.content_version IS DISTINCT FROM v_live THEN
        PERFORM set_config('app.trusted_server', 'on', TRUE);
        UPDATE assessment_attempts SET status = 'superseded'
        WHERE id = p_attempt_id AND status = 'started';
        RETURN QUERY SELECT NULL::numeric, FALSE, FALSE, TRUE;
        RETURN;
    END IF;
    SELECT k.answers INTO v_key
    FROM assessment_answer_keys k WHERE k.question_set_id = v_attempt.question_set_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'submit_assessment: question set has no key';
    END IF;
    FOR v_qid IN SELECT jsonb_array_elements_text(
            COALESCE(v_attempt.assigned_question_ids,
                     (SELECT jsonb_agg(q ->> 'id') FROM jsonb_array_elements(v_set.questions) q))) LOOP
        v_total := v_total + 1;
        IF p_answers ->> v_qid IS NOT NULL
           AND (p_answers ->> v_qid) <> ''
           AND (p_answers ->> v_qid) = (v_key ->> v_qid) THEN
            v_correct := v_correct + 1;
        END IF;
    END LOOP;
    FOR v_qskill IN SELECT DISTINCT q ->> 'skill' FROM jsonb_array_elements(v_set.questions) q
            WHERE q ->> 'id' IN (SELECT jsonb_array_elements_text(
                COALESCE(v_attempt.assigned_question_ids,
                         (SELECT jsonb_agg(q2 ->> 'id') FROM jsonb_array_elements(v_set.questions) q2))))
              AND q ->> 'skill' IS NOT NULL LOOP
        SELECT COUNT(*), COUNT(*) FILTER (
            WHERE (p_answers ->> (q ->> 'id')) IS NOT NULL
              AND (p_answers ->> (q ->> 'id')) <> ''
              AND (p_answers ->> (q ->> 'id')) = (v_key ->> (q ->> 'id')))
        INTO v_t, v_c
        FROM jsonb_array_elements(v_set.questions) q
        WHERE (q ->> 'id') IN (SELECT jsonb_array_elements_text(
                COALESCE(v_attempt.assigned_question_ids,
                         (SELECT jsonb_agg(q2 ->> 'id') FROM jsonb_array_elements(v_set.questions) q2))))
          AND (q ->> 'skill') = v_qskill;
        v_break := v_break || jsonb_build_object(v_qskill, jsonb_build_object('correct', v_c, 'total', v_t));
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
        submitted_at = NOW(),
        skill_breakdown = v_break
    WHERE id = p_attempt_id;
    INSERT INTO credential_component_results
        (user_id, program_slug, program_version, component, score, passed,
         authority_source, reference_id)
    VALUES
        (v_attempt.user_id, v_attempt.program_slug, v_attempt.question_set_version,
         'final_assessment', v_score, v_passed, 'server_scored_assessment', p_attempt_id::text)
    ON CONFLICT (user_id, program_slug, program_version, component)
    DO UPDATE SET score = EXCLUDED.score,
                  passed = EXCLUDED.passed,
                  authority_source = EXCLUDED.authority_source,
                  reference_id = EXCLUDED.reference_id,
                  created_at = NOW();
    UPDATE user_credential_progress
    SET status = CASE WHEN v_passed THEN 'ready' ELSE 'remediation' END,
        updated_at = NOW()
    WHERE user_id = v_attempt.user_id
      AND program_slug = v_attempt.program_slug
      AND program_version = v_attempt.question_set_version;
    RETURN QUERY SELECT v_score, v_passed, TRUE, FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION submit_assessment(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION submit_assessment(UUID, JSONB) TO authenticated;
