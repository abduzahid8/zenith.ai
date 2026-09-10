-- =====================================================
-- 024 — Bank lifecycle: versions, status, attempt pins, compromise.
--
-- Content identity is now explicit: every bank row carries a content
-- version + status (active | retired | compromised). Attempts pin the
-- exact bank version they ran against. Issuance counts ONLY evidence
-- from ACTIVE, non-compromised banks. Historical rows are never
-- deleted: compromised results stay auditable with zero authority.
--
-- The chess-v1 bank (answers leaked into public Git history via 021) is
-- marked COMPROMISED here. Its keys are dead for issuance from now on.
-- =====================================================

-- Status on every bank table. ---------------------------------------------
ALTER TABLE trusted_validation_items
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'retired', 'compromised'));
ALTER TABLE knowledge_items
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'retired', 'compromised'));
ALTER TABLE knowledge_items
    ADD COLUMN IF NOT EXISTS content_version TEXT NOT NULL DEFAULT 'bank-v1';
ALTER TABLE practical_items
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'retired', 'compromised'));
ALTER TABLE practical_items
    ADD COLUMN IF NOT EXISTS content_version TEXT NOT NULL DEFAULT 'bank-v1';
ALTER TABLE assessment_question_sets
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'retired', 'compromised'));
ALTER TABLE assessment_question_sets
    ADD COLUMN IF NOT EXISTS content_version TEXT NOT NULL DEFAULT 'bank-v1';

-- Backfill: the current chess production bank is the leaked v1 set.
UPDATE assessment_question_sets
SET content_version = 'chess-v1'
WHERE program_slug = 'chess-foundations';

-- Attempts pin the bank version they ran against. --------------------------
ALTER TABLE trusted_validation_attempts
    ADD COLUMN IF NOT EXISTS content_version TEXT;
ALTER TABLE knowledge_attempts
    ADD COLUMN IF NOT EXISTS content_version TEXT;
ALTER TABLE practical_attempts
    ADD COLUMN IF NOT EXISTS content_version TEXT;
ALTER TABLE assessment_attempts
    ADD COLUMN IF NOT EXISTS bank_version TEXT;

-- Backfill pins from the items/set actually used (auditable continuity).
UPDATE trusted_validation_attempts a
SET content_version = i.content_version
FROM trusted_validation_items i
WHERE a.item_id = i.id AND a.content_version IS NULL;

UPDATE knowledge_attempts a
SET content_version = (
    SELECT i.content_version FROM knowledge_items i
    WHERE i.id::text IN (SELECT jsonb_array_elements_text(a.assigned_item_ids))
    ORDER BY i.content_version LIMIT 1)
WHERE a.content_version IS NULL;

UPDATE practical_attempts a
SET content_version = (
    SELECT i.content_version FROM practical_items i
    WHERE i.id::text IN (SELECT jsonb_array_elements_text(a.assigned_item_ids))
    ORDER BY i.content_version LIMIT 1)
WHERE a.content_version IS NULL;

UPDATE assessment_attempts a
SET bank_version = s.content_version
FROM assessment_question_sets s
WHERE a.question_set_id = s.id AND a.bank_version IS NULL;

-- Compromise the leaked v1 bank. -------------------------------------------
UPDATE trusted_validation_items
SET status = 'compromised'
WHERE content_version = 'chess-v1';

UPDATE knowledge_items
SET status = 'compromised', content_version = 'chess-v1'
WHERE program_slug = 'chess-foundations';

UPDATE practical_items
SET status = 'compromised', content_version = 'chess-v1'
WHERE program_slug = 'chess-foundations';

UPDATE assessment_question_sets
SET status = 'compromised'
WHERE program_slug = 'chess-foundations' AND content_version = 'chess-v1';

-- New starts resolve content_version from the item/set (pinned per attempt).
-- (Function bodies updated in 025; pins are filled there going forward.)
