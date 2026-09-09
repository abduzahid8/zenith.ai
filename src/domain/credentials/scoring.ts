/**
 * Certification scoring, readiness, retake policy and verification IDs.
 *
 * Final score composition (§10):
 *   knowledge assessments — 25%
 *   practical tasks       — 30%
 *   final assessment      — 25%
 *   final project         — 20%
 * Missing components renormalize over the present ones so partial progress
 * is still displayable; issuance always requires ALL components present.
 *
 * Distinctions: 80–84 pass, 85–89 merit, 90–94 excellence, 95–100 distinction.
 */

import {
    CertificationProgress,
    CredentialAttempt,
    CredentialGrade,
    CredentialProgram,
    FinalScoreBreakdown,
    LearningEvidence,
    ReadinessBreakdown,
    RecoveryPlan,
    RetakeDecision,
} from './types';
import { computeLearningCompletion } from './skillGraph';

const W_KNOWLEDGE = 0.25;
const W_PRACTICAL = 0.3;
const W_FINAL = 0.25;
const W_PROJECT = 0.2;

export function gradeForScore(score: number, requiredScore: number): CredentialGrade {
    if (score < requiredScore) return 'fail';
    if (score >= 95) return 'distinction';
    if (score >= 90) return 'excellence';
    if (score >= 85) return 'merit';
    return 'pass';
}

export interface FinalScoreInput {
    knowledge: number | null;
    practical: number | null;
    finalAssessment: number | null;
    project: number | null;
}

export function computeFinalScore(
    program: CredentialProgram,
    input: FinalScoreInput,
): FinalScoreBreakdown {
    const parts: Array<{ value: number | null; weight: number }> = [
        { value: input.knowledge, weight: W_KNOWLEDGE },
        { value: input.practical, weight: W_PRACTICAL },
        { value: input.finalAssessment, weight: W_FINAL },
        // Completion-level programs have no project — drop the component.
        { value: program.requiresProject ? input.project : null, weight: program.requiresProject ? W_PROJECT : 0 },
    ];
    const presentWeight = parts.reduce((s, p) => s + (p.value !== null ? p.weight : 0), 0);
    const total =
        presentWeight > 0
            ? parts.reduce((s, p) => s + (p.value ?? 0) * p.weight, 0) / presentWeight
            : 0;
    const rounded = Math.round(total * 10) / 10;
    const allPresent = program.requiresProject
        ? input.knowledge !== null && input.practical !== null && input.finalAssessment !== null && input.project !== null
        : input.knowledge !== null && input.practical !== null && input.finalAssessment !== null;
    const passed = allPresent && rounded >= program.requiredScore;
    return {
        knowledge: input.knowledge ?? 0,
        practical: input.practical ?? 0,
        finalAssessment: input.finalAssessment ?? 0,
        project: input.project ?? 0,
        total: rounded,
        grade: gradeForScore(rounded, program.requiredScore),
        passed,
    };
}

/**
 * Exam readiness (§25): predicts likelihood of passing from evidence
 * accumulated through NORMAL daily learning — no separate study system.
 */
export function computeReadiness(
    program: CredentialProgram,
    evidence: LearningEvidence,
    currentStreakDays: number,
    avgCompletion7d: number | null,
): ReadinessBreakdown {
    const knowledgeAnswers = evidence.assessmentAnswers;
    const knowledge =
        knowledgeAnswers.length > 0
            ? (knowledgeAnswers.filter(a => a.correct).length / knowledgeAnswers.length) * 100
            : 0;

    const practice =
        evidence.totalTasks > 0 ? (evidence.completedTasks / evidence.totalTasks) * 100 : 0;

    const projects = program.requiresProject
        ? evidence.projectScore ?? (evidence.practicalScore !== null ? Math.min(100, evidence.practicalScore + 10) : 0)
        : Math.min(100, practice + 10);

    const streakPart = Math.min(100, (currentStreakDays / 14) * 100);
    const completionPart = avgCompletion7d !== null ? avgCompletion7d * 100 : practice;
    const consistency = streakPart * 0.4 + completionPart * 0.6;

    const readiness = Math.round((knowledge * 0.35 + practice * 0.3 + projects * 0.2 + consistency * 0.15) * 10) / 10;
    const likelyToPass = readiness >= program.readinessThreshold;

    // Weakest area = lowest component, used for AI-style guidance text.
    const components: Array<{ key: string; value: number }> = [
        { key: 'Knowledge', value: knowledge },
        { key: 'Practice', value: practice },
        { key: 'Projects', value: projects },
        { key: 'Consistency', value: consistency },
    ];
    components.sort((a, b) => a.value - b.value);
    const weakestArea = components[0].value < 90 ? components[0].key : null;
    const gap = Math.max(0, program.readinessThreshold - readiness);
    const recommendedSessions = Math.min(10, Math.ceil(gap / 8));

    return {
        knowledge: Math.round(knowledge * 10) / 10,
        practice: Math.round(practice * 10) / 10,
        projects: Math.round(projects * 10) / 10,
        consistency: Math.round(consistency * 10) / 10,
        readiness,
        likelyToPass,
        weakestArea,
        recommendedSessions,
    };
}

/**
 * Retake policy (§16): no infinite exam-spamming.
 * - Attempt 1: always allowed.
 * - Attempt 2: after a 24h cooldown.
 * - Attempt 3+: only after completing targeted remediation sessions
 *   for every failed skill (recovery plan).
 */
