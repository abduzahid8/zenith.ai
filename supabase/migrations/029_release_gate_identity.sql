-- =====================================================
-- 029 — Release gate: immutable bank identity, first-sample authority,
-- content releases, project hardening.
--
-- 1. Immutable identity: a content version change ALWAYS creates new rows.
--    UNIQUE(program, version, day) is replaced by
--    UNIQUE(program, version, content_version, day) plus a partial unique
--    allowing only ONE ACTIVE row per logical slot. Same for
--    knowledge/practical (identity gains content_version). Old rows are
--    never mutated across versions: compromised v1 proof cannot resurrect
--    as v2 authority even though historical UUIDs keep working for audit.
-- 2. First-sample authority: trusted_item_results keeps the FIRST
--    finalized result per (user, program, version, item). Retries stay in
--    attempts/events (learning/remediation history) but add ZERO new
--    certification depth. Remediation must use NEW unseen items.
-- 3. credential_content_releases: public metadata (never keys) binding a
--    content version to artifact hash + machine QA + human review.
--    Issuance counts only ACTIVE/APPROVED releases.
-- 4. Project: submit_project requires enrollment; reviews are immutable
--    (new revision, never UPDATE/DELETE); project component follows the
--    LATEST revision (exempt from best-wins, which stays for the rest).
-- =====================================================

-- Immutable slot identity: drop version-blind uniques, add versioned. -----
DO $$
DECLARE
    c TEXT;
BEGIN
    SELECT conname INTO c FROM pg_constraint
    WHERE conrelid = 'trusted_validation_items'::regclass AND contype = 'u'
      AND (conname LIKE '%curriculum_day%' OR conname LIKE '%curri_key%') LIMIT 1;
    IF c IS NOT NULL THEN
        EXECUTE format('ALTER TABLE trusted_validation_items DROP CONSTRAINT %I', c);
    END IF;
    SELECT conname INTO c FROM pg_constraint
    WHERE conrelid = 'knowledge_items'::regclass AND contype = 'u'
      AND conname LIKE '%item_key%' LIMIT 1;
    IF c IS NOT NULL THEN
        EXECUTE format('ALTER TABLE knowledge_items DROP CONSTRAINT %I', c);
    END IF;
    SELECT conname INTO c FROM pg_constraint
    WHERE conrelid = 'practical_items'::regclass AND contype = 'u'
      AND conname LIKE '%item_key%' LIMIT 1;
    IF c IS NOT NULL THEN
        EXECUTE format('ALTER TABLE practical_items DROP CONSTRAINT %I', c);
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trusted_validation_items_versioned_uidx') THEN
        ALTER TABLE trusted_validation_items
            ADD CONSTRAINT trusted_validation_items_versioned_uidx
            UNIQUE (program_slug, program_version, content_version, curriculum_day);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'knowledge_items_versioned_uidx') THEN
        ALTER TABLE knowledge_items
            ADD CONSTRAINT knowledge_items_versioned_uidx
            UNIQUE (program_slug, program_version, content_version, item_key);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'practical_items_versioned_uidx') THEN
        ALTER TABLE practical_items
            ADD CONSTRAINT practical_items_versioned_uidx
            UNIQUE (program_slug, program_version, content_version, item_key);
    END IF;
END
$$;

DROP INDEX IF EXISTS validation_items_one_active_uidx;
CREATE UNIQUE INDEX IF NOT EXISTS validation_items_one_active_uidx
    ON trusted_validation_items (program_slug, program_version, curriculum_day)
    WHERE status = 'active';

DROP INDEX IF EXISTS knowledge_items_one_active_uidx;
CREATE UNIQUE INDEX IF NOT EXISTS knowledge_items_one_active_uidx
    ON knowledge_items (program_slug, program_version, item_key)
    WHERE status = 'active';

