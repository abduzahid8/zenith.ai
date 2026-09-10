/**
 * ZENYTH SERVER TRUST LAYER — canonical server-side policies.
 *
 * Frozen-runtime contract: the client learning runtime (SessionBlueprint,
 * learningCards, SwipeLearningSession, recommendation rules, Skill State
 * scoring, learning event semantics) is FROZEN. This module does NOT
 * re-derive any of those rules — it re-exports and reuses them.
 *
 * Authority model (hardened, migrations 016+):
 * - Client-synced learning_events rows are ALWAYS trusted=false, no matter
 *   what the client claims (pass/structured/validate/static_bank). They
 *   feed history/personalization/Skill State — never certification proof.
 * - Proof-grade evidence is created ONLY by server-scored flows
 *   (submit_trusted_validation / submit_assessment / service-role project
 *   certification) as rows with provenance 'server_scored'. Clients can
 *   never mint that provenance (trigger coerces it to NULL).
 * - isTrustedValidation below still describes the FROZEN RUNTIME
 *   distinction (hasValidation vs trustedValidation over client-observed
 *   content provenance). The server additionally requires the row to be
 *   server-created: see isServerProvenRow.
 * - Client-supplied evidenceStrength / outcomeValue / assessment scores /
 *   project scores / credential eligibility are treated as OBSERVATIONS.
 *   Authoritative projections are derived here (and mirrored in SQL,
 *   where server authority wins).
 *
 * Purity: this module imports ONLY pure domain code (no React Native,
 * no AsyncStorage, no Supabase client) so the same policies run in
 * jest, in Edge Functions, and as documentation for the SQL mirror.
 */

import {
    strengthFor,
    sourceFor,
} from '../domain/sessions/learningEvents';
import type {
    EvidenceStrength,
    LearningEvent,
} from '../domain/sessions/learningEvents';
import { evidenceValueOf } from '../domain/sessions/outcomePolicy';
import type { MasteryOutcome } from '../domain/sessions/outcomePolicy';
import { projectSkillState } from '../domain/sessions/skillState';
import type { SkillProjection } from '../domain/sessions/skillState';
import type { SessionKind } from '../domain/sessions/sessionBlueprint';
import type { InteractiveCardKind } from '../domain/sessions/learningEvents';

/** Re-exported frozen projector: server skill snapshots share client code. */
export { projectSkillState };
export type { SkillProjection };

/** Schema version the server accepts for learning_events rows. */
export const SERVER_EVENT_SCHEMA_VERSION = 1 as const;

/** Provenance values the server may approve as proof-grade. */
export const SERVER_APPROVED_PROVENANCE = [
    'static_bank',
    'generated_validated',
    'server_scored',
] as const;

export type ServerApprovedProvenance = (typeof SERVER_APPROVED_PROVENANCE)[number];

/**
 * deriveEvidenceStrength — server recomputation of evidence strength from
 * immutable event facts. Client-supplied evidenceStrength is IGNORED.
 * Mirrors the frozen buildAttemptEvent rule exactly:
 * discovery => none; unverified challenge => medium (never strong).
 */
export function deriveEvidenceStrength(input: {
    sessionKind: SessionKind;
    cardKind: InteractiveCardKind | 'exposure';
    provenance?: string | null;
}): EvidenceStrength {
    const base = strengthFor(input.sessionKind, input.cardKind);
    if (input.cardKind === 'challenge' && input.provenance === 'generated_unverified') {
        return 'medium';
    }
    return base;
}

/** deriveOutcomeValue — canonical mastery weight: pass 1, partial .5, else 0. */
export function deriveOutcomeValue(outcome: MasteryOutcome | undefined): number {
    return evidenceValueOf(outcome);
}

export interface TrustedRegistryEntry {
    hobbyId: string;
    curriculumDay: number;
    lessonId?: string | null;
}

function registryKey(hobbyId: string, curriculumDay: number): string {
    return `${hobbyId}:${curriculumDay}`;
}

