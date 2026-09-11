-- =====================================================
-- 034 — Live-release gate for NEW attempt starts.
--
-- Gap: start RPCs chose bank rows by `status = 'active'` only.
-- During the load → activation window, new bank rows are already
-- `active` while their release is still `draft`, so a user could
-- start (and solve) an attempt against DRAFT content. The
-- verification / issuance read side correctly refuses to count
-- that release, producing solve-but-no-proof.
--
-- Fix (fail-closed):
--   * every NEW attempt resolves the program's single LIVE release
--     (status active + machine QA passed + human approved) first and
--     selects content ONLY at that content_version;
--   * already-started attempts keep their pinned content untouched;
--   * with no valid live release, starts raise
--     `credential_content_unavailable` (safe server error, no
--     internal metadata leaked).
--
-- No Home/runtime/UI/scoring/evidence/issuance changes.
-- Forward-only: full function replacement, same signatures.
-- =====================================================

-- Single live release resolver. Raises credential_content_unavailable
-- on zero rows AND on ambiguous multiples (exactly one required).
CREATE OR REPLACE FUNCTION current_live_content_version(p_program_slug TEXT, p_program_version TEXT)
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
        RAISE EXCEPTION 'credential_content_unavailable';
    END IF;
    RETURN v_live;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION current_live_content_version(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION current_live_content_version(TEXT, TEXT) TO authenticated;

-- Knowledge start v3: as v2 + NEW attempts pinned to live release. ----
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
    SELECT current_live_content_version(p_program_slug, v_program.version) INTO v_live;
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

-- Practical start v3: as v2 + NEW attempts pinned to live release. -----
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
    SELECT current_live_content_version(p_program_slug, v_program.version) INTO v_live;
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

-- Validation start v3: NEW attempts pinned to live release. ------------
CREATE OR REPLACE FUNCTION start_trusted_validation(p_program_slug TEXT, p_skill_key TEXT)
RETURNS TABLE (attempt_id UUID, skill_key TEXT, program_version TEXT, payload JSONB) AS $$
DECLARE
    v_program credential_programs%ROWTYPE;
    v_item_id UUID;
    v_item_skill TEXT;
    v_item_version TEXT;
    v_attempt_id UUID := gen_random_uuid();
    v_live TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'start_trusted_validation: authentication required';
    END IF;
    SELECT * INTO v_program FROM credential_programs
    WHERE slug = p_program_slug AND status = 'active';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'start_trusted_validation: unknown or inactive program';
    END IF;
    SELECT current_live_content_version(p_program_slug, v_program.version) INTO v_live;
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

-- Assessment start v4: as 029 remediation build + live-release set. ----
-- Existing started attempts still resume their OWN pinned set.
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
    SELECT current_live_content_version(p_program_slug, v_program.version) INTO v_live;
    SELECT * INTO v_set FROM assessment_question_sets
    WHERE program_slug = p_program_slug AND version = v_program.version
      AND status = 'active'
      AND content_version = v_live
    ORDER BY created_at DESC LIMIT 1;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'start_assessment: no question set for this program/version';
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
