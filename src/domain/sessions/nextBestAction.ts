import type { CredentialProgram } from '../credentials/types';
import { findNextIncompleteTask } from './sessionCompletion';
import type { MasteryOutcome } from './outcomePolicy';
import type { SkillState } from './skillState';

export type RecommendationType =
    | 'continue_curriculum'
    | 'repair_recall'
    | 'practice_application'
    | 'prove_skill'
    | 'review_skill';

export type ReasonCode =
    | 'recent_validation_failure'
    | 'repeated_application_struggle'
    | 'recall_gap'
    | 'missing_validation'
    | 'continue_path'
    | 'insufficient_evidence';

export type RecommendationConfidence = 'low' | 'medium' | 'high';

export interface LearningRecommendation {
    type: RecommendationType;
    hobbyId: string;
    programSlug?: string;
    skillKey?: string;
    skillName?: string;
    /** Real previously encountered curriculum day (never future/unseen). */
    curriculumDay?: number;
    taskId?: string;
    minutes: number;
    reasonCode: ReasonCode;
    reasonData?: {
        failures?: number;
        partials?: number;
        skillName?: string;
        day?: number;
    };
    confidence: RecommendationConfidence;
}

export interface RecommendInput {
    hobbyId: string;
    program?: CredentialProgram;
    skillStates: SkillState[];
    currentCurriculumDay: number;
    availableMinutes: number;
    dailyTasks: Array<{ id?: string | null; title: string; type: string; status: string; duration_minutes?: number | null }>;
}

interface DaySignal {
    skill: SkillState;
    day: number;
    kind: 'validation_fail' | 'application_weak' | 'recall_weak';
    recencyRank: number;
    repeats: number;
}

/**
 * ONE deterministic recommendation source for Quick, Credential, Your Day
 * and Coach context. Priority:
 * A. recent strong validation failure -> practice_application
 * B. repeated application weakness      -> practice_application
 * C. recall gap (+ weak/missing app)    -> repair_recall (repeated/recent)
 *    or review_skill (isolated old)
 * D. ready to prove (strong recall+app, no validation, time allows)
 *                                       -> prove_skill
 * E. otherwise                          -> continue_curriculum
 * F. no evidence at all                 -> continue_curriculum (insufficient)
 *
 * Remediation targets real encountered days only; unseen future days are
 * never selected. Repair never permanently blocks the frontier: isolated
 * old weakness degrades to a light review.
 */