DROP INDEX IF EXISTS practical_items_one_active_uidx;
CREATE UNIQUE INDEX IF NOT EXISTS practical_items_one_active_uidx
    ON practical_items (program_slug, program_version, item_key)
    WHERE status = 'active';

-- Results pin their content version (backfilled from latest attempt). ------
ALTER TABLE trusted_item_results
    ADD COLUMN IF NOT EXISTS content_version TEXT;

UPDATE trusted_item_results r
SET content_version = (
    SELECT a.content_version FROM trusted_validation_attempts a
    WHERE a.user_id = r.user_id AND a.item_id = r.item_id AND a.status = 'submitted'
    ORDER BY a.submitted_at DESC LIMIT 1)
WHERE r.content_version IS NULL;

-- First-sample authority: retries never rewrite the certification sample. --
CREATE OR REPLACE FUNCTION submit_trusted_validation(p_attempt_id UUID, p_answer JSONB)
RETURNS TABLE (passed BOOLEAN, submitted BOOLEAN, trusted_event_id TEXT) AS $$
DECLARE
    v_attempt trusted_validation_attempts%ROWTYPE;
    v_item trusted_validation_items%ROWTYPE;
    v_ok BOOLEAN;
    v_event_id TEXT;
    v_prior INTEGER;
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
    -- FIRST finalized result wins: later retries stay auditable in attempts
    -- and events, but contribute zero new certification depth.
    INSERT INTO trusted_item_results
        (user_id, program_slug, program_version, skill_key, item_id,
         content_version, finalized_passed, attempts, last_submitted_at)
    VALUES
        (auth.uid(), v_item.program_slug, v_item.program_version, v_item.skill_key,
         v_item.id, COALESCE(v_attempt.content_version, v_item.content_version),
         v_ok, v_prior, NOW())
    ON CONFLICT (user_id, program_slug, program_version, item_id) DO NOTHING;
    RETURN QUERY SELECT v_ok, TRUE, v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION submit_trusted_validation(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION submit_trusted_validation(UUID, JSONB) TO authenticated;

-- Content releases: public metadata, never keys. ---------------------------
CREATE TABLE IF NOT EXISTS credential_content_releases (
    program_slug TEXT NOT NULL,
    program_version TEXT NOT NULL DEFAULT '1.0',
    content_version TEXT NOT NULL,
    artifact_sha256 TEXT NOT NULL,
    machine_qa_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (machine_qa_status IN ('pending', 'passed', 'failed')),
    human_review_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (human_review_status IN ('pending', 'approved', 'rejected')),
    reviewer TEXT NULL,
    reviewed_at TIMESTAMPTZ NULL,
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'approved', 'active', 'retired', 'compromised')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (program_slug, program_version, content_version)
);

ALTER TABLE credential_content_releases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "releases readable by all" ON credential_content_releases;
CREATE POLICY "releases readable by all"
    ON credential_content_releases FOR SELECT USING (true);
-- No client writes: ops/service-role only.

