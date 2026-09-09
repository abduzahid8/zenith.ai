/**
 * Credential service — orchestration layer.
 *
 * Connects the existing learning engine to the credential domain:
 * - buildEvidence(): reads Task[] + Session[] (+ stored assessment answers)
 *   and produces the LearningEvidence the skill graph consumes.
 * - gradeAttempt(): scores prepared questions → per-skill answers.
 * - evaluateProject(): strict-rubric project scoring — deterministic checks
 *   first, AI (Gemini via worker proxy) second, never AI alone (§9).
 * - issue(): builds the official IssuedCredential record (§11).
 *
 * All functions are pure except evaluateProject (network) — easy to test.
 */

import {
    AssessmentKind,
    CertificationProgress,
    CredentialProgram,
    EnrollmentStatus,
    IssuedCredential,
    LearningEvidence,
} from '../domain/credentials/types';
import {
    buildCredentialId,
    computeFinalScore,
    FinalScoreInput,
    verificationUrlFor,
} from '../domain/credentials/scoring';
import {
    computeLearningCompletion,
    computeSkillGraph,
    curriculumDayForDate,
    TaskEvidenceInput,
} from '../domain/credentials/skillGraph';
import { getProgram, getProgramForHobby } from '../domain/credentials/catalog';
import { PreparedQuestion, scoreAnswer } from '../data/assessmentBank';
import { aiService } from './ai';

export interface EngineTaskInput {
    type: 'theory' | 'practice' | 'analysis' | 'puzzles';
    status: string;
    hobby_id?: string;
    duration_minutes?: number;
    scheduled_date?: string;
}

export interface SessionInput {
    hobby_id: string;
    duration_seconds: number;
    focus_score?: number;
    completed_at?: string;
}

export interface StoredAnswerInput {
    skillKey: string;
    correct: boolean;
    kind: AssessmentKind;
}

/**
 * Session artifact (the app's own training output) as credential evidence.
 * lessonId looks like "english_d3" — the day maps straight onto the bank
 * week → skill. Verdicts follow the session engine: rewarded outcomes
 * (pass/partial, i.e. 👍/🤔) count as correct.
 */
export interface ArtifactEvidenceInput {
    hobbyId: string;
    lessonId: string;
    taskType: 'do' | 'deepen1' | 'deepen2';
    verdict: 'pass' | 'partial' | 'fail' | 'unknown' | 'skipped';
}

export function lessonDayToSkillKey(program: CredentialProgram, lessonId: string): string | null {
    const match = /_d(\d+)\b/.exec(lessonId);
    if (!match) return null;
    const day = ((((Number(match[1]) - 1) % 28) + 28) % 28) + 1;
    const skill = program.skills.find(s => day >= s.dayRange[0] && day <= s.dayRange[1]);
    return skill?.key ?? null;
}

/**
 * Skill tag for a structured DailyPlan task (INVARIANT 7).
 * Derived — never stored — from hobby + scheduled date against the same
 * 28-day curriculum rotation the task engine and credential graph share,
 * so a Python Foundations path can only ever resolve Python skills.
 * Returns null when the task cannot be mapped (unknown hobby/date) or
 * when there is no canonical enrollment anchor — never invents day 1.
 */
export function taskSkillKey(
    task: { hobby_id?: string | null; scheduled_date?: string | null },
    anchorDate: string | null,
): { programSlug: string; skillKey: string } | null {
    if (!task.hobby_id || !task.scheduled_date) return null;
    if (!anchorDate) return null;
    const program = getProgramForHobby(task.hobby_id);
    if (!program) return null;
    const day = curriculumDayForDate(task.scheduled_date, anchorDate);
    const skill = program.skills.find(s => day >= s.dayRange[0] && day <= s.dayRange[1]);
    if (!skill) return null;
    return { programSlug: program.slug, skillKey: skill.key };
}

export function artifactToAnswer(program: CredentialProgram, artifact: ArtifactEvidenceInput): StoredAnswerInput | null {
    if (!program.evidenceHobbyIds.includes(artifact.hobbyId)) return null;
    const skillKey = lessonDayToSkillKey(program, artifact.lessonId);
    if (!skillKey) return null;
    return {
        skillKey,
        correct: artifact.verdict === 'pass' || artifact.verdict === 'partial',
        kind: 'applied',
    };
}

