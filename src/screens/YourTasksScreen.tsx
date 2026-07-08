import React, { useMemo, useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Image,
  StatusBar, Alert, ActivityIndicator, TextInput, Platform,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { SafeAreaView } from 'react-native-safe-area-context';
import { useTaskStore } from '../store/taskStore';
import { useUserProfileStore } from '../store/userProfileStore';
import { useAuthStore } from '../store/authStore';
import { useGoalStore } from '../store/goalStore';
import { GoalSnapshot, HelpMode, BottleneckAnalysis } from '../types/goals';
import { getRecommendations } from '../data/toolRecommendations';
import aiService from '../services/ai';
import GoalProgressBar from '../components/goal/GoalProgressBar';
import { TaskType } from '../services/supabase/types';
import { getMaxTasksPerDay } from '../domain/tasks/rules';
import { taskEngine } from '../services/taskEngine';
import { fonts } from '../theme';
import { scale } from '../constants';
import { useAppTheme } from '../theme/useAppTheme';
import { useT } from '../store/languageStore';

const categories: { type: TaskType; label: string; icon: any; bg: string; subtitle: string }[] = [
    {
        type: 'theory',
        label: 'Узнай',
        subtitle: 'Learn something new',
        icon: require('../../icons/book.png'),
        bg: '#9CE4FD'
    },
    {
        type: 'practice',
        label: 'Сделай',
        subtitle: 'Train your skills',
        icon: require('../../icons/dumbbell.png'),
        bg: '#7CB9FF'
    },
    {
        type: 'analysis',
        label: 'Углуби 1',
        subtitle: 'Extra task 1',
        icon: require('../../icons/magnifier.png'),
        bg: '#F4C0FD'
    },
    {
        type: 'puzzles',
        label: 'Углуби 2',
        subtitle: 'Extra task 2',
        icon: require('../../icons/puzzle.png'),
        bg: '#FCB5FD'
    },
];

export const YourTasksScreen = () => {
    const router = useRouter();
    const { dailyTasks, addTask, loading } = useTaskStore();
    const { isPremium, selectedHobby } = useUserProfileStore();
    const { user } = useAuthStore();
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const t = useT();
    const [goalSnapshot, setGoalSnapshot] = useState<GoalSnapshot | null>(null);
    const [checkinValue, setCheckinValue] = useState('');
    const [checkinDesc, setCheckinDesc] = useState('');
    const [tacticalCommit, setTacticalCommit] = useState('');
    const [blockerInput, setBlockerInput] = useState('');
    const [troubleshootResponse, setTroubleshootResponse] = useState<string | null>(null);
    const [troubleshootLoading, setTroubleshootLoading] = useState(false);
    const [showFollowUp, setShowFollowUp] = useState(false);
    const [followUpCommit, setFollowUpCommit] = useState('');
    const [showMilestoneAccept, setShowMilestoneAccept] = useState(false);

    const selectedRef = useRef(selectedHobby);
    selectedRef.current = selectedHobby;

    const loadSnapshot = useCallback(() => {
        const store = useGoalStore.getState();
        const hobby = selectedRef.current;
        let snap: GoalSnapshot | null = null;
        if (hobby) {
            snap = store.getSnapshot(hobby as any);
            console.log('[YourTasks] getSnapshot hobby=%s found=%s', hobby, !!snap);
        }
        if (!snap) {
            snap = store.getActiveSnapshot();
            console.log('[YourTasks] getActiveSnapshot found=%s', !!snap);
        }
        console.log('[YourTasks] snapshot goalId=%s hobby=%s', snap?.definition.id, snap?.definition.hobby);
        setGoalSnapshot(snap);
        if (snap?.definition.category === 'execution') {
            setCheckinValue(String(snap.progress.currentValue));
            const history = snap.progress.history;
            const today = new Date().toISOString().split('T')[0];
            const lastEntry = history.length > 0 ? history[history.length - 1] : null;
            if (lastEntry && lastEntry.date !== today && lastEntry.description.startsWith('commit: ')) {
                setFollowUpCommit(lastEntry.description.replace('commit: ', ''));
                setShowFollowUp(true);
            } else {
                setShowFollowUp(false);
            }
            const isFirstVisit = snap.progress.dailyActions === 0 && snap.progress.milestones.length > 0;
            setShowMilestoneAccept(isFirstVisit);
        }
    }, []);

    // Refresh on every focus so goal card reflects latest store state
    useFocusEffect(useCallback(() => {
        loadSnapshot();
    }, [loadSnapshot]));

    // Also refresh when selectedHobby changes
    useEffect(() => {
        loadSnapshot();
    }, [selectedHobby, loadSnapshot]);

    const handleCheckin = useCallback(() => {
        const val = parseInt(checkinValue, 10);
        if (isNaN(val) || val < 0) {
            Alert.alert('Enter a valid number');
            return;
        }
        const store = useGoalStore.getState();
        store.recordCheckin(val, checkinDesc.trim() || 'Progress check-in', undefined, selectedHobby as any);
        setGoalSnapshot(store.getSnapshot(selectedHobby as any));
        setCheckinDesc('');
        Alert.alert('Progress logged!');
    }, [checkinValue, checkinDesc, selectedHobby]);

    const handleTacticalCommit = useCallback(() => {
        if (!tacticalCommit.trim()) return;
        const store = useGoalStore.getState();
        const snap = store.getSnapshot(selectedHobby as any);
        if (snap) {
            store.recordCheckin(snap.progress.currentValue, `commit: ${tacticalCommit.trim()}`, undefined, selectedHobby as any);
        }
        setGoalSnapshot(store.getSnapshot(selectedHobby as any));
        setTacticalCommit('');
        Alert.alert('Committed!');
    }, [tacticalCommit, selectedHobby]);

    const handleFollowUp = useCallback((done: boolean) => {
        setShowFollowUp(false);
        if (done && goalSnapshot) {
            const store = useGoalStore.getState();
            store.recordCheckin(goalSnapshot.progress.currentValue, 'follow-up: done', undefined, goalSnapshot.definition.hobby);
            setGoalSnapshot(store.getActiveSnapshot());
            Alert.alert('Nice! Progress logged.');
        }
    }, [goalSnapshot]);

    const handleSendBlocker = useCallback(async () => {
        if (!blockerInput.trim()) return;
        setTroubleshootLoading(true);
        setTroubleshootResponse(null);

        const store = useGoalStore.getState();
        const activeGoal = store.getActiveGoal();
        if (activeGoal) {
            store.setTroubleshoot(activeGoal.id, blockerInput.trim());
        }

        const snap = store.getActiveSnapshot();
        const goalContext = snap
            ? `Goal: "${snap.definition.description}" (${snap.progress.currentValue}/${snap.definition.target})`
            : '';

        try {
            const reply = await aiService.sendMessage([
                { role: 'system', content: `You are a practical coach. The user is stuck on an execution goal. ${goalContext} Give one specific, actionable piece of advice. No markdown. 2-4 sentences.` },
                { role: 'user', content: blockerInput.trim() },
            ]);
            setTroubleshootResponse(reply);
        } catch {
            setTroubleshootResponse('Try breaking the problem into smaller steps. What\'s the first 5-minute action you can take right now?');
        }

        setTroubleshootLoading(false);
        setBlockerInput('');
        setGoalSnapshot(store.getActiveSnapshot());
    }, [blockerInput, selectedHobby]);

    const handleResolveBlocker = useCallback(() => {
        const store = useGoalStore.getState();
        const activeGoal = store.getActiveGoal();
        if (activeGoal) {
            store.setMode(activeGoal.id, 'tactical');
            setGoalSnapshot(store.getSnapshot(selectedHobby as any));
        }
        setTroubleshootResponse(null);
    }, [selectedHobby]);

    const mode = goalSnapshot?.definition.category === 'execution'
        ? (goalSnapshot.progress.currentMode || 'tactical')
        : null;

    // Auto-populate bottleneck from curated tools when entering tools mode
    useEffect(() => {
        if (mode !== 'tools' || !goalSnapshot || goalSnapshot.progress.lastBottleneck) return;
        const pattern = getRecommendations(goalSnapshot.definition.description);
        if (pattern) {
            const bottleneck: BottleneckAnalysis = {
                bottleneck: pattern.bottleneck,
                severity: 'moderate',
                recommendations: pattern.recommendations,
                label: pattern.label,
            };
            const store = useGoalStore.getState();
            const activeGoal = store.getActiveGoal();
            if (activeGoal) {
                store.setBottleneck(activeGoal.id, bottleneck);
                setGoalSnapshot(store.getActiveSnapshot());
            }
        }
    }, [mode]);

    const ENGINE_TYPES: TaskType[] = ['theory', 'practice', 'analysis', 'puzzles'];
    const engineTasksCount = dailyTasks.filter(t => ENGINE_TYPES.includes(t.type as TaskType)).length;
    const maxTasks = getMaxTasksPerDay(isPremium);

    const handleAdd = async (type: TaskType) => {
        console.log('[YourTasksScreen] handleAdd pressed - type:', type);
        if (!user?.id) return;
        const templates = (taskEngine as any).getAvailableTaskTemplates(selectedHobby ?? undefined, type);
        const alreadyAdded = dailyTasks.filter(t => t.type === type);
        const next = templates.find((tmpl: any) => !alreadyAdded.some((t: any) => t.title === tmpl.title));
        const template = next || templates[0];
        if (!template) return;
        try {
            await addTask(user.id, type, template);
            console.log('[YourTasksScreen] Task added successfully');
            router.back();
        } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to add task');
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => {
                    console.log('[YourTasksScreen] Back button pressed');
                    router.back();
                }} style={styles.backButton}>
                    <Ionicons
                        name="chevron-back"
                        size={scale(24)}
                        color={colors.text}
                    />
                    <Text style={styles.backText}>{t('Назад')}</Text>
                </TouchableOpacity>
                <Text style={styles.title}>{t('Твои задачи')}</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {/* Goal section */}
                {goalSnapshot ? (
                    <>
                        <GoalProgressBar snapshot={goalSnapshot} onEdit={() => router.push(`/goal-setup?edit=${goalSnapshot.definition.id}${selectedHobby ? `&hobbyId=${selectedHobby}` : ''}` as any)} onPress={() => router.push(`/goal-detail?goalId=${goalSnapshot.definition.id}${selectedHobby ? `&hobbyId=${selectedHobby}` : ''}` as any)} />

                        {/* Mode-specific check-in cards (execution goals) */}
                        {goalSnapshot.definition.category === 'execution' && mode === 'milestone' && (
                            <MilestoneCard snapshot={goalSnapshot} onRefresh={() => {
                                setGoalSnapshot(useGoalStore.getState().getSnapshot(selectedHobby as any));
                            }} styles={styles} />
                        )}

                        {goalSnapshot.definition.category === 'execution' && mode === 'tactical' && (
                            <View style={styles.checkinCard}>
                                <Text style={styles.checkinTitle}>What's your one action today?</Text>
                                {goalSnapshot.progress.milestones.length > 0 && (
                                    <Text style={styles.milestoneFocus}>
                                        Focus: {goalSnapshot.progress.milestones[goalSnapshot.progress.currentMilestoneIndex]?.label ?? 'Current phase'}
                                    </Text>
                                )}
                                {goalSnapshot.daysRemaining > 0 && goalSnapshot.definition.target > 0 && (
                                    <Text style={styles.checkinRate}>
                                        Need {goalSnapshot.dailyRateNeeded} {goalSnapshot.definition.unitLabel || 'units'} per day to stay on track
                                    </Text>
                                )}
                                <TextInput
                                    style={styles.tacticalInput}
                                    value={tacticalCommit}
                                    onChangeText={setTacticalCommit}
                                    placeholder="I'll send 15 more DMs today"
                                    placeholderTextColor="#999"
                                    maxLength={120}
                                />
                                <TouchableOpacity
                                    style={styles.checkinButton}
                                    onPress={handleTacticalCommit}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.checkinButtonText}>Commit</Text>
                                </TouchableOpacity>
                                <View style={styles.stuckRow}>
                                    <TouchableOpacity onPress={() => {
                                        const store = useGoalStore.getState();
                                        const activeGoal = store.getActiveGoal();
                                        if (activeGoal) store.setMode(activeGoal.id, 'tools');
                                        setGoalSnapshot(store.getSnapshot(selectedHobby as any));
                                    }} activeOpacity={0.7}>
                                        <Text style={styles.stuckLink}>Stuck? Try a tool</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => {
                                        const store = useGoalStore.getState();
                                        const activeGoal = store.getActiveGoal();
                                        if (activeGoal) store.setTroubleshoot(activeGoal.id, '');
                                        setGoalSnapshot(store.getSnapshot(selectedHobby as any));
                                    }} activeOpacity={0.7}>
                                        <Text style={styles.stuckLink}>Having a problem?</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        {goalSnapshot.definition.category === 'execution' && mode === 'tools' && (
                            <View style={styles.bottleneckCard}>
                                <Text style={styles.bottleneckTitle}>You're behind pace</Text>
                                <Text style={styles.bottleneckDesc}>
                                    Need {goalSnapshot.dailyRateNeeded} {goalSnapshot.definition.unitLabel || 'units'} per day, current rate is {goalSnapshot.progress.velocityTrend ?? '?'}.
                                </Text>
                                {goalSnapshot.progress.lastBottleneck ? (
                                    <>
                                        <Text style={styles.bottleneckTitle}>
                                            {goalSnapshot.progress.lastBottleneck.label}
                                        </Text>
                                        <Text style={styles.bottleneckDesc}>
                                            {goalSnapshot.progress.lastBottleneck.bottleneck}
                                        </Text>
                                        {goalSnapshot.progress.lastBottleneck.recommendations.map((rec, i) => (
                                            <View key={i} style={styles.recRow}>
                                                <Text style={styles.recName}>🔧 {rec.name}</Text>
                                                <Text style={styles.recDesc}>{rec.description}</Text>
                                                <Text style={styles.recMeta}>
                                                    {rec.cost} · {rec.setup} setup
                                                </Text>
                                            </View>
                                        ))}
                                    </>
                                ) : (
                                    <Text style={styles.bottleneckDesc}>
                                        Try PhantomBuster to automate DMs, or Clay to find leads faster.
                                    </Text>
                                )}
                                <TouchableOpacity
                                    style={styles.checkinButton}
                                    onPress={() => {
                                        const store = useGoalStore.getState();
                                        const activeGoal = store.getActiveGoal();
                                        if (activeGoal) store.setMode(activeGoal.id, 'tactical');
                                        setGoalSnapshot(store.getSnapshot(selectedHobby as any));
                                    }}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.checkinButtonText}>Back to check-in</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {goalSnapshot.definition.category === 'execution' && mode === 'troubleshoot' && (
                            <View style={styles.checkinCard}>
                                <Text style={styles.checkinTitle}>What's blocking you?</Text>
                                {!troubleshootResponse && !troubleshootLoading && (
                                    <>
                                        <TextInput
                                            style={styles.tacticalInput}
                                            value={blockerInput}
                                            onChangeText={setBlockerInput}
                                            placeholder="People aren't responding to my outreach"
                                            placeholderTextColor="#999"
                                            maxLength={200}
                                        />
                                        <TouchableOpacity
                                            style={styles.checkinButton}
                                            onPress={handleSendBlocker}
                                            activeOpacity={0.8}
                                        >
                                            <Text style={styles.checkinButtonText}>Send</Text>
                                        </TouchableOpacity>
                                    </>
                                )}
                                {troubleshootLoading && (
                                    <View style={styles.troubleshootLoading}>
                                        <ActivityIndicator color={colors.buttonPrimary} />
                                        <Text style={styles.troubleshootLoadingText}>Getting advice...</Text>
                                    </View>
                                )}
                                {troubleshootResponse && (
                                    <View style={styles.troubleshootResponseCard}>
                                        <Text style={styles.troubleshootResponseText}>{troubleshootResponse}</Text>
                                        <TouchableOpacity
                                            style={styles.checkinButton}
                                            onPress={handleResolveBlocker}
                                            activeOpacity={0.8}
                                        >
                                            <Text style={styles.checkinButtonText}>That helps — back to check-in</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* Tactical follow-up card */}
                        {goalSnapshot.definition.category === 'execution' && showFollowUp && followUpCommit && (
                            <View style={styles.followUpCard}>
                                <Text style={styles.followUpTitle}>Yesterday you committed to:</Text>
                                <Text style={styles.followUpCommit}>"{followUpCommit}"</Text>
                                <Text style={styles.followUpQuestion}>Did you do it?</Text>
                                <View style={styles.followUpRow}>
                                    <TouchableOpacity
                                        style={styles.followUpYes}
                                        onPress={() => handleFollowUp(true)}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={styles.followUpYesText}>Yes ✅</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.followUpNo}
                                        onPress={() => handleFollowUp(false)}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={styles.followUpNoText}>Not yet</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        {/* Celebration card for completed goals */}
                        {goalSnapshot.definition.status === 'completed' && (
                            <View style={styles.celebrationCard}>
                                <Text style={styles.celebrationEmoji}>🎉</Text>
                                <Text style={styles.celebrationTitle}>Goal complete!</Text>
                                <Text style={styles.celebrationDesc}>
                                    You reached "{goalSnapshot.definition.description}"
                                </Text>
                                <Text style={styles.celebrationStats}>
                                    {goalSnapshot.progress.currentValue} / {goalSnapshot.definition.target} {goalSnapshot.definition.unitLabel || 'units'} in {goalSnapshot.progress.dailyActions} sessions
                                </Text>
                                <TouchableOpacity
                                    style={styles.checkinButton}
                                    onPress={() => router.push(`/goal-setup${selectedHobby ? `?hobbyId=${selectedHobby}` : ''}` as any)}
                                    activeOpacity={0.8}
                                >
                                    <Text style={styles.checkinButtonText}>Set a new goal</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* One-tap count check-in for execution goals */}
                        {goalSnapshot.definition.category === 'execution' && (
                            <View style={styles.checkinCountCard}>
                                <View style={styles.checkinCountRow}>
                                    <Text style={styles.checkinCountToday}>Today's count:</Text>
                                    <TextInput
                                        style={styles.checkinCountInput}
                                        value={checkinValue}
                                        onChangeText={setCheckinValue}
                                        placeholder="0"
                                        placeholderTextColor="#999"
                                        keyboardType="number-pad"
                                        selectTextOnFocus
                                    />
                                    <Text style={styles.checkinCountLabel}>
                                        {goalSnapshot.definition.unitLabel || 'units'}
                                    </Text>
                                    <TouchableOpacity
                                        style={styles.checkinCountButton}
                                        onPress={handleCheckin}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={styles.checkinCountButtonText}>Log</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    </>
                ) : (
                    <TouchableOpacity style={styles.setGoalCard} onPress={() => router.push(`/goal-setup${selectedHobby ? `?hobbyId=${selectedHobby}` : ''}` as any)} activeOpacity={0.8}>
                        <Text style={styles.setGoalTitle}>Set your goal</Text>
                        <Text style={styles.setGoalSubtitle}>Define what you want to achieve and get daily tasks sequenced toward your finish line</Text>
                        <View style={styles.setGoalButton}>
                            <Text style={styles.setGoalButtonText}>Set your goal</Text>
                        </View>
                    </TouchableOpacity>
                )}

                <Text style={styles.subtitle}>
                    {goalSnapshot?.definition.category === 'execution'
                        ? t('Log your progress daily — we\'ll help you find what\'s slowing you down.')
                        : t('Tasks for today — each one brings you closer to your goal.')}
                </Text>

                <View style={styles.cardsContainer}>
                    {categories.map((cat) => {
                        const existingTask = dailyTasks.find(t => t.type === cat.type) ?? null;
                        const shouldShowLocked = !existingTask && engineTasksCount >= maxTasks;
                        
                        // Skip rendering locked cards here - we'll render one at the end
                        if (shouldShowLocked) {
                            return null;
                        }
                        
                        return (
                            <View key={cat.type} style={{ marginBottom: scale(16) }}>
                                <CategoryCard
                                    category={cat}
                                    existingTask={existingTask}
                                    isLocked={false}
                                    onAdd={() => handleAdd(cat.type)}
                                    onUpgrade={() => router.push('/subscription')}
                                    colors={colors}
                                    styles={styles}
                                    t={t}
                                />
                            </View>
                        );
                    })}
                    
                    {/* Always show locked card in the last position if limit is reached (free users only) */}
                    {!isPremium && engineTasksCount >= maxTasks && (
                        <View key="locked-last" style={{ marginBottom: scale(16) }}>
                            <CategoryCard
                                category={categories[3]} // Use last category for icon/styling
                                existingTask={null}
                                isLocked={true}
                                onAdd={() => {}}
                                onUpgrade={() => router.push('/subscription')}
                                colors={colors}
                                styles={styles}
                                t={t}
                            />
                        </View>
                    )}
                </View>

                {loading && (
                    <ActivityIndicator color={colors.primary} style={{ marginTop: scale(16) }} />
                )}

                {!isPremium && engineTasksCount >= getMaxTasksPerDay(false) && (
                    <TouchableOpacity
                        style={styles.upgradeCard}
                        onPress={() => {
                            console.log('[YourTasksScreen] Upgrade card pressed - navigating to subscription');
                            router.push('/subscription');
                        }}
                    >
                        <Text style={styles.upgradeText}>
                            {t('Достигнут лимит задач. Перейдите на Premium, чтобы добавить больше.')}
                        </Text>
                    </TouchableOpacity>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

const MilestoneCard = ({ snapshot, onRefresh, styles }: { snapshot: GoalSnapshot; onRefresh: () => void; styles: any }) => {
    const { progress } = snapshot;
    const { milestones, currentMilestoneIndex } = progress;

    if (milestones.length === 0) return null;

    const current = milestones[currentMilestoneIndex];
    const allDone = milestones.every(m => m.currentValue >= m.target);
    const isFirstVisit = progress.dailyActions === 0;

    const handleCompleteMilestone = () => {
        const store = useGoalStore.getState();
        const activeGoal = store.getActiveGoal();
        if (!activeGoal) return;
        const prog = store.progress[activeGoal.id];
        if (!prog) return;
        const updatedMilestones = prog.milestones.map((m, i) =>
            i === currentMilestoneIndex ? { ...m, currentValue: m.target } : m
        );
        store.setMilestones(activeGoal.id, updatedMilestones);
        store.advanceMilestone(activeGoal.id);
        onRefresh();
    };

    const handleAcceptPlan = () => {
        const store = useGoalStore.getState();
        const activeGoal = store.getActiveGoal();
        if (activeGoal) {
            store.recordCheckin(progress.currentValue, 'plan accepted', undefined, snapshot.definition.hobby);
        }
        onRefresh();
    };

    if (allDone) {
        return (
            <View style={styles.checkinCard}>
                <Text style={styles.checkinTitle}>All phases complete!</Text>
                <Text style={styles.checkinRate}>You've finished every milestone. Keep checking in until you hit your final target.</Text>
            </View>
        );
    }

    if (isFirstVisit) {
        return (
            <View style={styles.checkinCard}>
                <Text style={styles.checkinTitle}>Here's your plan 🎯</Text>
                <Text style={styles.checkinRate}>
                    We've broken "{snapshot.definition.description}" into phases
                </Text>
                <View style={styles.milestoneList}>
                    {milestones.map((m, i) => (
                        <View key={i} style={[styles.milestoneRow, i === 0 && styles.milestoneRowCurrent]}>
                            <Text style={styles.milestoneCheck}>{i === 0 ? '▶️' : '○'}</Text>
                            <View style={styles.milestoneInfo}>
                                <Text style={[styles.milestoneName, i === 0 && styles.milestoneNameCurrent]}>
                                    {m.label}
                                </Text>
                                <Text style={styles.milestoneDetail}>
                                    Target: {m.target} {m.unit}
                                </Text>
                            </View>
                        </View>
                    ))}
                </View>
                <TouchableOpacity
                    style={styles.checkinButton}
                    onPress={handleAcceptPlan}
                    activeOpacity={0.8}
                >
                    <Text style={styles.checkinButtonText}>Looks good, let's start!</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.checkinCard}>
            <Text style={styles.checkinTitle}>Your milestone plan</Text>
            <Text style={styles.milestoneFocus}>Current focus: {current?.label ?? 'Phase'}</Text>
            <Text style={styles.milestoneTarget}>
                Target: {current?.target} {current?.unit} — at {current?.currentValue} now
            </Text>
            <View style={styles.milestoneList}>
                {milestones.map((m, i) => {
                    const isCurrent = i === currentMilestoneIndex;
                    const isDone = m.currentValue >= m.target;
                    return (
                        <View key={i} style={[styles.milestoneRow, isCurrent && styles.milestoneRowCurrent]}>
                            <Text style={styles.milestoneCheck}>{isDone ? '✅' : isCurrent ? '▶️' : '○'}</Text>
                            <View style={styles.milestoneInfo}>
                                <Text style={[styles.milestoneName, isCurrent && styles.milestoneNameCurrent]}>
                                    {m.label}
                                </Text>
                                <Text style={styles.milestoneDetail}>
                                    {m.currentValue}/{m.target} {m.unit}
                                </Text>
                            </View>
                        </View>
                    );
                })}
            </View>
            {current && current.currentValue < current.target && (
                <TouchableOpacity
                    style={styles.checkinButton}
                    onPress={handleCompleteMilestone}
                    activeOpacity={0.8}
                >
                    <Text style={styles.checkinButtonText}>Mark phase complete</Text>
                </TouchableOpacity>
            )}
        </View>
    );
};

const CategoryCard = ({ category, existingTask, isLocked, onAdd, onUpgrade, styles, t }: any) => {
    const isAdded = !!existingTask;
    const isCompleted = existingTask?.status === 'completed';

    if (isLocked) {
        return (
            <TouchableOpacity style={styles.lockedCard} onPress={onUpgrade} activeOpacity={0.8}>
                <Image source={require('../../icons/lock.png')} style={styles.lockIcon} resizeMode="contain" />
            </TouchableOpacity>
        );
    }

    return (
        <View style={[
            styles.card,
            { backgroundColor: isCompleted ? '#3CEB59' : category.bg },
        ]}>
            <View style={styles.cardInfo}>
                <View style={styles.iconContainer}>
                    <Image
                        source={category.icon}
                        style={styles.cardIcon}
                        resizeMode="contain"
                    />
                </View>
                <View style={styles.textContainer}>
                    <Text style={styles.cardTitle}>{t(category.label)}</Text>
                    <Text style={styles.cardSubtitle} numberOfLines={2}>
                        {existingTask ? t(existingTask.title) : t(category.subtitle)}
                    </Text>
                </View>
            </View>

            {isCompleted ? (
                <View style={[styles.addButton, styles.doneButton]}>
                    <Image source={require('../../icons/Vector.png')} style={styles.checkIcon} />
                </View>
            ) : isAdded ? (
                <TouchableOpacity
                    style={[styles.addButton, styles.addedButton]}
                    onPress={onAdd}
                    activeOpacity={0.7}
                >
                    <Image source={require('../../icons/plus.png')} style={[styles.plusIcon, { opacity: 0.5 }]} />
                </TouchableOpacity>
            ) : (
                <TouchableOpacity
                    style={styles.addButton}
                    onPress={onAdd}
                    activeOpacity={0.7}
                >
                    <Image source={require('../../icons/plus.png')} style={styles.plusIcon} />
                </TouchableOpacity>
            )}
        </View>
    );
};

const createStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: scale(20),
        paddingVertical: scale(16),
        justifyContent: 'space-between',
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: scale(8),
        marginLeft: -scale(8),
        zIndex: 10,
    },
    backIcon: {
        width: scale(24),
        height: scale(24),
        tintColor: colors.text,
    },
    backText: {
        fontFamily: fonts.body.regular,
        fontSize: scale(16),
        color: colors.text,
        marginLeft: scale(4),
    },
    title: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(20),
        color: colors.text,
        position: 'absolute',
        left: 0,
        right: 0,
        textAlign: 'center',
        zIndex: -1,
    },
    content: {
        padding: scale(20),
        paddingBottom: scale(40),
    },
    setGoalCard: {
        marginBottom: scale(20),
        padding: scale(20),
        borderRadius: scale(16),
        backgroundColor: colors.surfaceLight,
        borderWidth: 1,
        borderColor: colors.border,
        borderStyle: 'dashed',
        alignItems: 'center',
    },
    setGoalTitle: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(16),
        color: colors.text,
        marginBottom: scale(6),
        textAlign: 'center',
    },
    setGoalSubtitle: {
        fontFamily: fonts.body.regular,
        fontSize: scale(13),
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: scale(18),
        marginBottom: scale(16),
    },
    setGoalButton: {
        backgroundColor: colors.buttonPrimary,
        borderRadius: scale(20),
        paddingHorizontal: scale(24),
        paddingVertical: scale(10),
    },
    setGoalButtonText: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(14),
        color: '#FFFFFF',
    },
    subtitle: {
        fontFamily: fonts.body.regular,
        fontSize: scale(16),
        color: colors.textSecondary,
        marginBottom: scale(24),
        lineHeight: scale(22),
    },
    cardsContainer: {
        paddingBottom: scale(20)
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: scale(24),
        padding: scale(16),
        height: scale(88),
    },
    cardInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    iconContainer: {
        width: scale(48),
        height: scale(48),
        borderRadius: scale(14),
        backgroundColor: 'rgba(255,255,255,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: scale(16),
    },
    cardIcon: {
        width: scale(24),
        height: scale(24),
        tintColor: '#1E1E2E',
    },
    textContainer: {
        flex: 1,
    },
    cardTitle: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(18),
        color: '#1E1E2E',
        marginBottom: scale(2),
    },
    cardSubtitle: {
        fontFamily: fonts.body.regular,
        fontSize: scale(14),
        color: '#1E1E2E',
        opacity: 0.7,
    },
    addButton: {
        width: scale(48),
        height: scale(48),
        borderRadius: scale(24),
        backgroundColor: 'rgba(255,255,255,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    addedButton: {
        backgroundColor: 'rgba(255,255,255,0.6)',
    },
    lockedCard: {
        borderRadius: scale(25),
        height: scale(100),
        backgroundColor: '#E6EBF0',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 5,
        elevation: 2,
    },
    lockIcon: {
        width: scale(32),
        height: scale(32),
        tintColor: '#ADADAD',
    },
    doneButton: {
        backgroundColor: 'rgba(255,255,255,0.5)',
    },
    checkIcon: {
        width: scale(20),
        height: scale(20),
        tintColor: '#FFFFFF',
    },
    plusIcon: {
        width: scale(20),
        height: scale(20),
        tintColor: '#1E1E2E',
    },
    upgradeCard: {
        marginTop: scale(24),
        padding: scale(16),
        backgroundColor: colors.surfaceLight || '#F0F0F0',
        borderRadius: scale(16),
        alignItems: 'center',
        justifyContent: 'center',
    },
    upgradeText: {
        fontFamily: fonts.body.medium,
        fontSize: scale(14),
        color: colors.textSecondary,
        textAlign: 'center',
    },

    // ── Milestone card ──
    milestoneFocus: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(14),
        color: colors.buttonPrimary,
        marginBottom: scale(2),
    },
    milestoneTarget: {
        fontFamily: fonts.body.regular,
        fontSize: scale(13),
        color: colors.textSecondary,
        marginBottom: scale(12),
    },
    milestoneList: {
        marginBottom: scale(12),
    },
    milestoneRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: scale(8),
        paddingHorizontal: scale(10),
        borderRadius: scale(8),
        marginBottom: scale(4),
    },
    milestoneRowCurrent: {
        backgroundColor: colors.buttonPrimary + '12',
    },
    milestoneCheck: {
        fontSize: scale(16),
        marginRight: scale(10),
    },
    milestoneInfo: {
        flex: 1,
    },
    milestoneName: {
        fontFamily: fonts.body.regular,
        fontSize: scale(14),
        color: colors.text,
    },
    milestoneNameCurrent: {
        fontFamily: fonts.heading.bold,
    },
    milestoneDetail: {
        fontFamily: fonts.body.regular,
        fontSize: scale(12),
        color: colors.textSecondary,
    },

    // ── Tactical card ──
    tacticalInput: {
        backgroundColor: colors.background,
        borderRadius: scale(10),
        paddingHorizontal: scale(14),
        paddingVertical: Platform.OS === 'ios' ? scale(12) : scale(8),
        fontFamily: fonts.body.regular,
        fontSize: scale(15),
        color: colors.text,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: scale(12),
    },
    stuckRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: scale(12),
    },
    stuckLink: {
        fontFamily: fonts.body.regular,
        fontSize: scale(13),
        color: colors.textSecondary,
        textDecorationLine: 'underline',
    },
    resolveBlocker: {
        alignItems: 'center',
        marginTop: scale(12),
    },

    // ── Compact count check-in ──
    checkinCountCard: {
        marginHorizontal: scale(20),
        marginBottom: scale(12),
        padding: scale(12),
        borderRadius: scale(12),
        backgroundColor: colors.surfaceLight,
        borderWidth: 1,
        borderColor: colors.border,
    },
    checkinCountRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(8),
    },
    checkinCountToday: {
        fontFamily: fonts.body.regular,
        fontSize: scale(13),
        color: colors.textSecondary,
    },
    checkinCountInput: {
        flex: 1,
        backgroundColor: colors.background,
        borderRadius: scale(8),
        paddingHorizontal: scale(12),
        paddingVertical: Platform.OS === 'ios' ? scale(8) : scale(6),
        fontFamily: fonts.heading.bold,
        fontSize: scale(18),
        color: colors.text,
        borderWidth: 1,
        borderColor: colors.border,
        textAlign: 'center',
    },
    checkinCountLabel: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(14),
        color: colors.textSecondary,
        width: scale(60),
    },
    checkinCountButton: {
        backgroundColor: colors.buttonPrimary,
        borderRadius: scale(8),
        paddingHorizontal: scale(16),
        paddingVertical: scale(8),
    },
    checkinCountButtonText: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(14),
        color: '#FFFFFF',
    },

    // ── Type B check-in card (full) ──
    checkinCard: {
        marginHorizontal: scale(20),
        marginTop: scale(4),
        marginBottom: scale(12),
        padding: scale(16),
        borderRadius: scale(14),
        backgroundColor: colors.surfaceLight,
        borderWidth: 1,
        borderColor: colors.border,
    },
    checkinTitle: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(15),
        color: colors.text,
        marginBottom: scale(4),
    },
    checkinRate: {
        fontFamily: fonts.body.regular,
        fontSize: scale(12),
        color: colors.textSecondary,
        marginBottom: scale(12),
    },
    checkinRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(10),
        marginBottom: scale(10),
    },
    checkinInput: {
        flex: 1,
        backgroundColor: colors.background,
        borderRadius: scale(10),
        paddingHorizontal: scale(14),
        paddingVertical: Platform.OS === 'ios' ? scale(12) : scale(8),
        fontFamily: fonts.heading.bold,
        fontSize: scale(20),
        color: colors.text,
        borderWidth: 1,
        borderColor: colors.border,
        textAlign: 'center',
    },
    checkinLabel: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(16),
        color: colors.textSecondary,
    },
    checkinDescInput: {
        backgroundColor: colors.background,
        borderRadius: scale(10),
        paddingHorizontal: scale(14),
        paddingVertical: Platform.OS === 'ios' ? scale(10) : scale(8),
        fontFamily: fonts.body.regular,
        fontSize: scale(14),
        color: colors.text,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: scale(12),
    },
    checkinButton: {
        backgroundColor: colors.buttonPrimary,
        borderRadius: scale(10),
        paddingVertical: scale(12),
        alignItems: 'center',
    },
    checkinButtonText: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(15),
        color: '#FFFFFF',
    },

    // ── Bottleneck card ──
    bottleneckCard: {
        marginHorizontal: scale(20),
        marginBottom: scale(12),
        padding: scale(16),
        borderRadius: scale(14),
        backgroundColor: '#F59E0B15',
        borderWidth: 1,
        borderColor: '#F59E0B',
    },
    bottleneckTitle: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(14),
        color: '#F59E0B',
        marginBottom: scale(4),
    },
    bottleneckDesc: {
        fontFamily: fonts.body.regular,
        fontSize: scale(13),
        color: colors.text,
        marginBottom: scale(12),
        lineHeight: scale(18),
    },
    recRow: {
        marginBottom: scale(10),
        padding: scale(10),
        backgroundColor: colors.background,
        borderRadius: scale(10),
    },
    recName: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(13),
        color: colors.text,
        marginBottom: scale(2),
    },
    recDesc: {
        fontFamily: fonts.body.regular,
        fontSize: scale(12),
        color: colors.textSecondary,
        marginBottom: scale(4),
        lineHeight: scale(16),
    },
    recMeta: {
        fontFamily: fonts.body.regular,
        fontSize: scale(11),
        color: '#F59E0B',
    },

    // ── Troubleshoot AI response ──
    troubleshootLoading: {
        alignItems: 'center',
        paddingVertical: scale(20),
    },
    troubleshootLoadingText: {
        fontFamily: fonts.body.regular,
        fontSize: scale(14),
        color: colors.textSecondary,
        marginTop: scale(8),
    },
    troubleshootResponseCard: {
        paddingVertical: scale(8),
    },
    troubleshootResponseText: {
        fontFamily: fonts.body.regular,
        fontSize: scale(15),
        color: colors.text,
        lineHeight: scale(22),
        marginBottom: scale(16),
    },

    // ── Tactical follow-up ──
    followUpCard: {
        marginHorizontal: scale(20),
        marginBottom: scale(12),
        padding: scale(16),
        borderRadius: scale(14),
        backgroundColor: '#3B82F615',
        borderWidth: 1,
        borderColor: '#3B82F6',
    },
    followUpTitle: {
        fontFamily: fonts.body.regular,
        fontSize: scale(14),
        color: colors.text,
        marginBottom: scale(4),
    },
    followUpCommit: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(15),
        color: colors.text,
        marginBottom: scale(8),
    },
    followUpQuestion: {
        fontFamily: fonts.body.regular,
        fontSize: scale(14),
        color: colors.textSecondary,
        marginBottom: scale(10),
    },
    followUpRow: {
        flexDirection: 'row',
        gap: scale(10),
    },
    followUpYes: {
        flex: 1,
        backgroundColor: '#10B981',
        borderRadius: scale(10),
        paddingVertical: scale(10),
        alignItems: 'center',
    },
    followUpYesText: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(14),
        color: '#FFFFFF',
    },
    followUpNo: {
        flex: 1,
        backgroundColor: colors.surfaceLight,
        borderRadius: scale(10),
        borderWidth: 1,
        borderColor: colors.border,
        paddingVertical: scale(10),
        alignItems: 'center',
    },
    followUpNoText: {
        fontFamily: fonts.body.regular,
        fontSize: scale(14),
        color: colors.textSecondary,
    },

    // ── Celebration card ──
    celebrationCard: {
        marginHorizontal: scale(20),
        marginBottom: scale(12),
        padding: scale(20),
        borderRadius: scale(16),
        backgroundColor: '#10B98115',
        borderWidth: 1,
        borderColor: '#10B981',
        alignItems: 'center',
    },
    celebrationEmoji: {
        fontSize: scale(48),
        marginBottom: scale(8),
    },
    celebrationTitle: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(20),
        color: '#10B981',
        marginBottom: scale(6),
    },
    celebrationDesc: {
        fontFamily: fonts.body.regular,
        fontSize: scale(14),
        color: colors.text,
        textAlign: 'center',
        marginBottom: scale(8),
    },
    celebrationStats: {
        fontFamily: fonts.body.regular,
        fontSize: scale(13),
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: scale(16),
    },
});

export default YourTasksScreen;
