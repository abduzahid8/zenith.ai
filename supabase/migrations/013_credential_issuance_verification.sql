-- =====================================================
-- 013 — Server trust layer: credential issuance + verification
--
-- Target policy (authoritative credentials):
--   client may READ own authoritative credential state;
--   client must NOT set readiness/assessment/project scores, mark itself
--   passed, insert final evidence, issue credentials, or change issued
--   status. Those writes happen in SECURITY DEFINER functions or via
--   service role only.
--
-- Defensive drops: migrations 009/010 (never applied to this project,
-- superseded by this layer) granted "users manage own ..." FOR ALL on
-- credential tables. If they are ever applied out of order, drop their
-- weak policies here so authority cannot regress.
-- Mirrors src/server/trust.ts evaluateIssuanceGate.
-- =====================================================

CREATE TABLE IF NOT EXISTS credential_programs (
    slug TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    title TEXT NOT NULL,
    level TEXT NOT NULL DEFAULT 'verified-skill',
    version TEXT NOT NULL DEFAULT '1.0',
    required_score NUMERIC NOT NULL DEFAULT 80,
    requires_assessment BOOLEAN NOT NULL DEFAULT TRUE,
    requires_project BOOLEAN NOT NULL DEFAULT FALSE,
    skill_gates JSONB NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Server-maintained progress (readiness derived server-side). No client
-- write policies: enrollment and updates go through server functions.
CREATE TABLE IF NOT EXISTS user_credential_progress (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    program_slug TEXT NOT NULL REFERENCES credential_programs(slug) ON DELETE RESTRICT,
    program_version TEXT NOT NULL DEFAULT '1.0',
    readiness_score NUMERIC NULL,
    status TEXT NOT NULL DEFAULT 'learning',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, program_slug)
);

-- Official credentials. Immutable from ordinary clients: SELECT own only.
CREATE TABLE IF NOT EXISTS issued_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credential_id TEXT UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    program_slug TEXT NOT NULL REFERENCES credential_programs(slug) ON DELETE RESTRICT,
    program_title TEXT NOT NULL,
    program_version TEXT NOT NULL,
    holder_display_name TEXT NOT NULL,
    final_score NUMERIC NOT NULL,
    grade TEXT NOT NULL,
    verified_skills JSONB NOT NULL DEFAULT '[]',
    evidence_summary JSONB NOT NULL DEFAULT '{}',
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
    UNIQUE (user_id, program_slug, program_version)
);

ALTER TABLE credential_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_credential_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE issued_credentials ENABLE ROW LEVEL SECURITY;

-- Defensive: remove superseded permissive policies if 009 ever lands.
DROP POLICY IF EXISTS "users manage own credential progress" ON user_credential_progress;
DROP POLICY IF EXISTS "users manage own credential attempts" ON credential_attempts;
DROP POLICY IF EXISTS "users manage own credential evidence" ON credential_evidence;
DROP POLICY IF EXISTS "users read own issued credentials" ON issued_credentials;
DROP POLICY IF EXISTS "credential_programs readable by all" ON credential_programs;

DROP POLICY IF EXISTS "credential programs readable by all" ON credential_programs;
CREATE POLICY "credential programs readable by all"
    ON credential_programs FOR SELECT USING (true);

DROP POLICY IF EXISTS "users read own credential progress" ON user_credential_progress;
CREATE POLICY "users read own credential progress"
    ON user_credential_progress FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "users read own issued credentials v2" ON issued_credentials;
CREATE POLICY "users read own issued credentials v2"
    ON issued_credentials FOR SELECT USING (user_id = auth.uid());

-- No INSERT/UPDATE/DELETE client policies on progress or issued rows.

-- Seed catalog mirror (slugs/versions match src/domain/credentials/catalog).
INSERT INTO credential_programs (slug, code, title, level, version, required_score, requires_assessment, requires_project, skill_gates)
VALUES
    ('chess-foundations', 'CHF', 'Chess Foundations', 'verified-skill', '1.0', 80, TRUE, FALSE,
     '[{"skillKey":"rules","minTrustedValidations":2,"minSessions":2}]'),
    ('python-foundations', 'PYF', 'Python Foundations', 'verified-skill', '1.0', 80, TRUE, TRUE, '[]'),
    ('reading-mastery', 'RDG', 'Reading Mastery', 'verified-skill', '1.0', 80, TRUE, FALSE, '[]'),
    ('english-foundations', 'ENF', 'English Foundations', 'verified-skill', '1.0', 80, TRUE, FALSE, '[]'),
    ('chinese-hsk1-start', 'CHN', 'Chinese HSK1 Start', 'verified-skill', '1.0', 80, TRUE, FALSE, '[]')
ON CONFLICT (slug) DO NOTHING;

