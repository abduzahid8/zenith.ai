-- =====================================================
-- 020 — Chess pilot mechanisms: knowledge + practical banks/flows,
-- manual project review workflow.
--
-- Knowledge and practical components each get a server-scored bank flow
-- mirroring the assessment pattern: server assigns unseen/least-recent
-- items, client submits answers only, server scores exact-match against
-- hidden keys and writes the authoritative component (score + passed).
-- Pass bar 80 mirrors the frozen knowledge-check requirement (>=80%).
-- Practical tasks are deterministic server-checked chess tasks (exact
-- accepted move/answer); client AI verdicts never feed these tables.
--
-- Project V1 authority = manual/service-role review. A review row
-- (rubric + authoritative score + passed) feeds project_certification_
-- results via trigger, which feeds the project component. Until a
-- passing review exists, the project component is incomplete.
-- =====================================================

-- Knowledge bank: deterministic MC/true-false/categorical questions. -----
CREATE TABLE IF NOT EXISTS knowledge_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_slug TEXT NOT NULL,
    program_version TEXT NOT NULL DEFAULT '1.0',
    skill_key TEXT NOT NULL,
    item_key TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    answer_key JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (program_slug, program_version, item_key)
);

CREATE TABLE IF NOT EXISTS knowledge_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    program_slug TEXT NOT NULL,
    program_version TEXT NOT NULL,
    assigned_item_ids JSONB NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'submitted')),
    score NUMERIC NULL,
    passed BOOLEAN NULL,
    submitted_at TIMESTAMPTZ NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Practical bank: deterministic chess tasks (FEN + accepted solution). ----
CREATE TABLE IF NOT EXISTS practical_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_slug TEXT NOT NULL,
    program_version TEXT NOT NULL DEFAULT '1.0',
    skill_key TEXT NOT NULL,
    item_key TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    answer_key JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (program_slug, program_version, item_key)
);

CREATE TABLE IF NOT EXISTS practical_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    program_slug TEXT NOT NULL,
    program_version TEXT NOT NULL,
    assigned_item_ids JSONB NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'submitted')),
    score NUMERIC NULL,
    passed BOOLEAN NULL,
    submitted_at TIMESTAMPTZ NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE knowledge_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE practical_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE practical_attempts ENABLE ROW LEVEL SECURITY;

-- Banks: no client policies (service-role curated). Attempts: read own.
DROP POLICY IF EXISTS "users read own knowledge attempts" ON knowledge_attempts;
CREATE POLICY "users read own knowledge attempts"
    ON knowledge_attempts FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "users read own practical attempts" ON practical_attempts;
CREATE POLICY "users read own practical attempts"
    ON practical_attempts FOR SELECT USING (user_id = auth.uid());

