import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Image, ImageSourcePropType } from 'react-native';
import { useTaskStore } from '../store/taskStore';
import { useAuthStore } from '../store/authStore';
import { Task, TaskType } from '../services/supabase/types';
import { colors, fonts } from '../theme';
import { scale } from '../constants';
import { TaskFeedbackModal } from './TaskFeedbackModal';

const getTaskColors = (type: TaskType) => {
    switch (type) {
        case 'learning':
            return { bg: '#9CE4FD', iconBg: colors.dark }; // Light Cyan
        case 'practice':
            return { bg: '#7CB9FF', iconBg: colors.dark }; // Blue
        case 'action':
            return { bg: '#F4C0FD', iconBg: colors.dark }; // Pink
        case 'wellbeing':
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
        case 'learning':
            iconSource = require('../../icons/book.png');
            break;
        case 'practice':
            iconSource = require('../../icons/dumbbell.png');
            break;
        case 'action':
            iconSource = require('../../icons/magnifier.png');
            iconStyle = { marginRight: scale(4) }; // Move a little to the left
            break;
        case 'wellbeing':
            iconSource = require('../../icons/puzzle.png');
            iconStyle = { marginRight: scale(4) }; // Move a little to the left
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

export const DailyTasksList = () => {
    const { dailyTasks, loading, fetchDailyPlan, completeTask } = useTaskStore();
    const { user } = useAuthStore();
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

    const handleFeedbackSubmit = async (feedback: { difficulty_rating: number; engagement_rating: number; user_notes: string }) => {
        if (userId && selectedTask && selectedTask.id) {
            await completeTask(userId, selectedTask.id, feedback);
            setModalVisible(false);
            setSelectedTask(null);
        }
    };

    const handleModalClose = () => {
        setModalVisible(false);
        // If they close without submitting, we can either not complete, or complete without feedback.
        // For now, let's assume close = cancel action (do nothing)
        // Or if you want "Skip feedback but complete":
        // if (userId && selectedTask && selectedTask.id) completeTask(userId, selectedTask.id);
        setSelectedTask(null);
    };

    if (loading && dailyTasks.length === 0) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={colors.text} />
            </View>
        );
    }

    if (dailyTasks.length === 0) {
        return null;
    }

    return (
        <View style={styles.container}>
            <Text style={styles.headerTitle}>Твой день</Text>
            <View style={styles.listContainer}>
                {dailyTasks.map((task, index) => (
                    <TaskCard
                        key={task.id || index}
                        task={task}
                        onPress={handleTaskPress}
                    />
                ))}
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
        case 'learning': return 'Теория';
        case 'practice': return 'Практика';
        case 'action': return 'Анализ'; // Changed to match screenshot "Analysis"
        case 'wellbeing': return 'Задачи'; // Changed to match screenshot "Tasks/Puzzle"
        default: return 'Задача';
    }
};

const styles = StyleSheet.create({
    container: {
        marginBottom: scale(24),
    },
    headerTitle: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(32), // Match "Твой день" size
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
        paddingHorizontal: scale(24),
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
        fontFamily: fonts.body.regular, // Gramatika-Light/Regular
        fontSize: scale(16),
        color: '#4E4E4E', // Slightly lighter than title
        lineHeight: scale(22),
    },
    iconContainer: {
        width: scale(50),
        height: scale(50),
        borderRadius: scale(14),
        justifyContent: 'center',
        alignItems: 'center',
    },
});
