-- =====================================================
-- 019 — Authority fixes: fail evidence, mandatory pass, retakes,
-- concurrency, exam privacy, enrollment versions, deadlines.
--
-- 1. submit_trusted_validation records EVERY finalized attempt as an
--    immutable server-scored event: pass -> outcome pass, fail -> outcome
--    fail, both trusted=true. "Trusted" means server-verified, not passed.
--    Per-item finalized results feed competency (latest per item wins;
--    history stays auditable in attempts + events).
-- 2. credential_component_results gains passed: score presence != passed.
-- 3. start_assessment enforces the frozen retake policy server-side
--    (attempt1 allowed / 24h cooldown / remediation for 3+) and returns
--    the active started attempt instead of racing duplicates.
-- 4. Final-exam bank privacy: direct client SELECT on question sets is
--    revoked; the safe payload comes only from start_assessment.
-- 5. Attempts carry assigned_question_ids + deadline; submit scores only
--    assigned ids and rejects late submits. Per-skill breakdown is stored
--    for remediation targeting.
-- 6. Enrollment PK becomes (user, program, version): a future v1.1 journey
--    never silently overwrites v1.0. Historical credentials stay pinned.
-- =====================================================

-- Per-item finalized competency (latest result per item counts once). ----
CREATE TABLE IF NOT EXISTS trusted_item_results (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    program_slug TEXT NOT NULL,
    program_version TEXT NOT NULL DEFAULT '1.0',
    skill_key TEXT NOT NULL,
    item_id UUID NOT NULL,
    finalized_passed BOOLEAN NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 1,
    last_submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, program_slug, program_version, item_id)
);

ALTER TABLE trusted_item_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own item results" ON trusted_item_results;
CREATE POLICY "users read own item results"
    ON trusted_item_results FOR SELECT USING (user_id = auth.uid());
-- No client writes: maintained by submit_trusted_validation only.

-- Evidence-depth policy (server-configurable, documented rationale):
-- min 3 DISTINCT finalized items per skill (one lucky guess cannot
-- certify a weekly skill: P(>=2/3 lucky at 33% guess) < 8%), pass rate
-- >= 0.65 aligning the frozen per-skill minimumScore of 65.
CREATE TABLE IF NOT EXISTS skill_evidence_policy (
    program_slug TEXT NOT NULL,
    program_version TEXT NOT NULL DEFAULT '1.0',
    skill_key TEXT NOT NULL,
    min_items INTEGER NOT NULL DEFAULT 3,
    min_pass_rate NUMERIC NOT NULL DEFAULT 0.65,
    rationale TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (program_slug, program_version, skill_key)
);

ALTER TABLE skill_evidence_policy ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "evidence policy readable by all" ON skill_evidence_policy;
CREATE POLICY "evidence policy readable by all"
    ON skill_evidence_policy FOR SELECT USING (true);
-- No client writes: service-role configured.

