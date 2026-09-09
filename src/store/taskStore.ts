import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Task, TaskType, UserStateSnapshot } from '../services/supabase/types';
import { taskService } from '../services/taskService';
import { taskEngine } from '../services/taskEngine';
import { isE2EBypassEnabled, isLocalOnlyTaskId } from '../utils/e2eBypass';
import { useUserProfileStore } from './userProfileStore';
import { getTodayDateString } from '../utils/date';
import { canAddTask, getMaxTasksPerDay, getAutoTasksPerDay } from '../domain/tasks/rules';
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
                const isPremium = useUserProfileStore.getState().isPremium;

                const hasTempTasks = dailyTasks.some(t => t.id?.startsWith('temp-'));
                if (lastFetchDate === today && dailyTasks.length >= getAutoTasksPerDay() && !hasTempTasks) {
                    console.log('[taskStore] fetchDailyPlan using cached data for today');
                    return; // Use cached data if available for today
                }

                console.log('[taskStore] fetchDailyPlan fetching from server - userId:', userId);
                set({ loading: true, error: null });
                try {
                    const tasks = await taskService.getDailyPlan(userId, today, isPremium);
                    console.log('[taskStore] fetchDailyPlan success - tasks count:', tasks.length);
                    set({ dailyTasks: tasks, lastFetchDate: today, loading: false });
                } catch (e: unknown) {
                    // E2E/manual QA without login or network: seed a demo plan
                    // from the real task engine so Home + Quick Session work.
                    // Demo ids are local-only and never touch the server.
                    if (isE2EBypassEnabled()) {
                        console.log('[taskStore] E2E bypass — seeding demo plan from taskEngine');
                        const hobbyId = useUserProfileStore.getState().selectedHobby ?? 'python';
                        const demo = taskEngine.generateDailyPlan(userId, today, null, [
                            { user_id: userId, hobby_id: hobbyId, is_primary: true },
                        ]);
                        set({
                            dailyTasks: demo.map((t, i) => ({ ...t, id: `demo-${today}-${i}` })),
                            lastFetchDate: today,
                            loading: false,
                        });
                        return;
                    }
                    console.log('[taskStore] fetchDailyPlan error:', e);
                    set({ error: e instanceof Error ? e.message : 'Unknown error', loading: false });
                }
            },

            addTask: async (userId: string, type: TaskType, template?: { title: string; duration: number }) => {
                console.log('[taskStore] addTask - type:', type, 'title:', template?.title);
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
                    console.log('[taskStore] addTask not allowed:', addCheck.errorMessage);
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
                    title: template?.title || 'New Task',
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
                        console.log('[taskStore] addTask server success - newTaskId:', newTask.id);
                        set(state => {
                            const current = state.dailyTasks.find(t => t.id === tempId);
                            const merged = current && current.status !== 'pending'
                                ? { ...newTask, status: current.status }
                                : newTask;
                            return {
                                dailyTasks: state.dailyTasks.map(t => t.id === tempId ? merged : t),
                            };
                        });
                    })
                    .catch(e => {
                        const appError = toAppError(e, 'Failed to add task');
                        console.log('[taskStore] addTask server error:', appError.message);
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
                console.log('[taskStore] completeTask - taskId:', taskId);
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

                // Skip Supabase call for local-only IDs (task not yet persisted)
                if (isLocalOnlyTaskId(taskId)) {
                    console.log('[taskStore] completeTask skipped for local-only id');
                    return;
                }

                try {
                    const updated = await taskService.completeTask(userId, taskId, feedback);
                    if (updated) {
                        console.log('[taskStore] completeTask server success');
                        set((state) => ({
                            dailyTasks: state.dailyTasks.map(t =>
                                t.id === taskId ? updated : t
                            )
                        }));
                    }
                } catch (e: unknown) {
                    const errMsg = e instanceof Error ? e.message : (typeof e === 'object' && e !== null && 'message' in e) ? (e as any).message : String(e);
                    console.log('[taskStore] completeTask error:', errMsg);
                    set((state) => ({
                        dailyTasks: state.dailyTasks.map((t) =>
                            t.id === taskId ? { ...t, status: 'pending' } : t
                        ),
                        error: 'Failed to update task status',
                    }));
                }
            },

            uncompleteTask: async (userId: string, taskId: string) => {
                console.log('[taskStore] uncompleteTask - taskId:', taskId);
                // Optimistic update
                set((state) => ({
                    dailyTasks: state.dailyTasks.map(t =>
                        t.id === taskId ? { ...t, status: 'pending' } : t
                    )
                }));

                // Skip Supabase call for local-only IDs (task not yet persisted)
                if (isLocalOnlyTaskId(taskId)) {
                    console.log('[taskStore] uncompleteTask skipped for local-only id');
                    return;
                }

                try {
                    const updated = await taskService.uncompleteTask(userId, taskId);
                    if (updated) {
                        console.log('[taskStore] uncompleteTask server success');
                        set((state) => ({
                            dailyTasks: state.dailyTasks.map(t =>
                                t.id === taskId ? updated : t
                            )
                        }));
                    }
                } catch (e: unknown) {
                    const errMsg = e instanceof Error ? e.message : (typeof e === 'object' && e !== null && 'message' in e) ? (e as any).message : String(e);
                    console.log('[taskStore] uncompleteTask error:', errMsg);
                    set((state) => ({
                        dailyTasks: state.dailyTasks.map((t) =>
                            t.id === taskId ? { ...t, status: 'completed' } : t
                        ),
                        error: 'Failed to update task status',
                    }));
                }
            },

            skipTask: async (userId: string, taskId: string) => {
                console.log('[taskStore] skipTask - taskId:', taskId);
                set((state) => ({
                dailyTasks: state.dailyTasks.map(t =>
                    t.id === taskId ? { ...t, status: 'skipped' } : t
                )
            }));

            // Skip Supabase call for local-only IDs (task not yet persisted)
            if (isLocalOnlyTaskId(taskId)) {
                console.log('[taskStore] skipTask skipped for local-only id');
                return;
            }

            try {
                    const updated = await taskService.skipTask(userId, taskId);
                    if (updated) {
                        console.log('[taskStore] skipTask server success');
                        set((state) => ({
                            dailyTasks: state.dailyTasks.map(t =>
                                t.id === taskId ? updated : t
                            )
                        }));
                    }
                } catch (e: unknown) {
                    console.log('[taskStore] skipTask error:', e);
                    set((state) => ({
                        dailyTasks: state.dailyTasks.map((t) =>
                            t.id === taskId ? { ...t, status: 'pending' } : t
                        ),
                    }));
                }
            },

            resetTasks: () => {
                console.log('[taskStore] resetTasks called');
                set({ dailyTasks: [], lastFetchDate: null, error: null });
            }
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
