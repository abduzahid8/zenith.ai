import type { Task, TaskType } from '../../services/supabase/types';

/**
 * Your Day view-model — pure derivation over the REAL DailyPlan Task[].
 * Same task objects Home Start and the Session Engine use; this module only
 * decides user-facing order, action labels and progress state.
 *
 * Action language (RU-first keys for t()): Learn / Practice / Challenge.
 * The internal theory/practice/analysis/puzzles taxonomy never reaches UI.
 */

export type TodayAction = 'learn' | 'practice' | 'challenge';

export interface TodayRow {
    taskId: string | null;
    title: string;
    minutes: number;
    completed: boolean;
    state: 'done' | 'next' | 'later';
    action: TodayAction;
    /** RU-first label key, e.g. 'Узнай'. UI applies t(). */
    actionLabel: string;
}

const ACTION_BY_TYPE: Record<TaskType, { action: TodayAction; label: string }> = {
    theory: { action: 'learn', label: 'Узнай' },
    practice: { action: 'practice', label: 'Сделай' },
    analysis: { action: 'practice', label: 'Попробуй' },
    puzzles: { action: 'challenge', label: 'Вызов' },
};

const ENGINE_ORDER: TaskType[] = ['theory', 'practice', 'analysis', 'puzzles'];

export interface TodaySequence {
    rows: TodayRow[];
    minutesLeft: number;
    doneCount: number;
    next: TodayRow | null;
    allDone: boolean;
}

export function buildTodaySequence(dailyTasks: Task[]): TodaySequence {
    const ordered = ENGINE_ORDER.flatMap(type => dailyTasks.filter(t => t.type === type));
    let nextAssigned = false;
    const rows: TodayRow[] = ordered.map(task => {
        const meta = ACTION_BY_TYPE[task.type as TaskType] ?? { action: 'practice' as const, label: 'Сделай' };
        const completed = task.status === 'completed';
        const state = completed ? 'done' : !nextAssigned ? 'next' : 'later';
        if (!completed && !nextAssigned) nextAssigned = true;
        return {
            taskId: task.id ?? null,
            title: task.title,
            minutes: task.duration_minutes && task.duration_minutes > 0 ? task.duration_minutes : 15,
            completed,
            state,
            action: meta.action,
            actionLabel: meta.label,
        };
    });
    const minutesLeft = rows.filter(r => !r.completed).reduce((s, r) => s + r.minutes, 0);
    const doneCount = rows.filter(r => r.completed).length;
    const next = rows.find(r => r.state === 'next') ?? null;
    return { rows, minutesLeft, doneCount, next, allDone: rows.length > 0 && doneCount === rows.length };
}
