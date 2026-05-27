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
import * as Haptics from 'expo-haptics';
import { scale } from '../../../constants';
import { fonts } from '../../../theme';
import { useAppTheme } from '../../../theme/useAppTheme';

// Позитивные сообщения в стиле Duolingo (без эмодзи)
const CORRECT_MESSAGES = [
    'Отлично! Так держать!',
    'Правильный ответ!',
    'Потрясающе!',
    'Все верно!',
    'Великолепно!',
    'Идеально!',
];

// Мотивационные сообщения при ошибке (без эмодзи)
const INCORRECT_MESSAGES = [
    'Не переживай, ты справишься!',
    'Ошибки — это часть обучения.',
    'Почти получилось! Идем дальше.',
    'Главное — не сдаваться!',
    'В следующий раз обязательно получится!',
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
}

export const EncouragementBanner: React.FC<EncouragementBannerProps> = ({
    isCorrect,
    visible,
    onNext,
    hideButton = false,
    feedback,
    title,
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

    const bannerStyle = isCorrect
        ? styles.bannerCorrect
        : styles.bannerIncorrect;
        
    const textStyle = feedback 
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
                feedback ? { flexDirection: 'column', alignItems: 'stretch' } : null
            ]}
        >
            {feedback ? (
                // Вертикальная раскладка с отзывом от ИИ
                <View style={{ width: '100%' }}>
                    <Text style={[styles.bannerText, textStyle, { marginBottom: scale(8) }]}>
                        {message}
                    </Text>
                    <View style={{ maxHeight: scale(150), overflow: 'hidden' }}>
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
                                { width: '100%', marginTop: scale(16), height: scale(48), borderRadius: scale(24) }
                            ]}
                            onPress={onNext}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.nextButtonText}>Далее</Text>
                        </TouchableOpacity>
                    )}
                </View>
            ) : (
                // Стандартная горизонтальная раскладка
                <>
                    <Text style={[
                        styles.bannerText, 
                        textStyle,
                        hideButton && { textAlign: 'center', marginRight: 0 }
                    ]}>
                        {message}
                    </Text>
                    {!hideButton && (
                        <TouchableOpacity
                            style={[styles.nextButton, isCorrect ? styles.nextButtonCorrect : styles.nextButtonIncorrect]}
                            onPress={onNext}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.nextButtonText}>Далее</Text>
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
        bottom: 0,
        left: 0,
        right: 0,
        borderTopLeftRadius: scale(24),
        borderTopRightRadius: scale(24),
        paddingTop: scale(20),
        paddingBottom: scale(36), // Generous padding for iOS Safe Area
        paddingHorizontal: scale(24),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 999,
    },
    bannerCorrect: {
        backgroundColor: '#D1F5DB', // Matching correct pastel theme
    },
    bannerIncorrect: {
        backgroundColor: '#FDF2F2', // Matching incorrect pastel theme
    },
    bannerText: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(17),
        lineHeight: scale(22),
        color: '#08132A',
        flex: 1,
        marginRight: scale(16),
        textAlign: 'left',
    },
    bannerTextCorrect: {
        color: '#138D4F',
    },
    bannerTextIncorrect: {
        color: '#721C24',
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
