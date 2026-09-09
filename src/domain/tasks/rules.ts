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

export const AUTO_TASKS_PER_DAY = 4;

export function getAutoTasksPerDay(): number {
    return AUTO_TASKS_PER_DAY;
}

export function getMaxTasksPerDay(_isPremium: boolean): number {
    return 4;
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
        return { allowed: false, errorMessage: 'Достигнут лимит задач на сегодня' };
    }

    if (!template) {
        if (engineTasks.some((t) => t.type === type)) {
            return {
                allowed: false,
                errorMessage: 'Задача этого типа уже добавлена сегодня',
            };
        }
        return { allowed: true };
    }

    if (isDuplicateTemplate({ existingTasks: engineTasks, type, template })) {
        return {
            allowed: false,
            errorMessage: 'Эта задача уже есть в вашем плане',
        };
    }

    return { allowed: true };
}

export function shouldIncrementStreak(tasksForDay: Task[]): boolean {
    const baseTasks = tasksForDay.filter((t) => !t.is_manual);
    if (baseTasks.length === 0) return false;
    return baseTasks.every((t) => t.status === 'completed');
}