/**
 * Build credential evidence from NORMAL engine data (§4, §17).
 * `allTasks` should span the learning history (trailing ~28 days);
 * tasks outside the program's evidence hobbies are ignored. Every task is
 * stamped with its curriculum day (same 28-day rotation as the task
 * engine, anchored at the journey start) so skills grow from real weeks.
 */
export function buildEvidence(
    program: CredentialProgram,
    allTasks: EngineTaskInput[],
    sessions: SessionInput[],
    storedAnswers: StoredAnswerInput[],
    finalAssessmentScore: number | null = null,
    practicalScore: number | null = null,
    projectScore: number | null = null,
    opts: { anchorDate?: string | null; artifacts?: ArtifactEvidenceInput[] } = {},
): LearningEvidence {
    const anchor = opts.anchorDate ?? null;
    const relevantTasks = allTasks.filter(
        t => !t.hobby_id || program.evidenceHobbyIds.includes(t.hobby_id),
    );
    const completedTasks = relevantTasks.filter(t => t.status === 'completed').length;

    const relevantSessions = sessions.filter(s => program.evidenceHobbyIds.includes(s.hobby_id));
    const practiceMinutes = Math.round(
        relevantSessions.reduce((sum, s) => sum + (s.duration_seconds || 0), 0) / 60,
    );
    const focusScores = relevantSessions
        .map(s => s.focus_score)
        .filter((v): v is number => typeof v === 'number');
    const avgFocusScore =
        focusScores.length > 0
            ? Math.round((focusScores.reduce((a, b) => a + b, 0) / focusScores.length) * 10) / 10
            : null;

    // Practical score fallback: derive from practice/analysis completion so
    // the final-score breakdown is meaningful before manual grading.
    const practicalTasks = relevantTasks.filter(t => t.type === 'practice' || t.type === 'analysis');
    const derivedPractical =
        practicalScore ??
        (practicalTasks.length > 0
            ? Math.round((practicalTasks.filter(t => t.status === 'completed').length / practicalTasks.length) * 100)
            : null);

    // Session artifacts become tagged assessment answers: the AI verdict
    // the user ALREADY earned in focus sessions counts toward the skill
    // of that lesson's bank week.
    const artifactAnswers: StoredAnswerInput[] = (opts.artifacts ?? [])
        .map(a => artifactToAnswer(program, a))
        .filter((a): a is StoredAnswerInput => a !== null);

    return {
        completedTasks,
        totalTasks: relevantTasks.length,
        sessionsCompleted: relevantSessions.length,
        practiceMinutes,
        avgFocusScore,
        assessmentAnswers: [...artifactAnswers, ...storedAnswers],
        finalAssessmentScore,
        practicalScore: derivedPractical,
        projectScore,
    };
}

/** Task items stamped with curriculum days for the skill graph. */
export function toTaskItems(
    program: CredentialProgram,
    allTasks: EngineTaskInput[],
    anchorDate: string | null,
): TaskEvidenceInput[] {
    return allTasks
        .filter(t => !t.hobby_id || program.evidenceHobbyIds.includes(t.hobby_id))
        .map(t => ({
            type: t.type,
            status: t.status,
            hobbyId: t.hobby_id,
            dayNumber:
                anchorDate && t.scheduled_date
                    ? curriculumDayForDate(t.scheduled_date, anchorDate)
                    : undefined,
        }));
}

export function buildProgress(
    program: CredentialProgram,
    evidence: LearningEvidence,
    projectScores: Record<string, number> | null = null,
    taskItems: TaskEvidenceInput[] = [],
): CertificationProgress {
    // Real engine tasks (with curriculum days) — never fabricated.
    const skillGraph = computeSkillGraph(program, taskItems, evidence.assessmentAnswers, projectScores);
    return {
        programSlug: program.slug,
        learningCompletion: computeLearningCompletion(evidence),
        certificationProgress: skillGraph.overall,
        skillGraph,
        status: deriveStatus(program, evidence, skillGraph.overall),
    };
}

