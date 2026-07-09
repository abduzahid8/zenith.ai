import { GoalDefinition, GoalProgress, GoalProgressEntry, HelpMode } from '../types/goals';

// EXPECTED_SESSIONS_TO_TARGET is the assumed number of practice sessions
// it should take an average user to go from their starting difficulty to
// their target. We use it to size each per-lesson adjustment proportionally
// to the goal's own range, instead of a fixed step that was too small for
// big ranges (e.g. chess 400->1200) and too big for small ones (e.g. 0->100).
const EXPECTED_SESSIONS_TO_TARGET = 40;
const MIN_STEP = 5;
const MAX_STEP = 200;

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

/**
 * Computes the step size (in difficulty points) for a single lesson result,
 * scaled to this specific goal's range so a small goal and a huge goal each
 * feel like they take a sensible number of sessions.
 */
export function stepSizeForGoal(goal: GoalDefinition): number {
  const start = goal.difficultyScore ?? 500;
  const target = goal.targetDifficulty ?? goal.target;
  const range = Math.abs(target - start) || 1;
  const raw = Math.round(range / EXPECTED_SESSIONS_TO_TARGET);
  return Math.min(MAX_STEP, Math.max(MIN_STEP, raw));
}

/**
 * Pure, testable mode-transition function for execution goals.
 *
 * Rules (checked in order):
 * 1. Once in 'troubleshoot', stay there until the user has logged at least
 *    one check-in *after* the blocker entry (i.e. they came back and acted
 *    on the advice) — otherwise drop back to 'tactical'.
 * 2. Otherwise, only escalate to 'tools' (behind-pace help) once we have
 *    enough history (>= MIN_ACTIONS_BEFORE_PACE_CHECK check-ins) to trust
 *    the pace signal — a single slow day shouldn't trigger it.
 * 3. Default: 'tactical' (the day-to-day commit-and-log loop).
 */
const MIN_ACTIONS_BEFORE_PACE_CHECK = 3;

export function computeNextMode(params: {
  currentMode: HelpMode;
  isBehind: boolean;
  dailyActions: number;
  history: GoalProgressEntry[];
}): HelpMode {
  const { currentMode, isBehind, dailyActions, history } = params;

  if (currentMode === 'troubleshoot') {
    const reversedIdx = [...history].reverse().findIndex(h => h.type === 'bottleneck');
    // reversedIdx === 0 means the blocker entry is the most recent entry
    // (no follow-up yet). Anything > 0 means something newer exists.
    const hasFollowedUpSinceBlocker = reversedIdx > 0;
    return hasFollowedUpSinceBlocker ? 'tactical' : 'troubleshoot';
  }

  if (isBehind && dailyActions >= MIN_ACTIONS_BEFORE_PACE_CHECK) {
    return 'tools';
  }

  return 'tactical';
}

export interface GoalHandler {
  computeProgress(
    goal: GoalDefinition,
    progress: GoalProgress,
  ): ProgressResult;

  shouldAutoComplete(goal: GoalDefinition, progress: GoalProgress): boolean;

  adjustDifficulty(
    goal: GoalDefinition,
    currentDifficulty: number,
    result: 'completed_easy' | 'completed_struggled' | 'abandoned' | 'skipped',
  ): number;

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

  adjustDifficulty(goal, current, result) {
    const step = stepSizeForGoal(goal);
    switch (result) {
      case 'completed_easy':
        return Math.min(current + step, MAX_DIFFICULTY);
      case 'completed_struggled':
        return Math.max(current - Math.round(step / 2), MIN_DIFFICULTY);
      case 'abandoned':
        return Math.max(current - step, MIN_DIFFICULTY);
      case 'skipped':
        return Math.max(current - Math.round(step / 5), MIN_DIFFICULTY);
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

  adjustDifficulty(_goal, current, _result) {
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
