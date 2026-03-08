import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Image, ImageSourcePropType } from 'react-native';
import { useRouter } from 'expo-router';
import { useTaskStore } from '../store/taskStore';
import { useAuthStore } from '../store/authStore';
import { useUserProfileStore } from '../store/userProfileStore';
import { Task, TaskType } from '../services/supabase/types';
import { colors, fonts } from '../theme';
import { scale } from '../constants';
import { TaskFeedbackModal } from './TaskFeedbackModal';

const getTaskColors = (type: TaskType) => {
    switch (type) {
        case 'theory':
            return { bg: '#9CE4FD', iconBg: colors.dark }; // Light Cyan
        case 'practice':
            return { bg: '#7CB9FF', iconBg: colors.dark }; // Blue
        case 'analysis':
            return { bg: '#F4C0FD', iconBg: colors.dark }; // Pink
        case 'puzzles':
            return { bg: '#FCB5FD', iconBg: colors.dark }; // Light Magenta
        default:
            return { bg: colors.home.cardBorder, iconBg: colors.dark };
    }
};

const TaskCard = ({ task, onPress }: { task: Task, onPress: (task: Task) => void }) => {
    const theme = getTaskColors(task.type);
    const isCompleted = task.status === 'completed';

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
    if (isCompleted) iconSource = require('../../icons/checkbox-checked.png');

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
                    <Text style={styles.cardTitle}>{getTaskTypeLabel(task.type)}</Text>
                    <Text style={styles.cardSubtitle} numberOfLines={2}>
                        {task.title}
                    </Text>
                </View>
                <View style={[styles.iconContainer, { backgroundColor: 'transparent' }]}>
                    <Image
                        source={iconSource}
                        style={[{ width: scale(24), height: scale(24), tintColor: '#000' }, iconStyle]}
                        resizeMode="contain"
                    />
                </View>
            </View>
        </TouchableOpacity>
    );
};

const AddTaskCard = ({ onPress, isUpgrade = false, taskCount = 0 }: { onPress: () => void, isUpgrade?: boolean, taskCount?: number }) => {
    const dynamicStyle = taskCount === 2
        ? { height: scale(179) }
        : taskCount === 3
            ? { height: scale(100) }
            : {};

    return (
        <TouchableOpacity
            style={[styles.card, styles.addCard, dynamicStyle]}
            onPress={onPress}
            activeOpacity={0.8}
        >
            <Image
                source={require('../../icons/plus.png')}
                style={[styles.addIcon, { tintColor: '#ADADAD' }]} // Gray color for plus
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
            router.push('/Paywall'); // Assuming Paywall is a route
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
    const engineTasks = dailyTasks.filter(t => ENGINE_TYPES.includes(t.type as TaskType));

    const showAddButton = true; // Always allow user to try to add or see categories
    const isUpgradeButton = !isPremium && engineTasks.length >= 3;

    return (
        <View style={styles.container}>
            <Text style={styles.headerTitle}>Твой день</Text>
            <View style={styles.listContainer}>
                {engineTasks.map((task, index) => (
                    <TaskCard
                        key={task.id || index}
                        task={task}
                        onPress={handleTaskPress}
                    />
                ))}

                {showAddButton && (
                    <AddTaskCard onPress={handleAddPress} isUpgrade={isUpgradeButton} taskCount={engineTasks.length} />
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

const getTaskTypeLabel = (type: TaskType) => {
    switch (type) {
        case 'theory': return 'Теория';
        case 'practice': return 'Практика';
        case 'analysis': return 'Анализ';
        case 'puzzles': return 'Задачи';
        default: return 'Задача';
    }
};

const styles = StyleSheet.create({
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
        opacity: 0.6,
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
        color: colors.home.darkText,
        marginBottom: scale(4),
    },
    cardSubtitle: {
        fontFamily: fonts.body.regular,
        fontSize: scale(16),
        color: '#4E4E4E',
        lineHeight: scale(22),
    },
    iconContainer: {
        width: scale(50),
        height: scale(50),
        borderRadius: scale(14),
        justifyContent: 'center',
        alignItems: 'center',
    },
    addCard: {
        backgroundColor: '#E6EBF0', // Light gray as in screenshot
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
