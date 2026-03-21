import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Image, ImageSourcePropType } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { useTaskStore } from '../store/taskStore';
import { useAuthStore } from '../store/authStore';
import { useUserProfileStore } from '../store/userProfileStore';
import { Task, TaskType } from '../services/supabase/types';
import { fonts } from '../theme';
import { scale } from '../constants';
import { TaskFeedbackModal } from './TaskFeedbackModal';
import { useAppTheme } from '../theme/useAppTheme';
import { useT } from '../store/languageStore';

const getTaskColors = (type: TaskType, colors: any) => {
    switch (type) {
        case 'theory':
            return { bg: '#9CE4FD', iconBg: '#08132A' }; // Original explicitly defined hexes
        case 'practice':
            return { bg: '#7CB9FF', iconBg: '#08132A' };
        case 'analysis':
            return { bg: '#F4C0FD', iconBg: '#08132A' };
        case 'puzzles':
            return { bg: '#FCB5FD', iconBg: '#08132A' };
        default:
            return { bg: colors.home.cardBorder, iconBg: '#08132A' };
    }
};

const TaskCard = ({ task, onPress, colors }: { task: Task, onPress: (task: Task) => void, colors: any }) => {
    const theme = getTaskColors(task.type, colors);
    const isCompleted = task.status === 'completed';
    const styles = useMemo(() => createStyles(colors), [colors]);
    const t = useT();

    const getTaskTypeLabel = (type: TaskType) => {
        switch (type) {
            case 'theory': return t('Узнай');
            case 'practice': return t('Сделай');
            case 'analysis': return t('Углуби 2');
            case 'puzzles': return t('Углуби 1');
            default: return t('Задача');
        }
    };

    // Map icon source
    let iconSource: ImageSourcePropType = require('../../icons/book.png');
    // Icon style adjustments
    let iconStyle = {};

    switch (task.type) {
        case 'theory':
            iconSource = require('../../icons/book.png');
            break;
        case 'practice':
            iconSource = require('../../icons/dumbbell.png');
            break;
        case 'analysis':
            iconSource = require('../../icons/magnifier.png');
            iconStyle = { marginRight: scale(4) };
            break;
        case 'puzzles':
            iconSource = require('../../icons/puzzle.png');
            iconStyle = { marginRight: scale(4) };
            break;
    }
    return (
        <TouchableOpacity
            style={[
                styles.card,
                { backgroundColor: theme.bg },
                isCompleted && styles.cardCompleted
            ]}
            onPress={() => onPress(task)}
            activeOpacity={0.9}
        >
            <View style={styles.cardContent}>
                <View style={styles.textContent}>
                    <Text style={[styles.cardTitle, isCompleted && styles.completedCardTitle]}>{getTaskTypeLabel(task.type)}</Text>
                    <Text style={[styles.cardSubtitle, isCompleted && styles.completedCardSubtitle]} numberOfLines={2}>
                        {task.title}
                    </Text>
                </View>
                <View style={[styles.iconContainer, { backgroundColor: 'transparent' }]}>
                    {isCompleted ? (
                        <Svg
                            width={scale(24)}
                            height={scale(24)}
                            viewBox="0 0 24 24"
                            fill="none"
                        >
                            <Polyline
                                points="4 12 9 17 20 6"
                                stroke="#FFFFFF"
                                strokeWidth="5.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </Svg>
                    ) : (
                        <Image
                            source={iconSource}
                            style={[{ width: scale(24), height: scale(24), tintColor: '#000' }, iconStyle]}
                            resizeMode="contain"
                        />
                    )}
                </View>
            </View>
        </TouchableOpacity>
    );
};

const AddTaskCard = ({ onPress, isUpgrade = false, taskCount = 0, colors }: { onPress: () => void, isUpgrade?: boolean, taskCount?: number, colors: any }) => {
    const styles = useMemo(() => createStyles(colors), [colors]);
    const dynamicStyle = taskCount === 2
        ? { height: scale(179) }
        : taskCount === 3
            ? { height: scale(100) }
            : {};

    const iconSource = isUpgrade ? require('../../icons/lock.png') : require('../../icons/plus.png');

    return (
        <TouchableOpacity
            style={[styles.card, styles.addCard, dynamicStyle]}
            onPress={onPress}
            activeOpacity={0.8}
        >
            <Image
                source={iconSource}
                style={[styles.addIcon, { tintColor: '#ADADAD' }]} // Gray color for plus/lock
            />
            {isUpgrade && (
                <Text style={styles.upgradeText}>Unlock Premium</Text>
            )}
        </TouchableOpacity>
    );
};

