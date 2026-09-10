-- =====================================================
-- 015 — Harden trust-layer function grants (advisor follow-up).
--
-- Trigger-only helpers are never directly callable (triggers fire
-- regardless of EXECUTE grants). Authenticated-only RPCs deny anon
-- explicitly. verify_credential stays anon+authenticated by design.
-- assessment_answer_keys intentionally carries NO policies: answer keys
-- never leave the server (service role + SECURITY DEFINER only).
-- =====================================================

REVOKE ALL ON FUNCTION learning_events_derive_ownership() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION assessment_attempts_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION project_submissions_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION upsert_learning_event(JSONB) FROM anon;
REVOKE ALL ON FUNCTION submit_assessment(UUID, JSONB) FROM anon;
REVOKE ALL ON FUNCTION enroll_in_program(TEXT) FROM anon;
REVOKE ALL ON FUNCTION issue_credential(TEXT, TEXT) FROM anon;
