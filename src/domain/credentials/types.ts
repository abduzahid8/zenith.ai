/**
 * Zenyth Verified Credentials — domain types.
 *
 * CHAIN (this is the core idea, everything below must stay connected to it):
 *
 *   Daily Tasks (theory → practice → analysis → puzzles, via taskEngine/taskStore)
 *     → Evidence (completed tasks, sessions, focus scores, practice minutes)
 *       → Skill scores (per-competency, weighted skill graph)
 *         → Learning completion vs Certification progress (separate concepts)
 *           → Exam readiness (knowledge / practice / projects / consistency)
 *             → Final assessment + practical project (timed, randomized, retake-gated)
 *               → Final score (knowledge 25 / practical 30 / final 25 / project 20)
 *                 → Issued credential (ZNY-XXX-YY-HASH, versioned, verifiable)
 *                   → Skill Passport + public verify page + LinkedIn/CV share
 *
 * The credential layer NEVER replaces the task/session engine — it reads from it.
 * A user can reach 100% learning completion and still fail certification (§6).
 */

export type CredentialLevel = 'completion' | 'verified-skill' | 'professional';

export type CredentialStatus = 'pending' | 'active' | 'expired' | 'revoked' | 'suspended';

export type EnrollmentStatus =
    | 'learning' // enrolled, working through the path
    | 'ready' // readiness threshold reached, exam unlocked
    | 'in_assessment' // final assessment in progress
    | 'remediation' // failed, doing targeted recovery sessions
    | 'passed' // all requirements met, issuance pending/complete
    | 'failed'; // last attempt failed, cooldown running

export type EvidenceType =
    | 'task_completed'
    | 'session_completed'
    | 'assessment'
    | 'practical_assignment'
    | 'final_project'
    | 'final_assessment';

export type AssessmentKind = 'knowledge' | 'applied' | 'scenario';

export type QuestionKind =
    | 'single_choice'
    | 'multiple_choice'
    | 'true_false'
    | 'matching'
    | 'ordering';

export interface CredentialSkill {
    /** Stable skill key, e.g. 'sql_fundamentals' */
    key: string;
    /** Display name, e.g. 'SQL Fundamentals' */
    name: string;
    description?: string;
    /** Weight in the overall score, 0..1 (must sum to 1 per program) */
    weight: number;
    /** Minimum required score for this skill (critical-competency gate), 0..100 */
    minimumScore: number;
    /** Which engine task types feed this skill as learning evidence */
    evidenceTaskTypes: Array<'theory' | 'practice' | 'analysis' | 'puzzles'>;
    /**
     * Curriculum days (1..28) of the hobby task bank this skill covers,
     * e.g. [1, 7] for week 1. Daily tasks are attributed to skills through
     * the SAME 28-day rotation the task engine uses — so "today's Узнай"
     * visibly grows exactly one skill.
     */
    dayRange: [number, number];
}

export interface CredentialRequirement {
    key: string;
    label: string;
    /** Human-readable rule, e.g. 'Complete ≥90% of curriculum' */
    description: string;
}

export interface CredentialProgram {
    /** Stable slug, e.g. 'data-analytics-foundation' */
    slug: string;
    /** Short code used in credential IDs, e.g. 'DAF' */
    code: string;
    title: string;
    subtitle: string;
    level: CredentialLevel;
    /** Major.minor curriculum version — issued credentials pin this (§23) */
    version: string;
    estimatedHours: number;
    /** Overall pass threshold, 0..100 */
    requiredScore: number;
    /** Minimum readiness % that unlocks the final assessment */
    readinessThreshold: number;
    /** Hobby ids whose daily tasks count as learning evidence (§4) */
    evidenceHobbyIds: string[];
    skills: CredentialSkill[];
    requirements: CredentialRequirement[];
    /** Final assessment config */
    assessment: {
        questionCount: number;
        timeLimitMinutes: number;
        bankSize: number;
    };
    requiresProject: boolean;
    /** Higher levels require identity check before issuance (§15) */
    requiresIdentityVerification: boolean;
}

