import type { HobbyId, LessonContent } from '../data/lessonContent';
import { useGamificationStore } from '../store/gamificationStore';
import { useGoalStore } from '../store/goalStore';
import type { GoalSignal, ProgressionDecision } from '../domain/sessions/progressionPolicy';

/**
 * Session side effects, split in two responsibilities.
 *
 * A. ATTEMPT effects (immediate, per answer): persist the artifact +
 *    AI-feedback reference and return its id for event linking. These never
 *    advance curriculum, sessions, goals or tasks.
 *
 * B. PROGRESSION effects (once, after validated session evaluation):
 *    curriculum advance, session counter, chess solve, truth-aware goal
 *    signals. Exactly-once per eligible session; zero times otherwise.
 *
 * Legacy useTimer keeps its own inline logic; the swipe session must use
 * only this module (no direct advanceDay/incrementSessionsCompleted calls).
 */

// ---------------------------------------------------------------------------
// A. Attempt effects
// ---------------------------------------------------------------------------

/**
 * Persist one answer attempt as an artifact. Returns the artifact id
 * (artifactRef for learning events) or null when there is nothing to store.
 * Never touches progression.
 */
export function recordAttemptArtifact(
    lesson: LessonContent,
    step: string,
    userInput?: string,
    aiFeedback?: string,
): string | null {
    if (!userInput) return null;
    try {
        return useGamificationStore.getState().saveArtifact({
            hobbyId: lesson.hobby,
            lessonId: lesson.id,
            taskType: (step.startsWith('test_') ? 'do' : step) as any,
            userInput,
            aiFeedback: aiFeedback || '',
        });
    } catch (err) {
        console.error('[sessionStepEffects] Artifact save failed:', err);
        return null;
    }
}

/**
 * Light formative artifact for recall answers (legacy tests parity:
 * no goal actions, no day advance from a recall alone).
 */
export function saveRecallArtifact(
    lesson: LessonContent,
    userInput: string,
    aiFeedback?: string,
): string | null {
    // 'test_*' steps map to the 'do' artifact channel (legacy parity).
    return recordAttemptArtifact(lesson, 'test_recall', userInput, aiFeedback);
}

// ---------------------------------------------------------------------------
// B. Progression effects (exactly once per eligible session)
// ---------------------------------------------------------------------------

export interface SessionProgressionInput {
    lesson: LessonContent;
    decision: ProgressionDecision;
    /** True when a chess puzzle was actually solved this session. */
    chessSolved: boolean;
}

export interface SessionProgressionResult {
    /** Whether any progression ran (false = session left zero trace). */
    progressed: boolean;
    advancedDay: boolean;
}

function sendGoalSignal(lesson: LessonContent, signal: GoalSignal): void {
    try {
        const goals = useGoalStore.getState();
        if (signal === 'success') {
            goals.recordDailyAction(lesson.hobby as HobbyId, 2, lesson.learn.title);
            goals.adjustDifficulty(lesson.hobby as HobbyId, 'completed_easy');
        } else if (signal === 'struggled') {
            goals.recordDailyAction(lesson.hobby as HobbyId, 1, lesson.learn.title);
            goals.adjustDifficulty(lesson.hobby as HobbyId, 'completed_struggled');
        } else if (signal === 'failure') {
            goals.adjustDifficulty(lesson.hobby as HobbyId, 'completed_struggled');
        }
    } catch (err) {
        console.error('[sessionStepEffects] Goal signal failed:', err);
    }
}

/**
 * Run validated end-of-session progression exactly once per decision.
 * The caller (session finalizer) guarantees single invocation per session;
 * this function only executes what the canonical decision allows:
 *   success   -> full practice weight + completed_easy
 *   struggled -> minimal weight (participation, never mastery) + completed_struggled
 *   failure   -> difficulty signal only, no progress, no advance
 *   null      -> nothing at all
 */
export function applySessionProgression(input: SessionProgressionInput): SessionProgressionResult {
    const { lesson, decision, chessSolved } = input;
    if (
        !decision.countSession &&
        !decision.advanceCurriculum &&
        decision.goalSignal === null
    ) {
        return { progressed: false, advancedDay: false };
    }
    const g = useGamificationStore.getState();
    try {
        g.markStepComplete('learn');
        g.markStepComplete('do');
    } catch (err) {
        console.error('[sessionStepEffects] markStepComplete failed:', err);
    }
    if (chessSolved && decision.countSession) {
        try {
            g.recordChessSolve();
        } catch {}
    }
    sendGoalSignal(lesson, decision.goalSignal);
    let advancedDay = false;
    if (decision.advanceCurriculum) {
        try {
            g.advanceDay(lesson.hobby as HobbyId);
            advancedDay = true;
        } catch (err) {
            console.error('[sessionStepEffects] advance failed:', err);
        }
    }
    if (decision.countSession) {
        try {
            g.incrementSessionsCompleted();
        } catch (err) {
            console.error('[sessionStepEffects] session count failed:', err);
        }
    }
    return { progressed: true, advancedDay };
}
