/**
 * ZENYTH SERVER TRUST LAYER — canonical server-side policies.
 *
 * Frozen-runtime contract: the client learning runtime (SessionBlueprint,
 * learningCards, SwipeLearningSession, recommendation rules, Skill State
 * scoring, learning event semantics) is FROZEN. This module does NOT
 * re-derive any of those rules — it re-exports and reuses them.
 *
 * Authority model:
 * - A client LearningEvent DESCRIBES what happened; it is never proof-grade
 *   by itself. Server rows distinguish observational/formative evidence
 *   (trusted=false) from server-trusted/summative evidence (trusted=true).
 * - Client-supplied evidenceStrength / outcomeValue / provenance /
 *   assessment scores / project scores / credential eligibility are treated
 *   as OBSERVATIONS. Authoritative projections are derived here (and mirrored
 *   in SQL migrations 011–013, where server authority wins).
 * - Only server-approved validation provenance can become proof-grade:
 *   'static_bank' / 'generated_validated' rows present in the server
 *   trusted_validation_registry, or 'server_scored' rows created by server
 *   functions. 'generated_unverified' can NEVER become trusted merely
 *   because the client reports a pass.
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
