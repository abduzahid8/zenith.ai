import type { Task, TaskType } from '../../services/supabase/types';
import type { SessionBlueprint, StepOutcome } from './sessionBlueprint';
import { isRewardedOutcome } from './sessionBlueprint';

/**
 * ONE logical completion pipeline for structured sessions (§6).
 * Pure and UI-free so the product invariants (§13) are unit-testable:
 * finishStructuredSession() = save session + mark task complete +
 * evidence + skill/cert recalculation + streak + refreshed DailyPlan +
 * next task — with the UI reading this plan's result.
 */

export const ENGINE_TASK_TYPES: readonly TaskType[] = ['theory', 'practice', 'analysis', 'puzzles'];

export interface PlanTask {
    id?: string | null;
    type: TaskType | string;
    status: string;
}

export function isEngineTask(task: Pick<PlanTask, 'type'>): boolean {
    return (ENGINE_TASK_TYPES as readonly string[]).includes(task.type);
}

/** Open = anything that still needs work (pending/in_progress). */
export function isTaskOpen(task: Pick<PlanTask, 'status'>): boolean {
    return task.status !== 'completed' && task.status !== 'skipped';
}

/**
 * Next incomplete unlocked core task of the DailyPlan (INVARIANT 1/5).
 * Home Start and Your Day taps resolve through this — one task object,
 * never a duplicate generated version.
 */
export function findNextIncompleteTask<T extends PlanTask>(tasks: readonly T[]): T | null {
    return tasks.find((t) => isEngineTask(t) && isTaskOpen(t)) ?? null;
}

/** "All tasks completed" is shown ONLY when the actual plan is complete (INVARIANT 6). */
export function shouldShowAllDone(tasks: readonly PlanTask[]): boolean {
    const engine = tasks.filter(isEngineTask);
    return engine.length > 0 && !engine.some(isTaskOpen);
}

export interface CompletionPlan<T extends PlanTask = PlanTask> {
    /** Advance day / sessions / streak-eligible counters. */
    advance: boolean;
    /** Credit the target daily task. */
    completeTask: boolean;
    /** All required daily core tasks complete (post-completion state). */
    showAllDone: boolean;
    /** First still-open task after this completion (null when all done). */
    nextTask: T | null;
}

export function resolveCompletionPlan<T extends PlanTask>(input: {
    blueprint: SessionBlueprint | null;
    outcome: StepOutcome;
    tasks: readonly T[];
    targetTaskId?: string | null;
}): CompletionPlan<T> {
    const { blueprint, outcome, tasks, targetTaskId } = input;
    // INVARIANT 2: discovery/review-only sessions never complete daily tasks.
    const rewarded = !!blueprint?.countsAsFullCompletion && isRewardedOutcome(outcome);
    const completeTask = rewarded && !!targetTaskId;
    const remaining = tasks.filter(
        (t) => isEngineTask(t) && isTaskOpen(t) && !(completeTask && t.id === targetTaskId),
    );
    const engineCount = tasks.filter(isEngineTask).length;
    return {
        advance: rewarded,
        completeTask,
        showAllDone: engineCount > 0 && remaining.length === 0,
        nextTask: remaining[0] ?? null,
    };
}

// Re-export Task for consumers that only need the plan shape.
export type { Task };
