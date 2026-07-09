import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HobbyId } from '../data/lessonContent';
import { GoalDefinition, GoalProgress, GoalSnapshot, BottleneckAnalysis, HelpMode, Milestone, GoalProgressEntry } from '../types/goals';
import { getHandler, skillHandler, executionHandler, rollingVelocity, computeNextMode } from '../services/goalHandlers';

// ── Helpers ──────────────────────────────────────────────

function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

function daysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

function computeSnapshot(goal: GoalDefinition | null | undefined, progressData: GoalProgress | null | undefined): GoalSnapshot | null {
  if (!goal || !progressData) return null;

  const handler = getHandler(goal.category);
  const result = handler.computeProgress(goal, progressData);

  return {
    definition: goal,
    progress: progressData,
    percentComplete: result.percentComplete,
    daysRemaining: Math.max(0, daysBetween(getTodayString(), goal.deadline)),
    projectedCompletion: result.projectedCompletion,
    unitsRemaining: result.unitsRemaining,
    dailyRateNeeded: result.dailyRateNeeded,
    unitLabel: result.unitLabel,
  };
}

export function getInitialProgress(goalId: string, startingValue: number): GoalProgress {
  return {
    goalId,
    currentValue: startingValue,
    lastUpdated: getTodayString(),
    dailyActions: 0,
    streak: 0,
    history: [],
    currentMode: 'milestone',
    milestones: [],
    currentMilestoneIndex: 0,
  };
}

function computeStreak(history: GoalProgressEntry[]): number {
  const today = getTodayString();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const lastEntry = history.length > 0 ? history[history.length - 1] : null;
  if (!lastEntry) return 1;
  const isToday = lastEntry.date === today;
  const wasYesterday = lastEntry.date === yesterdayStr;

  if (isToday || wasYesterday) {
    const activeDays = new Set(history.map(h => h.date));
    let streak = 0;
    const d = new Date();
    while (activeDays.has(d.toISOString().split('T')[0])) {
      streak++;
      d.setDate(d.getDate() - 1);
    }
    return streak;
  }
  return 1;
}

// ── Store ────────────────────────────────────────────────

interface GoalState {
  goals: Record<string, GoalDefinition>;
  progress: Record<string, GoalProgress>;
  goalByHobby: Record<string, string>;
  executionGoalByHobby: Record<string, string>;

  setGoal: (goal: GoalDefinition) => void;
  updateGoal: (goalId: string, updates: Partial<Pick<GoalDefinition, 'target' | 'deadline' | 'unitLabel' | 'startingValue' | 'description' | 'targetDifficulty' | 'difficultyScore'>>) => void;
  recordDailyAction: (hobbyId: HobbyId, value: number, description: string) => void;
  recordCheckin: (value: number, description: string, bottleneck?: BottleneckAnalysis, hobbyId?: HobbyId) => void;
  adjustDifficulty: (hobbyId: HobbyId, result: 'completed_easy' | 'completed_struggled' | 'abandoned' | 'skipped') => void;
  getSnapshot: (hobbyId: HobbyId) => GoalSnapshot | null;
  getSnapshotById: (goalId: string) => GoalSnapshot | null;
  getActiveSnapshot: () => GoalSnapshot | null;
  abandonGoal: (hobbyId: HobbyId) => void;
  pauseGoal: (goalId: string) => void;
  resumeGoal: (goalId: string) => void;
  markCompleted: (goalId: string) => void;
  getActiveGoal: () => GoalDefinition | null;
  setMilestones: (goalId: string, milestones: Milestone[]) => void;
  setMode: (goalId: string, mode: HelpMode) => void;
  advanceMilestone: (goalId: string) => void;
  setTroubleshoot: (goalId: string, blocker: string) => void;
  setBottleneck: (goalId: string, bottleneck: BottleneckAnalysis) => void;
}

