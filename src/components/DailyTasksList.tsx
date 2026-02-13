import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTaskStore } from '../store/taskStore';
import { useAuthStore } from '../store/authStore';
import { Task, TaskType } from '../services/supabase/types';
import { colors, fonts } from '../theme';
import { scale } from '../constants';

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

    // Map icon name
    let iconName: keyof typeof Ionicons.glyphMap = 'book-outline';
    // Icon style adjustments
    let iconStyle = {};

    switch (task.type) {
        case 'learning':
            iconName = 'book-outline';
            break;
        case 'practice':
            iconName = 'locate-outline'; // Changed to locate-outline (visually similar to target)
            break;
        case 'action':
            iconName = 'bulb-outline'; // Changed from search-outline
            iconStyle = { marginRight: scale(4) }; // Move a little to the left
            break;
        case 'wellbeing':
            iconName = 'stats-chart-outline'; // Changed from extension-puzzle-outline
            iconStyle = { marginRight: scale(4) }; // Move a little to the left
            break;
    }
    if (isCompleted) iconName = 'checkmark-circle';

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
                <View style={[styles.iconContainer, { backgroundColor: theme.iconBg }]}>
                    <Ionicons name={iconName} size={scale(24)} color="#FFF" style={iconStyle} />
                </View>
            </View>
        </TouchableOpacity>
    );
};

export const DailyTasksList = () => {
    const { dailyTasks, loading, fetchDailyPlan, completeTask } = useTaskStore();
    const { user } = useAuthStore();
    const userId = user?.id;

    useEffect(() => {
        if (userId) {
            fetchDailyPlan(userId);
        }
    }, [userId]);

    const handleTaskPress = async (task: Task) => {
        if (task.status === 'completed') return;
        if (userId && task.id) {
            await completeTask(userId, task.id);
        }
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
