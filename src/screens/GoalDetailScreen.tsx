import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, Animated, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { scale } from '../constants';
import { fonts } from '../theme';
import { useGoalStore, getInitialProgress } from '../store/goalStore';
import { GoalSnapshot, DailyGoalContent } from '../types/goals';
import { getCoachToolsForContext, CoachToolContext } from '../services/coachTools';
import { ROUTES, buildRoute } from '../config/routes';

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

  useEffect(() => { Animated.timing(fade, { toValue: 1, duration: 600, useNativeDriver: true }).start(); }, []);

  // Reset retryCount when goalId changes (fixes stale retries across navigation)
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

  // Always call useMemo (never short-circuit with ??) to keep hook order stable
  const snapshot = useMemo(() => {
    if (snapshotOverride) return snapshotOverride;
    if (!resolved) return null;
    return useGoalStore.getState().getSnapshotById(resolved.goal.id);
  }, [snapshotOverride, resolved]);

  // ── Content fetching (fix: missing trigger bug) ─────────
  // Check for pre-existing content in snapshot to avoid loading flash
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

    // Call async gen: stores fallback SYNCHRONOUSLY before the first await (AI).
    useGoalStore.getState().getOrGenerateDailyContent(resolved.goal.id);

    // Read the fallback from the store immediately (AI is still running in bg)
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

  const today = todayContent;
  const learnTitle = today?.learn?.title || '';
  const learnBody = today?.learn?.body || '';
  const doTitle = today?.doNow?.title || '';
  const doInstructions = today?.doNow?.instructions || '';
  const doMinutes = today?.doNow?.estimatedMinutes || 15;
  const focusReason = today?.focusReason;
  const bodyLines = learnBody.split(/[.!?]+\s*/).filter(s => s.trim().length > 0);
  const instrLines = doInstructions.split(/[.!?]+\s*/).filter(s => s.trim().length > 0);

  const plan = progress.planOfAttack;
  const curStep = plan?.steps?.[plan?.currentStepIndex ?? -1];
  const totalSteps = plan?.steps?.length ?? 0;
  const commit = progress.commitment;
  const yesterdayCommit = progress.yesterdayCommitment;
  const allDone = doneSteps.length === instrLines.length && instrLines.length > 0;
  const hasContent = !contentLoading && today !== null;

  // Agent tools context
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
        store.recordDailyAction(goal.hobby, 1, `delegated: ${today?.doNow?.title || ''}`);
        store.completeDailyContent(goal.id);
        if (isSkill && today?.focusReason) {
          store.adjustDifficulty(goal.hobby, 'completed_easy');
        }
        setFinished(true);
        break;
      case 'stuck':
        if (agentActions.length > 0) {
          const research = agentActions.find(a => a.intent === 'deep_research');
          if (research?.url) {
            Alert.alert('Research', `Coach suggests: ${research.reason}\nWe'll open this externally: ${research.url}`);
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
  }, [goal.id, goal.hobby, goal.category, today, agentActions, router, isSkill]);

  if (goal.status === 'completed' || goal.status === 'paused') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#EAF0F8', justifyContent: 'center', alignItems: 'center' }}>
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
      <SafeAreaView style={{ flex: 1, backgroundColor: '#EAF0F8' }}>
        <ScrollView contentContainerStyle={ss.scroll}>
          <View style={{ alignItems: 'center', paddingTop: scale(60) }}>
            <Text style={{ fontSize: scale(48), marginBottom: scale(12) }}>🎉</Text>
            <Text style={ss.doneTitle}>Today's work done.</Text>
            <Text style={ss.doneBody}>You learned + practiced. One more day closer to your goal.</Text>
            <View style={ss.doneStats}>
              <View style={ss.doneStat}><Text style={ss.doneStatVal}>{Math.round(barPct)}%</Text><Text style={ss.doneStatLbl}>toward goal</Text></View>
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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#EAF0F8' }}>
      <View style={ss.hdr}>
        <TouchableOpacity onPress={() => router.back()}><Text style={ss.hdrBtn}>←</Text></TouchableOpacity>
        <Text style={ss.hdrDay}>Day {daysIn} · {Math.round(barPct)}%</Text>
        <TouchableOpacity onPress={() => setShowMenu(!showMenu)}><Text style={[ss.hdrBtn, { color: '#999' }]}>⋯</Text></TouchableOpacity>
      </View>
      {showMenu && (
        <View style={ss.dropdown}>
          <TouchableOpacity style={ss.dropItem} onPress={() => { setShowMenu(false); router.push(buildRoute(ROUTES.GOAL_SETUP, { edit: goal.id, hobbyId: goal.hobby })); }}><Text style={ss.dropText}>Edit</Text></TouchableOpacity>
          <TouchableOpacity style={ss.dropItem} onPress={() => { setShowMenu(false); handlePause(); }}><Text style={ss.dropText}>Pause</Text></TouchableOpacity>
          <TouchableOpacity style={ss.dropItem} onPress={() => { setShowMenu(false); handleAbandon(); }}><Text style={[ss.dropText, { color: '#EF4444' }]}>Abandon</Text></TouchableOpacity>
        </View>
      )}

      <ScrollView contentContainerStyle={ss.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fade }}>

          {/* ═══ COACH MESSAGE ═══ */}
          <View style={ss.msgCoach}>
            <View style={ss.msgCoachDot} />
            <View style={ss.msgCoachBubble}>
              <Text style={ss.msgCoachGoal}>{goal.description}</Text>
              {focusReason && <Text style={ss.msgCoachFocus}>{focusReason}</Text>}
              {plan && curStep && (
                <Text style={ss.msgCoachPlan}>Step {plan.currentStepIndex + 1}/{totalSteps}: {curStep.label}</Text>
              )}
              {commit && (
                <View style={ss.msgCoachDiv} />
              )}
              {commit && (
                <Text style={ss.msgCoachCommit}>🎯 You committed: {commit.action}</Text>
              )}
              {yesterdayCommit && !progress.yesterdayCommitmentHonored && (
                <Text style={ss.msgCoachNudge}>↻ Yesterday's commitment ({yesterdayCommit.action}) — still time to follow through.</Text>
              )}
            </View>
          </View>

          {/* ═══ STEP PROGRESS STRIP ═══ */}
          {plan && totalSteps > 0 && (
            <View style={ss.progressStrip}>
              <Text style={ss.progressLabel}>Plan progress</Text>
              <View style={ss.progressBarRow}>
                <View style={ss.progressBarTrack}>
                  <View style={[ss.progressBarFill, { width: `${Math.min(100, ((plan.currentStepIndex + 1) / totalSteps) * 100)}%` }]} />
                </View>
                <Text style={ss.progressText}>{plan.currentStepIndex + 1}/{totalSteps}</Text>
              </View>
            </View>
          )}

          {/* ═══ LOADING SKELLETON ═══ */}
          {contentLoading && (
            <View style={ss.loadingContainer}>
              <ActivityIndicator size="small" color="#059669" />
              <Text style={ss.loadingText}>Coach is reviewing your plan...</Text>
            </View>
          )}

          {/* ═══ LESSON — NO LABEL ═══ */}
          {hasContent && learnTitle && (
            <View style={ss.msg}>
              <Text style={ss.msgIcon}>📖</Text>
              <View style={ss.msgBubble}>
                <Text style={ss.msgTitle}>{learnTitle}</Text>
                <View style={ss.msgDiv} />
                {bodyLines.map((line, i) => (
                  <Text key={i} style={ss.msgBody}>• {line.trim()}.</Text>
                ))}
              </View>
            </View>
          )}

          {/* ═══ TASK — NO LABEL ═══ */}
          {hasContent && doTitle && (
            <View style={ss.msg}>
              <Text style={ss.msgIcon}>🎯</Text>
              <View style={ss.msgBubble}>
                <View style={ss.msgTaskHdr}>
                  <Text style={ss.msgTitle}>{doTitle}</Text>
                  <Text style={ss.msgTime}>{doMinutes} min</Text>
                </View>
                <View style={ss.msgDiv} />
                {instrLines.map((line, i) => {
                  const d = doneSteps.includes(i);
                  return (
                    <TouchableOpacity key={i} style={ss.taskRow} onPress={() => toggleStep(i)} activeOpacity={0.7}>
                      <View style={[ss.chk, d && { backgroundColor: '#059669', borderColor: '#059669' }]}>
                        {d && <Text style={ss.chkIcon}>✓</Text>}
                      </View>
                      <Text style={[ss.msgBody, d && { textDecorationLine: 'line-through', color: '#999' }]}>{line.trim()}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* ═══ QUICK REPLY CHIPS ═══ */}
          {hasContent && (
            <View style={ss.chipRow}>
              <TouchableOpacity style={ss.chip} onPress={() => handleChip('did_it')} activeOpacity={0.7}>
                <Text style={ss.chipText}>✓ Done</Text>
              </TouchableOpacity>
              <TouchableOpacity style={ss.chip} onPress={() => handleChip('stuck')} activeOpacity={0.7}>
                <Text style={ss.chipText}>⚡ Too much</Text>
              </TouchableOpacity>
              <TouchableOpacity style={ss.chip} onPress={() => handleChip('swap_task')} activeOpacity={0.7}>
                <Text style={ss.chipText}>🔄 Give me another</Text>
              </TouchableOpacity>
              <TouchableOpacity style={ss.chip} onPress={() => handleChip('research')} activeOpacity={0.7}>
                <Text style={ss.chipText}>🔍 Research</Text>
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
                    else if (action.url) Alert.alert('Open externally', `${action.label}\n${action.reason}`);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={ss.agentBtnEmoji}>{action.emoji}</Text>
                  <Text style={ss.agentBtnLabel}>{action.label}</Text>
                  <Text style={ss.agentBtnReason}>{action.reason}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* ═══ DONE ═══ */}
          <TouchableOpacity
            style={[ss.doneBtn, { backgroundColor: allDone ? '#059669' : '#CCC' }]}
            disabled={!allDone}
            onPress={() => setFinished(true)}
          >
            <Text style={[ss.doneBtnTxt, { color: allDone ? '#FFF' : '#999' }]}>
              {allDone ? "✓ Done — I'm finished" : 'Check off each step above'}
            </Text>
          </TouchableOpacity>

        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

function notFound(msg: string, router: any) {
  return (<SafeAreaView style={{ flex: 1, backgroundColor: '#EAF0F8', justifyContent: 'center', alignItems: 'center' }}><Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(18), color: '#666' }}>{msg}</Text><TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16, paddingHorizontal: scale(24), paddingVertical: scale(12), backgroundColor: '#102852', borderRadius: scale(24) }}><Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(14), color: '#FFF' }}>Back</Text></TouchableOpacity></SafeAreaView>);
}

