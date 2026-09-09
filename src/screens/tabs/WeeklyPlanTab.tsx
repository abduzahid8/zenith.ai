import React, { useEffect, useMemo, useState } from 'react';
import {
    View,
    ScrollView,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { scale, SCREEN_WIDTH } from '../../constants';
import { fonts } from '../../theme';
import { useAppTheme } from '../../theme/useAppTheme';
import { useTaskStore } from '../../store/taskStore';
import { useAuthStore } from '../../store/authStore';
import { useUserProfileStore } from '../../store/userProfileStore';
import { Task, TaskType } from '../../services/supabase/types';
import { getMaxTasksPerDay } from '../../domain/tasks/rules';
import { useT } from '../../store/languageStore';
import { useGoalStore } from '../../store/goalStore';
import { GoalSnapshot } from '../../types/goals';
import { computeDailyFocus } from '../../services/dailyFocusEngine';
import { buildTodaySequence, TodayRow } from '../../domain/sessions/todaySequence';
import { sessionRouteForTask } from '../../domain/sessions/sessionRouting';

interface WeeklyPlanTabProps {
    isPremium: boolean;
}

/**
 * Your Day — one clear learning sequence over the REAL DailyPlan tasks.
 * User language only (Learn/Practice/Challenge); the engine taxonomy
 * (theory/practice/analysis/puzzles) stays internal. Tap → shared swipe
 * session with the real task ID. Goal + focus appear as context, never
 * as competing dashboards.
 */
const WeeklyPlanTab: React.FC<WeeklyPlanTabProps> = ({ isPremium }) => {
    const router = useRouter();
    const { user } = useAuthStore();
    const userId = user?.id;
    const { dailyTasks, loading, error, fetchDailyPlan } = useTaskStore();
    const { isPremium: profilePremium, selectedHobby } = useUserProfileStore();
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const t = useT();
    const [goalSnapshot, setGoalSnapshot] = useState<GoalSnapshot | null>(null);

    const ENGINE_TYPES: TaskType[] = ['theory', 'practice', 'analysis', 'puzzles'];

    useEffect(() => {
        if (selectedHobby) {
            const snapshot = useGoalStore.getState().getSnapshot(selectedHobby as any);
            setGoalSnapshot(snapshot);
        } else {
            setGoalSnapshot(null);
        }
    }, [selectedHobby]);

    const allEngineTasks = ENGINE_TYPES.flatMap(type => dailyTasks.filter(task => task.type === type));

    // Enforce display limit based on subscription
    const maxTasks = getMaxTasksPerDay(isPremium || profilePremium);
    const engineTasks = allEngineTasks.slice(0, maxTasks);

    useEffect(() => {
        if (userId) {
            fetchDailyPlan(userId);
        }
    }, [userId, fetchDailyPlan]);

    const sequence = useMemo(() => buildTodaySequence(engineTasks), [engineTasks]);

    // Invisible intelligence: focus engine -> one short reason, no mode names.
    const focusReason = useMemo(() => {
        if (!goalSnapshot) return null;
        try {
            const todayStr = new Date().toISOString().split('T')[0];
            const focus = computeDailyFocus({
                goal: goalSnapshot.definition,
                progress: goalSnapshot.progress,
                todayStr,
            });
            return focus?.reason ?? null;
        } catch {
            return null;
        }
    }, [goalSnapshot]);

    const handleAddPress = () => {
        const canAddMore = engineTasks.length < maxTasks;

        console.log('[WeeklyPlanTab] handleAddPress pressed - canAddMore:', canAddMore, 'engineTasks:', engineTasks.length, 'maxTasks:', maxTasks);

        if (!canAddMore && !(isPremium || profilePremium)) {
            console.log('[WeeklyPlanTab] Task limit reached - navigating to subscription');
            router.push('/subscription' as any);
        } else {
            console.log('[WeeklyPlanTab] Navigating to your-tasks');
            router.push('/your-tasks');
        }
    };

    const handleRowPress = (row: TodayRow, task: Task) => {
        if (row.completed) return;
        console.log('[WeeklyPlanTab] Row pressed - starting swipe session for task:', task.id);
        router.push(sessionRouteForTask(task, 'your_day') as any);
    };

    const bgForAction = (row: TodayRow) => {
        if (row.action === 'learn') return colors.weeklyPlan.theoryBg;
        if (row.action === 'practice') return colors.weeklyPlan.practiceBg;
        return colors.weeklyPlan.tasksBg;
    };

    const iconForAction = (row: TodayRow) => {
        if (row.action === 'learn') return require('../../../icons/book.png');
        if (row.action === 'practice') return require('../../../icons/dumbbell.png');
        return require('../../../icons/puzzle.png');
    };

    if (error && engineTasks.length === 0) {
        return (
            <View style={styles.emptyContainer}>
                <Text style={styles.errorText}>Не удалось загрузить план</Text>
                <TouchableOpacity
                    style={styles.retryButton}
                    onPress={() => {
                        console.log('[WeeklyPlanTab] Retry button pressed');
                        userId && fetchDailyPlan(userId);
                    }}
                >
                    <Text style={styles.retryButtonText}>Повторить</Text>
                </TouchableOpacity>
            </View>
        );
    }

    if (loading && engineTasks.length === 0) {
        return (
            <View style={styles.emptyContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.emptyText}>Загружаем план...</Text>
            </View>
        );
    }

    return (
        <ScrollView
            style={styles.yourDayPage}
            contentContainerStyle={{ paddingBottom: scale(100) }}
            showsVerticalScrollIndicator={false}
        >
            <Text style={styles.yourDayTitle}>{t('Твой день')}</Text>

            {goalSnapshot && (
                <TouchableOpacity
                    style={styles.goalLine}
                    activeOpacity={0.7}
                    onPress={() => {
                        console.log('[WeeklyPlanTab] Goal line pressed');
                        router.push(`/goal-detail?goalId=${goalSnapshot.definition.id}` as any);
                    }}
                >
                    <Text style={styles.goalKicker}>{t('Твоя цель')}</Text>
                    <Text style={styles.goalText} numberOfLines={1}>
                        {goalSnapshot.definition.description} · {Math.round(goalSnapshot.percentComplete)}%
                    </Text>
                </TouchableOpacity>
            )}

            {!!focusReason && sequence.rows.length > 0 && (
                <View style={styles.whyCard}>
                    <Text style={styles.whyTitle}>{t('Почему это?')}</Text>
                    <Text style={styles.whyText}>{focusReason}</Text>
                </View>
            )}

            {engineTasks.length === 0 && (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyStateTitle}>Нет задач на сегодня</Text>
                    <Text style={styles.emptyStateSubtitle}>
                        Добавьте первую задачу, чтобы начать свой день продуктивно.
                    </Text>
                    <TouchableOpacity style={styles.emptyStateCta} onPress={() => {
                        console.log('[WeeklyPlanTab] Empty state add task pressed');
                        handleAddPress();
                    }}>
                        <Text style={styles.emptyStateCtaText}>+ Добавить задачу</Text>
                    </TouchableOpacity>
                </View>
            )}

            {sequence.rows.map((row, i) => {
                // rows preserve engineTasks order 1:1 (same real task objects).
                const task = engineTasks[i];
                const isCompleted = row.completed;
                return (
                    <TouchableOpacity
                        key={row.taskId || row.title}
                        style={[
                            styles.rowCard,
                            { backgroundColor: bgForAction(row) },
                            isCompleted && styles.completedCard,
                            row.state === 'next' && !isCompleted && styles.nextCard,
                        ]}
                        activeOpacity={0.8}
                        onPress={() => task && handleRowPress(row, task)}
                    >
                        <View style={styles.rowNumber}>
                            {isCompleted ? (
                                <Image
                                    source={require('../../../icons/Vector.png')}
                                    style={{ width: scale(22), height: scale(22), tintColor: '#FFFFFF' }}
                                    resizeMode="contain"
                                />
                            ) : (
                                <Text style={styles.rowNumberText}>{i + 1}</Text>
                            )}
                        </View>
                        <View style={styles.rowTextWrap}>
                            <Text style={styles.rowAction}>
                                {t(row.actionLabel)} · ~{row.minutes} {t('min')}
                            </Text>
                            <Text style={styles.rowTitle} numberOfLines={2}>
                                {t(row.title)}
                            </Text>
                        </View>
                        {!isCompleted && (
                            <Image
                                source={iconForAction(row)}
                                style={styles.rowIcon}
                                resizeMode="contain"
                            />
                        )}
                    </TouchableOpacity>
                );
            })}

            {sequence.rows.length > 0 && !sequence.allDone && (
                <Text style={styles.minutesLeft}>
                    {t('Осталось примерно')} {sequence.minutesLeft} {t('min')}
                </Text>
            )}

            <TouchableOpacity
                style={styles.linkRow}
                activeOpacity={0.8}
                onPress={() => {
                    console.log('[WeeklyPlanTab] Quick practice pressed');
                    router.push('/quick-session' as any);
                }}
            >
                <Ionicons name="time-outline" size={scale(22)} color={colors.text} />
                <Text style={styles.linkText}>{t('Быстрая практика')}</Text>
                <Ionicons name="chevron-forward" size={scale(20)} color={colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
                style={styles.linkRow}
                activeOpacity={0.8}
                onPress={() => {
                    console.log('[WeeklyPlanTab] Verified skill pressed');
                    router.push('/credentials' as any);
                }}
            >
                <Ionicons name="shield-checkmark-outline" size={scale(22)} color={colors.text} />
                <Text style={styles.linkText}>{t('Подтверждённый навык')}</Text>
                <Ionicons name="chevron-forward" size={scale(20)} color={colors.textSecondary} />
            </TouchableOpacity>

            {(!(isPremium || profilePremium) || sequence.rows.length < maxTasks) && (
                <TouchableOpacity
                    style={styles.addTaskCard}
                    activeOpacity={0.8}
                    onPress={() => {
                        console.log('[WeeklyPlanTab] Add task card pressed');
                        handleAddPress();
                    }}
                >
                    <Image
                        source={(!(isPremium || profilePremium) && sequence.rows.length >= maxTasks) ? require('../../../icons/lock.png') : require('../../../icons/plus.png')}
                        style={{ width: scale(32), height: scale(32), tintColor: colors.iconMuted }}
                        resizeMode="contain"
                    />
                </TouchableOpacity>
            )}
        </ScrollView>
    );
};

const createStyles = (colors: any) => StyleSheet.create({
    yourDayPage: {
        width: SCREEN_WIDTH,
        flex: 1,
        backgroundColor: colors.background,
        paddingHorizontal: scale(20),
    },
    yourDayTitle: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(32),
        lineHeight: scale(34),
        color: colors.sessionTimer.text,
        marginBottom: scale(16),
        paddingHorizontal: scale(0),
    },
    goalLine: {
        backgroundColor: colors.surfaceLight,
        borderRadius: scale(16),
        paddingHorizontal: scale(16),
        paddingVertical: scale(12),
        marginBottom: scale(12),
    },
    goalKicker: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(12),
        letterSpacing: 1.5,
        textTransform: 'uppercase',
        color: colors.textSecondary,
        marginBottom: scale(2),
    },
    goalText: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(16),
        color: colors.text,
    },
    whyCard: {
        backgroundColor: '#D6EBFD',
        borderRadius: scale(16),
        paddingHorizontal: scale(16),
        paddingVertical: scale(12),
        marginBottom: scale(16),
    },
    whyTitle: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(14),
        color: '#1E1E2E',
        marginBottom: scale(2),
    },
    whyText: {
        fontFamily: fonts.body.regular,
        fontSize: scale(14),
        lineHeight: scale(20),
        color: '#1E1E2E',
        opacity: 0.8,
    },
    rowCard: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: scale(25),
        paddingLeft: scale(16),
        paddingRight: scale(20),
        paddingVertical: scale(18),
        marginBottom: scale(10),
        minHeight: scale(100),
    },
    nextCard: {
        borderWidth: 2,
        borderColor: '#0F2147',
    },
    completedCard: {
        backgroundColor: '#3CEB59',
        borderWidth: 0,
    },
    rowNumber: {
        width: scale(44),
        height: scale(44),
        borderRadius: scale(22),
        backgroundColor: 'rgba(255,255,255,0.45)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: scale(14),
    },
    rowNumberText: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(20),
        color: '#1E1E2E',
    },
    rowTextWrap: {
        flex: 1,
        marginRight: scale(12),
    },
    rowAction: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(14),
        color: '#1E1E2E',
        opacity: 0.7,
        marginBottom: scale(4),
    },
    rowTitle: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(20),
        lineHeight: scale(26),
        color: '#1E1E2E',
    },
    rowIcon: {
        width: scale(36),
        height: scale(36),
        tintColor: '#08132A',
    },
    minutesLeft: {
        fontFamily: fonts.body.regular,
        fontSize: scale(14),
        color: colors.textSecondary,
        textAlign: 'center',
        marginVertical: scale(8),
    },
    linkRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surfaceLight,
        borderRadius: scale(20),
        paddingHorizontal: scale(18),
        paddingVertical: scale(16),
        marginTop: scale(8),
        gap: scale(12),
    },
    linkText: {
        flex: 1,
        fontFamily: fonts.heading.bold,
        fontSize: scale(16),
        color: colors.text,
    },
    addTaskCard: {
        alignSelf: 'stretch',
        borderRadius: scale(25),
        backgroundColor: colors.weeklyPlan.addTaskBg,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: scale(25),
        marginTop: scale(8),
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: scale(12),
        paddingBottom: scale(80),
    },
    emptyText: {
        fontFamily: fonts.body.regular,
        fontSize: scale(16),
        color: colors.textSecondary,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: scale(40),
        gap: scale(12),
    },
    emptyStateTitle: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(22),
        color: colors.text,
        textAlign: 'center',
    },
    emptyStateSubtitle: {
        fontFamily: fonts.body.regular,
        fontSize: scale(15),
        color: colors.textSecondary,
        textAlign: 'center',
        paddingHorizontal: scale(20),
        lineHeight: scale(22),
    },
    emptyStateCta: {
        marginTop: scale(8),
        backgroundColor: colors.primary,
        borderRadius: scale(50),
        paddingVertical: scale(14),
        paddingHorizontal: scale(32),
    },
    emptyStateCtaText: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(16),
        color: colors.white,
    },
    errorText: {
        fontFamily: fonts.body.regular,
        fontSize: scale(16),
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: scale(8),
    },
    retryButton: {
        backgroundColor: colors.primary,
        borderRadius: scale(50),
        paddingVertical: scale(12),
        paddingHorizontal: scale(28),
    },
    retryButtonText: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(15),
        color: colors.white,
    },
});

export default WeeklyPlanTab;