export function buildTrustedRegistry(entries: TrustedRegistryEntry[]): Set<string> {
    return new Set(entries.map(e => registryKey(e.hobbyId, e.curriculumDay)));
}

/**
 * isTrustedValidation — the proof-grade gate. Returns true ONLY when ALL hold:
 * - attempt event, validate phase, pass outcome
 * - provenance is server-approved (never 'generated_unverified'/undefined)
 * - static_bank claims match a server registry row (server-approved content)
 * - program version is pinned (unversioned legacy can never be proof-grade)
 * Mirrors SQL trigger learning_events_derive_trust (migration 011).
 */
export function isTrustedValidation(
    event: Pick<
        LearningEvent,
        'eventType' | 'phase' | 'outcome' | 'provenance' | 'hobbyId' | 'curriculumDay' | 'programVersion' | 'sessionKind'
    >,
    registry: Set<string>,
): boolean {
    if (event.eventType !== 'attempt') return false;
    if (event.phase !== 'validate') return false;
    if (event.outcome !== 'pass') return false;
    if (!event.programVersion) return false;
    // Discovery is always zero certification authority and quick bites are
    // weak formative only: only structured-session validation can be
    // proof-grade. Server-created summative rows bypass this path.
    if (event.sessionKind !== 'structured') return false;
    // Provenance arrives as the frozen narrow union; the server reasons over
    // the wider provenance vocabulary (validated/scored rows exist only
    // server-side), so compare through a string view.
    const provenance = event.provenance as string | undefined;
    if (provenance !== 'static_bank' && provenance !== 'generated_validated' && provenance !== 'server_scored') {
        return false;
    }
    if (provenance === 'static_bank') {
        if (typeof event.curriculumDay !== 'number') return false;
        if (!registry.has(registryKey(event.hobbyId, event.curriculumDay))) return false;
    }
    return true;
}

export interface AssessmentScore {
    correct: number;
    total: number;
    /** 0..100 */
    score: number;
    passed: boolean;
}

/**
 * scoreAssessmentFromAnswers — server-side scoring. Client submits ANSWERS;
 * the server computes the score. Exact-match per question id; unanswered or
 * unknown ids score 0. Mirrors SQL submit_assessment (migration 012).
 */
export function scoreAssessmentFromAnswers(input: {
    answers: Record<string, string>;
    answerKey: Record<string, string>;
    questionIds: string[];
    passScore: number;
}): AssessmentScore {
    const total = input.questionIds.length;
    let correct = 0;
    for (const qid of input.questionIds) {
        const given = input.answers[qid];
        const expected = input.answerKey[qid];
        if (typeof given === 'string' && given.length > 0 && given === expected) {
            correct += 1;
        }
    }
    const score = total === 0 ? 0 : Math.round((correct / total) * 1000) / 10;
    return { correct, total, score, passed: total > 0 && score >= input.passScore };
}

export interface SkillGate {
    skillKey: string;
    minTrustedValidations: number;
    minSessions: number;
}

export interface TrustedCoverage {
    skillKey: string;
    trustedValidations: number;
    sessions: number;
}

/**
 * trustedValidationCoverage — per-skill counts over SERVER-TRUSTED rows only.
 * Callers must pass only rows the server already filtered by owner
 * (RLS) and flagged trusted. Mirrors the coverage query in
 * issue_credential (migration 013).
 */
export function trustedValidationCoverage(
    trustedEvents: Pick<LearningEvent, 'skillKey' | 'sessionId'>[],
): TrustedCoverage[] {
    const bySkill = new Map<string, { count: number; sessions: Set<string> }>();
    for (const e of trustedEvents) {
        if (!e.skillKey) continue;
        const slot = bySkill.get(e.skillKey) ?? { count: 0, sessions: new Set<string>() };
        slot.count += 1;
        slot.sessions.add(e.sessionId);
        bySkill.set(e.skillKey, slot);
    }
    return [...bySkill.entries()].map(([skillKey, slot]) => ({
        skillKey,
        trustedValidations: slot.count,
        sessions: slot.sessions.size,
    }));
}

