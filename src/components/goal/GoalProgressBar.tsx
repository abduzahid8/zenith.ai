import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { scale } from '../../constants';
import { fonts } from '../../theme';
import { useAppTheme } from '../../theme/useAppTheme';
import { GoalSnapshot } from '../../types/goals';

interface GoalProgressBarProps {
  snapshot: GoalSnapshot;
  onEdit?: () => void;
  onPress?: () => void;
}

// ── Sparkline: activity dots for last 7 days ──────────────
function ActivitySparkline({ history, colors }: { history: { date: string }[]; colors: any }) {
  const dots: boolean[] = useMemo(() => {
    const activeDays = new Set(history.map(h => h.date));
    const result: boolean[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      result.push(activeDays.has(d.toISOString().split('T')[0]));
    }
    return result;
  }, [history]);

  return (
    <View style={sparkStyles.row}>
      {dots.map((active, i) => (
        <View
          key={i}
          style={[
            sparkStyles.dot,
            { backgroundColor: active ? colors.buttonPrimary : colors.surfaceLight },
          ]}
        />
      ))}
    </View>
  );
}

const sparkStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: scale(4), alignItems: 'center' },
  dot: { width: scale(8), height: scale(8), borderRadius: scale(4) },
});

// ── Ring progress ─────────────────────────────────────────
function ProgressRing({ percent, size = 80, strokeWidth = 6, color }: { percent: number; size: number; strokeWidth: number; color: string }) {
  const half = size / 2;
  const radius = half - strokeWidth / 2;

  const clamped = Math.min(100, Math.max(0, percent));
  const angle = (clamped / 100) * 360;

  // Build half-rings using rotated views
  const renderHalf = (startAngle: number, endAngle: number, isBack: boolean) => {
    if (endAngle <= startAngle) return null;
    const deg = startAngle + (endAngle - startAngle) / 2;
    const width = 2 * radius * Math.sin(((endAngle - startAngle) / 2) * Math.PI / 180);
    const height = radius;
    return (
      <View
        key={String(startAngle)}
        style={{
          position: 'absolute',
          width: 2 * radius,
          height: 2 * radius,
          borderRadius: radius + strokeWidth / 2,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            width: 2 * radius,
            height: 2 * radius,
            borderRadius: radius + strokeWidth / 2,
            borderWidth: strokeWidth,
            borderColor: isBack ? '#E5E7EB' : color,
            borderRightColor: 'transparent',
            borderBottomColor: 'transparent',
            transform: [{ rotate: `${deg}deg` }],
          }}
        />
      </View>
    );
  };

  const frontAngle = angle > 180 ? 180 : angle;
  const backAngle = angle > 180 ? angle - 180 : 0;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Back ring (full gray circle) */}
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: half,
          borderWidth: strokeWidth,
          borderColor: '#E5E7EB',
        }}
      />
      {/* Front arc */}
      {angle > 0 && (
        <View
          style={{
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: half,
            borderWidth: strokeWidth,
            borderColor: 'transparent',
            borderTopColor: color,
            borderRightColor: angle > 180 ? color : 'transparent',
            borderBottomColor: angle > 270 ? color : 'transparent',
            borderLeftColor: angle > 90 ? color : 'transparent',
            transform: [{ rotate: '-90deg' }],
          }}
        />
      )}
      {/* Center text */}
      <Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(16), color: '#000' }}>
        {clamped}%
      </Text>
    </View>
  );
}

