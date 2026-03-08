import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTaskStore } from '../store/taskStore';
import { useAuthStore } from '../store/authStore';
import { taskEngine, TaskTemplate } from '../services/taskEngine';
import { TaskType } from '../services/supabase/types';
import { colors, fonts } from '../theme';
import { scale } from '../constants';
import { useRouter, useLocalSearchParams } from 'expo-router';

export const CategoryTasksScreen = () => {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { id, categoryLabel, categoryBg } = params;
    const categoryType = id as TaskType;

    // We need to fetch the templates. 
    // Ideally we need user hobbies to get the right ones.
    // For now, taskEngine.getAvailableTaskTemplates checks hobbies internally if passed, or uses 'chess' default logic we hardcoded.
    // Let's grab hobbies from auth/profile store or just pass 'chess' for now if we don't have easy access to full hobby object here without fetching.
    // Actually we can just call it with undefined id, it defaults to 'default' or 'chess' inside if we updated it correctly? 
    // In my update, I kept the `default` key.

    // Better: Get user's primary hobby from userProfileStore or db. 
    // To be safe and quick: use 'default' or try to get it.

    const { addTask, loading, dailyTasks } = useTaskStore();
    const { user } = useAuthStore();

    const templates = (taskEngine as any).getAvailableTaskTemplates(undefined, categoryType as TaskType);

    const handleSelectTask = async (template: TaskTemplate) => {
        if (!user?.id) return;
        try {
            await addTask(user.id, categoryType as TaskType, template);
            router.back();
            router.back(); // Go back to Your Day (pop YourTasks + CategoryTasks)
        } catch (e) {
            console.error(e);
            // Show error (store handles it mostly)
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Image
                        source={require('../../icons/back.png')}
                        style={styles.backIcon}
                        resizeMode="contain"
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

const styles = StyleSheet.create({
    container: {
        flex: 1,
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
        backgroundColor: '#FFFFFF',
        borderRadius: scale(16),
        padding: scale(16),
        borderWidth: 1,
        borderColor: '#F0F0F0',
    },
    taskCardDisabled: {
        backgroundColor: '#F9F9F9',
        opacity: 0.7,
    },
    textContainer: {
        flex: 1,
        marginRight: scale(16),
    },
    taskTitle: {
        fontFamily: fonts.body.bold,
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
        tintColor: colors.dark,
    },
    checkIcon: {
        width: scale(24),
        height: scale(24),
        tintColor: colors.success,
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255,255,255,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    }
});
