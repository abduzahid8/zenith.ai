import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LearningRecommendation } from '../domain/sessions/nextBestAction';
import {
    getCredentialProgress,
    getCredentialStageSnapshot,
    getCredentialStatus,
    getProgramAvailability,
    getProjectJourneySnapshot,
    getSkillVerification,
} from '../services/trustApi';
import type {
    CredentialClaimStatus,
    FinalAttemptRow,
    KnowledgeAttemptRow,
    PracticalAttemptRow,
    SkillVerification,
} from '../services/trustApi';

/**
 * Slice 5 — canonical credential journey read model.
 *
 * NOT authority: it only composes existing server truth
 * (availability, skill verification, progress, the shared
 * credential-stage live-release snapshot, and the isolated project
 * snapshot) into one stable UI model. Every gate below mirrors server
 * policy; the hook performs no grading, no readiness inference beyond
 * the unlock rules, and never reads local stores. Knowledge + Practical
 * + Final states are pinned to the SAME current live content release via
 * getCredentialStageSnapshot — retired releases never surface. A Project
 * read failure isolates to the Project stage; frozen stages stay visible.
 */

export type KnowledgeState =
    | 'locked'
    | 'ready'
    | 'in_progress'
    | 'passed'
    | 'failed'
    | 'temporarily_unavailable';

export type PracticalState = KnowledgeState;

export type FinalAssessmentState = KnowledgeState;

export type ProjectState =
    | 'locked'
    | 'ready'
    | 'under_review'
    | 'needs_revision'
    | 'passed'
    | 'temporarily_unavailable';

export interface JourneySkill {
    key: string;
    name: string;
    verified: boolean;
    samplesCompleted: number;
    samplesRequired: number;
    score: number | null;
}

export interface JourneyKnowledge {
    state: KnowledgeState;
    score: number | null;
    attemptId: string | null;
}

export interface JourneyPractical {
    state: PracticalState;
    score: number | null;
    attemptId: string | null;
}

export interface JourneyFinalAssessment {
    state: FinalAssessmentState;
    score: number | null;
    attemptId: string | null;
    attemptNumber: number | null;
    deadline: string | null;
}

export interface JourneyProject {
    state: ProjectState;
    submissionId: string | null;
    score: number | null;
    submittedAt: string | null;
    reviewedAt: string | null;
}

/**
 * Slice 6 — server-authoritative credential claim state. Every field
 * originates from get_credential_status (migration 038); the client
 * never calculates readiness, score, grade, or credential identity.
 * Null when the status read itself failed — the UI must show nothing
 * claim-related rather than infer from missing data.
 */
export type JourneyCredential = CredentialClaimStatus;

export type JourneyNextAction =
    | { kind: 'verify_skill'; skillKey: string; skillName: string }
    | { kind: 'start_knowledge' }
    | { kind: 'continue_knowledge' }
    | { kind: 'start_practical' }
    | { kind: 'continue_practical' }
    | { kind: 'start_final' }
    | { kind: 'continue_final' }
    | { kind: 'submit_project' }
    | { kind: 'revise_project' }
    | { kind: 'continue_learning' };

export interface CredentialJourney {
    /** False when the program is not issuable: UI hides the whole block. */
    available: boolean;
    enrolled: boolean;
    programTitle: string | null;
    /** Current server program version — the identity all official reads pin to. */
    programVersion: string | null;
    skills: JourneySkill[];
    verifiedSkillCount: number;
    totalSkillCount: number;
    knowledge: JourneyKnowledge;
    practical: JourneyPractical;
    finalAssessment: JourneyFinalAssessment;
    project: JourneyProject;
    /** Server claim state (Slice 6). Null while unknown — never inferred. */
    credential: JourneyCredential | null;
    nextAction: JourneyNextAction;
    /** True when the block carries anything worth showing. */
    visible: boolean;
}

export interface KnowledgeInputs {
    component: { score: number; passed: boolean } | null;
    attempts: KnowledgeAttemptRow[];
    allSkillsVerified: boolean;
    unavailable: boolean;
}

