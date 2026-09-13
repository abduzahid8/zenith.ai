/**
 * Credential store (Zustand + persist, same pattern as taskStore).
 *
 * Holds per-program enrollment state and recomputes progress/readiness from
 * the EXISTING engine data (tasks + sessions) via credentialService — the
 * chain stays live: every completed daily task moves certification progress.
 *
 * AUTHORITY RULE (pre-Slice-6 hardening): this store NEVER issues or
 * verifies credentials. Authoritative issuance is the server RPC
 * `issue_credential` (see services/trustApi.issueCredential); status reads
 * are `get_credential_status`; public verification is
 * `verifyCredentialPublic`. No function here may manufacture an object
 * that looks like a server-issued credential.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    CertificationProgress,
    CredentialAttempt,
    LearningEvidence,
    ReadinessBreakdown,
    RecoveryPlan,
    RetakeDecision,
} from '../domain/credentials/types';
import { CREDENTIAL_PROGRAMS, getProgram } from '../domain/credentials/catalog';
import {
    buildRecoveryPlan,
    computeReadiness,
    getRetakeDecision,
} from '../domain/credentials/scoring';
import {
    buildEvidence,
    buildProgress,
    EngineTaskInput,
    SessionInput,
    StoredAnswerInput,
    toTaskItems,
    ArtifactEvidenceInput,
} from '../services/credentialService';
import { useGamificationStore } from './gamificationStore';
import { parseVerdict } from '../domain/sessions/sessionBlueprint';
import { canonicalAnchorForEnrollment } from '../domain/credentials/anchor';

export interface ProgramState {
    enrolled: boolean;
    enrolledAt: string | null;
    storedAnswers: StoredAnswerInput[];
    finalAssessmentScore: number | null;
    practicalScore: number | null;
    projectScore: number | null;
    projectSkillScores: Record<string, number> | null;
    attempts: CredentialAttempt[];
    remediationDone: Record<string, number>;
}

const initialProgramState = (): ProgramState => ({
    enrolled: false,
    enrolledAt: null,
    storedAnswers: [],
    finalAssessmentScore: null,
    practicalScore: null,
    projectScore: null,
    projectSkillScores: null,
    attempts: [],
    remediationDone: {},
});

interface CredentialState {
    programs: Record<string, ProgramState>;

    enroll: (programSlug: string) => void;
    unenroll: (programSlug: string) => void;
    recordAssessmentAnswers: (programSlug: string, answers: StoredAnswerInput[]) => void;
    recordRemediation: (programSlug: string, skillKey: string, sessions?: number) => void;
    startAttempt: (programSlug: string) => void;
    completeAttempt: (programSlug: string, score: number) => void;
    submitProject: (programSlug: string, score: number, skillScores: Record<string, number>) => void;
    resetProgram: (programSlug: string) => void;

    // Derived (computed from engine data on demand — not persisted)
    getEvidence: (
        programSlug: string,
        tasks: EngineTaskInput[],
        sessions: SessionInput[],
    ) => LearningEvidence | null;
    getProgress: (
        programSlug: string,
        tasks: EngineTaskInput[],
        sessions: SessionInput[],
    ) => CertificationProgress | null;
    getReadiness: (
        programSlug: string,
        tasks: EngineTaskInput[],
        sessions: SessionInput[],
        streakDays: number,
        avgCompletion7d: number | null,
    ) => ReadinessBreakdown | null;
    getRetake: (programSlug: string, tasks: EngineTaskInput[], sessions: SessionInput[]) => RetakeDecision | null;
    getRecoveryPlan: (programSlug: string, tasks: EngineTaskInput[], sessions: SessionInput[]) => RecoveryPlan | null;
    enrolledPrograms: () => string[];
}

function programState(state: CredentialState, slug: string): ProgramState {
    return state.programs[slug] ?? initialProgramState();
}

/** Canonical enrollment anchor — single rule, no today/task-date fallbacks. */
export function anchorForProgram(prev: ProgramState): string | null {
    return canonicalAnchorForEnrollment(prev.enrolled, prev.enrolledAt);
}

/**
 * The app's OWN training output as credential evidence: session artifacts
 * (do/deepen answers with AI verdicts) for the program's hobbies.
 */
function collectArtifacts(hobbyIds: string[]): ArtifactEvidenceInput[] {
    try {
        const artifacts = useGamificationStore.getState().artifacts ?? [];
        return artifacts
            .filter(a => hobbyIds.includes(a.hobbyId))
            .map(a => ({
                hobbyId: a.hobbyId,
                lessonId: a.lessonId,
                taskType: a.taskType,
                verdict: parseVerdict(a.aiFeedback),
            }));
    } catch {
        return [];
    }
}

