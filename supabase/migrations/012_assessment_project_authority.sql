-- =====================================================
-- 012 — Server trust layer: final assessment + project authority
--
-- The server owns attempt creation scoring inputs, question-set identity,
-- final submission, scoring, pass/fail, and completion. Clients submit
-- ANSWERS; the server computes scores. Raw answer keys are never
-- selectable by any client role.
--
-- Projects: client submissions + formative AI-style feedback stay
-- non-authoritative. Certification-grade project results are written by
-- service role only. Credentials must NEVER issue from client-only
-- project scoring.
-- Mirrors src/server/trust.ts scoreAssessmentFromAnswers.
-- =====================================================

-- Question sets WITHOUT answers (safe for pre-attempt reads).
CREATE TABLE IF NOT EXISTS assessment_question_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_slug TEXT NOT NULL,
    version TEXT NOT NULL DEFAULT '1.0',
    question_count INTEGER NOT NULL,
    time_limit_minutes INTEGER NOT NULL DEFAULT 30,
    pass_score NUMERIC NOT NULL DEFAULT 80,
    questions JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (program_slug, version)
);

-- Answer keys: NO client policies at all (service role + SECURITY
-- DEFINER functions only). Never exposed before OR after completion.
CREATE TABLE IF NOT EXISTS assessment_answer_keys (
    question_set_id UUID PRIMARY KEY REFERENCES assessment_question_sets(id) ON DELETE CASCADE,
    answers JSONB NOT NULL DEFAULT '{}',
    question_ids JSONB NOT NULL DEFAULT '[]'
);

-- Attempts. Server-managed columns (status/score/passed/submitted_at)
-- are guarded by trigger: clients can only touch answers while started.
CREATE TABLE IF NOT EXISTS assessment_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    program_slug TEXT NOT NULL,
    question_set_id UUID NOT NULL REFERENCES assessment_question_sets(id) ON DELETE RESTRICT,
    question_set_version TEXT NOT NULL,
    attempt_number INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'submitted')),
    answers JSONB NULL,
    score NUMERIC NULL,
    passed BOOLEAN NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    submitted_at TIMESTAMPTZ NULL,
    UNIQUE (user_id, program_slug, attempt_number)
);

CREATE OR REPLACE FUNCTION assessment_attempts_guard()
RETURNS TRIGGER AS $$
BEGIN
    IF current_setting('app.trusted_server', TRUE) = 'on' THEN
        IF TG_OP = 'INSERT' AND NEW.user_id IS NULL THEN
            NEW.user_id := auth.uid();
        END IF;
        RETURN NEW;
    END IF;
    IF TG_OP = 'INSERT' THEN
        -- Fresh attempts are always client-owned, started, unscored.
        NEW.user_id := auth.uid();
        NEW.status := 'started';
        NEW.score := NULL;
        NEW.passed := NULL;
        NEW.submitted_at := NULL;
        RETURN NEW;
    END IF;
    -- UPDATE path: only the owner, only while started, answers only.
    IF OLD.user_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'assessment_attempts: not the attempt owner';
    END IF;
    IF OLD.status <> 'started' THEN
        RAISE EXCEPTION 'assessment_attempts: attempt already submitted, answers locked';
    END IF;
    NEW.user_id := OLD.user_id;
    NEW.program_slug := OLD.program_slug;
    NEW.question_set_id := OLD.question_set_id;
    NEW.question_set_version := OLD.question_set_version;
    NEW.attempt_number := OLD.attempt_number;
    NEW.status := 'started';
    NEW.score := NULL;
    NEW.passed := NULL;
    NEW.submitted_at := NULL;
    NEW.started_at := OLD.started_at;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS assessment_attempts_guard ON assessment_attempts;
CREATE TRIGGER assessment_attempts_guard
    BEFORE INSERT OR UPDATE ON assessment_attempts
    FOR EACH ROW EXECUTE FUNCTION assessment_attempts_guard();

ALTER TABLE assessment_question_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_answer_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "question sets readable by authenticated" ON assessment_question_sets;
CREATE POLICY "question sets readable by authenticated"
    ON assessment_question_sets FOR SELECT TO authenticated USING (true);

-- No policies on assessment_answer_keys: keys never leave the server.

