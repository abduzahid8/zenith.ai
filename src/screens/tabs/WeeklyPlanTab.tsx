import React, { useEffect, useMemo } from 'react';
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
import { useT } from '../../store/languageStore';

interface WeeklyPlanTabProps {
    isPremium: boolean;
}

const WeeklyPlanTab: React.FC<WeeklyPlanTabProps> = ({ isPremium }) => {
    const router = useRouter();
    const { user } = useAuthStore();
    const userId = user?.id;
    const { dailyTasks, loading, error, fetchDailyPlan } = useTaskStore();
    const { isPremium: profilePremium, setWeeklyTasks } = useUserProfileStore();
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const t = useT();

    const ENGINE_TYPES: TaskType[] = ['theory', 'practice', 'analysis', 'puzzles'];
    const allEngineTasks = dailyTasks.filter(task => ENGINE_TYPES.includes(task.type as TaskType));
    
    // Enforce display limit based on subscription
    const maxTasks = (isPremium || profilePremium) ? 4 : 3;
    const engineTasks = allEngineTasks.slice(0, maxTasks);

    useEffect(() => {
        if (userId) {
            fetchDailyPlan(userId);
        }
    }, [userId]);

    // Sync task titles into weeklyTasks whenever dailyTasks change
    useEffect(() => {
        if (engineTasks.length > 0) {
            setWeeklyTasks(engineTasks.map(task => ({ text: task.title, completed: task.status === 'completed' })));
        }
    }, [dailyTasks]);

    const handleAddPress = () => {
        const maxTasks = (isPremium || profilePremium) ? 4 : 3;
        const canAddMore = engineTasks.length < maxTasks;

        if (!canAddMore && !(isPremium || profilePremium)) {
            router.push('/subscription' as any);
        } else {
            router.push('/your-tasks');
        }
    };

    const getCardStyleForTask = (task: Task) => {
        let baseStyle;
        let baseHeight;

        switch (task.type) {
            case 'theory':
                baseStyle = styles.theoryCard;
                baseHeight = 119;
                break;
            case 'practice':
                baseStyle = styles.practiceCard;
                baseHeight = 100;
                break;
            case 'analysis':
                baseStyle = styles.analysisCard;
                baseHeight = 101;
                break;
            case 'puzzles':
                baseStyle = styles.tasksCard;
                baseHeight = 100;
                break;
            default:
                baseStyle = styles.theoryCard;
                baseHeight = 119;
        }

        const wordCount = task.title ? task.title.trim().split(/\s+/).length : 0;
        if (wordCount >= 3) {
            return [baseStyle, { height: scale(baseHeight + 20) }];
        }

        return baseStyle;
    };

    const getTitleForType = (type: TaskType) => {
        switch (type) {
            case 'theory':
                return t('Узнай');
            case 'practice':
                return t('Сделай');
            case 'analysis':
                return t('Углуби 2');
            case 'puzzles':
                return t('Углуби 1');
            default:
                return t('Задача');
        }
    };

    // Fixed visual order: 1) Теория, 2) Практика, 3) Анализ, 4) Задачи
    const orderedTasks: Task[] = ENGINE_TYPES
        .flatMap(type => engineTasks.filter(task => task.type === type));

    if (error && engineTasks.length === 0) {
        return (
            <View style={styles.emptyContainer}>
                <Text style={styles.errorText}>Не удалось загрузить план</Text>
                <TouchableOpacity
                    style={styles.retryButton}
                    onPress={() => userId && fetchDailyPlan(userId)}
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

            {engineTasks.length === 0 && (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyStateTitle}>Нет задач на сегодня</Text>
                    <Text style={styles.emptyStateSubtitle}>
                        Добавьте первую задачу, чтобы начать свой день продуктивно.
                    </Text>
                    <TouchableOpacity style={styles.emptyStateCta} onPress={handleAddPress}>
                        <Text style={styles.emptyStateCtaText}>+ Добавить задачу</Text>
                    </TouchableOpacity>
                </View>
            )}

            {orderedTasks.map((task) => {
                const isCompleted = task.status === 'completed';
                const cardStyle = getCardStyleForTask(task);
                const title = getTitleForType(task.type);

                let iconSource = require('../../../icons/book.png');
                if (task.type === 'practice') iconSource = require('../../../icons/dumbbell.png');
                if (task.type === 'analysis') iconSource = require('../../../icons/magnifier.png');
                if (task.type === 'puzzles') iconSource = require('../../../icons/puzzle.png');

                const iconContainerStyle =
                    task.type === 'theory'
                        ? styles.theoryIconContainer
                        : task.type === 'practice'
                            ? styles.practiceIconContainer
                            : task.type === 'analysis'
                                ? styles.analysisIconContainer
                                : styles.tasksIconContainer;

                const iconStyle =
                    task.type === 'theory'
                        ? styles.iconTheory
                        : task.type === 'practice'
                            ? styles.iconPractice
                            : task.type === 'analysis'
                                ? styles.iconAnalysis
                                : styles.iconTasks;

                const descriptionStyle =
                    task.type === 'analysis'
                        ? styles.analysisDescription
                        : task.type === 'puzzles'
                            ? styles.tasksDescription
                            : styles.taskCardDescription;

                const titleStyle =
                    task.type === 'analysis'
                        ? styles.analysisTitle
                        : task.type === 'puzzles'
                            ? styles.tasksTitle
                            : styles.taskCardTitle;

                return (
                    <TouchableOpacity
                        key={task.id || task.title}
                        style={[cardStyle, isCompleted && styles.completedCard]}
                        activeOpacity={0.8}
                    >
                        <View style={styles.taskCardContent}>
                            <View style={styles.taskCardTextContainer}>
                                <Text style={titleStyle}>{title}</Text>
                                <Text style={descriptionStyle}>
                                    {task.title}
                                </Text>
                            </View>
                            <View style={iconContainerStyle}>
                                {isCompleted ? (
                                    <Ionicons name="checkmark" size={scale(40)} color="#FFFFFF" />
                                ) : (
                                    <Image
                                        source={iconSource}
                                        style={iconStyle}
                                        resizeMode="contain"
                                    />
                                )}
                            </View>
                        </View>
                    </TouchableOpacity>
                );
            })}

            {/* Add Task button */}
            {(orderedTasks.length < ((isPremium || profilePremium) ? 4 : 3) || (!(isPremium || profilePremium) && orderedTasks.length === 3)) && (
                <TouchableOpacity
                    style={[
                        styles.addTaskCard,
                        orderedTasks.length === 2 && { height: scale(179) },
                        orderedTasks.length >= 3 && { height: scale(100) },
                    ]}
                    activeOpacity={0.8}
                    onPress={handleAddPress}
                >
                    <Image 
                        source={(!(isPremium || profilePremium) && orderedTasks.length === 3) ? require('../../../icons/lock.png') : require('../../../icons/plus.png')} 
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
        marginBottom: scale(44),
        paddingHorizontal: scale(0),
    },
    theoryCard: {
        height: scale(119),
        alignSelf: 'stretch',
        borderRadius: scale(25),
        backgroundColor: colors.weeklyPlan.theoryBg,
        paddingLeft: scale(20),
        paddingRight: scale(20),
        paddingVertical: scale(18),
        marginBottom: scale(10),
    },
    practiceCard: {
        height: scale(100),
        alignSelf: 'stretch',
        borderRadius: scale(25),
        backgroundColor: colors.weeklyPlan.practiceBg,
        paddingLeft: scale(20),
        paddingRight: scale(20),
        paddingVertical: scale(18),
        marginBottom: scale(10),
    },
    analysisCard: {
        height: scale(101),
        alignSelf: 'stretch',
        borderRadius: scale(25),
        backgroundColor: colors.weeklyPlan.analysisBg,
        paddingLeft: scale(20),
        paddingRight: scale(20),
        paddingVertical: scale(18),
        marginBottom: scale(10),
    },
    analysisTitle: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(25),
        lineHeight: scale(30),
        color: colors.black,
        marginBottom: scale(6),
    },
    analysisDescription: {
        fontFamily: fonts.body.light,
        fontSize: scale(20),
        lineHeight: scale(24),
        color: colors.black,
        alignSelf: 'stretch',
    },
    analysisIconContainer: {
        width: scale(40),
        height: scale(44),
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: scale(-25),
    },
    tasksCard: {
        height: scale(101),
        alignSelf: 'stretch',
        borderRadius: scale(25),
        backgroundColor: colors.weeklyPlan.tasksBg,
        paddingLeft: scale(20),
        paddingRight: scale(20),
        paddingVertical: scale(18),
        marginBottom: scale(10),
    },
    tasksTitle: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(25),
        lineHeight: scale(30),
        color: colors.black,
        marginBottom: scale(6),
    },
    tasksDescription: {
        fontFamily: fonts.body.light,
        fontSize: scale(20),
        lineHeight: scale(24),
        color: colors.sessionTimer.text,
        width: scale(322),
    },
    tasksIconContainer: {
        width: scale(40),
        height: scale(40),
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: scale(-25),
    },
    taskCardContent: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    taskCardTextContainer: {
        flex: 1,
    },
    taskCardTitle: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(25),
        lineHeight: scale(30),
        color: colors.text,
        marginBottom: scale(6),
        paddingHorizontal: scale(0),
    },
    taskCardDescription: {
        fontFamily: fonts.body.light,
        fontSize: scale(20),
        lineHeight: scale(24),
        color: colors.text,
    },
    theoryIconContainer: {
        width: scale(42),
        height: scale(42),
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: scale(-35),
    },
    practiceIconContainer: {
        width: scale(40),
        height: scale(40),
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: scale(-25),
    },
    iconTheory: {
        width: scale(42),
        height: scale(42),
        tintColor: '#08132A',
    },
    iconPractice: {
        width: scale(40),
        height: scale(40),
        tintColor: '#08132A',
    },
    iconAnalysis: {
        width: scale(40),
        height: scale(44),
        tintColor: '#08132A',
    },
    iconTasks: {
        width: scale(40),
        height: scale(40),
        tintColor: '#08132A',
    },
    addTaskCard: {
        alignSelf: 'stretch',
        borderRadius: scale(25),
        backgroundColor: colors.weeklyPlan.addTaskBg,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: scale(25),
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
    completedCard: {
        backgroundColor: '#3CEB59',
        borderWidth: 0,
    },
});

export default WeeklyPlanTab;