-- Project submission requires enrollment (no silent auto-enroll). ----------
CREATE OR REPLACE FUNCTION submit_project(
    p_program_slug TEXT, p_artifact_ref TEXT, p_notes TEXT
)
RETURNS TABLE (submission_id UUID) AS $$
DECLARE
    v_program credential_programs%ROWTYPE;
    v_enrollment user_credential_progress%ROWTYPE;
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
    SELECT * INTO v_enrollment FROM user_credential_progress
    WHERE user_id = auth.uid()
      AND program_slug = p_program_slug
      AND program_version = v_program.version;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'submit_project: enrollment_required';
    END IF;
    PERFORM set_config('app.trusted_server', 'on', TRUE);
    INSERT INTO project_submissions (id, user_id, program_slug, version, artifact_ref, notes)
    VALUES (v_sub_id, auth.uid(), v_program.slug, v_program.version, p_artifact_ref, p_notes);
    RETURN QUERY SELECT v_sub_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION submit_project(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION submit_project(TEXT, TEXT, TEXT) TO authenticated;

-- Reviews are immutable: new revision, never UPDATE/DELETE. ----------------
CREATE OR REPLACE FUNCTION project_reviews_freeze_history()
RETURNS TRIGGER AS $$
BEGIN
    IF current_setting('app.review_override', TRUE) = 'on' THEN
        RETURN NEW;
    END IF;
    IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'project_reviews: immutable; insert a new revision instead';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS project_reviews_freeze_history ON project_reviews;
CREATE TRIGGER project_reviews_freeze_history
    BEFORE UPDATE OR DELETE ON project_reviews
    FOR EACH ROW EXECUTE FUNCTION project_reviews_freeze_history();

REVOKE ALL ON FUNCTION project_reviews_freeze_history() FROM PUBLIC, anon, authenticated;

-- Project follows LATEST revision (exempt from best-wins). -----------------
CREATE OR REPLACE FUNCTION component_best_wins()
RETURNS TRIGGER AS $$
BEGIN
    IF current_setting('app.component_override', TRUE) = 'on' THEN
        RETURN NEW;
    END IF;
    -- Project authority is always the latest review revision: an adverse
    -- correction must take effect pre-issuance (issued snapshots stay
    -- frozen regardless).
    IF NEW.component = 'project' THEN
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

REVOKE ALL ON FUNCTION component_best_wins() FROM PUBLIC, anon, authenticated;

-- Remediation must use NEW unseen items (first-sample authority): a pass
-- only counts when its item has no submitted attempt from before the last
-- assessment. Full start_assessment replacement is required for this fix.
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
                -- Fresh proof ONLY: the item must be first-seen after the
                -- last assessment (retries of old items add zero depth).
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

-- Issuance v5: release-gated, version-pinned evidence only. ----------------
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
    -- Final: attempt bank pin must equal the set's version, set ACTIVE,
    -- set's release approved (machine QA passed + human approved).
    SELECT (s.status = 'active'
            AND a.bank_version = s.content_version
            AND EXISTS (SELECT 1 FROM credential_content_releases rel
                        WHERE rel.program_slug = p_program_slug
                          AND rel.program_version = v_program.version
                          AND rel.content_version = s.content_version
                          AND rel.status IN ('active', 'approved')
                          AND rel.machine_qa_status = 'passed'
                          AND rel.human_review_status = 'approved'))
    INTO v_final_set_ok
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
    IF EXISTS (
        SELECT 1 FROM credential_component_results c
        JOIN knowledge_attempts a ON a.id::text = c.reference_id,
        jsonb_array_elements_text(a.assigned_item_ids) AS iid
        JOIN knowledge_items i ON i.id::text = iid
        WHERE c.user_id = auth.uid() AND c.program_slug = p_program_slug
          AND c.program_version = v_program.version AND c.component = 'knowledge'
          AND (i.status <> 'active' OR i.content_version IS DISTINCT FROM a.content_version)) THEN
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
          AND (i.status <> 'active' OR i.content_version IS DISTINCT FROM a.content_version)) THEN
        RAISE EXCEPTION 'issue_credential: practical bank not active';
    END IF;
    -- Competency over FIRST samples on ACTIVE, release-approved items whose
    -- version matches the recorded result version. A rotated row can never
    -- revive old proof: versions must agree on both sides.
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
        JOIN credential_content_releases rel
          ON rel.program_slug = r.program_slug
         AND rel.program_version = r.program_version
         AND rel.content_version = r.content_version
        WHERE r.user_id = auth.uid()
          AND r.program_slug = p_program_slug
          AND r.program_version = v_program.version
          AND r.skill_key = v_skill_key
          AND r.content_version = i.content_version
          AND i.status = 'active'
          AND rel.status IN ('active', 'approved')
          AND rel.machine_qa_status = 'passed'
          AND rel.human_review_status = 'approved';
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
