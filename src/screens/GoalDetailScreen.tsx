import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, Animated, ActivityIndicator, Vibration } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Stop, Line, G } from 'react-native-svg';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { scale } from '../constants';
import { fonts, lightColors as C } from '../theme';
import { useGoalStore, getInitialProgress } from '../store/goalStore';
import { GoalSnapshot, DailyGoalContent } from '../types/goals';
import { getCoachToolsForContext, CoachToolContext } from '../services/coachTools';
import { ROUTES, buildRoute } from '../config/routes';

const XP_PER_DAY = 50;
const XP_PER_LEVEL = 300;
const COLORS = {
  progressGreen: '#059669',
  progressTrack: '#E5E7EB',
  streakOrange: '#F97316',
  levelPurple: '#7C3AED',
  cardBg: '#FFFFFF',
  bg: '#EAF0F8',
  text: '#08132A',
  muted: '#6B7280',
};

function calcLevel(totalXP: number) {
  const level = Math.floor(totalXP / XP_PER_LEVEL) + 1;
  const xpInLevel = totalXP % XP_PER_LEVEL;
  return { level, xpInLevel, xpProgress: (xpInLevel / XP_PER_LEVEL) * 100 };
}

function ProgressRing({ percent, milestones, size = scale(140), strokeWidth = scale(10) }: { percent: number; milestones: number[]; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, percent)) / 100) * circumference;

  return (
    <Svg width={size} height={size}>
      <Defs>
        <LinearGradient id="progressGrad" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#059669" />
          <Stop offset="1" stopColor="#10B981" />
        </LinearGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={radius} stroke={COLORS.progressTrack} strokeWidth={strokeWidth} fill="none" />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="url(#progressGrad)"
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        rotation="-90"
        origin={`${size / 2}, ${size / 2}`}
      />
      {milestones.map((m, i) => {
        const angle = (m / 100) * 360 - 90;
        const rad = (angle * Math.PI) / 180;
        const mx = size / 2 + radius * Math.cos(rad);
        const my = size / 2 + radius * Math.sin(rad);
        return (
          <Circle key={i} cx={mx} cy={my} r={scale(4)} fill="#FFF" stroke="#059669" strokeWidth={2} />
        );
      })}
    </Svg>
  );
}

function XPBar({ xpInLevel, xpProgress }: { xpInLevel: number; xpProgress: number }) {
  return (
    <View style={ss.xpBarOuter}>
      <View style={[ss.xpBarFill, { width: `${xpProgress}%` }]} />
      <Text style={ss.xpBarText}>{xpInLevel}/{XP_PER_LEVEL} XP</Text>
    </View>
  );
}

