import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LearningRecommendation } from '../domain/sessions/nextBestAction';
import {
    getCredentialProgress,
    getKnowledgeAttempts,
    getKnowledgeComponent,
    getProgramAvailability,
    getSkillVerification,
} from '../services/trustApi';
import type { KnowledgeAttemptRow, SkillVerification } from '../services/trustApi';

/**
 * Slice 2 — canonical credential journey read model.
 *
 * NOT authority: it only composes existing server truth
 * (availability, skill verification, progress, knowledge attempts and
 * component snapshot) into one stable UI model. Every gate below mirrors
 * server policy; the hook performs no grading, no readiness inference
 * beyond the unlocked rule, and never reads local credential stores.
 */

export type KnowledgeState =
    | 'locked'
    | 'ready'
    | 'in_progress'
    | 'passed'
    | 'failed'
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

export type JourneyNextAction =
    | { kind: 'verify_skill'; skillKey: string; skillName: string }
    | { kind: 'start_knowledge' }
    | { kind: 'continue_knowledge' }
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
 * existing canonical recommendation; knowledge actions follow state.
 */
export function deriveNextAction(
    recommendation: LearningRecommendation | null,
    allSkillsVerified: boolean,
    knowledgeState: KnowledgeState,
): JourneyNextAction {
    if (knowledgeState === 'ready' || knowledgeState === 'failed') {
        return { kind: 'start_knowledge' };
    }
    if (knowledgeState === 'in_progress') {
        return { kind: 'continue_knowledge' };
    }
    if (!allSkillsVerified && recommendation?.type === 'prove_skill' && recommendation.skillKey && recommendation.skillName) {
        return { kind: 'verify_skill', skillKey: recommendation.skillKey, skillName: recommendation.skillName };
    }
    return { kind: 'continue_learning' };
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
};

interface JourneyBase {
    available: boolean;
    enrolled: boolean;
    programVersion: string | null;
    skills: JourneySkill[];
    verifiedSkillCount: number;
    totalSkillCount: number;
    knowledge: JourneyKnowledge;
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

    useEffect(() => {
        let cancelled = false;
        if (!programSlug) {
            setBase(null);
            return;
        }
        setBase(null);
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
                const [skills, progress, attempts, component] = await Promise.all([
                    getSkillVerification(programSlug),
                    getCredentialProgress(programSlug, version),
                    getKnowledgeAttempts(programSlug, version),
                    getKnowledgeComponent(programSlug, version),
                ]);
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
                const knowledge = deriveKnowledgeState({
                    component,
                    attempts,
                    allSkillsVerified: allVerified,
                    unavailable: false,
                });
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
            nextAction: deriveNextAction(input?.recommendation ?? null, allVerified, base.knowledge.state),
            visible: base.available,
        };
    }, [base, input?.recommendation, programSlug]);

    return { journey, loading: programSlug != null && journey === null, refresh };
}

export default useCredentialJourney;