export interface PracticalInputs {
    component: { score: number; passed: boolean } | null;
    attempts: PracticalAttemptRow[];
    /** Practical unlocks only behind a CURRENT live Knowledge PASS. */
    knowledgePassed: boolean;
    allSkillsVerified: boolean;
    unavailable: boolean;
}

export interface FinalAssessmentInputs {
    component: { score: number; passed: boolean } | null;
    attempts: FinalAttemptRow[];
    /** Final unlocks only behind CURRENT live Knowledge + Practical PASSes. */
    knowledgePassed: boolean;
    practicalPassed: boolean;
    allSkillsVerified: boolean;
    unavailable: boolean;
}

export interface ProjectInputs {
    submission: { id: string; createdAt: string | null } | null;
    review: { submissionId: string; score: number | null; passed: boolean; reviewedAt: string | null } | null;
    /** Project unlocks only behind a CURRENT Final Assessment PASS. */
    finalPassed: boolean;
    unavailable: boolean;
}

/**
 * Pure knowledge-state derivation from server facts. Unlock rule: READY
 * only when every skill is server-verified and no passed component
 * exists. Learning progress is never an input. Only live `started` /
 * `submitted` rows participate — superseded or unknown statuses are
 * ignored and can never render as in-progress.
 */
export function deriveKnowledgeState(input: KnowledgeInputs): JourneyKnowledge {
    if (input.unavailable) {
        return { state: 'temporarily_unavailable', score: null, attemptId: null };
    }
    if (input.component && input.component.passed) {
        return { state: 'passed', score: input.component.score, attemptId: null };
    }
    const live = input.attempts.filter(a => a.status === 'started' || a.status === 'submitted');
    const active = live.find(a => a.status === 'started') ?? null;
    if (active) {
        return { state: 'in_progress', score: null, attemptId: active.id };
    }
    const submitted = live.filter(a => a.status === 'submitted');
    if (submitted.length > 0) {
        const latest = submitted
            .slice()
            .sort((a, b) => String(b.submittedAt ?? '').localeCompare(String(a.submittedAt ?? '')))[0];
        if (latest.passed === true) {
            // Defensive: a passed attempt without a component row yet.
            // Still not authoritative-proof; surface as ready to retry.
            return { state: 'ready', score: latest.score, attemptId: null };
        }
        return { state: 'failed', score: latest.score, attemptId: null };
    }
    if (input.allSkillsVerified) {
        return { state: 'ready', score: null, attemptId: null };
    }
    return { state: 'locked', score: null, attemptId: null };
}

/**
 * Pure next-action mapping. Verification/learning actions reuse the
 * existing canonical recommendation; stage actions follow state in
 * upstream order (knowledge, practical behind Knowledge PASS, final
 * behind Practical PASS, project behind Final PASS), so a stale upstream
 * after rotation always wins over a submitted Project. One primary CTA
 * only. The optional trailing states keep older callers behaving exactly
 * as before.
 */
export function deriveNextAction(
    recommendation: LearningRecommendation | null,
    allSkillsVerified: boolean,
    knowledgeState: KnowledgeState,
    practicalState?: PracticalState,
    finalState?: FinalAssessmentState,
    projectState?: ProjectState,
): JourneyNextAction {
    if (knowledgeState === 'ready' || knowledgeState === 'failed') {
        return { kind: 'start_knowledge' };
    }
    if (knowledgeState === 'in_progress') {
        return { kind: 'continue_knowledge' };
    }
    if (knowledgeState === 'passed' && practicalState != null) {
        if (practicalState === 'ready' || practicalState === 'failed') {
            return { kind: 'start_practical' };
        }
        if (practicalState === 'in_progress') {
            return { kind: 'continue_practical' };
        }
        if (practicalState === 'passed' && finalState != null) {
            if (finalState === 'ready' || finalState === 'failed') {
                return { kind: 'start_final' };
            }
            if (finalState === 'in_progress') {
                return { kind: 'continue_final' };
            }
            if (finalState === 'passed' && projectState != null) {
                if (projectState === 'ready') {
                    return { kind: 'submit_project' };
                }
                if (projectState === 'needs_revision') {
                    return { kind: 'revise_project' };
                }
            }
        }
    }
    if (!allSkillsVerified && recommendation?.type === 'prove_skill' && recommendation.skillKey && recommendation.skillName) {
        return { kind: 'verify_skill', skillKey: recommendation.skillKey, skillName: recommendation.skillName };
    }
    return { kind: 'continue_learning' };
}