export function getNextBestLearningAction(input: RecommendInput): LearningRecommendation {
    const { hobbyId, program, skillStates, currentCurriculumDay, availableMinutes, dailyTasks } = input;
    const minutes = Math.max(1, Math.floor(availableMinutes || 15));
    const nextTask = findNextIncompleteTask(
        dailyTasks.map(t => ({ id: t.id ?? null, type: t.type, status: t.status })),
    );
    const nextTaskFull = nextTask ? dailyTasks.find(t => (t.id ?? null) === nextTask.id) ?? null : null;

    const encountered = skillStates.filter(s => s.independentSessions > 0 || s.exposure.daysCovered > 0);
    if (!program || encountered.length === 0) {
        return {
            type: 'continue_curriculum',
            hobbyId,
            programSlug: program?.slug,
            curriculumDay: currentCurriculumDay,
            taskId: nextTaskFull?.id ?? undefined,
            minutes,
            reasonCode: 'insufficient_evidence',
            confidence: 'low',
        };
    }

    // Session recency rank per skill (0 = most recently practiced).
    const order: string[] = [];
    {
        const latest = new Map<string, string>();
        for (const s of encountered) {
            if (s.lastPracticedAt) {
                const prev = latest.get(s.skillKey);
                if (!prev || s.lastPracticedAt > prev) latest.set(s.skillKey, s.lastPracticedAt);
            }
        }
        order.push(
            ...[...latest.entries()].sort((a, b) => (a[1] < b[1] ? 1 : -1)).map(([k]) => k),
        );
    }
    const rankOf = (skillKey: string): number => {
        const i = order.indexOf(skillKey);
        return i < 0 ? Number.MAX_SAFE_INTEGER : i;
    };

    // Collect weak encountered days (finals only; discovery already excluded
    // upstream because strength-none events never enter SkillState mastery).
    const weakDays: DaySignal[] = [];
    for (const s of encountered) {
        for (const d of s.days) {
            const fails = (arr: MasteryOutcome[]) => arr.filter(o => o === 'fail').length;
            const weaks = (arr: MasteryOutcome[]) => arr.filter(o => o === 'fail' || o === 'partial').length;
            if (fails(d.validation) > 0) {
                weakDays.push({ skill: s, day: d.day, kind: 'validation_fail', recencyRank: rankOf(s.skillKey), repeats: fails(d.validation) });
            } else if (weaks(d.application) >= 2 || (weaks(d.application) >= 1 && rankOf(s.skillKey) <= 1)) {
                weakDays.push({ skill: s, day: d.day, kind: 'application_weak', recencyRank: rankOf(s.skillKey), repeats: weaks(d.application) });
            } else if (fails(d.recall) >= 2) {
                weakDays.push({ skill: s, day: d.day, kind: 'recall_weak', recencyRank: rankOf(s.skillKey), repeats: fails(d.recall) });
            }
        }
    }
    const byPriority: Record<DaySignal['kind'], number> = { validation_fail: 0, application_weak: 1, recall_weak: 2 };
    weakDays.sort(
        (a, b) => byPriority[a.kind] - byPriority[b.kind] || a.recencyRank - b.recencyRank || b.repeats - a.repeats,
    );

    const programSlug = program.slug;
    const shortTime = minutes < 10;

    // A. Recent strong validation failure -> targeted application practice.
    const validationFail = weakDays.find(w => w.kind === 'validation_fail');
    if (validationFail) {
        return {
            type: 'practice_application',
            hobbyId,
            programSlug,
            skillKey: validationFail.skill.skillKey,
            skillName: validationFail.skill.name,
            curriculumDay: validationFail.day,
            minutes,
            reasonCode: 'recent_validation_failure',
            reasonData: { skillName: validationFail.skill.name, day: validationFail.day, failures: validationFail.repeats },
            confidence: validationFail.skill.independentSessions >= 2 ? 'high' : 'medium',
        };
    }

    // B. Repeated application weakness.
    const appWeak = weakDays.find(w => w.kind === 'application_weak');
    if (appWeak) {
        if (shortTime) {
            return {
                type: 'repair_recall',
                hobbyId,
                programSlug,
                skillKey: appWeak.skill.skillKey,
                skillName: appWeak.skill.name,
                curriculumDay: appWeak.day,
                minutes,
                reasonCode: 'repeated_application_struggle',
                reasonData: { skillName: appWeak.skill.name, day: appWeak.day, partials: appWeak.repeats },
                confidence: 'medium',
            };
        }
        return {
            type: 'practice_application',
            hobbyId,
            programSlug,
            skillKey: appWeak.skill.skillKey,
            skillName: appWeak.skill.name,
            curriculumDay: appWeak.day,
            minutes,
            reasonCode: 'repeated_application_struggle',
            reasonData: { skillName: appWeak.skill.name, day: appWeak.day, partials: appWeak.repeats },
            confidence: appWeak.repeats >= 3 ? 'high' : 'medium',
        };
    }

    // C. Recall gap: repeated failures -> repair; a single failure (any
    // recency) -> light review that never blocks the frontier.
    const recallWeak = weakDays.find(w => w.kind === 'recall_weak');
    if (recallWeak) {
        return {
            type: 'repair_recall',
            hobbyId,
            programSlug,
            skillKey: recallWeak.skill.skillKey,
            skillName: recallWeak.skill.name,
            curriculumDay: recallWeak.day,
            minutes,
            reasonCode: 'recall_gap',
            reasonData: { skillName: recallWeak.skill.name, day: recallWeak.day, failures: recallWeak.repeats },
            confidence: 'medium',
        };
    }
    const singleRecallFail = encountered
        .flatMap(s => s.days.filter(d => d.recall.filter(o => o === 'fail').length === 1 && d.recall.length === 1).map(d => ({ s, day: d.day })))
        .sort((a, b) => rankOf(a.s.skillKey) - rankOf(b.s.skillKey))[0];
    if (singleRecallFail) {
        return {
            type: 'review_skill',
            hobbyId,
            programSlug,
            skillKey: singleRecallFail.s.skillKey,
            skillName: singleRecallFail.s.name,
            curriculumDay: singleRecallFail.day,
            minutes,
            reasonCode: 'recall_gap',
            reasonData: { skillName: singleRecallFail.s.name, day: singleRecallFail.day, failures: 1 },
            confidence: 'low',
        };
    }

    // Struggle memory: recovered FAIL->PASS histories merit a light revisit
    // (review only — they never block the frontier like live failures do).
    const struggled = encountered
        .filter(s => s.recoveredStruggles >= 2)
        .map(s => {
            const days = s.days.filter(d => d.struggled);
            return { s, day: days.length > 0 ? days[days.length - 1].day : null };
        })
        .filter((x): x is { s: SkillState; day: number } => x.day !== null)
        .sort((a, b) => rankOf(a.s.skillKey) - rankOf(b.s.skillKey))[0];
    if (struggled) {
        return {
            type: 'review_skill',
            hobbyId,
            programSlug,
            skillKey: struggled.s.skillKey,
            skillName: struggled.s.name,
            curriculumDay: struggled.day,
            minutes,
            reasonCode: 'recall_gap',
            reasonData: { skillName: struggled.s.name, day: struggled.day },
            confidence: 'low',
        };
    }

    // D. Ready to prove: strong recall+application, validation missing, time allows.
    if (minutes >= 20) {
        const ready = encountered.find(
            s =>
                (s.recall.score ?? 0) >= 75 &&
                (s.application.score ?? 0) >= 75 &&
                s.validation.samples === 0 &&
                s.independentSessions >= 2,
        );
        if (ready) {
            const day =
                ready.days.length > 0
                    ? ready.days[ready.days.length - 1].day
                    : ready.dayRange[0];
            return {
                type: 'prove_skill',
                hobbyId,
                programSlug,
                skillKey: ready.skillKey,
                skillName: ready.name,
                curriculumDay: day,
                taskId: nextTaskFull?.id ?? undefined,
                minutes,
                reasonCode: 'missing_validation',
                reasonData: { skillName: ready.name, day },
                confidence: 'medium',
            };
        }
    }

    // E/F. Continue the real path.
    return {
        type: 'continue_curriculum',
        hobbyId,
        programSlug,
        curriculumDay: currentCurriculumDay,
        taskId: nextTaskFull?.id ?? undefined,
        minutes,
        reasonCode: 'continue_path',
        confidence: encountered.some(s => s.confidenceLevel === 'high' || s.confidenceLevel === 'medium')
            ? 'medium'
            : 'low',
    };
}
