import { useState, useEffect, useCallback, useRef } from 'react';
import { useGoalStore } from '../store/goalStore';
import { GoalSnapshot, GoalProgress, DailyGoalContent, HelpMode } from '../types/goals';
import { deriveDailyTile } from '../services/goalPlanService';
import { HobbyId } from '../data/lessonContent';

export interface GoalCardActions {
  checkIn: (value: number, description?: string) => void;
  commit: (raw: string) => void;
  edit: () => void;
  pause: () => void;
  resume: () => void;
}

export interface GoalCardState {
  snapshot: GoalSnapshot | null;
  liveProgress: GoalProgress | null;
  mode: HelpMode;
  todayTile: ReturnType<typeof deriveDailyTile> | null;
  dailyContent: DailyGoalContent | null;
  contentLoading: boolean;
  actions: GoalCardActions;
}

export function useGoalCardState(goalId: string | undefined): GoalCardState {
  const goals = useGoalStore(s => s.goals);
  const progressRecords = useGoalStore(s => s.progress);
  const getSnapshotById = useGoalStore(s => s.getSnapshotById);

  const [dailyContent, setDailyContent] = useState<DailyGoalContent | null>(null);
  const [contentLoading, setContentLoading] = useState(true);
  const cancelledRef = useRef(false);

  // Resolve snapshot (self-healing like getSnapshotById)
  const snapshot: GoalSnapshot | null = goalId ? getSnapshotById(goalId) : null;
  const liveProgress: GoalProgress | null = goalId && progressRecords[goalId]
    ? progressRecords[goalId]
    : null;

  const mode: HelpMode = liveProgress?.currentMode ?? 'tactical';

  // Derive today's tile from the user's plan
  const todayTile = snapshot && liveProgress?.planOfAttack
    ? deriveDailyTile(
        liveProgress.planOfAttack,
        snapshot.definition,
        liveProgress.currentValue,
        snapshot.daysRemaining,
      )
    : null;

  // Load daily content
  useEffect(() => {
    if (!goalId) return;
    cancelledRef.current = false;
    setContentLoading(true);
    useGoalStore.getState().getOrGenerateDailyContent(goalId).then((c) => {
      if (!cancelledRef.current) {
        setDailyContent(c);
        setContentLoading(false);
      }
    });
    return () => { cancelledRef.current = true; };
  }, [goalId]);

  const refresh = useCallback(() => {
    if (!goalId) return;
    useGoalStore.getState().getSnapshotById(goalId);
  }, [goalId]);

  const actions: GoalCardActions = {
    checkIn: useCallback((value, description) => {
      if (!goalId || !snapshot) return;
      useGoalStore.getState().recordCheckin(value, description || `checkin: ${value}`, undefined, snapshot.definition.hobby);
      refresh();
    }, [goalId, snapshot, refresh]),

    commit: useCallback((raw) => {
      if (!goalId || !snapshot) return;
      const store = useGoalStore.getState();
      store.setCommitment(goalId, raw);
      store.recordCheckin(
        (progressRecords[goalId]?.currentValue ?? snapshot.progress.currentValue),
        `commit: ${raw}`,
        undefined,
        snapshot.definition.hobby,
      );
      refresh();
    }, [goalId, snapshot, progressRecords, refresh]),

    edit: useCallback(() => {
      // Navigation handled by the screen, not the hook
    }, []),

    pause: useCallback(() => {
      if (!goalId) return;
      useGoalStore.getState().pauseGoal(goalId);
    }, [goalId]),

    resume: useCallback(() => {
      if (!goalId) return;
      useGoalStore.getState().resumeGoal(goalId);
    }, [goalId]),
  };

  return {
    snapshot,
    liveProgress,
    mode,
    todayTile,
    dailyContent,
    contentLoading,
    actions,
  };
}
