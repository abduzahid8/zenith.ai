import { getSupabase } from './supabase/client';

/**
 * Server trust API adapters — minimal typed clients for the authoritative
 * flows (migrations 016-020). No screens, no state: these prepare the
 * next UI phase. Every privileged decision (scoring, pass/fail, gating)
 * happens server-side; adapters only transport safe payloads.
 *
 * Retake blocks surface as retake_blocked:<reason>[:detail] errors from
 * start_assessment; parseRetakeBlock maps them to safe reason codes.
 */

export type RetakeReason = 'cooldown' | 'remediation_required';

export interface RetakeBlock {
    blocked: true;
    reason: RetakeReason;
    detail: string | null;
}

export function parseRetakeBlock(message: string): RetakeBlock | null {
    const m = /^retake_blocked:(cooldown|remediation_required)(?::(.*))?$/.exec(message);
    if (!m) return null;
    return { blocked: true, reason: m[1] as RetakeReason, detail: m[2] ?? null };
}

/**
 * Fail-closed content gate: the server raises `credential_content_unavailable`
 * when no live (active + QA-passed + human-approved) content release exists
 * for the program/version. Unlike offline errors this is a valid server
 * response — the client must say "temporarily unavailable", never blame
 * the network and never expose internal codes.
 */
export function isContentUnavailable(message: string): boolean {
    return message.includes('credential_content_unavailable');
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc(fn, args);
    if (error) throw new Error(error.message);
    return (Array.isArray(data) ? data[0] : data) as T;
}

export interface ProgramAvailability {
    slug: string;
    issuable: boolean;
    /** Current server program version (credential_programs.version). Official
     *  component reads pin to exactly this — never inherit older versions. */
    programVersion: string | null;
}

/**
 * Official program availability, read from server state. The client never
 * decides issuability: an official Verify action is offered only when the
 * server row says issuance_enabled. Throws offline/unauthenticated, in
 * which case callers must hide (never invent) official actions.
 */
export const getProgramAvailability = async (): Promise<ProgramAvailability[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('credential_programs')
        .select('slug, issuance_enabled, version');
    if (error) throw new Error(error.message);
    const rows = (Array.isArray(data) ? data : []) as unknown as {
        slug: string; issuance_enabled: boolean; version?: unknown;
    }[];
    return rows.map(r => ({
        slug: r.slug,
        issuable: r.issuance_enabled === true,
        programVersion: typeof r.version === 'string' ? r.version : null,
    }));
};

export interface TrustedSkillResult {
    skillKey: string;
    passed: boolean;
}

/**
 * Raw finalized-result history (any pass, any bank). Kept only for
 * attempt-history display — NEVER for verified state (see below).
 */
export const getTrustedSkillResults = async (programSlug: string): Promise<TrustedSkillResult[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('trusted_item_results')
        .select('skill_key, finalized_passed')
        .eq('program_slug', programSlug);
    if (error) throw new Error(error.message);
    const rows = (Array.isArray(data) ? data : []) as unknown as {
        skill_key: string; finalized_passed: boolean;
    }[];
    return rows.map(r => ({ skillKey: r.skill_key, passed: r.finalized_passed === true }));
};

export interface SkillVerification {
    skillKey: string;
    skillName: string;
    samplesCompleted: number;
    samplesRequired: number;
    passes: number;
    passRate: number;
    score: number | null;
    verified: boolean;
}

/**
 * Server-derived skill verification state, mirroring the issuance skill
 * gate exactly (distinct first-sample items, min counts/rates, active
 * items and releases, pinned versions, minimum scores). Computed by the
 * get_skill_verification RPC over the authoritative tables — the UI
 * defines no second rule and performs no counting itself.
 */
