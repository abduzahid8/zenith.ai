import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useGoalStore } from '../../store/goalStore';
import { GoalSnapshot, BottleneckAnalysis } from '../../types/goals';
import { scale } from '../../constants';
import { fonts } from '../../theme';
import { statusVisuals } from './shared';

interface GoalCheckinCardProps {
  snapshot: GoalSnapshot;
  colors: any;
  onRefresh?: (next: GoalSnapshot | null) => void;
}

export const GoalCheckinCard: React.FC<GoalCheckinCardProps> = ({ snapshot, colors, onRefresh }) => {
  const { definition, progress } = snapshot;
  const mode = progress.currentMode;

  const [checkinValue, setCheckinValue] = useState('');
  const [tacticalCommit, setTacticalCommit] = useState('');
  const [blockerInput, setBlockerInput] = useState('');

  const refresh = useCallback(() => {
    const store = useGoalStore.getState();
    const next = store.getSnapshotById(definition.id) || store.getActiveSnapshot();
    onRefresh?.(next);
  }, [definition.id, onRefresh]);

  const handleCheckin = useCallback(() => {
    const val = parseInt(checkinValue, 10);
    if (isNaN(val) || val <= 0) {
      Alert.alert('Enter a number', 'Enter today\'s count to check in.');
      return;
    }
    const store = useGoalStore.getState();
    store.recordCheckin(val, `checkin: ${val}`, undefined, definition.hobby);
    setCheckinValue('');
    refresh();
  }, [checkinValue, definition.hobby, refresh]);

  const handleTacticalCommit = useCallback(() => {
    if (!tacticalCommit.trim()) {
      Alert.alert('Add a commit', 'What will you do today?');
      return;
    }
    const store = useGoalStore.getState();
    store.recordCheckin(progress.currentValue, `commit: ${tacticalCommit.trim()}`, undefined, definition.hobby);
    setTacticalCommit('');
    refresh();
  }, [tacticalCommit, progress.currentValue, definition.hobby, refresh]);

  const handleBlockerSubmit = useCallback(() => {
    if (!blockerInput.trim()) {
      Alert.alert('Describe the blocker', 'What\'s in your way?');
      return;
    }
    const store = useGoalStore.getState();
    const bottleneck: BottleneckAnalysis = {
      bottleneck: blockerInput.trim(),
      severity: 'moderate',
      label: blockerInput.trim(),
      recommendations: [],
    };
    store.setTroubleshoot(definition.id, blockerInput.trim());
    store.setBottleneck(definition.id, bottleneck);
    store.recordCheckin(progress.currentValue, `blocker: ${blockerInput.trim()}`, bottleneck, definition.hobby);
    setBlockerInput('');
    refresh();
  }, [blockerInput, definition.id, progress.currentValue, definition.hobby, refresh]);

  const { color: statusColor } = statusVisuals(snapshot.projectedCompletion);
  const unit = definition.unitLabel || 'units';
  const hasMilestones = progress.milestones.length > 0;

  return (
    <View style={{
      marginHorizontal: scale(20), marginBottom: scale(12),
      backgroundColor: colors.surface, borderRadius: scale(16),
      padding: scale(16), shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
    }}>
      {/* Mode header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: scale(12) }}>
        <Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(15), color: colors.text }}>
          {mode === 'milestone' ? 'Today\'s Progress'
            : mode === 'tactical' ? 'Today\'s Plan'
              : mode === 'tools' ? 'Find the bottleneck'
                : 'Troubleshooting'}
        </Text>
        <View style={{
          backgroundColor: statusColor + '18', borderRadius: 12,
          paddingHorizontal: 10, paddingVertical: 4,
        }}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: statusColor }}>
            {progress.currentValue}/{definition.target}
          </Text>
        </View>
      </View>

      {/* Mode-specific input */}
      {mode === 'milestone' && (
        <>
          {hasMilestones && (
            <View style={{ marginBottom: scale(10) }}>
              <Text style={{ fontFamily: fonts.body.regular, fontSize: scale(12), color: colors.textSecondary }}>
                Current phase: {progress.milestones[progress.currentMilestoneIndex]?.label || '—'}
              </Text>
            </View>
          )}
          <View style={{ flexDirection: 'row', gap: scale(8) }}>
            <TextInput
              style={{
                flex: 1, backgroundColor: colors.surfaceLight, borderRadius: scale(12),
                paddingHorizontal: scale(14), paddingVertical: scale(10),
                fontFamily: fonts.body.regular, fontSize: scale(15), color: colors.text,
                borderWidth: 1, borderColor: colors.border,
              }}
              value={checkinValue}
              onChangeText={setCheckinValue}
              placeholder={`Enter ${unit} count`}
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
            />
            <TouchableOpacity
              style={{
                backgroundColor: colors.buttonPrimary, borderRadius: scale(10),
                paddingHorizontal: scale(18), justifyContent: 'center',
              }}
              onPress={handleCheckin}
              activeOpacity={0.8}
            >
              <Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(14), color: '#FFFFFF' }}>Log</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {mode === 'tactical' && (
        <>
          <Text style={{ fontFamily: fonts.body.regular, fontSize: scale(13), color: colors.textSecondary, marginBottom: scale(8) }}>
            What's one thing you'll do today to move forward?
          </Text>
          <View style={{ flexDirection: 'row', gap: scale(8) }}>
            <TextInput
              style={{
                flex: 1, backgroundColor: colors.surfaceLight, borderRadius: scale(10),
                paddingHorizontal: scale(14), paddingVertical: scale(10),
                fontFamily: fonts.body.regular, fontSize: scale(15), color: colors.text,
                borderWidth: 1, borderColor: colors.border,
              }}
              value={tacticalCommit}
              onChangeText={setTacticalCommit}
              placeholder="e.g. practice 20 min"
              placeholderTextColor={colors.textSecondary}
            />
            <TouchableOpacity
              style={{
                backgroundColor: colors.buttonPrimary, borderRadius: scale(10),
                paddingHorizontal: scale(18), justifyContent: 'center',
              }}
              onPress={handleTacticalCommit}
              activeOpacity={0.8}
            >
              <Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(14), color: '#FFFFFF' }}>Commit</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {mode === 'tools' && (
        <View style={{ paddingVertical: scale(4) }}>
          <Text style={{ fontFamily: fonts.body.regular, fontSize: scale(13), color: colors.textSecondary, lineHeight: scale(18) }}>
            Pace is slipping. Consider: smaller daily target, focused practice blocks, or removing distractions.
          </Text>
          {progress.lastBottleneck && (
            <View style={{
              marginTop: scale(10), backgroundColor: '#F59E0B20', borderRadius: scale(8),
              borderWidth: 1, borderColor: '#F59E0B', paddingHorizontal: scale(10), paddingVertical: scale(6),
            }}>
              <Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(12), color: '#F59E0B' }}>
                {progress.lastBottleneck.label}
              </Text>
            </View>
          )}
        </View>
      )}

      {mode === 'troubleshoot' && (
        <>
          <Text style={{ fontFamily: fonts.body.regular, fontSize: scale(13), color: colors.textSecondary, marginBottom: scale(8) }}>
            What's blocking you? We'll help find a way around it.
          </Text>
          <View style={{ flexDirection: 'row', gap: scale(8) }}>
            <TextInput
              style={{
                flex: 1, backgroundColor: colors.surfaceLight, borderRadius: scale(10),
                paddingHorizontal: scale(14), paddingVertical: scale(10),
                fontFamily: fonts.body.regular, fontSize: scale(15), color: colors.text,
                borderWidth: 1, borderColor: colors.border,
              }}
              value={blockerInput}
              onChangeText={setBlockerInput}
              placeholder="What's in your way?"
              placeholderTextColor={colors.textSecondary}
            />
            <TouchableOpacity
              style={{
                backgroundColor: '#EF4444', borderRadius: scale(10),
                paddingHorizontal: scale(18), justifyContent: 'center',
              }}
              onPress={handleBlockerSubmit}
              activeOpacity={0.8}
            >
              <Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(14), color: '#FFFFFF' }}>Log</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Quick-log row — always visible */}
      {mode !== 'milestone' && (
        <View style={{ marginTop: scale(12), borderTopWidth: 1, borderTopColor: colors.surfaceLight, paddingTop: scale(10) }}>
          <Text style={{ fontFamily: fonts.body.regular, fontSize: scale(11), color: colors.textSecondary, marginBottom: scale(6) }}>
            Quick log
          </Text>
          <View style={{ flexDirection: 'row', gap: scale(8) }}>
            <TextInput
              style={{
                flex: 1, backgroundColor: colors.surfaceLight, borderRadius: scale(10),
                paddingHorizontal: scale(14), paddingVertical: scale(8),
                fontFamily: fonts.body.regular, fontSize: scale(14), color: colors.text,
                borderWidth: 1, borderColor: colors.border,
              }}
              value={checkinValue}
              onChangeText={setCheckinValue}
              placeholder={`Enter ${unit} count`}
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
            />
            <TouchableOpacity
              style={{
                backgroundColor: colors.buttonPrimary + 'CC', borderRadius: scale(10),
                paddingHorizontal: scale(14), justifyContent: 'center',
              }}
              onPress={handleCheckin}
              activeOpacity={0.8}
            >
              <Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(13), color: '#FFFFFF' }}>Log</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};