/**
 * Pure practical-state derivation from server facts. Unlock rule: READY
 * only when every skill stays server-verified AND the CURRENT live
 * Knowledge component is passed AND no passed practical component exists.
 * Learning progress is never an input. Only live `started` / `submitted`
 * rows participate — superseded or unknown statuses are ignored.
 */
export function derivePracticalState(input: PracticalInputs): JourneyPractical {
    if (input.unavailable) {
        return { state: 'temporarily_unavailable', score: null, attemptId: null };
    }
    if (!input.allSkillsVerified || !input.knowledgePassed) {
        return { state: 'locked', score: null, attemptId: null };
    }
    if (input.component && input.component.passed) {
        return { state: 'passed', score: input.component.score, attemptId: null };
    }
    const live = input.attempts.filter(a => a.status === 'started' || a.status === 'submitted');
    const active = live.find(a => a.status === 'started') ?? null;
    if (active) {
        return { state: 'in_progress', score: null, attemptId: active.id };
    }
    const submitted = live.filter(a => a.status === 'submitted');
    if (submitted.length > 0) {
        const latest = submitted
            .slice()
            .sort((a, b) => String(b.submittedAt ?? '').localeCompare(String(a.submittedAt ?? '')))[0];
        if (latest.passed === true) {
            // Defensive: a passed attempt without a component row yet.
            return { state: 'ready', score: latest.score, attemptId: null };
        }
        return { state: 'failed', score: latest.score, attemptId: null };
    }
    return { state: 'ready', score: null, attemptId: null };
}

/**
 * Pure final-state derivation from server facts. Unlock rule: READY only
 * when every skill stays server-verified AND the CURRENT live Knowledge
 * AND Practical components are passed AND no passed Final component
 * exists. Cooldown/remediation are server start-gate responses, never
 * client state. A started attempt is always server-owned — even when its
 * deadline looks past on the client, the server finalizes expiration.
 * Only live-bank `started` / `submitted` rows participate.
 */
export function deriveFinalAssessmentState(input: FinalAssessmentInputs): JourneyFinalAssessment {
    const idle = { attemptId: null, attemptNumber: null, deadline: null };
    if (input.unavailable) {
        return { state: 'temporarily_unavailable', score: null, ...idle };
    }
    if (!input.allSkillsVerified || !input.knowledgePassed || !input.practicalPassed) {
        return { state: 'locked', score: null, ...idle };
    }
    if (input.component && input.component.passed) {
        return { state: 'passed', score: input.component.score, ...idle };
    }
    const live = input.attempts.filter(a => a.status === 'started' || a.status === 'submitted');
    const active = live.find(a => a.status === 'started') ?? null;
    if (active) {
        return {
            state: 'in_progress',
            score: null,
            attemptId: active.id,
            attemptNumber: active.attemptNumber,
            deadline: active.deadline,
        };
    }
    const submitted = live.filter(a => a.status === 'submitted');
    if (submitted.length > 0) {
        const latest = submitted
            .slice()
            .sort((a, b) => String(b.submittedAt ?? '').localeCompare(String(a.submittedAt ?? '')))[0];
        if (latest.passed === true) {
            // Defensive: a passed attempt without a component row yet.
            return { state: 'ready', score: latest.score, ...idle };
        }
        return { state: 'failed', score: latest.score, ...idle };
    }
    return { state: 'ready', score: null, ...idle };
}

