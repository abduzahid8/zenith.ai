-- =====================================================
-- 036 — Final assessment lifecycle hardening: expiry finalization +
-- server-side readiness gate.
--
-- Problem 1 (deadline trap): 035 always resumed a live `started` Final,
-- even past its deadline. submit then raised `deadline_exceeded` but left
-- the row `started`, and the one-active-attempt unique index made the
-- user permanently stuck.
--
-- Fix: a same-live attempt past its deadline is finalized server-side
-- exactly once as a real failed assessment (status submitted, score 0,
-- passed false, submitted_at pinned to the deadline, zeroed
-- skill_breakdown, failed final component, progress remediation). Both
-- start (structured `expired_finalized` result, never raise-after-write)
-- and late submit (normal 0/false/true/false result) share one internal
-- finalizer. Expiry counts as an attempt: cooldown/remediation apply
-- from the expiry timestamp, so the bank cannot be enumerated for free.
--
-- Rotation precedence is unchanged: a stale-bank attempt is superseded
-- (no failure, no component, no cooldown) even if its old deadline also
-- passed. Expiry applies to live-bank attempts only.
--
-- Problem 2 (no server gate): any authenticated user could mint Final
-- attempts. New attempts now require CURRENT authoritative readiness:
-- all skills server-verified (get_skill_verification semantics), plus
-- live-backed Knowledge and Practical passes (retired references never
-- unlock). Resuming a valid in-flight attempt skips the gate; an
-- already-passed live Final refuses a new attempt (`final_already_passed`).
--
-- Forward-only. No Home/runtime/NBA/Skill-State/scoring/bank/issuance/
-- privacy changes: same signatures, same pass score/limits/policy,
-- keys stay server-only.
-- =====================================================

-- 1. Internal expiry finalizer (never callable by clients). -------------
CREATE OR REPLACE FUNCTION finalize_expired_assessment(p_attempt_id UUID)
RETURNS VOID AS $$
DECLARE
    v_attempt assessment_attempts%ROWTYPE;
    v_set assessment_question_sets%ROWTYPE;
    v_break JSONB := '{}'::jsonb;
    v_qskill TEXT;
    v_t INTEGER;
    v_assigned JSONB;
BEGIN
    SELECT * INTO v_attempt FROM assessment_attempts WHERE id = p_attempt_id;
    -- Already terminal (or missing): idempotent no-op, never double-count.
    IF NOT FOUND OR v_attempt.status <> 'started' THEN
        RETURN;
    END IF;
    -- Not actually expired: never finalize early.
    IF v_attempt.deadline IS NULL OR NOW() <= v_attempt.deadline THEN
        RETURN;
    END IF;
    SELECT * INTO v_set FROM assessment_question_sets WHERE id = v_attempt.question_set_id;
    v_assigned := COALESCE(v_attempt.assigned_question_ids, '[]'::jsonb);
    IF FOUND THEN
        -- Zeroed breakdown over the attempt's own assigned skills.
        -- No correct answers are invented: every skill scores 0/total.
        FOR v_qskill IN
            SELECT DISTINCT q ->> 'skill' FROM jsonb_array_elements(v_set.questions) q
            WHERE q ->> 'id' IN (SELECT jsonb_array_elements_text(v_assigned))
              AND q ->> 'skill' IS NOT NULL
        LOOP
            SELECT COUNT(*) INTO v_t FROM jsonb_array_elements(v_set.questions) q
            WHERE q ->> 'id' IN (SELECT jsonb_array_elements_text(v_assigned))
              AND q ->> 'skill' = v_qskill;
            v_break := v_break || jsonb_build_object(v_qskill, jsonb_build_object('correct', 0, 'total', v_t));
        END LOOP;
    END IF;
    PERFORM set_config('app.trusted_server', 'on', TRUE);
    UPDATE assessment_attempts
    SET status = 'submitted',
        score = 0,
        passed = FALSE,
        submitted_at = COALESCE(v_attempt.deadline, NOW()),
        skill_breakdown = v_break
    WHERE id = p_attempt_id AND status = 'started';
    -- Authoritative failed component through the existing machinery
    -- (best-wins trigger preserves a prior live pass, yields stale ones).
    INSERT INTO credential_component_results
        (user_id, program_slug, program_version, component, score, passed,
         authority_source, reference_id)
    VALUES (v_attempt.user_id, v_attempt.program_slug, v_attempt.question_set_version,
            'final_assessment', 0, FALSE, 'server_scored_assessment', p_attempt_id::text)
    ON CONFLICT (user_id, program_slug, program_version, component)
    DO UPDATE SET score = EXCLUDED.score,
                  passed = EXCLUDED.passed,
                  authority_source = EXCLUDED.authority_source,
                  reference_id = EXCLUDED.reference_id,
                  created_at = NOW();
    -- Failed-assessment progress, pinned to the attempt's own version.
    INSERT INTO user_credential_progress (user_id, program_slug, program_version, status)
    VALUES (v_attempt.user_id, v_attempt.program_slug, v_attempt.question_set_version, 'remediation')
    ON CONFLICT (user_id, program_slug, program_version) DO UPDATE
        SET status = 'remediation', updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION finalize_expired_assessment(UUID) FROM PUBLIC, anon, authenticated;

