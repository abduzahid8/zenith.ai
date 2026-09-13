-- =====================================================
-- 038 — Credential claim hardening: single-authority status, K/P
-- reference backstop, expiry re-issuance, explicit revoked guard.
--
-- 1. Single authority: assess_credential_eligibility() is the ONE
--    implementation of the issuance gate predicates (029 v5, unchanged
--    semantics except the fail-closed fixes below). It performs NO
--    writes and returns (eligible, fail_reason, scores, grade,
--    verified_skills). Both issue_credential() and the new
--    get_credential_status() call it — there is exactly one policy.
--    The helper is INTERNAL: no EXECUTE for any client role.
-- 2. K/P NULL-reference backstop: a passed knowledge/practical
--    component MUST carry a reference_id resolving to an own
--    submitted attempt on the pinned program/version. NULL or
--    dangling references fail closed (previously the bank EXISTS
--    check passed vacuously over an empty join).
-- 3. Rotation semantics preserved: approved (active OR approved +
--    QA passed + human approved) releases stay issuable; retired /
--    compromised releases fail. No live-equality requirement is
--    added — B going live never invalidates an approved A.
-- 4. Expiry: an expired credential (stored active, expires_at past)
--    is NOT returned as active and does NOT block re-issuance. It
--    follows the revoked correction path (gates re-evaluated, old
--    row replaced, never edited). No new stored status: expiry stays
--    derived from expires_at, and verify_credential still reports
--    expired.
-- 5. Revoked guard: the correction DELETE is driven by an explicit
--    boolean, never by FOUND surviving aggregate SELECTs.
-- 6. get_credential_status(program): canonical authenticated Claim
--    read. Returns (state, credential_id, score, grade, issued_at,
--    expires_at) with state IN (locked, ready_to_issue, issued,
--    revoked, expired, temporarily_unavailable). Safe fields only:
--    no keys, artifacts, reviewers, or user data.
--
-- Forward-only. No scoring/threshold/weight/curriculum/content/
-- release/start-gate/RLS changes.
-- =====================================================

-- 1. Internal single-authority eligibility evaluation. -----------------
-- Returns exactly one row. fail_reason carries the stable gate code
-- WITHOUT the 'issue_credential: ' prefix (callers add transport).
CREATE OR REPLACE FUNCTION assess_credential_eligibility(p_program_slug TEXT)
RETURNS TABLE (
    eligible BOOLEAN,
    fail_reason TEXT,
    overall NUMERIC,
    grade TEXT,
    knowledge NUMERIC,
    practical NUMERIC,
    final_assessment NUMERIC,
    project NUMERIC,
    verified JSONB
) AS $$
DECLARE
    v_program credential_programs%ROWTYPE;
    v_fail TEXT := NULL;
    v_knowledge NUMERIC;
    v_practical NUMERIC;
    v_final NUMERIC;
    v_project NUMERIC;
    v_final_passed BOOLEAN;
    v_project_passed BOOLEAN;
    v_knowledge_passed BOOLEAN;
    v_practical_passed BOOLEAN;
    v_knowledge_ref TEXT;
    v_practical_ref TEXT;
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
    v_final_set_ok BOOLEAN;
