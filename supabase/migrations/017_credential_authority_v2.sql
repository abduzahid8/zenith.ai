-- =====================================================
-- 017 — Credential authority v2: catalog parity + honest issuance.
--
-- The server catalog must match src/domain/credentials/catalog.ts EXACTLY
-- (single definition of record lives in code; this seed mirrors it and a
-- parity test enforces it). All five frozen programs require a project —
-- the old seed did not. Fixed here.
--
-- Issuance is rewritten around authoritative COMPONENTS (knowledge 25 /
-- practical 30 / final 25 / project 20 — frozen weights) and a uniform
-- skill-competency rule over server-proven rows. Missing trustworthy
-- source => MISSING => issuance BLOCKED. No invented scores, no invented
-- gates. issuance_enabled is the explicit policy kill-switch and starts
-- FALSE for every program: no trusted content exists yet, so the only
-- honest state is "not yet issuable".
-- =====================================================

ALTER TABLE credential_programs
    ADD COLUMN IF NOT EXISTS skills JSONB NOT NULL DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS issuance_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS identity_verification_required BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE issued_credentials
    ADD COLUMN IF NOT EXISTS identity_verified BOOLEAN NOT NULL DEFAULT FALSE;

-- Meaningful server-owned progress states (clients remain SELECT-only).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'user_credential_progress_status_check'
    ) THEN
        ALTER TABLE user_credential_progress
            ADD CONSTRAINT user_credential_progress_status_check
            CHECK (status IN ('learning', 'ready', 'in_assessment', 'remediation', 'passed'));
    END IF;
END
$$;

-- Parity seed: exact mirror of the frozen TS catalog (v1.0, all programs).
-- skill: key/name/weight/minimumScore/dayRange. requiresProject TRUE everywhere.
INSERT INTO credential_programs
    (slug, code, title, level, version, required_score, requires_assessment,
     requires_project, identity_verification_required, issuance_enabled, skills, skill_gates, status)
VALUES
    ('python-foundations', 'PYF', 'Zenyth Verified Skill — Python Foundations', 'verified-skill', '1.0', 80, TRUE, TRUE, FALSE, FALSE,
     '[{"key":"syntax","name":"Syntax & Basics","weight":0.2,"minimumScore":65,"dayRange":[1,7]},{"key":"logic","name":"Control Flow & Logic","weight":0.25,"minimumScore":65,"dayRange":[8,14]},{"key":"functions","name":"Functions & Data","weight":0.25,"minimumScore":65,"dayRange":[15,21]},{"key":"basic_programming","name":"Projects & OOP","weight":0.3,"minimumScore":65,"dayRange":[22,28]}]',
     '[]', 'active'),
    ('chess-foundations', 'CHF', 'Zenyth Verified Skill — Chess Foundations', 'verified-skill', '1.0', 80, TRUE, TRUE, FALSE, FALSE,
     '[{"key":"rules","name":"Rules & Basics","weight":0.2,"minimumScore":65,"dayRange":[1,7]},{"key":"openings","name":"Openings","weight":0.25,"minimumScore":65,"dayRange":[8,14]},{"key":"endgames","name":"Endgames","weight":0.25,"minimumScore":65,"dayRange":[15,21]},{"key":"tactics","name":"Tactics & Strategy","weight":0.3,"minimumScore":65,"dayRange":[22,28]}]',
     '[]', 'active'),
    ('reading-mastery', 'RDG', 'Zenyth Verified Skill — Reading Mastery', 'verified-skill', '1.0', 80, TRUE, TRUE, FALSE, FALSE,
     '[{"key":"techniques","name":"Reading Techniques","weight":0.25,"minimumScore":65,"dayRange":[1,7]},{"key":"analysis","name":"Critical Analysis","weight":0.3,"minimumScore":65,"dayRange":[8,14]},{"key":"nonfiction","name":"Non-fiction System","weight":0.25,"minimumScore":65,"dayRange":[15,21]},{"key":"system","name":"Reader''s System","weight":0.2,"minimumScore":65,"dayRange":[22,28]}]',
     '[]', 'active'),
    ('english-foundations', 'ENF', 'Zenyth Verified Skill — English Foundations', 'verified-skill', '1.0', 80, TRUE, TRUE, FALSE, FALSE,
     '[{"key":"grammar","name":"Grammar Basics","weight":0.3,"minimumScore":65,"dayRange":[1,7]},{"key":"vocabulary","name":"Vocabulary","weight":0.25,"minimumScore":65,"dayRange":[8,14]},{"key":"speaking","name":"Speaking","weight":0.25,"minimumScore":65,"dayRange":[15,21]},{"key":"writing","name":"Writing & Reading","weight":0.2,"minimumScore":65,"dayRange":[22,28]}]',
     '[]', 'active'),
    ('chinese-hsk1-start', 'CHN', 'Zenyth Verified Skill — Chinese HSK 1 Start', 'verified-skill', '1.0', 80, TRUE, TRUE, FALSE, FALSE,
     '[{"key":"pinyin","name":"Pinyin & Tones","weight":0.3,"minimumScore":65,"dayRange":[1,7]},{"key":"characters","name":"Characters","weight":0.25,"minimumScore":65,"dayRange":[8,14]},{"key":"phrases","name":"Everyday Phrases","weight":0.25,"minimumScore":65,"dayRange":[15,21]},{"key":"grammar","name":"Basic Grammar","weight":0.2,"minimumScore":65,"dayRange":[22,28]}]',
     '[]', 'active')
