import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { GoalProgressEntry, Milestone } from '../../types/goals';

// ── Status visuals ────────────────────────────────────────

export function statusVisuals(projectedCompletion: 'on_track' | 'ahead' | 'behind'): { color: string; label: string } {
  switch (projectedCompletion) {
    case 'ahead': return { color: '#10B981', label: 'Ahead' };
    case 'behind': return { color: '#EF4444', label: 'Behind' };
    default: return { color: '#3B82F6', label: 'On track' };
  }
}

// ── ProgressRing ──────────────────────────────────────────

interface ProgressRingProps {
  percent: number;
  size: number;
  strokeWidth: number;
  color: string;
  trackColor?: string;
}

export const ProgressRing: React.FC<ProgressRingProps> = ({ percent, size, strokeWidth, color, trackColor = '#E5E7EB' }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, percent));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={radius} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        rotation="-90"
        origin={`${size / 2}, ${size / 2}`}
      />
    </Svg>
  );
};

// ── ActivitySparkline ─────────────────────────────────────

interface ActivitySparklineProps {
  history: GoalProgressEntry[];
  color: string;
  trackColor?: string;
  dotSize?: number;
  width?: number;
  height?: number;
}

export const ActivitySparkline: React.FC<ActivitySparklineProps> = ({
  history, color, trackColor = '#E5E7EB', dotSize = 6, width = 120, height = 28,
}) => {
  const recent = history.slice(-14);
  if (recent.length < 2) {
    return (
      <Svg width={width} height={height}>
        {recent.map((_, i) => (
          <Circle key={i} cx={width / 2} cy={height / 2} r={dotSize / 2} fill={color} />
        ))}
      </Svg>
    );
  }

  const maxVal = Math.max(...recent.map(h => h.value), 1);
  const stepX = width / (recent.length - 1);
  const points = recent.map((h, i) => {
    const x = i * stepX;
    const y = height - (h.value / maxVal) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

  return (
    <Svg width={width} height={height}>
      <Polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      {recent.map((_, i) => (
        <Circle key={i} cx={i * stepX} cy={height - (_.value / maxVal) * (height - 4) - 2} r={dotSize / 2} fill={color} />
      ))}
    </Svg>
  );
};

// ── StatusPill ────────────────────────────────────────────

interface StatusPillProps {
  projectedCompletion: 'on_track' | 'ahead' | 'behind';
}

export const StatusPill: React.FC<StatusPillProps> = ({ projectedCompletion }) => {
  const { color, label } = statusVisuals(projectedCompletion);
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', backgroundColor: color + '18',
      borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4,
    }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, marginRight: 6 }} />
      <Text style={{ fontSize: 12, fontWeight: '600', color }}>{label}</Text>
    </View>
  );
};

// ── MilestoneTimelineCompact ──────────────────────────────

interface MilestoneTimelineCompactProps {
  milestones: Milestone[];
  currentIndex: number;
  colors: any;
}

export const MilestoneTimelineCompact: React.FC<MilestoneTimelineCompactProps> = ({ milestones, currentIndex, colors }) => {
  if (milestones.length === 0) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      {milestones.map((m, i) => (
        <React.Fragment key={i}>
          <View style={{
            width: 24, height: 24, borderRadius: 12,
            backgroundColor: i <= currentIndex ? colors.buttonPrimary : colors.surfaceLight,
            justifyContent: 'center', alignItems: 'center',
          }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: i <= currentIndex ? '#FFF' : colors.textSecondary }}>
              {i + 1}
            </Text>
          </View>
          {i < milestones.length - 1 && (
            <View style={{
              flex: 1, height: 2,
              backgroundColor: i < currentIndex ? colors.buttonPrimary : colors.surfaceLight,
            }} />
          )}
        </React.Fragment>
      ))}
    </View>
  );
};

// ── MilestoneTimelineDetailed (vertical) ──────────────────

interface MilestoneTimelineDetailedProps {
  milestones: Milestone[];
  currentIndex: number;
  colors: any;
}

export const MilestoneTimelineDetailed: React.FC<MilestoneTimelineDetailedProps> = ({ milestones, currentIndex, colors }) => {
  if (milestones.length === 0) return null;
  return (
    <View style={{ gap: 0 }}>
      {milestones.map((m, i) => {
        const isActive = i === currentIndex;
        const isPast = i < currentIndex;
        const done = m.currentValue >= m.target;
        const filled = isPast || done;
        const dotColor = filled ? colors.buttonPrimary : colors.surfaceLight;
        return (
          <View key={i} style={{ flexDirection: 'row', minHeight: 48 }}>
            <View style={{ alignItems: 'center', width: 32 }}>
              <View style={{
                width: 16, height: 16, borderRadius: 8,
                backgroundColor: isActive ? colors.buttonPrimary : dotColor,
                borderWidth: isActive ? 3 : 0,
                borderColor: colors.buttonPrimary + '40',
                zIndex: 1,
              }} />
              {i < milestones.length - 1 && (
                <View style={{ flex: 1, width: 2, backgroundColor: filled ? colors.buttonPrimary : colors.surfaceLight }} />
              )}
            </View>
            <View style={{ flex: 1, paddingLeft: 12, paddingBottom: i < milestones.length - 1 ? 16 : 0 }}>
              <Text style={{
                fontWeight: isActive ? '700' : '400',
                fontSize: 14, color: colors.text, marginBottom: 2,
              }}>
                {m.label}
              </Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                {m.currentValue}/{m.target} {m.unit}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
};