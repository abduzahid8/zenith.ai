import type { HobbyId, LessonContent } from '../data/lessonContent';
import { useGamificationStore } from '../store/gamificationStore';
import { useGoalStore } from '../store/goalStore';

/**
 * Step side-effects adapter — mirrors useTimer.handleStepComplete store
 * operations exactly (gamification + artifacts + goal actions + day advance)
 * without any navigation or timer coupling.
 *
 * The swipe session calls these at the same semantic points as the legacy
 * stepper so both presentations feed identical systems. When the legacy
 * screen retires, both callers collapse into this module (Phase 2/3).
 */

const STEP_WEIGHT: Record<string, number> = {
    learn: 1,
    do: 2,
    deepen1: 3,
    deepen2: 4,
};

const STEP_DIFFICULTY: Record<string, 'completed_easy' | 'completed_struggled'> = {
    do: 'completed_easy',
    deepen1: 'completed_easy',
    deepen2: 'completed_easy',
};

function recordGoal(lesson: LessonContent, step: string): void {
    try {
        useGoalStore.getState().recordDailyAction(
            lesson.hobby as HobbyId,
            STEP_WEIGHT[step] || 1,
            lesson.learn.title,
        );
        useGoalStore.getState().adjustDifficulty(
            lesson.hobby as HobbyId,
            STEP_DIFFICULTY[step] || 'completed_easy',
        );
    } catch (err) {
        console.error('[sessionStepEffects] Goal record failed:', err);
    }
}

function saveStepArtifact(lesson: LessonContent, step: string, userInput?: string, aiFeedback?: string): void {    if (!userInput) return;
    try {
        useGamificationStore.getState().saveArtifact({
            hobbyId: lesson.hobby,
            lessonId: lesson.id,
            taskType: (step.startsWith('test_') ? 'do' : step) as any,
            userInput,
            aiFeedback: aiFeedback || '',
        });
    } catch (err) {
        console.error('[sessionStepEffects] Artifact save failed:', err);
    }
}

/**
 * Light formative artifact for recall answers (mirrors the legacy tests step:
 * no goal actions, no day advance — the answer itself is the evidence).
 */
export function saveRecallArtifact(
    lesson: LessonContent,
    userInput: string,
    aiFeedback?: string,
): void {
    // 'test_*' steps map to the 'do' artifact channel (legacy parity).
    saveStepArtifact(lesson, 'test_recall', userInput, aiFeedback);
}

/**
 * Apply the completion effects of one session step.
 * `step` matches legacy activeStep ids: learn | tests | do | deepen1 | deepen2.
 * Returns whether this step finished the learning arc (advance day + session).
 */
export function applyStepEffects(
    step: string,
    lesson: LessonContent,
    opts: { userInput?: string; aiFeedback?: string; isPremium: boolean },
): { arcComplete: boolean } {
    const g = useGamificationStore.getState();

    if (['learn', 'do', 'deepen1', 'deepen2'].includes(step)) {
        try {
            g.markStepComplete(step as any);
        } catch (err) {
            console.error('[sessionStepEffects] markStepComplete failed:', err);
        }
    }
    saveStepArtifact(lesson, step, opts.userInput, opts.aiFeedback);

    const finishArc = () => {
        try {
            g.advanceDay(lesson.hobby as HobbyId);
            g.incrementSessionsCompleted();
        } catch (err) {
            console.error('[sessionStepEffects] advance failed:', err);
        }
    };

    if (step === 'learn' || step === 'tests') {
        return { arcComplete: false };
    }
    if (step === 'do') {
        if (lesson.hobby === 'chess') {
            try {
                g.recordChessSolve();
            } catch {}
            recordGoal(lesson, step);
            finishArc();
            return { arcComplete: true };
        }
        if (opts.isPremium && lesson.deepen1) return { arcComplete: false };
        recordGoal(lesson, step);
        finishArc();
        return { arcComplete: true };
    }
    if (step === 'deepen1') {
        if (opts.isPremium && lesson.deepen2) return { arcComplete: false };
        recordGoal(lesson, step);
        finishArc();
        return { arcComplete: true };
    }
    // deepen2
    recordGoal(lesson, step);
    finishArc();
    return { arcComplete: true };
}
