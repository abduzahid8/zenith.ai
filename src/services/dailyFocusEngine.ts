import { GoalDefinition, GoalProgress } from '../types/goals';
import { daysBetween } from './goalHandlers';

export type DailyFocus =
  | 'onboard'
  | 'recover_streak'
  | 'consolidate'
  | 'push'
  | 'celebrate_milestone'
  | 'unblock'
  | 'steady';

export interface DailyFocusResult {
  focus: DailyFocus;
  reason: string;
}

/**
 * Pure function that reads real user signals — streak, gaps, difficulty
 * trend, milestone crossings, blocker flags — and picks a content strategy
 * for today.  Each strategy changes *what* the daily learn/do prompt
 * emphasises so the user doesn't get the same generic "keep showing up"
 * every single day.
 *
 * Returns a stable default ('steady') for most days so the system doesn't
 * over-rotate on transient variance.
 */
export function computeDailyFocus(params: {
  goal: GoalDefinition;
  progress: GoalProgress;
  todayStr: string;
}): DailyFocusResult {
  const { goal, progress, todayStr } = params;
  const { dailyActions, streak, history, currentMode, currentMilestoneIndex, milestones, yesterdayCommitment, yesterdayCommitmentHonored } = progress;

  // 1. Onboard — first ever daily action
  if (dailyActions === 0 && history.length === 0) {
    return { focus: 'onboard', reason: 'Your first day — let\'s build a simple, repeatable habit.' };
  }

  // 2. Recover streak — no check-in for ≥3 days
  const lastEntry = history[history.length - 1];
  if (lastEntry) {
    const daysSinceLastActive = daysBetween(lastEntry.date, todayStr);
    if (daysSinceLastActive >= 3) {
      return { focus: 'recover_streak', reason: `You haven't logged progress in ${daysSinceLastActive} days — start small to rebuild momentum.` };
    }
  }

  // 3. Unblock — behind pace or flagged blocker
  if (currentMode === 'tools' || currentMode === 'troubleshoot') {
    return {
      focus: 'unblock',
      reason: currentMode === 'troubleshoot' ? 'A blocker was flagged — let\'s clear it.' : 'Pace is falling behind — try a new approach.',
    };
  }

  // 4. Celebrate milestone — just crossed one (within the last 2 days)
  if (milestones.length > 0 && currentMilestoneIndex > 0) {
    const prevMilestone = milestones[currentMilestoneIndex - 1];
    if (prevMilestone && prevMilestone.currentValue >= prevMilestone.target) {
      const milestoneHit = [...history].reverse().find(h => h.value >= prevMilestone.target);
      if (!milestoneHit || daysBetween(milestoneHit.date, todayStr) <= 2) {
        return { focus: 'celebrate_milestone', reason: `You just hit "${prevMilestone.label}" — nice work! Let's set up the next phase.` };
      }
    }
  }

  // 5. Push — strong streak, time to challenge harder
  if (streak >= 5) {
    return { focus: 'push', reason: `${streak}-day streak — you're in a groove. Time to push a little further.` };
  }

  // 6. Consolidate — skill: last session was a struggle
  if (goal.category === 'skill') {
    const lastDifficultyEntry = [...history].reverse().find(h => h.type === 'task' && h.description?.startsWith('difficulty:'));
    if (lastDifficultyEntry?.description?.includes('completed_struggled')) {
      return { focus: 'consolidate', reason: 'Last session was tough — let\'s reinforce the foundation before moving ahead.' };
    }
  }

  // 7. Consolidate — yesterday's commitment wasn't honoured
  if (yesterdayCommitment && yesterdayCommitmentHonored === false) {
    return { focus: 'consolidate', reason: 'Yesterday\'s commitment was missed — scale back and get a win today.' };
  }

  // 8. Default: steady tactical
  return { focus: 'steady', reason: 'Keep showing up — consistency compounds.' };
}