DROP POLICY IF EXISTS "users read own assessment attempts" ON assessment_attempts;
CREATE POLICY "users read own assessment attempts"
    ON assessment_attempts FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "users start own assessment attempts" ON assessment_attempts;
CREATE POLICY "users start own assessment attempts"
    ON assessment_attempts FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "users save answers while started" ON assessment_attempts;
CREATE POLICY "users save answers while started"
    ON assessment_attempts FOR UPDATE
    USING (user_id = auth.uid() AND status = 'started')
    WITH CHECK (user_id = auth.uid() AND status = 'started');

-- No DELETE policy: attempts are permanent records.

-- Idempotent final submit: computes score server-side from the stored key.
-- Calling twice returns the original result; answers lock on first submit.
CREATE OR REPLACE FUNCTION submit_assessment(p_attempt_id UUID, p_answers JSONB)
RETURNS TABLE (score NUMERIC, passed BOOLEAN, submitted BOOLEAN) AS $$
DECLARE
    v_attempt assessment_attempts%ROWTYPE;
    v_key JSONB;
    v_ids JSONB;
    v_qid TEXT;
    v_correct INTEGER := 0;
    v_total INTEGER := 0;
    v_score NUMERIC;
    v_passed BOOLEAN;
    v_pass_score NUMERIC;
BEGIN
    SELECT * INTO v_attempt FROM assessment_attempts WHERE id = p_attempt_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'submit_assessment: attempt not found';
    END IF;
    IF v_attempt.user_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'submit_assessment: not the attempt owner';
    END IF;
    IF v_attempt.status = 'submitted' THEN
        -- Idempotent replay: original result, no recompute, no mutation.
        RETURN QUERY SELECT v_attempt.score, v_attempt.passed, FALSE;
        RETURN;
    END IF;
    SELECT k.answers, k.question_ids INTO v_key, v_ids
    FROM assessment_answer_keys k WHERE k.question_set_id = v_attempt.question_set_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'submit_assessment: question set has no key';
    END IF;
    SELECT s.pass_score INTO v_pass_score
    FROM assessment_question_sets s WHERE s.id = v_attempt.question_set_id;
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
    v_passed := v_total > 0 AND v_score >= v_pass_score;
    PERFORM set_config('app.trusted_server', 'on', TRUE);
    UPDATE assessment_attempts
    SET answers = p_answers,
        score = v_score,
        passed = v_passed,
        status = 'submitted',
        submitted_at = NOW()
    WHERE id = p_attempt_id;
    RETURN QUERY SELECT v_score, v_passed, TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION submit_assessment(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION submit_assessment(UUID, JSONB) TO authenticated;

-- ---------------- Project authority ----------------

-- Client submissions: formative workspace. formative_score/feedback are
-- explicitly NON-authoritative (local AI-style feedback welcome).
CREATE TABLE IF NOT EXISTS project_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    program_slug TEXT NOT NULL,
    version TEXT NOT NULL DEFAULT '1.0',
    artifact_ref TEXT NULL,
    notes TEXT NULL,
    formative_score NUMERIC NULL,
    formative_feedback TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION project_submissions_guard()
RETURNS TRIGGER AS $$
BEGIN
    IF current_setting('app.trusted_server', TRUE) = 'on' THEN
        RETURN NEW;
    END IF;
    NEW.user_id := auth.uid();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS project_submissions_guard ON project_submissions;
CREATE TRIGGER project_submissions_guard
    BEFORE INSERT ON project_submissions
    FOR EACH ROW EXECUTE FUNCTION project_submissions_guard();

-- Authoritative certification results: service role ONLY. No client
-- insert/update/delete policies by design.
CREATE TABLE IF NOT EXISTS project_certification_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    program_slug TEXT NOT NULL,
    version TEXT NOT NULL DEFAULT '1.0',
    submission_id UUID NULL REFERENCES project_submissions(id) ON DELETE SET NULL,
    authoritative_score NUMERIC NOT NULL,
    passed BOOLEAN NOT NULL,
    evaluator TEXT NOT NULL DEFAULT 'server',
    evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, program_slug, version)
);

ALTER TABLE project_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_certification_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users manage own project submissions" ON project_submissions;
CREATE POLICY "users manage own project submissions"
    ON project_submissions FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "users read own project results" ON project_certification_results;
CREATE POLICY "users read own project results"
    ON project_certification_results FOR SELECT USING (user_id = auth.uid());