export default function GoalDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const goalId = params.goalId as string;
  const hobbyFallback = params.hobbyId as string | undefined;
  const goals = useGoalStore(s => s.goals);
  const progressRecords = useGoalStore(s => s.progress);
  const [showMenu, setShowMenu] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [snapshotOverride, setSnapshotOverride] = useState<GoalSnapshot | null>(null);
  const [doneSteps, setDoneSteps] = useState<number[]>([]);
  const [finished, setFinished] = useState(false);
  const [todayContent, setTodayContent] = useState<DailyGoalContent | null>(null);
  const [contentLoading, setContentLoading] = useState(true);
  const fade = useRef(new Animated.Value(0)).current;
  const xpAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => { Animated.timing(fade, { toValue: 1, duration: 600, useNativeDriver: true }).start(); }, []);

  useEffect(() => { setRetryCount(0); }, [goalId]);

  useEffect(() => {
    if (!goals[goalId] && !hobbyFallback && !Object.values(goals).find(g => g.status === 'active')) {
      if (retryCount < 3) { const t = setTimeout(() => setRetryCount(c => c + 1), 500); return () => clearTimeout(t); }
    }
  }, [goalId, hobbyFallback, goals, retryCount]);

  const resolved = useMemo(() => {
    let g = goals[goalId] || Object.values(goals).find(g => g.id === goalId) || null;
    if (g) { const p = progressRecords[g.id] || getInitialProgress(g.id, g.startingValue); return { goal: g, progress: p }; }
    if (progressRecords[goalId]) {
      const stub: any = { id: goalId, hobby: hobbyFallback || 'goal', type: 'execution_count', category: 'execution', target: 1, deadline: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0], startDate: new Date().toISOString().split('T')[0], startingValue: 0, description: 'Goal', status: 'active', unitLabel: 'units' };
      useGoalStore.getState().setGoal(stub); return { goal: stub, progress: progressRecords[goalId] };
    }
    if (hobbyFallback) { const snap = useGoalStore.getState().getSnapshot(hobbyFallback as any); if (snap) return { goal: snap.definition, progress: snap.progress }; }
    const active = Object.values(goals).find(g => g.status === 'active');
    if (active) { const p = progressRecords[active.id] || getInitialProgress(active.id, active.startingValue); return { goal: active, progress: p }; }
    return null;
  }, [goalId, hobbyFallback, goals, progressRecords]);

  const snapshot = useMemo(() => {
    if (snapshotOverride) return snapshotOverride;
    if (!resolved) return null;
    return useGoalStore.getState().getSnapshotById(resolved.goal.id);
  }, [snapshotOverride, resolved]);

  const initContent = snapshot?.progress?.dailyContent?.[new Date().toISOString().split('T')[0]];
  const initContentRef = useRef(false);
  if (initContent && !initContentRef.current) {
    initContentRef.current = true;
    setTodayContent(initContent);
    setContentLoading(false);
  }

  useEffect(() => {
    if (!resolved || !resolved.goal) return;
    initContentRef.current = false;
    setContentLoading(true);
    let cancelled = false;

    useGoalStore.getState().getOrGenerateDailyContent(resolved.goal.id);

    const todayStr = new Date().toISOString().split('T')[0];
    const fresh = useGoalStore.getState().getSnapshotById(resolved.goal.id);
    if (fresh && !cancelled) {
      const c = fresh.progress.dailyContent?.[todayStr];
      if (c) {
        setTodayContent(c);
        setContentLoading(false);
        setSnapshotOverride(fresh);
      }
    }

    return () => { cancelled = true; };
  }, [resolved]);

  if (!resolved) return notFound('Goal not found', router);
  if (!snapshot) return notFound('No progress data', router);

  const goal = snapshot.definition;
  const progress = snapshot.progress;
  const currentVal = (goal.category === 'skill' ? (progress.currentDifficulty ?? goal.difficultyScore ?? 500) : progress.currentValue);
  const targetVal = (goal.category === 'skill' ? (goal.targetDifficulty ?? goal.target) : goal.target);
  const barPct = Math.min(100, Math.max(0, (currentVal / Math.max(1, targetVal)) * 100));
  const isSkill = goal.category === 'skill';
  const unit = goal.unitLabel || (isSkill ? 'pts' : 'units');
  const daysIn = progress.history.length;
  const totalXP = daysIn * XP_PER_DAY;
  const { level, xpInLevel, xpProgress } = calcLevel(totalXP);

  const today = todayContent;
  const learnTitle = today?.learn?.title || '';
  const learnBody = today?.learn?.body || '';
  const doTitle = today?.doNow?.title || '';
  const doInstructions = today?.doNow?.instructions || '';
  const doMinutes = today?.doNow?.estimatedMinutes || 15;
  const focusReason = today?.focusReason;
  const bodyLines = learnBody.split(/[.!?]+\s*/).filter(s => s.trim().length > 0);
  const instrLines = doInstructions.split(/[.!?]+\s*/).filter(s => s.trim().length > 0);
  const hasContent = !contentLoading && today !== null;

  const commit = progress.commitment;
  const yesterdayCommit = progress.yesterdayCommitment;
  const allDone = doneSteps.length === instrLines.length && instrLines.length > 0;
  const milestonePcts = (progress.milestones || []).map(m => Math.min(100, (m.currentValue / Math.max(1, m.target)) * 100));

  const coachToolCtx: CoachToolContext = { snapshot, content: todayContent };
  const agentActions = hasContent ? getCoachToolsForContext(coachToolCtx, 4) : [];

  const handleAbandon = useCallback(() => { Alert.alert('', 'Cannot be undone.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Abandon', style: 'destructive', onPress: () => { useGoalStore.getState().abandonGoal(goal.hobby); router.back(); } }]); }, [goal.hobby, router]);
  const handlePause = useCallback(() => { useGoalStore.getState().pauseGoal(goal.id); setSnapshotOverride(useGoalStore.getState().getSnapshotById(goal.id)); }, [goal.id]);
  const handleResume = useCallback(() => { useGoalStore.getState().resumeGoal(goal.id); setSnapshotOverride(useGoalStore.getState().getSnapshotById(goal.id)); }, [goal.id]);
  const toggleStep = (i: number) => setDoneSteps(p => p.includes(i) ? p.filter(x => x !== i) : [...p, i]);

  const handleChip = useCallback((action: string) => {
    const store = useGoalStore.getState();
    switch (action) {
      case 'did_it':
        // Containment (Phase 1): a tap is attestation, not validated
        // learning — UI-only acknowledgement. Validated progress is written
        // exclusively by the swipe-session finalizer. Numbers on the
        // finished screen therefore move only when a real session did.
        setFinished(true);
        Animated.timing(xpAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
        break;
      case 'stuck':
        if (agentActions.length > 0) {
          const research = agentActions.find(a => a.intent === 'deep_research');
          if (research?.url) {
            Alert.alert('Research', research.reason);
          }
        }
        break;
      case 'swap_task':
        store.recordCoachFeedback(goal.id, 'not_helpful');
        router.push('/(app)/ai-coach');
        break;
      case 'research':
        store.recordCoachFeedback(goal.id, 'not_helpful');
        router.push('/(app)/ai-coach');
        break;
    }
  }, [goal.id, goal.hobby, goal.category, today, agentActions, router, isSkill, xpAnim]);

  const nextLevelXP = XP_PER_LEVEL - xpInLevel;

  if (goal.status === 'completed' || goal.status === 'paused') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center' }}>
        {goal.status === 'completed' ? (
          <><Text style={{ fontSize: scale(48) }}>🏆</Text><Text style={ss.statTxt}>{currentVal}/{targetVal} {unit}</Text><TouchableOpacity style={ss.pill} onPress={() => router.push(ROUTES.GOAL_SETUP)}><Text style={ss.pillTxt}>Set a new goal</Text></TouchableOpacity></>
        ) : (
          <><Text style={{ fontSize: scale(48) }}>⏸</Text><TouchableOpacity style={ss.pill} onPress={handleResume}><Text style={ss.pillTxt}>Resume</Text></TouchableOpacity></>
        )}
      </SafeAreaView>
    );
  }

  if (finished) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
        <ScrollView contentContainerStyle={ss.scroll}>
          <View style={{ alignItems: 'center', paddingTop: scale(60) }}>
            <View style={ss.xpEarned}>
              <Text style={ss.xpEarnedIcon}>⚡</Text>
              <Text style={ss.xpEarnedVal}>+{XP_PER_DAY} XP</Text>
            </View>
            <Text style={ss.doneTitle}>Day {daysIn} complete</Text>
            <View style={ss.doneBody}>
              <Text style={ss.doneBodyText}>
                {level > 1 ? `Level ${level} · ` : ''}{xpInLevel + XP_PER_DAY}/{XP_PER_LEVEL} XP to Level {level + 1}
              </Text>
              <View style={[ss.xpBarOuter, { marginTop: scale(8), width: '100%' }]}>
                <View style={[ss.xpBarFill, { width: `${Math.min(100, ((xpInLevel + XP_PER_DAY) / XP_PER_LEVEL) * 100)}%` }]} />
              </View>
            </View>
            <View style={ss.doneStats}>
              <View style={ss.doneStat}><Text style={ss.doneStatVal}>{Math.round(barPct)}%</Text><Text style={ss.doneStatLbl}>goal</Text></View>
              <View style={ss.doneStat}><Text style={ss.doneStatVal}>🔥{progress.streak}</Text><Text style={ss.doneStatLbl}>streak</Text></View>
              <View style={ss.doneStat}><Text style={ss.doneStatVal}>{Math.round(currentVal)}</Text><Text style={ss.doneStatLbl}>/ {Math.round(targetVal)}</Text></View>
            </View>
            <TouchableOpacity style={ss.pill} onPress={() => router.back()}><Text style={ss.pillTxt}>Back</Text></TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {/* ═══ GAMIFIED HUD ═══ */}
      <View style={ss.hud}>
        <TouchableOpacity onPress={() => router.back()} style={ss.hudLeft}>
          <Text style={ss.hudArrow}>←</Text>
        </TouchableOpacity>
        <View style={ss.hudCenter}>
          <View style={ss.hudLevel}>
            <Text style={ss.hudLevelText}>LVL {level}</Text>
          </View>
          <XPBar xpInLevel={xpInLevel} xpProgress={xpProgress} />
        </View>
        <View style={ss.hudRight}>
          {progress.streak >= 3 && (
            <View style={ss.hudStreak}>
              <Text style={ss.hudStreakIcon}>🔥</Text>
              <Text style={ss.hudStreakVal}>{progress.streak}</Text>
            </View>
          )}
          <TouchableOpacity onPress={() => setShowMenu(!showMenu)}>
            <Text style={ss.hudMenu}>⋯</Text>
          </TouchableOpacity>
        </View>
      </View>
      {showMenu && (
        <View style={ss.dropdown}>
          <TouchableOpacity style={ss.dropItem} onPress={() => { setShowMenu(false); router.push(buildRoute(ROUTES.GOAL_SETUP, { edit: goal.id, hobbyId: goal.hobby }) as any); }}><Text style={ss.dropText}>Edit</Text></TouchableOpacity>
          <TouchableOpacity style={ss.dropItem} onPress={() => { setShowMenu(false); handlePause(); }}><Text style={ss.dropText}>Pause</Text></TouchableOpacity>
          <TouchableOpacity style={ss.dropItem} onPress={() => { setShowMenu(false); handleAbandon(); }}><Text style={[ss.dropText, { color: '#EF4444' }]}>Abandon</Text></TouchableOpacity>
        </View>
      )}

      <ScrollView contentContainerStyle={ss.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fade }}>

          {/* ═══ GOAL + RICH PROGRESS ═══ */}
          <View style={ss.progressSection}>
            <View style={ss.progressLeft}>
              <Text style={ss.progressGoal}>{goal.description}</Text>
              <View style={ss.progressMeta}>
                <Text style={ss.progressMetaText}>
                  {isSkill ? `${Math.round(currentVal)}/${Math.round(targetVal)} pts` : `${Math.round(currentVal)}/${Math.round(targetVal)} ${unit}`}
                </Text>
                <View style={ss.progressMetaDiv} />
                <Text style={[ss.progressMetaText, { color: snapshot.projectedCompletion === 'behind' ? '#EF4444' : '#059669' }]}>
                  {snapshot.projectedCompletion === 'behind' ? 'Behind' : snapshot.projectedCompletion === 'ahead' ? 'Ahead' : 'On track'}
                </Text>
              </View>
              <View style={ss.progressMilestones}>
                {(progress.milestones || []).slice(0, 5).map((m, i) => (
                  <View key={i} style={[ss.milestoneDot, i <= progress.currentMilestoneIndex && ss.milestoneDotActive]} />
                ))}
              </View>
            </View>
            <View style={ss.progressRight}>
              <ProgressRing percent={barPct} milestones={milestonePcts} />
              <Text style={ss.progressRingLabel}>{Math.round(barPct)}%</Text>
            </View>
          </View>

          {/* ═══ COACH ACTION SUMMARY (sharp, what coach built) ═══ */}
          {focusReason && (
            <View style={ss.coachSection}>
              <View style={ss.coachLine} />
              <View style={ss.coachHeader}>
                <Text style={ss.coachHeaderIcon}>⚡</Text>
                <Text style={ss.coachHeaderText}>Coach generated your plan</Text>
              </View>
              <Text style={ss.coachAction}>{focusReason}</Text>
              {yesterdayCommit && !progress.yesterdayCommitmentHonored && (
                <Text style={ss.coachUnresolved}>
                  Yesterday: "{yesterdayCommit.action}" — not logged yet.
                </Text>
              )}
              {commit && (
                <Text style={ss.coachCommit}>Today's pact: {commit.action}</Text>
              )}
            </View>
          )}

          {/* ═══ LOADING ═══ */}
          {contentLoading && (
            <View style={ss.loading}>
              <ActivityIndicator size="small" color="#059669" />
              <Text style={ss.loadingText}>Analyzing goal data...</Text>
            </View>
          )}

          {/* ═══ COACH'S CREATIONS ═══ */}
          {hasContent && (
            <View style={ss.creationsSection}>

              {/* CREATION 1: LESSON */}
              {learnTitle && (
                <View style={ss.creationCard}>
                  <View style={ss.creationBadge}>
                    <Text style={ss.creationBadgeIcon}>📗</Text>
                  </View>
                  <View style={ss.creationBody}>
                    <Text style={ss.creationLabel}>Coach prepared a lesson</Text>
                    <Text style={ss.creationTitle}>{learnTitle}</Text>
                    <View style={ss.creationDiv} />
                    {bodyLines.map((line, i) => (
                      <Text key={i} style={ss.creationText}>• {line.trim()}.</Text>
                    ))}
                  </View>
                </View>
              )}

              {/* CREATION 2: DRILLS / ACTION */}
              {doTitle && (
                <View style={ss.creationCard}>
                  <View style={[ss.creationBadge, { backgroundColor: '#FFF3E0' }]}>
                    <Text style={ss.creationBadgeIcon}>🎯</Text>
                  </View>
                  <View style={ss.creationBody}>
                    <Text style={ss.creationLabel}>Coach created a drill</Text>
                    <Text style={ss.creationTitle}>{doTitle}</Text>
                    <View style={ss.creationDiv} />
                    {instrLines.map((line, i) => {
                      const d = doneSteps.includes(i);
                      return (
                        <TouchableOpacity key={i} style={ss.taskRow} onPress={() => toggleStep(i)} activeOpacity={0.7}>
                          <View style={[ss.chk, d && ss.chkDone]}>
                            {d && <Text style={ss.chkIcon}>✓</Text>}
                          </View>
                          <Text style={[ss.creationText, d && ss.taskDone]}>{line.trim()}</Text>
                        </TouchableOpacity>
                      );
                    })}
                    {doMinutes && (
                      <View style={ss.creationDuration}>
                        <Text style={ss.creationDurationIcon}>⏱</Text>
                        <Text style={ss.creationDurationText}>{doMinutes} min</Text>
                      </View>
                    )}
                  </View>
                </View>
              )}
            </View>
          )}

          {/* ═══ ACTION ROW ═══ */}
          {hasContent && (
            <View style={ss.actionRow}>
              <TouchableOpacity style={[ss.actionBtn, allDone && ss.actionBtnPrimary]} onPress={() => handleChip('did_it')} activeOpacity={0.7}>
                <Text style={[ss.actionBtnText, allDone && ss.actionBtnTextPrimary]}>✓ Complete</Text>
              </TouchableOpacity>
              <TouchableOpacity style={ss.actionBtnSecondary} onPress={() => handleChip('stuck')} activeOpacity={0.7}>
                <Text style={ss.actionBtnSecondaryText}>⚡ Stuck</Text>
              </TouchableOpacity>
              <TouchableOpacity style={ss.actionBtnSecondary} onPress={() => handleChip('swap_task')} activeOpacity={0.7}>
                <Text style={ss.actionBtnSecondaryText}>↻ Swap</Text>
              </TouchableOpacity>
              <TouchableOpacity style={ss.actionBtnSecondary} onPress={() => handleChip('research')} activeOpacity={0.7}>
                <Text style={ss.actionBtnSecondaryText}>🔍 Dig</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ═══ AGENT TOOLS ═══ */}
          {agentActions.length > 0 && (
            <View style={ss.agentRow}>
              {agentActions.map((action, i) => (
                <TouchableOpacity
                  key={i}
                  style={ss.agentBtn}
                  onPress={() => {
                    if (action.route) router.push(action.route as any);
                    else if (action.url) Alert.alert(action.label, action.reason);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={ss.agentBtnEmoji}>{action.emoji}</Text>
                  <Text style={ss.agentBtnLabel}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* ═══ GAMIFIED CTA ═══ */}
          <TouchableOpacity
            style={[ss.cta, { backgroundColor: allDone ? '#059669' : '#CCC' }]}
            disabled={!allDone}
            onPress={() => setFinished(true)}
          >
            <Text style={[ss.ctaText, { color: allDone ? '#FFF' : '#999' }]}>
              {allDone
                ? `Complete → +${XP_PER_DAY} XP`
                : 'Complete each step above'}
            </Text>
          </TouchableOpacity>
          {allDone && (
            <Text style={ss.ctaSub}>
              {nextLevelXP > 0
                ? `${nextLevelXP} XP until Level ${level + 1}`
                : 'Level up ready!'
              }
            </Text>
          )}

        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

function notFound(msg: string, router: any) {
  return (<SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center' }}><Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(18), color: '#666' }}>{msg}</Text><TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16, paddingHorizontal: scale(24), paddingVertical: scale(12), backgroundColor: '#102852', borderRadius: scale(24) }}><Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(14), color: '#FFF' }}>Back</Text></TouchableOpacity></SafeAreaView>);
}

const ss = StyleSheet.create({
  hud: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    paddingVertical: scale(10),
    backgroundColor: COLORS.bg,
    gap: scale(10),
  },
  hudLeft: { padding: scale(4) },
  hudArrow: { fontSize: scale(22), color: COLORS.text, fontFamily: fonts.heading.bold },
  hudCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: scale(8) },
  hudLevel: {
    backgroundColor: COLORS.levelPurple,
    borderRadius: scale(6),
    paddingHorizontal: scale(8),
    paddingVertical: scale(3),
  },
  hudLevelText: { fontFamily: fonts.heading.bold, fontSize: scale(11), color: '#FFF' },
  hudRight: { flexDirection: 'row', alignItems: 'center', gap: scale(8) },
  hudStreak: { flexDirection: 'row', alignItems: 'center', gap: scale(3) },
  hudStreakIcon: { fontSize: scale(14) },
  hudStreakVal: { fontFamily: fonts.heading.bold, fontSize: scale(13), color: COLORS.streakOrange },
  hudMenu: { fontSize: scale(20), color: '#999', paddingHorizontal: scale(4) },

  dropdown: { position: 'absolute', top: scale(56), left: scale(20), right: scale(20), zIndex: 100, backgroundColor: '#FFF', borderRadius: scale(12), borderWidth: 1, borderColor: '#E5E5E5', paddingVertical: scale(4) },
  dropItem: { paddingHorizontal: scale(16), paddingVertical: scale(12), borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  dropText: { fontFamily: fonts.body.regular, fontSize: scale(14) },
  scroll: { padding: scale(16), paddingBottom: scale(40) },

  /* ═══ XP BAR ═══ */
  xpBarOuter: {
    height: scale(6),
    backgroundColor: '#E5E7EB',
    borderRadius: scale(3),
    overflow: 'hidden',
    flex: 1,
    maxWidth: scale(120),
  },
  xpBarFill: { height: '100%', backgroundColor: COLORS.levelPurple, borderRadius: scale(3) },
  xpBarText: { fontFamily: fonts.body.regular, fontSize: scale(8), color: '#999', position: 'absolute', right: scale(4), top: -scale(1) },

  /* ═══ PROGRESS SECTION ═══ */
  progressSection: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: scale(20),
    padding: scale(18),
    marginBottom: scale(14),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  progressLeft: { flex: 1, justifyContent: 'center' },
  progressGoal: { fontFamily: fonts.heading.bold, fontSize: scale(18), color: COLORS.text, lineHeight: scale(22), marginBottom: scale(8) },
  progressMeta: { flexDirection: 'row', alignItems: 'center', gap: scale(8), marginBottom: scale(10) },
  progressMetaText: { fontFamily: fonts.heading.bold, fontSize: scale(12), color: COLORS.muted },
  progressMetaDiv: { width: scale(3), height: scale(3), borderRadius: scale(1.5), backgroundColor: '#CCC' },
  progressMilestones: { flexDirection: 'row', gap: scale(6) },
  milestoneDot: { width: scale(8), height: scale(8), borderRadius: scale(4), backgroundColor: COLORS.progressTrack },
  milestoneDotActive: { backgroundColor: COLORS.progressGreen },
  progressRight: { alignItems: 'center', justifyContent: 'center', marginLeft: scale(12) },
  progressRingLabel: { fontFamily: fonts.heading.bold, fontSize: scale(14), color: COLORS.progressGreen, position: 'absolute', top: '42%' },

  /* ═══ COACH SECTION ═══ */
  coachSection: {
    backgroundColor: '#FFF',
    borderRadius: scale(16),
    padding: scale(16),
    marginBottom: scale(14),
    borderLeftWidth: scale(3),
    borderLeftColor: COLORS.progressGreen,
  },
  coachLine: {},
  coachHeader: { flexDirection: 'row', alignItems: 'center', gap: scale(6), marginBottom: scale(8) },
  coachHeaderIcon: { fontSize: scale(14) },
  coachHeaderText: { fontFamily: fonts.heading.bold, fontSize: scale(11), color: COLORS.muted, textTransform: 'uppercase', letterSpacing: scale(0.5) },
  coachAction: { fontFamily: fonts.body.regular, fontSize: scale(14), color: COLORS.text, lineHeight: scale(19) },
  coachUnresolved: { fontFamily: fonts.body.regular, fontSize: scale(12), color: '#EF4444', marginTop: scale(8), lineHeight: scale(16) },
  coachCommit: { fontFamily: fonts.heading.bold, fontSize: scale(12), color: COLORS.progressGreen, marginTop: scale(8) },

  /* ═══ LOADING ═══ */
  loading: { alignItems: 'center', paddingVertical: scale(32), marginBottom: scale(12) },
  loadingText: { fontFamily: fonts.body.regular, fontSize: scale(13), color: '#999', marginTop: scale(12) },

  /* ═══ CREATIONS SECTION ═══ */
  creationsSection: { marginBottom: scale(12) },

  creationCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: scale(16),
    marginBottom: scale(10),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    overflow: 'hidden',
  },
  creationBadge: {
    width: scale(44),
    backgroundColor: '#E8F5E9',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: scale(16),
  },
  creationBadgeIcon: { fontSize: scale(18) },
  creationBody: { flex: 1, padding: scale(14) },
  creationLabel: { fontFamily: fonts.heading.bold, fontSize: scale(9), color: '#999', textTransform: 'uppercase', letterSpacing: scale(0.5), marginBottom: scale(4) },
  creationTitle: { fontFamily: fonts.heading.bold, fontSize: scale(15), color: COLORS.text, lineHeight: scale(19), marginBottom: scale(2) },
  creationDiv: { height: 1, backgroundColor: '#F0F0F0', marginVertical: scale(8) },
  creationText: { fontFamily: fonts.body.regular, fontSize: scale(13), color: COLORS.text, lineHeight: scale(19), marginBottom: scale(3) },
  creationDuration: { flexDirection: 'row', alignItems: 'center', gap: scale(4), marginTop: scale(8) },
  creationDurationIcon: { fontSize: scale(11) },
  creationDurationText: { fontFamily: fonts.body.regular, fontSize: scale(11), color: '#999' },

  /* ═══ TASK ROWS ═══ */
  taskRow: { flexDirection: 'row', gap: scale(8), alignItems: 'flex-start', marginBottom: scale(6) },
  chk: { width: scale(18), height: scale(18), borderRadius: scale(9), borderWidth: 2, borderColor: '#CCC', justifyContent: 'center', alignItems: 'center', marginTop: scale(2) },
  chkDone: { backgroundColor: COLORS.progressGreen, borderColor: COLORS.progressGreen },
  chkIcon: { fontSize: scale(11), color: '#FFF', fontFamily: fonts.heading.bold },
  taskDone: { textDecorationLine: 'line-through', color: '#999' },

  /* ═══ ACTION ROW ═══ */
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: scale(8), marginBottom: scale(14) },
  actionBtn: {
    borderRadius: scale(20),
    borderWidth: 1,
    borderColor: COLORS.progressGreen,
    paddingHorizontal: scale(16),
    paddingVertical: scale(9),
    backgroundColor: '#FFF',
  },
  actionBtnPrimary: { backgroundColor: COLORS.progressGreen },
  actionBtnText: { fontFamily: fonts.heading.bold, fontSize: scale(12), color: COLORS.progressGreen },
  actionBtnTextPrimary: { color: '#FFF' },
  actionBtnSecondary: {
    borderRadius: scale(20),
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingHorizontal: scale(14),
    paddingVertical: scale(9),
    backgroundColor: '#FFF',
  },
  actionBtnSecondaryText: { fontFamily: fonts.heading.bold, fontSize: scale(12), color: COLORS.muted },

  /* ═══ AGENT TOOLS ═══ */
  agentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: scale(8), marginBottom: scale(10) },
  agentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    borderRadius: scale(12),
    backgroundColor: '#F0F5FF',
    paddingHorizontal: scale(12),
    paddingVertical: scale(10),
    borderWidth: 1,
    borderColor: '#D0DFFF',
  },
  agentBtnEmoji: { fontSize: scale(14) },
  agentBtnLabel: { fontFamily: fonts.heading.bold, fontSize: scale(11), color: '#1E40AF' },

  /* ═══ GAMIFIED CTA ═══ */
  cta: {
    borderRadius: scale(14),
    paddingVertical: scale(15),
    alignItems: 'center',
    marginTop: scale(6),
  },
  ctaText: { fontFamily: fonts.heading.bold, fontSize: scale(15) },
  ctaSub: { fontFamily: fonts.body.regular, fontSize: scale(11), color: '#999', textAlign: 'center', marginTop: scale(6) },

  /* ═══ DONE (finished state) ═══ */
  xpEarned: { flexDirection: 'row', alignItems: 'center', gap: scale(6), marginBottom: scale(8) },
  xpEarnedIcon: { fontSize: scale(24) },
  xpEarnedVal: { fontFamily: fonts.heading.bold, fontSize: scale(22), color: COLORS.levelPurple },
  doneTitle: { fontFamily: fonts.heading.bold, fontSize: scale(20), color: COLORS.text, marginBottom: scale(6) },
  doneBody: { paddingHorizontal: scale(20), marginBottom: scale(20), alignItems: 'center' },
  doneBodyText: { fontFamily: fonts.body.regular, fontSize: scale(13), color: '#666', textAlign: 'center' },
  doneStats: { flexDirection: 'row', gap: scale(8) },
  doneStat: { backgroundColor: '#FFF', borderRadius: scale(12), padding: scale(12), alignItems: 'center', minWidth: scale(80) },
  doneStatVal: { fontFamily: fonts.heading.bold, fontSize: scale(16) },
  doneStatLbl: { fontFamily: fonts.body.regular, fontSize: scale(9), color: '#888', marginTop: scale(2) },

  pill: { borderRadius: scale(24), paddingHorizontal: scale(24), paddingVertical: scale(12), backgroundColor: '#102852', marginTop: scale(20) },
  pillTxt: { fontFamily: fonts.heading.bold, fontSize: scale(14), color: '#FFF' },
  statTxt: { fontFamily: fonts.heading.bold, fontSize: scale(18), color: '#08132A', marginBottom: scale(16) },
});