export interface IssuanceGateInput {
    programSlug: string;
    programVersion: string;
    requiresAssessment: boolean;
    assessmentPassScore: number;
    assessment: { passed: boolean; score: number; programVersion: string } | null;
    requiresProject: boolean;
    project: { passed: boolean; authoritative: boolean; programVersion: string } | null;
    skillGates: SkillGate[];
    coverage: TrustedCoverage[];
}

export interface IssuanceGateResult {
    eligible: boolean;
    reasons: string[];
}

/**
 * evaluateIssuanceGate — official issuance precondition check. Never trusts
 * holder-supplied scores/skills: assessment must be a server-scored pass,
 * project must be an authoritative certification result, skills must meet
 * trusted-validation coverage on the pinned program version.
 * Mirrors issue_credential (migration 013).
 */
export function evaluateIssuanceGate(input: IssuanceGateInput): IssuanceGateResult {
    const reasons: string[] = [];
    if (input.requiresAssessment) {
        if (!input.assessment) {
            reasons.push('missing_authoritative_assessment');
        } else {
            if (!input.assessment.passed) reasons.push('assessment_not_passed');
            if (input.assessment.programVersion !== input.programVersion) {
                reasons.push('assessment_version_mismatch');
            }
        }
    }
    if (input.requiresProject) {
        if (!input.project) {
            reasons.push('missing_authoritative_project');
        } else {
            if (!input.project.authoritative) reasons.push('project_not_authoritative');
            if (!input.project.passed) reasons.push('project_not_passed');
            if (input.project.programVersion !== input.programVersion) {
                reasons.push('project_version_mismatch');
            }
        }
    }
    const coverageBySkill = new Map(input.coverage.map(c => [c.skillKey, c]));
    for (const gate of input.skillGates) {
        const cov = coverageBySkill.get(gate.skillKey);
        if (!cov || cov.trustedValidations < gate.minTrustedValidations || cov.sessions < gate.minSessions) {
            reasons.push(`skill_gate_failed:${gate.skillKey}`);
        }
    }
    return { eligible: reasons.length === 0, reasons };
}

export interface PublicCredential {
    credentialId: string;
    programSlug: string;
    programTitle: string;
    programVersion: string;
    holderDisplayName: string;
    issuedAt: string;
    expiresAt: string | null;
    status: 'active' | 'revoked';
    verifiedSkills: { key: string; name: string }[];
    finalScore: number;
    grade: string;
}

/**
 * projectPublicVerification — anonymous verification projection. Outputs ONLY
 * safe public fields; never user ids, answers, or internal evidence.
 * Mirrors verify_credential (migration 013).
 */
export function projectPublicVerification(row: {
    credential_id: string;
    program_slug: string;
    program_title: string;
    program_version: string;
    holder_display_name: string;
    issued_at: string;
    expires_at: string | null;
    status: string;
    verified_skills: { key: string; name: string }[];
    final_score: number;
    grade: string;
}): PublicCredential {
    return {
        credentialId: row.credential_id,
        programSlug: row.program_slug,
        programTitle: row.program_title,
        programVersion: row.program_version,
        holderDisplayName: row.holder_display_name,
        issuedAt: row.issued_at,
        expiresAt: row.expires_at,
        status: row.status === 'revoked' ? 'revoked' : 'active',
        verifiedSkills: row.verified_skills,
        finalScore: row.final_score,
        grade: row.grade,
    };
}

/** Re-exported frozen source mapping for server ingestion parity. */
export { sourceFor };

/**
 * isServerProvenRow — the hardened server proof test. A row counts as
 * certification evidence ONLY when the server created it (trusted flag)
 * with server-side provenance. Client-synced rows always fail this,
 * even when isTrustedValidation would pass on their claimed fields.
 * Mirrors the skill-competency query in issue_credential (migration 017).
 */
