import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    FlatList,
    KeyboardAvoidingView,
    ActivityIndicator,
    Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { scale } from '../../constants';
import { fonts } from '../../theme';
import { aiService, ChatMessage } from '../../services/ai';
import { useUserProfileStore, getGreeting } from '../../store/userProfileStore';
import { useAuthStore } from '../../store/authStore';
import { getProgramForHobby, programShortTitle } from '../../domain/credentials/catalog';
import { eventsByProgram } from '../../services/learningEventRepository';
import { projectSkillState } from '../../domain/sessions/skillState';
import { getNextBestLearningAction } from '../../domain/sessions/nextBestAction';
import { useLearningIntelligence } from '../../hooks/useLearningIntelligence';
import {
    VerifiedSkillChallenge,
    fetchVerifyContext,
    VerifyChipContext,
} from '../../components/session/VerifiedSkillChallenge';
import { CredentialJourneySection } from '../../components/credentials/CredentialJourneySection';
import { useGamificationStore } from '../../store/gamificationStore';
import { useLanguageStore } from '../../store/languageStore';
import { useGoalStore } from '../../store/goalStore';
import { GoalSnapshot, DailyGoalContent } from '../../types/goals';
import { findNextIncompleteTask } from '../../domain/sessions/sessionCompletion';
import { sessionRouteForTask } from '../../domain/sessions/sessionRouting';
import { useTaskStore } from '../../store/taskStore';
import { computeDailyFocus, DailyFocusResult } from '../../services/dailyFocusEngine';
import { orchestrateDailyPlan } from '../../services/agentOrchestrator';
import { DailyPlan } from '../../types/goals';
import GoalProgressBar from '../../components/goal/GoalProgressBar';
import { useAppTheme } from '../../theme/useAppTheme';
import { useT } from '../../store/languageStore';
import { HobbyId, HOBBY_META } from '../../data/lessonContent';

interface DisplayMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
}

interface ActionChip {
    label: string;
    icon: string;
    action: () => void;
}

const SendIcon = ({ color = "white" }: { color?: string }) => (
    <Svg width={scale(15)} height={scale(15)} viewBox="0 0 25 25" fill="none">
        <Path
            d="M1.7207 24.4697C1.93894 24.5358 2.28825 24.5079 2.95801 24.2549C3.61366 24.0072 4.46761 23.5888 5.64941 23.0088L20.751 15.5977C21.9079 15.0299 22.7428 14.619 23.3359 14.2549C23.9356 13.8868 24.2008 13.6166 24.3135 13.3682C24.5622 12.8197 24.5621 12.1725 24.3135 11.624C24.2008 11.3755 23.9356 11.1044 23.3359 10.7363C22.7428 10.3723 21.9077 9.96223 20.751 9.39453L5.67578 1.99512C4.49043 1.41344 3.63313 0.994551 2.97559 0.746094C2.3035 0.492175 1.95364 0.464832 1.73535 0.53125C1.22288 0.687411 0.788236 1.10412 0.582031 1.68066C0.485874 1.94949 0.484274 2.3675 0.649414 3.12402C0.811859 3.86815 1.11147 4.84445 1.52344 6.18652L3.01758 11.0557C3.14237 11.4622 3.22438 11.7304 3.26367 11.9961H11.8428C12.1189 11.9961 12.3428 12.22 12.3428 12.4961C12.3427 12.7721 12.1188 12.9961 11.8428 12.9961H3.24414C3.19983 13.2234 3.12483 13.4678 3.02051 13.8105L1.49414 18.8262C1.08662 20.1652 0.791068 21.1394 0.630859 21.8818C0.468108 22.6362 0.470007 23.0538 0.566406 23.3223C0.773359 23.8977 1.20872 24.3144 1.7207 24.4697Z"
            fill={color}
        />
    </Svg>
);

