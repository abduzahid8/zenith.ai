import { getProgramForHobby } from '../domain/credentials/catalog';
import { useCredentialStore } from '../store/credentialStore';
import { useTaskStore } from '../store/taskStore';
import type { EngineTaskInput } from './credentialService';
import type { CertificationProgress, CredentialProgram } from '../domain/credentials/types';

/**
 * Session evidence deltas — what ONE session actually improved.
 * Derived on the fly from the same engine data the credential system
 * already observes (daily tasks + artifacts + skill graph). No new
 * tables, no stored silo: snapshot the skill graph at session start,
 * diff it at session finish.
 */

export interface SkillMove {
    skillKey: string;
    name: string;
    from: number;
    to: number;
}

export interface SkillSnapshot {
    slug: string;
    title: string;
    overall: number;
    skills: Record<string, { name: string; score: number }>;
}

export interface SessionDelta {
    minutes: number;
    rewarded: boolean;
    verifiedCount: number;
    taskCompletedTitle: string | null;
    programTitle: string | null;
    overallFrom: number | null;
    overallTo: number | null;
    moves: SkillMove[];
}

function engineTasks(): EngineTaskInput[] {
    return toEngineTaskInputs(useTaskStore.getState().dailyTasks);
}

export function toEngineTaskInputs(
    dailyTasks: Array<{
        type: string;
        status: string;
        hobby_id?: string | null;
        duration_minutes?: number | null;
        scheduled_date: string;
    }>,
): EngineTaskInput[] {
    return dailyTasks.map((t) => ({
        type: t.type as EngineTaskInput['type'],
        status: t.status,
        hobby_id: t.hobby_id ?? undefined,
        duration_minutes: t.duration_minutes ?? undefined,
        scheduled_date: t.scheduled_date,
    }));
}

/**
 * Weakest not-yet-passed skill — what a certificate bite should target.
 * Pure over program + progress; falls back to the first skill when
 * nothing is measured yet.
 */
export function weakestOpenSkill(
    program: CredentialProgram,
    progress: CertificationProgress | null,
): { skillKey: string; name: string; score: number } | null {
    const open =
        progress?.skillGraph.weakestSkills.find((s) => !s.passed) ??
        progress?.skillGraph.weakestSkills[0];
    if (open) return { skillKey: open.skillKey, name: open.name, score: open.score };
    const first = program.skills[0];
    return first ? { skillKey: first.key, name: first.name, score: 0 } : null;
}

function snapshotFor(hobbyId: string | null): SkillSnapshot | null {
    try {
        if (!hobbyId) return null;
        const program = getProgramForHobby(hobbyId);
        if (!program) return null;
        const progress: CertificationProgress | null = useCredentialStore
            .getState()
            .getProgress(program.slug, engineTasks(), []);
        if (!progress) return null;
        const skills: Record<string, { name: string; score: number }> = {};
        for (const s of progress.skillGraph.skills) {
            skills[s.skillKey] = { name: s.name, score: s.score };
        }
        return { slug: program.slug, title: program.title, overall: progress.skillGraph.overall, skills };
    } catch {
        return null;
    }
}

export function captureSkillSnapshot(hobbyId: string | null): SkillSnapshot | null {
    return snapshotFor(hobbyId);
}

export function diffSkillSnapshot(
    before: SkillSnapshot | null,
    hobbyId: string | null,
    opts: { minutes: number; rewarded: boolean; verifiedCount: number; taskCompletedTitle: string | null },
): SessionDelta {
    const after = snapshotFor(hobbyId);
    const base: SessionDelta = {
        minutes: opts.minutes,
        rewarded: opts.rewarded,
        verifiedCount: opts.verifiedCount,
        taskCompletedTitle: opts.taskCompletedTitle,
        programTitle: after?.title ?? before?.title ?? null,
        overallFrom: before?.overall ?? null,
        overallTo: after?.overall ?? null,
        moves: [],
    };
    if (!before || !after || before.slug !== after.slug) return base;
    const moves: SkillMove[] = [];
    for (const [key, prev] of Object.entries(before.skills)) {
        const next = after.skills[key];
        if (next && next.score > prev.score) {
            moves.push({ skillKey: key, name: next.name, from: prev.score, to: next.score });
        }
    }
    moves.sort((a, b) => b.to - b.from - (a.to - a.from));
    base.moves = moves.slice(0, 2);
    return base;
}