export function isServerProvenRow(
    row: { trusted: boolean; provenance: string | undefined },
): boolean {
    return row.trusted === true && row.provenance === 'server_scored';
}

/**
 * scoreTrustedValidation — server-side scoring for the trusted validation
 * flow. Exact match on the answer field against the hidden key; empty or
 * missing answers never pass. Mirrors submit_trusted_validation (016).
 */
export function scoreTrustedValidation(input: {
    answer: unknown;
    expectedAnswer: unknown;
}): boolean {
    if (typeof input.answer !== 'string' || input.answer.length === 0) return false;
    if (typeof input.expectedAnswer !== 'string' || input.expectedAnswer.length === 0) {
        return false;
    }
    return input.answer === input.expectedAnswer;
}

/**
 * buildServerCredentialId — 128-bit entropy public credential id.
 * 'ZNX-' + 32 hex chars (>=128 bits, non-sequential). Mirrors the SQL
 * gen_random_bytes(16) construction in issue_credential (migration 017).
 */
export function buildServerCredentialId(randomHex32: string): string {
    if (!/^[0-9a-f]{32}$/.test(randomHex32)) {
        throw new Error('buildServerCredentialId: need 32 hex chars (128 bits)');
    }
    return `ZNX-${randomHex32.toUpperCase()}`;
}

export interface AuthoritativeComponentSet {
    knowledge: number | null;
    practical: number | null;
    final_assessment: number | null;
    project: number | null;
}

export interface AuthoritativeIssuanceInput {
    programSlug: string;
    programVersion: string;
    issuanceEnabled: boolean;
    enrolledVersion: string | null;
    components: AuthoritativeComponentSet;
    requiredScore: number;
    /** Per-skill server-proven pass rates (trusted server_scored rows only). */
    skillProof: { skillKey: string; minimumScore: number; passes: number; total: number }[];
    weights?: { knowledge: number; practical: number; final_assessment: number; project: number };
}

export interface AuthoritativeIssuanceResult {
    eligible: boolean;
    reasons: string[];
    overall: number | null;
}

/**
 * evaluateAuthoritativeIssuance — official v2 gate math. Mirrors
 * issue_credential (migration 017): kill-switch, pinned enrollment, all
 * four authoritative components present, per-skill server proof with
 * minimums (unmeasured != passed), frozen weighted overall.
 */
export function evaluateAuthoritativeIssuance(
    input: AuthoritativeIssuanceInput,
): AuthoritativeIssuanceResult {
    const reasons: string[] = [];
    if (!input.issuanceEnabled) reasons.push('program_not_issuance_ready');
    if (input.enrolledVersion !== input.programVersion) reasons.push('enrollment_required');
    const missing: (keyof AuthoritativeComponentSet)[] = (
        Object.keys(input.components) as (keyof AuthoritativeComponentSet)[]
    ).filter(k => input.components[k] === null);
    for (const k of missing) reasons.push(`component_missing:${k}`);
    for (const s of input.skillProof) {
        if (s.total === 0) {
            reasons.push(`skill_gate_failed:${s.skillKey}`);
            continue;
        }
        const rate = (s.passes / s.total) * 100;
        if (rate < s.minimumScore) reasons.push(`skill_gate_failed:${s.skillKey}`);
    }
    let overall: number | null = null;
    if (missing.length === 0) {
        const w = input.weights ?? {
            knowledge: 0.25,
            practical: 0.3,
            final_assessment: 0.25,
            project: 0.2,
        };
        const c = input.components;
        overall =
            Math.round(
                (c.knowledge! * w.knowledge +
                    c.practical! * w.practical +
                    c.final_assessment! * w.final_assessment +
                    c.project! * w.project) *
                    10,
            ) / 10;
        if (overall < input.requiredScore) reasons.push('overall_requirement_not_met');
    }
    return { eligible: reasons.length === 0, reasons, overall };
}
