import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LearningRecommendation } from '../domain/sessions/nextBestAction';
import {
    getCredentialProgress,
    getCredentialStageSnapshot,
    getProgramAvailability,
    getSkillVerification,
} from '../services/trustApi';
import type { KnowledgeAttemptRow, PracticalAttemptRow, SkillVerification } from '../services/trustApi';

/**
 * Slice 3 — canonical credential journey read model.
 *
 * NOT authority: it only composes existing server truth
 * (availability, skill verification, progress, and the shared
 * credential-stage live-release snapshot) into one stable UI model. Every
 * gate below mirrors server policy; the hook performs no grading, no
 * readiness inference beyond the unlock rules, and never reads local
 * stores. Knowledge + Practical states are pinned to the SAME current
 * live content release via getCredentialStageSnapshot — retired releases
 * never surface.
 */

export type KnowledgeState =
    | 'locked'
    | 'ready'
    | 'in_progress'
    | 'passed'
    | 'failed'
    | 'temporarily_unavailable';

export type PracticalState = KnowledgeState;

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

export type JourneyNextAction =
    | { kind: 'verify_skill'; skillKey: string; skillName: string }
    | { kind: 'start_knowledge' }
    | { kind: 'continue_knowledge' }
    | { kind: 'start_practical' }
    | { kind: 'continue_practical' }
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
 * existing canonical recommendation; knowledge actions follow state, then
 * practical actions behind a Knowledge PASS. One primary CTA only — never
 * competing Knowledge + Practical buttons. The optional practicalState
 * keeps Slice 2 callers (3 args) behaving exactly as before.
 */
export function deriveNextAction(
    recommendation: LearningRecommendation | null,
    allSkillsVerified: boolean,
    knowledgeState: KnowledgeState,
    practicalState?: PracticalState,
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
                // both stages; when no single live release exists the journey
                // stays visible (skills still shown) with both stages
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
            ),
            visible: base.available,
        };
    }, [base, input?.recommendation, programSlug]);

    return { journey, loading: programSlug != null && journey === null, refresh };
}

export default useCredentialJourney;