const ss = StyleSheet.create({
  hdr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: scale(16), paddingVertical: scale(10), backgroundColor: '#EAF0F8' },
  hdrBtn: { fontSize: scale(22), color: '#333' },
  hdrDay: { fontFamily: fonts.heading.bold, fontSize: scale(11), color: '#888' },
  dropdown: { position: 'absolute', top: scale(56), left: scale(20), right: scale(20), zIndex: 100, backgroundColor: '#FFF', borderRadius: scale(12), borderWidth: 1, borderColor: '#E5E5E5', paddingVertical: scale(4) },
  dropItem: { paddingHorizontal: scale(16), paddingVertical: scale(12), borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  dropText: { fontFamily: fonts.body.regular, fontSize: scale(14) },
  pill: { borderRadius: scale(24), paddingHorizontal: scale(24), paddingVertical: scale(12), backgroundColor: '#102852', marginTop: scale(20) },
  pillTxt: { fontFamily: fonts.heading.bold, fontSize: scale(14), color: '#FFF' },
  statTxt: { fontFamily: fonts.heading.bold, fontSize: scale(18), color: '#08132A', marginBottom: scale(16) },
  scroll: { padding: scale(16), paddingBottom: scale(40) },

  /* ═══ COACH MESSAGE ═══ */
  msgCoach: { flexDirection: 'row', gap: scale(10), marginBottom: scale(12) },
  msgCoachDot: { width: scale(8), height: scale(8), borderRadius: scale(4), backgroundColor: '#059669', marginTop: scale(6) },
  msgCoachBubble: {
    backgroundColor: '#059669', borderRadius: scale(16), borderBottomLeftRadius: scale(4),
    padding: scale(14), flex: 1,
  },
  msgCoachGoal: { fontFamily: fonts.heading.bold, fontSize: scale(15), color: '#FFF', marginBottom: scale(4), lineHeight: scale(19) },
  msgCoachFocus: { fontFamily: fonts.body.regular, fontSize: scale(12), color: '#FFFFFFDD', lineHeight: scale(16), marginBottom: scale(4) },
  msgCoachPlan: { fontFamily: fonts.body.regular, fontSize: scale(11), color: '#FFFFFFBB', lineHeight: scale(14), marginBottom: scale(4) },
  msgCoachDiv: { height: 1, backgroundColor: '#FFFFFF33', marginVertical: scale(6) },
  msgCoachCommit: { fontFamily: fonts.body.regular, fontSize: scale(11), color: '#FFFFFFBB', lineHeight: scale(14) },
  msgCoachNudge: { fontFamily: fonts.body.regular, fontSize: scale(10), color: '#FFFFFF99', marginTop: scale(4), lineHeight: scale(13), fontStyle: 'italic' },

  /* ═══ STEP PROGRESS STRIP ═══ */
  progressStrip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: scale(12), paddingHorizontal: scale(2) },
  progressLabel: { fontFamily: fonts.body.regular, fontSize: scale(10), color: '#999', textTransform: 'uppercase', letterSpacing: scale(0.5) },
  progressBarRow: { flexDirection: 'row', alignItems: 'center', gap: scale(8) },
  progressBarTrack: { width: scale(80), height: scale(4), backgroundColor: '#D0D0D0', borderRadius: scale(2), overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#059669', borderRadius: scale(2) },
  progressText: { fontFamily: fonts.heading.bold, fontSize: scale(10), color: '#888' },

  /* ═══ LOADING ═══ */
  loadingContainer: { alignItems: 'center', paddingVertical: scale(32) },
  loadingText: { fontFamily: fonts.body.regular, fontSize: scale(13), color: '#999', marginTop: scale(12) },

  /* ═══ CONTENT BUBBLES ═══ */
  msg: { flexDirection: 'row', gap: scale(10), marginBottom: scale(10) },
  msgIcon: { fontSize: scale(16), marginTop: scale(8), width: scale(22) },
  msgBubble: { backgroundColor: '#FFF', borderRadius: scale(16), padding: scale(14), flex: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  msgTitle: { fontFamily: fonts.heading.bold, fontSize: scale(15), color: '#1E1E2E', lineHeight: scale(19), marginBottom: scale(2) },
  msgTime: { fontFamily: fonts.body.regular, fontSize: scale(11), color: '#999' },
  msgTaskHdr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  msgDiv: { height: 1, backgroundColor: '#F0F0F0', marginVertical: scale(8) },
  msgBody: { fontFamily: fonts.body.regular, fontSize: scale(13), color: '#1E1E2E', lineHeight: scale(19), marginBottom: scale(2) },

  taskRow: { flexDirection: 'row', gap: scale(8), alignItems: 'flex-start', marginBottom: scale(6) },
  chk: { width: scale(18), height: scale(18), borderRadius: scale(9), borderWidth: 2, borderColor: '#CCC', justifyContent: 'center', alignItems: 'center', marginTop: scale(2) },
  chkIcon: { fontSize: scale(11), color: '#FFF', fontFamily: fonts.heading.bold },

  /* ═══ QUICK REPLY CHIPS ═══ */
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: scale(8), marginBottom: scale(14) },
  chip: { borderRadius: scale(20), borderWidth: 1, borderColor: '#05966944', paddingHorizontal: scale(14), paddingVertical: scale(8), backgroundColor: '#FFFFFF' },
  chipText: { fontFamily: fonts.heading.bold, fontSize: scale(12), color: '#059669' },

  /* ═══ AGENT TOOLS ═══ */
  agentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: scale(8), marginBottom: scale(10) },
  agentBtn: { flexDirection: 'row', alignItems: 'center', gap: scale(6), borderRadius: scale(12), backgroundColor: '#F0F5FF', paddingHorizontal: scale(12), paddingVertical: scale(10), borderWidth: 1, borderColor: '#D0DFFF' },
  agentBtnEmoji: { fontSize: scale(14) },
  agentBtnLabel: { fontFamily: fonts.heading.bold, fontSize: scale(11), color: '#1E40AF' },
  agentBtnReason: { fontFamily: fonts.body.regular, fontSize: scale(9), color: '#1E40AF99', maxWidth: scale(100) },

  /* ═══ DONE ═══ */
  doneBtn: { borderRadius: scale(14), paddingVertical: scale(14), alignItems: 'center', marginTop: scale(6) },
  doneBtnTxt: { fontFamily: fonts.heading.bold, fontSize: scale(15) },

  doneTitle: { fontFamily: fonts.heading.bold, fontSize: scale(22), color: '#1E1E2E', marginBottom: scale(8) },
  doneBody: { fontFamily: fonts.body.regular, fontSize: scale(13), color: '#666', textAlign: 'center', lineHeight: scale(18), marginBottom: scale(20) },
  doneStats: { flexDirection: 'row', gap: scale(8) },
  doneStat: { backgroundColor: '#FFF', borderRadius: scale(12), padding: scale(12), alignItems: 'center', minWidth: scale(80) },
  doneStatVal: { fontFamily: fonts.heading.bold, fontSize: scale(16) },
  doneStatLbl: { fontFamily: fonts.body.regular, fontSize: scale(9), color: '#888', marginTop: scale(2) },
});