-- Server assigns 2 unseen/least-recent items per program skill. -----------
CREATE OR REPLACE FUNCTION start_knowledge_attempt(p_program_slug TEXT)
RETURNS TABLE (attempt_id UUID, program_version TEXT, questions JSONB) AS $$
DECLARE
    v_program credential_programs%ROWTYPE;
    v_skill JSONB;
    v_ids UUID[] := '{}';
    vAid UUID;
    v_attempt_id UUID := gen_random_uuid();
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'start_knowledge_attempt: authentication required';
    END IF;
    SELECT * INTO v_program FROM credential_programs
    WHERE slug = p_program_slug AND status = 'active';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'start_knowledge_attempt: unknown or inactive program';
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
    INSERT INTO knowledge_attempts (id, user_id, program_slug, program_version, assigned_item_ids, status)
    VALUES (v_attempt_id, auth.uid(), v_program.slug, v_program.version,
            (SELECT jsonb_agg(x) FROM UNNEST(v_ids) x), 'started');
    RETURN QUERY SELECT v_attempt_id, v_program.version,
        (SELECT jsonb_agg(jsonb_build_object('item_key', k.item_key, 'skill', k.skill_key, 'payload', k.payload) ORDER BY k.skill_key)
         FROM knowledge_items k WHERE k.id = ANY (v_ids));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION start_knowledge_attempt(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION start_knowledge_attempt(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION submit_knowledge_attempt(p_attempt_id UUID, p_answers JSONB)
RETURNS TABLE (score NUMERIC, passed BOOLEAN, submitted BOOLEAN) AS $$
DECLARE
    v_attempt knowledge_attempts%ROWTYPE;
    v_correct INTEGER := 0;
    v_total INTEGER := 0;
    v_iid TEXT;
    v_key JSONB;
    v_ikey TEXT;
    v_score NUMERIC;
    v_passed BOOLEAN;
BEGIN
    SELECT * INTO v_attempt FROM knowledge_attempts WHERE id = p_attempt_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'submit_knowledge_attempt: attempt not found';
    END IF;
    IF v_attempt.user_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'submit_knowledge_attempt: not the attempt owner';
    END IF;
    IF v_attempt.status = 'submitted' THEN
        RETURN QUERY SELECT v_attempt.score, v_attempt.passed, FALSE;
        RETURN;
    END IF;
    -- Answers arrive keyed by public item_key (UUIDs are never exposed);
    -- the server resolves each assigned item internally.
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
    RETURN QUERY SELECT v_score, v_passed, TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION submit_knowledge_attempt(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION submit_knowledge_attempt(UUID, JSONB) TO authenticated;

-- Practical: same pattern, deterministic accepted solutions. --------------
CREATE OR REPLACE FUNCTION start_practical_attempt(p_program_slug TEXT)
RETURNS TABLE (attempt_id UUID, program_version TEXT, tasks JSONB) AS $$
DECLARE
    v_program credential_programs%ROWTYPE;
    v_skill JSONB;
    v_ids UUID[] := '{}';
    vAid UUID;
    v_attempt_id UUID := gen_random_uuid();
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'start_practical_attempt: authentication required';
    END IF;
    SELECT * INTO v_program FROM credential_programs
    WHERE slug = p_program_slug AND status = 'active';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'start_practical_attempt: unknown or inactive program';
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
    INSERT INTO practical_attempts (id, user_id, program_slug, program_version, assigned_item_ids, status)
    VALUES (v_attempt_id, auth.uid(), v_program.slug, v_program.version,
            (SELECT jsonb_agg(x) FROM UNNEST(v_ids) x), 'started');
    RETURN QUERY SELECT v_attempt_id, v_program.version,
        (SELECT jsonb_agg(jsonb_build_object('item_key', k.item_key, 'skill', k.skill_key, 'payload', k.payload) ORDER BY k.skill_key)
         FROM practical_items k WHERE k.id = ANY (v_ids));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION start_practical_attempt(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION start_practical_attempt(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION submit_practical_attempt(p_attempt_id UUID, p_answers JSONB)
RETURNS TABLE (score NUMERIC, passed BOOLEAN, submitted BOOLEAN) AS $$
DECLARE
    v_attempt practical_attempts%ROWTYPE;
    v_correct INTEGER := 0;
    v_total INTEGER := 0;
    v_iid TEXT;
    v_key JSONB;
    v_ikey TEXT;
    v_score NUMERIC;
    v_passed BOOLEAN;
BEGIN
    SELECT * INTO v_attempt FROM practical_attempts WHERE id = p_attempt_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'submit_practical_attempt: attempt not found';
    END IF;
    IF v_attempt.user_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'submit_practical_attempt: not the attempt owner';
    END IF;
    IF v_attempt.status = 'submitted' THEN
        RETURN QUERY SELECT v_attempt.score, v_attempt.passed, FALSE;
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
    RETURN QUERY SELECT v_score, v_passed, TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION submit_practical_attempt(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION submit_practical_attempt(UUID, JSONB) TO authenticated;

-- Manual project review workflow (V1 authority). ---------------------------
CREATE TABLE IF NOT EXISTS project_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL UNIQUE REFERENCES project_submissions(id) ON DELETE CASCADE,
    rubric JSONB NOT NULL DEFAULT '{}',
    authoritative_score NUMERIC NOT NULL,
    passed BOOLEAN NOT NULL,
    reviewer TEXT NOT NULL DEFAULT 'manual-review',
    reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE project_reviews ENABLE ROW LEVEL SECURITY;
-- No client policies: service-role reviewers only.

-- A review produces the authoritative certification result (which feeds
-- the project component through the existing trigger chain).
CREATE OR REPLACE FUNCTION project_review_feed_result()
RETURNS TRIGGER AS $$
DECLARE
    v_sub project_submissions%ROWTYPE;
BEGIN
    SELECT * INTO v_sub FROM project_submissions WHERE id = NEW.submission_id;
    INSERT INTO project_certification_results
        (user_id, program_slug, version, submission_id,
         authoritative_score, passed, evaluator)
    VALUES
        (v_sub.user_id, v_sub.program_slug, v_sub.version, NEW.submission_id,
         NEW.authoritative_score, NEW.passed, NEW.reviewer)
    ON CONFLICT (user_id, program_slug, version)
    DO UPDATE SET authoritative_score = EXCLUDED.authoritative_score,
                  passed = EXCLUDED.passed,
                  submission_id = EXCLUDED.submission_id,
                  evaluator = EXCLUDED.evaluator,
                  evaluated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS project_review_feed_result ON project_reviews;
CREATE TRIGGER project_review_feed_result
    AFTER INSERT OR UPDATE ON project_reviews
    FOR EACH ROW EXECUTE FUNCTION project_review_feed_result();

REVOKE ALL ON FUNCTION project_review_feed_result() FROM PUBLIC, anon, authenticated;
