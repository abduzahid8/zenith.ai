import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, ActivityIndicator, Alert, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTaskStore } from '../store/taskStore';
import { useAuthStore } from '../store/authStore';
import { taskEngine, TaskTemplate } from '../services/taskEngine';
import { TaskType } from '../services/supabase/types';
import { fonts } from '../theme';
import { scale } from '../constants';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../theme/useAppTheme';


export const CategoryTasksScreen = () => {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { id, categoryLabel, categoryBg } = params;
    const categoryType = id as TaskType;
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const { addTask, loading, dailyTasks } = useTaskStore();
    const { user } = useAuthStore();

    const templates = (taskEngine as any).getAvailableTaskTemplates(undefined, categoryType as TaskType);

    const handleSelectTask = async (template: TaskTemplate) => {
        if (!user?.id) return;
        try {
            await addTask(user.id, categoryType as TaskType, template);
            router.back();
            router.back();
        } catch (e: any) {
            Alert.alert('Ошибка', e.message || 'Не удалось добавить задачу');
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons
                        name="chevron-back"
                        size={scale(24)}
                        color={colors.text}
                    />
                    <Text style={styles.backText}>Назад</Text>
                </TouchableOpacity>
                <Text style={styles.title}>{categoryLabel}</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.subtitle}>
                    Выберите задачу, которую хотите добавить:
                </Text>

                <View style={styles.listContainer}>
                    {templates.map((template: TaskTemplate, index: number) => {
                        const isAdded = dailyTasks.some(t => t.title === template.title && t.type === categoryType);

                        return (
                            <TouchableOpacity
                                key={index}
                                style={[styles.taskCard, isAdded && styles.taskCardDisabled]}
                                onPress={() => handleSelectTask(template)}
                                disabled={isAdded || loading}
                            >
                                <View style={styles.textContainer}>
                                    <Text style={styles.taskTitle}>{template.title}</Text>
                                    <Text style={styles.taskDuration}>{template.duration} мин</Text>
                                </View>
                                {isAdded ? (
                                    <Image source={require('../../icons/checkbox-checked.png')} style={styles.checkIcon} />
                                ) : (
                                    <View style={[styles.plusButton, { backgroundColor: categoryBg as string }]}>
                                        <Image source={require('../../icons/plus.png')} style={styles.plusIcon} />
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </ScrollView>

            {loading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator color={colors.primary} size="large" />
                </View>
            )}
        </SafeAreaView>
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
    subtitle: {
        fontFamily: fonts.body.regular,
        fontSize: scale(16),
        color: colors.textSecondary,
        marginBottom: scale(24),
    },
    listContainer: {
        gap: scale(12),
    },
    taskCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.surfaceLight || '#FFFFFF',
        borderRadius: scale(16),
        padding: scale(16),
        borderWidth: 1,
        borderColor: colors.border || '#F0F0F0',
    },
    taskCardDisabled: {
        opacity: 0.5,
    },
    textContainer: {
        flex: 1,
        marginRight: scale(16),
    },
    taskTitle: {
        fontFamily: fonts.body.medium,
        fontSize: scale(16),
        color: colors.text,
        marginBottom: scale(4),
    },
    taskDuration: {
        fontFamily: fonts.body.regular,
        fontSize: scale(14),
        color: colors.textSecondary,
    },
    plusButton: {
        width: scale(32),
        height: scale(32),
        borderRadius: scale(16),
        justifyContent: 'center',
        alignItems: 'center',
    },
    plusIcon: {
        width: scale(16),
        height: scale(16),
        tintColor: '#1E1E2E',
    },
    checkIcon: {
        width: scale(24),
        height: scale(24),
        tintColor: colors.success,
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    }
});

export default CategoryTasksScreen;
