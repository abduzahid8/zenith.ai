import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { scale } from '../constants';
import { fonts } from '../theme';
import { useAppTheme } from '../theme/useAppTheme';
import { useGoalStore, getInitialProgress } from '../store/goalStore';
import { GoalSnapshot, GoalDefinition, GoalProgress, GoalCategory } from '../types/goals';
import { ProgressRing, ActivitySparkline, StatusPill, statusVisuals, MilestoneTimelineDetailed } from '../components/goal/shared';
import { DailyGoalCard } from '../components/goal/DailyGoalCard';
import { GoalCheckinCard } from '../components/goal/GoalCheckinCard';

// ── Main Screen ───────────────────────────────────────────
export default function GoalDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const goalId = params.goalId as string;
  const hobbyFallback = params.hobbyId as string | undefined;
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const goals = useGoalStore(s => s.goals);
  const progressRecords = useGoalStore(s => s.progress);

  const [showMenu, setShowMenu] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [snapshotOverride, setSnapshotOverride] = useState<GoalSnapshot | null>(null);

  // Retry if no goal resolved yet (for Zustand rehydration timing)
  useEffect(() => {
    if (!goals[goalId] && !hobbyFallback && !Object.values(goals).find(g => g.status === 'active')) {
      if (retryCount < 3) {
        const t = setTimeout(() => setRetryCount(c => c + 1), 500);
        return () => clearTimeout(t);
      }
    }
  }, [goalId, hobbyFallback, goals, retryCount]);

  // Resolve the correct goal with multi-layer fallback (pure, no side-effects)
  const resolved = useMemo<{ goal: GoalDefinition; progress: GoalProgress } | null>(() => {
    let g = goals[goalId] || Object.values(goals).find(g => g.id === goalId) || null;
    if (g) {
      const p = progressRecords[g.id] || getInitialProgress(g.id, g.startingValue);
      return { goal: g, progress: p };
    }
    if (progressRecords[goalId]) {
      const stub: GoalDefinition = {
        id: goalId, hobby: (hobbyFallback || 'goal') as any, type: 'execution_count',
        category: 'execution' as GoalCategory, target: 1,
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        startDate: new Date().toISOString().split('T')[0],
        startingValue: 0, description: 'Goal', status: 'active' as const, unitLabel: 'units',
      };
      useGoalStore.getState().setGoal(stub);
      return { goal: stub, progress: progressRecords[goalId] };
    }
    if (hobbyFallback) {
      const snap = useGoalStore.getState().getSnapshot(hobbyFallback as any);
      if (snap) return { goal: snap.definition, progress: snap.progress };
    }
    const active = Object.values(goals).find(g => g.status === 'active');
    if (active) {
      const p = progressRecords[active.id] || getInitialProgress(active.id, active.startingValue);
      return { goal: active, progress: p };
    }
    return null;
  }, [goalId, hobbyFallback, goals, progressRecords]);

  // Compute snapshot from resolved goal (overridable by GoalCheckinCard refreshes)
  const computedSnapshot: GoalSnapshot | null = useMemo(() => {
    if (!resolved || !resolved.progress) return null;
    return useGoalStore.getState().getSnapshotById(resolved.goal.id);
  }, [resolved]);

  const snapshot = snapshotOverride ?? computedSnapshot;

  useEffect(() => { setSnapshotOverride(null); }, [resolved?.goal.id]);

  // ── Guard: no goal found at all ──
  if (!resolved) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={styles.emptyText}>Goal not found</Text>
        <Text style={[styles.emptyText, { fontSize: scale(12), opacity: 0.6, marginTop: 8 }]}>
          No goal matches this link. Create a new one to get started.
        </Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go back</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.backBtn, { marginTop: 12 }]} onPress={() => router.replace(`/goal-setup${hobbyFallback ? `?hobbyId=${hobbyFallback}` : ''}` as any)}>
          <Text style={styles.backBtnText}>Create new goal</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!snapshot) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={styles.emptyText}>Goal progress not found</Text>
        <Text style={[styles.emptyText, { fontSize: scale(12), opacity: 0.6, marginTop: 8 }]}>
          This goal exists but has no progress data. It may be corrupted.
        </Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const { goal, progress } = { goal: snapshot.definition, progress: snapshot.progress };
  const isSkill = goal.category === 'skill';
  const { color: statusColor } = statusVisuals(snapshot.projectedCompletion);

  // ── Handlers ──────────────────────────────────────────
  const handleAbandon = () => {
    Alert.alert('Abandon goal?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Abandon', style: 'destructive', onPress: () => {
          useGoalStore.getState().abandonGoal(goal.hobby);
          router.back();
        }
      },
    ]);
  };

  const handlePause = () => {
    useGoalStore.getState().pauseGoal(goal.id);
    setSnapshotOverride(useGoalStore.getState().getSnapshotById(goal.id));
  };

  const handleResume = () => {
    useGoalStore.getState().resumeGoal(goal.id);
    setSnapshotOverride(useGoalStore.getState().getSnapshotById(goal.id));
  };

  // ── Render ────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{goal.description}</Text>
        <TouchableOpacity onPress={() => setShowMenu(!showMenu)} activeOpacity={0.7}>
          <Text style={styles.menuDots}>•••</Text>
        </TouchableOpacity>
      </View>

      {/* Dropdown menu */}
      {showMenu && (
        <View style={styles.dropdown}>
          <TouchableOpacity style={styles.dropdownItem} onPress={() => { setShowMenu(false); router.push(`/goal-setup?edit=${goal.id}${goal.hobby ? `&hobbyId=${goal.hobby}` : ''}` as any); }}>
            <Text style={styles.dropdownItemText}>✎ Edit</Text>
          </TouchableOpacity>
          {goal.status === 'active' ? (
            <TouchableOpacity style={styles.dropdownItem} onPress={() => { setShowMenu(false); handlePause(); }}>
              <Text style={styles.dropdownItemText}>⏸ Pause</Text>
            </TouchableOpacity>
          ) : goal.status === 'paused' ? (
            <TouchableOpacity style={styles.dropdownItem} onPress={() => { setShowMenu(false); handleResume(); }}>
              <Text style={styles.dropdownItemText}>▶ Resume</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.dropdownItem} onPress={() => { setShowMenu(false); handleAbandon(); }}>
            <Text style={[styles.dropdownItemText, { color: '#EF4444' }]}>✕ Abandon</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Status bar */}
        <View style={styles.statusBar}>
          <StatusPill projectedCompletion={snapshot.projectedCompletion} />
          <View style={[styles.statusPill, { backgroundColor: colors.surfaceLight, borderColor: colors.border }]}>
            <Text style={[styles.statusPillText, { color: colors.textSecondary }]}>{goal.status}</Text>
          </View>
        </View>

        {/* Progress hero */}
        <View style={styles.heroSection}>
          {isSkill ? (
            <>
              <ProgressRing percent={snapshot.percentComplete} size={scale(110)} strokeWidth={8} color={statusColor} />
              <View style={styles.heroStats}>
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatValue}>{progress.currentDifficulty ?? goal.difficultyScore ?? 500}</Text>
                  <Text style={styles.heroStatLabel}>current</Text>
                </View>
                <View style={styles.heroStat}>
                  <Text style={[styles.heroStatValue, { color: statusColor }]}>{goal.targetDifficulty ?? goal.target}</Text>
                  <Text style={styles.heroStatLabel}>target</Text>
                </View>
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatValue}>{snapshot.daysRemaining}</Text>
                  <Text style={styles.heroStatLabel}>days left</Text>
                </View>
              </View>
            </>
          ) : (
            <View style={styles.executionHero}>
              <View style={styles.executionCountdown}>
                <Text style={styles.countdownBig}>{Math.max(0, goal.target - progress.currentValue)}</Text>
                <Text style={styles.countdownUnit}>{goal.unitLabel || 'units'} to go</Text>
                <Text style={styles.countdownPace}>
                  {progress.currentValue}/{goal.target} · {snapshot.dailyRateNeeded}/day needed
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Stats bar */}
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>🔥 {progress.streak}</Text>
            <Text style={styles.statLabel}>day streak</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{progress.velocityTrend?.toFixed(1) ?? '-'}</Text>
            <Text style={styles.statLabel}>{isSkill ? 'pts/day' : `${goal.unitLabel || 'units'}/day`}</Text>
          </View>
          <View style={styles.statItem}>
            <ActivitySparkline history={progress.history} color={statusColor} dotSize={10} />
            <Text style={styles.statLabel}>activity</Text>
          </View>
        </View>

        {/* Daily coaching card — shown for skill goals only, since
            execution goals already show their goal-aware prompt in
            GoalCheckinCard below (avoid duplicating the same call to action). */}
        {isSkill && goal.status === 'active' && (
          <DailyGoalCard
            snapshot={snapshot}
            colors={colors}
            onRefresh={(next) => setSnapshotOverride(next)}
          />
        )}

        {/* Milestones timeline */}
        {progress.milestones.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Phases</Text>
            <MilestoneTimelineDetailed milestones={progress.milestones} currentIndex={progress.currentMilestoneIndex} colors={colors} />
          </View>
        )}

        {/* Unified check-in card (execution goals, active only) — same component YourTasksScreen uses */}
        {!isSkill && goal.status === 'active' && (
          <GoalCheckinCard
            snapshot={snapshot}
            colors={colors}
            onRefresh={(next) => setSnapshotOverride(next)}
          />
        )}

        {/* Skill actions */}
        {isSkill && goal.status === 'active' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Progress</Text>
            <Text style={styles.sectionDesc}>
              Your difficulty adjusts automatically as you complete lessons. Keep practicing to raise your score.
            </Text>
            <Text style={styles.sectionHint}>
              Mode: {progress.currentMode === 'milestone' ? 'Planning' : progress.currentMode === 'tactical' ? 'Daily push' : 'Troubleshooting'}
            </Text>
          </View>
        )}

        {/* History */}
        {progress.history.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Activity log</Text>
            {progress.history.slice(-20).reverse().map((entry, i) => {
              const isCheckin = entry.type === 'checkin';
              const isBottleneck = entry.type === 'bottleneck';
              const isDifficulty = entry.description?.startsWith('difficulty:');
              return (
                <View key={i} style={styles.historyRow}>
                  <Text style={styles.historyDate}>{entry.date?.slice(5) || ''}</Text>
                  <Text style={styles.historyDesc} numberOfLines={1}>
                    {isDifficulty ? entry.description
                      : isCheckin ? `${entry.value} ${goal.unitLabel || 'units'}`
                        : isBottleneck ? `Blocker: ${entry.description?.replace('blocker: ', '')}`
                          : entry.description || `+${entry.value}`}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Completion state */}
        {goal.status === 'completed' && (
          <View style={styles.completedBanner}>
            <Text style={styles.completedEmoji}>🎉</Text>
            <Text style={styles.completedTitle}>Goal complete!</Text>
            <Text style={styles.completedDesc}>
              {progress.currentValue} / {goal.target} {goal.unitLabel || 'pts'} in {progress.dailyActions} sessions
            </Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/goal-setup')}>
              <Text style={styles.primaryBtnText}>Set a new goal</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Paused state */}
        {goal.status === 'paused' && (
          <View style={styles.pausedBanner}>
            <Text style={styles.pausedTitle}>⏸ Paused</Text>
            <Text style={styles.pausedDesc}>Your goal is on hold. Resume anytime.</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleResume}>
              <Text style={styles.primaryBtnText}>Resume</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────
const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingBottom: scale(48) },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: scale(20), paddingVertical: scale(12),
    borderBottomWidth: 1, borderBottomColor: colors.surfaceLight,
  },
  backArrow: { fontSize: scale(24), color: colors.text },
  headerTitle: { fontFamily: fonts.heading.bold, fontSize: scale(16), color: colors.text, flex: 1, marginHorizontal: scale(12) },
  menuDots: { fontSize: scale(20), color: colors.textSecondary },
  dropdown: {
    position: 'absolute', top: scale(56), right: scale(20), zIndex: 100,
    backgroundColor: colors.surface, borderRadius: scale(12), borderWidth: 1, borderColor: colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 8,
  },
  dropdownItem: { paddingHorizontal: scale(16), paddingVertical: scale(12), borderBottomWidth: 1, borderBottomColor: colors.surfaceLight },
  dropdownItemText: { fontFamily: fonts.body.regular, fontSize: scale(14), color: colors.text },
  emptyText: { fontFamily: fonts.heading.bold, fontSize: scale(18), color: colors.textSecondary, marginBottom: scale(16) },
  backBtn: { paddingHorizontal: scale(24), paddingVertical: scale(12), backgroundColor: colors.buttonPrimary, borderRadius: scale(24) },
  backBtnText: { fontFamily: fonts.heading.bold, fontSize: scale(14), color: '#FFF' },

  statusBar: { flexDirection: 'row', gap: scale(8), paddingHorizontal: scale(20), paddingTop: scale(12) },
  statusPill: { borderRadius: scale(12), borderWidth: 1, paddingHorizontal: scale(10), paddingVertical: scale(4) },
  statusPillText: { fontFamily: fonts.heading.bold, fontSize: scale(12) },

  heroSection: { flexDirection: 'row', alignItems: 'center', padding: scale(20), gap: scale(20) },
  heroStats: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  heroStat: { alignItems: 'center' },
  heroStatValue: { fontFamily: fonts.heading.bold, fontSize: scale(24), color: colors.text },
  heroStatLabel: { fontFamily: fonts.body.regular, fontSize: scale(12), color: colors.textSecondary, marginTop: scale(2) },

  executionHero: { flex: 1, alignItems: 'center' },
  executionCountdown: { alignItems: 'center' },
  countdownBig: { fontFamily: fonts.heading.bold, fontSize: scale(48), color: colors.text },
  countdownUnit: { fontFamily: fonts.body.regular, fontSize: scale(14), color: colors.textSecondary, marginTop: scale(4) },
  countdownPace: { fontFamily: fonts.body.regular, fontSize: scale(12), color: colors.textSecondary, marginTop: scale(8) },

  statsBar: {
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    paddingVertical: scale(12), marginHorizontal: scale(20), backgroundColor: colors.surface,
    borderRadius: scale(12), marginBottom: scale(16),
  },
  statItem: { alignItems: 'center' },
  statValue: { fontFamily: fonts.heading.bold, fontSize: scale(16), color: colors.text },
  statLabel: { fontFamily: fonts.body.regular, fontSize: scale(10), color: colors.textSecondary, marginTop: scale(2) },

  section: { paddingHorizontal: scale(20), marginBottom: scale(20) },
  sectionTitle: { fontFamily: fonts.heading.bold, fontSize: scale(16), color: colors.text, marginBottom: scale(12) },
  sectionDesc: { fontFamily: fonts.body.regular, fontSize: scale(13), color: colors.textSecondary, lineHeight: scale(18) },
  sectionHint: { fontFamily: fonts.body.regular, fontSize: scale(12), color: colors.textSecondary, marginTop: scale(8) },

  historyRow: {
    flexDirection: 'row', gap: scale(12), paddingVertical: scale(8),
    borderBottomWidth: 1, borderBottomColor: colors.surfaceLight,
  },
  historyDate: { fontFamily: fonts.body.regular, fontSize: scale(12), color: colors.textSecondary, width: scale(40) },
  historyDesc: { fontFamily: fonts.body.regular, fontSize: scale(13), color: colors.text, flex: 1 },

  completedBanner: { alignItems: 'center', padding: scale(24), marginHorizontal: scale(20), backgroundColor: '#10B98115', borderRadius: scale(16), borderWidth: 1, borderColor: '#10B981', marginBottom: scale(16) },
  completedEmoji: { fontSize: scale(48), marginBottom: scale(8) },
  completedTitle: { fontFamily: fonts.heading.bold, fontSize: scale(20), color: '#10B981', marginBottom: scale(4) },
  completedDesc: { fontFamily: fonts.body.regular, fontSize: scale(14), color: colors.textSecondary, textAlign: 'center', marginBottom: scale(16) },

  pausedBanner: { alignItems: 'center', padding: scale(24), marginHorizontal: scale(20), backgroundColor: colors.surfaceLight, borderRadius: scale(16), borderWidth: 1, borderColor: colors.border, marginBottom: scale(16) },
  pausedTitle: { fontFamily: fonts.heading.bold, fontSize: scale(20), color: colors.textSecondary, marginBottom: scale(4) },
  pausedDesc: { fontFamily: fonts.body.regular, fontSize: scale(14), color: colors.textSecondary, textAlign: 'center', marginBottom: scale(16) },

  primaryBtn: { backgroundColor: colors.buttonPrimary, borderRadius: scale(24), paddingHorizontal: scale(24), paddingVertical: scale(12) },
  primaryBtnText: { fontFamily: fonts.heading.bold, fontSize: scale(14), color: '#FFF' },
});
