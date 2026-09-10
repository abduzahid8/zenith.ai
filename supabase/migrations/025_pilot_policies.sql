-- =====================================================
-- 025 — Pilot policies: balanced exams, project authority, attempt
-- discipline, best-score components, review revisions.
--
-- - Final assignment is balanced: EXACTLY 5 questions per program skill
--   (fewer when a skill bank is smaller), shuffled, persisted per attempt.
-- - Active attempts load questions from THEIR OWN pinned set, never the
--   newest bank (safe across bank rotations/corrections).
-- - Project submissions go through submit_project: server derives owner,
--   enrollment, program, pinned version. Direct client INSERT is revoked.
--   Post-review submission edits are locked; reviews are immutable
--   revisions (latest feeds results; issued snapshots never mutate).
-- - Knowledge/practical/final components keep the BEST passed score:
--   later fails (or lower passes) never erase a pass, and passed
--   components cannot be farmed by retake (new starts blocked).
-- - Knowledge/practical: one active attempt per user/program/version.
-- =====================================================

-- Project submission RPC: server owns identity. ---------------------------
CREATE OR REPLACE FUNCTION submit_project(
    p_program_slug TEXT, p_artifact_ref TEXT, p_notes TEXT
)
RETURNS TABLE (submission_id UUID) AS $$
DECLARE
    v_program credential_programs%ROWTYPE;
    v_sub_id UUID := gen_random_uuid();
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'submit_project: authentication required';
    END IF;
    SELECT * INTO v_program FROM credential_programs
    WHERE slug = p_program_slug AND status = 'active';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'submit_project: unknown or inactive program';
    END IF;
    PERFORM set_config('app.trusted_server', 'on', TRUE);
    INSERT INTO user_credential_progress (user_id, program_slug, program_version, status)
    VALUES (auth.uid(), v_program.slug, v_program.version, 'learning')
    ON CONFLICT (user_id, program_slug, program_version) DO NOTHING;
    INSERT INTO project_submissions (id, user_id, program_slug, version, artifact_ref, notes)
    VALUES (v_sub_id, auth.uid(), v_program.slug, v_program.version, p_artifact_ref, p_notes);
    RETURN QUERY SELECT v_sub_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION submit_project(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION submit_project(TEXT, TEXT, TEXT) TO authenticated;

-- No direct client INSERT: the RPC is the only creation path.
DROP POLICY IF EXISTS "users manage own project submissions" ON project_submissions;
DROP POLICY IF EXISTS "users read own project submissions" ON project_submissions;
DROP POLICY IF EXISTS "users update own project submissions" ON project_submissions;
CREATE POLICY "users read own project submissions"
    ON project_submissions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "users update own project submissions"
    ON project_submissions FOR UPDATE
    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Post-review submissions are frozen (review binding must not drift).
CREATE OR REPLACE FUNCTION project_submissions_freeze_reviewed()
RETURNS TRIGGER AS $$
BEGIN
    IF current_setting('app.trusted_server', TRUE) = 'on' THEN
        RETURN NEW;
    END IF;
    IF EXISTS (SELECT 1 FROM project_reviews r WHERE r.submission_id = OLD.id) THEN
        RAISE EXCEPTION 'project_submissions: reviewed submission is frozen';
    END IF;
    NEW.user_id := OLD.user_id;
    NEW.program_slug := OLD.program_slug;
    NEW.version := OLD.version;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS project_submissions_freeze_reviewed ON project_submissions;
CREATE TRIGGER project_submissions_freeze_reviewed
    BEFORE UPDATE ON project_submissions
    FOR EACH ROW EXECUTE FUNCTION project_submissions_freeze_reviewed();

REVOKE ALL ON FUNCTION project_submissions_freeze_reviewed() FROM PUBLIC, anon, authenticated;

-- Review revisions: immutable, latest feeds results. ----------------------
ALTER TABLE project_reviews
    ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 1;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_reviews_submission_id_key') THEN
        ALTER TABLE project_reviews DROP CONSTRAINT project_reviews_submission_id_key;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_reviews_submission_revision_uidx') THEN
        ALTER TABLE project_reviews
            ADD CONSTRAINT project_reviews_submission_revision_uidx
            UNIQUE (submission_id, revision);
    END IF;
END
$$;

-- One active knowledge/practical attempt per user/program/version. ---------
DROP INDEX IF EXISTS knowledge_attempts_one_active_uidx;
CREATE UNIQUE INDEX IF NOT EXISTS knowledge_attempts_one_active_uidx
    ON knowledge_attempts (user_id, program_slug, program_version)
    WHERE status = 'started';

DROP INDEX IF EXISTS practical_attempts_one_active_uidx;
CREATE UNIQUE INDEX IF NOT EXISTS practical_attempts_one_active_uidx
    ON practical_attempts (user_id, program_slug, program_version)
    WHERE status = 'started';

-- Knowledge start v2: active attempt, no retake after pass, version pin. --
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
    SELECT c.passed INTO v_comp_passed FROM credential_component_results c
    WHERE c.user_id = auth.uid()
      AND c.program_slug = p_program_slug
      AND c.program_version = v_program.version
      AND c.component = 'knowledge';
    IF v_comp_passed IS TRUE THEN
        RAISE EXCEPTION 'start_knowledge_attempt: component already passed';
    END IF;
    SELECT * INTO v_existing FROM knowledge_attempts
    WHERE knowledge_attempts.user_id = auth.uid()
      AND knowledge_attempts.program_slug = p_program_slug
      AND knowledge_attempts.program_version = v_program.version
      AND knowledge_attempts.status = 'started'
    ORDER BY started_at DESC LIMIT 1;
    IF FOUND THEN
        RETURN QUERY SELECT v_existing.id, v_existing.program_version,
            (SELECT jsonb_agg(jsonb_build_object('item_key', k.item_key, 'skill', k.skill_key, 'payload', k.payload) ORDER BY k.skill_key)
             FROM knowledge_items k WHERE k.id::text IN (SELECT jsonb_array_elements_text(v_existing.assigned_item_ids)));
        RETURN;
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
            GROUP BY i.id, i.created_at
            ORDER BY MAX(a.started_at) NULLS FIRST, i.created_at
            LIMIT 2
        LOOP
            v_ids := v_ids || vAid;
        END LOOP;
    END LOOP;
    IF array_length(v_ids, 1) IS NULL THEN
        RAISE EXCEPTION 'start_knowledge_attempt: no knowledge content for this program';
    END IF;
    PERFORM set_config('app.trusted_server', 'on', TRUE);
    INSERT INTO knowledge_attempts (id, user_id, program_slug, program_version, assigned_item_ids, status, content_version)
    VALUES (v_attempt_id, auth.uid(), v_program.slug, v_program.version,
            (SELECT jsonb_agg(x) FROM UNNEST(v_ids) x), 'started',
            (SELECT CASE WHEN COUNT(DISTINCT i.content_version) = 1
                         THEN MIN(i.content_version) ELSE 'mixed' END
             FROM knowledge_items i WHERE i.id = ANY (v_ids)));
    RETURN QUERY SELECT v_attempt_id, v_program.version,
        (SELECT jsonb_agg(jsonb_build_object('item_key', k.item_key, 'skill', k.skill_key, 'payload', k.payload) ORDER BY k.skill_key)
         FROM knowledge_items k WHERE k.id = ANY (v_ids));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION start_knowledge_attempt(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION start_knowledge_attempt(TEXT) TO authenticated;

-- Practical start v2: same discipline. -------------------------------------
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
    SELECT c.passed INTO v_comp_passed FROM credential_component_results c
    WHERE c.user_id = auth.uid()
      AND c.program_slug = p_program_slug
      AND c.program_version = v_program.version
      AND c.component = 'practical';
    IF v_comp_passed IS TRUE THEN
        RAISE EXCEPTION 'start_practical_attempt: component already passed';
    END IF;
    SELECT * INTO v_existing FROM practical_attempts
    WHERE practical_attempts.user_id = auth.uid()
      AND practical_attempts.program_slug = p_program_slug
      AND practical_attempts.program_version = v_program.version
      AND practical_attempts.status = 'started'
    ORDER BY started_at DESC LIMIT 1;
    IF FOUND THEN
        RETURN QUERY SELECT v_existing.id, v_existing.program_version,
            (SELECT jsonb_agg(jsonb_build_object('item_key', k.item_key, 'skill', k.skill_key, 'payload', k.payload) ORDER BY k.skill_key)
             FROM practical_items k WHERE k.id::text IN (SELECT jsonb_array_elements_text(v_existing.assigned_item_ids)));
        RETURN;
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
            GROUP BY i.id, i.created_at
            ORDER BY MAX(a.started_at) NULLS FIRST, i.created_at
            LIMIT 2
        LOOP
            v_ids := v_ids || vAid;
        END LOOP;
    END LOOP;
    IF array_length(v_ids, 1) IS NULL THEN
        RAISE EXCEPTION 'start_practical_attempt: no practical content for this program';
    END IF;
    PERFORM set_config('app.trusted_server', 'on', TRUE);
    INSERT INTO practical_attempts (id, user_id, program_slug, program_version, assigned_item_ids, status, content_version)
    VALUES (v_attempt_id, auth.uid(), v_program.slug, v_program.version,
            (SELECT jsonb_agg(x) FROM UNNEST(v_ids) x), 'started',
            (SELECT CASE WHEN COUNT(DISTINCT i.content_version) = 1
                         THEN MIN(i.content_version) ELSE 'mixed' END
             FROM practical_items i WHERE i.id = ANY (v_ids)));
    RETURN QUERY SELECT v_attempt_id, v_program.version,
        (SELECT jsonb_agg(jsonb_build_object('item_key', k.item_key, 'skill', k.skill_key, 'payload', k.payload) ORDER BY k.skill_key)
         FROM practical_items k WHERE k.id = ANY (v_ids));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION start_practical_attempt(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION start_practical_attempt(TEXT) TO authenticated;

-- Best-passed-wins, enforced at the table so every writer (present and
-- future) obeys it: a later fail — or a lower pass — can never erase an
-- existing pass. Grade farming downward is impossible by construction.
CREATE OR REPLACE FUNCTION component_best_wins()
RETURNS TRIGGER AS $$
BEGIN
    -- Explicit ops correction hatch (manual SET only, never set by flows).
    IF current_setting('app.component_override', TRUE) = 'on' THEN
        RETURN NEW;
    END IF;
    IF TG_OP = 'UPDATE'
       AND OLD.passed IS TRUE
       AND (NEW.passed IS DISTINCT FROM TRUE OR NEW.score <= OLD.score) THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS component_best_wins ON credential_component_results;
CREATE TRIGGER component_best_wins
    BEFORE INSERT OR UPDATE ON credential_component_results
    FOR EACH ROW EXECUTE FUNCTION component_best_wins();

REVOKE ALL ON FUNCTION component_best_wins() FROM PUBLIC, anon, authenticated;

-- Validation start v2: active banks only + content pin. --------------------
CREATE OR REPLACE FUNCTION start_trusted_validation(p_program_slug TEXT, p_skill_key TEXT)
RETURNS TABLE (attempt_id UUID, skill_key TEXT, program_version TEXT, payload JSONB) AS $$
DECLARE
    v_program credential_programs%ROWTYPE;
    v_item_id UUID;
    v_item_skill TEXT;
    v_item_version TEXT;
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
    SELECT i.id, i.skill_key, i.content_version INTO v_item_id, v_item_skill, v_item_version
    FROM trusted_validation_items i
    LEFT JOIN trusted_validation_attempts a
      ON a.item_id = i.id AND a.user_id = auth.uid()
    WHERE i.program_slug = p_program_slug
      AND i.program_version = v_program.version
      AND i.skill_key = p_skill_key
      AND i.status = 'active'
    GROUP BY i.id, i.skill_key, i.content_version, i.created_at
    ORDER BY MAX(a.started_at) NULLS FIRST, i.created_at, i.id
    LIMIT 1;
    IF v_item_id IS NULL THEN
        RAISE EXCEPTION 'start_trusted_validation: no trusted content for this program/skill';
    END IF;
    PERFORM set_config('app.trusted_server', 'on', TRUE);
    INSERT INTO trusted_validation_attempts
        (id, user_id, item_id, program_slug, program_version, skill_key, status, content_version)
    VALUES
        (v_attempt_id, auth.uid(), v_item_id, v_program.slug, v_program.version, v_item_skill, 'started', v_item_version);
    RETURN QUERY
    SELECT v_attempt_id, v_item_skill, v_program.version,
        (SELECT trusted_validation_items.payload FROM trusted_validation_items
         WHERE trusted_validation_items.id = v_item_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION start_trusted_validation(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION start_trusted_validation(TEXT, TEXT) TO authenticated;

-- Assessment start v3: balanced 5-per-skill assignment, own-set pinning. --
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
    SELECT * INTO v_set FROM assessment_question_sets
    WHERE program_slug = p_program_slug AND version = v_program.version
      AND status = 'active'
    ORDER BY created_at DESC LIMIT 1;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'start_assessment: no question set for this program/version';
    END IF;
    SELECT * INTO v_existing FROM assessment_attempts
    WHERE assessment_attempts.user_id = auth.uid()
      AND assessment_attempts.program_slug = p_program_slug
      AND assessment_attempts.question_set_version = v_program.version
      AND assessment_attempts.status = 'started'
    ORDER BY started_at DESC LIMIT 1;
    IF FOUND THEN
        -- Pin to the attempt's OWN bank: load its set, not the newest.
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
    -- Balanced assignment: EXACTLY 5 per program skill (or all when a skill
    -- bank is smaller), shuffled across skills, persisted on the attempt.
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

-- Issuance v4: active banks only + revoked re-issue workflow. -------------
DROP FUNCTION IF EXISTS issue_credential(TEXT, TEXT);
CREATE OR REPLACE FUNCTION issue_credential(p_program_slug TEXT, p_holder_name TEXT)
RETURNS TABLE (credential_id TEXT, created BOOLEAN) AS $$
DECLARE
    v_program credential_programs%ROWTYPE;
    v_enrollment user_credential_progress%ROWTYPE;
    v_knowledge NUMERIC;
    v_practical NUMERIC;
    v_final NUMERIC;
    v_project NUMERIC;
    v_final_passed BOOLEAN;
    v_project_passed BOOLEAN;
    v_knowledge_passed BOOLEAN;
    v_practical_passed BOOLEAN;
    v_skill JSONB;
    v_skill_key TEXT;
    v_policy skill_evidence_policy%ROWTYPE;
    v_items INTEGER;
    v_passes INTEGER;
    v_rate NUMERIC;
    v_skill_score NUMERIC;
    v_verified JSONB := '[]'::jsonb;
    v_overall NUMERIC;
    v_grade TEXT;
    v_new_id TEXT;
    v_existing_id TEXT;
    v_existing_status TEXT;
    v_final_set_ok BOOLEAN;
BEGIN
    SELECT * INTO v_program FROM credential_programs
    WHERE slug = p_program_slug AND status = 'active';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'issue_credential: unknown or inactive program';
    END IF;
    IF NOT v_program.issuance_enabled THEN
        RAISE EXCEPTION 'issue_credential: program not issuance-ready';
    END IF;
    -- Idempotent return comes BEFORE gate evaluation: an ACTIVE credential
    -- is a frozen snapshot. Later revisions/corrections never mutate it;
    -- they govern future (re-)issuance only. Revoked credentials fall
    -- through to the correction workflow below.
    SELECT c.credential_id, c.status INTO v_existing_id, v_existing_status
    FROM issued_credentials c
    WHERE c.user_id = auth.uid()
      AND c.program_slug = p_program_slug
      AND c.program_version = v_program.version;
    IF FOUND AND v_existing_status = 'active' THEN
        RETURN QUERY SELECT v_existing_id, FALSE;
        RETURN;
    END IF;
    SELECT * INTO v_enrollment FROM user_credential_progress
    WHERE user_id = auth.uid()
      AND program_slug = p_program_slug
      AND program_version = v_program.version;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'issue_credential: enrollment required';
    END IF;
    SELECT score, passed INTO v_final, v_final_passed FROM credential_component_results
    WHERE user_id = auth.uid() AND program_slug = p_program_slug
      AND program_version = v_program.version AND component = 'final_assessment';
    IF v_final IS NULL OR v_final_passed IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'issue_credential: component_missing_or_failed:final_assessment';
    END IF;
    -- The final must come from an ACTIVE bank (rotations invalidate old).
    SELECT (s.status = 'active') INTO v_final_set_ok
    FROM credential_component_results c
    JOIN assessment_attempts a ON a.id::text = c.reference_id
    JOIN assessment_question_sets s ON s.id = a.question_set_id
    WHERE c.user_id = auth.uid() AND c.program_slug = p_program_slug
      AND c.program_version = v_program.version AND c.component = 'final_assessment';
    IF v_final_set_ok IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'issue_credential: final_assessment bank not active';
    END IF;
    SELECT score, passed INTO v_project, v_project_passed FROM credential_component_results
    WHERE user_id = auth.uid() AND program_slug = p_program_slug
      AND program_version = v_program.version AND component = 'project';
    IF v_project IS NULL OR v_project_passed IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'issue_credential: component_missing_or_failed:project';
    END IF;
    SELECT score, passed INTO v_knowledge, v_knowledge_passed FROM credential_component_results
    WHERE user_id = auth.uid() AND program_slug = p_program_slug
      AND program_version = v_program.version AND component = 'knowledge';
    IF v_knowledge IS NULL OR v_knowledge_passed IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'issue_credential: component_missing_or_failed:knowledge';
    END IF;
    -- Knowledge answers must all come from ACTIVE items.
    IF EXISTS (
        SELECT 1 FROM credential_component_results c
        JOIN knowledge_attempts a ON a.id::text = c.reference_id,
        jsonb_array_elements_text(a.assigned_item_ids) AS iid
        JOIN knowledge_items i ON i.id::text = iid
        WHERE c.user_id = auth.uid() AND c.program_slug = p_program_slug
          AND c.program_version = v_program.version AND c.component = 'knowledge'
          AND i.status <> 'active') THEN
        RAISE EXCEPTION 'issue_credential: knowledge bank not active';
    END IF;
    SELECT score, passed INTO v_practical, v_practical_passed FROM credential_component_results
    WHERE user_id = auth.uid() AND program_slug = p_program_slug
      AND program_version = v_program.version AND component = 'practical';
    IF v_practical IS NULL OR v_practical_passed IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'issue_credential: component_missing_or_failed:practical';
    END IF;
    IF EXISTS (
        SELECT 1 FROM credential_component_results c
        JOIN practical_attempts a ON a.id::text = c.reference_id,
        jsonb_array_elements_text(a.assigned_item_ids) AS iid
        JOIN practical_items i ON i.id::text = iid
        WHERE c.user_id = auth.uid() AND c.program_slug = p_program_slug
          AND c.program_version = v_program.version AND c.component = 'practical'
          AND i.status <> 'active') THEN
        RAISE EXCEPTION 'issue_credential: practical bank not active';
    END IF;
    -- Competency over FINALIZED per-item results on ACTIVE items only.
    FOR v_skill IN SELECT jsonb_array_elements(v_program.skills) LOOP
        v_skill_key := v_skill ->> 'key';
        SELECT * INTO v_policy FROM skill_evidence_policy
        WHERE program_slug = p_program_slug
          AND program_version = v_program.version
          AND skill_key = v_skill_key;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'issue_credential: no evidence policy for skill:%', v_skill_key;
        END IF;
        SELECT COUNT(*), COUNT(*) FILTER (WHERE r.finalized_passed)
        INTO v_items, v_passes
        FROM trusted_item_results r
        JOIN trusted_validation_items i ON i.id = r.item_id
        WHERE r.user_id = auth.uid()
          AND r.program_slug = p_program_slug
          AND r.program_version = v_program.version
          AND r.skill_key = v_skill_key
          AND i.status = 'active';
        IF v_items < v_policy.min_items THEN
            RAISE EXCEPTION 'issue_credential: skill_gate_failed:%', v_skill_key;
        END IF;
        v_rate := (v_passes::numeric / v_items::numeric);
        v_skill_score := ROUND(v_rate * 100, 1);
        IF v_rate < v_policy.min_pass_rate
           OR v_skill_score < COALESCE((v_skill ->> 'minimumScore')::numeric, 65) THEN
            RAISE EXCEPTION 'issue_credential: skill_gate_failed:%', v_skill_key;
        END IF;
        v_verified := v_verified || jsonb_build_object(
            'key', v_skill_key,
            'name', v_skill ->> 'name',
            'score', v_skill_score
        );
    END LOOP;
    v_overall := ROUND(
        v_knowledge * 0.25 + v_practical * 0.30 + v_final * 0.25 + v_project * 0.20, 1);
    IF v_overall < v_program.required_score THEN
        RAISE EXCEPTION 'issue_credential: overall requirement not met';
    END IF;
    v_grade := CASE WHEN v_overall >= 95 THEN 'distinction'
                   WHEN v_overall >= 90 THEN 'excellence'
                   WHEN v_overall >= 85 THEN 'merit'
                   ELSE 'pass' END;
    -- Issued snapshots are immutable. A REVOKED credential is replaced
    -- (explicit correction workflow), never edited.
    IF FOUND THEN
        PERFORM set_config('app.trusted_server', 'on', TRUE);
        DELETE FROM issued_credentials WHERE issued_credentials.credential_id = v_existing_id;
    END IF;
    v_new_id := 'ZNX-' || ENCODE(gen_random_bytes(16), 'hex');
    PERFORM set_config('app.trusted_server', 'on', TRUE);
    INSERT INTO issued_credentials (
        credential_id, user_id, program_slug, program_title, program_version,
        holder_display_name, identity_verified, final_score, grade,
        verified_skills, evidence_summary, status
    ) VALUES (
        v_new_id, auth.uid(), v_program.slug, v_program.title, v_program.version,
        NULLIF(TRIM(p_holder_name), ''), FALSE, v_overall, v_grade,
        v_verified,
        jsonb_build_object(
            'knowledge', v_knowledge, 'practical', v_practical,
            'finalAssessment', v_final, 'project', v_project,
            'programVersion', v_program.version
        ),
        'active'
    )
    ON CONFLICT (user_id, program_slug, program_version) DO NOTHING
    RETURNING issued_credentials.credential_id INTO v_existing_id;
    UPDATE user_credential_progress
    SET status = 'passed', updated_at = NOW()
    WHERE user_id = auth.uid()
      AND program_slug = p_program_slug
      AND program_version = v_program.version;
    IF v_existing_id IS NOT NULL THEN
        RETURN QUERY SELECT v_existing_id, TRUE;
        RETURN;
    END IF;
    SELECT c.credential_id INTO v_existing_id FROM issued_credentials c
    WHERE c.user_id = auth.uid()
      AND c.program_slug = p_program_slug
      AND c.program_version = v_program.version;
    RETURN QUERY SELECT v_existing_id, FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION issue_credential(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION issue_credential(TEXT, TEXT) TO authenticated;