export interface SkillScore {
    skillKey: string;
    name: string;
    /** 0..100 */
    score: number;
    weight: number;
    minimumScore: number;
    passed: boolean;
    /** How many evidence signals contributed (tasks + assessment answers + project) */
    evidenceCount: number;
}

export interface SkillGraphResult {
    skills: SkillScore[];
    /** Weighted overall, 0..100 */
    overall: number;
    /** Overall ≥ requiredScore */
    overallPassed: boolean;
    /** Every critical competency ≥ its minimum */
    competenciesPassed: boolean;
    passed: boolean;
    weakestSkills: SkillScore[];
}

export interface LearningEvidence {
    /** Completed engine tasks relevant to the program */
    completedTasks: number;
    totalTasks: number;
    /** Completed focus sessions (30-min) relevant to the program */
    sessionsCompleted: number;
    /** Sum of practice minutes from sessions */
    practiceMinutes: number;
    /** Average focus score 0..100, if available */
    avgFocusScore: number | null;
    /** Assessment question results tagged by skill */
    assessmentAnswers: Array<{ skillKey: string; correct: boolean; kind: AssessmentKind }>;
    /** Final assessment score 0..100, if taken */
    finalAssessmentScore: number | null;
    /** Practical-task average 0..100, if any */
    practicalScore: number | null;
    /** Final project score 0..100, if submitted */
    projectScore: number | null;
}

export interface CertificationProgress {
    programSlug: string;
    /** Learning completion: curriculum consumed (tasks/sessions), 0..100 */
    learningCompletion: number;
    /** Certification progress: verified competence (skill graph overall), 0..100 */
    certificationProgress: number;
    skillGraph: SkillGraphResult;
    status: EnrollmentStatus;
}

export interface ReadinessBreakdown {
    /** Assessment average so far */
    knowledge: number;
    /** Practice + analysis task completion */
    practice: number;
    /** Project submitted / practical assignments */
    projects: number;
    /** Streak + 7-day completion consistency */
    consistency: number;
    /** Weighted readiness 0..100 */
    readiness: number;
    likelyToPass: boolean;
    weakestArea: string | null;
    /** Estimated targeted sessions to become ready */
    recommendedSessions: number;
}

export interface FinalScoreBreakdown {
    /** Knowledge assessments — 25% */
    knowledge: number;
    /** Practical tasks — 30% */
    practical: number;
    /** Final assessment — 25% */
    finalAssessment: number;
    /** Final project — 20% */
    project: number;
    /** Weighted total 0..100 */
    total: number;
    grade: CredentialGrade;
    passed: boolean;
}

export type CredentialGrade = 'fail' | 'pass' | 'merit' | 'excellence' | 'distinction';

export interface CredentialAttempt {
    attemptNumber: number;
    startedAt: string;
    completedAt: string | null;
    score: number | null;
    passed: boolean | null;
}

export interface RetakeDecision {
    allowed: boolean;
    /** Earliest ISO timestamp when the next attempt may start */
    availableAfter: string | null;
    /** Why blocked, if not allowed */
    reason: 'cooldown' | 'remediation_required' | null;
    /** Targeted sessions required before retry (skillKey → sessions) */
    requiredRemediation: Array<{ skillKey: string; skillName: string; sessions: number }>;
}

export interface IssuedCredential {
    /** e.g. ZNY-DAF-26-A81F42 */
    credentialId: string;
    programSlug: string;
    programTitle: string;
    programVersion: string;
    level: CredentialLevel;
    holderName: string;
    userId: string;
    finalScore: number;
    grade: CredentialGrade;
    skills: Array<{ key: string; name: string; score: number }>;
    issuedAt: string;
    expiresAt: string | null;
    status: CredentialStatus;
    verificationUrl: string;
    evidence: {
        learningHours: number;
        tasksCompleted: number;
        assessmentsTaken: number;
        practicalAssignments: number;
        projectsCompleted: number;
    };
}

export interface RecoveryPlan {
    programSlug: string;
    weakSkills: Array<{
        skillKey: string;
        skillName: string;
        score: number;
        recommendedSessions: number;
    }>;
    totalSessions: number;
    /** Suggested engine task types per weak skill for targeted practice */
    suggestedTaskTypes: Array<'theory' | 'practice' | 'analysis' | 'puzzles'>;
}
