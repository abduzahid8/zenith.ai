-- =====================================================
-- 023 — Lockdown: disable Chess issuance FIRST.
--
-- The chess-v1 bank is treated as COMPROMISED (answers in public Git).
-- Issuance stays OFF for every program until rotation, QA, and policy
-- fixes land and are proven. See 024+ and the phase report.
-- =====================================================

UPDATE credential_programs
SET issuance_enabled = FALSE
WHERE slug = 'chess-foundations';
