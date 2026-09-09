import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, StatusBar, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { SafeAreaView } from 'react-native-safe-area-context';
import { useTaskStore } from '../store/taskStore';
import { useUserProfileStore } from '../store/userProfileStore';
import { useAuthStore } from '../store/authStore';
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

    const ENGINE_TYPES: TaskType[] = ['theory', 'practice', 'analysis', 'puzzles'];
    const engineTasksCount = dailyTasks.filter(t => ENGINE_TYPES.includes(t.type as TaskType)).length;
    const maxTasks = getMaxTasksPerDay(isPremium);
    // Only upsell Premium when it actually unlocks more tasks than the free plan
    const premiumAllowsMore = maxTasks < getMaxTasksPerDay(true);

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
                <Text style={styles.subtitle}>
                    {t('Выберите категорию задач, чтобы добавить её в план на сегодня.')}
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
                    
                    {/* Show locked card in the last position if the limit is reached and Premium unlocks more */}
                    {!isPremium && premiumAllowsMore && engineTasksCount >= maxTasks && (
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

                {!isPremium && premiumAllowsMore && engineTasksCount >= getMaxTasksPerDay(false) && (
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
});

export default YourTasksScreen;
