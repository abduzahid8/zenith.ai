import { GoalDefinition, GoalProgress, GoalProgressEntry, Milestone } from '../types/goals';

export const DIFFICULTY_STEP = 50;
export const MIN_DIFFICULTY = 100;
export const MAX_DIFFICULTY = 3000;

export interface ProgressResult {
  percentComplete: number;
  projectedCompletion: 'on_track' | 'ahead' | 'behind';
  unitsRemaining: number;
  dailyRateNeeded: number;
  unitLabel: string;
}

export function daysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

function recentActiveDays(history: GoalProgressEntry[]): number {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const cutoffStr = cutoff.toISOString().split('T')[0];
  return new Set(history.filter(h => h.date >= cutoffStr).map(h => h.date)).size;
}

export function rollingVelocity(history: GoalProgressEntry[], covered: number, daysElapsed: number): number {
  const lifetime = covered / daysElapsed;
  const recent = recentActiveDays(history);
  if (daysElapsed >= 7) {
    return lifetime * (recent / 7);
  }
  return lifetime;
}

export interface GoalHandler {
  computeProgress(
    goal: GoalDefinition,
    progress: GoalProgress,
  ): ProgressResult;

  shouldAutoComplete(goal: GoalDefinition, progress: GoalProgress): boolean;

  adjustDifficulty(currentDifficulty: number, result: 'completed_easy' | 'completed_struggled' | 'abandoned' | 'skipped'): number;

  getSessionWeight(step: string): number;

  getDefaultUnitLabel(): string;

  getMilestoneUnit(): string;
}

export const skillHandler: GoalHandler = {
  computeProgress(goal, progress) {
    const currentDiff = progress.currentDifficulty ?? goal.difficultyScore ?? 500;
    const targetDiff = goal.targetDifficulty ?? goal.target;
    const diffCovered = currentDiff - (goal.difficultyScore ?? 500);
    const diffTotal = targetDiff - (goal.difficultyScore ?? 500);
    const percentComplete = diffTotal > 0 ? Math.min(100, Math.round((diffCovered / diffTotal) * 100)) : 0;
    const daysRemaining = Math.max(0, daysBetween(getTodayString(), goal.deadline));
    const daysElapsed = Math.max(1, daysBetween(goal.startDate, getTodayString()));
    const rateActual = rollingVelocity(progress.history, diffCovered, daysElapsed);
    const rateNeeded = daysRemaining > 0 ? (diffTotal - diffCovered) / daysRemaining : 0;
    const projectedCompletion = rateActual >= rateNeeded
      ? (rateActual > rateNeeded ? 'ahead' : 'on_track')
      : 'behind';

    return {
      percentComplete,
      projectedCompletion,
      unitsRemaining: Math.max(0, targetDiff - currentDiff),
      dailyRateNeeded: Math.round(rateNeeded * 10) / 10,
      unitLabel: 'pts',
    };
  },

  shouldAutoComplete(goal, progress) {
    const targetDiff = goal.targetDifficulty ?? goal.target;
    const currentDiff = progress.currentDifficulty ?? goal.difficultyScore ?? 500;
    return currentDiff >= targetDiff;
  },

  adjustDifficulty(current, result) {
    switch (result) {
      case 'completed_easy':
        return Math.min(current + DIFFICULTY_STEP, MAX_DIFFICULTY);
      case 'completed_struggled':
        return Math.max(current - Math.round(DIFFICULTY_STEP / 2), MIN_DIFFICULTY);
      case 'abandoned':
        return Math.max(current - DIFFICULTY_STEP, MIN_DIFFICULTY);
      case 'skipped':
        return Math.max(current - Math.round(DIFFICULTY_STEP / 5), MIN_DIFFICULTY);
    }
  },

  getSessionWeight(step) {
    switch (step) {
      case 'learn': return 1;
      case 'do': return 2;
      case 'deepen1': return 3;
      case 'deepen2': return 4;
      default: return 1;
    }
  },

  getDefaultUnitLabel() {
    return 'pts';
  },

  getMilestoneUnit() {
    return 'pts';
  },
};

export const executionHandler: GoalHandler = {
  computeProgress(goal, progress) {
    const totalToCover = goal.target - goal.startingValue;
    const covered = progress.currentValue - goal.startingValue;
    const percentComplete = totalToCover > 0 ? Math.min(100, Math.round((covered / totalToCover) * 100)) : 0;
    const daysRemaining = Math.max(0, daysBetween(getTodayString(), goal.deadline));
    const daysElapsed = Math.max(1, daysBetween(goal.startDate, getTodayString()));
    const rateActual = rollingVelocity(progress.history, covered, daysElapsed);
    const rateNeeded = daysRemaining > 0 ? (totalToCover - covered) / daysRemaining : 0;
    const projectedCompletion = rateActual >= rateNeeded
      ? (rateActual > rateNeeded ? 'ahead' : 'on_track')
      : 'behind';

    return {
      percentComplete,
      projectedCompletion,
      unitsRemaining: Math.max(0, totalToCover - covered),
      dailyRateNeeded: Math.round(rateNeeded * 10) / 10,
      unitLabel: goal.unitLabel || 'units',
    };
  },

  shouldAutoComplete(goal, progress) {
    return progress.currentValue >= goal.target;
  },

  adjustDifficulty(current, _result) {
    return current;
  },

  getSessionWeight(_step) {
    return 1;
  },

  getDefaultUnitLabel() {
    return 'units';
  },

  getMilestoneUnit() {
    return 'units';
  },
};

export function getHandler(category: string): GoalHandler {
  return category === 'execution' ? executionHandler : skillHandler;
}