-- Enrollment: server-created progress row, never client-inserted.
CREATE OR REPLACE FUNCTION enroll_in_program(p_program_slug TEXT)
RETURNS TABLE (enrolled BOOLEAN) AS $$
BEGIN
    INSERT INTO user_credential_progress (user_id, program_slug, program_version, status)
    SELECT auth.uid(), p.slug, p.version, 'learning'
    FROM credential_programs p WHERE p.slug = p_program_slug AND p.status = 'active'
    ON CONFLICT (user_id, program_slug) DO NOTHING;
    IF FOUND THEN
        RETURN QUERY SELECT TRUE;
    ELSE
        RETURN QUERY SELECT FALSE;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION enroll_in_program(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION enroll_in_program(TEXT) TO authenticated;

-- Official issuance. Derives EVERYTHING server-side; never trusts
-- holder-supplied scores/skills/evidence. Idempotent per
-- (user, program, version): re-issue returns the existing credential.
CREATE OR REPLACE FUNCTION issue_credential(p_program_slug TEXT, p_holder_name TEXT)
RETURNS TABLE (credential_id TEXT, created BOOLEAN) AS $$
DECLARE
    v_program credential_programs%ROWTYPE;
    v_attempt assessment_attempts%ROWTYPE;
    v_project project_certification_results%ROWTYPE;
    v_gate JSONB;
    v_skill TEXT;
    v_min_v INTEGER;
    v_min_s INTEGER;
    v_validations INTEGER;
    v_sessions INTEGER;
    v_existing issued_credentials%ROWTYPE;
    v_new_id TEXT;
BEGIN
    SELECT * INTO v_program FROM credential_programs
    WHERE slug = p_program_slug AND status = 'active';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'issue_credential: unknown or inactive program';
    END IF;

    IF v_program.requires_assessment THEN
        SELECT * INTO v_attempt FROM assessment_attempts
        WHERE user_id = auth.uid()
          AND program_slug = p_program_slug
          AND question_set_version = v_program.version
          AND status = 'submitted'
          AND passed = TRUE
        ORDER BY score DESC LIMIT 1;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'issue_credential: no authoritative assessment pass';
        END IF;
    END IF;

    IF v_program.requires_project THEN
        SELECT * INTO v_project FROM project_certification_results
        WHERE user_id = auth.uid()
          AND program_slug = p_program_slug
          AND version = v_program.version
          AND passed = TRUE
        LIMIT 1;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'issue_credential: no authoritative project pass';
        END IF;
    END IF;

    -- Trusted-validation skill gates over pinned-version server rows only.
    FOR v_gate IN SELECT jsonb_array_elements(v_program.skill_gates) LOOP
        v_skill := v_gate ->> 'skillKey';
        v_min_v := COALESCE((v_gate ->> 'minTrustedValidations')::int, 1);
        v_min_s := COALESCE((v_gate ->> 'minSessions')::int, 1);
        SELECT COUNT(*), COUNT(DISTINCT session_id)
        INTO v_validations, v_sessions
        FROM learning_events
        WHERE user_id = auth.uid()
          AND program_slug = p_program_slug
          AND program_version = v_program.version
          AND trusted = TRUE
          AND event_type = 'attempt'
          AND phase = 'validate'
          AND outcome = 'pass'
          AND skill_key = v_skill;
        IF v_validations < v_min_v OR v_sessions < v_min_s THEN
            RAISE EXCEPTION 'issue_credential: skill gate failed for %', v_skill;
        END IF;
    END LOOP;

    SELECT * INTO v_existing FROM issued_credentials
    WHERE user_id = auth.uid()
      AND program_slug = p_program_slug
      AND program_version = v_program.version;
    IF FOUND THEN
        RETURN QUERY SELECT v_existing.credential_id, FALSE;
        RETURN;
    END IF;

    v_new_id := 'ZNX-' || UPPER(SUBSTRING(gen_random_uuid()::text, 1, 8));
    PERFORM set_config('app.trusted_server', 'on', TRUE);
    INSERT INTO issued_credentials (
        credential_id, user_id, program_slug, program_title, program_version,
        holder_display_name, final_score, grade, verified_skills, evidence_summary, status
    ) VALUES (
        v_new_id, auth.uid(), v_program.slug, v_program.title, v_program.version,
        NULLIF(TRIM(p_holder_name), ''), COALESCE(v_attempt.score, 0),
        CASE WHEN COALESCE(v_attempt.score, 0) >= 90 THEN 'A'
             WHEN COALESCE(v_attempt.score, 0) >= 80 THEN 'B' ELSE 'C' END,
        (SELECT COALESCE(jsonb_agg(DISTINCT skill_key), '[]')
         FROM learning_events
         WHERE user_id = auth.uid()
           AND program_slug = p_program_slug
           AND program_version = v_program.version
           AND trusted = TRUE AND skill_key IS NOT NULL),
        jsonb_build_object(
            'assessmentScore', v_attempt.score,
            'projectPassed', COALESCE(v_project.passed, FALSE),
            'programVersion', v_program.version
        ),
        'active'
    );
    RETURN QUERY SELECT v_new_id, TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION issue_credential(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION issue_credential(TEXT, TEXT) TO authenticated;

-- Anonymous verification: safe public fields ONLY. Revoked stays revoked.
-- Callable logged-out (anon) with just a credential id.
CREATE OR REPLACE FUNCTION verify_credential(p_credential_id TEXT)
RETURNS TABLE (
    credential_id TEXT,
    program_slug TEXT,
    program_title TEXT,
    program_version TEXT,
    holder_display_name TEXT,
    issued_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    status TEXT,
    verified_skills JSONB,
    final_score NUMERIC,
    grade TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT c.credential_id, c.program_slug, c.program_title, c.program_version,
           c.holder_display_name, c.issued_at, c.expires_at, c.status,
           c.verified_skills, c.final_score, c.grade
    FROM issued_credentials c
    WHERE c.credential_id = p_credential_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION verify_credential(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION verify_credential(TEXT) TO anon, authenticated;
