import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { scale } from '../../constants';
import { fonts } from '../../theme';
import { useAppTheme } from '../../theme/useAppTheme';
import { GoalSnapshot, HelpMode } from '../../types/goals';
import { useGoalCardState } from '../../hooks/useGoalCardState';

const MODE_ACCENT: Record<HelpMode, string> = {
  milestone: '#6366F1',
  tactical: '#059669',
  tools: '#D97706',
  troubleshoot: '#DC2626',
};

interface GoalProgressBarProps {
  snapshot: GoalSnapshot;
  onEdit?: () => void;
  onPress?: () => void;
}

export const GoalProgressBar: React.FC<GoalProgressBarProps> = ({ snapshot, onEdit, onPress }) => {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { definition, progress, daysRemaining } = snapshot;
  const cardState = useGoalCardState(snapshot.definition.id);

  const liveProgress = cardState.liveProgress ?? progress;
  const isSkill = definition.category === 'skill';
  const mode = liveProgress.currentMode;
  const accent = MODE_ACCENT[mode] ?? MODE_ACCENT.tactical;
  const currentVal = isSkill ? (liveProgress.currentDifficulty ?? definition.difficultyScore ?? 500) : liveProgress.currentValue;
  const targetVal = isSkill ? (definition.targetDifficulty ?? definition.target) : definition.target;
  const remaining = Math.max(0, targetVal - currentVal);
  // ONE Goal Progress authority: the canonical snapshot percent (handler
  // math with the starting-value offset). Never recompute current/target
  // here — that duplicate disagrees with Weekly Plan whenever
  // startingValue != 0. Clamped for display only.
  const barPercent = Math.min(100, Math.max(0, snapshot.percentComplete));

  const card = (
    <View style={[styles.card, { borderLeftColor: accent }]}>
      <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{definition.description}</Text>
      <View style={[styles.barBg, { backgroundColor: colors.surfaceLight }]}>
        <View style={[styles.barFill, { width: `${barPercent}%`, backgroundColor: accent }]} />
      </View>
      <View style={styles.stats}>
        <Text style={[styles.stat, { color: colors.text }]}>📊 {Math.round(barPercent)}%</Text>
        <Text style={[styles.stat, { color: colors.text }]}>🔥 {liveProgress.streak}d</Text>
        <Text style={[styles.stat, { color: colors.text }]}>📅 {remaining}</Text>
      </View>
    </View>
  );

  return onPress ? <TouchableOpacity onPress={onPress} activeOpacity={0.85}>{card}</TouchableOpacity> : card;
};

const createStyles = (colors: any) => StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: scale(14),
    padding: scale(14),
    marginHorizontal: scale(20),
    marginVertical: scale(5),
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  title: { fontFamily: fonts.heading.bold, fontSize: scale(14), marginBottom: scale(8) },
  barBg: { height: scale(8), borderRadius: scale(4), overflow: 'hidden', marginBottom: scale(8) },
  barFill: { height: '100%', borderRadius: scale(4) },
  stats: { flexDirection: 'row', gap: scale(16) },
  stat: { fontFamily: fonts.heading.bold, fontSize: scale(12) },
});

export default GoalProgressBar;
