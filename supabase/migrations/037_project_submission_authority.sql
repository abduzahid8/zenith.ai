-- =====================================================
-- 037 — Project submission authority hardening.
--
-- Closes the last client-write path into the credential pipeline and
-- gates official Project submissions on proven Final authority:
--
--   * Authenticated clients keep SELECT on their own project_submissions
--     only. Direct INSERT/UPDATE/DELETE are denied at RLS (the historical
--     FOR ALL / UPDATE policies are removed); submit_project(...) is the
--     sole creation path. Service-role/admin operation is unaffected
--     (bypasses RLS; server triggers still honor the trusted flag).
--   * Submissions are immutable to users: no client update endpoint, no
--     UPDATE policy. A revision is a NEW submission row; existing review
--     history is never rewritten or deleted.
--   * submit_project requires, before a NEW submission: an authenticated
--     user, an active + issuance-enabled program, current-version
--     enrollment, exactly one current live release, a CURRENT
--     authoritative Final Assessment PASS (live-backed attempt + live
--     question set — stale/NULL/unresolvable references never unlock),
--     and a non-empty payload (artifact_ref OR notes, trimmed).
--   * Pending idempotency: serialized per user+program+version, the
--     latest unreviewed submission is returned as-is (retry/double-tap
--     safe). A failed review opens a new revision; a passed review
--     refuses another submission (`project_already_passed`).
--   * Review authority follows the LATEST submission: a review targeting
--     a superseded revision is rejected with
--     `project_review:submission_superseded` before it can feed
--     project_certification_results or the project component.
--
-- Forward-only. No Home/runtime/NBA/scoring/bank/issuance/AI-grading
-- changes. Same submit_project signature.
-- =====================================================

-- 1. Authenticated clients: SELECT own submissions only. ----------------
DROP POLICY IF EXISTS "users manage own project submissions" ON project_submissions;
DROP POLICY IF EXISTS "users update own project submissions" ON project_submissions;
DROP POLICY IF EXISTS "users read own project submissions" ON project_submissions;
CREATE POLICY "users read own project submissions"
    ON project_submissions FOR SELECT USING (user_id = auth.uid());
-- No INSERT / UPDATE / DELETE policies: direct client writes are denied
-- at RLS (42501). Service role bypasses RLS per normal authority.