export const useCredentialStore = create<CredentialState>()(
    persist(
        (set, get) => ({
            programs: {},

            enroll: (programSlug: string) =>
                set(state => {
                    const prev = programState(state, programSlug);
                    if (prev.enrolled) return state;
                    return {
                        programs: {
                            ...state.programs,
                            [programSlug]: { ...prev, enrolled: true, enrolledAt: new Date().toISOString() },
                        },
                    };
                }),

            unenroll: (programSlug: string) =>
                set(state => {
                    const prev = programState(state, programSlug);
                    return {
                        programs: {
                            ...state.programs,
                            [programSlug]: { ...prev, enrolled: false },
                        },
                    };
                }),

            recordAssessmentAnswers: (programSlug: string, answers: StoredAnswerInput[]) =>
                set(state => {
                    const prev = programState(state, programSlug);
                    return {
                        programs: {
                            ...state.programs,
                            [programSlug]: { ...prev, storedAnswers: [...prev.storedAnswers, ...answers] },
                        },
                    };
                }),

            recordRemediation: (programSlug: string, skillKey: string, sessions: number = 1) =>
                set(state => {
                    const prev = programState(state, programSlug);
                    return {
                        programs: {
                            ...state.programs,
                            [programSlug]: {
                                ...prev,
                                remediationDone: {
                                    ...prev.remediationDone,
                                    [skillKey]: (prev.remediationDone[skillKey] ?? 0) + sessions,
                                },
                            },
                        },
                    };
                }),

            startAttempt: (programSlug: string) =>
                set(state => {
                    const prev = programState(state, programSlug);
                    const open = prev.attempts.some(a => a.completedAt === null);
                    if (open) return state;
                    const attempt: CredentialAttempt = {
                        attemptNumber: prev.attempts.length + 1,
                        startedAt: new Date().toISOString(),
                        completedAt: null,
                        score: null,
                        passed: null,
                    };
                    return {
                        programs: {
                            ...state.programs,
                            [programSlug]: { ...prev, attempts: [...prev.attempts, attempt] },
                        },
                    };
                }),

            completeAttempt: (programSlug: string, score: number) =>
                set(state => {
                    const prev = programState(state, programSlug);
                    const program = getProgram(programSlug);
                    const attempts = [...prev.attempts];
                    const openIdx = attempts.findIndex(a => a.completedAt === null);
                    const passed = program ? score >= program.requiredScore : false;
                    const finished: CredentialAttempt = {
                        attemptNumber: (openIdx >= 0 ? attempts[openIdx].attemptNumber : attempts.length + 1),
                        startedAt: openIdx >= 0 ? attempts[openIdx].startedAt : new Date().toISOString(),
                        completedAt: new Date().toISOString(),
                        score,
                        passed,
                    };
                    if (openIdx >= 0) attempts[openIdx] = finished;
                    else attempts.push(finished);
                    return {
                        programs: {
                            ...state.programs,
                            [programSlug]: { ...prev, attempts, finalAssessmentScore: score },
                        },
                    };
                }),

            submitProject: (programSlug: string, score: number, skillScores: Record<string, number>) =>
                set(state => {
                    const prev = programState(state, programSlug);
                    return {
                        programs: {
                            ...state.programs,
                            [programSlug]: { ...prev, projectScore: score, projectSkillScores: skillScores },
                        },
                    };
                }),

            resetProgram: (programSlug: string) =>
                set(state => ({
                    programs: { ...state.programs, [programSlug]: initialProgramState() },
                })),

            getEvidence: (programSlug, tasks, sessions) => {
                const program = getProgram(programSlug);
                if (!program) return null;
                const prev = programState(get(), programSlug);
                return buildEvidence(
                    program,
                    tasks,
                    sessions,
                    prev.storedAnswers,
                    prev.finalAssessmentScore,
                    prev.practicalScore,
                    prev.projectScore,
                    { anchorDate: anchorForProgram(prev), artifacts: collectArtifacts(program.evidenceHobbyIds) },
                );
            },

            getProgress: (programSlug, tasks, sessions) => {
                const program = getProgram(programSlug);
                if (!program) return null;
                const evidence = get().getEvidence(programSlug, tasks, sessions);
                if (!evidence) return null;
                const prev = programState(get(), programSlug);
                return buildProgress(
                    program,
                    evidence,
                    prev.projectSkillScores,
                    toTaskItems(program, tasks, anchorForProgram(prev)),
                );
            },

            getReadiness: (programSlug, tasks, sessions, streakDays, avgCompletion7d) => {
                const program = getProgram(programSlug);
                if (!program) return null;
                const evidence = get().getEvidence(programSlug, tasks, sessions);
                if (!evidence) return null;
                return computeReadiness(program, evidence, streakDays, avgCompletion7d);
            },

            getRetake: (programSlug, tasks, sessions) => {
                const program = getProgram(programSlug);
                if (!program) return null;
                const progress = get().getProgress(programSlug, tasks, sessions);
                if (!progress) return null;
                const prev = programState(get(), programSlug);
                return getRetakeDecision(prev.attempts, progress, prev.remediationDone);
            },

            getRecoveryPlan: (programSlug, tasks, sessions) => {
                const program = getProgram(programSlug);
                if (!program) return null;
                const progress = get().getProgress(programSlug, tasks, sessions);
                if (!progress) return null;
                return buildRecoveryPlan(program, progress);
            },

            enrolledPrograms: () => {
                const { programs } = get();
                return CREDENTIAL_PROGRAMS.filter(p => programs[p.slug]?.enrolled).map(p => p.slug);
            },
        }),
        {
            name: 'credential-storage',
            storage: createJSONStorage(() => AsyncStorage),
            // v2 quarantine: legacy local issuance keys (issued flags,
            // identity flags, holder name) are dropped on rehydrate so a
            // stale locally-minted "credential" can never be read back as
            // truth. Server RPCs own issuance/verification.
            version: 2,
            migrate: persisted => {
                const state = (persisted ?? {}) as Record<string, unknown>;
                const programs = (state.programs ?? {}) as Record<string, Record<string, unknown>>;
                const clean: Record<string, Record<string, unknown>> = {};
                for (const [slug, prev] of Object.entries(programs)) {
                    if (!prev || typeof prev !== 'object') continue;
                    const { issued: _issued, identityVerified: _identity, ...rest } = prev;
                    clean[slug] = rest;
                }
                return { programs: clean };
            },
            partialize: state => ({ programs: state.programs }) as CredentialState,
        },
    ),
);

export default useCredentialStore;