// ── Main component ────────────────────────────────────────
export const GoalProgressBar: React.FC<GoalProgressBarProps> = ({ snapshot, onEdit, onPress }) => {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { definition, progress, percentComplete, daysRemaining, projectedCompletion, dailyRateNeeded } = snapshot;

  const statusColor = projectedCompletion === 'on_track' ? '#10B981'
    : projectedCompletion === 'ahead' ? '#3B82F6'
    : '#F59E0B';

  const statusIcon = projectedCompletion === 'on_track' ? '→'
    : projectedCompletion === 'ahead' ? '↑'
    : '↓';

  const isSkill = definition.category === 'skill';

  // ── Skill card ─────────────────────────────────────────
  if (isSkill) {
    const currentDiff = progress.currentDifficulty ?? definition.difficultyScore ?? 500;
    const targetDiff = definition.targetDifficulty ?? definition.target;

    const card = (
      <View style={styles.card}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.goalText} numberOfLines={1}>{definition.description}</Text>
          {onEdit && (
            <TouchableOpacity onPress={onEdit} activeOpacity={0.6} style={styles.editBtn}>
              <Text style={styles.editBtnText}>✎</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Ring + stats */}
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

        {/* Sparkline */}
        <View style={styles.sparkSection}>
          <Text style={styles.sectionLabel}>Activity</Text>
          <ActivitySparkline history={progress.history} colors={colors} />
          <Text style={styles.streakText}>
            {progress.streak > 0 ? `🔥 ${progress.streak} day streak` : ''}
          </Text>
        </View>

        {/* Status */}
        <View style={styles.footer}>
          <View style={[styles.statusPill, { backgroundColor: statusColor + '20', borderColor: statusColor }]}>
            <Text style={[styles.statusPillText, { color: statusColor }]}>
              {statusIcon} {projectedCompletion === 'on_track' ? 'On track' : projectedCompletion === 'ahead' ? 'Ahead' : 'Behind'}
            </Text>
          </View>
          <Text style={styles.rateText}>{dailyRateNeeded} pts/day needed</Text>
        </View>
      </View>
    );

    return onPress ? (
      <TouchableOpacity onPress={onPress} activeOpacity={0.8}>{card}</TouchableOpacity>
    ) : card;
  }

  // ── Execution card ──────────────────────────────────────
    const unit = definition.unitLabel || 'units';
  const hasMilestones = progress.milestones && progress.milestones.length > 0;

  const execCard = (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.goalText} numberOfLines={1}>{definition.description}</Text>
        {onEdit && (
          <TouchableOpacity onPress={onEdit} activeOpacity={0.6} style={styles.editBtn}>
            <Text style={styles.editBtnText}>✎</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Countdown */}
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

      {/* Timeline milestones */}
      {hasMilestones && (
        <View style={styles.timeline}>
          {progress.milestones.map((m, i) => {
            const isDone = m.currentValue >= m.target;
            const isCurrent = i === progress.currentMilestoneIndex && !isDone;
            return (
              <View key={i} style={styles.timelineNode}>
                <View
                  style={[
                    styles.timelineDot,
                    isDone && styles.timelineDotDone,
                    isCurrent && styles.timelineDotCurrent,
                  ]}
                />
                <Text
                  style={[
                    styles.timelineLabel,
                    isDone && styles.timelineLabelDone,
                    isCurrent && styles.timelineLabelCurrent,
                  ]}
                  numberOfLines={1}
                >
                  {m.label}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Mode */}
      <Text style={styles.modeText}>
        Mode: {progress.currentMode === 'milestone' ? 'Planning' : progress.currentMode === 'tactical' ? 'Daily push' : progress.currentMode === 'tools' ? 'Bottleneck' : 'Troubleshooting'}
      </Text>

      {/* Bottleneck */}
      {progress.lastBottleneck && (
        <View style={styles.bottleneckBadge}>
          <Text style={styles.bottleneckLabel}>{progress.lastBottleneck.label}</Text>
        </View>
      )}

      {/* Status */}
      <View style={styles.footer}>
        <View style={[styles.statusPill, { backgroundColor: statusColor + '20', borderColor: statusColor }]}>
          <Text style={[styles.statusPillText, { color: statusColor }]}>
            {statusIcon} {projectedCompletion === 'on_track' ? 'On track' : projectedCompletion === 'ahead' ? 'Ahead' : 'Behind'}
          </Text>
        </View>
        <Text style={styles.rateText}>
          {progress.currentValue}/{definition.target} · {dailyRateNeeded}/{unit}/day
        </Text>
      </View>
    </View>
  );

  return onPress ? (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>{execCard}</TouchableOpacity>
  ) : execCard;
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scale(14),
  },
  goalText: {
    fontFamily: fonts.heading.bold,
    fontSize: scale(15),
    color: colors.text,
    flex: 1,
  },
  editBtn: {
    paddingLeft: scale(12),
    paddingVertical: scale(4),
  },
  editBtnText: {
    fontSize: scale(18),
    color: colors.primary,
  },

  // Body area (ring + stats / countdown)
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scale(14),
    gap: scale(16),
  },
  bodyStats: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statRow: {
    alignItems: 'center',
  },
  statBig: {
    fontFamily: fonts.heading.bold,
    fontSize: scale(22),
    color: colors.text,
  },
  statLabel: {
    fontFamily: fonts.body.regular,
    fontSize: scale(11),
    color: colors.textSecondary,
    marginTop: scale(2),
  },

  // Sparkline
  sparkSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    marginBottom: scale(12),
  },
  sectionLabel: {
    fontFamily: fonts.body.regular,
    fontSize: scale(11),
    color: colors.textSecondary,
  },
  streakText: {
    fontFamily: fonts.heading.bold,
    fontSize: scale(12),
    color: '#F59E0B',
    marginLeft: 'auto',
  },

  // Countdown (execution)
  countdownBlock: {
    flex: 1,
    alignItems: 'center',
  },
  countdownValue: {
    fontFamily: fonts.heading.bold,
    fontSize: scale(26),
    color: colors.text,
  },
  countdownLabel: {
    fontFamily: fonts.body.regular,
    fontSize: scale(11),
    color: colors.textSecondary,
    marginTop: scale(2),
  },

  // Timeline
  timeline: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: scale(12),
    paddingHorizontal: scale(4),
  },
  timelineNode: {
    alignItems: 'center',
    flex: 1,
  },
  timelineDot: {
    width: scale(10),
    height: scale(10),
    borderRadius: scale(5),
    backgroundColor: colors.surfaceLight,
    borderWidth: 2,
    borderColor: colors.border,
    marginBottom: scale(4),
  },
  timelineDotDone: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  timelineDotCurrent: {
    backgroundColor: colors.buttonPrimary,
    borderColor: colors.buttonPrimary,
    width: scale(14),
    height: scale(14),
    borderRadius: scale(7),
  },
  timelineLabel: {
    fontFamily: fonts.body.regular,
    fontSize: scale(9),
    color: colors.textSecondary,
    textAlign: 'center',
  },
  timelineLabelDone: {
    color: '#10B981',
    textDecorationLine: 'line-through',
  },
  timelineLabelCurrent: {
    fontFamily: fonts.heading.bold,
    color: colors.buttonPrimary,
  },

  // Mode
  modeText: {
    fontFamily: fonts.body.regular,
    fontSize: scale(11),
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: scale(8),
  },

  // Bottleneck
  bottleneckBadge: {
    alignSelf: 'center',
    backgroundColor: '#F59E0B20',
    borderRadius: scale(8),
    borderWidth: 1,
    borderColor: '#F59E0B',
    paddingHorizontal: scale(10),
    paddingVertical: scale(4),
    marginBottom: scale(8),
  },
  bottleneckLabel: {
    fontFamily: fonts.heading.bold,
    fontSize: scale(11),
    color: '#F59E0B',
  },

  // Footer
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: scale(4),
  },
  statusPill: {
    borderRadius: scale(12),
    borderWidth: 1,
    paddingHorizontal: scale(10),
    paddingVertical: scale(4),
  },
  statusPillText: {
    fontFamily: fonts.heading.bold,
    fontSize: scale(12),
  },
  rateText: {
    fontFamily: fonts.body.regular,
    fontSize: scale(11),
    color: colors.textSecondary,
  },
});

export default GoalProgressBar;
