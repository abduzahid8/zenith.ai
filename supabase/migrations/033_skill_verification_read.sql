-- =====================================================
-- 033 — Server-derived skill verification read model.
--
-- Read-only projection used by the Credential Journey UX to decide
-- per-skill verified state. It evaluates the EXACT skill-gate
-- predicates from issue_credential (v5) over the same tables:
-- first-sample results joined to items (active + version match) and
-- approved releases (active/approved, machine QA passed, human
-- approved), checked against the per-skill evidence policy and the
-- frozen per-skill minimum score — pinned to the program version.
--
-- Why an RPC and not pure client reads: clients have no SELECT access
-- to bank rows (answer keys must never leak), so item status and the
-- item/result version match cannot be checked client-side. This
-- function returns only aggregate counts and the verdict — no keys,
-- payloads, or item identities — so it leaks nothing sensitive.
--
-- No schema, policy, content, or issuance changes. No writes.
-- =====================================================

CREATE OR REPLACE FUNCTION get_skill_verification(p_program_slug TEXT)
RETURNS TABLE (
    skill_key TEXT,
    skill_name TEXT,
    samples_completed INTEGER,
    samples_required INTEGER,
    passes INTEGER,
    pass_rate NUMERIC,
    score NUMERIC,
    verified BOOLEAN
) AS $$
DECLARE
    v_program credential_programs%ROWTYPE;
    v_skill JSONB;
    v_skill_key TEXT;
    v_policy skill_evidence_policy%ROWTYPE;
    v_items INTEGER;
    v_passes INTEGER;
    v_rate NUMERIC;
    v_skill_score NUMERIC;
    v_verified BOOLEAN;
BEGIN
    SELECT * INTO v_program FROM credential_programs
    WHERE slug = p_program_slug AND status = 'active';
    IF NOT FOUND THEN
        RETURN;
    END IF;
    FOR v_skill IN SELECT jsonb_array_elements(v_program.skills) LOOP
        v_skill_key := v_skill ->> 'key';
        SELECT * INTO v_policy FROM skill_evidence_policy
        WHERE skill_evidence_policy.program_slug = p_program_slug
          AND skill_evidence_policy.program_version = v_program.version
          AND skill_evidence_policy.skill_key = v_skill_key;
        IF NOT FOUND THEN
            RETURN QUERY SELECT v_skill_key, v_skill ->> 'name', 0, 0, 0,
                0::numeric, NULL::numeric, FALSE;
            CONTINUE;
        END IF;
        SELECT COUNT(*), COUNT(*) FILTER (WHERE r.finalized_passed)
        INTO v_items, v_passes
        FROM trusted_item_results r
        JOIN trusted_validation_items i ON i.id = r.item_id
        JOIN credential_content_releases rel
          ON rel.program_slug = r.program_slug
         AND rel.program_version = r.program_version
         AND rel.content_version = r.content_version
        WHERE r.user_id = auth.uid()
          AND r.program_slug = p_program_slug
          AND r.program_version = v_program.version
          AND r.skill_key = v_skill_key
          AND r.content_version = i.content_version
          AND i.status = 'active'
          AND rel.status IN ('active', 'approved')
          AND rel.machine_qa_status = 'passed'
          AND rel.human_review_status = 'approved';
        IF v_items = 0 THEN
            RETURN QUERY SELECT v_skill_key, v_skill ->> 'name', 0,
                v_policy.min_items, 0, 0::numeric, NULL::numeric, FALSE;
            CONTINUE;
        END IF;
        v_rate := v_passes::numeric / v_items::numeric;
        v_skill_score := ROUND(v_rate * 100, 1);
        v_verified := v_items >= v_policy.min_items
            AND v_rate >= v_policy.min_pass_rate
            AND v_skill_score >= COALESCE((v_skill ->> 'minimumScore')::numeric, 65);
        RETURN QUERY SELECT v_skill_key, v_skill ->> 'name', v_items,
            v_policy.min_items, v_passes, ROUND(v_rate, 4), v_skill_score, v_verified;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION get_skill_verification(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_skill_verification(TEXT) TO authenticated;
