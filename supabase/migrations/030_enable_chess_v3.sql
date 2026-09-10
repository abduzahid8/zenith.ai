-- =====================================================
-- 030 — Re-enable Chess on the rotated bank (final step).
--
-- Preconditions enforced below (aborts otherwise):
-- - chess v1.0, currently disabled
-- - ONE approved+active content release (machine QA passed, human
--   approved, reviewer recorded) with matching artifact generation
-- - for that SAME content_version: validation >=4/skill, knowledge
--   >=4/skill, practical >=2/skill, all ACTIVE
-- - evidence policy exactly min 4 items / 0.75 rate per skill
-- - exactly one ACTIVE final set: 20 assigned of a 40+ bank, >=10/skill,
--   hidden keys present
-- - all other programs stay issuance_enabled=FALSE (exactly one issuable)
-- =====================================================

DO $$
DECLARE
    v_skills TEXT[] := ARRAY['rules', 'openings', 'endgames', 'tactics'];
    v_skill TEXT;
    v_n INTEGER;
    v_bank TEXT;
    v_set UUID;
BEGIN
    IF EXISTS (SELECT 1 FROM credential_programs WHERE slug = 'chess-foundations' AND issuance_enabled) THEN
        RAISE EXCEPTION '030: chess already enabled; refusing double-enable';
    END IF;

    SELECT content_version INTO v_bank FROM credential_content_releases
    WHERE program_slug = 'chess-foundations' AND program_version = '1.0'
      AND status = 'active' AND machine_qa_status = 'passed' AND human_review_status = 'approved'
      AND reviewer IS NOT NULL AND reviewed_at IS NOT NULL;
    IF v_bank IS NULL THEN
        RAISE EXCEPTION '030: no approved active release with recorded review';
    END IF;
    IF (SELECT COUNT(*) FROM credential_content_releases
        WHERE program_slug = 'chess-foundations' AND status = 'active') <> 1 THEN
        RAISE EXCEPTION '030: must have exactly one active release';
    END IF;

    FOREACH v_skill IN ARRAY v_skills LOOP
        SELECT COUNT(*) INTO v_n FROM trusted_validation_items
        WHERE program_slug = 'chess-foundations' AND skill_key = v_skill
          AND content_version = v_bank AND status = 'active';
        IF v_n < 8 THEN
            RAISE EXCEPTION '030: validation bank short for skill % (%)', v_skill, v_n;
        END IF;
        SELECT COUNT(*) INTO v_n FROM knowledge_items
        WHERE program_slug = 'chess-foundations' AND skill_key = v_skill
          AND content_version = v_bank AND status = 'active';
        IF v_n < 4 THEN
            RAISE EXCEPTION '030: knowledge bank short for skill % (%)', v_skill, v_n;
        END IF;
        SELECT COUNT(*) INTO v_n FROM practical_items
        WHERE program_slug = 'chess-foundations' AND skill_key = v_skill
          AND content_version = v_bank AND status = 'active';
        IF v_n < 2 THEN
            RAISE EXCEPTION '030: practical bank short for skill % (%)', v_skill, v_n;
        END IF;
        PERFORM 1 FROM skill_evidence_policy
        WHERE program_slug = 'chess-foundations' AND program_version = '1.0'
          AND skill_key = v_skill AND min_items = 4 AND min_pass_rate = 0.75;
        IF NOT FOUND THEN
            RAISE EXCEPTION '030: evidence policy mismatch for skill %', v_skill;
        END IF;
    END LOOP;

    SELECT id INTO v_set FROM assessment_question_sets s
    WHERE s.program_slug = 'chess-foundations' AND s.version = '1.0' AND s.status = 'active'
      AND s.content_version = v_bank
      AND s.question_count = 20
      AND (SELECT COUNT(*) FROM jsonb_array_elements(s.questions)) >= 40
      AND NOT EXISTS (
          SELECT 1 FROM (SELECT q ->> 'skill' AS sk, COUNT(*) AS c
                         FROM jsonb_array_elements(s.questions) q GROUP BY 1) per
          WHERE per.c < 10);
    IF v_set IS NULL THEN
        RAISE EXCEPTION '030: no active balanced final bank on the release version';
    END IF;
    PERFORM 1 FROM assessment_answer_keys k WHERE k.question_set_id = v_set
      AND k.answers <> '{}'::jsonb;
    IF NOT FOUND THEN
        RAISE EXCEPTION '030: active final bank has no hidden keys';
    END IF;

    UPDATE credential_programs SET issuance_enabled = TRUE WHERE slug = 'chess-foundations';

    SELECT COUNT(*) INTO v_n FROM credential_programs WHERE issuance_enabled = TRUE;
    IF v_n <> 1 THEN
        RAISE EXCEPTION '030: expected exactly one issuance-ready program, found %', v_n;
    END IF;
END
$$;
