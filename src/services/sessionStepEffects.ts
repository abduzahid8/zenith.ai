import type { HobbyId, LessonContent } from '../data/lessonContent';
import { useGamificationStore } from '../store/gamificationStore';
import { useGoalStore } from '../store/goalStore';
import type { SessionEvaluation } from '../domain/sessions/outcomePolicy';

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
    evaluation: SessionEvaluation;
    /** True when a chess puzzle was actually solved this session. */
    chessSolved: boolean;
}

export interface SessionProgressionResult {
    /** Whether curriculum/sessions/goal progression ran (eligible only). */
    progressed: boolean;
    advancedDay: boolean;
}

/**
 * Run validated end-of-session progression exactly once.
 * Eligible = evaluation pass|partial. Fail/non-rewarding runs nothing.
 *
 * Goal signals stay truth-aware without redesigning goal scoring:
 *   pass    -> full practice weight + completed_easy
 *   partial -> minimal weight (participation, never mastery) + completed_struggled
 *   fail    -> difficulty signal only (completed_struggled), no progress
 *   non-rewarding -> nothing at all
 */
export function applySessionProgression(input: SessionProgressionInput): SessionProgressionResult {
    const { lesson, evaluation, chessSolved } = input;
    if (evaluation !== 'pass' && evaluation !== 'partial' && evaluation !== 'fail') {
        // non-rewarding (unknown/skipped/unanswered): absolutely nothing.
        return { progressed: false, advancedDay: false };
    }
    if (evaluation === 'fail') {
        // Failure signal only: difficulty adapts, but no progress, no advance.
        try {
            useGoalStore.getState().adjustDifficulty(lesson.hobby as HobbyId, 'completed_struggled');
        } catch {}
        return { progressed: false, advancedDay: false };
    }
    const g = useGamificationStore.getState();
    try {
        g.markStepComplete('learn');
        g.markStepComplete('do');
    } catch (err) {
        console.error('[sessionStepEffects] markStepComplete failed:', err);
    }
    if (chessSolved) {
        try {
            g.recordChessSolve();
        } catch {}
    }
    try {
        if (evaluation === 'pass') {
            useGoalStore.getState().recordDailyAction(lesson.hobby as HobbyId, 2, lesson.learn.title);
            useGoalStore.getState().adjustDifficulty(lesson.hobby as HobbyId, 'completed_easy');
        } else {
            useGoalStore.getState().recordDailyAction(lesson.hobby as HobbyId, 1, lesson.learn.title);
            useGoalStore.getState().adjustDifficulty(lesson.hobby as HobbyId, 'completed_struggled');
        }
    } catch (err) {
        console.error('[sessionStepEffects] Goal progression failed:', err);
    }
    try {
        g.advanceDay(lesson.hobby as HobbyId);
        g.incrementSessionsCompleted();
    } catch (err) {
        console.error('[sessionStepEffects] advance failed:', err);
        return { progressed: true, advancedDay: false };
    }
    return { progressed: true, advancedDay: true };
}