export const getSkillVerification = async (programSlug: string): Promise<SkillVerification[]> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('get_skill_verification', {
        p_program_slug: programSlug,
    });
    if (error) throw new Error(error.message);
    const rows = (Array.isArray(data) ? data : []) as unknown as {
        skill_key: string;
        skill_name: string;
        samples_completed: number;
        samples_required: number;
        passes: number;
        pass_rate: number;
        score: number | null;
        verified: boolean;
    }[];
    return rows.map(r => ({
        skillKey: r.skill_key,
        skillName: r.skill_name,
        samplesCompleted: Number(r.samples_completed),
        samplesRequired: Number(r.samples_required),
        passes: Number(r.passes),
        passRate: Number(r.pass_rate),
        score: r.score == null ? null : Number(r.score),
        verified: r.verified === true,
    }));
};

export interface TrustedChallenge {
    attemptId: string;
    skillKey: string;
    programVersion: string;
    payload: Record<string, unknown>;
}

export interface ValidationResult {
    passed: boolean;
    submitted: boolean;
    trustedEventId: string | null;
    /**
     * True when the attempt's pinned content rotated out from under it:
     * the server superseded the attempt and recorded ZERO proof.
     * Never an official PASS — the UI must offer a fresh check.
     */
    contentStale: boolean;
}

export const startTrustedValidation = (programSlug: string, skillKey: string) =>
    rpc<TrustedChallenge>('start_trusted_validation', {
        p_program_slug: programSlug,
        p_skill_key: skillKey,
    }).then(r => ({
        attemptId: (r as unknown as { attempt_id: string }).attempt_id,
        skillKey: (r as unknown as { skill_key: string }).skill_key,
        programVersion: (r as unknown as { program_version: string }).program_version,
        payload: (r as unknown as { payload: Record<string, unknown> }).payload,
    }));

export const submitTrustedValidation = (attemptId: string, answer: string) =>
    rpc<ValidationResult>('submit_trusted_validation', {
        p_attempt_id: attemptId,
        p_answer: { answer },
    }).then(r => {
        const row = r as unknown as {
            passed: boolean; submitted: boolean; trusted_event_id: string | null; content_stale?: boolean;
        };
        return {
            passed: row.passed,
            submitted: row.submitted,
            trustedEventId: row.trusted_event_id,
            contentStale: row.content_stale === true,
        };
    });

export interface AssessmentStart {
    attemptId: string;
    attemptNumber: number;
    questionSetVersion: string;
    timeLimitMinutes: number;
    questions: unknown[];
    deadline: string;
    retakeReason: string;
}

export const startAssessment = (programSlug: string) =>
    rpc<AssessmentStart>('start_assessment', { p_program_slug: programSlug }).then(r => {
        const row = r as unknown as {
            attempt_id: string; attempt_number: number; question_set_version: string;
            time_limit_minutes: number; questions: unknown[]; deadline: string; retake_reason: string;
        };
        return {
            attemptId: row.attempt_id,
            attemptNumber: row.attempt_number,
            questionSetVersion: row.question_set_version,
            timeLimitMinutes: row.time_limit_minutes,
            questions: row.questions,
            deadline: row.deadline,
            retakeReason: row.retake_reason,
        };
    });

export interface SubmissionResult {
    score: number | null;
    passed: boolean;
    submitted: boolean;
    /** True when rotation superseded the attempt: nothing was scored or recorded. */
    contentStale: boolean;
}

export const submitAssessment = (attemptId: string, answers: Record<string, string>) =>
    rpc<SubmissionResult>('submit_assessment', { p_attempt_id: attemptId, p_answers: answers }).then(r => {
        const row = r as unknown as { score: number | null; passed: boolean; submitted: boolean; content_stale?: boolean };
        return { score: row.score == null ? null : Number(row.score), passed: row.passed, submitted: row.submitted, contentStale: row.content_stale === true };
    });

export const startKnowledgeAttempt = (programSlug: string) =>
    rpc<{ attemptId: string; programVersion: string; questions: unknown[] }>('start_knowledge_attempt', {
        p_program_slug: programSlug,
    }).then(r => {
        const row = r as unknown as { attempt_id: string; program_version: string; questions: unknown[] };
        return { attemptId: row.attempt_id, programVersion: row.program_version, questions: row.questions };
    });

