import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { scale } from '../../constants';
import { fonts } from '../../theme';
import { useAppTheme } from '../../theme/useAppTheme';
import { GoalSnapshot } from '../../types/goals';
import { ProgressRing, ActivitySparkline, StatusPill, statusVisuals, MilestoneTimelineCompact } from './shared';

interface GoalProgressBarProps {
  snapshot: GoalSnapshot;
  onEdit?: () => void;
  onPress?: () => void;
}

export const GoalProgressBar: React.FC<GoalProgressBarProps> = ({ snapshot, onEdit, onPress }) => {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { definition, progress, percentComplete, daysRemaining, projectedCompletion, dailyRateNeeded } = snapshot;

  const { color: statusColor } = statusVisuals(projectedCompletion);
  const isSkill = definition.category === 'skill';

  // ── Skill card ─────────────────────────────────────────
  if (isSkill) {
    const currentDiff = progress.currentDifficulty ?? definition.difficultyScore ?? 500;
    const targetDiff = definition.targetDifficulty ?? definition.target;

    const card = (
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.goalText} numberOfLines={1}>{definition.description}</Text>
          {onEdit && (
            <TouchableOpacity onPress={onEdit} activeOpacity={0.6} style={styles.editBtn}>
              <Text style={styles.editBtnText}>✎</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.body}>
          <ProgressRing percent={percentComplete} size={scale(80)} strokeWidth={6} color={statusColor} />
          <View style={styles.bodyStats}>
            <View style={styles.statRow}>
              <Text style={styles.statBig}>{currentDiff}</Text>
              <Text style={styles.statLabel}>current</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={[styles.statBig, { color: statusColor }]}>{targetDiff}</Text>
              <Text style={styles.statLabel}>target</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statBig}>{daysRemaining}</Text>
              <Text style={styles.statLabel}>days</Text>
            </View>
          </View>
        </View>

        <View style={styles.sparkSection}>
          <Text style={styles.sectionLabel}>Activity</Text>
          <ActivitySparkline history={progress.history} color={colors.buttonPrimary} trackColor={colors.surfaceLight} />
          <Text style={styles.streakText}>{progress.streak > 0 ? `🔥 ${progress.streak} day streak` : ''}</Text>
        </View>

        <View style={styles.footer}>
          <StatusPill projectedCompletion={projectedCompletion} />
          <Text style={styles.rateText}>{dailyRateNeeded} pts/day needed</Text>
        </View>
      </View>
    );

    return onPress ? <TouchableOpacity onPress={onPress} activeOpacity={0.8}>{card}</TouchableOpacity> : card;
  }

  // ── Execution card ──────────────────────────────────────
  const unit = definition.unitLabel || 'units';
  const hasMilestones = progress.milestones && progress.milestones.length > 0;

  const execCard = (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.goalText} numberOfLines={1}>{definition.description}</Text>
        {onEdit && (
          <TouchableOpacity onPress={onEdit} activeOpacity={0.6} style={styles.editBtn}>
            <Text style={styles.editBtnText}>✎</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.body}>
        <View style={styles.countdownBlock}>
          <Text style={styles.countdownValue}>{Math.max(0, definition.target - progress.currentValue)}</Text>
          <Text style={styles.countdownLabel}>{unit} to go</Text>
        </View>
        <View style={styles.countdownBlock}>
          <Text style={styles.countdownValue}>{daysRemaining}</Text>
          <Text style={styles.countdownLabel}>days left</Text>
        </View>
        <View style={styles.countdownBlock}>
          <Text style={[styles.countdownValue, { color: statusColor }]}>{progress.velocityTrend?.toFixed(1) ?? '-'}</Text>
          <Text style={styles.countdownLabel}>per day</Text>
        </View>
      </View>

      {hasMilestones && (
        <View style={styles.timeline}>
          <MilestoneTimelineCompact milestones={progress.milestones} currentIndex={progress.currentMilestoneIndex} colors={colors} />
        </View>
      )}

      <Text style={styles.modeText}>
        Mode: {progress.currentMode === 'milestone' ? 'Planning' : progress.currentMode === 'tactical' ? 'Daily push' : progress.currentMode === 'tools' ? 'Bottleneck' : 'Troubleshooting'}
      </Text>

      {progress.lastBottleneck && (
        <View style={styles.bottleneckBadge}>
          <Text style={styles.bottleneckLabel}>{progress.lastBottleneck.label}</Text>
        </View>
      )}

      <View style={styles.footer}>
        <StatusPill projectedCompletion={projectedCompletion} />
        <Text style={styles.rateText}>
          {progress.currentValue}/{definition.target} · {dailyRateNeeded}/{unit}/day
        </Text>
      </View>
    </View>
  );

  return onPress ? <TouchableOpacity onPress={onPress} activeOpacity={0.8}>{execCard}</TouchableOpacity> : execCard;
};

// ── Styles ────────────────────────────────────────────────
const createStyles = (colors: any) => StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: scale(16),
    padding: scale(16),
    marginHorizontal: scale(20),
    marginVertical: scale(8),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: scale(14) },
  goalText: { fontFamily: fonts.heading.bold, fontSize: scale(15), color: colors.text, flex: 1 },
  editBtn: { paddingLeft: scale(12), paddingVertical: scale(4) },
  editBtnText: { fontSize: scale(18), color: colors.primary },

  body: { flexDirection: 'row', alignItems: 'center', marginBottom: scale(14), gap: scale(16) },
  bodyStats: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  statRow: { alignItems: 'center' },
  statBig: { fontFamily: fonts.heading.bold, fontSize: scale(22), color: colors.text },
  statLabel: { fontFamily: fonts.body.regular, fontSize: scale(11), color: colors.textSecondary, marginTop: scale(2) },

  sparkSection: { flexDirection: 'row', alignItems: 'center', gap: scale(8), marginBottom: scale(12) },
  sectionLabel: { fontFamily: fonts.body.regular, fontSize: scale(11), color: colors.textSecondary },
  streakText: { fontFamily: fonts.heading.bold, fontSize: scale(12), color: '#F59E0B', marginLeft: 'auto' },

  countdownBlock: { flex: 1, alignItems: 'center' },
  countdownValue: { fontFamily: fonts.heading.bold, fontSize: scale(26), color: colors.text },
  countdownLabel: { fontFamily: fonts.body.regular, fontSize: scale(11), color: colors.textSecondary, marginTop: scale(2) },

  timeline: { marginBottom: scale(12) },

  modeText: { fontFamily: fonts.body.regular, fontSize: scale(11), color: colors.textSecondary, textAlign: 'center', marginBottom: scale(8) },

  bottleneckBadge: { alignSelf: 'center', backgroundColor: '#F59E0B20', borderRadius: scale(8), borderWidth: 1, borderColor: '#F59E0B', paddingHorizontal: scale(10), paddingVertical: scale(4), marginBottom: scale(8) },
  bottleneckLabel: { fontFamily: fonts.heading.bold, fontSize: scale(11), color: '#F59E0B' },

  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: scale(4) },
  rateText: { fontFamily: fonts.body.regular, fontSize: scale(11), color: colors.textSecondary },
});

export default GoalProgressBar;