-- Server-scored validation submit v2: fail rows are proof too. -----------
DROP FUNCTION IF EXISTS submit_trusted_validation(UUID, JSONB);
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
    -- EVERY finalized attempt becomes immutable server-verified evidence.
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
    -- Latest result per item wins for competency; attempts accumulate.
    SELECT COUNT(*) INTO v_prior FROM trusted_validation_attempts
    WHERE user_id = auth.uid() AND item_id = v_item.id AND status = 'submitted';
    INSERT INTO trusted_item_results
        (user_id, program_slug, program_version, skill_key, item_id,
         finalized_passed, attempts, last_submitted_at)
    VALUES
        (auth.uid(), v_item.program_slug, v_item.program_version, v_item.skill_key,
         v_item.id, v_ok, v_prior, NOW())
    ON CONFLICT (user_id, program_slug, program_version, item_id)
    DO UPDATE SET finalized_passed = EXCLUDED.finalized_passed,
                  attempts = EXCLUDED.attempts,
                  last_submitted_at = EXCLUDED.last_submitted_at;
    RETURN QUERY SELECT v_ok, TRUE, v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION submit_trusted_validation(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION submit_trusted_validation(UUID, JSONB) TO authenticated;

-- Skill-based item selection: server picks unseen/least-recent item. -----
-- The day-pinned starter is replaced: clients must never address the exact
-- answer-key item. (Old signature dropped; callers migrate to skill scope.)
DROP FUNCTION IF EXISTS start_trusted_validation(TEXT, INTEGER);
CREATE OR REPLACE FUNCTION start_trusted_validation(p_program_slug TEXT, p_skill_key TEXT)
RETURNS TABLE (attempt_id UUID, skill_key TEXT, program_version TEXT, payload JSONB) AS $$
DECLARE
    v_program credential_programs%ROWTYPE;
    v_item_id UUID;
    v_item_skill TEXT;
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
    -- Least-recently-attempted valid item first (unseen items sort first),
    -- so users cannot farm one known challenge.
    SELECT i.id, i.skill_key INTO v_item_id, v_item_skill
    FROM trusted_validation_items i
    LEFT JOIN trusted_validation_attempts a
      ON a.item_id = i.id AND a.user_id = auth.uid()
    WHERE i.program_slug = p_program_slug
      AND i.program_version = v_program.version
      AND i.skill_key = p_skill_key
    GROUP BY i.id, i.skill_key, i.created_at
    ORDER BY MAX(a.started_at) NULLS FIRST, i.created_at, i.id
    LIMIT 1;
    IF v_item_id IS NULL THEN
        RAISE EXCEPTION 'start_trusted_validation: no trusted content for this program/skill';
    END IF;
    PERFORM set_config('app.trusted_server', 'on', TRUE);
    INSERT INTO trusted_validation_attempts
        (id, user_id, item_id, program_slug, program_version, skill_key, status)
    VALUES
        (v_attempt_id, auth.uid(), v_item_id, v_program.slug, v_program.version, v_item_skill, 'started');
    RETURN QUERY
    SELECT v_attempt_id, v_item_skill, v_program.version,
        (SELECT trusted_validation_items.payload FROM trusted_validation_items
         WHERE trusted_validation_items.id = v_item_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION start_trusted_validation(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION start_trusted_validation(TEXT, TEXT) TO authenticated;

-- Components carry pass state (score presence != passed). -----------------
ALTER TABLE credential_component_results
    ADD COLUMN IF NOT EXISTS passed BOOLEAN;

-- Backfill from authoritative sources: final via its attempt, project via
-- its certification result. Knowledge/practical rows (if any) stay
-- NULL-passed until rewritten by server flows (never inferred).
UPDATE credential_component_results c
SET passed = a.passed
FROM assessment_attempts a
WHERE c.component = 'final_assessment'
  AND a.id::text = c.reference_id
  AND c.passed IS NULL;

UPDATE credential_component_results c
SET passed = r.passed
FROM project_certification_results r
WHERE c.component = 'project'
  AND r.id::text = c.reference_id
  AND c.passed IS NULL;

-- Attempts: assigned set, deadline, per-skill breakdown. ------------------
ALTER TABLE assessment_attempts
    ADD COLUMN IF NOT EXISTS assigned_question_ids JSONB,
    ADD COLUMN IF NOT EXISTS deadline TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS skill_breakdown JSONB;

-- Enrollment PK gains the version: v1.1 can never overwrite v1.0. ---------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_credential_progress_pkey') THEN
        ALTER TABLE user_credential_progress DROP CONSTRAINT user_credential_progress_pkey;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_credential_progress_pkey') THEN
        ALTER TABLE user_credential_progress
            ADD CONSTRAINT user_credential_progress_pkey
            PRIMARY KEY (user_id, program_slug, program_version);
    END IF;
END
$$;

-- Enrollment helper targets the versioned key. -----------------------------
CREATE OR REPLACE FUNCTION enroll_in_program(p_program_slug TEXT)
RETURNS TABLE (enrolled BOOLEAN) AS $$
BEGIN
    INSERT INTO user_credential_progress (user_id, program_slug, program_version, status)
    SELECT auth.uid(), p.slug, p.version, 'learning'
    FROM credential_programs p WHERE p.slug = p_program_slug AND p.status = 'active'
    ON CONFLICT (user_id, program_slug, program_version) DO NOTHING;
    IF FOUND THEN
        RETURN QUERY SELECT TRUE;
    ELSE
        RETURN QUERY SELECT FALSE;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION enroll_in_program(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION enroll_in_program(TEXT) TO authenticated;

-- Exam bank privacy: no direct client reads of the final exam. ------------
DROP POLICY IF EXISTS "question sets readable by authenticated" ON assessment_question_sets;

-- Retake-aware, race-safe assessment start. --------------------------------
-- Frozen policy, server-enforced: attempt 1 allowed; attempt 2 after a 24h
-- cooldown; attempt 3+ only with fresh server-scored validation proof on
-- every skill the last attempt left below minimum (remediation). One active
-- started attempt per (user, program, version): concurrent starts return
-- the same attempt (advisory lock + partial unique index backstop).
DROP INDEX IF EXISTS assessment_attempts_one_active_uidx;
CREATE UNIQUE INDEX IF NOT EXISTS assessment_attempts_one_active_uidx
    ON assessment_attempts (user_id, program_slug, question_set_version)
    WHERE status = 'started';

-- Return shape grows (deadline, retake_reason): drop first, since Postgres
-- cannot change a function return type via CREATE OR REPLACE.
DROP FUNCTION IF EXISTS start_assessment(TEXT);
CREATE OR REPLACE FUNCTION start_assessment(p_program_slug TEXT)
RETURNS TABLE (
    attempt_id UUID, attempt_number INTEGER, question_set_version TEXT,
    time_limit_minutes INTEGER, questions JSONB, deadline TIMESTAMPTZ, retake_reason TEXT
) AS $$
DECLARE
    v_program credential_programs%ROWTYPE;
    v_set assessment_question_sets%ROWTYPE;
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
    -- Serialize concurrent starts for this user+program.
    PERFORM pg_advisory_xact_lock(hashtext(auth.uid()::text || '|' || p_program_slug));
    SELECT * INTO v_program FROM credential_programs
    WHERE slug = p_program_slug AND status = 'active';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'start_assessment: unknown or inactive program';
    END IF;
    SELECT * INTO v_set FROM assessment_question_sets
    WHERE program_slug = p_program_slug AND version = v_program.version
    ORDER BY created_at DESC LIMIT 1;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'start_assessment: no question set for this program/version';
    END IF;
    -- Active attempt already exists: return it (no duplicate exam).
    SELECT * INTO v_existing FROM assessment_attempts
    WHERE assessment_attempts.user_id = auth.uid()
      AND assessment_attempts.program_slug = p_program_slug
      AND assessment_attempts.question_set_version = v_program.version
      AND assessment_attempts.status = 'started'
    ORDER BY started_at DESC LIMIT 1;
    IF FOUND THEN
        -- Active attempt already exists: return it (no duplicate exam).
        -- Only the assigned questions go out, never the whole bank.
        RETURN QUERY SELECT v_existing.id, v_existing.attempt_number,
            v_existing.question_set_version, v_set.time_limit_minutes,
            (SELECT COALESCE(
                (SELECT jsonb_agg(q) FROM jsonb_array_elements(v_set.questions) q
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
    -- Server assigns the exam: random subset of the bank of size
    -- question_count (whole bank when smaller, e.g. harness sets).
    v_bank := COALESCE(v_set.questions, '[]'::jsonb);
    SELECT COALESCE(jsonb_agg(x.id ORDER BY x.r), '[]'::jsonb) INTO v_assigned
    FROM (
        SELECT (q ->> 'id') AS id, RANDOM() AS r
        FROM jsonb_array_elements(v_bank) q
        ORDER BY r
        LIMIT GREATEST(v_set.question_count, 1)
    ) x;
    IF jsonb_array_length(v_assigned) = 0 THEN
        SELECT jsonb_agg(q ->> 'id') INTO v_assigned
        FROM jsonb_array_elements(v_bank) q;
    END IF;
    -- Race-safe insert: the partial unique index is the backstop. ON
    -- CONFLICT cannot name question_set_version here (it collides with the
    -- OUT parameter under plpgsql substitution), so unique_violation is
    -- caught and the winner is re-selected below.
    BEGIN
        INSERT INTO assessment_attempts
            (id, user_id, program_slug, question_set_id, question_set_version,
             attempt_number, status, answers, score, passed,
             assigned_question_ids, deadline, skill_breakdown)
        VALUES
            (v_attempt_id, auth.uid(), v_program.slug, v_set.id, v_set.version,
             v_num, 'started', NULL, NULL, NULL,
             v_assigned, NOW() + (v_set.time_limit_minutes || ' minutes')::interval, NULL);
    EXCEPTION WHEN unique_violation THEN
        NULL;
    END;
    SELECT * INTO v_existing FROM assessment_attempts WHERE id = v_attempt_id;
    IF NOT FOUND THEN
        -- Lost the race: return the winner's active attempt.
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

-- Submission v2: assigned ids only, deadline enforced, breakdown stored. --
DROP FUNCTION IF EXISTS submit_assessment(UUID, JSONB);
CREATE OR REPLACE FUNCTION submit_assessment(p_attempt_id UUID, p_answers JSONB)
RETURNS TABLE (score NUMERIC, passed BOOLEAN, submitted BOOLEAN) AS $$
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
        RETURN QUERY SELECT v_attempt.score, v_attempt.passed, FALSE;
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
    SELECT k.answers INTO v_key
    FROM assessment_answer_keys k WHERE k.question_set_id = v_attempt.question_set_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'submit_assessment: question set has no key';
    END IF;
    -- Score ONLY the server-assigned questions (fallback: whole bank for
    -- legacy attempts created before assignment existed).
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
    -- Per-skill breakdown over the same assigned set (remediation targeting).
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
    RETURN QUERY SELECT v_score, v_passed, TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION submit_assessment(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION submit_assessment(UUID, JSONB) TO authenticated;

-- Project component carries its pass flag too. -----------------------------
CREATE OR REPLACE FUNCTION project_certification_feed_component()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO credential_component_results
        (user_id, program_slug, program_version, component, score, passed,
         authority_source, reference_id)
    VALUES
        (NEW.user_id, NEW.program_slug, NEW.version, 'project',
         NEW.authoritative_score, NEW.passed, 'server_certified_project', NEW.id::text)
    ON CONFLICT (user_id, program_slug, program_version, component)
    DO UPDATE SET score = EXCLUDED.score,
                  passed = EXCLUDED.passed,
                  authority_source = EXCLUDED.authority_source,
                  reference_id = EXCLUDED.reference_id,
                  created_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION project_certification_feed_component() FROM PUBLIC, anon, authenticated;

-- Issuance v3: mandatory pass flags, per-item depth policy, frozen grades.
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
BEGIN
    SELECT * INTO v_program FROM credential_programs
    WHERE slug = p_program_slug AND status = 'active';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'issue_credential: unknown or inactive program';
    END IF;
    IF NOT v_program.issuance_enabled THEN
        RAISE EXCEPTION 'issue_credential: program not issuance-ready';
    END IF;
    SELECT * INTO v_enrollment FROM user_credential_progress
    WHERE user_id = auth.uid()
      AND program_slug = p_program_slug
      AND program_version = v_program.version;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'issue_credential: enrollment required';
    END IF;
    -- Every required component must exist AND be passed. A failed final or
    -- project can never be averaged away; scores are kept for reporting.
    SELECT score, passed INTO v_final, v_final_passed FROM credential_component_results
    WHERE user_id = auth.uid() AND program_slug = p_program_slug
      AND program_version = v_program.version AND component = 'final_assessment';
    IF v_final IS NULL OR v_final_passed IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'issue_credential: component_missing_or_failed:final_assessment';
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
    SELECT score, passed INTO v_practical, v_practical_passed FROM credential_component_results
    WHERE user_id = auth.uid() AND program_slug = p_program_slug
      AND program_version = v_program.version AND component = 'practical';
    IF v_practical IS NULL OR v_practical_passed IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'issue_credential: component_missing_or_failed:practical';
    END IF;
    -- Competency over FINALIZED per-item results: latest per item counts
    -- once, distinct items are independent samples, retries never inflate
    -- depth, failures stay authoritative. Unmeasured != passed.
    FOR v_skill IN SELECT jsonb_array_elements(v_program.skills) LOOP
        v_skill_key := v_skill ->> 'key';
        SELECT * INTO v_policy FROM skill_evidence_policy
        WHERE program_slug = p_program_slug
          AND program_version = v_program.version
          AND skill_key = v_skill_key;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'issue_credential: no evidence policy for skill:%', v_skill_key;
        END IF;
        SELECT COUNT(*), COUNT(*) FILTER (WHERE finalized_passed)
        INTO v_items, v_passes
        FROM trusted_item_results
        WHERE user_id = auth.uid()
          AND program_slug = p_program_slug
          AND program_version = v_program.version
          AND skill_key = v_skill_key;
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
    -- Frozen weights: knowledge .25 / practical .30 / final .25 / project .20.
    v_overall := ROUND(
        v_knowledge * 0.25 + v_practical * 0.30 + v_final * 0.25 + v_project * 0.20, 1);
    IF v_overall < v_program.required_score THEN
        RAISE EXCEPTION 'issue_credential: overall requirement not met';
    END IF;
    -- Frozen grade vocabulary (src/domain/credentials/scoring.ts).
    v_grade := CASE WHEN v_overall >= 95 THEN 'distinction'
                   WHEN v_overall >= 90 THEN 'excellence'
                   WHEN v_overall >= 85 THEN 'merit'
                   ELSE 'pass' END;
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
    IF v_existing_id IS NOT NULL THEN
        UPDATE user_credential_progress
        SET status = 'passed', updated_at = NOW()
        WHERE user_id = auth.uid()
          AND program_slug = p_program_slug
          AND program_version = v_program.version;
        RETURN QUERY SELECT v_existing_id, TRUE;
        RETURN;
    END IF;
    SELECT c.credential_id INTO v_existing_id FROM issued_credentials c
    WHERE c.user_id = auth.uid()
      AND c.program_slug = p_program_slug
      AND c.program_version = v_program.version;
    UPDATE user_credential_progress
    SET status = 'passed', updated_at = NOW()
    WHERE user_id = auth.uid()
      AND program_slug = p_program_slug
      AND program_version = v_program.version;
    RETURN QUERY SELECT v_existing_id, FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION issue_credential(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION issue_credential(TEXT, TEXT) TO authenticated;