-- 2. submit_project v3: official-program + Final gate + empty guard +
-- pending idempotency + revision discipline. -----------------------------
CREATE OR REPLACE FUNCTION submit_project(
    p_program_slug TEXT, p_artifact_ref TEXT, p_notes TEXT
)
RETURNS TABLE (submission_id UUID) AS $$
DECLARE
    v_program credential_programs%ROWTYPE;
    v_enrollment user_credential_progress%ROWTYPE;
    v_live TEXT;
    v_artifact TEXT;
    v_notes TEXT;
    v_latest project_submissions%ROWTYPE;
    v_review_passed BOOLEAN;
    v_sub_id UUID := gen_random_uuid();
    v_comp_passed BOOLEAN;
    v_comp_ref TEXT;
    v_att assessment_attempts%ROWTYPE;
    v_set assessment_question_sets%ROWTYPE;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'submit_project: authentication required';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtext(auth.uid()::text || '|project|' || p_program_slug));
    SELECT * INTO v_program FROM credential_programs
    WHERE slug = p_program_slug AND status = 'active';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'submit_project: unknown or inactive program';
    END IF;
    -- Official Project submissions belong only to an issuable journey.
    IF v_program.issuance_enabled IS NOT TRUE THEN
        RAISE EXCEPTION 'project_unavailable';
    END IF;
    SELECT * INTO v_enrollment FROM user_credential_progress
    WHERE user_id = auth.uid()
      AND program_slug = p_program_slug
      AND program_version = v_program.version;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'submit_project: enrollment_required';
    END IF;
    -- Exactly one current live release, or fail closed.
    SELECT current_live_content_version(p_program_slug, v_program.version) INTO v_live;
    -- At least one meaningful payload (either storage model allowed).
    -- NOTE: bare BTRIM strips spaces only; the explicit set also drops
    -- tabs/newlines so whitespace-only payloads stay empty.
    v_artifact := NULLIF(TRIM(BOTH E' \t\n\r' FROM COALESCE(p_artifact_ref, '')), '');
    v_notes := NULLIF(TRIM(BOTH E' \t\n\r' FROM COALESCE(p_notes, '')), '');
    IF v_artifact IS NULL AND v_notes IS NULL THEN
        RAISE EXCEPTION 'project_submission_empty';
    END IF;
    -- CURRENT authoritative Final PASS, proven by its backing attempt:
    -- same user/program/version, submitted + passed, live bank, live set.
    -- Stale, NULL, or unresolvable references never unlock.
    SELECT c.passed, c.reference_id INTO v_comp_passed, v_comp_ref FROM credential_component_results c
    WHERE c.user_id = auth.uid()
      AND c.program_slug = p_program_slug
      AND c.program_version = v_program.version
      AND c.component = 'final_assessment';
    IF v_comp_passed IS NOT TRUE OR v_comp_ref IS NULL THEN
        RAISE EXCEPTION 'project_not_ready:final';
    END IF;
    SELECT * INTO v_att FROM assessment_attempts WHERE id::text = v_comp_ref;
    IF NOT FOUND
       OR v_att.user_id IS DISTINCT FROM auth.uid()
       OR v_att.program_slug <> p_program_slug
       OR v_att.question_set_version <> v_program.version
       OR v_att.status <> 'submitted'
       OR v_att.passed IS NOT TRUE
       OR v_att.bank_version IS DISTINCT FROM v_live THEN
        RAISE EXCEPTION 'project_not_ready:final';
    END IF;
    SELECT * INTO v_set FROM assessment_question_sets WHERE id = v_att.question_set_id;
    IF NOT FOUND
       OR v_set.status <> 'active'
       OR v_set.content_version IS DISTINCT FROM v_live THEN
        RAISE EXCEPTION 'project_not_ready:final';
    END IF;
    -- Latest submission decides: pending returns as-is, failed opens a
    -- revision, passed refuses another.
    SELECT * INTO v_latest FROM project_submissions
    WHERE user_id = auth.uid()
      AND program_slug = p_program_slug
      AND version = v_program.version
    ORDER BY created_at DESC, id DESC LIMIT 1;
    IF FOUND THEN
        SELECT r.passed INTO v_review_passed FROM project_certification_results r
        WHERE r.user_id = auth.uid()
          AND r.program_slug = p_program_slug
          AND r.version = v_program.version
          AND r.submission_id = v_latest.id;
        IF NOT FOUND THEN
            RETURN QUERY SELECT v_latest.id;
            RETURN;
        END IF;
        IF v_review_passed IS TRUE THEN
            RAISE EXCEPTION 'project_already_passed';
        END IF;
    END IF;
    PERFORM set_config('app.trusted_server', 'on', TRUE);
    INSERT INTO project_submissions (id, user_id, program_slug, version, artifact_ref, notes)
    VALUES (v_sub_id, auth.uid(), v_program.slug, v_program.version, v_artifact, v_notes);
    RETURN QUERY SELECT v_sub_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION submit_project(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION submit_project(TEXT, TEXT, TEXT) TO authenticated;

-- 3. Reviews bind the LATEST submission revision only. ------------------
-- A delayed review of a superseded revision is rejected before it can
-- feed project_certification_results or the project component. Accepted
-- history is untouched: the check only gates NEW review rows.
CREATE OR REPLACE FUNCTION project_review_require_latest()
RETURNS TRIGGER AS $$
DECLARE
    v_sub project_submissions%ROWTYPE;
    v_latest_id UUID;
BEGIN
    SELECT * INTO v_sub FROM project_submissions WHERE id = NEW.submission_id;
    IF NOT FOUND THEN
        RETURN NEW;
    END IF;
    SELECT s.id INTO v_latest_id FROM project_submissions s
    WHERE s.user_id = v_sub.user_id
      AND s.program_slug = v_sub.program_slug
      AND s.version = v_sub.version
    ORDER BY s.created_at DESC, s.id DESC LIMIT 1;
    IF v_latest_id IS DISTINCT FROM NEW.submission_id THEN
        RAISE EXCEPTION 'project_review:submission_superseded';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS project_review_require_latest ON project_reviews;
CREATE TRIGGER project_review_require_latest
    BEFORE INSERT ON project_reviews
    FOR EACH ROW EXECUTE FUNCTION project_review_require_latest();

REVOKE ALL ON FUNCTION project_review_require_latest() FROM PUBLIC, anon, authenticated;

-- 4. Repair the review-history ops hatch for DELETE. ----------------------
-- project_reviews_freeze_history's bypass branch returned NEW, which is
-- NULL in a BEFORE DELETE trigger — so hatch-held deletes were silently
-- skipped (0 rows, no error) and later cascades still hit the guard.
-- Protection is unchanged (UPDATE/DELETE still raise without the hatch);
-- the hatch now actually deletes via RETURN OLD on the DELETE path.
CREATE OR REPLACE FUNCTION project_reviews_freeze_history()
RETURNS TRIGGER AS $$
BEGIN
    IF current_setting('app.review_override', TRUE) = 'on' THEN
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        END IF;
        RETURN NEW;
    END IF;
    IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'project_reviews: immutable; insert a new revision instead';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION project_reviews_freeze_history() FROM PUBLIC, anon, authenticated;
