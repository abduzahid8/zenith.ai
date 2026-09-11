-- =====================================================
-- 032 — Released content is immutable at the DB level.
--
-- After creation, authoritative content fields must not change, on ANY
-- of the five bank tables. The ONLY permitted UPDATEs are lifecycle
-- status transitions the policy explicitly allows:
--   active -> retired, active -> compromised, retired -> compromised
-- Everything else on UPDATE is rejected, including:
--   payload / answer_key / questions / question_ids, program/version/
--   content identity, skill mapping, lesson/item identity, and any
--   resurrection back to active (activation happens by INSERTing new
--   rows; compromised rows can never return).
-- Idempotent loader re-runs (identical values) pass through untouched;
-- any real mutation raises before it lands.
-- =====================================================

CREATE OR REPLACE FUNCTION bank_content_frozen()
RETURNS TRIGGER AS $$
DECLARE
    frozen TEXT[];
BEGIN
    IF TG_TABLE_NAME = 'trusted_validation_items' THEN
        frozen := ARRAY['program_slug', 'program_version', 'content_version',
                        'hobby_id', 'curriculum_day', 'skill_key', 'lesson_id',
                        'payload', 'answer_key'];
    ELSIF TG_TABLE_NAME IN ('knowledge_items', 'practical_items') THEN
        frozen := ARRAY['program_slug', 'program_version', 'content_version',
                        'skill_key', 'item_key', 'payload', 'answer_key'];
    ELSIF TG_TABLE_NAME = 'assessment_question_sets' THEN
        frozen := ARRAY['program_slug', 'version', 'content_version',
                        'question_count', 'time_limit_minutes', 'pass_score',
                        'questions'];
    ELSIF TG_TABLE_NAME = 'assessment_answer_keys' THEN
        frozen := ARRAY['answers', 'question_ids'];
    ELSE
        RETURN NEW;
    END IF;

    IF TG_TABLE_NAME = 'assessment_answer_keys' THEN
        IF (OLD.answers IS DISTINCT FROM NEW.answers)
           OR (OLD.question_ids IS DISTINCT FROM NEW.question_ids) THEN
            RAISE EXCEPTION 'bank content is immutable: answer keys cannot change (ship a new release)';
        END IF;
        RETURN NEW;
    END IF;

    -- Forbidden: any frozen-column drift (covers identity, mapping, payload).
    IF EXISTS (SELECT 1 FROM UNNEST(frozen) AS col
               WHERE (to_jsonb(OLD) -> col) IS DISTINCT FROM (to_jsonb(NEW) -> col)) THEN
        RAISE EXCEPTION 'bank content is immutable: % cannot change (ship a new release)', TG_TABLE_NAME;
    END IF;

    -- Only explicitly permitted lifecycle transitions may change status.
    IF (OLD.status IS DISTINCT FROM NEW.status)
       AND NOT ((OLD.status = 'active' AND NEW.status IN ('retired', 'compromised'))
                OR (OLD.status = 'retired' AND NEW.status = 'compromised')) THEN
        RAISE EXCEPTION 'bank lifecycle violation: % -> % is not permitted', OLD.status, NEW.status;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS bank_content_frozen ON trusted_validation_items;
CREATE TRIGGER bank_content_frozen
    BEFORE UPDATE ON trusted_validation_items
    FOR EACH ROW EXECUTE FUNCTION bank_content_frozen();

DROP TRIGGER IF EXISTS bank_content_frozen ON knowledge_items;
CREATE TRIGGER bank_content_frozen
    BEFORE UPDATE ON knowledge_items
    FOR EACH ROW EXECUTE FUNCTION bank_content_frozen();

DROP TRIGGER IF EXISTS bank_content_frozen ON practical_items;
CREATE TRIGGER bank_content_frozen
    BEFORE UPDATE ON practical_items
    FOR EACH ROW EXECUTE FUNCTION bank_content_frozen();

DROP TRIGGER IF EXISTS bank_content_frozen ON assessment_question_sets;
CREATE TRIGGER bank_content_frozen
    BEFORE UPDATE ON assessment_question_sets
    FOR EACH ROW EXECUTE FUNCTION bank_content_frozen();

DROP TRIGGER IF EXISTS bank_content_frozen ON assessment_answer_keys;
CREATE TRIGGER bank_content_frozen
    BEFORE UPDATE ON assessment_answer_keys
    FOR EACH ROW EXECUTE FUNCTION bank_content_frozen();

REVOKE ALL ON FUNCTION bank_content_frozen() FROM PUBLIC, anon, authenticated;