export const submitKnowledgeAttempt = (attemptId: string, answers: Record<string, string>) =>
    rpc<SubmissionResult>('submit_knowledge_attempt', { p_attempt_id: attemptId, p_answers: answers }).then(r => {
        const row = r as unknown as { score: number | null; passed: boolean; submitted: boolean; content_stale?: boolean };
        return { score: row.score == null ? null : Number(row.score), passed: row.passed, submitted: row.submitted, contentStale: row.content_stale === true };
    });

export const startPracticalAttempt = (programSlug: string) =>
    rpc<{ attemptId: string; programVersion: string; tasks: unknown[] }>('start_practical_attempt', {
        p_program_slug: programSlug,
    }).then(r => {
        const row = r as unknown as { attempt_id: string; program_version: string; tasks: unknown[] };
        return { attemptId: row.attempt_id, programVersion: row.program_version, tasks: row.tasks };
    });

export const submitPracticalAttempt = (attemptId: string, answers: Record<string, string>) =>
    rpc<SubmissionResult>('submit_practical_attempt', { p_attempt_id: attemptId, p_answers: answers }).then(r => {
        const row = r as unknown as { score: number | null; passed: boolean; submitted: boolean; content_stale?: boolean };
        return { score: row.score == null ? null : Number(row.score), passed: row.passed, submitted: row.submitted, contentStale: row.content_stale === true };
    });

export interface CredentialProgress {
    userId: string;
    programSlug: string;
    programVersion: string;
    readinessScore: number | null;
    status: string;
    updatedAt: string;
}

export const getCredentialProgress = async (
    programSlug: string,
    programVersion: string,
): Promise<CredentialProgress | null> => {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('user_credential_progress')
        .select('user_id, program_slug, program_version, readiness_score, status, updated_at')
        .eq('program_slug', programSlug)
        .eq('program_version', programVersion)
        .limit(1);
    if (error) throw new Error(error.message);
    const row = (Array.isArray(data) ? data[0] : null) as unknown as {
        user_id: string; program_slug: string; program_version: string;
        readiness_score: number | null; status: string; updated_at: string;
    } | null;
    if (!row) return null;
    return {
        userId: row.user_id,
        programSlug: row.program_slug,
        programVersion: row.program_version,
        readinessScore: row.readiness_score,
        status: row.status,
        updatedAt: row.updated_at,
    };
};

export const submitProject = async (programSlug: string, artifactRef?: string, notes?: string) => {
    // Authoritative path: the submit_project RPC derives owner, enrollment,
    // program, and pinned version server-side. Direct client INSERT into
    // project_submissions is revoked; this adapter must never write there.
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('submit_project', {
        p_program_slug: programSlug,
        p_artifact_ref: artifactRef ?? null,
        p_notes: notes ?? null,
    });
    if (error) throw new Error(error.message);
    const row = (Array.isArray(data) ? data[0] : data) as unknown as { submission_id: string };
    return row.submission_id as string;
};

export interface ProjectReviewState {
    submissionId: string;
    authoritativeScore: number | null;
    passed: boolean | null;
    reviewer: string | null;
    reviewedAt: string | null;
}

export const readProjectReviewState = async (submissionId: string): Promise<ProjectReviewState | null> => {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('project_certification_results')
        .select('submission_id, authoritative_score, passed, evaluator, evaluated_at')
        .eq('submission_id', submissionId)
        .limit(1);
    if (error) throw new Error(error.message);
    const row = (Array.isArray(data) ? data[0] : null) as unknown as {
        submission_id: string; authoritative_score: number; passed: boolean;
        evaluator: string; evaluated_at: string | null;
    } | null;
    if (!row) return null;
    return {
        submissionId: row.submission_id,
        authoritativeScore: row.authoritative_score,
        passed: row.passed,
        reviewer: row.evaluator,
        reviewedAt: row.evaluated_at,
    };
};

export const issueCredential = (programSlug: string, holderName: string) =>
    rpc<{ credentialId: string; created: boolean }>('issue_credential', {
        p_program_slug: programSlug,
        p_holder_name: holderName,
    }).then(r => {
        const row = r as unknown as { credential_id: string; created: boolean };
        return { credentialId: row.credential_id, created: row.created };
    });

