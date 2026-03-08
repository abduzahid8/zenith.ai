import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTaskStore } from '../store/taskStore';
import { useAuthStore } from '../store/authStore';
import { useUserProfileStore } from '../store/userProfileStore';
import { TaskType } from '../services/supabase/types';
import { colors, fonts } from '../theme';
import { scale } from '../constants';

const categories: { type: TaskType; label: string; icon: any; bg: string; subtitle: string }[] = [
    {
        type: 'theory',
        label: 'Теория',
        subtitle: 'Изучить что-то новое',
        icon: require('../../icons/book.png'),
        bg: '#9CE4FD'
    },
    {
        type: 'practice',
        label: 'Практика',
        subtitle: 'Отработать навыки',
        icon: require('../../icons/dumbbell.png'),
        bg: '#7CB9FF'
    },
    {
        type: 'analysis',
        label: 'Анализ',
        subtitle: 'Работать над ошибками',
        icon: require('../../icons/magnifier.png'),
        bg: '#F4C0FD'
    },
    {
        type: 'puzzles',
        label: 'Задачи',
        subtitle: 'Решать головоломки',
        icon: require('../../icons/puzzle.png'),
        bg: '#FCB5FD'
    },
];

export const YourTasksScreen = () => {
    const router = useRouter();
    const { dailyTasks, loading, error } = useTaskStore();
    const { isPremium } = useUserProfileStore();

    useEffect(() => {
        if (error) {
            Alert.alert('Error', error);
        }
    }, [error]);

    const handleAdd = (type: TaskType, label: string, bg: string) => {
        router.push({
            pathname: `/category/${type}` as any,
            params: { categoryLabel: label, categoryBg: bg }
        });
    };

    const maxTasks = isPremium ? 4 : 3;
    const canAddMore = dailyTasks.length < maxTasks;

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Image
                        source={require('../../icons/back.png')}
                        style={styles.backIcon}
                        resizeMode="contain"
                    />
                    <Text style={styles.backText}>Назад</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Твои задачи</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.subtitle}>
                    Выберите категорию задачи, которую хотите добавить в свой план на сегодня.
                </Text>

                <View style={styles.cardsContainer}>
                    {categories.map((cat, index) => {
                        const isAdded = false; // We don't disable categories anymore, we just let them enter to browse. Or we can check if they have active tasks?
                        // Actually if they have 4 tasks, they can't add more. 
                        // But maybe they want to check what tasks exist? 
                        // Let's allow entry but disable ADDING inside the next screen (which I implemented).
                        const isDisabled = false;

                        return (
                            <View key={cat.type} style={{ marginBottom: scale(16) }}>
                                <CategoryCard
                                    category={cat}
                                    isAdded={isAdded}
                                    isLoading={false}
                                    isDisabled={isDisabled}
                                    onAdd={() => handleAdd(cat.type, cat.label, cat.bg)}
                                />
                            </View>
                        );
                    })}
                </View>

                {!isPremium && dailyTasks.length >= 3 && (
                    <TouchableOpacity
                        style={styles.upgradeCard}
                        onPress={() => router.push('/Paywall' as any)}
                    >
                        <Text style={styles.upgradeText}>
                            Достигнут лимит задач. Перейдите на Premium, чтобы добавить больше.
                        </Text>
                    </TouchableOpacity>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

const CategoryCard = ({ category, isAdded, isLoading, isDisabled, onAdd }: any) => {
    return (
        <View style={[styles.card, { backgroundColor: category.bg }]}>
            <View style={styles.cardInfo}>
                <View style={styles.iconContainer}>
                    <Image source={category.icon} style={styles.cardIcon} resizeMode="contain" />
                </View>
                <View style={styles.textContainer}>
                    <Text style={styles.cardTitle}>{category.label}</Text>
                    <Text style={styles.cardSubtitle}>{category.subtitle}</Text>
                </View>
            </View>

            <TouchableOpacity
                style={[
                    styles.addButton,
                    styles.addedButton // Always light bg
                ]}
                onPress={onAdd}
                disabled={isDisabled}
            >
                <Image source={require('../../icons/back.png')} style={[styles.plusIcon, { transform: [{ rotate: '180deg' }] }]} />
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background, // Match app background
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
        // gap: scale(16), // Using explicit marginBottom wrapper instead
        paddingBottom: scale(20)
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: scale(24),
        padding: scale(16),
        height: scale(88), // Consistent height
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
        tintColor: colors.dark,
    },
    textContainer: {
        flex: 1,
    },
    cardTitle: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(18),
        color: colors.dark,
        marginBottom: scale(2),
    },
    cardSubtitle: {
        fontFamily: fonts.body.regular,
        fontSize: scale(14),
        color: colors.dark,
        opacity: 0.7,
    },
    addButton: {
        width: scale(48),
        height: scale(48),
        borderRadius: scale(24), // Circular
        backgroundColor: 'rgba(255,255,255,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    disabledButton: {
        opacity: 0.5,
    },
    addedButton: {
        backgroundColor: 'rgba(255,255,255,0.6)',
    },
    plusIcon: {
        width: scale(20),
        height: scale(20),
        tintColor: colors.dark,
    },
    checkIcon: {
        width: scale(24),
        height: scale(24),
        tintColor: colors.dark,
    },
    upgradeCard: {
        marginTop: scale(24),
        padding: scale(16),
        backgroundColor: '#F0F0F0',
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
