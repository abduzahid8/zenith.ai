-- =====================================================
-- 027 — Re-enable Chess Foundations ONLY (final step).
--
-- Preconditions enforced by guardrails below (aborts otherwise):
-- - chess program v1.0 active with issuance currently OFF
-- - >=4 ACTIVE validation items per skill on a single bank version
-- - >=4 ACTIVE knowledge items per skill
-- - >=2 ACTIVE practical items per skill
-- - evidence policy present for all 4 skills
-- - exactly one ACTIVE final set with >=40 banked questions, >=10/skill
-- - hidden answer keys present for that set
-- - all other programs stay issuance_enabled=FALSE (exactly one issuable)
-- =====================================================

DO $$
DECLARE
    v_skills TEXT[] := ARRAY['rules', 'openings', 'endgames', 'tactics'];
    v_skill TEXT;
    v_n INTEGER;
    v_bank TEXT;
BEGIN
    IF EXISTS (SELECT 1 FROM credential_programs WHERE slug = 'chess-foundations' AND issuance_enabled) THEN
        RAISE EXCEPTION '027: chess already enabled; refusing double-enable';
    END IF;

    SELECT content_version INTO v_bank FROM trusted_validation_items
    WHERE program_slug = 'chess-foundations' AND status = 'active'
    GROUP BY content_version HAVING COUNT(DISTINCT skill_key) = 4 LIMIT 1;
    IF v_bank IS NULL THEN
        RAISE EXCEPTION '027: no single active validation bank covering all skills';
    END IF;

    FOREACH v_skill IN ARRAY v_skills LOOP
        SELECT COUNT(*) INTO v_n FROM trusted_validation_items
        WHERE program_slug = 'chess-foundations' AND skill_key = v_skill
          AND content_version = v_bank AND status = 'active';
        IF v_n < 4 THEN
            RAISE EXCEPTION '027: validation bank short for skill % (%)', v_skill, v_n;
        END IF;
        SELECT COUNT(*) INTO v_n FROM knowledge_items
        WHERE program_slug = 'chess-foundations' AND skill_key = v_skill
          AND content_version = v_bank AND status = 'active';
        IF v_n < 4 THEN
            RAISE EXCEPTION '027: knowledge bank short for skill % (%)', v_skill, v_n;
        END IF;
        SELECT COUNT(*) INTO v_n FROM practical_items
        WHERE program_slug = 'chess-foundations' AND skill_key = v_skill
          AND content_version = v_bank AND status = 'active';
        IF v_n < 2 THEN
            RAISE EXCEPTION '027: practical bank short for skill % (%)', v_skill, v_n;
        END IF;
        PERFORM 1 FROM skill_evidence_policy
        WHERE program_slug = 'chess-foundations' AND program_version = '1.0' AND skill_key = v_skill;
        IF NOT FOUND THEN
            RAISE EXCEPTION '027: no evidence policy for skill %', v_skill;
        END IF;
    END LOOP;

    PERFORM 1 FROM assessment_question_sets s
    WHERE s.program_slug = 'chess-foundations' AND s.version = '1.0' AND s.status = 'active'
      AND s.question_count = 20
      AND (SELECT COUNT(*) FROM jsonb_array_elements(s.questions)) >= 40
      AND NOT EXISTS (
          SELECT 1 FROM (SELECT q ->> 'skill' AS sk, COUNT(*) AS c
                         FROM jsonb_array_elements(s.questions) q GROUP BY 1) per
          WHERE per.c < 10);
    IF NOT FOUND THEN
        RAISE EXCEPTION '027: no active 20-of-40+ balanced final bank';
    END IF;

    PERFORM 1 FROM assessment_question_sets s
    JOIN assessment_answer_keys k ON k.question_set_id = s.id
    WHERE s.program_slug = 'chess-foundations' AND s.version = '1.0' AND s.status = 'active'
      AND k.answers <> '{}'::jsonb;
    IF NOT FOUND THEN
        RAISE EXCEPTION '027: active final bank has no hidden keys';
    END IF;

    UPDATE credential_programs SET issuance_enabled = TRUE WHERE slug = 'chess-foundations';

    SELECT COUNT(*) INTO v_n FROM credential_programs WHERE issuance_enabled = TRUE;
    IF v_n <> 1 THEN
        RAISE EXCEPTION '027: expected exactly one issuance-ready program, found %', v_n;
    END IF;
END
$$;
