import type { Task, TaskType } from '../../services/supabase/types';

export const ENGINE_TYPES: TaskType[] = ['theory', 'practice', 'analysis', 'puzzles'];

export interface CanAddTaskParams {
    existingTasks: Task[];
    type: TaskType;
    template?: { title: string; duration: number };
    isPremium: boolean;
}

export interface CanAddTaskResult {
    allowed: boolean;
    errorMessage?: string;
}

export function getMaxTasksPerDay(isPremium: boolean): number {
    return isPremium ? 4 : 3;
}

export function isDuplicateTemplate(params: {
    existingTasks: Task[];
    type: TaskType;
    template: { title: string; duration: number };
}): boolean {
    const { existingTasks, type, template } = params;
    return existingTasks.some(
        (t) => t.type === type && t.title === template.title,
    );
}

export function canAddTask(params: CanAddTaskParams): CanAddTaskResult {
    const { existingTasks, type, template, isPremium } = params;

    const engineTasks = existingTasks.filter((t) =>
        ENGINE_TYPES.includes(t.type as TaskType),
    );

    const maxTasks = getMaxTasksPerDay(isPremium);
    if (engineTasks.length >= maxTasks) {
        const msg = isPremium
            ? 'Maximum daily tasks reached'
            : 'Upgrade to Premium to add more tasks';
        return { allowed: false, errorMessage: msg };
    }

    if (!template) {
        if (engineTasks.some((t) => t.type === type)) {
            return {
                allowed: false,
                errorMessage: 'Task of this type already exists today',
            };
        }
        return { allowed: true };
    }

    if (isDuplicateTemplate({ existingTasks: engineTasks, type, template })) {
        return {
            allowed: false,
            errorMessage: 'This task is already in your plan',
        };
    }

    return { allowed: true };
}

export function shouldIncrementStreak(tasksForDay: Task[]): boolean {
    const baseTasks = tasksForDay.filter((t) => !t.is_manual);
    if (baseTasks.length === 0) return false;
    return baseTasks.every((t) => t.status === 'completed');
}