export type CredentialClaimState =
    | 'locked'
    | 'ready_to_issue'
    | 'issued'
    | 'revoked'
    | 'expired'
    | 'temporarily_unavailable';

export interface CredentialClaimStatus {
    state: CredentialClaimState;
    credentialId: string | null;
    score: number | null;
    grade: string | null;
    issuedAt: string | null;
    expiresAt: string | null;
}

/**
 * Canonical Claim status (migration 038 `get_credential_status`).
 *
 * The ONLY server-authoritative answer to "can this user claim now, and
 * what do they already hold". Evaluated by the SAME SQL authority as
 * `issue_credential` (shared `assess_credential_eligibility` helper) —
 * never from local skills/components math. Future Claim UI calls this to
 * decide visibility, then `issueCredential` on tap; both agree by
 * construction.
 */
export const getCredentialStatus = (programSlug: string) =>
    rpc<CredentialClaimStatus>('get_credential_status', {
        p_program_slug: programSlug,
    }).then(r => {
        const row = r as unknown as {
            state: CredentialClaimState; credential_id: string | null; score: number | null;
            grade: string | null; issued_at: string | null; expires_at: string | null;
        };
        return {
            state: row.state,
            credentialId: row.credential_id,
            score: row.score == null ? null : Number(row.score),
            grade: row.grade,
            issuedAt: row.issued_at,
            expiresAt: row.expires_at,
        };
    });

export interface EnrollmentResult {
    enrolled: boolean;
    alreadyEnrolled: boolean;
}

/**
 * Server-backed enrollment (idempotent by unique constraint). Returns
 * whether this call created the row. Local flags may cache success but
 * are never authority — callers re-read progress for truth.
 */
export const ensureEnrollment = async (programSlug: string): Promise<EnrollmentResult> => {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('enroll_in_program', {
        p_program_slug: programSlug,
    });
    if (error) throw new Error(error.message);
    const row = (Array.isArray(data) ? data[0] : data) as unknown as { enrolled?: boolean } | boolean | null;
    const enrolled = typeof row === 'boolean' ? row : row?.enrolled === true;
    return { enrolled, alreadyEnrolled: !enrolled };
};

export interface KnowledgeAttemptRow {
    id: string;
    status: 'started' | 'submitted';
    score: number | null;
    passed: boolean | null;
    submittedAt: string | null;
}

/**
 * Pure live-release resolution, mirroring migration 035 authority
 * (status active + machine QA passed + human approved). Exactly one
 * matching row is required — zero or several means no live content.
 * Exported for unit tests; the snapshot adapter is the only caller.
 */
export function resolveLiveContentVersion(
    rows: { content_version?: unknown }[],
): string | null {
    if (rows.length !== 1) return null;
    const version = rows[0].content_version;
    return typeof version === 'string' && version.length > 0 ? version : null;
}

export interface PracticalAttemptRow {
    id: string;
    status: 'started' | 'submitted';
    score: number | null;
    passed: boolean | null;
    submittedAt: string | null;
}

export interface PracticalComponentRow {
    score: number;
    passed: boolean;
}

export interface FinalAttemptRow {
    id: string;
    attemptNumber: number | null;
    status: 'started' | 'submitted';
    score: number | null;
    passed: boolean | null;
    deadline: string | null;
    submittedAt: string | null;
}

export interface FinalComponentRow {
    score: number;
    passed: boolean;
}

export interface CredentialStageSnapshot {
    /** False when no single live release exists: stage reads fail closed. */
    contentAvailable: boolean;
    knowledge: {
        /** Own live-release attempts only (started/submitted, current content). */
        attempts: KnowledgeAttemptRow[];
        /**
         * Official current component, or null. A stored PASS counts only
         * when its reference_id resolves to an own live submitted attempt.
         */
        component: KnowledgeComponentRow | null;
    };
    practical: {
        /** Own live-release attempts only (started/submitted, current content). */
        attempts: PracticalAttemptRow[];
        /** Same reference-resolution rule as knowledge, for practical. */
        component: PracticalComponentRow | null;
    };
    finalAssessment: {
        /** Own current-journey attempts only (live bank, current version). */
        attempts: FinalAttemptRow[];
        /** Same reference-resolution rule, for the Final component. */
        component: FinalComponentRow | null;
    };
}