/**
 * Pure project-state derivation from server facts. A result counts only
 * when stamped for the LATEST submission id — older results never carry
 * forward, so a newer pending revision stays under review and never
 * inherits pass/fail. An already-submitted Project keeps its display
 * even if upstream stages go stale later (rotation never hides it); the
 * next-action mapping separately prioritizes the upstream step.
 */
export function deriveProjectState(input: ProjectInputs): JourneyProject {
    if (input.unavailable) {
        return { state: 'temporarily_unavailable', submissionId: null, score: null, submittedAt: null, reviewedAt: null };
    }
    if (!input.submission) {
        if (input.finalPassed) {
            return { state: 'ready', submissionId: null, score: null, submittedAt: null, reviewedAt: null };
        }
        return { state: 'locked', submissionId: null, score: null, submittedAt: null, reviewedAt: null };
    }
    const base = {
        submissionId: input.submission.id,
        submittedAt: input.submission.createdAt,
    };
    if (input.review && input.review.submissionId === input.submission.id) {
        if (input.review.passed) {
            return { state: 'passed', score: input.review.score, reviewedAt: input.review.reviewedAt, ...base };
        }
        return { state: 'needs_revision', score: input.review.score, reviewedAt: input.review.reviewedAt, ...base };
    }
    return { state: 'under_review', score: null, reviewedAt: null, ...base };
}

export interface JourneyInput {
    recommendation?: LearningRecommendation | null;
    /**
     * Parent-owned refresh signal (e.g. bumped after a trusted
     * verification completes). Changing it re-reads server truth.
     * No global event bus — one nonce passed down the tree.
     */
    refreshToken?: number;
}

export interface JourneyResult {
    journey: CredentialJourney | null;
    loading: boolean;
    refresh: () => void;
}

const HIDDEN_BASE: JourneyBase = {
    available: false,
    enrolled: false,
    programVersion: null,
    skills: [],
    verifiedSkillCount: 0,
    totalSkillCount: 0,
    knowledge: { state: 'locked', score: null, attemptId: null },
    practical: { state: 'locked', score: null, attemptId: null },
    finalAssessment: { state: 'locked', score: null, attemptId: null, attemptNumber: null, deadline: null },
    project: { state: 'locked', submissionId: null, score: null, submittedAt: null, reviewedAt: null },
    credential: null,
};

interface JourneyBase {
    available: boolean;
    enrolled: boolean;
    programVersion: string | null;
    skills: JourneySkill[];
    verifiedSkillCount: number;
    totalSkillCount: number;
    knowledge: JourneyKnowledge;
    practical: JourneyPractical;
    finalAssessment: JourneyFinalAssessment;
    project: JourneyProject;
    credential: JourneyCredential | null;
}

