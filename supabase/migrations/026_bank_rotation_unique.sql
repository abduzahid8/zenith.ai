-- =====================================================
-- 026 — Bank rotation support: one live bank per program+version.
--
-- The pre-rotation UNIQUE(program_slug, version) allowed only a single
-- question set ever, which makes bank rotation (compromised -> active)
-- impossible. Replaced with a partial unique: exactly one ACTIVE set
-- per program+version; retired/compromised history coexists auditably.
-- (Start functions already select the newest ACTIVE set.)
-- =====================================================

ALTER TABLE assessment_question_sets
    DROP CONSTRAINT IF EXISTS assessment_question_sets_program_slug_version_key;

DROP INDEX IF EXISTS assessment_sets_one_active_uidx;
CREATE UNIQUE INDEX IF NOT EXISTS assessment_sets_one_active_uidx
    ON assessment_question_sets (program_slug, version)
    WHERE status = 'active';
