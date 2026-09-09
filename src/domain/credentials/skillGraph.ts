/**
 * Skill graph computation (§5), anchored in the REAL curriculum.
 *
 * Each program skill covers a week of the hobby's 28-day task bank
 * (skill.dayRange, e.g. days 1–7). Daily tasks carry their curriculum
 * dayNumber — computed with the same 28-day rotation as the task engine —
 * so every completed "Узнай/Сделай" visibly grows exactly one skill.
 *
 * Per skill, three evidence sources:
 * - learning: completed bank tasks of that week (matching task types)
 * - assessment: tagged answers — session artifacts (AI verdicts 👍/🤔 count
 *   as correct, like the session engine rewards them) + final-exam answers
 * - project: rubric score mapped to the skill (if submitted)
 *
 * Weights: learning 0.30 / assessment 0.45 / project 0.25.
 * Without a project: learning 0.40 / assessment 0.60.
 *
 * Credential is awarded only if overall ≥ requiredScore AND no critical
 * competency is below its minimum — stronger than a plain quiz average.
 */

import {
    AssessmentKind,
    CredentialProgram,
    LearningEvidence,
    SkillGraphResult,
} from './types';

export interface TaskEvidenceInput {
    type: 'theory' | 'practice' | 'analysis' | 'puzzles';
    status: 'completed' | string;
    hobbyId?: string;
    /** Curriculum day 1..28 in the hobby bank (same rotation as taskEngine). */
    dayNumber?: number;
}

export interface AssessmentEvidenceInput {
    skillKey: string;
    correct: boolean;
    kind: AssessmentKind;
}

const LEARNING_WEIGHT = 0.3;
const ASSESSMENT_WEIGHT = 0.45;
const PROJECT_WEIGHT = 0.25;

const LEARNING_WEIGHT_NO_PROJECT = 0.4;
const ASSESSMENT_WEIGHT_NO_PROJECT = 0.6;

function inDayRange(day: number | undefined, range: [number, number]): boolean {
    if (day === undefined || day === null || Number.isNaN(day)) return false;
    return day >= range[0] && day <= range[1];
}

export function computeSkillGraph(
    program: CredentialProgram,
    tasks: TaskEvidenceInput[],
    assessments: AssessmentEvidenceInput[],
    projectScores: Record<string, number> | null,
): SkillGraphResult {
    // Only tasks from the program's evidence hobbies count. When hobbyId is
    // unknown (offline/demo tasks), count the task — the engine already scoped
    // the daily plan to the user's primary hobby.
    const relevant = tasks.filter(
        t => !t.hobbyId || program.evidenceHobbyIds.includes(t.hobbyId),
    );

    const skills = program.skills.map(skill => {
        // --- Learning: this week's bank tasks of matching types ---
        const pool = relevant.filter(
            t => inDayRange(t.dayNumber, skill.dayRange) && skill.evidenceTaskTypes.includes(t.type),
        );
        const completed = pool.filter(t => t.status === 'completed').length;
        const learning = pool.length > 0 ? (completed / pool.length) * 100 : 0;

        // --- Assessment: tagged answers for this skill ---
        const answers = assessments.filter(a => a.skillKey === skill.key);
        const correct = answers.filter(a => a.correct).length;
        const assessment = answers.length > 0 ? (correct / answers.length) * 100 : 0;

        // --- Project ---
        const project = projectScores?.[skill.key] ?? null;

        let score: number;
        if (project !== null && project !== undefined) {
            score = learning * LEARNING_WEIGHT + assessment * ASSESSMENT_WEIGHT + project * PROJECT_WEIGHT;
        } else {
            score =
                learning * LEARNING_WEIGHT_NO_PROJECT +
                assessment * ASSESSMENT_WEIGHT_NO_PROJECT;
        }

        const evidenceCount = pool.length + answers.length + (project !== null ? 1 : 0);
        const rounded = Math.round(score * 10) / 10;
        return {
            skillKey: skill.key,
            name: skill.name,
            score: rounded,
            weight: skill.weight,
            minimumScore: skill.minimumScore,
            passed: rounded >= skill.minimumScore,
            evidenceCount,
        };
    });

    const overall = Math.round(skills.reduce((sum, s) => sum + s.score * s.weight, 0) * 10) / 10;
    const overallPassed = overall >= program.requiredScore;
    const competenciesPassed = skills.every(s => s.passed);
    const weakestSkills = [...skills].sort((a, b) => a.score - b.score).slice(0, 3);

    return {
        skills,
        overall,
        overallPassed,
        competenciesPassed,
        passed: overallPassed && competenciesPassed,
        weakestSkills,
    };
}

/**
 * Curriculum day (1..28) for a task date, using the same rotation as the
 * task engine: ((dayIndex-1) % 28) + 1, anchored at the journey start
 * (enrollment date). Historical tasks stay in-cycle via positive modulo.
 */
export function curriculumDayForDate(taskDate: string, anchorDate: string): number {
    const ms = new Date(taskDate).getTime() - new Date(anchorDate).getTime();
    const diffDays = Math.floor(ms / 86400000);
    return ((diffDays % 28) + 28) % 28 + 1;
}

/**
 * Learning completion vs certification progress (§6) — separate concepts.
 * learningCompletion: share of curriculum consumed (tasks completed).
 * certificationProgress: verified competence (skill graph overall).
 */
export function computeLearningCompletion(evidence: LearningEvidence): number {
    if (evidence.totalTasks <= 0) return 0;
    return Math.round((evidence.completedTasks / evidence.totalTasks) * 100);
}

export function clampScore(value: number): number {
    if (Number.isNaN(value)) return 0;
    return Math.min(100, Math.max(0, Math.round(value * 10) / 10));
}
