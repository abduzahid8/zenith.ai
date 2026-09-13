import { useMemo } from 'react';
import { CREDENTIAL_PROGRAMS, getProgram } from '../domain/credentials/catalog';
import type { CredentialProgram } from '../domain/credentials/types';
import { canonicalAnchorForEnrollment } from '../domain/credentials/anchor';
import { useCredentialEngine } from './useCredentialEngine';
import { useCredentialStore } from '../store/credentialStore';
import type {
    CertificationProgress,
    LearningEvidence,
    SkillScore,
} from '../domain/credentials/types';
import type { EngineTaskInput, SessionInput } from '../services/credentialService';

/**
 * A — one canonical certificate-progress selector.
 *
 * SCOPE: LOCAL LEARNING/evidence projection ONLY. This hook computes what
 * the user has already learned (engine tasks/sessions + local per-program
 * cache) — it is NOT enrollment authority. Its `enrolled`/`eligible`
 * fields mirror the local credentialStore cache and must NEVER gate
 * enrolled/locked/ready/issued UI claims. Authoritative enrollment comes
 * from the server-backed read (useServerEnrollment / useCredentialJourney:
 * user_credential_progress row for slug + current server version).
 *
 * Dependency direction:
 *   raw stores / Supabase
 *     -> useCredentialEngine (full 28-day history + sessions)
 *     -> existing credential domain (getEvidence / getProgress / skillGraph)
 *     -> useCertificateProgress(slug)
 *     -> local progress display ONLY (bars/scores), never CTA gating
 *
 * Displayed % is ALWAYS progress.certificationProgress (skillGraph.overall),
 * never learningCompletion. Scoring, weights, gates and completion rules
 * are untouched — this hook only unifies WHICH dataset every surface reads.
 */
export interface CertificateProgressResult {
    programSlug: string | null;
    program: CredentialProgram | undefined;
    enrolled: boolean;
    /** Enrolled + known program: this surface may show the bar. */
    eligible: boolean;
    /** Canonical enrollment anchor (YYYY-MM-DD) or null when unenrolled. */
    anchor: string | null;
    /** Canonical engine inputs — same arrays for progress + readiness. */
    tasks: EngineTaskInput[];
    sessions: SessionInput[];
    streakDays: number;
    userId: string | null;
    currentDay: Record<string, number>;
    unitProgress: Record<string, boolean>;
    evidence: LearningEvidence | null;
    progress: CertificationProgress | null;
    /** Displayed % = certificationProgress (overall). */
    overall: number;
    skills: SkillScore[];
    /** Learning completion (informational only — never the displayed cert %). */
    learning: number;
    assessment: number | null;
    project: number | null;
    loading: boolean;
    error: null;
}

type StoreSelectors = {
    programs: Record<string, { enrolled: boolean; enrolledAt: string | null }>;
    getEvidence: (slug: string, tasks: EngineTaskInput[], sessions: SessionInput[]) => LearningEvidence | null;
    getProgress: (slug: string, tasks: EngineTaskInput[], sessions: SessionInput[]) => CertificationProgress | null;
};

function buildResult(
    slug: string | null | undefined,
    engine: {
        tasks: EngineTaskInput[];
        sessions: SessionInput[];
        streakDays: number;
        userId: string | null;
        currentDay: Record<string, number>;
        unitProgress: Record<string, boolean>;
    },
    store: StoreSelectors,
): CertificateProgressResult {
    const programSlug = slug ?? null;
    const program = programSlug ? getProgram(programSlug) : undefined;
    const state = programSlug ? store.programs[programSlug] : undefined;
    const enrolled = !!state?.enrolled;
    const anchor = canonicalAnchorForEnrollment(enrolled, state?.enrolledAt);
    const base = {
        programSlug,
        program,
        enrolled,
        eligible: enrolled && !!program,
        anchor,
        tasks: engine.tasks,
        sessions: engine.sessions,
        streakDays: engine.streakDays,
        userId: engine.userId,
        currentDay: engine.currentDay,
        unitProgress: engine.unitProgress,
        loading: false as const,
        error: null as null,
    };
    if (!program || !enrolled || !programSlug) {
        return {
            ...base,
            evidence: null,
            progress: null,
            overall: 0,
            skills: [],
            learning: 0,
            assessment: null,
            project: null,
        };
    }
    const evidence = store.getEvidence(programSlug, engine.tasks, engine.sessions);
    const progress = store.getProgress(programSlug, engine.tasks, engine.sessions);
    return {
        ...base,
        evidence,
        progress,
        overall: progress ? progress.certificationProgress : 0,
        skills: progress ? progress.skillGraph.skills : [],
        learning: progress ? progress.learningCompletion : 0,
        assessment: evidence?.finalAssessmentScore ?? null,
        project: evidence?.projectScore ?? null,
    };
}

export function useCertificateProgress(slug: string | null | undefined): CertificateProgressResult {
    const engine = useCredentialEngine();
    const programs = useCredentialStore(s => s.programs);
    const getEvidence = useCredentialStore(s => s.getEvidence);
    const getProgress = useCredentialStore(s => s.getProgress);
    return useMemo(
        () => buildResult(slug, engine, { programs, getEvidence, getProgress } as StoreSelectors),
        // engine object identity changes only when its fields change; list fields explicitly
        // to avoid memo churn from the engine object wrapper.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [slug, engine.tasks, engine.sessions, engine.streakDays, engine.userId, engine.currentDay, engine.unitProgress, programs, getEvidence, getProgress],
    );
}

/** Hub view: same canonical engine read once, mapped over every program. */
export function useAllCertificateProgress(): Record<string, CertificateProgressResult> {
    const engine = useCredentialEngine();
    const programs = useCredentialStore(s => s.programs);
    const getEvidence = useCredentialStore(s => s.getEvidence);
    const getProgress = useCredentialStore(s => s.getProgress);
    return useMemo(() => {
        const out: Record<string, CertificateProgressResult> = {};
        for (const p of CREDENTIAL_PROGRAMS) {
            out[p.slug] = buildResult(p.slug, engine, { programs, getEvidence, getProgress } as StoreSelectors);
        }
        return out;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [engine.tasks, engine.sessions, engine.streakDays, engine.userId, engine.currentDay, engine.unitProgress, programs, getEvidence, getProgress]);
}

export default useCertificateProgress;
