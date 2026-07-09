import React, { useMemo, useEffect, useState, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView, Image,
    StatusBar, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { SafeAreaView } from 'react-native-safe-area-context';
import { useTaskStore } from '../store/taskStore';
import { useUserProfileStore } from '../store/userProfileStore';
import { useAuthStore } from '../store/authStore';
import { useGoalStore } from '../store/goalStore';
import { GoalSnapshot } from '../types/goals';
import GoalProgressBar from '../components/goal/GoalProgressBar';
import { GoalCheckinCard } from '../components/goal/GoalCheckinCard';
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
    const [showFollowUp, setShowFollowUp] = useState(false);
    const [followUpCommit, setFollowUpCommit] = useState('');

    const selectedRef = useRef(selectedHobby);
    selectedRef.current = selectedHobby;

    const loadSnapshot = useCallback(() => {
        const store = useGoalStore.getState();
        const hobby = selectedRef.current;
        let snap: GoalSnapshot | null = null;
        if (hobby) {
            snap = store.getSnapshot(hobby as any);
        }
        if (!snap) {
            snap = store.getActiveSnapshot();
        }
        setGoalSnapshot(snap);
        if (snap?.definition.category === 'execution') {
            const history = snap.progress.history;
            const today = new Date().toISOString().split('T')[0];
            const lastEntry = history.length > 0 ? history[history.length - 1] : null;
            if (lastEntry && lastEntry.date !== today && lastEntry.description.startsWith('commit: ')) {
                setFollowUpCommit(lastEntry.description.replace('commit: ', ''));
                setShowFollowUp(true);
            } else {
                setShowFollowUp(false);
            }
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

    const handleFollowUp = useCallback((done: boolean) => {
        setShowFollowUp(false);
        if (done && goalSnapshot) {
            const store = useGoalStore.getState();
            store.recordCheckin(goalSnapshot.progress.currentValue, 'follow-up: done', undefined, goalSnapshot.definition.hobby);
            setGoalSnapshot(store.getActiveSnapshot());
            Alert.alert('Nice! Progress logged.');
        }
    }, [goalSnapshot]);

    const ENGINE_TYPES: TaskType[] = ['theory', 'practice', 'analysis', 'puzzles'];
    const engineTasksCount = dailyTasks.filter(t => ENGINE_TYPES.includes(t.type as TaskType)).length;
    const maxTasks = getMaxTasksPerDay(isPremium);

    const handleAdd = async (type: TaskType) => {
        if (!user?.id) return;
        const templates = (taskEngine as any).getAvailableTaskTemplates(selectedHobby ?? undefined, type);
        const alreadyAdded = dailyTasks.filter(t => t.type === type);
        const next = templates.find((tmpl: any) => !alreadyAdded.some((t: any) => t.title === tmpl.title));
        const template = next || templates[0];
        if (!template) return;
        try {
            await addTask(user.id, type, template);
            router.back();
        } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to add task');
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={scale(24)} color={colors.text} />
                    <Text style={styles.backText}>{t('Назад')}</Text>
                </TouchableOpacity>
                <Text style={styles.title}>{t('Твои задачи')}</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {/* Goal section */}
                {goalSnapshot ? (
                    <>
                        <GoalProgressBar
                            snapshot={goalSnapshot}
                            onEdit={() => router.push(`/goal-setup?edit=${goalSnapshot.definition.id}${selectedHobby ? `&hobbyId=${selectedHobby}` : ''}` as any)}
                            onPress={() => router.push(`/goal-detail?goalId=${goalSnapshot.definition.id}${selectedHobby ? `&hobbyId=${selectedHobby}` : ''}` as any)}
                        />

                        {/* Tactical follow-up — separate concern from the mode card, shown above it */}
                        {goalSnapshot.definition.category === 'execution' && showFollowUp && followUpCommit && (
                            <View style={styles.followUpCard}>
                                <Text style={styles.followUpTitle}>Yesterday you committed to:</Text>
                                <Text style={styles.followUpCommit}>"{followUpCommit}"</Text>
                                <Text style={styles.followUpQuestion}>Did you do it?</Text>
                                <View style={styles.followUpRow}>
                                    <TouchableOpacity style={styles.followUpYes} onPress={() => handleFollowUp(true)} activeOpacity={0.8}>
                                        <Text style={styles.followUpYesText}>Yes ✅</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.followUpNo} onPress={() => handleFollowUp(false)} activeOpacity={0.8}>
                                        <Text style={styles.followUpNoText}>Not yet</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        {/* Single unified check-in surface — one card, driven by mode */}
                        {goalSnapshot.definition.category === 'execution' && goalSnapshot.definition.status === 'active' && (
                            <GoalCheckinCard
                                snapshot={goalSnapshot}
                                colors={colors}
                                onRefresh={(next) => setGoalSnapshot(next)}
                            />
                        )}

                        {/* Celebration card for completed goals */}
                        {goalSnapshot.definition.status === 'completed' && (
                            <View style={styles.celebrationCard}>
                                <Text style={styles.celebrationEmoji}>🎉</Text>
                                <Text style={styles.celebrationTitle}>Goal complete!</Text>
                                <Text style={styles.celebrationDesc}>You reached "{goalSnapshot.definition.description}"</Text>
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

                    {!isPremium && engineTasksCount >= maxTasks && (
                        <View key="locked-last" style={{ marginBottom: scale(16) }}>
                            <CategoryCard
                                category={categories[3]}
                                existingTask={null}
                                isLocked={true}
                                onAdd={() => { }}
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
                        onPress={() => router.push('/subscription')}
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
                    <Image source={category.icon} style={styles.cardIcon} resizeMode="contain" />
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
                <TouchableOpacity style={[styles.addButton, styles.addedButton]} onPress={onAdd} activeOpacity={0.7}>
                    <Image source={require('../../icons/plus.png')} style={[styles.plusIcon, { opacity: 0.5 }]} />
                </TouchableOpacity>
            ) : (
                <TouchableOpacity style={styles.addButton} onPress={onAdd} activeOpacity={0.7}>
                    <Image source={require('../../icons/plus.png')} style={styles.plusIcon} />
                </TouchableOpacity>
            )}
        </View>
    );
};

const createStyles = (colors: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: scale(20), paddingVertical: scale(16), justifyContent: 'space-between' },
    backButton: { flexDirection: 'row', alignItems: 'center', padding: scale(8), marginLeft: -scale(8), zIndex: 10 },
    backText: { fontFamily: fonts.body.regular, fontSize: scale(16), color: colors.text, marginLeft: scale(4) },
    title: { fontFamily: fonts.heading.bold, fontSize: scale(20), color: colors.text, position: 'absolute', left: 0, right: 0, textAlign: 'center', zIndex: -1 },
    content: { padding: scale(20), paddingBottom: scale(40) },

    setGoalCard: { marginBottom: scale(20), padding: scale(20), borderRadius: scale(16), backgroundColor: colors.surfaceLight, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', alignItems: 'center' },
    setGoalTitle: { fontFamily: fonts.heading.bold, fontSize: scale(16), color: colors.text, marginBottom: scale(6), textAlign: 'center' },
    setGoalSubtitle: { fontFamily: fonts.body.regular, fontSize: scale(13), color: colors.textSecondary, textAlign: 'center', lineHeight: scale(18), marginBottom: scale(16) },
    setGoalButton: { backgroundColor: colors.buttonPrimary, borderRadius: scale(20), paddingHorizontal: scale(24), paddingVertical: scale(10) },
    setGoalButtonText: { fontFamily: fonts.heading.bold, fontSize: scale(14), color: '#FFFFFF' },

    subtitle: { fontFamily: fonts.body.regular, fontSize: scale(16), color: colors.textSecondary, marginBottom: scale(24), lineHeight: scale(22) },
    cardsContainer: { paddingBottom: scale(20) },
    card: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: scale(24), padding: scale(16), height: scale(88) },
    cardInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    iconContainer: { width: scale(48), height: scale(48), borderRadius: scale(14), backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center', marginRight: scale(16) },
    cardIcon: { width: scale(24), height: scale(24), tintColor: '#1E1E2E' },
    textContainer: { flex: 1 },
    cardTitle: { fontFamily: fonts.heading.bold, fontSize: scale(18), color: '#1E1E2E', marginBottom: scale(2) },
    cardSubtitle: { fontFamily: fonts.body.regular, fontSize: scale(14), color: '#1E1E2E', opacity: 0.7 },
    addButton: { width: scale(48), height: scale(48), borderRadius: scale(24), backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center' },
    addedButton: { backgroundColor: 'rgba(255,255,255,0.6)' },
    lockedCard: { borderRadius: scale(25), height: scale(100), backgroundColor: '#E6EBF0', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 5, elevation: 2 },
    lockIcon: { width: scale(32), height: scale(32), tintColor: '#ADADAD' },
    doneButton: { backgroundColor: 'rgba(255,255,255,0.5)' },
    checkIcon: { width: scale(20), height: scale(20), tintColor: '#FFFFFF' },
    plusIcon: { width: scale(20), height: scale(20), tintColor: '#1E1E2E' },
    upgradeCard: { marginTop: scale(24), padding: scale(16), backgroundColor: colors.surfaceLight || '#F0F0F0', borderRadius: scale(16), alignItems: 'center', justifyContent: 'center' },
    upgradeText: { fontFamily: fonts.body.medium, fontSize: scale(14), color: colors.textSecondary, textAlign: 'center' },

    checkinButton: { backgroundColor: colors.buttonPrimary, borderRadius: scale(10), paddingVertical: scale(12), alignItems: 'center' },
    checkinButtonText: { fontFamily: fonts.heading.bold, fontSize: scale(15), color: '#FFFFFF' },

    followUpCard: { marginHorizontal: scale(20), marginBottom: scale(12), padding: scale(16), borderRadius: scale(14), backgroundColor: '#3B82F615', borderWidth: 1, borderColor: '#3B82F6' },
    followUpTitle: { fontFamily: fonts.body.regular, fontSize: scale(14), color: colors.text, marginBottom: scale(4) },
    followUpCommit: { fontFamily: fonts.heading.bold, fontSize: scale(15), color: colors.text, marginBottom: scale(8) },
    followUpQuestion: { fontFamily: fonts.body.regular, fontSize: scale(14), color: colors.textSecondary, marginBottom: scale(10) },
    followUpRow: { flexDirection: 'row', gap: scale(10) },
    followUpYes: { flex: 1, backgroundColor: '#10B981', borderRadius: scale(10), paddingVertical: scale(10), alignItems: 'center' },
    followUpYesText: { fontFamily: fonts.heading.bold, fontSize: scale(14), color: '#FFFFFF' },
    followUpNo: { flex: 1, backgroundColor: colors.surfaceLight, borderRadius: scale(10), borderWidth: 1, borderColor: colors.border, paddingVertical: scale(10), alignItems: 'center' },
    followUpNoText: { fontFamily: fonts.body.regular, fontSize: scale(14), color: colors.textSecondary },

    celebrationCard: { marginHorizontal: scale(20), marginBottom: scale(12), padding: scale(20), borderRadius: scale(16), backgroundColor: '#10B98115', borderWidth: 1, borderColor: '#10B981', alignItems: 'center' },
    celebrationEmoji: { fontSize: scale(48), marginBottom: scale(8) },
    celebrationTitle: { fontFamily: fonts.heading.bold, fontSize: scale(20), color: '#10B981', marginBottom: scale(6) },
    celebrationDesc: { fontFamily: fonts.body.regular, fontSize: scale(14), color: colors.text, textAlign: 'center', marginBottom: scale(8) },
    celebrationStats: { fontFamily: fonts.body.regular, fontSize: scale(13), color: colors.textSecondary, textAlign: 'center', marginBottom: scale(16) },
});

export default YourTasksScreen;