function deriveStatus(
    program: CredentialProgram,
    evidence: LearningEvidence,
    overall: number,
): EnrollmentStatus {
    if (evidence.finalAssessmentScore !== null && overall >= program.requiredScore) return 'passed';
    if (evidence.finalAssessmentScore !== null) return 'failed';
    return 'learning';
}

// ---------------------------------------------------------------------------
// Final assessment grading
// ---------------------------------------------------------------------------

export interface AttemptAnswer {
    questionId: string;
    selectedIndices?: number[];
    booleanAnswer?: boolean | null;
}

export function gradeAttempt(
    questions: PreparedQuestion[],
    answers: AttemptAnswer[],
): { score: number; perSkill: StoredAnswerInput[]; correctCount: number } {
    const byId = new Map(answers.map(a => [a.questionId, a]));
    let correctCount = 0;
    const perSkill: StoredAnswerInput[] = questions.map(question => {
        const answer = byId.get(question.id);
        const correct = scoreAnswer(
            question,
            answer?.selectedIndices ?? [],
            answer?.booleanAnswer ?? null,
        );
        if (correct) correctCount++;
        return { skillKey: question.skillKey, correct, kind: question.kind };
    });
    const score = questions.length > 0 ? Math.round((correctCount / questions.length) * 1000) / 10 : 0;
    return { score, perSkill, correctCount };
}

// ---------------------------------------------------------------------------
// Final project evaluation (§8, §9) — deterministic first, AI second.
// ---------------------------------------------------------------------------

export interface ProjectRubric {
    dataAccuracy: number; // 25
    analyticalReasoning: number; // 25
    interpretation: number; // 20
    recommendations: number; // 20
    communication: number; // 10
}

export interface ProjectEvaluation {
    rubric: ProjectRubric;
    /** 0..100 */
    total: number;
    feedback: string;
    aiAssisted: boolean;
    /** Per-skill mapping for the skill graph. */
    skillScores: Record<string, number>;
}

const RUBRIC_MAX: ProjectRubric = {
    dataAccuracy: 25,
    analyticalReasoning: 25,
    interpretation: 20,
    recommendations: 20,
    communication: 10,
};

function rubricTotal(r: ProjectRubric): number {
    return r.dataAccuracy + r.analyticalReasoning + r.interpretation + r.recommendations + r.communication;
}

/**
 * Deterministic baseline from submission structure — always available
 * offline and never generous: length/coverage checks only.
 */
export function deterministicProjectScore(submission: {
    wordCount: number;
    chartCount: number;
    calculationCount: number;
    hasRecommendations: boolean;
}): ProjectRubric {
    const { wordCount, chartCount, calculationCount, hasRecommendations } = submission;
    return {
        dataAccuracy: Math.min(25, Math.round((calculationCount / 5) * 25)),
        analyticalReasoning: Math.min(25, Math.round((wordCount / 400) * 25)),
        interpretation: Math.min(20, Math.round((wordCount / 300) * 20)),
        recommendations: hasRecommendations ? 14 : 0,
        communication: Math.min(10, Math.round((chartCount / 3) * 10)),
    };
}

export function projectRubricToSkillScores(
    program: CredentialProgram,
    total: number,
): Record<string, number> {
    // Map the holistic project score onto skills fed by practice/analysis —
    // the task types a project actually exercises — with a small spread so
    // the graph stays readable.
    const out: Record<string, number> = {};
    program.skills.forEach((skill, i) => {
        const practical = skill.evidenceTaskTypes.includes('practice') || skill.evidenceTaskTypes.includes('analysis');
        out[skill.key] = Math.max(0, Math.min(100, Math.round((practical ? total : total - 8 + (i % 3) * 4) * 10) / 10));
    });
    return out;
}

