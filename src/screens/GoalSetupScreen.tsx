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
import { useT } from '../store/languageStore';
import { useGoalStore } from '../store/goalStore';
import { useUserProfileStore } from '../store/userProfileStore';
import { GoalCategory } from '../types/goals';
import aiService from '../services/ai';

// ── Keyword heuristic helpers ────────────────────────────

const SKILL_KEYWORDS = [
  'reach', 'improve', 'get better', 'learn', 'master',
  'rating', 'rank', 'level', 'score', 'speed', 'accuracy',
  'be able to', 'complete course', 'finish course', 'certification',
  'run.*km', '5k', '10k', 'marathon',
];

const EXECUTION_KEYWORDS = [
  'find', 'get.*leads', 'get.*clients', 'launch', 'build',
  'create', 'write.*posts', 'collect', 'landing page',
  'influencers', 'outreach', 'signups', 'sales',
];

function guessCategory(description: string, hobbyId: string | null): GoalCategory {
  const lower = description.toLowerCase();
  const skillHobbies = ['chess', 'python', 'coding', 'reading'];
  if (skillHobbies.includes(hobbyId ?? '')) return 'skill';
  for (const kw of SKILL_KEYWORDS) {
    if (new RegExp(kw, 'i').test(lower)) return 'skill';
  }
  for (const kw of EXECUTION_KEYWORDS) {
    if (new RegExp(kw, 'i').test(lower)) return 'execution';
  }
  return 'skill';
}

// Detect if description already has a natural countable unit
const COUNT_PATTERN = /(\d+)\s*(influencers|leads|clients|posts|pages|sales|calls|emails|deals|signups|accounts|dms|messages|projects|articles|videos|episodes|guests|reviews|downloads|users|customers|members|subscribers|followers|views|hours|meetings|apps|features|commits|prs|issues)/i;

const COUNT_ACTION_PATTERN = /(find|get|invite|collect|reach|earn|write|create|build|launch|make|sell|close|send|publish|record|hire|interview|review|test|ship|deploy)\s+(\d+)/i;