ON CONFLICT (slug) DO UPDATE SET
    code = EXCLUDED.code,
    title = EXCLUDED.title,
    level = EXCLUDED.level,
    version = EXCLUDED.version,
    required_score = EXCLUDED.required_score,
    requires_assessment = EXCLUDED.requires_assessment,
    requires_project = EXCLUDED.requires_project,
    identity_verification_required = EXCLUDED.identity_verification_required,
    skills = EXCLUDED.skills,
    skill_gates = EXCLUDED.skill_gates;
-- NOTE: issuance_enabled is deliberately NOT overwritten by the seed:
-- flipping a program issuable is an explicit policy action, never a side
-- effect of re-seeding the catalog.

-- Official issuance v2. Every gate derived server-side; holder name is a
-- user-supplied CLAIM recorded alongside identity_verified=false (no
-- identity proof exists yet — user_profiles carries no verified identity).
CREATE OR REPLACE FUNCTION issue_credential(p_program_slug TEXT, p_holder_name TEXT)
RETURNS TABLE (credential_id TEXT, created BOOLEAN) AS $$
DECLARE
    v_program credential_programs%ROWTYPE;
    v_enrollment user_credential_progress%ROWTYPE;
    v_knowledge NUMERIC;
    v_practical NUMERIC;
    v_final NUMERIC;
    v_project NUMERIC;
    v_skill JSONB;
    v_skill_key TEXT;
    v_trusted_total INTEGER;
    v_trusted_passes INTEGER;
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
    -- Policy kill-switch: unready programs are not issuable, full stop.
    IF NOT v_program.issuance_enabled THEN
        RAISE EXCEPTION 'issue_credential: program not issuance-ready';
    END IF;
    -- Valid enrollment on the pinned version is mandatory.
    SELECT * INTO v_enrollment FROM user_credential_progress
    WHERE user_id = auth.uid()
      AND program_slug = p_program_slug
      AND program_version = v_program.version;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'issue_credential: enrollment required';
    END IF;
    -- Authoritative components. Missing source => MISSING => blocked.
    SELECT score INTO v_final FROM credential_component_results
    WHERE user_id = auth.uid() AND program_slug = p_program_slug
      AND program_version = v_program.version AND component = 'final_assessment';
    IF v_final IS NULL THEN
        RAISE EXCEPTION 'issue_credential: component_missing:final_assessment';
    END IF;
    SELECT score INTO v_project FROM credential_component_results
    WHERE user_id = auth.uid() AND program_slug = p_program_slug
      AND program_version = v_program.version AND component = 'project';
    IF v_project IS NULL THEN
        RAISE EXCEPTION 'issue_credential: component_missing:project';
    END IF;
    SELECT score INTO v_knowledge FROM credential_component_results
    WHERE user_id = auth.uid() AND program_slug = p_program_slug
      AND program_version = v_program.version AND component = 'knowledge';
    IF v_knowledge IS NULL THEN
        RAISE EXCEPTION 'issue_credential: component_missing:knowledge';
    END IF;
    SELECT score INTO v_practical FROM credential_component_results
    WHERE user_id = auth.uid() AND program_slug = p_program_slug
      AND program_version = v_program.version AND component = 'practical';
    IF v_practical IS NULL THEN
        RAISE EXCEPTION 'issue_credential: component_missing:practical';
    END IF;
    -- Skill competency over server-proven rows only. Unmeasured != passed.
    FOR v_skill IN SELECT jsonb_array_elements(v_program.skills) LOOP
        v_skill_key := v_skill ->> 'key';
        SELECT COUNT(*), COUNT(*) FILTER (WHERE outcome = 'pass')
        INTO v_trusted_total, v_trusted_passes
        FROM learning_events
        WHERE user_id = auth.uid()
          AND program_slug = p_program_slug
          AND program_version = v_program.version
          AND trusted = TRUE
          AND provenance = 'server_scored'
          AND event_type = 'attempt'
          AND skill_key = v_skill_key;
        IF v_trusted_total = 0 THEN
            RAISE EXCEPTION 'issue_credential: skill_gate_failed:%', v_skill_key;
        END IF;
        v_skill_score := ROUND((v_trusted_passes::numeric / v_trusted_total::numeric) * 100, 1);
        IF v_skill_score < COALESCE((v_skill ->> 'minimumScore')::numeric, 65) THEN
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
    v_grade := CASE WHEN v_overall >= 90 THEN 'A'
                   WHEN v_overall >= 80 THEN 'B' ELSE 'C' END;
    -- 128-bit entropy public id. Race-safe: insert-or-return-existing.
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
        WHERE user_id = auth.uid() AND program_slug = p_program_slug;
        RETURN QUERY SELECT v_existing_id, TRUE;
        RETURN;
    END IF;
    SELECT c.credential_id INTO v_existing_id FROM issued_credentials c
    WHERE c.user_id = auth.uid()
      AND c.program_slug = p_program_slug
      AND c.program_version = v_program.version;
    UPDATE user_credential_progress
    SET status = 'passed', updated_at = NOW()
    WHERE user_id = auth.uid() AND program_slug = p_program_slug;
    RETURN QUERY SELECT v_existing_id, FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION issue_credential(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION issue_credential(TEXT, TEXT) TO authenticated;

-- Verification v2: identity signal + expiry honesty, safe fields only.
-- Return shape grows (identity_verified), so drop first: Postgres cannot
-- change an existing function's return type via CREATE OR REPLACE.
DROP FUNCTION IF EXISTS verify_credential(TEXT);
CREATE OR REPLACE FUNCTION verify_credential(p_credential_id TEXT)
RETURNS TABLE (
    credential_id TEXT,
    program_slug TEXT,
    program_title TEXT,
    program_version TEXT,
    holder_display_name TEXT,
    identity_verified BOOLEAN,
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
           c.holder_display_name, c.identity_verified, c.issued_at, c.expires_at,
           CASE WHEN c.status = 'revoked' THEN 'revoked'
                WHEN c.expires_at IS NOT NULL AND c.expires_at <= NOW() THEN 'expired'
                ELSE 'active' END,
           c.verified_skills, c.final_score, c.grade
    FROM issued_credentials c
    WHERE c.credential_id = p_credential_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION verify_credential(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION verify_credential(TEXT) TO anon, authenticated;
