import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Linking, LayoutAnimation, Platform, UIManager } from 'react-native';
import { scale } from '../../constants';
import { fonts } from '../../theme';
import { useGoalStore } from '../../store/goalStore';
import { GoalSnapshot, DailyGoalContent } from '../../types/goals';
import { deriveDailyTile } from '../../services/goalPlanService';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface DailyGoalCardProps {
  snapshot: GoalSnapshot;
  colors: any;
  onRefresh?: (next: GoalSnapshot | null) => void;
}

type CardPhase = 'content' | 'rating' | 'done';

function computeCoachStreak(history: string[]): number {
  if (!history.length) return 0;
  let streak = 0;
  const d = new Date();
  while (history.includes(d.toISOString().split('T')[0])) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

const COACH_QUOTES: Record<string, string> = {
  milestone: 'Every master started as a beginner.',
  tactical: 'Small steps, repeated daily, create results.',
  tools: 'The right approach makes the hard things easy.',
  troubleshoot: 'Obstacles are just detours in disguise.',
};

export const DailyGoalCard: React.FC<DailyGoalCardProps> = ({ snapshot, colors, onRefresh }) => {
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const goalId = snapshot.definition.id;
  const isSkill = snapshot.definition.category === 'skill';

  // Subscribe to live progress so card reflects plan/commit updates
  // regardless of whether the parent's snapshot prop is fresh.
  const liveProgress = useGoalStore((state) =>
    state.progress[goalId] || snapshot.progress
  );
  const mode = liveProgress.currentMode;

  const [content, setContent] = useState<DailyGoalContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<CardPhase>('content');
  const [actionInFlight, setActionInFlight] = useState(false);

  const coachHistory = liveProgress.dailyCoachHistory ?? [];
  const coachStreak = computeCoachStreak(coachHistory);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    useGoalStore.getState().getOrGenerateDailyContent(goalId).then((c) => {
      if (!cancelled) {
        setContent(c);
        if (c?.completedAt) setPhase('done');
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [goalId]);

  const animatePhase = (next: CardPhase) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setPhase(next);
  };

  const doRecordDone = useCallback(() => {
    const store = useGoalStore.getState();
    const goal = snapshot.definition;

    if (isSkill) {
      store.recordDailyAction(goal.hobby, 1, `coach: ${content!.doNow.title}`);
    } else {
      store.recordCheckin(liveProgress.currentValue, `coach: ${content!.doNow.title}`, undefined, goal.hobby);
    }
    store.completeDailyContent(goalId);
    store.recordCoachFeedback(goalId, 'helpful');
    setContent(c => c ? { ...c, completedAt: new Date().toISOString() } : c);
    setActionInFlight(false);
    animatePhase('rating');
  }, [content, goalId, snapshot, isSkill, liveProgress.currentValue]);

  const handleMarkDone = useCallback(() => {
    if (!content || content.completedAt || actionInFlight) return;
    setActionInFlight(true);
    doRecordDone();
  }, [content, actionInFlight, doRecordDone]);

  const handleSkip = useCallback(() => {
    if (!content || content.completedAt || actionInFlight) return;
    setActionInFlight(true);
    const store = useGoalStore.getState();
    store.completeDailyContent(goalId);
    store.recordCoachFeedback(goalId, 'skipped');
    setContent(c => c ? { ...c, completedAt: new Date().toISOString() } : c);
    setActionInFlight(false);
    animatePhase('done');
    onRefresh?.(store.getSnapshotById(goalId));
  }, [content, goalId, actionInFlight, onRefresh]);

  const handleRating = useCallback((result: 'completed_easy' | 'completed_struggled' | 'skipped') => {
    const store = useGoalStore.getState();
    if (isSkill && result !== 'skipped') {
      store.adjustDifficulty(snapshot.definition.hobby, result);
    }
    if (result === 'skipped') {
      store.recordCoachFeedback(goalId, 'not_helpful');
    }
    animatePhase('done');
    onRefresh?.(store.getSnapshotById(goalId));
  }, [isSkill, goalId, snapshot, onRefresh]);

  // ── Loading ──
  if (loading) {
    return (
      <View style={[styles.card, styles.loadingCard]}>
        <ActivityIndicator size="small" color={colors.buttonPrimary} />
        <Text style={styles.loadingText}>Preparing today's plan…</Text>
      </View>
    );
  }

  if (!content) return null;

  // ── Done state ──
  if (phase === 'done') {
    return (
      <View style={styles.card}>
        <View style={styles.doneContainer}>
          <View style={styles.doneRing}>
            <Text style={styles.doneCheckmark}>✓</Text>
          </View>
          <Text style={styles.doneTitle}>Today's coaching complete</Text>
          {coachStreak > 0 && (
            <View style={styles.doneStreakRow}>
              <Text style={styles.doneStreakEmoji}>🔥</Text>
              <Text style={styles.doneStreakText}>{coachStreak}-day streak</Text>
            </View>
          )}
          <Text style={styles.doneSubtext}>Come back tomorrow for your next session.</Text>
          {liveProgress.coachFeedback?.[content.date] === 'not_helpful' && (
            <Text style={styles.notedText}>Noted — tomorrow's content will adjust.</Text>
          )}
        </View>
      </View>
    );
  }

  // ── Rating phase ──
  if (phase === 'rating') {
    return (
      <View style={styles.card}>
        <View style={styles.ratingContainer}>
          <Text style={styles.ratingEmoji}>💪</Text>
          <Text style={styles.ratingTitle}>How did it go?</Text>
          <Text style={styles.ratingSubtext}>Your feedback helps me tailor tomorrow's coaching.</Text>
          <View style={styles.ratingRow}>
            {isSkill ? (
              <>
                <TouchableOpacity style={styles.rateBtn} onPress={() => handleRating('completed_easy')} activeOpacity={0.7}>
                  <Text style={styles.rateBtnIcon}>😊</Text>
                  <Text style={styles.rateBtnLabel}>Easy</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.rateBtn} onPress={() => handleRating('completed_struggled')} activeOpacity={0.7}>
                  <Text style={styles.rateBtnIcon}>🤔</Text>
                  <Text style={styles.rateBtnLabel}>Tricky</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.rateBtn, styles.rateBtnOutline]} onPress={() => handleRating('skipped')} activeOpacity={0.7}>
                  <Text style={styles.rateBtnIcon}>⏭</Text>
                  <Text style={[styles.rateBtnLabel, { color: colors.textSecondary }]}>Skip</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity style={styles.rateBtn} onPress={() => handleRating('completed_easy')} activeOpacity={0.7}>
                <Text style={styles.rateBtnIcon}>✅</Text>
                <Text style={styles.rateBtnLabel}>Done</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  }

  // ── Content phase ──
  const tool = content.doNow.toolRecommendation;
  const coachQuote = COACH_QUOTES[mode] || COACH_QUOTES.tactical;

  // Goal-aware extras: derive today's tile from the user's plan + show
  // follow-through on yesterday's commitment.
  const tile = liveProgress.planOfAttack
    ? deriveDailyTile(
        liveProgress.planOfAttack,
        snapshot.definition,
        liveProgress.currentValue,
        snapshot.daysRemaining
      )
    : undefined;
  const yesterdayCommitment = liveProgress.yesterdayCommitment;
  const todayCommitment = liveProgress.commitment;

  return (
    <View style={styles.card}>
      {/* Coach header */}
      <View style={styles.coachHeader}>
        <View style={styles.coachAvatar}>
          <Text style={styles.coachAvatarEmoji}>✦</Text>
        </View>
        <View style={styles.coachHeaderText}>
          <Text style={styles.coachTitle}>Your daily coach</Text>
          <Text style={styles.coachQuote}>"{coachQuote}"</Text>
        </View>
        {coachStreak > 0 && (
          <View style={styles.streakPill}>
            <Text style={styles.streakPillText}>🔥 {coachStreak}</Text>
          </View>
        )}
      </View>

      {/* Plan banner: shows where we are in the user's specific plan */}
      {tile && (
        <View style={styles.planBanner}>
          <View style={styles.planBannerLeft}>
            <Text style={styles.planBannerLabel}>YOUR PLAN</Text>
            <Text style={styles.planBannerTitle}>
              Step {tile.index + 1} of {tile.total} · {tile.isAhead ? 'Ahead of pace' : tile.isLast ? 'Final stretch' : 'On track'}
            </Text>
            {tile.summary ? (
              <Text style={styles.planBannerSummary} numberOfLines={2}>{tile.summary}</Text>
            ) : null}
          </View>
          <View style={[styles.planBannerPill, { backgroundColor: tile.isAhead ? '#10B98122' : colors.accent + '22' }]}>
            <Text style={[styles.planBannerPillText, { color: tile.isAhead ? '#10B981' : colors.accent }]}>
              {tile.isAhead ? '🚀' : '🎯'}
            </Text>
          </View>
        </View>
      )}

      {/* Yesterday's commitment follow-through: surfaces the closed loop on free-form commits */}
      {yesterdayCommitment && (
        <View style={[styles.followUpBanner, {
          backgroundColor: liveProgress.yesterdayCommitmentHonored ? '#10B98115' : '#F59E0B15',
          borderColor: liveProgress.yesterdayCommitmentHonored ? '#10B981' : '#F59E0B',
        }]}>
          <Text style={[styles.followUpEmoji]}>{liveProgress.yesterdayCommitmentHonored ? '✅' : '⏰'}</Text>
          <View style={styles.followUpBody}>
            <Text style={styles.followUpLabel}>
              {liveProgress.yesterdayCommitmentHonored
                ? 'Yesterday\'s commitment'
                : 'You said yesterday'}
            </Text>
            <Text style={styles.followUpText} numberOfLines={2}>"{yesterdayCommitment.action}"</Text>
            {!liveProgress.yesterdayCommitmentHonored && (
              <Text style={styles.followUpHint}>Log any progress today to honor it.</Text>
            )}
          </View>
        </View>
      )}

      <View style={styles.divider} />

      {/* Today's commitment (if set), shown above DO THIS so the user sees it ties together */}
      {todayCommitment && (
        <View style={styles.todayCommitBanner}>
          <Text style={styles.todayCommitLabel}>YOU COMMITTED TO</Text>
          <Text style={styles.todayCommitText}>"{todayCommitment.action}"</Text>
        </View>
      )}

      {/* Learn section */}
      <View style={styles.learnSection}>
        <View style={[styles.accentBar, { backgroundColor: colors.accent }]} />
        <View style={styles.learnContent}>
          <Text style={styles.sectionLabel}>LEARN</Text>
          <Text style={styles.learnTitle}>{content.learn.title}</Text>
          <Text style={styles.learnBody}>{content.learn.body}</Text>
        </View>
      </View>

      {/* Do section */}
      <View style={styles.doSection}>
        <View style={[styles.accentBar, { backgroundColor: colors.buttonPrimary }]} />
        <View style={styles.doContent}>
          <Text style={styles.sectionLabel}>DO THIS</Text>
          <Text style={styles.doTitle}>{content.doNow.title}</Text>
          <Text style={styles.doInstructions}>{content.doNow.instructions}</Text>
          <View style={styles.minutesRow}>
            <Text style={styles.clockIcon}>⏱</Text>
            <Text style={styles.minutesText}>~{content.doNow.estimatedMinutes} min</Text>
          </View>
        </View>
      </View>

      {/* Tool recommendation */}
      {tool && (
        <View style={styles.toolCard}>
          <View style={styles.toolHeader}>
            <Text style={styles.toolIcon}>🔧</Text>
            <Text style={styles.sectionLabel}>RECOMMENDED TOOL</Text>
          </View>
          <Text style={styles.toolName}>{tool.name}</Text>
          <Text style={styles.toolReason}>{tool.reason}</Text>
          {tool.url && (
            <TouchableOpacity onPress={() => Linking.openURL(tool.url!)} activeOpacity={0.7}>
              <Text style={styles.toolLink}>Open tool →</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Actions */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.markButton}
          onPress={handleMarkDone}
          disabled={actionInFlight}
          activeOpacity={0.85}
        >
          {actionInFlight ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <>
              <Text style={styles.markButtonIcon}>✓</Text>
              <Text style={styles.markButtonText}>Mark done</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.skipButton}
          onPress={handleSkip}
          disabled={actionInFlight}
          activeOpacity={0.6}
        >
          <Text style={styles.skipButtonText}>Not now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: scale(18),
    padding: scale(18),
    marginHorizontal: scale(20),
    marginVertical: scale(8),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 4,
  },

  // ── Loading ──
  loadingCard: { alignItems: 'center', justifyContent: 'center', paddingVertical: scale(32) },
  loadingText: { fontFamily: fonts.body.regular, fontSize: scale(13), color: colors.textSecondary, marginTop: scale(12) },

  // ── Coach header ──
  coachHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: scale(2) },
  coachAvatar: {
    width: scale(36), height: scale(36), borderRadius: scale(18),
    backgroundColor: colors.accent + '30', justifyContent: 'center', alignItems: 'center',
    marginRight: scale(10),
  },
  coachAvatarEmoji: { fontSize: scale(18), color: colors.accent },
  coachHeaderText: { flex: 1 },
  coachTitle: { fontFamily: fonts.heading.bold, fontSize: scale(14), color: colors.text },
  coachQuote: { fontFamily: fonts.body.regular, fontSize: scale(11), color: colors.textSecondary, fontStyle: 'italic', marginTop: scale(1) },
  streakPill: {
    backgroundColor: '#F59E0B20', borderRadius: scale(12),
    paddingHorizontal: scale(10), paddingVertical: scale(4),
  },
  streakPillText: { fontFamily: fonts.heading.bold, fontSize: scale(12), color: '#F59E0B' },

  divider: { height: 1, backgroundColor: colors.border + '50', marginVertical: scale(14) },

  // ── Plan banner ──
  planBanner: {
    flexDirection: 'row', alignItems: 'center', marginTop: scale(12),
    borderRadius: scale(12), backgroundColor: colors.accent + '10',
    paddingHorizontal: scale(12), paddingVertical: scale(10),
    borderWidth: 1, borderColor: colors.accent + '30',
  },
  planBannerLeft: { flex: 1 },
  planBannerLabel: { fontFamily: fonts.heading.bold, fontSize: scale(9), color: colors.accent, letterSpacing: 1.5, marginBottom: scale(2) },
  planBannerTitle: { fontFamily: fonts.heading.bold, fontSize: scale(13), color: colors.text, marginBottom: scale(2) },
  planBannerSummary: { fontFamily: fonts.body.regular, fontSize: scale(11), color: colors.textSecondary, lineHeight: scale(15) },
  planBannerPill: {
    width: scale(36), height: scale(36), borderRadius: scale(18),
    justifyContent: 'center', alignItems: 'center', marginLeft: scale(10),
  },
  planBannerPillText: { fontSize: scale(18) },

  // ── Follow-up banner (yesterday's commitment) ──
  followUpBanner: {
    flexDirection: 'row', alignItems: 'flex-start',
    marginTop: scale(10), borderRadius: scale(12), borderWidth: 1,
    paddingHorizontal: scale(12), paddingVertical: scale(10), gap: scale(10),
  },
  followUpEmoji: { fontSize: scale(18), marginTop: scale(1) },
  followUpBody: { flex: 1 },
  followUpLabel: { fontFamily: fonts.heading.bold, fontSize: scale(9), color: colors.textSecondary, letterSpacing: 1.5, marginBottom: scale(2) },
  followUpText: { fontFamily: fonts.body.regular, fontSize: scale(12), color: colors.text, lineHeight: scale(17) },
  followUpHint: { fontFamily: fonts.body.regular, fontSize: scale(11), color: colors.textSecondary, marginTop: scale(4), fontStyle: 'italic' },

  // ── Today-commit banner ──
  todayCommitBanner: {
    marginBottom: scale(12), borderRadius: scale(12),
    backgroundColor: colors.buttonPrimary + '10', borderWidth: 1, borderColor: colors.buttonPrimary + '40',
    paddingHorizontal: scale(12), paddingVertical: scale(10),
  },
  todayCommitLabel: { fontFamily: fonts.heading.bold, fontSize: scale(9), color: colors.buttonPrimary, letterSpacing: 1.5, marginBottom: scale(4) },
  todayCommitText: { fontFamily: fonts.heading.bold, fontSize: scale(13), color: colors.text, lineHeight: scale(17) },

  // ── Learn section ──
  learnSection: { flexDirection: 'row', marginBottom: scale(14) },
  accentBar: { width: scale(3), borderRadius: scale(2), marginRight: scale(12) },
  learnContent: { flex: 1 },
  sectionLabel: { fontFamily: fonts.heading.bold, fontSize: scale(9), color: colors.textSecondary, letterSpacing: 1.5, marginBottom: scale(4) },
  learnTitle: { fontFamily: fonts.heading.bold, fontSize: scale(15), color: colors.text, marginBottom: scale(4), lineHeight: scale(20) },
  learnBody: { fontFamily: fonts.body.regular, fontSize: scale(13), color: colors.textSecondary, lineHeight: scale(18) },

  // ── Do section ──
  doSection: { flexDirection: 'row', marginBottom: scale(4) },
  doContent: { flex: 1 },
  doTitle: { fontFamily: fonts.heading.bold, fontSize: scale(15), color: colors.text, marginBottom: scale(4), lineHeight: scale(20) },
  doInstructions: { fontFamily: fonts.body.regular, fontSize: scale(13), color: colors.textSecondary, lineHeight: scale(18) },
  minutesRow: { flexDirection: 'row', alignItems: 'center', marginTop: scale(6) },
  clockIcon: { fontSize: scale(11), marginRight: scale(4) },
  minutesText: { fontFamily: fonts.body.regular, fontSize: scale(11), color: colors.textSecondary },

  // ── Tool card ──
  toolCard: {
    marginTop: scale(14), padding: scale(14), borderRadius: scale(12),
    backgroundColor: colors.surfaceLight, borderWidth: 1, borderColor: colors.border + '60',
  },
  toolHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: scale(6) },
  toolIcon: { fontSize: scale(12), marginRight: scale(6) },
  toolName: { fontFamily: fonts.heading.bold, fontSize: scale(13), color: colors.text, marginBottom: scale(2) },
  toolReason: { fontFamily: fonts.body.regular, fontSize: scale(12), color: colors.textSecondary, lineHeight: scale(16), marginBottom: scale(6) },
  toolLink: { fontFamily: fonts.heading.bold, fontSize: scale(12), color: colors.buttonPrimary },

  // ── Actions ──
  actionRow: { marginTop: scale(18), flexDirection: 'row', gap: scale(10), alignItems: 'center' },
  markButton: {
    flex: 1, backgroundColor: colors.buttonPrimary, borderRadius: scale(24),
    paddingVertical: scale(13), flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
  },
  markButtonIcon: { fontFamily: fonts.heading.bold, fontSize: scale(16), color: '#FFFFFF', marginRight: scale(6) },
  markButtonText: { fontFamily: fonts.heading.bold, fontSize: scale(14), color: '#FFFFFF' },
  skipButton: { paddingHorizontal: scale(16), paddingVertical: scale(13) },
  skipButtonText: { fontFamily: fonts.body.regular, fontSize: scale(13), color: colors.textSecondary },

  // ── Rating phase ──
  ratingContainer: { alignItems: 'center', paddingVertical: scale(8) },
  ratingEmoji: { fontSize: scale(36), marginBottom: scale(8) },
  ratingTitle: { fontFamily: fonts.heading.bold, fontSize: scale(17), color: colors.text, marginBottom: scale(4) },
  ratingSubtext: { fontFamily: fonts.body.regular, fontSize: scale(12), color: colors.textSecondary, textAlign: 'center', marginBottom: scale(18) },
  ratingRow: { flexDirection: 'row', gap: scale(12) },
  rateBtn: {
    backgroundColor: colors.buttonPrimary, borderRadius: scale(16),
    paddingHorizontal: scale(20), paddingVertical: scale(12),
    alignItems: 'center', minWidth: scale(80),
  },
  rateBtnIcon: { fontSize: scale(22), marginBottom: scale(4) },
  rateBtnLabel: { fontFamily: fonts.heading.bold, fontSize: scale(12), color: '#FFFFFF' },
  rateBtnOutline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },

  // ── Done phase ──
  doneContainer: { alignItems: 'center', paddingVertical: scale(12) },
  doneRing: {
    width: scale(56), height: scale(56), borderRadius: scale(28),
    backgroundColor: '#10B98120', justifyContent: 'center', alignItems: 'center',
    marginBottom: scale(12), borderWidth: 3, borderColor: '#10B981',
  },
  doneCheckmark: { fontSize: scale(28), color: '#10B981', fontFamily: fonts.heading.bold },
  doneTitle: { fontFamily: fonts.heading.bold, fontSize: scale(16), color: colors.text, marginBottom: scale(6) },
  doneStreakRow: { flexDirection: 'row', alignItems: 'center', marginBottom: scale(6) },
  doneStreakEmoji: { fontSize: scale(16), marginRight: scale(4) },
  doneStreakText: { fontFamily: fonts.heading.bold, fontSize: scale(14), color: '#F59E0B' },
  doneSubtext: { fontFamily: fonts.body.regular, fontSize: scale(12), color: colors.textSecondary, textAlign: 'center' },
  notedText: { fontFamily: fonts.body.regular, fontSize: scale(11), color: colors.textSecondary, textAlign: 'center', marginTop: scale(8), fontStyle: 'italic' },
});

export default DailyGoalCard;
