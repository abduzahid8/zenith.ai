/**
 * EncouragementBanner.tsx
 * Анимированный баннер подбадривания после каждого ответа на тест.
 * Появляется снизу с slide-up анимацией, автоскрывается через 1.5 сек.
 */

import React, { useEffect, useRef, useMemo } from 'react';
import {
    Animated,
    Text,
    StyleSheet,
    Easing,
    Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { scale } from '../../../constants';
import { fonts } from '../../../theme';
import { useAppTheme } from '../../../theme/useAppTheme';

// Позитивные сообщения
const CORRECT_MESSAGES = [
    '🎉 Отлично! Так держать!',
    '💪 Молодец! Ты справился!',
    '🔥 Превосходно! Горишь!',
    '⭐ Правильно! Ты крутой!',
    '🚀 Браво! Продолжай в том же духе!',
    '✨ Великолепно! Ты лучший!',
];

// Мотивационные сообщения при ошибке
const INCORRECT_MESSAGES = [
    '💪 Не сдавайся! Ошибки — часть пути!',
    '📚 Ошибки — это обучение! Вперёд!',
    '🤔 Почти! Попробуй в следующий раз!',
    '🌱 Каждая ошибка делает тебя сильнее!',
    '✊ Не останавливайся! Ты учишься!',
];

function getRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

interface EncouragementBannerProps {
    isCorrect: boolean;
    visible: boolean;
}

export const EncouragementBanner: React.FC<EncouragementBannerProps> = ({
    isCorrect,
    visible,
}) => {
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const slideAnim = useRef(new Animated.Value(100)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;
    const messageRef = useRef(
        isCorrect ? getRandom(CORRECT_MESSAGES) : getRandom(INCORRECT_MESSAGES)
    );

    useEffect(() => {
        if (visible) {
            // Обновляем сообщение при каждом показе
            messageRef.current = isCorrect
                ? getRandom(CORRECT_MESSAGES)
                : getRandom(INCORRECT_MESSAGES);

            // Haptic feedback
            if (Platform.OS !== 'web') {
                if (isCorrect) {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                } else {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                }
            }

            // Slide up + fade in
            slideAnim.setValue(80);
            opacityAnim.setValue(0);
            Animated.parallel([
                Animated.timing(slideAnim, {
                    toValue: 0,
                    duration: 300,
                    easing: Easing.out(Easing.back(1.5)),
                    useNativeDriver: true,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 1,
                    duration: 250,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            // Fade out
            Animated.timing(opacityAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }).start(() => {
                slideAnim.setValue(80);
            });
        }
    }, [visible, isCorrect]);

    if (!visible && (opacityAnim as any)._value === 0) return null;

    const bannerStyle = isCorrect
        ? styles.bannerCorrect
        : styles.bannerIncorrect;
    const textStyle = isCorrect
        ? styles.bannerTextCorrect
        : styles.bannerTextIncorrect;

    return (
        <Animated.View
            style={[
                styles.banner,
                bannerStyle,
                {
                    transform: [{ translateY: slideAnim }],
                    opacity: opacityAnim,
                },
            ]}
        >
            <Text style={[styles.bannerText, textStyle]}>
                {messageRef.current}
            </Text>
        </Animated.View>
    );
};

const createStyles = (colors: any) => StyleSheet.create({
    banner: {
        position: 'absolute',
        bottom: scale(100),
        left: scale(20),
        right: scale(20),
        borderRadius: scale(16),
        paddingVertical: scale(14),
        paddingHorizontal: scale(20),
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 8,
        zIndex: 999,
    },
    bannerCorrect: {
        backgroundColor: colors.gamification?.encourageCorrectBg || '#D1FAE5',
    },
    bannerIncorrect: {
        backgroundColor: colors.gamification?.encourageIncorrectBg || '#FFF3E0',
    },
    bannerText: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(16),
        lineHeight: scale(22),
        textAlign: 'center',
    },
    bannerTextCorrect: {
        color: colors.gamification?.encourageCorrectText || '#065F46',
    },
    bannerTextIncorrect: {
        color: colors.gamification?.encourageIncorrectText || '#92400E',
    },
});

export default EncouragementBanner;