/**
 * One canonical credential-stage read-authority snapshot. Resolves the
 * current live content release ONCE from public release metadata
 * (Slice 2 rules: active + QA passed + human approved, exactly one row),
 * then uses that SAME internal live contentVersion for Knowledge,
 * Practical, and Final reads — never inherits state from a retired
 * release and never resolves two independent releases. contentVersion
 * never leaves the adapter.
 */
export const getCredentialStageSnapshot = async (
    programSlug: string,
    programVersion: string,
): Promise<CredentialStageSnapshot> => {
    const supabase = getSupabase();
    const { data: relData, error: relError } = await supabase
        .from('credential_content_releases')
        .select('content_version')
        .eq('program_slug', programSlug)
        .eq('program_version', programVersion)
        .eq('status', 'active')
        .eq('machine_qa_status', 'passed')
        .eq('human_review_status', 'approved');
    if (relError) throw new Error(relError.message);
    const live = resolveLiveContentVersion(
        (Array.isArray(relData) ? relData : []) as unknown as { content_version: unknown }[],
    );
    if (live == null) {
        return {
            contentAvailable: false,
            knowledge: { attempts: [], component: null },
            practical: { attempts: [], component: null },
            finalAssessment: { attempts: [], component: null },
        };
    }
    const [
        { data: knowAttData, error: knowAttError },
        { data: pracAttData, error: pracAttError },
        { data: knowCompData, error: knowCompError },
        { data: pracCompData, error: pracCompError },
        { data: finAttData, error: finAttError },
        { data: finCompData, error: finCompError },
    ] = await Promise.all([
        supabase
            .from('knowledge_attempts')
            .select('id, status, score, passed, submitted_at, content_version')
            .eq('program_slug', programSlug)
            .eq('program_version', programVersion)
            .in('status', ['started', 'submitted'])
            .order('started_at', { ascending: false }),
        supabase
            .from('practical_attempts')
            .select('id, status, score, passed, submitted_at, content_version')
            .eq('program_slug', programSlug)
            .eq('program_version', programVersion)
            .in('status', ['started', 'submitted'])
            .order('started_at', { ascending: false }),
        supabase
            .from('credential_component_results')
            .select('score, passed, reference_id')
            .eq('program_slug', programSlug)
            .eq('program_version', programVersion)
            .eq('component', 'knowledge')
            .order('created_at', { ascending: false })
            .limit(1),
        supabase
            .from('credential_component_results')
            .select('score, passed, reference_id')
            .eq('program_slug', programSlug)
            .eq('program_version', programVersion)
            .eq('component', 'practical')
            .order('created_at', { ascending: false })
            .limit(1),
        supabase
            .from('assessment_attempts')
            .select('id, attempt_number, status, score, passed, deadline, submitted_at, bank_version')
            .eq('program_slug', programSlug)
            .eq('question_set_version', programVersion)
            .in('status', ['started', 'submitted'])
            .order('started_at', { ascending: false }),
        supabase
            .from('credential_component_results')
            .select('score, passed, reference_id')
            .eq('program_slug', programSlug)
            .eq('program_version', programVersion)
            .eq('component', 'final_assessment')
            .order('created_at', { ascending: false })
            .limit(1),
    ]);
    if (knowAttError) throw new Error(knowAttError.message);
    if (pracAttError) throw new Error(pracAttError.message);
    if (knowCompError) throw new Error(knowCompError.message);
    if (pracCompError) throw new Error(pracCompError.message);
    if (finAttError) throw new Error(finAttError.message);
    if (finCompError) throw new Error(finCompError.message);
    const filterLive = <T extends { id: unknown; status: unknown; content_version: unknown }>(
        rows: T[],
    ): T[] =>
        rows.filter(
            r =>
                typeof r.id === 'string' &&
                (r.status === 'started' || r.status === 'submitted') &&
                r.content_version === live,
        );
    const knowRows = (Array.isArray(knowAttData) ? knowAttData : []) as unknown as {
        id: unknown; status: unknown; score: number | null; passed: boolean | null;
        submitted_at: string | null; content_version: unknown;
    }[];
    const pracRows = (Array.isArray(pracAttData) ? pracAttData : []) as unknown as {
        id: unknown; status: unknown; score: number | null; passed: boolean | null;
        submitted_at: string | null; content_version: unknown;
    }[];
    const knowledgeAttempts: KnowledgeAttemptRow[] = filterLive(knowRows).map(r => ({
        id: r.id as string,
        status: r.status as 'started' | 'submitted',
        score: r.score == null ? null : Number(r.score),
        passed: r.passed,
        submittedAt: r.submitted_at,
    }));
    const practicalAttempts: PracticalAttemptRow[] = filterLive(pracRows).map(r => ({
        id: r.id as string,
        status: r.status as 'started' | 'submitted',
        score: r.score == null ? null : Number(r.score),
        passed: r.passed,
        submittedAt: r.submitted_at,
    }));
    // Final attempts belong to the current journey only when pinned to the
    // SAME live bank. Safe projection: no bank_version, set ids, assigned
    // ids, or breakdowns leave the adapter.
    const finRows = (Array.isArray(finAttData) ? finAttData : []) as unknown as {
        id: unknown; attempt_number: unknown; status: unknown; score: number | null;
        passed: boolean | null; deadline: unknown; submitted_at: string | null;
        bank_version: unknown;
    }[];
    const finalAttempts: FinalAttemptRow[] = finRows
        .filter(
            r =>
                typeof r.id === 'string' &&
                (r.status === 'started' || r.status === 'submitted') &&
                r.bank_version === live,
        )
        .map(r => ({
            id: r.id as string,
            attemptNumber: typeof r.attempt_number === 'number' ? r.attempt_number : null,
            status: r.status as 'started' | 'submitted',
            score: r.score == null ? null : Number(r.score),
            passed: r.passed,
            deadline: typeof r.deadline === 'string' ? r.deadline : null,
            submittedAt: r.submitted_at,
        }));
    const resolveComponent = (
        compData: unknown,
        liveSubmittedIds: Set<string>,
    ): { score: number; passed: boolean } | null => {
        const compRow = (Array.isArray(compData) ? compData[0] : null) as unknown as {
            score: number; passed: boolean; reference_id: unknown;
        } | null;
        // Both reads are RLS-scoped to the current user, so membership in
        // the live submitted set proves ownership + currency.
        if (
            compRow != null &&
            typeof compRow.reference_id === 'string' &&
            liveSubmittedIds.has(compRow.reference_id)
        ) {
            return { score: Number(compRow.score), passed: compRow.passed === true };
        }
        return null;
    };
    const knowledgeComponent = resolveComponent(
        knowCompData,
        new Set(knowledgeAttempts.filter(a => a.status === 'submitted').map(a => a.id)),
    );
    const practicalComponent = resolveComponent(
        pracCompData,
        new Set(practicalAttempts.filter(a => a.status === 'submitted').map(a => a.id)),
    );
    const finalComponent = resolveComponent(
        finCompData,
        new Set(finalAttempts.filter(a => a.status === 'submitted').map(a => a.id)),
    );
    return {
        contentAvailable: true,
        knowledge: { attempts: knowledgeAttempts, component: knowledgeComponent },
        practical: { attempts: practicalAttempts, component: practicalComponent },
        finalAssessment: { attempts: finalAttempts, component: finalComponent },
    };
};

