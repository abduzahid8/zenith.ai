-- =====================================================
-- 031 — Release integrity hardening: review kind, program policy flag,
-- DB-level bank immutability.
--
-- - credential_content_releases.review_kind distinguishes author
--   self-review from independent review. chess-v3 is honestly recorded
--   as author self-review (independent review pending for high-stakes).
-- - credential_programs.require_independent_review lets policy demand
--   independent approval; chess pilot stays FALSE (documented).
-- - Bank rows are append-only history: content_version can never change
--   on UPDATE, and no UPDATE may flip a row back to active (activation
--   happens by inserting new rows; compromised rows can never return).
-- =====================================================

ALTER TABLE credential_content_releases
    ADD COLUMN IF NOT EXISTS review_kind TEXT
    CHECK (review_kind IN ('author_self_review', 'independent_review'));

UPDATE credential_content_releases
SET review_kind = 'author_self_review'
WHERE program_slug = 'chess-foundations'
  AND content_version = 'chess-v3'
  AND review_kind IS NULL;

ALTER TABLE credential_programs
    ADD COLUMN IF NOT EXISTS require_independent_review BOOLEAN NOT NULL DEFAULT FALSE;

-- Pilot posture (explicit): independent review is still pending, so the
-- flag stays FALSE for chess. Flipping it TRUE would require 030-style
-- guards to additionally demand review_kind = 'independent_review'.
UPDATE credential_programs
SET require_independent_review = FALSE
WHERE slug = 'chess-foundations';

CREATE OR REPLACE FUNCTION bank_rows_immutable()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.content_version IS DISTINCT FROM NEW.content_version THEN
        RAISE EXCEPTION 'bank rows are immutable: content_version cannot change (ship a new release)';
    END IF;
    IF NEW.status = 'active' AND OLD.status IS DISTINCT FROM 'active' THEN
        RAISE EXCEPTION 'bank rows are immutable: only INSERTs create active rows (ship a new release)';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS bank_rows_immutable ON trusted_validation_items;
CREATE TRIGGER bank_rows_immutable
    BEFORE UPDATE ON trusted_validation_items
    FOR EACH ROW EXECUTE FUNCTION bank_rows_immutable();

DROP TRIGGER IF EXISTS bank_rows_immutable ON knowledge_items;
CREATE TRIGGER bank_rows_immutable
    BEFORE UPDATE ON knowledge_items
    FOR EACH ROW EXECUTE FUNCTION bank_rows_immutable();

DROP TRIGGER IF EXISTS bank_rows_immutable ON practical_items;
CREATE TRIGGER bank_rows_immutable
    BEFORE UPDATE ON practical_items
    FOR EACH ROW EXECUTE FUNCTION bank_rows_immutable();

DROP TRIGGER IF EXISTS bank_rows_immutable ON assessment_question_sets;
CREATE TRIGGER bank_rows_immutable
    BEFORE UPDATE ON assessment_question_sets
    FOR EACH ROW EXECUTE FUNCTION bank_rows_immutable();

REVOKE ALL ON FUNCTION bank_rows_immutable() FROM PUBLIC, anon, authenticated;
