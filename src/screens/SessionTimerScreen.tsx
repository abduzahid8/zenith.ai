import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    StatusBar,
    TouchableOpacity,
    Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    Easing,
} from 'react-native-reanimated';
import { HOBBIES } from '../components/HobbyCard';
import { colors, typography, spacing, borderRadius } from '../theme';
import { scaleWidth, scaleHeight, scaleFont } from '../theme/responsive';
import { useAuthStore } from '../store/authStore';
import { dbService } from '../services/supabase';

const SESSION_DURATION = 30 * 60; // 30 minutes in seconds

export const SessionTimerScreen: React.FC = () => {
    const router = useRouter();
    const { selectedHobby, user } = useAuthStore();
    const [timeRemaining, setTimeRemaining] = useState(SESSION_DURATION);
    const [isRunning, setIsRunning] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    const progress = useSharedValue(0);

    const hobby = selectedHobby ? HOBBIES[selectedHobby as keyof typeof HOBBIES] : null;

    // Tasks for the session
    const tasks = [
        'Изучить 1 базовый дебют',
        'Сыграть 2 партии без отвлечений',
    ];

    useEffect(() => {
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, []);

    useEffect(() => {
        const elapsed = SESSION_DURATION - timeRemaining;
        progress.value = withTiming(elapsed / SESSION_DURATION, {
            duration: 1000,
            easing: Easing.linear,
        });
    }, [timeRemaining]);

    const animatedProgressStyle = useAnimatedStyle(() => ({
        width: `${progress.value * 100}%`,
    }));

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const startTimer = () => {
        setIsRunning(true);
        setIsPaused(false);
        intervalRef.current = setInterval(() => {
            setTimeRemaining((prev) => {
                if (prev <= 1) {
                    if (intervalRef.current) {
                        clearInterval(intervalRef.current);
                    }
                    handleSessionComplete();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const pauseTimer = () => {
        setIsPaused(true);
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }
    };

    const resumeTimer = () => {
        startTimer();
    };

    const handleSessionComplete = async () => {
        setIsRunning(false);

        // Save session to database
        if (user && selectedHobby) {
            try {
                await dbService.saveSession(user.id, selectedHobby, SESSION_DURATION);
            } catch (error) {
                console.error('Failed to save session:', error);
            }
        }

        Alert.alert(
            'Отлично! 🎉',
            'Ты завершил сессию. Продолжай в том же духе!',
            [
                {
                    text: 'Вернуться',
                    onPress: () => router.back(),
                },
            ]
        );
    };

    const handleClose = () => {
        if (isRunning) {
            Alert.alert(
                'Завершить занятие?',
                'Прогресс будет потерян',
                [
                    { text: 'Отмена', style: 'cancel' },
                    {
                        text: 'Завершить',
                        style: 'destructive',
                        onPress: () => router.back(),
                    },
                ]
            );
        } else {
            router.back();
        }
    };

    const handleAICoach = () => {
        router.push('/ai-coach');
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                    <Ionicons name="close" size={28} color={colors.text} />
                </TouchableOpacity>

                <View style={styles.dayBadge}>
                    <Text style={styles.dayText}>Понедельник</Text>
                </View>

                <TouchableOpacity onPress={handleAICoach} style={styles.coachButton}>
                    <Ionicons name="chatbubble-ellipses" size={24} color={colors.text} />
                </TouchableOpacity>
            </View>

            {/* Timer Display */}
            <View style={styles.timerContainer}>
                <Text style={styles.timerText}>{formatTime(timeRemaining)}</Text>

                {/* Progress bar */}
                <View style={styles.progressBarContainer}>
                    <Animated.View style={[styles.progressBar, animatedProgressStyle]} />
                </View>
            </View>

            {/* Tasks */}
            <View style={styles.tasksContainer}>
                {tasks.map((task, index) => (
                    <View key={index} style={styles.taskRow}>
                        <View style={styles.taskCheckbox}>
                            <Ionicons name="checkmark" size={16} color={colors.textLight} />
                        </View>
                        <Text style={styles.taskText}>{task}</Text>
                    </View>
                ))}
            </View>

            {/* Controls */}
            <View style={styles.controlsContainer}>
                {!isRunning ? (
                    <TouchableOpacity
                        style={styles.playButton}
                        onPress={startTimer}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="play" size={48} color={colors.background} />
                    </TouchableOpacity>
                ) : isPaused ? (
                    <TouchableOpacity
                        style={styles.playButton}
                        onPress={resumeTimer}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="play" size={48} color={colors.background} />
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        style={styles.pauseButton}
                        onPress={pauseTimer}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="pause" size={48} color={colors.text} />
                    </TouchableOpacity>
                )}
            </View>

            {/* AI Coach hint */}
            <View style={styles.aiHintContainer}>
                <TouchableOpacity style={styles.aiHint} onPress={handleAICoach}>
                    <Text style={styles.aiHintText}>
                        Нужна помощь? Спроси ИИ-тренера
                    </Text>
                    <Ionicons name="arrow-forward" size={16} color={colors.primary} />
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: scaleWidth(spacing.lg),
        paddingVertical: scaleHeight(spacing.md),
    },
    closeButton: {
        padding: scaleWidth(8),
    },
    dayBadge: {
        backgroundColor: colors.surfaceLight,
        paddingHorizontal: scaleWidth(16),
        paddingVertical: scaleHeight(6),
        borderRadius: borderRadius.lg,
    },
    dayText: {
        fontFamily: typography.label.fontFamily,
        fontSize: scaleFont(14),
        color: colors.text,
    },
    coachButton: {
        padding: scaleWidth(8),
        backgroundColor: colors.primary,
        borderRadius: scaleWidth(20),
    },
    timerContainer: {
        alignItems: 'center',
        paddingVertical: scaleHeight(spacing.xxl),
    },
    timerText: {
        fontFamily: typography.h1.fontFamily,
        fontSize: scaleFont(72),
        color: colors.text,
        letterSpacing: 4,
    },
    progressBarContainer: {
        width: '80%',
        height: scaleHeight(6),
        backgroundColor: colors.surfaceLight,
        borderRadius: borderRadius.full,
        marginTop: scaleHeight(spacing.lg),
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        backgroundColor: colors.primary,
        borderRadius: borderRadius.full,
    },
    tasksContainer: {
        paddingHorizontal: scaleWidth(spacing.xl),
        marginBottom: scaleHeight(spacing.xl),
    },
    taskRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: scaleHeight(spacing.md),
    },
    taskCheckbox: {
        width: scaleWidth(24),
        height: scaleWidth(24),
        borderRadius: scaleWidth(12),
        borderWidth: 1,
        borderColor: colors.textLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: scaleWidth(spacing.md),
    },
    taskText: {
        flex: 1,
        fontFamily: typography.body.fontFamily,
        fontSize: scaleFont(16),
        color: colors.text,
    },
    controlsContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    playButton: {
        width: scaleWidth(100),
        height: scaleWidth(100),
        borderRadius: scaleWidth(50),
        backgroundColor: colors.text,
        justifyContent: 'center',
        alignItems: 'center',
    },
    pauseButton: {
        width: scaleWidth(100),
        height: scaleWidth(100),
        borderRadius: scaleWidth(50),
        backgroundColor: colors.surfaceLight,
        justifyContent: 'center',
        alignItems: 'center',
    },
    aiHintContainer: {
        paddingHorizontal: scaleWidth(spacing.lg),
        paddingBottom: scaleHeight(spacing.xxl),
        alignItems: 'center',
    },
    aiHint: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scaleWidth(8),
    },
    aiHintText: {
        fontFamily: typography.body.fontFamily,
        fontSize: scaleFont(14),
        color: colors.primary,
    },
});

export default SessionTimerScreen;