export interface KnowledgeComponentRow {
    score: number;
    passed: boolean;
}

export interface ProjectSubmissionSummary {
    id: string;
    artifactRef: string | null;
    notes: string | null;
    createdAt: string | null;
}

export interface ProjectReviewSummary {
    submissionId: string;
    score: number | null;
    passed: boolean;
    reviewedAt: string | null;
}

export interface ProjectJourneySnapshot {
    /** Latest own submission for the exact program/version, or null. */
    submission: ProjectSubmissionSummary | null;
    /**
     * Certification result bound to THAT exact submission id, or null.
     * Results for older revisions never carry forward (revision binding).
     */
    review: ProjectReviewSummary | null;
}

/**
 * Slice 5 — project read-authority snapshot over existing RLS only.
 * Reads the latest own project_submissions row (created_at DESC, id
 * DESC), then resolves project_certification_results for that exact
 * submission_id. Never reads project_reviews directly; never exposes
 * rubric or reviewer authority fields. Throws on read errors so the
 * journey can isolate the failure to the Project stage.
 */
export const getProjectJourneySnapshot = async (
    programSlug: string,
    programVersion: string,
): Promise<ProjectJourneySnapshot> => {
    const supabase = getSupabase();
    const { data: subData, error: subError } = await supabase
        .from('project_submissions')
        .select('id, artifact_ref, notes, created_at')
        .eq('program_slug', programSlug)
        .eq('version', programVersion)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(1);
    if (subError) throw new Error(subError.message);
    const subRow = (Array.isArray(subData) ? subData[0] : null) as unknown as {
        id: unknown; artifact_ref: unknown; notes: unknown; created_at: unknown;
    } | null;
    if (subRow == null || typeof subRow.id !== 'string') {
        return { submission: null, review: null };
    }
    const submission: ProjectSubmissionSummary = {
        id: subRow.id,
        artifactRef: typeof subRow.artifact_ref === 'string' ? subRow.artifact_ref : null,
        notes: typeof subRow.notes === 'string' ? subRow.notes : null,
        createdAt: typeof subRow.created_at === 'string' ? subRow.created_at : null,
    };
    const { data: certData, error: certError } = await supabase
        .from('project_certification_results')
        .select('submission_id, authoritative_score, passed, evaluated_at')
        .eq('submission_id', submission.id)
        .limit(1);
    if (certError) throw new Error(certError.message);
    const certRow = (Array.isArray(certData) ? certData[0] : null) as unknown as {
        submission_id: unknown; authoritative_score: number | null; passed: unknown; evaluated_at: unknown;
    } | null;
    // Strict revision binding: only a result stamped for the latest
    // submission id counts. Anything else (older revision, foreign row)
    // is ignored — the submission stays under review.
    if (certRow == null || certRow.submission_id !== submission.id) {
        return { submission, review: null };
    }
    return {
        submission,
        review: {
            submissionId: submission.id,
            score: certRow.authoritative_score == null ? null : Number(certRow.authoritative_score),
            passed: certRow.passed === true,
            reviewedAt: typeof certRow.evaluated_at === 'string' ? certRow.evaluated_at : null,
        },
    };
};

