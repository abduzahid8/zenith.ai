-- =====================================================
-- 014 — Tighten trust derivation: structured sessions only.
--
-- Discovery is zero certification authority and quick bites are weak
-- formative only (frozen runtime contract). A validate-phase pass outside
-- a structured session must never become trusted=true, even on
-- registry-listed static content. Replaces the 011 trigger body.
-- =====================================================

CREATE OR REPLACE FUNCTION learning_events_derive_ownership()
RETURNS TRIGGER AS $$
BEGIN
    IF current_setting('app.trusted_server', TRUE) = 'on' THEN
        RETURN NEW;
    END IF;
    IF NEW.client_owner IS NOT NULL AND NEW.client_owner = auth.uid()::text THEN
        NEW.user_id := auth.uid();
    ELSE
        NEW.user_id := NULL;
    END IF;
    NEW.created_at := NOW();
    NEW.trusted := (
        NEW.event_type = 'attempt'
        AND NEW.session_kind = 'structured'
        AND NEW.phase = 'validate'
        AND NEW.outcome = 'pass'
        AND NEW.program_version IS NOT NULL
        AND NEW.provenance IN ('static_bank', 'generated_validated')
        AND EXISTS (
            SELECT 1 FROM trusted_validation_registry r
            WHERE r.hobby_id = NEW.hobby_id
              AND r.curriculum_day = NEW.curriculum_day
        )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