function buildFocusMessage(focus: DailyFocusResult | null, snapshot: GoalSnapshot | null, greeting: string, plan?: DailyPlan): string {
    if (!snapshot) return `${greeting}! Ready to make progress today?`;
    const p = snapshot.progress;
    const streak = p.streak;
    const todayVal = p.currentValue;
    const target = snapshot.definition.target;
    const goal = snapshot.definition.description;
    const focusLine = focus?.reason ? `\n\n${focus.reason}` : '';
    const planLine = plan && plan.steps.length > 0
        ? `\n\n📋 Today's plan:\n${plan.steps.map(s => `  ${s.step}. ${s.title} (${s.duration})`).join('\n')}`
        : '';
    const assetsLine = plan && plan.assets.length > 0
        ? `\n\n🛠️ I've prepared ${plan.assets.length} asset(s) for you:\n${plan.assets.map(a => `  • ${a.title}`).join('\n')}`
        : '';
    if (streak > 0) return `🔥 ${streak}-day streak! "${goal}" — ${todayVal}/${target} today.${focusLine}${planLine}${assetsLine}\n\nWhat's your move?`;
    return `👋 ${greeting}! "${goal}" — ${todayVal}/${target} so far.${focusLine}${planLine}${assetsLine}\n\nLet's get started.`;
}

function buildUserContext(selectedHobby: HobbyId | null): string {
    const g = useGamificationStore.getState();
    const p = useUserProfileStore.getState();
    const hobby = (selectedHobby || p.selectedHobby) as HobbyId | null;
    const list: string[] = [];
    if (p.userName) list.push(`Name: ${p.userName}`);
    list.push(`Streak: ${g.currentStreak} days`);
    list.push(`Sessions today: ${g.sessionsCompletedToday}`);
    list.push(`Artifacts saved: ${g.artifacts.length}`);
    list.push(`Badges earned: ${g.unlockedBadges.length}`);
    list.push(`Code runs: ${g.codeRunCount}`);
    if (g.chessTaskSolved) list.push(`Chess puzzles solved: yes`);
    if (g.dailyChecklist.learn) list.push(`Today: learn done`);
    if (g.dailyChecklist.do) list.push(`Today: main task done`);
    if (g.dailyChecklist.deepen1) list.push(`Today: deepen done`);
    const goalState = useGoalStore.getState();
    const snapshot = hobby ? goalState.getSnapshot(hobby) : null;
    if (snapshot) {
        list.push(`Goal: ${snapshot.definition.description}`);
        list.push(`Progress: ${snapshot.percentComplete}% (${snapshot.progress.currentValue}/${snapshot.definition.target})`);
        list.push(`Days remaining: ${snapshot.daysRemaining}`);
        list.push(`Status: ${snapshot.projectedCompletion}`);
        const plan = snapshot.progress.dailyPlan;
        if (plan && plan.steps.length > 0) {
            list.push(`Today's plan (${plan.steps.length} steps):`);
            plan.steps.forEach(s => list.push(`  Step ${s.step}: ${s.title} (${s.duration}, ${s.type})`));
            if (plan.assets.length > 0) {
                list.push(`Prepared assets (${plan.assets.length}):`);
                plan.assets.forEach(a => {
                    const contentSnippet = a.content ? a.content.substring(0, 120) : '';
                    list.push(`  [${a.id}] ${a.type}: ${a.title} — supports step ${a.supportsStep}${contentSnippet ? `\n    Content: ${contentSnippet}...` : ''}`);
                });
            }
        }
    }
    if (hobby) {
        const meta = HOBBY_META[hobby];
        const day = g.currentDay[hobby] || 1;
        const week = Math.ceil(day / 7);
        list.push(`Current hobby: ${meta?.label || hobby} (day ${day}, week ${week})`);
        // Learning intelligence context (domain decides, AI explains).
        try {
            const program = getProgramForHobby(hobby);
            if (program) {
                const ownerId = useAuthStore.getState().user?.id ?? 'local';
                const states = projectSkillState({
                    program,
                    events: eventsByProgram(program.slug, ownerId),
                }).skills;
                const rec = getNextBestLearningAction({
                    hobbyId: hobby,
                    program,
                    skillStates: states,
                    currentCurriculumDay: day,
                    availableMinutes: 15,
                    dailyTasks: useTaskStore.getState().dailyTasks,
                });
                list.push(
                    `Learning recommendation: ${rec.type}` +
                    `${rec.skillName ? ` ${rec.skillName}` : ''}` +
                    `${rec.curriculumDay ? `, day ${rec.curriculumDay}` : ''}` +
                    `. Reason: ${rec.reasonCode}.`,
                );
                const stages = states
                    .filter(s => s.stage !== 'unseen')
                    .map(s => `${s.name}:${s.stage}`)
                    .join(', ');
                if (stages) list.push(`Skill stages: ${stages}.`);
            }
        } catch {}
    } else {
        const lines = (Object.keys(g.currentDay) as HobbyId[])
            .filter(h => h !== 'coding')
            .map(h => `${HOBBY_META[h]?.label || h} (day ${g.currentDay[h] || 1})`);
        if (lines.length) list.push(`Hobbies: ${lines.join(', ')}`);
    }
    return list.map(s => `- ${s}`).join('\n');
}