BEGIN
    SELECT * INTO v_program FROM credential_programs
    WHERE slug = p_program_slug AND status = 'active';
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'unknown or inactive program'::text,
            NULL::numeric, NULL::text, NULL::numeric, NULL::numeric,
            NULL::numeric, NULL::numeric, NULL::jsonb;
        RETURN;
    END IF;
    IF NOT v_program.issuance_enabled THEN
        RETURN QUERY SELECT FALSE, 'program not issuance-ready'::text,
            NULL::numeric, NULL::text, NULL::numeric, NULL::numeric,
            NULL::numeric, NULL::numeric, NULL::jsonb;
        RETURN;
    END IF;
    PERFORM 1 FROM user_credential_progress
    WHERE user_id = auth.uid()
      AND program_slug = p_program_slug
      AND program_version = v_program.version;
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'enrollment required'::text,
            NULL::numeric, NULL::text, NULL::numeric, NULL::numeric,
            NULL::numeric, NULL::numeric, NULL::jsonb;
        RETURN;
    END IF;
    -- Final: passed component on an approved bank (approved releases
    -- stay issuable after rotation; retired/compromised fail).
    SELECT score, passed INTO v_final, v_final_passed FROM credential_component_results
    WHERE user_id = auth.uid() AND program_slug = p_program_slug
      AND program_version = v_program.version AND component = 'final_assessment';
    IF v_final IS NULL OR v_final_passed IS DISTINCT FROM TRUE THEN
        v_fail := 'component_missing_or_failed:final_assessment';
    ELSE
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
            v_fail := 'final_assessment bank not active';
        END IF;
    END IF;
    -- Project: passed component (latest-revision authority via 037).
    IF v_fail IS NULL THEN
        SELECT score, passed INTO v_project, v_project_passed FROM credential_component_results
        WHERE user_id = auth.uid() AND program_slug = p_program_slug
          AND program_version = v_program.version AND component = 'project';
        IF v_project IS NULL OR v_project_passed IS DISTINCT FROM TRUE THEN
            v_fail := 'component_missing_or_failed:project';
        END IF;
    END IF;
    -- Knowledge: passed + NON-NULL reference resolving to an own
    -- submitted attempt + all items active and version-matched.
    IF v_fail IS NULL THEN
        SELECT score, passed, reference_id INTO v_knowledge, v_knowledge_passed, v_knowledge_ref
        FROM credential_component_results
        WHERE user_id = auth.uid() AND program_slug = p_program_slug
          AND program_version = v_program.version AND component = 'knowledge';
        IF v_knowledge IS NULL OR v_knowledge_passed IS DISTINCT FROM TRUE THEN
            v_fail := 'component_missing_or_failed:knowledge';
        ELSIF v_knowledge_ref IS NULL THEN
            v_fail := 'component_missing_or_failed:knowledge';
        ELSE
            PERFORM 1 FROM knowledge_attempts a
            WHERE a.id::text = v_knowledge_ref
              AND a.user_id = auth.uid()
              AND a.program_slug = p_program_slug
              AND a.program_version = v_program.version
              AND a.status = 'submitted';
            IF NOT FOUND THEN
                v_fail := 'component_missing_or_failed:knowledge';
            ELSIF EXISTS (
                SELECT 1 FROM credential_component_results c
                JOIN knowledge_attempts a ON a.id::text = c.reference_id,
                jsonb_array_elements_text(a.assigned_item_ids) AS iid
                JOIN knowledge_items i ON i.id::text = iid
                WHERE c.user_id = auth.uid() AND c.program_slug = p_program_slug
                  AND c.program_version = v_program.version AND c.component = 'knowledge'
                  AND (i.status <> 'active' OR i.content_version IS DISTINCT FROM a.content_version)) THEN
                v_fail := 'knowledge bank not active';
            END IF;
        END IF;
    END IF;
    -- Practical: same reference backstop as knowledge.
    IF v_fail IS NULL THEN
        SELECT score, passed, reference_id INTO v_practical, v_practical_passed, v_practical_ref
        FROM credential_component_results
        WHERE user_id = auth.uid() AND program_slug = p_program_slug
          AND program_version = v_program.version AND component = 'practical';
        IF v_practical IS NULL OR v_practical_passed IS DISTINCT FROM TRUE THEN
            v_fail := 'component_missing_or_failed:practical';
        ELSIF v_practical_ref IS NULL THEN
            v_fail := 'component_missing_or_failed:practical';
        ELSE
            PERFORM 1 FROM practical_attempts a
            WHERE a.id::text = v_practical_ref
              AND a.user_id = auth.uid()
              AND a.program_slug = p_program_slug
              AND a.program_version = v_program.version
              AND a.status = 'submitted';
            IF NOT FOUND THEN
                v_fail := 'component_missing_or_failed:practical';
            ELSIF EXISTS (
                SELECT 1 FROM credential_component_results c
                JOIN practical_attempts a ON a.id::text = c.reference_id,
                jsonb_array_elements_text(a.assigned_item_ids) AS iid
                JOIN practical_items i ON i.id::text = iid
                WHERE c.user_id = auth.uid() AND c.program_slug = p_program_slug
                  AND c.program_version = v_program.version AND c.component = 'practical'
                  AND (i.status <> 'active' OR i.content_version IS DISTINCT FROM a.content_version)) THEN
                v_fail := 'practical bank not active';
            END IF;
        END IF;
    END IF;
    -- Skills: first-sample results on active, release-approved items
    -- whose version matches the recorded result version.
    IF v_fail IS NULL THEN
        FOR v_skill IN SELECT jsonb_array_elements(v_program.skills) LOOP
            EXIT WHEN v_fail IS NOT NULL;
            v_skill_key := v_skill ->> 'key';
            SELECT * INTO v_policy FROM skill_evidence_policy
            WHERE program_slug = p_program_slug
              AND program_version = v_program.version
              AND skill_key = v_skill_key;
            IF NOT FOUND THEN
                v_fail := 'no evidence policy for skill:' || v_skill_key;
                EXIT;
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
                v_fail := 'skill_gate_failed:' || v_skill_key;
                EXIT;
            END IF;
            v_rate := (v_passes::numeric / v_items::numeric);
            v_skill_score := ROUND(v_rate * 100, 1);
            IF v_rate < v_policy.min_pass_rate
               OR v_skill_score < COALESCE((v_skill ->> 'minimumScore')::numeric, 65) THEN
                v_fail := 'skill_gate_failed:' || v_skill_key;
                EXIT;
            END IF;
            v_verified := v_verified || jsonb_build_object(
                'key', v_skill_key,
                'name', v_skill ->> 'name',
                'score', v_skill_score
            );
        END LOOP;
    END IF;
    -- Frozen weights + frozen grades.
    IF v_fail IS NULL THEN
        v_overall := ROUND(
            v_knowledge * 0.25 + v_practical * 0.30 + v_final * 0.25 + v_project * 0.20, 1);
        IF v_overall < v_program.required_score THEN
            v_fail := 'overall requirement not met';
        ELSE
            v_grade := CASE WHEN v_overall >= 95 THEN 'distinction'
                           WHEN v_overall >= 90 THEN 'excellence'
                           WHEN v_overall >= 85 THEN 'merit'
                           ELSE 'pass' END;
        END IF;
    END IF;
    IF v_fail IS NOT NULL THEN
        RETURN QUERY SELECT FALSE, v_fail,
            NULL::numeric, NULL::text, NULL::numeric, NULL::numeric,
            NULL::numeric, NULL::numeric, NULL::jsonb;
        RETURN;
    END IF;
    RETURN QUERY SELECT TRUE, NULL::text, v_overall, v_grade,
        v_knowledge, v_practical, v_final, v_project, v_verified;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION assess_credential_eligibility(TEXT) FROM PUBLIC, anon, authenticated;

