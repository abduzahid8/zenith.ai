import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Task, UserStateSnapshot } from '../services/supabase/types';
import { taskService } from '../services/taskService';

interface TaskState {
    dailyTasks: Task[];
    snapshot: UserStateSnapshot | null;
    loading: boolean;
    error: string | null;
    lastFetchDate: string | null;

    fetchDailyPlan: (userId: string) => Promise<void>;
    completeTask: (userId: string, taskId: string, feedback?: {
        difficulty_rating?: number;
        engagement_rating?: number;
        user_notes?: string;
    }) => Promise<void>;
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
                const today = new Date().toISOString().split('T')[0];
                const { lastFetchDate, dailyTasks } = get();

                if (lastFetchDate === today && dailyTasks.length >= 4) {
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
                    console.error('Failed to complete task:', e);
                    set((state) => ({
                        dailyTasks: state.dailyTasks.map((t) =>
                            t.id === taskId ? { ...t, status: 'pending' } : t
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