export interface KnowledgeJourneySnapshot {
    /** False when no single live release exists: knowledge reads fail closed. */
    contentAvailable: boolean;
    /** Own live-release attempts only (started/submitted, current content). */
    attempts: KnowledgeAttemptRow[];
    /**
     * Official current component, or null. A stored PASS counts only when
     * its reference_id resolves to an own live submitted attempt — retired
     * content never carries forward. Never trust `passed` alone.
     */
    component: KnowledgeComponentRow | null;
}

/**
 * Slice 2 compatibility projection over the shared credential-stage
 * snapshot. Resolves the live release ONCE (via
 * getCredentialStageSnapshot) and returns the knowledge slice — never an
 * independent knowledge-only release resolution.
 */
export const getKnowledgeJourneySnapshot = async (
    programSlug: string,
    programVersion: string,
): Promise<KnowledgeJourneySnapshot> => {
    const stage = await getCredentialStageSnapshot(programSlug, programVersion);
    return {
        contentAvailable: stage.contentAvailable,
        attempts: stage.knowledge.attempts,
        component: stage.knowledge.component,
    };
};

export type { PublicCredential, VerificationResult } from './credentialVerification';

/**
 * verifyCredential — anonymous server-backed verification returning the
 * exact public model. Never reads local stores (see
 * credentialVerification.verifyCredentialPublic).
 */
export { verifyCredentialPublic as verifyCredential } from './credentialVerification';