function getGreetingTime(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
}

const AICoachTab: React.FC = () => {
    const router = useRouter();
    const [messages, setMessages] = useState<DisplayMessage[]>([]);
    const [coachSeeded, setCoachSeeded] = useState(false);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [verifyCtx, setVerifyCtx] = useState<VerifyChipContext>({ issuable: false, verifiedSkillKeys: [] });
    const [challenge, setChallenge] = useState<{ programSlug: string; skillKey: string; skillName: string } | null>(null);
    const [goalSnapshot, setGoalSnapshot] = useState<GoalSnapshot | null>(null);
    const [focusResult, setFocusResult] = useState<DailyFocusResult | null>(null);
    const [dailyPlan, setDailyPlan] = useState<DailyPlan | null>(null);
    const [showInput, setShowInput] = useState(false);
    const chatListRef = useRef<FlatList>(null);
    const { selectedHobby } = useUserProfileStore();

    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const t = useT();
    const greeting = getGreetingTime();

    // Load goal, focus + daily plan on mount
    useEffect(() => {
        const hobby = (selectedHobby || useUserProfileStore.getState().selectedHobby) as HobbyId | null;
        if (!hobby) return;
        const goalState = useGoalStore.getState();
        const snapshot = goalState.getSnapshot(hobby);
        setGoalSnapshot(snapshot);
        if (snapshot) {
            const todayStr = new Date().toISOString().split('T')[0];
            try {
                const focus = computeDailyFocus({ goal: snapshot.definition, progress: snapshot.progress, todayStr });
                setFocusResult(focus);
            } catch {}
            // Read stored plan first; generate if missing
            const stored = goalState.progress[snapshot.definition.id]?.dailyPlan;
            if (stored && stored.steps.length > 0) {
                setDailyPlan(stored);
            } else {
                const todayContent = snapshot.progress.dailyContent?.[todayStr] ?? null;
                orchestrateDailyPlan(snapshot.definition, snapshot.progress, todayContent).then(plan => {
                    goalState.setDailyPlan(snapshot.definition.id, plan);
                    setDailyPlan(plan);
                }).catch(() => {});
            }
        }
    }, [selectedHobby]);

    // Proactive coach message — updates when plan arrives
    useEffect(() => {
        if (!goalSnapshot) return;
        const msg = buildFocusMessage(focusResult, goalSnapshot, greeting, dailyPlan ?? undefined);
        if (!coachSeeded) {
            setCoachSeeded(true);
            setMessages([{ id: 'coach-proactive', role: 'assistant', content: msg }]);
        } else if (messages.length === 1 && messages[0].id === 'coach-proactive') {
            // Update existing message when plan loads after initial seed
            setMessages([{ id: 'coach-proactive', role: 'assistant', content: msg }]);
        }
    }, [goalSnapshot, focusResult, dailyPlan]);

    const scrollToEnd = () => setTimeout(() => chatListRef.current?.scrollToEnd({ animated: true }), 100);

    const handleSend = async (text?: string) => {
        const content = (text || inputText).trim();
        if (!content || isLoading) return;
        setShowInput(false);
        const userMsg: DisplayMessage = { id: Date.now().toString(), role: 'user', content };
        setMessages(prev => [...prev, userMsg]);
        setInputText('');
        setIsLoading(true);
        scrollToEnd();
        try {
            const chatMessages: ChatMessage[] = messages
                .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
                .concat([{ role: 'user', content }]);
            const context = buildUserContext(selectedHobby as HobbyId);
            // Factual system state only (server-derived FULLY gated skills —
            // partial proof is never labeled verified). The LLM never
            // decides readiness, skill choice, or pass/fail from this.
            const verifiedLine = verifyCtx.verifiedSkillKeys.length > 0
                ? `\n- Server-verified skills: ${verifyCtx.verifiedSkillKeys.join(', ')}`
                : '';
            const response = await aiService.sendMessage(chatMessages, selectedHobby || undefined, context + verifiedLine);
            setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: response }]);
        } catch {
            setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: 'Sorry, I hit an error. Try again?' }]);
        } finally {
            setIsLoading(false);
            scrollToEnd();
        }
    };

    const hobby = (selectedHobby || useUserProfileStore.getState().selectedHobby) as HobbyId | null;
    // Canonical recommendation (frozen engine): the ONLY trigger for the
    // Verify action. The UI never infers readiness itself.
    const { recommendation: proveRec, program: proveProgram } = useLearningIntelligence({ minutes: 30 });

    // Canonical journey refresh: bumped after every completed trusted
    // verification (pass OR fail — even a failed sample can move
    // samplesCompleted/passRate). The journey section re-reads server
    // truth on change; nothing is ever patched manually.
    const [journeyRefreshToken, setJourneyRefreshToken] = useState(0);

    // Server verify context: issuance flag + server-verified skills.
    // Fail-closed: any error hides (never invents) the official action.
    useEffect(() => {
        let cancelled = false;
        const slug = proveProgram?.slug;
        if (proveRec?.type !== 'prove_skill' || !proveRec.skillKey || !slug) {
            setVerifyCtx({ issuable: false, verifiedSkillKeys: [] });
            return;
        }
        fetchVerifyContext(slug).then(ctx => {
            if (!cancelled) setVerifyCtx(ctx);
        }).catch(() => {
            if (!cancelled) setVerifyCtx({ issuable: false, verifiedSkillKeys: [] });
        });
        return () => {
            cancelled = true;
        };
    }, [proveRec?.type, proveRec?.skillKey, proveProgram?.slug]);

    // Server verify context feeds factual LLM context only (never a
    // decision). The journey section below is the single official Verify
    // CTA surface — no standalone VerifySkillCta is rendered anywhere.

    const handleVerifyComplete = (passed: boolean, verification: {
        verified: boolean;
        samplesCompleted: number;
        samplesRequired: number;
    } | null) => {
        // NOTE: do not close here — the sheet stays open on its own
        // result until the user Continues.
        const done = challenge;
        if (!done) return;
        // Messaging follows the server verdict + the FRESH server-derived
        // gate snapshot. "Verified" appears only when the full gate holds;
        // a bare PASS renders partial progress instead.
        const content = !passed
            ? `Not verified yet — no worries.\n\nKeep practicing and try another verification when you're ready.`
            : verification?.verified === true
                ? `🎉 **${done.skillName} verified!**\n\nNice work — this skill is locked in. What's next?`
                : `Good result — proof added for ${done.skillName}.\n\nVerification progress: ${verification?.samplesCompleted ?? 0} of ${verification?.samplesRequired ?? 0} checks completed.`;
        setMessages(prev => [...prev, {
            id: `coach-verify-${Date.now()}`,
            role: 'assistant',
            content,
        }]);
        scrollToEnd();
        // Re-read the truth (server + canonical recommendation). Nothing is
        // patched manually: the chip visibility recomputes from fresh state.
        fetchVerifyContext(done.programSlug).then(setVerifyCtx).catch(() => {});
        // Refresh the canonical journey reads too (pass or fail): a
        // completed sample can move counts even without a pass.
        setJourneyRefreshToken(t => t + 1);
    };
    /** Next real DailyPlan task -> shared swipe session (same task object). */
    const startNextTaskSession = () => {
        const next = findNextIncompleteTask(useTaskStore.getState().dailyTasks);
        if (next?.id) {
            router.push(sessionRouteForTask(next, 'home_start') as any);
        } else {
            router.push('/session-timer' as any);
        }
    };
    const actionChips: ActionChip[] = useMemo(() => {
        const chips: ActionChip[] = [];
        if (goalSnapshot?.definition.id) {
            const goalId = goalSnapshot.definition.id;
            chips.push(
                { label: 'Today\'s plan', icon: '📋', action: () => router.push(`/goal-detail?goalId=${goalId}`) },
                { label: 'Start session', icon: '▶️', action: startNextTaskSession },
            );
            if (hobby === 'reading') {
                chips.push({ label: 'Reading timer', icon: '⏱', action: () => router.push('/session-timer') });
            }
            if (dailyPlan && dailyPlan.steps.length > 0) {
                dailyPlan.steps.slice(0, 2).forEach(s => {
                    chips.push({
                        label: `Step ${s.step}: ${s.title.substring(0, 22)}`,
                        icon: s.type === 'learn' ? '📖' : s.type === 'practice' ? '🎯' : '📦',
                        action: () => handleSend(`Tell me more about step ${s.step}: ${s.title}`),
                    });
                });
            }
            if (dailyPlan && dailyPlan.assets.length > 0) {
                chips.push({ label: `${dailyPlan.assets.length} assets`, icon: '📦', action: () => router.push(`/goal-detail?goalId=${goalId}&page=assets`) });
            }
        }
        chips.push(
            {
                label: 'Done for today', icon: '✓',
                action: () => {
                    const hobby = (selectedHobby || useUserProfileStore.getState().selectedHobby) as HobbyId | null;
                    if (goalSnapshot && hobby) {
                        useGoalStore.getState().recordDailyAction(hobby, 1, 'completed');
                        useGoalStore.getState().completeDailyContent(goalSnapshot.definition.id);
                        const dayNum = goalSnapshot.progress.history.length + 1;
                        setMessages(prev => [...prev, { id: 'user-done', role: 'user', content: 'Mark today as done' }]);
                        setMessages(prev => [...prev, {
                            id: 'coach-celebrate', role: 'assistant',
                            content: `🎉 **Day ${dayNum} complete!**\n\n🔥 ${goalSnapshot.progress.streak + 1}-day streak!\n📊 ${Math.round(goalSnapshot.percentComplete)}% to goal\n\nYou're building momentum. What's your next focus?`,
                        }]);
                    } else {
                        handleSend('Mark today as done and celebrate progress');
                    }
                },
            },
            { label: 'Ask me', icon: '💬', action: () => setShowInput(true) },
        );
        return chips;
    }, [goalSnapshot, dailyPlan]);

    return (
        <KeyboardAvoidingView
            style={styles.coachContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={0}
        >
            {/* Compact progress card */}
            {goalSnapshot && (
                <View style={styles.progressCard}>
                    <GoalProgressBar snapshot={goalSnapshot} />
                </View>
            )}

            {/* Chat messages */}
            <FlatList
                ref={chatListRef}
                data={messages}
                keyExtractor={(item) => item.id}
                style={styles.chatList}
                contentContainerStyle={styles.chatContent}
                ListHeaderComponent={messages.length === 0 && goalSnapshot && !coachSeeded ? (
                    <View style={styles.greetingCard}>
                        <Text style={styles.greetingEmoji}>👋</Text>
                        <Text style={styles.greetingTitle}>{greeting}</Text>
                    </View>
                ) : messages.length === 0 ? (
                    <View style={styles.suggestWrap}>
                        <Text style={styles.suggestTitle}>Спроси Zenyth</Text>
                        {[
                            { label: '📖 Объясни сегодняшнюю тему', prompt: "Explain today's topic simply." },
                            { label: '❓ Почему я это учу?', prompt: 'Why am I learning this? Explain briefly.' },
                            { label: '🎯 Что практиковать дальше?', prompt: 'What should I practice next based on my progress?' },
                        ].map((s, i) => (
                            <TouchableOpacity
                                key={i}
                                style={styles.suggestChip}
                                onPress={() => handleSend(s.prompt)}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.chipLabel}>{s.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                ) : null}
                renderItem={({ item }) => (
                    <View style={[
                        styles.bubble,
                        item.role === 'user' ? styles.userBubble : styles.coachBubble,
                    ]}>
                        <Text style={[
                            styles.bubbleText,
                            item.role === 'user' ? styles.userText : styles.coachText,
                        ]}>
                            {item.content}
                        </Text>
                    </View>
                )}
                ListFooterComponent={
                    isLoading ? (
                        <View style={styles.thinking}>
                            <ActivityIndicator size="small" color="#666" />
                            <Text style={styles.thinkingText}>Thinking...</Text>
                        </View>
                    ) : messages.length > 0 && !showInput ? (
                        <View>
                            <View style={styles.chipRow}>
                                {actionChips.map((chip, i) => (
                                    <TouchableOpacity key={i} style={styles.chip} onPress={chip.action} activeOpacity={0.7}>
                                        <Text style={styles.chipLabel}>{chip.icon} {chip.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    ) : null
                }
            />

            {/* Input bar */}
            {showInput && (
                <View style={styles.inputBar}>
                    <TextInput
                        style={styles.input}
                        placeholder="Ask your coach..."
                        placeholderTextColor="#999"
                        value={inputText}
                        onChangeText={setInputText}
                        onSubmitEditing={() => handleSend()}
                        returnKeyType="send"
                        autoCapitalize="sentences"
                        autoCorrect={false}
                        editable={!isLoading}
                        autoFocus
                    />
                    <TouchableOpacity
                        onPress={() => handleSend()}
                        style={[styles.sendBtn, (!inputText.trim() || isLoading) && { opacity: 0.4 }]}
                        disabled={!inputText.trim() || isLoading}
                    >
                        <SendIcon color="white" />
                    </TouchableOpacity>
                </View>
            )}

            {/* Verified skill challenge: server-owned sheet, no new route. */}
            {challenge && (
                <VerifiedSkillChallenge
                    visible={challenge !== null}
                    programSlug={challenge.programSlug}
                    skillKey={challenge.skillKey}
                    skillName={challenge.skillName}
                    onClose={() => setChallenge(null)}
                    onComplete={handleVerifyComplete}
                />
            )}

            {/* Compact credential journey (server truth only, knowledge slice). */}
            {proveProgram && (
                <CredentialJourneySection
                    programSlug={proveProgram.slug}
                    programTitle={programShortTitle(proveProgram.title)}
                    recommendation={proveRec}
                    onVerifySkill={target => setChallenge({ programSlug: proveProgram.slug, ...target })}
                    onContinueLearning={startNextTaskSession}
                    refreshToken={journeyRefreshToken}
                />
            )}
        </KeyboardAvoidingView>
    );
};

const createStyles = (colors: any) => StyleSheet.create({
    coachContainer: {
        flex: 1,
        paddingHorizontal: scale(16),
    },
    progressCard: {
        marginBottom: scale(8),
    },
    greetingCard: {
        alignItems: 'center',
        paddingVertical: scale(40),
    },
    greetingEmoji: {
        fontSize: scale(48),
        marginBottom: scale(8),
    },
    greetingTitle: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(28),
        color: colors.text,
    },
    suggestWrap: {
        paddingVertical: scale(24),
        gap: scale(10),
    },
    suggestTitle: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(22),
        color: colors.text,
        marginBottom: scale(6),
    },
    suggestChip: {
        paddingVertical: scale(12),
        paddingHorizontal: scale(18),
        borderRadius: scale(20),
        backgroundColor: '#F0F0F5',
        borderWidth: 1,
        borderColor: '#E0E0E8',
    },
    chatList: {
        flex: 1,
    },
    chatContent: {
        paddingBottom: scale(12),
    },
    bubble: {
        maxWidth: '88%',
        padding: scale(14),
        borderRadius: scale(18),
        marginBottom: scale(8),
    },
    coachBubble: {
        alignSelf: 'flex-start',
        backgroundColor: '#059669',
        borderBottomLeftRadius: scale(4),
    },
    userBubble: {
        alignSelf: 'flex-end',
        backgroundColor: colors.aiCoach?.bubble || '#E8E8EE',
        borderBottomRightRadius: scale(4),
    },
    bubbleText: {
        fontFamily: fonts.body.regular,
        fontSize: scale(14),
        lineHeight: scale(20),
    },
    coachText: {
        color: '#FFF',
    },
    userText: {
        color: '#000',
    },
    thinking: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: scale(10),
    },
    thinkingText: {
        marginLeft: scale(8),
        fontFamily: fonts.body.regular,
        fontSize: scale(13),
        color: '#999',
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: scale(8),
        paddingVertical: scale(8),
    },
    chip: {
        paddingVertical: scale(8),
        paddingHorizontal: scale(14),
        borderRadius: scale(20),
        backgroundColor: '#F0F0F5',
        borderWidth: 1,
        borderColor: '#E0E0E8',
    },
    chipLabel: {
        fontFamily: fonts.body.regular,
        fontSize: scale(13),
        color: '#333',
    },
    inputBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: scale(8),
        paddingBottom: scale(100),
        gap: scale(8),
    },
    input: {
        flex: 1,
        height: scale(44),
        paddingHorizontal: scale(16),
        borderRadius: scale(22),
        backgroundColor: '#FFF',
        fontFamily: fonts.body.regular,
        fontSize: scale(15),
        color: '#000',
        borderWidth: 1,
        borderColor: '#E0E0E8',
    },
    sendBtn: {
        width: scale(44),
        height: scale(44),
        borderRadius: scale(22),
        backgroundColor: '#2E2E43',
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default AICoachTab;
