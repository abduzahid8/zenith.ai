-- =====================================================
-- 028 — Release gate lockdown: disable Chess issuance FIRST.
--
-- The v2 validation bank reuses v1 item UUIDs (loader upserted in
-- place), so compromised v1 proof could resurrect as v2 authority.
-- Issuance stays OFF for every program until immutable identity,
-- first-sample authority, and release gating land (029+) and are proven.
-- =====================================================

UPDATE credential_programs
SET issuance_enabled = FALSE
WHERE slug = 'chess-foundations';
