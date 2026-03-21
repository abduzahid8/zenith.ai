import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Task, TaskType, UserStateSnapshot } from '../services/supabase/types';
import { taskService } from '../services/taskService';
import { useUserProfileStore } from './userProfileStore';
import { getTodayDateString } from '../utils/date';
import { canAddTask } from '../domain/tasks/rules';
import { toAppError } from '../shared/errors';

interface TaskState {
    dailyTasks: Task[];
    snapshot: UserStateSnapshot | null;
    loading: boolean;
    error: string | null;
    lastFetchDate: string | null;

    fetchDailyPlan: (userId: string) => Promise<void>;
    addTask: (userId: string, type: TaskType, template?: { title: string; duration: number }) => Promise<void>;
    completeTask: (userId: string, taskId: string, feedback?: {
        difficulty_rating?: number;
        engagement_rating?: number;
        user_notes?: string;
    }) => Promise<void>;
    uncompleteTask: (userId: string, taskId: string) => Promise<void>;
    skipTask: (userId: string, taskId: string) => Promise<void>;
    resetTasks: () => void;
}

export const useTaskStore = create<TaskState>()(
    persist(
        (set, get) => ({
            dailyTasks: [],
            snapshot: null,
            loading: false,
            error: null,
            lastFetchDate: null,

            fetchDailyPlan: async (userId: string) => {
                const today = getTodayDateString();
                const { lastFetchDate, dailyTasks } = get();

                if (lastFetchDate === today && dailyTasks.length >= 2) {
                    return; // Use cached data if available for today
                }

                set({ loading: true, error: null });
                try {
                    const tasks = await taskService.getDailyPlan(userId, today);
                    set({ dailyTasks: tasks, lastFetchDate: today, loading: false });
                } catch (e: unknown) {
                    set({ error: e instanceof Error ? e.message : 'Unknown error', loading: false });
                }
            },

            addTask: async (userId: string, type: TaskType, template?: { title: string; duration: number }) => {
                const profile = useUserProfileStore.getState();
                const isPremium = profile.isPremium;
                const { dailyTasks } = get();
                const addCheck = canAddTask({
                    existingTasks: dailyTasks,
                    type,
                    template,
                    isPremium,
                });

                if (!addCheck.allowed) {
                    set({ error: addCheck.errorMessage || null });
                    if (addCheck.errorMessage) {
                        throw new Error(addCheck.errorMessage);
                    }
                    return;
                }

                const today = getTodayDateString();
                const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

                const optimisticTask: Task = {
                    id: tempId,
                    user_id: userId,
                    title: template?.title || 'Новая задача',
                    type,
                    status: 'pending',
                    scheduled_date: today,
                    duration_minutes: template?.duration || 15,
                    is_manual: true,
                };

                set(state => ({
                    dailyTasks: [...state.dailyTasks, optimisticTask],
                    error: null
                }));

                taskService.createManualTask(userId, type, today, template)
                    .then(newTask => {
                        set(state => ({
                            dailyTasks: state.dailyTasks.map(t => t.id === tempId ? newTask : t),
                        }));
                    })
                    .catch(e => {
                        const appError = toAppError(e, 'Failed to add task');
                        console.error('Failed to add task:', JSON.stringify(e, null, 2));
                        set(state => ({
                            dailyTasks: state.dailyTasks.filter(t => t.id !== tempId),
                            error: appError.message
                        }));
                    });

                return Promise.resolve();
            },

            completeTask: async (userId: string, taskId: string, feedback?: {
                difficulty_rating?: number;
                engagement_rating?: number;
                user_notes?: string;
            }) => {
                // Optimistic update
                set((state) => ({
                    dailyTasks: state.dailyTasks.map(t =>
                        t.id === taskId ? {
                            ...t,
                            status: 'completed',
                            ...(feedback || {}) // Apply feedback to local state optimistically
                        } : t
                    )
                }));

                try {
                    const updated = await taskService.completeTask(userId, taskId, feedback);
                    if (updated) {
                        set((state) => ({
                            dailyTasks: state.dailyTasks.map(t =>
                                t.id === taskId ? updated : t
                            )
                        }));
                    }
                } catch (e: unknown) {
                    const errMsg = e instanceof Error ? e.message : (typeof e === 'object' && e !== null && 'message' in e) ? (e as any).message : String(e);
                    console.error('Failed to complete task:', errMsg, e);
                    set((state) => ({
                        dailyTasks: state.dailyTasks.map((t) =>
                            t.id === taskId ? { ...t, status: 'pending' } : t
                        ),
                        error: 'Failed to update task status',
                    }));
                }
            },

            uncompleteTask: async (userId: string, taskId: string) => {
                // Optimistic update
                set((state) => ({
                    dailyTasks: state.dailyTasks.map(t =>
                        t.id === taskId ? { ...t, status: 'pending' } : t
                    )
                }));

                try {
                    const updated = await taskService.uncompleteTask(userId, taskId);
                    if (updated) {
                        set((state) => ({
                            dailyTasks: state.dailyTasks.map(t =>
                                t.id === taskId ? updated : t
                            )
                        }));
                    }
                } catch (e: unknown) {
                    const errMsg = e instanceof Error ? e.message : (typeof e === 'object' && e !== null && 'message' in e) ? (e as any).message : String(e);
                    console.error('Failed to uncomplete task:', errMsg, e);
                    set((state) => ({
                        dailyTasks: state.dailyTasks.map((t) =>
                            t.id === taskId ? { ...t, status: 'completed' } : t
                        ),
                        error: 'Failed to update task status',
                    }));
                }
            },

            skipTask: async (userId: string, taskId: string) => {
                set((state) => ({
                    dailyTasks: state.dailyTasks.map(t =>
                        t.id === taskId ? { ...t, status: 'skipped' } : t
                    )
                }));

                try {
                    const updated = await taskService.skipTask(userId, taskId);
                    if (updated) {
                        set((state) => ({
                            dailyTasks: state.dailyTasks.map(t =>
                                t.id === taskId ? updated : t
                            )
                        }));
                    }
                } catch (e: unknown) {
                    console.error('Failed to skip task:', e);
                    set((state) => ({
                        dailyTasks: state.dailyTasks.map((t) =>
                            t.id === taskId ? { ...t, status: 'pending' } : t
                        ),
                    }));
                }
            },

            resetTasks: () => set({ dailyTasks: [], lastFetchDate: null, error: null })
        }),
        {
            name: 'task-storage',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({
                dailyTasks: state.dailyTasks,
                lastFetchDate: state.lastFetchDate
            }),
        }
    )
);

export default useTaskStore;
