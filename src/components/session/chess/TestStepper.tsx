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
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
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
    // Количество попыток для каждого шага теста (используется как часть key для сброса стейта проваленных тестов)
    const [attempts, setAttempts] = useState<number[]>(Array(tests.length).fill(0));
    
    // Баннер — храним видимость, результат, отзыв и заголовок в одном state,
    // чтобы они всегда обновлялись атомарно (без мигания)
    const [banner, setBanner] = useState<{ visible: boolean; isCorrect: boolean; feedback?: string; title?: string }>(
        { visible: false, isCorrect: false }
    );

    // Состояние для временного отключения скролла во время перетаскивания (drag-and-drop)
    const [scrollEnabled, setScrollEnabled] = useState(true);

    // Анимация перехода между экранами
    const slideAnim = React.useRef(new Animated.Value(0)).current;
    const fadeAnim = React.useRef(new Animated.Value(1)).current;

    const handleAnswer = (isCorrect: boolean, feedback?: string, title?: string) => {
        // Записываем результат
        const newResults = [...results];
        newResults[currentIndex] = isCorrect;
        setResults(newResults);

        // Обновляем visible, isCorrect, feedback и title атомарно — одним вызовом
        setBanner({ visible: true, isCorrect, feedback, title });
    };

    const handleNext = () => {
        setBanner({ visible: false, isCorrect: banner.isCorrect }); // Скрываем баннер
        
        // Находим следующий не пройденный успешно тест (результат которого не равен true)
        let nextIndex = currentIndex + 1;
        while (nextIndex < tests.length && results[nextIndex] === true) {
            nextIndex++;
        }

        if (nextIndex < tests.length) {
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
                setCurrentIndex(nextIndex);
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
            // Мы дошли до конца. Проверяем, есть ли проваленные тесты
            const hasFailed = results.includes(false);
            if (hasFailed) {
                // Находим первый проваленный тест
                const firstFailedIndex = results.indexOf(false);
                
                // Сбрасываем только проваленные тесты в null, чтобы их можно было пройти заново
                const newResults = results.map(r => r === false ? null : r);
                setResults(newResults);

                // Увеличиваем счетчик попыток для проваленных тестов, чтобы сбросить их внутренний стейт при повторном рендере
                const newAttempts = [...attempts];
                results.forEach((r, idx) => {
                    if (r === false) {
                        newAttempts[idx] = newAttempts[idx] + 1;
                    }
                });
                setAttempts(newAttempts);

                // Анимируем переход назад к первому проваленному тесту (уезжаем вправо)
                Animated.parallel([
                    Animated.timing(slideAnim, {
                        toValue: SCREEN_WIDTH,
                        duration: 250,
                        useNativeDriver: true,
                    }),
                    Animated.timing(fadeAnim, {
                        toValue: 0,
                        duration: 200,
                        useNativeDriver: true,
                    })
                ]).start(() => {
                    setCurrentIndex(firstFailedIndex);
                    slideAnim.setValue(-SCREEN_WIDTH);
                    
                    // Анимация появления слева
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
                // Все тесты успешно пройдены -> идем к шахматной доске
                onAllTestsComplete();
            }
        }
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
                        key={`${currentIndex}_${attempts[currentIndex]}`}
                        question={currentTest.prompt}
                        options={currentTest.options || []}
                        correctIndex={currentTest.correctOptionIndex || 0}
                        onAnswer={handleAnswer}
                    />
                );
            case 'fill_blank':
                return (
                    <FillBlankTest
                        key={`${currentIndex}_${attempts[currentIndex]}`}
                        question={currentTest.prompt}
                        blanksText={currentTest.blanksText || ''}
                        wordPool={currentTest.wordPool || []}
                        correctOrder={currentTest.correctOrder || []}
                        onAnswer={handleAnswer}
                        onNext={handleNext}
                        onDragStateChange={(isDragging) => setScrollEnabled(!isDragging)}
                    />
                );
            case 'free_text':
                return (
                    <FreeTextTest
                        key={`${currentIndex}_${attempts[currentIndex]}`}
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
                    scrollEnabled={scrollEnabled}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {renderCurrentTest()}
                </ScrollView>
            </Animated.View>

            <EncouragementBanner
                visible={banner.visible}
                isCorrect={banner.isCorrect}
                onNext={handleNext}
                hideButton={tests[currentIndex]?.type === 'fill_blank'}
                feedback={banner.feedback}
                title={banner.title}
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
            paddingBottom: scale(12),
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
            paddingHorizontal: scale(20),
            paddingBottom: scale(40),
            paddingTop: scale(36),
        },
    });
};

export default TestStepper;
