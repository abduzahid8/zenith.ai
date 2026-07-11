import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { fonts } from '../theme';
import { scale } from '../constants';
import { useAppTheme } from '../theme/useAppTheme';
import { useGoalStore } from '../store/goalStore';
import { GoalCategory } from '../types/goals';
import aiService from '../services/ai';
import { guessCategory, extractCount } from '../services/goalSetupHeuristics';
import { daysBetween } from '../services/goalHandlers';
import { ROUTES, buildRoute } from '../config/routes';

// ── Quick deadlines ──────────────────────────────────────

const QUICK_DEADLINES = [
  { label: '1 month', days: 30 },
  { label: '3 months', days: 90 },
  { label: '6 months', days: 180 },
  { label: '1 year', days: 365 },
];

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// ── Proxy metric types ──────────────────────────────────

interface ProxyOption {
  label: string;
  unit: string;
  startingValue: number;
  target: number;
  deadlineDays: number;
  reasoning: string;
}

// ── Screen ───────────────────────────────────────────────

export default function GoalSetupScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const editId = params.edit as string | undefined;
  const existingGoal = editId ? useGoalStore.getState().goals[editId] : null;
  const hobbyId = (params.hobbyId as string) || existingGoal?.hobby || null;
  const editGoalId = (params.edit as string) || null;

  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const t = useT();
  const goals = useGoalStore(s => s.goals);
  const editGoal = editGoalId ? goals[editGoalId] : null;

  // Core fields
  const [description, setDescription] = useState(editGoal?.description ?? '');
  const [debouncedDescription, setDebouncedDescription] = useState(editGoal?.description ?? '');
  const [category, setCategory] = useState<GoalCategory>(editGoal?.category ?? 'skill');
  const [target, setTarget] = useState(editGoal ? String(editGoal.target) : '');
  const [startingValue, setStartingValue] = useState(editGoal ? String(editGoal.startingValue) : '0');
  const [unitLabel, setUnitLabel] = useState(editGoal?.unitLabel && editGoal.unitLabel !== 'pts' ? editGoal.unitLabel : '');
  const [deadlineOption, setDeadlineOption] = useState<'quick' | 'custom'>('quick');
  const [quickDays, setQuickDays] = useState(90);
  const [customDate, setCustomDate] = useState('');

  // For edit: pre-fill deadline
  useEffect(() => {
    if (!editGoal) return;
    const deadline = editGoal.deadline;
    if (deadline && deadline.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const now = new Date();
      const deadlineDate = new Date(deadline);
      const diffDays = Math.round((deadlineDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      if (diffDays > 0 && diffDays <= 365) {
        setDeadlineOption('quick');
        setQuickDays(diffDays);
      } else {
        setDeadlineOption('custom');
        setCustomDate(deadline);
      }
    }
  }, [editGoal?.id]);

  // Debounce description so proxy-metric AI calls don't fire per keystroke
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedDescription(description), 400);
    return () => clearTimeout(timer);
  }, [description]);

  const [saving, setSaving] = useState(false);

  // Proxy metric state
  const [proxyLoading, setProxyLoading] = useState(false);
  const [proxyOptions, setProxyOptions] = useState<ProxyOption[]>([]);
  const [showProxyPicker, setShowProxyPicker] = useState(false);
  const [proxyFailed, setProxyFailed] = useState(false);

  const isSkill = category === 'skill';

  // When execution is selected and debounced description changes, detect count or show proxy
  useEffect(() => {
    if (category !== 'execution' || debouncedDescription.length < 5) return;

    // Reset proxy state when debounced description changes
    setProxyOptions([]);
    setShowProxyPicker(false);
    setProxyFailed(false);
    setTarget('');
    setUnitLabel('');

    const extracted = extractCount(debouncedDescription);
    if (extracted) {
      setShowProxyPicker(false);
      setTarget(String(extracted.count));
      setUnitLabel(extracted.unit);
      return;
    }

    if (!proxyLoading && proxyOptions.length === 0 && !proxyFailed) {
      setProxyLoading(true);
      aiService.proposeMetrics(debouncedDescription).then((options) => {
        setProxyOptions(options);
        setProxyLoading(false);
        if (options.length > 0) {
          setShowProxyPicker(true);
        } else {
          setProxyFailed(true);
        }
      }).catch(() => {
        setProxyLoading(false);
        setProxyFailed(true);
      });
    }
  }, [debouncedDescription, category]);

  const handleDescriptionChange = useCallback((text: string) => {
    setDescription(text);
    if (text.length > 3) {
      const guessed = guessCategory(text, hobbyId);
      setCategory(guessed);
    }
  }, [hobbyId]);

  const handlePickProxy = useCallback((index: number) => {
    const opt = proxyOptions[index];
    if (!opt) return;
    setTarget(String(opt.target));
    setStartingValue(String(opt.startingValue));
    setUnitLabel(opt.unit);
    setQuickDays(opt.deadlineDays);
    setShowProxyPicker(false);
  }, [proxyOptions]);

  const handleSkipProxy = useCallback(() => {
    setShowProxyPicker(false);
  }, []);

  const handleSave = useCallback(async () => {
    const targetNum = parseInt(target, 10);
    const startNum = parseInt(startingValue, 10) || 0;
    if (!description.trim() || !targetNum || targetNum <= 0) return;

    const deadline = deadlineOption === 'quick'
      ? formatDate(new Date(Date.now() + quickDays * 24 * 60 * 60 * 1000))
      : customDate;

    setSaving(true);

    let savedGoalId: string | undefined = editGoal?.id;

    if (editGoal) {
      useGoalStore.getState().updateGoal(editGoal.id, {
        target: targetNum,
        deadline,
        startingValue: startNum,
        description: description.trim(),
        unitLabel: isSkill ? 'pts' : (unitLabel.trim() || 'units'),
        targetDifficulty: isSkill ? targetNum : undefined,
        difficultyScore: isSkill ? startNum || 400 : undefined,
      });
      // Regenerate milestones/plan if target, description, or unit changed
      const targetChanged = targetNum !== editGoal.target;
      const descChanged = description.trim() !== editGoal.description;
      const unitChanged = (unitLabel.trim() || 'units') !== (editGoal.unitLabel || 'units');
      if (targetChanged || descChanged || unitChanged) {
        useGoalStore.getState().regeneratePlan(editGoal.id);
      }
    } else {
      const goalId = `goal_${Date.now()}`;
      savedGoalId = goalId;

      useGoalStore.getState().setGoal({
        id: goalId,
        hobby: (hobbyId ?? 'goal') as any,
        type: isSkill ? 'skill_rating' : 'execution_count',
        category,
        target: targetNum,
        deadline,
        startDate: formatDate(new Date()),
        startingValue: startNum,
        description: description.trim(),
        status: 'active',
        difficultyScore: isSkill ? startNum || 400 : undefined,
        targetDifficulty: isSkill ? targetNum : undefined,
        unitLabel: isSkill ? 'pts' : (unitLabel.trim() || 'units'),
      });

      // Set milestones for execution goals (uses store's regeneratePlan path)
      if (category === 'execution') {
        useGoalStore.getState().regeneratePlan(goalId);
      }
    }

    setSaving(false);
    if (savedGoalId) {
      router.push(buildRoute(ROUTES.GOAL_DETAIL, { goalId: savedGoalId, hobbyId: hobbyId ?? undefined }));
    } else {
      router.back();
    }
  }, [description, target, startingValue, unitLabel, category, deadlineOption, quickDays, customDate, hobbyId, editGoal, router]);

  const canSave = description.trim().length > 0 && parseInt(target, 10) > 0;

  const showTargetFields = category === 'skill' || (category === 'execution' && !showProxyPicker && !proxyLoading) || proxyFailed;
  const showProxyArea = category === 'execution' && !proxyFailed && (proxyLoading || showProxyPicker);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.emoji}>{editGoal ? '✏️' : '🎯'}</Text>
          <Text style={styles.title}>{editGoal ? 'Edit goal' : 'Set your goal'}</Text>
          <Text style={styles.subtitle}>
            {editGoal ? 'Adjust your target, deadline, or unit.' : 'Describe what you want, set a deadline, and go.'}
          </Text>
        </View>

        {/* Description */}
        <View style={styles.field}>
          <TextInput
            style={styles.textInput}
            value={description}
            onChangeText={handleDescriptionChange}
            placeholder="e.g. Reach 1200 chess rating, find 200 influencers, run a 5K"
            placeholderTextColor={colors.textSecondary}
            maxLength={120}
          />
          {description.length > 3 && (
            <View style={styles.inlineBadgeRow}>
              <View style={[styles.inlineBadge, isSkill ? styles.inlineBadgeSkill : styles.inlineBadgeExec]}>
                <Text style={[styles.inlineBadgeText, { color: isSkill ? '#6366F1' : '#D97706' }]}>
                  {isSkill ? '📈 Skill' : '🎯 Execution'}
                </Text>
              </View>
              {(() => {
                const ec = extractCount(description);
                return ec ? (
                  <View style={[styles.inlineBadge, { backgroundColor: '#10B98120' }]}>
                    <Text style={[styles.inlineBadgeText, { color: '#10B981' }]}>
                      {ec.count} {ec.unit}
                    </Text>
                  </View>
                ) : null;
              })()}
            </View>
          )}
        </View>

        {/* Category picker */}
        {!editGoal && (
          <View style={styles.typeRow}>
            <TouchableOpacity
              style={[styles.typeCard, isSkill && styles.typeCardActive]}
              onPress={() => setCategory('skill')}
              activeOpacity={0.7}
            >
              <Text style={[styles.typeTitle, isSkill && styles.typeTitleActive]}>📈 Skill</Text>
              <Text style={[styles.typeDesc, isSkill && styles.typeDescActive]}>Get better through daily practice</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeCard, !isSkill && styles.typeCardActive]}
              onPress={() => setCategory('execution')}
              activeOpacity={0.7}
            >
              <Text style={[styles.typeTitle, !isSkill && styles.typeTitleActive]}>🎯 Execution</Text>
              <Text style={[styles.typeDesc, !isSkill && styles.typeDescActive]}>Hit a real-world number</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Proxy suggestion — dismissible chip, never blocks target fields */}
        {showProxyArea && !proxyLoading && proxyOptions.length > 0 && (
          <View style={styles.proxyChipRow}>
            {proxyOptions.slice(0, 2).map((opt, i) => (
              <TouchableOpacity key={i} style={styles.proxyChip} onPress={() => handlePickProxy(i)} activeOpacity={0.7}>
                <Text style={styles.proxyChipTitle}>{opt.label}</Text>
                <Text style={styles.proxyChipDetail}>{opt.target} {opt.unit} · {opt.deadlineDays}d</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={handleSkipProxy} activeOpacity={0.6}>
              <Text style={styles.proxySkipText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Target + starting value */}
        {showTargetFields && (
          <>
            <View style={styles.row}>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.label}>{isSkill ? 'Target rating' : 'Target count'}</Text>
                <TextInput
                  style={styles.textInput}
                  value={target}
                  onChangeText={setTarget}
                  placeholder={isSkill ? '1200' : '200'}
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="number-pad"
                />
              </View>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.label}>{isSkill ? 'Starting rating' : 'Starting count'}</Text>
                <TextInput
                  style={styles.textInput}
                  value={startingValue}
                  onChangeText={setStartingValue}
                  placeholder={isSkill ? '400' : '0'}
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="number-pad"
                />
              </View>
            </View>
            {!isSkill && (
              <View style={styles.field}>
                <Text style={styles.label}>Unit label</Text>
                <TextInput
                  style={styles.textInput}
                  value={unitLabel}
                  onChangeText={setUnitLabel}
                  placeholder="influencers"
                  placeholderTextColor={colors.textSecondary}
                  maxLength={30}
                />
              </View>
            )}
          </>
        )}

        {/* Deadline — always visible */}
        <View style={styles.field}>
          <Text style={styles.label}>Deadline</Text>
          <View style={styles.deadlineOptions}>
            {QUICK_DEADLINES.map((opt) => (
              <TouchableOpacity
                key={opt.days}
                style={[styles.deadlinePill, deadlineOption === 'quick' && quickDays === opt.days && styles.deadlinePillActive]}
                onPress={() => { setDeadlineOption('quick'); setQuickDays(opt.days); }}
                activeOpacity={0.7}
              >
                <Text style={[styles.deadlinePillText, deadlineOption === 'quick' && quickDays === opt.days && styles.deadlinePillTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Save button — always at bottom */}
        <View style={styles.navRow}>
          <TouchableOpacity
            style={[styles.saveButton, (!canSave || saving) && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={!canSave || saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.saveButtonText}>{editGoal ? 'Save Changes' : 'Create Goal'}</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────

const createStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: scale(24), paddingBottom: scale(48) },
  header: { alignItems: 'center', marginTop: scale(40), marginBottom: scale(32) },
  emoji: { fontSize: scale(48), marginBottom: scale(12) },
  title: { fontFamily: fonts.heading.bold, fontSize: scale(28), color: colors.text, textAlign: 'center' },
  subtitle: { fontFamily: fonts.heading.light, fontSize: scale(18), color: colors.textSecondary, marginTop: scale(4), textAlign: 'center' },
  field: { marginBottom: scale(20) },
  label: { fontFamily: fonts.heading.bold, fontSize: scale(14), color: colors.text, marginBottom: scale(8) },
  textInput: {
    backgroundColor: colors.surfaceLight, borderRadius: scale(12), paddingHorizontal: scale(16),
    paddingVertical: Platform.OS === 'ios' ? scale(14) : scale(10), fontFamily: fonts.body.regular,
    fontSize: scale(16), color: colors.text, borderWidth: 1, borderColor: colors.border,
  },
  row: { flexDirection: 'row', gap: scale(12) },
  inlineBadgeRow: { flexDirection: 'row', gap: scale(8), marginTop: scale(8) },
  inlineBadge: { borderRadius: scale(12), paddingHorizontal: scale(10), paddingVertical: scale(4) },
  inlineBadgeSkill: { backgroundColor: '#6366F120' },
  inlineBadgeExec: { backgroundColor: '#D9770620' },
  inlineBadgeText: { fontFamily: fonts.heading.bold, fontSize: scale(11) },
  typeRow: { flexDirection: 'row', gap: scale(12), marginBottom: scale(20) },
  typeCard: { flex: 1, borderRadius: scale(14), borderWidth: 1.5, borderColor: colors.border, padding: scale(14), backgroundColor: colors.surfaceLight },
  typeCardActive: {
    borderColor: colors.buttonPrimary, backgroundColor: colors.buttonPrimary + '12',
    shadowColor: colors.buttonPrimary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4,
  },
  typeTitle: { fontFamily: fonts.heading.bold, fontSize: scale(13), color: colors.text, marginBottom: scale(4) },
  typeTitleActive: { color: colors.buttonPrimary },
  typeDesc: { fontFamily: fonts.body.regular, fontSize: scale(11), color: colors.textSecondary, lineHeight: scale(15) },
  typeDescActive: { color: colors.text },
  deadlineOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: scale(10) },
  deadlinePill: { borderRadius: scale(20), borderWidth: 1, borderColor: colors.border, paddingHorizontal: scale(18), paddingVertical: scale(10) },
  deadlinePillActive: { backgroundColor: colors.buttonPrimary, borderColor: colors.buttonPrimary },
  deadlinePillText: { fontFamily: fonts.heading.bold, fontSize: scale(14), color: colors.text },
  deadlinePillTextActive: { color: '#FFFFFF' },
  navRow: { flexDirection: 'row', gap: scale(12), marginTop: scale(24) },
  saveButton: { flex: 1, height: scale(50), borderRadius: scale(25), backgroundColor: colors.buttonPrimary, justifyContent: 'center', alignItems: 'center' },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: { fontFamily: fonts.heading.bold, fontSize: scale(16), color: '#FFFFFF' },
  proxyChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: scale(8), alignItems: 'center', marginBottom: scale(16) },
  proxyChip: {
    borderRadius: scale(14), borderWidth: 1, borderColor: colors.buttonPrimary + '60',
    paddingHorizontal: scale(14), paddingVertical: scale(10), backgroundColor: colors.buttonPrimary + '10',
  },
  proxyChipTitle: { fontFamily: fonts.heading.bold, fontSize: scale(12), color: colors.text, marginBottom: scale(2) },
  proxyChipDetail: { fontFamily: fonts.body.regular, fontSize: scale(11), color: colors.textSecondary },
  proxySkipText: { fontFamily: fonts.heading.bold, fontSize: scale(16), color: colors.textSecondary, paddingHorizontal: scale(8), paddingVertical: scale(4) },
  proxyLoading: { alignItems: 'center', paddingVertical: scale(24) },
  proxyLoadingText: { fontFamily: fonts.body.regular, fontSize: scale(14), color: colors.textSecondary, marginTop: scale(12), textAlign: 'center' },
});