export const useGoalStore = create<GoalState>()(
  persist(
    (set, get) => ({
      goals: {},
      progress: {},
      goalByHobby: {},
      executionGoalByHobby: {},

      setGoal: (goal) => {
        const initialProgress = getInitialProgress(goal.id, goal.startingValue);

        const updates: Partial<GoalState> = {
          goals: { ...get().goals, [goal.id]: goal },
          progress: { ...get().progress, [goal.id]: initialProgress },
        };

        if (goal.hobby) {
          if (goal.category === 'skill') {
            updates.goalByHobby = { ...get().goalByHobby, [goal.hobby]: goal.id };
            if (goal.difficultyScore != null) {
              initialProgress.currentDifficulty = goal.difficultyScore;
            }
          } else {
            updates.executionGoalByHobby = { ...get().executionGoalByHobby, [goal.hobby]: goal.id };
          }
        }

        set(updates);
      },

      updateGoal: (goalId, updates) => {
        set(state => {
          const goal = state.goals[goalId];
          if (!goal) return state;
          return {
            goals: {
              ...state.goals,
              [goalId]: { ...goal, ...updates },
            },
          };
        });
      },

      recordDailyAction: (hobbyId, value, description) => {
        const { goals, progress, goalByHobby, executionGoalByHobby } = get();
        const today = getTodayString();

        const applyAction = (goal: GoalDefinition, actionValue: number): boolean => {
          if (goal.status !== 'active') return false;
          const existing = progress[goal.id] || getInitialProgress(goal.id, goal.startingValue);
          const newValue = existing.currentValue + actionValue;
          const newHistory: GoalProgressEntry = { date: today, value: actionValue, description };
          const newStreak = computeStreak([...existing.history, newHistory]);

          set({ progress: { ...get().progress, [goal.id]: { ...existing, currentValue: newValue, lastUpdated: today, dailyActions: existing.dailyActions + 1, streak: newStreak, history: [...existing.history, newHistory] } } });

          const handler = getHandler(goal.category);
          if (handler.shouldAutoComplete(goal, { ...existing, currentValue: newValue })) {
            get().markCompleted(goal.id);
          }
          return true;
        };

        const skillGoalId = goalByHobby[hobbyId];
        const skillGoal = skillGoalId ? goals[skillGoalId] : null;
        if (skillGoal) applyAction(skillGoal, value);

        const execGoalId = executionGoalByHobby[hobbyId];
        const execGoal = execGoalId ? goals[execGoalId] : null;
        if (execGoal) applyAction(execGoal, value);
      },

      recordCheckin: (value, description, bottleneck, hobbyId?) => {
        const { goals, progress, executionGoalByHobby } = get();
        const today = getTodayString();

        let activeGoal: GoalDefinition | undefined;
        if (hobbyId) {
          const execGoalId = executionGoalByHobby[hobbyId];
          activeGoal = execGoalId ? goals[execGoalId] : undefined;
        }
        if (!activeGoal) {
          activeGoal = Object.values(goals).find(g => g.status === 'active' && g.category === 'execution');
        }
        if (!activeGoal) return;

        const existing = progress[activeGoal.id] || getInitialProgress(activeGoal.id, activeGoal.startingValue);
        const newValue = Math.max(value, existing.currentValue);

        const daysSinceStart = Math.max(1, daysBetween(activeGoal.startDate, today));
        const covered = newValue - activeGoal.startingValue;
        const rollingRate = rollingVelocity(existing.history, covered, daysSinceStart);

        const totalToCover = activeGoal.target - activeGoal.startingValue;
        const coveredSoFar = newValue - activeGoal.startingValue;
        const daysRemainingLocal = Math.max(1, daysBetween(today, activeGoal.deadline));
        const dailyRateNeeded = (totalToCover - coveredSoFar) / daysRemainingLocal;

        const isBehind = rollingRate < dailyRateNeeded && existing.dailyActions >= 3;

        // Mode transitions now live in one documented, pure function
        // (see goalHandlers.computeNextMode) instead of an inline ternary.
        const nextMode: HelpMode = existing.currentMode === 'milestone'
          ? 'milestone' // milestone mode only advances via advanceMilestone/setMilestones
          : computeNextMode({
            currentMode: existing.currentMode,
            isBehind,
            dailyActions: existing.dailyActions,
            history: existing.history,
          });

        // Auto-advance milestone
        let updatedMilestones = [...existing.milestones];
        let updatedIndex = existing.currentMilestoneIndex;
        if (updatedMilestones.length > 0) {
          const current = updatedMilestones[updatedIndex];
          if (current && newValue >= current.target) {
            updatedMilestones[updatedIndex] = { ...current, currentValue: Math.max(current.currentValue, newValue) };
            if (updatedIndex < updatedMilestones.length - 1) updatedIndex++;
          }
        }

        const newHistory: GoalProgressEntry = { date: today, value: newValue, description, type: 'checkin' };
        const newStreak = computeStreak([...existing.history, newHistory]);

        set({
          progress: {
            ...progress,
            [activeGoal.id]: {
              ...existing,
              currentValue: newValue,
              lastUpdated: today,
              dailyActions: existing.dailyActions + 1,
              streak: newStreak,
              velocityTrend: Math.round(rollingRate * 10) / 10,
              lastBottleneck: bottleneck,
              currentMode: nextMode,
              milestones: updatedMilestones,
              currentMilestoneIndex: updatedIndex,
              history: [...existing.history, newHistory],
            },
          },
        });

        const handler = getHandler(activeGoal.category);
        if (handler.shouldAutoComplete(activeGoal, { ...existing, currentValue: newValue })) {
          get().markCompleted(activeGoal.id);
        }
      },

      adjustDifficulty: (hobbyId, result) => {
        const { goals, progress, goalByHobby } = get();
        const goalId = goalByHobby[hobbyId];
        const goal = goalId ? goals[goalId] : null;
        if (!goal || goal.status !== 'active' || goal.category !== 'skill') return;

        const existing = progress[goal.id];
        if (!existing) return;

        const currentDiff = existing.currentDifficulty ?? goal.difficultyScore ?? 500;
        const newDiff = skillHandler.adjustDifficulty(goal, currentDiff, result);

        set({
          progress: {
            ...progress,
            [goal.id]: {
              ...existing,
              currentDifficulty: newDiff,
              lastUpdated: getTodayString(),
              history: [
                ...existing.history,
                { date: getTodayString(), value: currentDiff, description: `difficulty: ${result} → ${newDiff}`, type: 'task' },
              ],
            },
          },
        });

        if (skillHandler.shouldAutoComplete(goal, { ...existing, currentDifficulty: newDiff })) {
          get().markCompleted(goal.id);
        }
      },

      getSnapshot: (hobbyId) => {
        const { goals, progress, goalByHobby, executionGoalByHobby } = get();
        const skillGoalId = goalByHobby[hobbyId];
        const execGoalId = executionGoalByHobby[hobbyId];
        const goalId = skillGoalId || execGoalId;
        let goal = goalId ? goals[goalId] : null;

        // Self-healing fallback: if the hobby index is stale (e.g. legacy
        // data), find the goal by scanning once, then REPAIR the index so
        // subsequent calls hit the fast path instead of scanning again.
        if (!goal) {
          goal = Object.values(goals).find(g => g.hobby === hobbyId && g.status === 'active') ?? null;
          if (goal) {
            const indexKey = goal.category === 'skill' ? 'goalByHobby' : 'executionGoalByHobby';
            set({ [indexKey]: { ...get()[indexKey], [hobbyId]: goal.id } } as Partial<GoalState>);
          }
        }

        let progressData = goal ? progress[goal.id] : null;
        if (goal && !progressData) {
          progressData = getInitialProgress(goal.id, goal.startingValue);
          set({ progress: { ...get().progress, [goal.id]: progressData } });
        }
        return computeSnapshot(goal, progressData);
      },

      getSnapshotById: (goalId: string) => {
        const { goals, progress } = get();
        let goal: GoalDefinition | null = goals[goalId];
        if (!goal) {
          goal = Object.values(goals).find(g => g.id === goalId) ?? null;
        }
        let progressData = goal ? progress[goal.id] : null;
        if (!goal && progress[goalId]) {
          const stub: GoalDefinition = {
            id: goalId,
            hobby: 'goal' as any,
            type: 'execution_count',
            category: 'execution' as any,
            target: 1,
            deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            startDate: new Date().toISOString().split('T')[0],
            startingValue: 0,
            description: 'Goal',
            status: 'active',
            unitLabel: 'units',
          };
          goal = stub;
          set({ goals: { ...get().goals, [goalId]: stub } });
        }
        if (goal && !progressData) {
          progressData = getInitialProgress(goal.id, goal.startingValue);
          set({ progress: { ...get().progress, [goal.id]: progressData } });
        }
        return computeSnapshot(goal, progressData);
      },

      getActiveSnapshot: () => {
        const { goals, progress } = get();
        const activeGoal = Object.values(goals).find(g => g.status === 'active');
        let progressData = activeGoal ? progress[activeGoal.id] : null;
        if (activeGoal && !progressData) {
          progressData = getInitialProgress(activeGoal.id, activeGoal.startingValue);
          set({ progress: { ...get().progress, [activeGoal.id]: progressData } });
        }
        return computeSnapshot(activeGoal, progressData);
      },

      abandonGoal: (hobbyId) => {
        set(state => {
          const skillGoalId = state.goalByHobby[hobbyId];
          const execGoalId = state.executionGoalByHobby[hobbyId];
          const goalId = skillGoalId || execGoalId;
          const goal = goalId ? state.goals[goalId] : null;
          if (!goal) return state;
          return { goals: { ...state.goals, [goalId]: { ...goal, status: 'abandoned' } } };
        });
      },

      pauseGoal: (goalId) => {
        set(state => {
          const goal = state.goals[goalId];
          if (!goal || goal.status !== 'active') return state;
          return { goals: { ...state.goals, [goalId]: { ...goal, status: 'paused' } } };
        });
      },

      resumeGoal: (goalId) => {
        set(state => {
          const goal = state.goals[goalId];
          if (!goal || goal.status !== 'paused') return state;
          return { goals: { ...state.goals, [goalId]: { ...goal, status: 'active' } } };
        });
      },

      markCompleted: (goalId) => {
        set(state => {
          const goal = state.goals[goalId];
          if (!goal) return state;
          return { goals: { ...state.goals, [goalId]: { ...goal, status: 'completed' } } };
        });
      },

      getActiveGoal: () => {
        const { goals } = get();
        return Object.values(goals).find(g => g.status === 'active') ?? null;
      },

      setMilestones: (goalId, milestones) => {
        set(state => {
          const prog = state.progress[goalId];
          if (!prog) return state;
          return { progress: { ...state.progress, [goalId]: { ...prog, milestones, currentMilestoneIndex: 0, currentMode: 'milestone' } } };
        });
      },

      setMode: (goalId, mode) => {
        set(state => {
          const prog = state.progress[goalId];
          if (!prog) return state;
          return { progress: { ...state.progress, [goalId]: { ...prog, currentMode: mode } } };
        });
      },

      advanceMilestone: (goalId) => {
        set(state => {
          const prog = state.progress[goalId];
          if (!prog) return state;
          const next = Math.min(prog.currentMilestoneIndex + 1, prog.milestones.length - 1);
          const allDone = prog.milestones.every((m, i) => (i === prog.currentMilestoneIndex ? true : m.currentValue >= m.target));
          return { progress: { ...state.progress, [goalId]: { ...prog, currentMilestoneIndex: next, currentMode: (next >= prog.milestones.length || (next === prog.currentMilestoneIndex && allDone)) ? 'tactical' : 'milestone' } } };
        });
      },

      setTroubleshoot: (goalId, blocker) => {
        set(state => {
          const prog = state.progress[goalId];
          if (!prog) return state;
          return { progress: { ...state.progress, [goalId]: { ...prog, currentMode: 'troubleshoot', history: [...prog.history, { date: getTodayString(), value: 0, description: `blocker: ${blocker}`, type: 'bottleneck' as const }] } } };
        });
      },

      setBottleneck: (goalId, bottleneck) => {
        set(state => {
          const prog = state.progress[goalId];
          if (!prog) return state;
          return { progress: { ...state.progress, [goalId]: { ...prog, lastBottleneck: bottleneck } } };
        });
      },
    }),
    {
      name: 'goal-storage',
      storage: createJSONStorage(() => AsyncStorage),
      merge: (persisted, current) => {
        const p = (persisted || {}) as any;
        const c = current;
        return {
          ...c,
          ...p,
          goals: { ...p.goals, ...c.goals },
          progress: { ...p.progress, ...c.progress },
          goalByHobby: { ...(p.goalByHobby || {}), ...(c.goalByHobby || {}) },
          executionGoalByHobby: { ...(p.executionGoalByHobby || {}), ...(c.executionGoalByHobby || {}) },
        };
      },
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        for (const key of Object.keys(state.progress)) {
          const p = state.progress[key];
          if (p.currentMode === undefined) (p as any).currentMode = 'tactical';
          if (!p.milestones) (p as any).milestones = [];
          if (p.currentMilestoneIndex === undefined) (p as any).currentMilestoneIndex = 0;
        }
        if (!(state as any).executionGoalByHobby) (state as any).executionGoalByHobby = {};
      },
    }
  )
);
