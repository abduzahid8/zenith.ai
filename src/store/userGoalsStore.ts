import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    UserGoalId,
    ExperiencePreference,
    normalizeGoals,
    normalizeExperiencePreference,
    MAX_GOALS,
} from '../domain/onboarding/goals';
import { normalizePreferredMinutes } from '../domain/sessions/sessionDurations';

interface UserGoalsState {
    goals: UserGoalId[];
    preferredSessionMinutes: number | null;
    experiencePreference: ExperiencePreference | null;
    updatedAt: string | null;
    /** True once the user passed the extended onboarding steps. */
    hasCompletedExtension: boolean;

    toggleGoal: (id: UserGoalId) => void;
    setGoals: (goals: unknown) => void;
    setPreferredSessionMinutes: (minutes: number | null) => void;
    setExperiencePreference: (pref: unknown) => void;
    markExtensionCompleted: () => void;
    hydrateFromRemote: (remote: {
        goals?: unknown;
        preferredSessionMinutes?: unknown;
        experiencePreference?: unknown;
    }) => void;
    resetGoals: () => void;
}

const initialState = {
    goals: [] as UserGoalId[],
    preferredSessionMinutes: null as number | null,
    experiencePreference: null as ExperiencePreference | null,
    updatedAt: null as string | null,
    hasCompletedExtension: false,
};

function touchUpdatedAt(): string {
    return new Date().toISOString();
}

export const useUserGoalsStore = create<UserGoalsState>()(
    persist(
        (set, get) => ({
            ...initialState,

            toggleGoal: (id) => {
                const { goals } = get();
                if (goals.includes(id)) {
                    set({ goals: goals.filter((g) => g !== id), updatedAt: touchUpdatedAt() });
                } else {
                    if (goals.length >= MAX_GOALS) return;
                    set({ goals: [...goals, id], updatedAt: touchUpdatedAt() });
                }
            },

            setGoals: (goals) => {
                set({ goals: normalizeGoals(goals), updatedAt: touchUpdatedAt() });
            },

            setPreferredSessionMinutes: (minutes) => {
                set({
                    preferredSessionMinutes: normalizePreferredMinutes(minutes),
                    updatedAt: touchUpdatedAt(),
                });
            },

            setExperiencePreference: (pref) => {
                set({
                    experiencePreference: normalizeExperiencePreference(pref),
                    updatedAt: touchUpdatedAt(),
                });
            },

            markExtensionCompleted: () => {
                set({ hasCompletedExtension: true, updatedAt: touchUpdatedAt() });
            },

            hydrateFromRemote: (remote) => {
                // Progressive profiling: only overwrite local fields when the
                // remote actually has a value (existing users stay untouched).
                const patch: Partial<UserGoalsState> = {};
                if (remote.goals !== undefined && remote.goals !== null) {
                    const normalized = normalizeGoals(remote.goals);
                    if (normalized.length > 0) patch.goals = normalized;
                }
                if (
                    remote.preferredSessionMinutes !== undefined &&
                    remote.preferredSessionMinutes !== null
                ) {
                    const normalized = normalizePreferredMinutes(
                        remote.preferredSessionMinutes as number,
                    );
                    if (normalized !== null) patch.preferredSessionMinutes = normalized;
                }
                if (
                    remote.experiencePreference !== undefined &&
                    remote.experiencePreference !== null
                ) {
                    const normalized = normalizeExperiencePreference(remote.experiencePreference);
                    if (normalized !== null) patch.experiencePreference = normalized;
                }
                if (Object.keys(patch).length > 0) {
                    set({ ...patch, hasCompletedExtension: true });
                }
            },

            resetGoals: () => {
                set({ ...initialState });
            },
        }),
        {
            name: 'user-goals-storage',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({
                goals: state.goals,
                preferredSessionMinutes: state.preferredSessionMinutes,
                experiencePreference: state.experiencePreference,
                updatedAt: state.updatedAt,
                hasCompletedExtension: state.hasCompletedExtension,
            }),
        },
    ),
);

export default useUserGoalsStore;