export const DailyTasksList = () => {
    const router = useRouter();
    const { dailyTasks, loading, fetchDailyPlan, completeTask } = useTaskStore();
    const { user } = useAuthStore();
    const { isPremium } = useUserProfileStore();
    const userId = user?.id;

    const [modalVisible, setModalVisible] = React.useState(false);
    const [selectedTask, setSelectedTask] = React.useState<Task | null>(null);
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const t = useT();

    const getTaskTypeLabel = (type: TaskType) => {
        switch (type) {
            case 'theory': return t('Узнай');
            case 'practice': return t('Сделай');
            case 'analysis': return t('Углуби 2');
            case 'puzzles': return t('Углуби 1');
            default: return t('Задача');
        }
    };

    useEffect(() => {
        if (userId) {
            fetchDailyPlan(userId);
        }
    }, [userId]);

    const handleTaskPress = (task: Task) => {
        if (task.status === 'completed') return;
        setSelectedTask(task);
        setModalVisible(true);
    };

    const handleAddPress = () => {
        const ENGINE_TYPES: TaskType[] = ['theory', 'practice', 'analysis', 'puzzles'];
        const engineTasks = dailyTasks.filter(t => ENGINE_TYPES.includes(t.type as TaskType));
        const canAddMore = isPremium ? engineTasks.length < 4 : engineTasks.length < 3;

        if (!canAddMore && !isPremium) {
            router.push('/subscription');
        } else {
            router.push('/your-tasks');
        }
    };

    const handleFeedbackSubmit = async (feedback: { difficulty_rating: number; engagement_rating: number; user_notes: string }) => {
        if (userId && selectedTask && selectedTask.id) {
            await completeTask(userId, selectedTask.id, feedback);
            setModalVisible(false);
            setSelectedTask(null);
        }
    };

    const handleModalClose = () => {
        setModalVisible(false);
        setSelectedTask(null);
    };

    if (loading && dailyTasks.length === 0) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={colors.text} />
            </View>
        );
    }

    const ENGINE_TYPES: TaskType[] = ['theory', 'practice', 'analysis', 'puzzles'];
    const allEngineTasks = dailyTasks.filter(t => ENGINE_TYPES.includes(t.type as TaskType));
    
    // Enforce display limit based on subscription
    const maxTasks = isPremium ? 4 : 3;
    const engineTasks = allEngineTasks.slice(0, maxTasks);

    const showAddButton = true; // Always allow user to try to add or see categories
    const isUpgradeButton = !isPremium && engineTasks.length >= 3;

    return (
        <View style={styles.container}>
            <Text style={styles.headerTitle}>{t('Твой день')}</Text>
            <View style={styles.listContainer}>
                {engineTasks.map((task, index) => (
                    <TaskCard
                        key={task.id || index}
                        task={task}
                        onPress={handleTaskPress}
                        colors={colors}
                    />
                ))}

                {showAddButton && (
                    <AddTaskCard onPress={handleAddPress} isUpgrade={isUpgradeButton} taskCount={engineTasks.length} colors={colors} />
                )}
            </View>

            <TaskFeedbackModal
                visible={modalVisible}
                onClose={handleModalClose}
                onSubmit={handleFeedbackSubmit}
                taskTitle={selectedTask?.title || ''}
            />
        </View>
    );
};


const createStyles = (colors: any) => StyleSheet.create({
    container: {
        marginBottom: scale(24),
    },
    headerTitle: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(32),
        color: colors.home.darkText,
        marginBottom: scale(16),
        marginLeft: scale(4),
    },
    loadingContainer: {
        height: scale(200),
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContainer: {
        gap: scale(16),
    },
    // Card styles
    card: {
        borderRadius: scale(25),
        paddingVertical: scale(24),
        paddingLeft: scale(16),
        paddingRight: scale(24),
        minHeight: scale(100),
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
        elevation: 4,
    },
    cardCompleted: {
        backgroundColor: '#3CEB59',
        borderWidth: 1,
        borderColor: '#3CEB59',
        opacity: 1,
    },
    cardContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    textContent: {
        flex: 1,
        marginRight: scale(16),
    },
    cardTitle: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(20),
        color: '#1E1E2E', // Explicitly keep light text mode within colorful task cards 
        marginBottom: scale(4),
    },
    cardSubtitle: {
        fontFamily: fonts.body.regular,
        fontSize: scale(16),
        color: '#4E4E4E',
        lineHeight: scale(22),
    },
    completedCardTitle: {
        color: '#0F2A16',
    },
    completedCardSubtitle: {
        color: '#184225',
    },
    iconContainer: {
        width: scale(50),
        height: scale(50),
        borderRadius: scale(14),
        justifyContent: 'center',
        alignItems: 'center',
    },
    addCard: {
        backgroundColor: colors.surfaceLight, // '#E6EBF0' equivalent
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: scale(100), // Match other cards
    },
    addIcon: {
        width: scale(32),
        height: scale(32),
    },
    upgradeText: {
        marginTop: scale(8),
        fontFamily: fonts.body.medium,
        color: colors.text,
        fontSize: scale(14)
    }
});

export default DailyTasksList;