-- 2. Assessment start v6: expiry finalization + readiness gate. ---------
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
    v_comp_passed BOOLEAN;
    v_comp_ref TEXT;
    v_ref_ver TEXT;
    v_skill_total INTEGER;
    v_skill_unverified INTEGER;
    v_k_passed BOOLEAN;
    v_k_ref TEXT;
    v_k_ver TEXT;
    v_k_ok BOOLEAN := FALSE;
    v_p_passed BOOLEAN;
    v_p_ref TEXT;
    v_p_ver TEXT;
    v_p_ok BOOLEAN := FALSE;
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
            -- Same-live attempt past its deadline: expiration is an
            -- outcome, not rotation. Finalize once, commit, and report
            -- structurally (raising here would roll the write back).
            IF v_existing.deadline IS NOT NULL AND NOW() > v_existing.deadline THEN
                PERFORM finalize_expired_assessment(v_existing.id);
                SELECT * INTO v_old_set FROM assessment_question_sets
                WHERE id = v_existing.question_set_id;
                RETURN QUERY SELECT v_existing.id, v_existing.attempt_number,
                    v_existing.question_set_version, v_old_set.time_limit_minutes,
                    '[]'::jsonb, v_existing.deadline, 'expired_finalized'::text;
                RETURN;
            END IF;
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
    -- A CURRENT authoritative Final pass refuses another attempt. A stale
    -- (retired-content) reference never strands a retake: only a
    -- live-backed pass blocks, mirroring the knowledge/practical gates.
    SELECT c.passed, c.reference_id INTO v_comp_passed, v_comp_ref FROM credential_component_results c
    WHERE c.user_id = auth.uid()
      AND c.program_slug = p_program_slug
      AND c.program_version = v_program.version
      AND c.component = 'final_assessment';
    IF v_comp_passed IS TRUE THEN
        IF v_comp_ref IS NOT NULL THEN
            SELECT component_reference_version('final_assessment', v_comp_ref) INTO v_ref_ver;
            IF v_ref_ver IS NOT NULL AND v_ref_ver IS DISTINCT FROM v_live THEN
                v_comp_passed := FALSE;
            END IF;
        END IF;
        IF v_comp_passed IS TRUE THEN
            RAISE EXCEPTION 'final_already_passed';
        END IF;
    END IF;
    -- Server readiness gate for NEW attempts (resumes above skip it):
    -- every required skill server-verified (no client state), plus
    -- live-backed Knowledge and Practical passes. Retired references
    -- never unlock.
    SELECT COUNT(*), COUNT(*) FILTER (WHERE NOT verified)
    INTO v_skill_total, v_skill_unverified
    FROM get_skill_verification(p_program_slug);
    IF v_skill_total = 0 OR v_skill_unverified > 0 THEN
        RAISE EXCEPTION 'final_not_ready:skills';
    END IF;
    SELECT c.passed, c.reference_id INTO v_k_passed, v_k_ref FROM credential_component_results c
    WHERE c.user_id = auth.uid()
      AND c.program_slug = p_program_slug
      AND c.program_version = v_program.version
      AND c.component = 'knowledge';
    IF v_k_passed IS TRUE THEN
        IF v_k_ref IS NULL THEN
            v_k_ok := TRUE;
        ELSE
            SELECT component_reference_version('knowledge', v_k_ref) INTO v_k_ver;
            IF v_k_ver IS NULL OR v_k_ver IS NOT DISTINCT FROM v_live THEN
                v_k_ok := TRUE;
            END IF;
        END IF;
    END IF;
    IF NOT v_k_ok THEN
        RAISE EXCEPTION 'final_not_ready:knowledge';
    END IF;
    SELECT c.passed, c.reference_id INTO v_p_passed, v_p_ref FROM credential_component_results c
    WHERE c.user_id = auth.uid()
      AND c.program_slug = p_program_slug
      AND c.program_version = v_program.version
      AND c.component = 'practical';
    IF v_p_passed IS TRUE THEN
        IF v_p_ref IS NULL THEN
            v_p_ok := TRUE;
        ELSE
            SELECT component_reference_version('practical', v_p_ref) INTO v_p_ver;
            IF v_p_ver IS NULL OR v_p_ver IS NOT DISTINCT FROM v_live THEN
                v_p_ok := TRUE;
            END IF;
        END IF;
    END IF;
    IF NOT v_p_ok THEN
        RAISE EXCEPTION 'final_not_ready:practical';
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

-- 3. Assessment submit v3: late live submits finalize failure. -----------
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
    SELECT * INTO v_attempt FROM assessment_attempts WHERE id = p_attempt_id FOR UPDATE;
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
    -- Same-live late submit: rotation took precedence above, so this is a
    -- genuine expiry. Finalize failure with identical semantics (never
    -- throw after the write; the row lock makes repeats idempotent).
    IF v_attempt.deadline IS NOT NULL AND NOW() > v_attempt.deadline THEN
        PERFORM finalize_expired_assessment(p_attempt_id);
        RETURN QUERY SELECT 0::numeric, FALSE, TRUE, FALSE;
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