-- 2. Issuance v6: same policy via the helper + expiry + explicit guard. --
DROP FUNCTION IF EXISTS issue_credential(TEXT, TEXT);
CREATE OR REPLACE FUNCTION issue_credential(p_program_slug TEXT, p_holder_name TEXT)
RETURNS TABLE (credential_id TEXT, created BOOLEAN) AS $$
DECLARE
    v_program credential_programs%ROWTYPE;
    v_gate RECORD;
    v_new_id TEXT;
    v_existing_id TEXT;
    v_existing_status TEXT;
    v_existing_expires TIMESTAMPTZ;
    v_is_expired BOOLEAN := FALSE;
    v_replace_revoked BOOLEAN := FALSE;
    v_replace_expired BOOLEAN := FALSE;
BEGIN
    SELECT * INTO v_program FROM credential_programs
    WHERE slug = p_program_slug AND status = 'active';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'issue_credential: unknown or inactive program';
    END IF;
    IF NOT v_program.issuance_enabled THEN
        RAISE EXCEPTION 'issue_credential: program not issuance-ready';
    END IF;
    -- Existing credential, if any, on the pinned version.
    SELECT c.credential_id, c.status, c.expires_at
    INTO v_existing_id, v_existing_status, v_existing_expires
    FROM issued_credentials c
    WHERE c.user_id = auth.uid()
      AND c.program_slug = p_program_slug
      AND c.program_version = v_program.version;
    IF FOUND THEN
        -- Effective status: expiry is derived, never stored.
        v_is_expired := v_existing_expires IS NOT NULL AND v_existing_expires <= NOW();
        IF v_existing_status = 'active' AND NOT v_is_expired THEN
            -- Frozen snapshot: later revisions never mutate it.
            RETURN QUERY SELECT v_existing_id, FALSE;
            RETURN;
        END IF;
        -- Explicit correction flags (never FOUND-dependent below).
        v_replace_revoked := (v_existing_status = 'revoked');
        v_replace_expired := (v_existing_status = 'active' AND v_is_expired);
    END IF;
    -- Single authority: every gate predicate lives in the helper.
    SELECT * INTO v_gate FROM assess_credential_eligibility(p_program_slug);
    IF NOT v_gate.eligible THEN
        RAISE EXCEPTION 'issue_credential: %', v_gate.fail_reason;
    END IF;
    -- Revoked/expired rows are REPLACED (explicit correction workflow),
    -- never edited. Active rows never reach here.
    IF v_replace_revoked OR v_replace_expired THEN
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
        NULLIF(TRIM(p_holder_name), ''), FALSE, v_gate.overall, v_gate.grade,
        v_gate.verified,
        jsonb_build_object(
            'knowledge', v_gate.knowledge, 'practical', v_gate.practical,
            'finalAssessment', v_gate.final_assessment, 'project', v_gate.project,
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
    -- Lost an issuance race: return the winner (same identity, no dup).
    SELECT c.credential_id INTO v_existing_id FROM issued_credentials c
    WHERE c.user_id = auth.uid()
      AND c.program_slug = p_program_slug
      AND c.program_version = v_program.version;
    RETURN QUERY SELECT v_existing_id, FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION issue_credential(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION issue_credential(TEXT, TEXT) TO authenticated;

-- 3. Canonical Claim read: server-authoritative status. -----------------
-- Future Claim UI calls ONLY this (plus issue_credential on tap).
-- Safe fields only: no keys, artifacts, reviewers, or user data.
CREATE OR REPLACE FUNCTION get_credential_status(p_program_slug TEXT)
RETURNS TABLE (
    state TEXT,
    credential_id TEXT,
    score NUMERIC,
    grade TEXT,
    issued_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ
) AS $$
DECLARE
    v_program credential_programs%ROWTYPE;
    v_row issued_credentials%ROWTYPE;
    v_gate RECORD;
    v_is_expired BOOLEAN;
BEGIN
    SELECT * INTO v_program FROM credential_programs
    WHERE slug = p_program_slug AND status = 'active';
    IF NOT FOUND OR NOT v_program.issuance_enabled THEN
        -- Unknown/inactive program or policy kill-switch: nothing the
        -- user can claim. Never an error: Claim UI hides.
        RETURN QUERY SELECT 'locked'::text,
            NULL::text, NULL::numeric, NULL::text,
            NULL::timestamptz, NULL::timestamptz;
        RETURN;
    END IF;
    SELECT * INTO v_row FROM issued_credentials
    WHERE user_id = auth.uid()
      AND program_slug = p_program_slug
      AND program_version = v_program.version;
    IF FOUND THEN
        -- Revocation dominates (matches verify_credential order).
        IF v_row.status = 'revoked' THEN
            RETURN QUERY SELECT 'revoked'::text, v_row.credential_id,
                v_row.final_score, v_row.grade, v_row.issued_at, v_row.expires_at;
            RETURN;
        END IF;
        v_is_expired := v_row.expires_at IS NOT NULL AND v_row.expires_at <= NOW();
        IF v_is_expired THEN
            RETURN QUERY SELECT 'expired'::text, v_row.credential_id,
                v_row.final_score, v_row.grade, v_row.issued_at, v_row.expires_at;
            RETURN;
        END IF;
        RETURN QUERY SELECT 'issued'::text, v_row.credential_id,
            v_row.final_score, v_row.grade, v_row.issued_at, v_row.expires_at;
        RETURN;
    END IF;
    -- No credential: single-authority gate evaluation (same helper as
    -- issuance — never a second policy).
    SELECT * INTO v_gate FROM assess_credential_eligibility(p_program_slug);
    IF v_gate.eligible THEN
        RETURN QUERY SELECT 'ready_to_issue'::text,
            NULL::text, v_gate.overall, v_gate.grade,
            NULL::timestamptz, NULL::timestamptz;
        RETURN;
    END IF;
    -- Content/bank outages are transient (ops can restore); everything
    -- else is a user-state lock.
    IF v_gate.fail_reason LIKE '%bank not active%' THEN
        RETURN QUERY SELECT 'temporarily_unavailable'::text,
            NULL::text, NULL::numeric, NULL::text,
            NULL::timestamptz, NULL::timestamptz;
        RETURN;
    END IF;
    RETURN QUERY SELECT 'locked'::text,
        NULL::text, NULL::numeric, NULL::text,
        NULL::timestamptz, NULL::timestamptz;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION get_credential_status(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_credential_status(TEXT) TO authenticated;
