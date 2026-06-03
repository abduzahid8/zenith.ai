/**
 * EncouragementBanner.tsx
 * Анимированный баннер подбадривания после каждого ответа на тест.
 * Появляется снизу с slide-up анимацией, автоскрывается через 1.5 сек.
 */

import React, { useEffect, useRef, useMemo, useState } from 'react';
import {
    Animated,
    Text,
    View,
    StyleSheet,
    Easing,
    Platform,
    TouchableOpacity,
    ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { scale } from '../../../constants';
import { fonts } from '../../../theme';
import { useAppTheme } from '../../../theme/useAppTheme';

// Позитивные сообщения в стиле Duolingo (без эмодзи)
const CORRECT_MESSAGES = [
    'Отлично!',
    'Правильно!',
    'Потрясающе!',
    'Верно!',
    'Великолепно!',
    'Идеально!',
    'Супер!',
];

// Мотивационные сообщения при ошибке (без эмодзи)
const INCORRECT_MESSAGES = [
    'Не сдавайся!',
    'Попробуй ещё!',
    'Почти получилось!',
    'Не переживай!',
    'Ещё попытку!',
];

function getRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

interface EncouragementBannerProps {
    isCorrect: boolean;
    visible: boolean;
    onNext: () => void;
    hideButton?: boolean;
    feedback?: string;
    title?: string;
    buttonText?: string;
}

export const EncouragementBanner: React.FC<EncouragementBannerProps> = ({
    isCorrect,
    visible,
    onNext,
    hideButton = false,
    feedback,
    title,
    buttonText,
}) => {
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const slideAnim = useRef(new Animated.Value(100)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;
    
    const [prevVisible, setPrevVisible] = useState(false);
    const [message, setMessage] = useState('');

    // Смена видимости обрабатывается по официальному паттерну React (deriving state from props during render).
    // Это гарантирует смену сообщения ДО paint и сохраняет его стабильным во время закрытия баннера.
    if (visible !== prevVisible) {
        setPrevVisible(visible);
        if (visible) {
            setMessage(
                title ? title : (isCorrect
                    ? getRandom(CORRECT_MESSAGES)
                    : getRandom(INCORRECT_MESSAGES))
            );
        }
    }

    useEffect(() => {
        if (visible) {
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

    const showFeedback = !!(feedback && isCorrect);

    const bannerStyle = isCorrect
        ? styles.bannerCorrect
        : styles.bannerIncorrect;
        
    const textStyle = showFeedback 
        ? null // Темный текст для заголовка при наличии развернутого фидбека
        : isCorrect
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
                showFeedback ? { flexDirection: 'column', alignItems: 'stretch' } : null
            ]}
        >
            {showFeedback ? (
                // Вертикальная раскладка с отзывом от ИИ
                <View style={{ width: '100%' }}>
                    <View style={[styles.bannerHeader, { marginBottom: scale(6) }]}>
                        <Text style={[styles.bannerText, textStyle]}>
                            {message}
                        </Text>
                    </View>
                    <View style={{ maxHeight: scale(80), overflow: 'hidden' }}>
                        <ScrollView showsVerticalScrollIndicator={true} bounces={false}>
                            <Text style={styles.feedbackText}>
                                {feedback}
                            </Text>
                        </ScrollView>
                    </View>
                    {!hideButton && (
                        <TouchableOpacity
                            style={[
                                styles.nextButton,
                                isCorrect ? styles.nextButtonCorrect : styles.nextButtonIncorrect,
                                { width: '100%', marginTop: scale(12), height: scale(44), borderRadius: scale(22) }
                            ]}
                            onPress={onNext}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.nextButtonText}>{buttonText || 'Далее'}</Text>
                        </TouchableOpacity>
                    )}
                </View>
            ) : (
                // Стандартная горизонтальная раскладка
                <>
                    <View style={styles.bannerHeader}>
                        <Text style={[
                            styles.bannerText, 
                            textStyle,
                            hideButton && { textAlign: 'center', marginRight: 0 }
                        ]}>
                            {message}
                        </Text>
                    </View>
                    {!hideButton && (
                        <TouchableOpacity
                            style={[styles.nextButton, isCorrect ? styles.nextButtonCorrect : styles.nextButtonIncorrect]}
                            onPress={onNext}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.nextButtonText}>{buttonText || 'Далее'}</Text>
                        </TouchableOpacity>
                    )}
                </>
            )}
        </Animated.View>
    );
};

const createStyles = (colors: any) => StyleSheet.create({
    banner: {
        position: 'absolute',
        bottom: Platform.OS === 'ios' ? scale(36) : scale(26),
        left: scale(16),
        right: scale(16),
        borderRadius: scale(9999),
        paddingVertical: scale(16),
        paddingHorizontal: scale(20),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 999,
        shadowColor: '#0F2147',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.03,
        shadowRadius: 8,
        elevation: 2,
    },
    bannerCorrect: {
        backgroundColor: '#E8FDF0',
        borderWidth: 1.5,
        borderColor: '#A2E0B5',
    },
    bannerIncorrect: {
        backgroundColor: '#FFF5F5',
        borderWidth: 1.5,
        borderColor: '#FFC4C2',
    },
    bannerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: scale(8),
        marginRight: scale(12),
        marginLeft: scale(10),
    },
    bannerText: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(19),
        lineHeight: scale(24),
        color: '#1A253C',
        flex: 1,
        textAlign: 'left',
    },
    bannerTextCorrect: {
        color: '#0A0F1D',
    },
    bannerTextIncorrect: {
        color: '#2A080C',
    },
    feedbackText: {
        fontFamily: fonts.body.regular,
        fontSize: scale(14),
        lineHeight: scale(20),
        color: 'rgba(26, 37, 60, 0.8)',
        marginTop: scale(4),
        textAlign: 'left',
    },
    nextButton: {
        paddingVertical: scale(12),
        paddingHorizontal: scale(28),
        borderRadius: scale(100),
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: scale(100),
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
    },
    nextButtonCorrect: {
        backgroundColor: '#34C759', // Green CTA button
    },
    nextButtonIncorrect: {
        backgroundColor: '#FF3B30', // Red CTA button
    },
    nextButtonText: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(15),
        color: '#FFFFFF',
    },
});

export default EncouragementBanner;