export async function evaluateProject(
    program: CredentialProgram,
    submission: { text: string; wordCount: number; chartCount: number; calculationCount: number; hasRecommendations: boolean },
): Promise<ProjectEvaluation> {
    const baseline = deterministicProjectScore(submission);
    try {
        const prompt =
            `You are a strict certification examiner. Score this ${program.title} final project ` +
            `with the rubric (be critical, no flattery): Data Accuracy /25, Analytical Reasoning /25, ` +
            `Interpretation /20, Recommendations /20, Communication /10. ` +
            `Reply ONLY as JSON: {"dataAccuracy":n,"analyticalReasoning":n,"interpretation":n,"recommendations":n,"communication":n,"feedback":"2-3 sentences"}. ` +
            `Project text (truncated): ${submission.text.slice(0, 4000)}`;
        const raw = await aiService.sendMessage([{ role: 'user', content: prompt }]);
        const parsed = JSON.parse(String(raw).replace(/```json|```/g, '').trim()) as Partial<ProjectRubric> & { feedback?: string };
        const rubric: ProjectRubric = {
            dataAccuracy: Math.min(RUBRIC_MAX.dataAccuracy, Math.max(0, Number(parsed.dataAccuracy ?? baseline.dataAccuracy))),
            analyticalReasoning: Math.min(RUBRIC_MAX.analyticalReasoning, Math.max(0, Number(parsed.analyticalReasoning ?? baseline.analyticalReasoning))),
            interpretation: Math.min(RUBRIC_MAX.interpretation, Math.max(0, Number(parsed.interpretation ?? baseline.interpretation))),
            recommendations: Math.min(RUBRIC_MAX.recommendations, Math.max(0, Number(parsed.recommendations ?? baseline.recommendations))),
            communication: Math.min(RUBRIC_MAX.communication, Math.max(0, Number(parsed.communication ?? baseline.communication))),
        };
        // AI assists but cannot inflate beyond evidence: blend 50/50 with
        // the deterministic baseline (§9 — AI is never the only source).
        const blended: ProjectRubric = {
            dataAccuracy: Math.round(((rubric.dataAccuracy + baseline.dataAccuracy) / 2) * 10) / 10,
            analyticalReasoning: Math.round(((rubric.analyticalReasoning + baseline.analyticalReasoning) / 2) * 10) / 10,
            interpretation: Math.round(((rubric.interpretation + baseline.interpretation) / 2) * 10) / 10,
            recommendations: Math.round(((rubric.recommendations + baseline.recommendations) / 2) * 10) / 10,
            communication: Math.round(((rubric.communication + baseline.communication) / 2) * 10) / 10,
        };
        const total = Math.round(rubricTotal(blended) * 10) / 10;
        return {
            rubric: blended,
            total,
            feedback: typeof parsed.feedback === 'string' ? parsed.feedback : 'AI-assisted evaluation complete.',
            aiAssisted: true,
            skillScores: projectRubricToSkillScores(program, total),
        };
    } catch {
        const total = rubricTotal(baseline);
        return {
            rubric: baseline,
            total,
            feedback: 'Offline evaluation: scored from submission structure. Reconnect for AI-assisted review.',
            aiAssisted: false,
            skillScores: projectRubricToSkillScores(program, total),
        };
    }
}

// ---------------------------------------------------------------------------
// Issuance (§11)
// ---------------------------------------------------------------------------

export function issueCredential(
    programSlug: string,
    userId: string,
    holderName: string,
    finalInput: FinalScoreInput,
    progress: CertificationProgress,
    evidence: LearningEvidence,
    issuedAt: string = new Date().toISOString(),
): IssuedCredential | null {
    const program = getProgram(programSlug);
    if (!program) return null;
    const breakdown = computeFinalScore(program, finalInput);
    if (!breakdown.passed || !progress.skillGraph.passed) return null;

    const credentialId = buildCredentialId(program.code, userId, issuedAt);
    return {
        credentialId,
        programSlug: program.slug,
        programTitle: program.title,
        programVersion: program.version,
        level: program.level,
        holderName,
        userId,
        finalScore: breakdown.total,
        grade: breakdown.grade,
        skills: progress.skillGraph.skills.map(s => ({ key: s.skillKey, name: s.name, score: s.score })),
        issuedAt,
        expiresAt: null,
        status: 'active',
        verificationUrl: verificationUrlFor(credentialId),
        evidence: {
            learningHours: Math.round((evidence.practiceMinutes / 60) * 10) / 10,
            tasksCompleted: evidence.completedTasks,
            assessmentsTaken: evidence.assessmentAnswers.length,
            practicalAssignments: evidence.practicalScore !== null ? 1 : 0,
            projectsCompleted: evidence.projectScore !== null ? 1 : 0,
        },
    };
}
