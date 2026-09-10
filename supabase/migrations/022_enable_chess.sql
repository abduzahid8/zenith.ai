-- =====================================================
-- 022 — Enable the Chess Foundations pilot (LAST).
--
-- Applied only after every real DB test passes. Enables issuance for
-- EXACTLY ONE program. All other programs stay issuance_enabled=false:
-- they have no trusted banks, no components, and must remain blocked
-- rather than issue unproven credentials. Flipping any other program
-- issuable is an explicit future policy action with its own content
-- pack, never a side effect.
-- =====================================================

UPDATE credential_programs
SET issuance_enabled = TRUE
WHERE slug = 'chess-foundations';

-- Guardrail: exactly one program may be issuable after this migration.
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count FROM credential_programs WHERE issuance_enabled = TRUE;
    IF v_count <> 1 THEN
        RAISE EXCEPTION '022: expected exactly one issuance-ready program, found %', v_count;
    END IF;
END
$$;
