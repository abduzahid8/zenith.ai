import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, Linking } from 'react-native';
import { useGoalStore } from '../../store/goalStore';
import { GoalSnapshot, BottleneckAnalysis, GoalProgress, DailyGoalContent } from '../../types/goals';
import { scale } from '../../constants';
import { fonts } from '../../theme';
import { statusVisuals } from './shared';
import { deriveDailyTile, buildHeuristicPlan, pickTodayStepIndex } from '../../services/goalPlanService';
import { HOBBY_META, HobbyId } from '../../data/lessonContent';
import { modeTitle } from './modeCopy';

interface GoalCheckinCardProps {
  snapshot: GoalSnapshot;
  colors: any;
  onRefresh?: (next: GoalSnapshot | null) => void;
}

function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

export const GoalCheckinCard: React.FC<GoalCheckinCardProps> = ({ snapshot, colors, onRefresh }) => {
  const { definition } = snapshot;
  // Subscribe to the live progress from the store so that any update
  // (plan attachment, commitment set, etc.) triggers a re-render even
  // when the parent's snapshot prop hasn't been refreshed yet.
  const liveProgress: GoalProgress = useGoalStore(
    (state) => state.progress[definition.id] || snapshot.progress
  );
  const isPlanAttached = Boolean(liveProgress.planOfAttack);
  const mode = liveProgress.currentMode;

  // Goal-aware: derive today's tile from the user's specific Plan-of-Attack.
  // Always uses the LIVE progress (which the Zustand subscription keeps fresh
  // even when the parent's `snapshot` prop is stale).
  const tile = liveProgress.planOfAttack
    ? deriveDailyTile(liveProgress.planOfAttack, definition, liveProgress.currentValue, snapshot.daysRemaining)
    : undefined;
  const todayStep = tile?.step;
  const unit = definition.unitLabel || 'units';
  const hasMilestones = liveProgress.milestones.length > 0;
  const hasCommitmentDisplayed = Boolean(liveProgress.commitment);

  const [checkinValue, setCheckinValue] = useState('');
  const [tacticalCommit, setTacticalCommit] = useState(liveProgress.commitment?.text || '');
  const [blockerInput, setBlockerInput] = useState('');
  const [showSwapForm, setShowSwapForm] = useState(false);

  // Self-bootstrap: if this goal pre-dates the Plan-of-Attack engine (no plan
  // attached yet), build a heuristic plan SYNCHRONOUSLY (no LLM needed) so the
  // card becomes goal-aware immediately on the first render — and queue the
  // LLM enrichment in the background to upgrade it once the API replies.
  useEffect(() => {
    if (isPlanAttached || definition.status !== 'active') return;
    const store = useGoalStore.getState();
    const today = getTodayString();
    try {
      const plan = buildHeuristicPlan(definition);
      plan.currentStepIndex = pickTodayStepIndex(plan, today, definition.deadline);
      store.setPlanOfAttack(definition.id, plan);
    } catch {
      // tolerate failure — generic fallback remains
    }
    // Async LLM upgrade — never blocks render.
    store.generateGoalPlan(definition.id).catch(() => {});
    // Only trigger on goal change / mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [definition.id, definition.status, isPlanAttached]);

  // Load today's AI-generated Learn paragraph (driven by the plan) — this is
  // the *learn* half of the user's "learn + do toward my goal" loop.
  const [dailyContent, setDailyContent] = useState<DailyGoalContent | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (definition.status !== 'active') return;
    useGoalStore.getState().getOrGenerateDailyContent(definition.id).then((c) => {
      if (!cancelled) setDailyContent(c);
    });
    return () => { cancelled = true; };
  }, [definition.id, definition.status, isPlanAttached]);

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
    const trimmed = tacticalCommit.trim();
    const store = useGoalStore.getState();
    // Parse the free-form commitment so today's card can show it, the
    // tomorrow card can nag on follow-through, and the AI prompt can weave
    // it into today's "do" action.
    store.setCommitment(definition.id, trimmed);
    store.recordCheckin(liveProgress.currentValue, `commit: ${trimmed}`, undefined, definition.hobby);
    setTacticalCommit('');
    refresh();
  }, [tacticalCommit, liveProgress.currentValue, definition.id, definition.hobby, refresh]);

  const handleBlockerSubmit = useCallback(() => {
    if (!blockerInput.trim()) {
      Alert.alert('Describe the blocker', 'What\'s in your way?');
      return;
    }
    const trimmed = blockerInput.trim();
    const store = useGoalStore.getState();
    const bottleneck: BottleneckAnalysis = {
      bottleneck: trimmed,
      severity: 'moderate',
      label: trimmed,
      recommendations: [],
    };
    store.setTroubleshoot(definition.id, trimmed);
    store.setBottleneck(definition.id, bottleneck);
    store.recordCheckin(liveProgress.currentValue, `blocker: ${trimmed}`, bottleneck, definition.hobby);
    setBlockerInput('');
    refresh();
  }, [blockerInput, definition.id, liveProgress.currentValue, definition.hobby, refresh]);

  const { color: statusColor } = statusVisuals(snapshot.projectedCompletion);
  const learnTitle = dailyContent?.learn?.title;
  const learnBody = dailyContent?.learn?.body;

  // Header label: dynamic based on whether a plan exists yet
  const headerLabel = todayStep
    ? `Step ${(tile?.index ?? 0) + 1} of ${tile?.total ?? '?'}`
    : modeTitle(mode);
  const doTitle = todayStep?.label || 'Take your next small step';
  const doBody = todayStep?.detail || 'One concrete chunk of progress toward your goal — keep it small enough to finish.';
  const doMinutes = todayStep?.estimatedMinutes;

  return (
    <View style={{
      marginHorizontal: scale(20), marginBottom: scale(12),
      backgroundColor: colors.surface, borderRadius: scale(16),
      padding: scale(16), shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
    }}>
      {/* Header: "Step N of M → Books" + counter pill */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: scale(8) }}>
        <Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(15), color: colors.text }}>
          {headerLabel} → {(HOBBY_META as any)[definition.hobby]?.label || definition.hobby}
        </Text>
        {tile ? (
          <View style={{
            backgroundColor: colors.accent + '22', borderRadius: 12,
            paddingHorizontal: 10, paddingVertical: 4,
          }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.accent }}>
              {liveProgress.currentValue}/{definition.target} {unit}
            </Text>
          </View>
        ) : (
          <View style={{
            backgroundColor: statusColor + '18', borderRadius: 12,
            paddingHorizontal: 10, paddingVertical: 4,
          }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: statusColor }}>
              {liveProgress.currentValue}/{definition.target} {unit}
            </Text>
          </View>
        )}
      </View>

      {/* LEARN block — the *learning* half of the day's loop */}
      {(learnTitle || learnBody) && (
        <View style={{
          marginTop: scale(4), marginBottom: scale(12),
          padding: scale(12), borderRadius: scale(12),
          backgroundColor: (colors.accent || '#7CB9FF') + '15',
          borderLeftWidth: 3, borderLeftColor: colors.accent || '#7CB9FF',
        }}>
          {learnTitle ? (
            <Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(14), color: colors.text, marginBottom: 4, lineHeight: 19 }}>
              {learnTitle}
            </Text>
          ) : null}
          {learnBody ? (
            <Text style={{ fontFamily: fonts.body.regular, fontSize: scale(13), color: colors.textSecondary, lineHeight: 18 }}>
              {learnBody}
            </Text>
          ) : null}
        </View>
      )}

      {/* DO block — the *action* half of the day's loop, sourced from the user's plan */}
      <View style={{
        marginBottom: scale(12),
        padding: scale(12), borderRadius: scale(12),
        backgroundColor: colors.buttonPrimary + '12',
        borderLeftWidth: 3, borderLeftColor: colors.buttonPrimary,
      }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          {doMinutes ? (
            <Text style={{ fontFamily: fonts.body.regular, fontSize: scale(11), color: colors.textSecondary }}>
              ⏱ ~{doMinutes} min
            </Text>
          ) : null}
        </View>
        <Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(15), color: colors.text, marginTop: 4, marginBottom: 4, lineHeight: 20 }}>
          {doTitle}
        </Text>
        <Text style={{ fontFamily: fonts.body.regular, fontSize: scale(13), color: colors.textSecondary, lineHeight: 18 }}>
          {doBody}
        </Text>
      </View>

      {/* Mark done + alternative actions for the DO task */}
      {todayStep ? (
        <View style={{ flexDirection: 'row', gap: scale(8), marginBottom: scale(10) }}>
          <TouchableOpacity
            style={{
              flex: 2, backgroundColor: colors.buttonPrimary, borderRadius: scale(10),
              paddingVertical: scale(13), alignItems: 'center',
            }}
            onPress={() => {
              // Treat "Mark done" as fulfilling today's task commitment + 1 unit
              const store = useGoalStore.getState();
              const next = liveProgress.currentValue + 1;
              store.setCommitment(definition.id, doTitle);
              store.recordCheckin(next, `done: ${doTitle}`, undefined, definition.hobby);
            }}
            activeOpacity={0.85}
          >
            <Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(14), color: '#FFFFFF' }}>
              ✓ Mark done (+1 {unit})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              flex: 1, backgroundColor: colors.surfaceLight, borderRadius: scale(10),
              paddingVertical: scale(13), alignItems: 'center', borderWidth: 1, borderColor: colors.border,
            }}
            onPress={() => setShowSwapForm(true)}
            activeOpacity={0.7}
          >
            <Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(13), color: colors.text }}>
              Swap task
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Inline swap form — only shown after the user taps "Swap task" */}
      {showSwapForm && todayStep && (
        <View style={{
          marginBottom: scale(10), padding: scale(12), borderRadius: scale(10),
          backgroundColor: colors.surfaceLight, borderWidth: 1, borderColor: colors.border,
        }}>
          <Text style={{ fontFamily: fonts.body.regular, fontSize: scale(12), color: colors.textSecondary, marginBottom: 6 }}>
            Replace today's task with something more realistic:
          </Text>
          <View style={{ flexDirection: 'row', gap: scale(8) }}>
            <TextInput
              style={{
                flex: 1, backgroundColor: colors.surface, borderRadius: scale(8),
                paddingHorizontal: scale(12), paddingVertical: scale(8),
                fontFamily: fonts.body.regular, fontSize: scale(14), color: colors.text,
                borderWidth: 1, borderColor: colors.border,
              }}
              value={tacticalCommit}
              onChangeText={setTacticalCommit}
              placeholder="e.g. read 5 pages instead of 1 chapter"
              placeholderTextColor={colors.textSecondary}
            />
            <TouchableOpacity
              style={{
                backgroundColor: colors.buttonPrimary, borderRadius: scale(8),
                paddingHorizontal: scale(14), justifyContent: 'center',
              }}
              onPress={() => {
                if (!tacticalCommit.trim()) {
                  setShowSwapForm(false);
                  return;
                }
                const store = useGoalStore.getState();
                const trimmed = tacticalCommit.trim();
                store.setCommitment(definition.id, trimmed);
                store.recordCheckin(liveProgress.currentValue, `commit: ${trimmed}`, undefined, definition.hobby);
                setTacticalCommit('');
                setShowSwapForm(false);
              }}
              activeOpacity={0.85}
            >
              <Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(13), color: '#FFFFFF' }}>Use</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Quick log — for users who want to record a count without committing to the full task */}
      <View style={{ borderTopWidth: 1, borderTopColor: colors.surfaceLight, paddingTop: scale(10) }}>
        <View style={{ flexDirection: 'row', gap: scale(8) }}>
          <TextInput
            style={{
              flex: 1, backgroundColor: colors.surfaceLight, borderRadius: scale(8),
              paddingHorizontal: scale(12), paddingVertical: scale(8),
              fontFamily: fonts.body.regular, fontSize: scale(14), color: colors.text,
              borderWidth: 1, borderColor: colors.border,
            }}
            value={checkinValue}
            onChangeText={setCheckinValue}
            placeholder={`Enter ${unit} count (e.g. ${Math.max(1, Math.floor((definition.target - liveProgress.currentValue) / Math.max(1, snapshot.daysRemaining)))} ${unit})`}
            placeholderTextColor={colors.textSecondary}
            keyboardType="number-pad"
          />
          <TouchableOpacity
            style={{
              backgroundColor: colors.buttonPrimary + 'CC', borderRadius: scale(8),
              paddingHorizontal: scale(14), justifyContent: 'center',
            }}
            onPress={handleCheckin}
            activeOpacity={0.85}
          >
            <Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(13), color: '#FFFFFF' }}>Log</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Optional: yesterday's commitment follow-through (skill touch) */}
      {liveProgress.yesterdayCommitment && (
        <View style={{
          marginTop: scale(10), padding: scale(10), borderRadius: scale(8),
          backgroundColor: liveProgress.yesterdayCommitmentHonored ? '#10B98115' : '#F59E0B15',
          borderWidth: 1,
          borderColor: liveProgress.yesterdayCommitmentHonored ? '#10B981' : '#F59E0B',
        }}>
          <Text style={{ fontFamily: fonts.body.regular, fontSize: scale(12), color: colors.textSecondary }}>
            {liveProgress.yesterdayCommitmentHonored ? '✅ Yesterday: ' : '⏰ Yesterday you promised: '}
            <Text style={{ fontFamily: fonts.heading.bold, color: colors.text }}>
              "{liveProgress.yesterdayCommitment.action}"
            </Text>
          </Text>
        </View>
      )}

      {/* Troubleshoot mode: replace the whole DO block */}
      {mode === 'troubleshoot' && (
        <View style={{ marginTop: scale(8) }}>
          <Text style={{ fontFamily: fonts.body.regular, fontSize: scale(13), color: colors.textSecondary, marginBottom: scale(8) }}>
            What&apos;s blocking you today? We&apos;ll help find a way around it.
          </Text>
          <View style={{ flexDirection: 'row', gap: scale(8) }}>
            <TextInput
              style={{
                flex: 1, backgroundColor: colors.surfaceLight, borderRadius: scale(10),
                paddingHorizontal: scale(14), paddingVertical: scale(10),
                fontFamily: fonts.body.regular, fontSize: scale(14), color: colors.text,
                borderWidth: 1, borderColor: colors.border,
              }}
              value={blockerInput}
              onChangeText={setBlockerInput}
              placeholder="e.g. can't find quiet time"
              placeholderTextColor={colors.textSecondary}
            />
            <TouchableOpacity
              style={{
                backgroundColor: '#EF4444', borderRadius: scale(10),
                paddingHorizontal: scale(18), justifyContent: 'center',
              }}
              onPress={handleBlockerSubmit}
              activeOpacity={0.7}
            >
              <Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(14), color: '#FFFFFF' }}>Log</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};