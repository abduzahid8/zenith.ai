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

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc(fn, args);
    if (error) throw new Error(error.message);
    return (Array.isArray(data) ? data[0] : data) as T;
}

export interface ProgramAvailability {
    slug: string;
    issuable: boolean;
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
        .select('slug, issuance_enabled');
    if (error) throw new Error(error.message);
    const rows = (Array.isArray(data) ? data : []) as unknown as {
        slug: string; issuance_enabled: boolean;
    }[];
    return rows.map(r => ({ slug: r.slug, issuable: r.issuance_enabled === true }));
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
        const row = r as unknown as { passed: boolean; submitted: boolean; trusted_event_id: string | null };
        return { passed: row.passed, submitted: row.submitted, trustedEventId: row.trusted_event_id };
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
    score: number;
    passed: boolean;
    submitted: boolean;
}

export const submitAssessment = (attemptId: string, answers: Record<string, string>) =>
    rpc<SubmissionResult>('submit_assessment', { p_attempt_id: attemptId, p_answers: answers }).then(r => {
        const row = r as unknown as { score: number; passed: boolean; submitted: boolean };
        return { score: Number(row.score), passed: row.passed, submitted: row.submitted };
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
        const row = r as unknown as { score: number; passed: boolean; submitted: boolean };
        return { score: Number(row.score), passed: row.passed, submitted: row.submitted };
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
        const row = r as unknown as { score: number; passed: boolean; submitted: boolean };
        return { score: Number(row.score), passed: row.passed, submitted: row.submitted };
    });

export interface CredentialProgress {
    userId: string;
    programSlug: string;
    programVersion: string;
    readinessScore: number | null;
    status: string;
    updatedAt: string;
}

export const getCredentialProgress = async (programSlug: string): Promise<CredentialProgress | null> => {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('user_credential_progress')
        .select('user_id, program_slug, program_version, readiness_score, status, updated_at')
        .eq('program_slug', programSlug)
        .order('program_version', { ascending: false })
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

export type { PublicCredential, VerificationResult } from './credentialVerification';

/**
 * verifyCredential — anonymous server-backed verification returning the
 * exact public model. Never reads local stores (see
 * credentialVerification.verifyCredentialPublic).
 */
export { verifyCredentialPublic as verifyCredential } from './credentialVerification';