function extractCount(description: string): { count: number; unit: string } | null {
  const actionMatch = description.match(COUNT_ACTION_PATTERN);
  if (actionMatch) {
    return { count: parseInt(actionMatch[2], 10), unit: 'units' };
  }
  const countMatch = description.match(COUNT_PATTERN);
  if (countMatch) {
    return { count: parseInt(countMatch[1], 10), unit: countMatch[2].toLowerCase() };
  }
  return null;
}

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

  const [saving, setSaving] = useState(false);

  // Proxy metric state
  const [proxyLoading, setProxyLoading] = useState(false);
  const [proxyOptions, setProxyOptions] = useState<ProxyOption[]>([]);
  const [showProxyPicker, setShowProxyPicker] = useState(false);
  const [proxyFailed, setProxyFailed] = useState(false);

  const isSkill = category === 'skill';

  // When execution is selected and description changes, detect count or show proxy
  useEffect(() => {
    if (category !== 'execution' || description.length < 5) return;

    const extracted = extractCount(description);
    if (extracted) {
      setShowProxyPicker(false);
      setTarget(String(extracted.count));
      setUnitLabel(extracted.unit);
      return;
    }

    if (!proxyLoading && proxyOptions.length === 0 && !proxyFailed) {
      setProxyLoading(true);
      aiService.proposeMetrics(description).then((options) => {
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
  }, [description, category]);

  const handleDescriptionChange = useCallback((text: string) => {
    setDescription(text);
    if (text.length > 3) {
      const guessed = guessCategory(text, hobbyId);
      setCategory(guessed);
      // Reset proxy state when description changes
      setProxyOptions([]);
      setShowProxyPicker(false);
      setProxyFailed(false);
      setTarget('');
      setUnitLabel('');
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

      // Set milestones for execution goals
      if (category === 'execution') {
        aiService.breakDownMilestones(description.trim(), unitLabel || 'units', targetNum, unitLabel || 'units')
          .then((milestones) => {
            if (milestones.length > 0) {
              useGoalStore.getState().setMilestones(goalId, milestones.map(m => ({
                ...m,
                currentValue: 0,
              })));
            }
          })
          .catch(() => {});
      }
    }

    setSaving(false);
    console.log('[GoalSetup] handleSave complete goalId=%s hobbyId=%s category=%s', savedGoalId, hobbyId, category);
    if (savedGoalId) {
      const params = `goalId=${savedGoalId}${hobbyId ? `&hobbyId=${hobbyId}` : ''}`;
      router.push(`/goal-detail?${params}`);
    } else {
      router.back();
    }
  }, [description, target, startingValue, unitLabel, category, deadlineOption, quickDays, customDate, hobbyId, editGoal, router]);

  const [step, setStep] = useState(editGoal ? 3 : 1);
  const totalSteps = 4;

  const canSave = description.trim().length > 0 && parseInt(target, 10) > 0;

  const showTargetFields = category === 'skill' || (category === 'execution' && !showProxyPicker && !proxyLoading) || proxyFailed;
  const showProxyArea = category === 'execution' && !proxyFailed && (proxyLoading || showProxyPicker);

  const nextStep = useCallback(() => {
    if (step === 1 && !description.trim()) return;
    if (step === 3 && !target) return;
    setStep(s => Math.min(s + 1, totalSteps));
  }, [step, description, target, totalSteps]);

  const prevStep = useCallback(() => {
    setStep(s => Math.max(s - 1, 1));
  }, []);

  const stepEmojis = ['🎯', '📌', '🎯', '📅'];
  const stepTitles = ['What do you want to achieve?', 'What kind of goal?', 'Set your target', 'Almost done!'];
  const stepSubtitles = [
    'Describe what you want to accomplish.',
    'Choose how we measure progress.',
    isSkill ? 'What difficulty level do you want to reach?' : 'How many units do you want to hit?',
    'Review and save your goal.',
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Step dots */}
        {!editGoal && (
          <View style={styles.stepDots}>
            {Array.from({ length: totalSteps }, (_, i) => (
              <View key={i} style={[styles.stepDot, i + 1 <= step && styles.stepDotActive]} />
            ))}
          </View>
        )}

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.emoji}>{editGoal ? '✏️' : stepEmojis[step - 1]}</Text>
          <Text style={styles.title}>{editGoal ? 'Edit goal' : stepTitles[step - 1]}</Text>
          <Text style={styles.subtitle}>
            {editGoal ? 'Adjust your target, deadline, or unit.' : stepSubtitles[step - 1]}
          </Text>
        </View>

        {/* ─── Step 1: Description ─────────────────────── */}
        {step === 1 && !editGoal && (
          <View style={styles.field}>
            <Text style={styles.label}>Describe your goal</Text>
            <TextInput
              style={styles.textInput}
              value={description}
              onChangeText={handleDescriptionChange}
              placeholder="e.g. Reach 1200 chess rating, find 200 influencers, run a 5K"
              placeholderTextColor={colors.textSecondary}
              maxLength={120}
            />
          </View>
        )}

        {/* ─── Step 2: Category picker ─────────────────── */}
        {step === 2 && !editGoal && (
          <View style={styles.field}>
            <Text style={styles.label}>Goal type</Text>
            <View style={styles.typeRow}>
              <TouchableOpacity
                style={[styles.typeCard, isSkill && styles.typeCardActive]}
                onPress={() => setCategory('skill')}
                activeOpacity={0.7}
              >
                <View style={styles.typeCardTop}>
                  <Text style={[styles.typeIcon, isSkill && styles.typeIconActive]}>📈</Text>
                  {isSkill && <Text style={styles.typeCheck}>✓</Text>}
                </View>
                <Text style={[styles.typeTitle, isSkill && styles.typeTitleActive]}>Skill</Text>
                <Text style={[styles.typeDesc, isSkill && styles.typeDescActive]}>
                  Get better through daily practice
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeCard, !isSkill && styles.typeCardActive]}
                onPress={() => setCategory('execution')}
                activeOpacity={0.7}
              >
                <View style={styles.typeCardTop}>
                  <Text style={[styles.typeIcon, !isSkill && styles.typeIconActive]}>🎯</Text>
                  {!isSkill && <Text style={styles.typeCheck}>✓</Text>}
                </View>
                <Text style={[styles.typeTitle, !isSkill && styles.typeTitleActive]}>Execution</Text>
                <Text style={[styles.typeDesc, !isSkill && styles.typeDescActive]}>
                  Hit a real-world number
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ─── Step 3: Target ─────────────────────────── */}
        {step === 3 && (
          <>
            {/* Proxy picker */}
            {showProxyArea && (
              <View style={styles.field}>
                {proxyLoading ? (
                  <View style={styles.proxyLoading}>
                    <ActivityIndicator color={colors.buttonPrimary} />
                    <Text style={styles.proxyLoadingText}>
                      Analyzing your goal...
                    </Text>
                  </View>
                ) : (
                  <>
                    <Text style={styles.label}>How should we measure progress?</Text>
                    {proxyOptions.map((opt, i) => (
                      <TouchableOpacity
                        key={i}
                        style={styles.proxyOption}
                        onPress={() => handlePickProxy(i)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.proxyOptionTitle}>{opt.label}</Text>
                        <Text style={styles.proxyOptionDetail}>
                          Target: {opt.target} {opt.unit} in {opt.deadlineDays} days
                        </Text>
                        <Text style={styles.proxyOptionReason}>{opt.reasoning}</Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity style={styles.proxySkip} onPress={handleSkipProxy} activeOpacity={0.7}>
                      <Text style={styles.proxySkipText}>Something else — I'll type it</Text>
                    </TouchableOpacity>
                  </>
                )}
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

            {/* Hint */}
            <Text style={styles.hint}>
              {isSkill
                ? 'We\'ll track your difficulty score as you practice.'
                : 'Check in daily with your real count.'}
            </Text>

            {/* Deadline */}
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
          </>
        )}

        {/* ─── Step 4: Review ─────────────────────────── */}
        {step === 4 && (
          <View style={styles.reviewCard}>
            <Text style={styles.reviewTitle}>{description}</Text>
            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>Type</Text>
              <Text style={styles.reviewValue}>{isSkill ? 'Skill — improve through practice' : 'Execution — hit a concrete number'}</Text>
            </View>
            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>Target</Text>
              <Text style={styles.reviewValue}>{target} {isSkill ? 'pts' : unitLabel || 'units'}</Text>
            </View>
            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>Starting from</Text>
              <Text style={styles.reviewValue}>{startingValue || '0'}</Text>
            </View>
            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>Deadline</Text>
              <Text style={styles.reviewValue}>
                {deadlineOption === 'quick' ? `${quickDays} days` : customDate}
              </Text>
            </View>
            <View style={styles.reviewRow}>
              <Text style={styles.reviewLabel}>Daily pace</Text>
              <Text style={styles.reviewValue}>
                ~{Math.ceil((parseInt(target, 10) - (parseInt(startingValue, 10) || 0)) / quickDays)} per day
              </Text>
            </View>
          </View>
        )}

        {/* Navigation buttons */}
        <View style={styles.navRow}>
          {step > 1 && !editGoal && (
            <TouchableOpacity style={styles.backButton} onPress={prevStep} activeOpacity={0.7}>
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
          )}
          {step < totalSteps && !editGoal ? (
            <TouchableOpacity
              style={[styles.nextButton, (step === 1 && !description.trim()) || (step === 3 && !target) ? styles.nextButtonDisabled : null]}
              onPress={nextStep}
              disabled={(step === 1 && !description.trim()) || (step === 3 && !target)}
              activeOpacity={0.8}
            >
              <Text style={styles.nextButtonText}>Next</Text>
            </TouchableOpacity>
          ) : (
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
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: scale(24),
    paddingBottom: scale(48),
  },
  header: {
    alignItems: 'center',
    marginTop: scale(40),
    marginBottom: scale(32),
  },
  emoji: {
    fontSize: scale(48),
    marginBottom: scale(12),
  },
  title: {
    fontFamily: fonts.heading.bold,
    fontSize: scale(28),
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: fonts.heading.light,
    fontSize: scale(18),
    color: colors.textSecondary,
    marginTop: scale(4),
    textAlign: 'center',
  },
  field: {
    marginBottom: scale(20),
  },
  label: {
    fontFamily: fonts.heading.bold,
    fontSize: scale(14),
    color: colors.text,
    marginBottom: scale(8),
  },
  textInput: {
    backgroundColor: colors.surfaceLight,
    borderRadius: scale(12),
    paddingHorizontal: scale(16),
    paddingVertical: Platform.OS === 'ios' ? scale(14) : scale(10),
    fontFamily: fonts.body.regular,
    fontSize: scale(16),
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    gap: scale(12),
  },
  typeRow: {
    flexDirection: 'row',
    gap: scale(12),
  },
  typeCard: {
    flex: 1,
    borderRadius: scale(14),
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: scale(16),
    backgroundColor: colors.surfaceLight,
  },
  typeCardActive: {
    borderColor: colors.buttonPrimary,
    backgroundColor: colors.buttonPrimary + '12',
    shadowColor: colors.buttonPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  typeCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: scale(10),
  },
  typeIcon: {
    fontSize: scale(32),
  },
  typeIconActive: {},
  typeCheck: {
    fontSize: scale(20),
    color: colors.buttonPrimary,
    fontWeight: '700',
  },
  typeTitle: {
    fontFamily: fonts.heading.bold,
    fontSize: scale(14),
    color: colors.text,
    marginBottom: scale(6),
  },
  typeTitleActive: {
    color: colors.buttonPrimary,
  },
  typeDesc: {
    fontFamily: fonts.body.regular,
    fontSize: scale(11),
    color: colors.textSecondary,
    lineHeight: scale(16),
    marginBottom: scale(10),
  },
  typeDescActive: {
    color: colors.text,
  },
  typeExamples: {
    backgroundColor: colors.surface + '80',
    borderRadius: scale(8),
    padding: scale(10),
    gap: scale(4),
  },
  typeExamplesActive: {
    backgroundColor: colors.buttonPrimary + '10',
  },
  typeExampleText: {
    fontFamily: fonts.body.regular,
    fontSize: scale(11),
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  typeExampleTextActive: {
    color: colors.text,
  },
  hint: {
    fontFamily: fonts.body.regular,
    fontSize: scale(13),
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: scale(18),
    marginBottom: scale(20),
    paddingHorizontal: scale(4),
  },
  deadlineOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(10),
  },
  deadlinePill: {
    borderRadius: scale(20),
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: scale(18),
    paddingVertical: scale(10),
  },
  deadlinePillActive: {
    backgroundColor: colors.buttonPrimary,
    borderColor: colors.buttonPrimary,
  },
  deadlinePillText: {
    fontFamily: fonts.heading.bold,
    fontSize: scale(14),
    color: colors.text,
  },
  deadlinePillTextActive: {
    color: '#FFFFFF',
  },
  // Step wizard
  stepDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: scale(8),
    marginTop: scale(16),
    marginBottom: scale(8),
  },
  stepDot: {
    width: scale(10),
    height: scale(10),
    borderRadius: scale(5),
    backgroundColor: colors.surfaceLight,
  },
  stepDotActive: {
    backgroundColor: colors.buttonPrimary,
    width: scale(28),
    borderRadius: scale(5),
  },
  reviewCard: {
    backgroundColor: colors.surface,
    borderRadius: scale(16),
    padding: scale(20),
    marginBottom: scale(20),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  reviewTitle: {
    fontFamily: fonts.heading.bold,
    fontSize: scale(18),
    color: colors.text,
    marginBottom: scale(16),
  },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: scale(8),
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceLight,
  },
  reviewLabel: {
    fontFamily: fonts.body.regular,
    fontSize: scale(14),
    color: colors.textSecondary,
  },
  reviewValue: {
    fontFamily: fonts.heading.bold,
    fontSize: scale(14),
    color: colors.text,
  },
  navRow: {
    flexDirection: 'row',
    gap: scale(12),
    marginTop: scale(8),
  },
  backButton: {
    flex: 1,
    height: scale(50),
    borderRadius: scale(25),
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontFamily: fonts.heading.bold,
    fontSize: scale(16),
    color: colors.text,
  },
  nextButton: {
    flex: 2,
    height: scale(50),
    borderRadius: scale(25),
    backgroundColor: colors.buttonPrimary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextButtonDisabled: {
    opacity: 0.5,
  },
  nextButtonText: {
    fontFamily: fonts.heading.bold,
    fontSize: scale(16),
    color: '#FFFFFF',
  },
  saveButton: {
    flex: 1,
    height: scale(50),
    borderRadius: scale(25),
    backgroundColor: colors.buttonPrimary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontFamily: fonts.heading.bold,
    fontSize: scale(16),
    color: '#FFFFFF',
  },

  // Proxy picker
  proxyLoading: {
    alignItems: 'center',
    paddingVertical: scale(24),
  },
  proxyLoadingText: {
    fontFamily: fonts.body.regular,
    fontSize: scale(14),
    color: colors.textSecondary,
    marginTop: scale(12),
    textAlign: 'center',
  },
  proxyOption: {
    padding: scale(14),
    borderRadius: scale(12),
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: scale(10),
  },
  proxyOptionTitle: {
    fontFamily: fonts.heading.bold,
    fontSize: scale(15),
    color: colors.text,
    marginBottom: scale(4),
  },
  proxyOptionDetail: {
    fontFamily: fonts.body.regular,
    fontSize: scale(13),
    color: colors.buttonPrimary,
    marginBottom: scale(4),
  },
  proxyOptionReason: {
    fontFamily: fonts.body.regular,
    fontSize: scale(12),
    color: colors.textSecondary,
    lineHeight: scale(16),
  },
  proxySkip: {
    alignItems: 'center',
    paddingVertical: scale(12),
  },
  proxySkipText: {
    fontFamily: fonts.body.regular,
    fontSize: scale(14),
    color: colors.textSecondary,
    textDecorationLine: 'underline',
  },
});
