-- =====================================================
-- 018 — Fix PL/pgSQL OUT-param/column ambiguity in server functions.
--
-- start_trusted_validation: OUT param program_version collided with the
-- unqualified trusted_validation_items.program_version in the lookup
-- WHERE clause ("column reference program_version is ambiguous").
-- start_assessment: OUT param attempt_number collided with
-- MAX(attempt_number). Both are qualified here. No behavior change.
-- =====================================================

CREATE OR REPLACE FUNCTION start_trusted_validation(p_program_slug TEXT, p_curriculum_day INTEGER)
RETURNS TABLE (attempt_id UUID, skill_key TEXT, program_version TEXT, payload JSONB) AS $$
DECLARE
    v_program credential_programs%ROWTYPE;
    v_item trusted_validation_items%ROWTYPE;
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
    SELECT * INTO v_item FROM trusted_validation_items
    WHERE trusted_validation_items.program_slug = p_program_slug
      AND trusted_validation_items.program_version = v_program.version
      AND trusted_validation_items.curriculum_day = p_curriculum_day;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'start_trusted_validation: no trusted content for this program/day';
    END IF;
    PERFORM set_config('app.trusted_server', 'on', TRUE);
    INSERT INTO trusted_validation_attempts
        (id, user_id, item_id, program_slug, program_version, skill_key, status)
    VALUES
        (v_attempt_id, auth.uid(), v_item.id, v_program.slug, v_program.version, v_item.skill_key, 'started');
    RETURN QUERY SELECT v_attempt_id, v_item.skill_key, v_program.version, v_item.payload;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION start_trusted_validation(TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION start_trusted_validation(TEXT, INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION start_assessment(p_program_slug TEXT)
RETURNS TABLE (
    attempt_id UUID, attempt_number INTEGER, question_set_version TEXT,
    time_limit_minutes INTEGER, questions JSONB
) AS $$
DECLARE
    v_program credential_programs%ROWTYPE;
    v_set assessment_question_sets%ROWTYPE;
    v_num INTEGER;
    v_attempt_id UUID := gen_random_uuid();
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'start_assessment: authentication required';
    END IF;
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
    PERFORM set_config('app.trusted_server', 'on', TRUE);
    INSERT INTO user_credential_progress (user_id, program_slug, program_version, status)
    VALUES (auth.uid(), v_program.slug, v_program.version, 'in_assessment')
    ON CONFLICT (user_id, program_slug) DO UPDATE
        SET program_version = EXCLUDED.program_version,
            status = 'in_assessment',
            updated_at = NOW();
    SELECT COALESCE(MAX(assessment_attempts.attempt_number), 0) + 1 INTO v_num
    FROM assessment_attempts
    WHERE assessment_attempts.user_id = auth.uid() AND assessment_attempts.program_slug = p_program_slug;
    INSERT INTO assessment_attempts
        (id, user_id, program_slug, question_set_id, question_set_version,
         attempt_number, status, answers, score, passed)
    VALUES
        (v_attempt_id, auth.uid(), v_program.slug, v_set.id, v_set.version,
         v_num, 'started', NULL, NULL, NULL);
    RETURN QUERY SELECT v_attempt_id, v_num, v_set.version, v_set.time_limit_minutes, v_set.questions;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION start_assessment(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION start_assessment(TEXT) TO authenticated;
