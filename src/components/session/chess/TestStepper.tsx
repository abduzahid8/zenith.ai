/**
 * TestStepper.tsx
 * Оркестратор для 5 тестов.
 * - Показывает прогресс-бар сверху (5 шариков)
 * - Отображает текущий тест в зависимости от типа
 * - Показывает EncouragementBanner после каждого ответа
 * - Автоматически переключает на следующий тест с задержкой
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
    View,
    StyleSheet,
    Animated,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from 'react-native';
import { scale, SCREEN_WIDTH } from '../../../constants';
import { useAppTheme } from '../../../theme/useAppTheme';
import { TaskStep } from '../../../data/lessonContent';

import MultipleChoiceTest from './MultipleChoiceTest';
import FillBlankTest from './FillBlankTest';
import FreeTextTest from './FreeTextTest';
import EncouragementBanner from './EncouragementBanner';

interface TestStepperProps {
    tests: TaskStep[];
    hobbyId: string;
    onAllTestsComplete: () => void;
}

export const TestStepper: React.FC<TestStepperProps> = ({
    tests,
    hobbyId,
    onAllTestsComplete,
}) => {
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const [currentIndex, setCurrentIndex] = useState(0);
    // Массив результатов: null (не пройден), true (верно), false (неверно)
    const [results, setResults] = useState<(boolean | null)[]>(Array(tests.length).fill(null));
    
    // Состояние для баннера подбадривания
    const [bannerVisible, setBannerVisible] = useState(false);
    const [lastAnswerCorrect, setLastAnswerCorrect] = useState(false);

    // Анимация перехода между экранами
    const slideAnim = React.useRef(new Animated.Value(0)).current;
    const fadeAnim = React.useRef(new Animated.Value(1)).current;

    const handleAnswer = (isCorrect: boolean, feedback?: string) => {
        // Записываем результат
        const newResults = [...results];
        newResults[currentIndex] = isCorrect;
        setResults(newResults);

        // Показываем баннер
        setLastAnswerCorrect(isCorrect);
        setBannerVisible(true);

        // Переходим к следующему шагу или завершаем
        setTimeout(() => {
            setBannerVisible(false); // Скрываем баннер
            
            if (currentIndex < tests.length - 1) {
                // Анимация ухода влево
                Animated.parallel([
                    Animated.timing(slideAnim, {
                        toValue: -SCREEN_WIDTH,
                        duration: 250,
                        useNativeDriver: true,
                    }),
                    Animated.timing(fadeAnim, {
                        toValue: 0,
                        duration: 200,
                        useNativeDriver: true,
                    })
                ]).start(() => {
                    setCurrentIndex(prev => prev + 1);
                    slideAnim.setValue(SCREEN_WIDTH);
                    
                    // Анимация появления справа
                    Animated.parallel([
                        Animated.timing(slideAnim, {
                            toValue: 0,
                            duration: 300,
                            useNativeDriver: true,
                        }),
                        Animated.timing(fadeAnim, {
                            toValue: 1,
                            duration: 250,
                            useNativeDriver: true,
                        })
                    ]).start();
                });
            } else {
                // Все тесты завершены -> идем к шахматной доске
                onAllTestsComplete();
            }
        }, 1500); // Баннер висит 1.5 секунды
    };

    const renderProgressDots = () => {
        return (
            <View style={styles.progressContainer}>
                {tests.map((_, idx) => {
                    let dotStyle = styles.progressDotInactive;
                    if (idx === currentIndex) {
                        dotStyle = styles.progressDotActive;
                    } else if (results[idx] === true) {
                        dotStyle = styles.progressDotDone;
                    } else if (results[idx] === false) {
                        dotStyle = styles.progressDotFailed;
                    }

                    return <View key={idx} style={[styles.progressDot, dotStyle]} />;
                })}
            </View>
        );
    };

    const renderCurrentTest = () => {
        const currentTest = tests[currentIndex];
        if (!currentTest) return null;

        switch (currentTest.type) {
            case 'multiple_choice':
                return (
                    <MultipleChoiceTest
                        question={currentTest.prompt}
                        options={currentTest.options || []}
                        correctIndex={currentTest.correctOptionIndex || 0}
                        onAnswer={handleAnswer}
                    />
                );
            case 'fill_blank':
                return (
                    <FillBlankTest
                        question={currentTest.prompt}
                        blanksText={currentTest.blanksText || ''}
                        wordPool={currentTest.wordPool || []}
                        correctOrder={currentTest.correctOrder || []}
                        onAnswer={handleAnswer}
                    />
                );
            case 'free_text':
                return (
                    <FreeTextTest
                        hobbyId={hobbyId}
                        question={currentTest.prompt}
                        correctAnswer={currentTest.correctAnswer}
                        onAnswer={handleAnswer}
                    />
                );
            default:
                // Fallback (если попался неправильный тип в массиве tests)
                return <View />;
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? scale(80) : 0}
        >
            {renderProgressDots()}

            <Animated.View style={[
                styles.testContainer,
                {
                    transform: [{ translateX: slideAnim }],
                    opacity: fadeAnim,
                }
            ]}>
                <ScrollView 
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {renderCurrentTest()}
                </ScrollView>
            </Animated.View>

            <EncouragementBanner
                visible={bannerVisible}
                isCorrect={lastAnswerCorrect}
            />
        </KeyboardAvoidingView>
    );
};

const createStyles = (colors: any) => {
    const g = colors.gamification || {};
    return StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: g.background || '#EAF0F8',
        },
        progressContainer: {
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            gap: scale(8),
            paddingTop: scale(24),
            paddingBottom: scale(16),
        },
        progressDot: {
            height: scale(6),
            borderRadius: scale(3),
        },
        progressDotInactive: {
            width: scale(8),
            backgroundColor: 'rgba(15, 33, 71, 0.1)',
        },
        progressDotActive: {
            width: scale(28),
            backgroundColor: '#37a0ef',
        },
        progressDotDone: {
            width: scale(8),
            backgroundColor: '#34C759',
        },
        progressDotFailed: {
            width: scale(8),
            backgroundColor: '#FF3B30',
        },
        testContainer: {
            flex: 1,
        },
        scrollContent: {
            flexGrow: 1,
            justifyContent: 'center',
            paddingHorizontal: scale(20),
            paddingBottom: scale(40),
            paddingTop: scale(20),
        },
    });
};

export default TestStepper;