export function useCredentialJourney(
    programSlug: string | null,
    input?: JourneyInput,
): JourneyResult {
    const [base, setBase] = useState<JourneyBase | null>(null);
    const [nonce, setNonce] = useState(0);
    const mounted = useRef(true);
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    const refresh = useCallback(() => setNonce(n => n + 1), []);
    const prevSlug = useRef<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        if (!programSlug) {
            prevSlug.current = null;
            setBase(null);
            return;
        }
        // Keep the last good base visible across refreshes so an open
        // runner sheet never unmounts mid-submit; null only when the
        // program identity itself changes (or first load).
        if (prevSlug.current !== programSlug) {
            prevSlug.current = programSlug;
            setBase(null);
        }
        (async () => {
            try {
                const programs = await getProgramAvailability();
                if (cancelled) return;
                const entry = programs.find(p => p.slug === programSlug);
                // Fail closed: without an issuable entry AND a concrete
                // current version there is no identity to pin reads to.
                if (!entry || !entry.issuable || entry.programVersion == null) {
                    if (mounted.current) setBase(HIDDEN_BASE);
                    return;
                }
                const version = entry.programVersion;
                const [skills, progress, snapshot] = await Promise.all([
                    getSkillVerification(programSlug),
                    getCredentialProgress(programSlug, version),
                    getCredentialStageSnapshot(programSlug, version),
                ]);
                if (cancelled) return;
                // Isolated project read: its failure must never hide the
                // frozen upstream stages.
                let projectSubmission: { id: string; createdAt: string | null } | null = null;
                let projectReview: {
                    submissionId: string; score: number | null; passed: boolean; reviewedAt: string | null;
                } | null = null;
                let projectFailed = false;
                try {
                    const projectSnap = await getProjectJourneySnapshot(programSlug, version);
                    projectSubmission = projectSnap.submission;
                    projectReview = projectSnap.review;
                } catch {
                    projectFailed = true;
                }
                if (cancelled) return;
                const mapped: JourneySkill[] = skills.map((s: SkillVerification) => ({
                    key: s.skillKey,
                    name: s.skillName,
                    verified: s.verified,
                    samplesCompleted: s.samplesCompleted,
                    samplesRequired: s.samplesRequired,
                    score: s.score ?? null,
                }));
                const verifiedSkillCount = mapped.filter(s => s.verified).length;
                const allVerified = mapped.length > 0 && verifiedSkillCount === mapped.length;
                // The shared snapshot carries ONE live-release authority for
                // all stages; when no single live release exists the journey
                // stays visible (skills still shown) with every stage
                // fail-closed.
                const knowledge = deriveKnowledgeState({
                    component: snapshot.knowledge.component,
                    attempts: snapshot.knowledge.attempts,
                    allSkillsVerified: allVerified,
                    unavailable: !snapshot.contentAvailable,
                });
                const practical = derivePracticalState({
                    component: snapshot.practical.component,
                    attempts: snapshot.practical.attempts,
                    knowledgePassed: knowledge.state === 'passed',
                    allSkillsVerified: allVerified,
                    unavailable: !snapshot.contentAvailable,
                });
                const finalAssessment = deriveFinalAssessmentState({
                    component: snapshot.finalAssessment.component,
                    attempts: snapshot.finalAssessment.attempts,
                    knowledgePassed: knowledge.state === 'passed',
                    practicalPassed: practical.state === 'passed',
                    allSkillsVerified: allVerified,
                    unavailable: !snapshot.contentAvailable,
                });
                const project = deriveProjectState({
                    submission: projectSubmission,
                    review: projectReview,
                    finalPassed: finalAssessment.state === 'passed',
                    unavailable: !snapshot.contentAvailable || projectFailed,
                });
                // Slice 6 claim state: isolated like the project read. A
                // status failure hides claim UI only (credential null) —
                // the frozen upstream stages stay visible.
                let credential: JourneyCredential | null = null;
                try {
                    credential = await getCredentialStatus(programSlug);
                } catch {
                    credential = null;
                }
                if (cancelled) return;
                if (mounted.current) {
                    setBase({
                        available: true,
                        // Version-pinned: an old-version progress row is NOT
                        // enrollment in the current journey.
                        enrolled: progress !== null,
                        programVersion: version,
                        skills: mapped,
                        verifiedSkillCount,
                        totalSkillCount: mapped.length,
                        knowledge,
                        practical,
                        finalAssessment,
                        project,
                        credential,
                    });
                }
            } catch {
                // Fail-closed on read errors: hide rather than invent.
                if (mounted.current && !cancelled) setBase(HIDDEN_BASE);
            }
        })();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [programSlug, nonce, input?.refreshToken]);

    // nextAction derives at render from fetched base + live canonical
    // recommendation: no refetch when the recommendation object changes.
    const journey = useMemo<CredentialJourney | null>(() => {
        if (!programSlug || !base) return null;
        const allVerified = base.totalSkillCount > 0 && base.verifiedSkillCount === base.totalSkillCount;
        return {
            ...base,
            programTitle: null,
            nextAction: deriveNextAction(
                input?.recommendation ?? null,
                allVerified,
                base.knowledge.state,
                base.practical.state,
                base.finalAssessment.state,
                base.project.state,
            ),
            visible: base.available,
        };
    }, [base, input?.recommendation, programSlug]);

    return { journey, loading: programSlug != null && journey === null, refresh };
}

export default useCredentialJourney;