export const RETAKE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export function getRetakeDecision(
    attempts: CredentialAttempt[],
    progress: CertificationProgress,
    remediationDone: Record<string, number>,
    nowMs: number = Date.now(),
): RetakeDecision {
    const completed = attempts.filter(a => a.completedAt !== null);
    const nextNumber = completed.length + 1;

    if (nextNumber <= 1) {
        return { allowed: true, availableAfter: null, reason: null, requiredRemediation: [] };
    }

    const last = completed[completed.length - 1];
    const lastTime = last?.completedAt ? new Date(last.completedAt).getTime() : 0;
    const availableAfter = new Date(lastTime + RETAKE_COOLDOWN_MS).toISOString();
    if (nowMs - lastTime < RETAKE_COOLDOWN_MS) {
        return { allowed: false, availableAfter, reason: 'cooldown', requiredRemediation: [] };
    }

    if (nextNumber >= 3) {
        const failed = progress.skillGraph.skills.filter(s => !s.passed);
        const pending = failed
            .map(s => {
                const need = Math.max(1, Math.ceil((s.minimumScore - s.score) / 10));
                const done = remediationDone[s.skillKey] ?? 0;
                return {
                    skillKey: s.skillKey,
                    skillName: s.name,
                    sessions: Math.max(0, need - done),
                };
            })
            .filter(r => r.sessions > 0);
        if (pending.length > 0) {
            return { allowed: false, availableAfter: null, reason: 'remediation_required', requiredRemediation: pending };
        }
    }

    return { allowed: true, availableAfter: null, reason: null, requiredRemediation: [] };
}

/**
 * Certification recovery plan (§16): weak skill → recommended sessions.
 * The app then creates targeted learning sessions from the normal task
 * engine (Assessment → Weakness → Personalized learning → Reassessment).
 */
export function buildRecoveryPlan(
    program: CredentialProgram,
    progress: CertificationProgress,
): RecoveryPlan {
    const weakSkills = progress.skillGraph.weakestSkills
        .filter(s => !s.passed || s.score < program.requiredScore)
        .map(s => ({
            skillKey: s.skillKey,
            skillName: s.name,
            score: s.score,
            recommendedSessions: Math.min(5, Math.max(1, Math.ceil((program.requiredScore - s.score) / 8))),
        }));
    const fallback =
        weakSkills.length === 0
            ? progress.skillGraph.weakestSkills.slice(0, 1).map(s => ({
                  skillKey: s.skillKey,
                  skillName: s.name,
                  score: s.score,
                  recommendedSessions: 2,
              }))
            : weakSkills;
    const taskTypes = Array.from(
        new Set(
            fallback.flatMap(w => program.skills.find(s => s.key === w.skillKey)?.evidenceTaskTypes ?? []),
        ),
    );
    return {
        programSlug: program.slug,
        weakSkills: fallback,
        totalSessions: fallback.reduce((s, w) => s + w.recommendedSessions, 0),
        suggestedTaskTypes: taskTypes.length > 0 ? taskTypes : (['practice', 'analysis'] as RecoveryPlan['suggestedTaskTypes']),
    };
}

/** Assessment → Weakness → Learning loop summary for the AI coach (§6). */
export function describeProgressGap(program: CredentialProgram, evidence: LearningEvidence, progress: CertificationProgress): string {
    const learning = computeLearningCompletion(evidence);
    const lines = [
        `Learning completion: ${learning}%`,
        `Certification progress: ${Math.round(progress.certificationProgress)}% (required ${program.requiredScore}%)`,
    ];
    const failing = progress.skillGraph.skills.filter(s => !s.passed);
    if (failing.length > 0) {
        lines.push(`Areas to improve: ${failing.map(s => `${s.name} — ${Math.round(s.score)}%`).join(', ')}`);
    }
    return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Verification IDs (§11): ZNY-{CODE}-{YY}-{HASH4}
// Pure function (FNV-1a hash) so it works identically on client, tests and
// server/edge functions without native crypto dependencies.
// ---------------------------------------------------------------------------

export const VERIFY_BASE_URL = 'https://zenyth.ai/verify';

export function fnv1aHex(input: string): string {
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).toUpperCase().padStart(8, '0');
}

export function buildCredentialId(programCode: string, userId: string, issuedAt: string): string {
    const year = new Date(issuedAt).getUTCFullYear().toString().slice(-2);
    const hash = fnv1aHex(`${programCode}:${userId}:${issuedAt}`).slice(0, 6);
    return `ZNY-${programCode}-${year}-${hash}`;
}

export function verificationUrlFor(credentialId: string): string {
    return `${VERIFY_BASE_URL}/${credentialId}`;
}

export function parseCredentialId(credentialId: string): { code: string; year: string; hash: string } | null {
    const match = /^ZNY-([A-Z]{2,4})-(\d{2})-([A-F0-9]{6})$/.exec(credentialId.trim().toUpperCase());
    if (!match) return null;
    return { code: match[1], year: match[2], hash: match[3] };
}

export function linkedInSharePayload(cred: {
    programTitle: string;
    credentialId: string;
    issuedAt: string;
    verificationUrl: string;
}): { certificationName: string; organization: string; issueDate: string; credentialId: string; credentialUrl: string } {
    const d = new Date(cred.issuedAt);
    return {
        certificationName: cred.programTitle,
        organization: 'Zenyth AI',
        issueDate: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`,
        credentialId: cred.credentialId,
        credentialUrl: cred.verificationUrl,
    };
}
