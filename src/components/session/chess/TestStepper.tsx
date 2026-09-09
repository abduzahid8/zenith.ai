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
    TouchableOpacity,
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
    skipTrigger?: number;
    /** Optional results report (passed, total, skipped) — swipe session aggregation. */
    onResult?: (passed: number, total: number, skipped: number) => void;
}

export const TestStepper: React.FC<TestStepperProps> = ({
    tests,
    hobbyId,
    onAllTestsComplete,
    skipTrigger = 0,
    onResult,
}) => {
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const [currentIndex, setCurrentIndex] = useState(0);
    // Массив результатов: null (не пройден), true (верно), false (неверно), 'skipped' (пропущен после 2 попыток)
    const [results, setResults] = useState<(boolean | 'skipped' | null)[]>(Array(tests.length).fill(null));
    // Количество попыток для каждого шага теста (используется как часть key для сброса стейта проваленных тестов)
    const [attempts, setAttempts] = useState<number[]>(Array(tests.length).fill(0));
    const [skipCounts, setSkipCounts] = useState<Record<number, number>>({});

    useEffect(() => {
        if (skipTrigger > 0) {
            handleSkip();
        }
    }, [skipTrigger]);
    
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

    // Aggregate tally for embedders (swipe session) — additive, no behavior change.
    const reportResults = (arr: (boolean | 'skipped' | null)[]) => {
        if (!onResult) return;
        const total = arr.length;
        const passed = arr.filter(r => r === true).length;
        const skipped = arr.filter(r => r === 'skipped').length;
        onResult(passed, total, skipped);
    };

    const handleAnswer = (isCorrect: boolean, feedback?: string, title?: string) => {
        // Записываем результат
        const newResults = [...results];
        
        let finalIsCorrect = isCorrect;
        let finalFeedback = feedback;
        let finalTitle = title;
        
        if (!isCorrect && attempts[currentIndex] >= 1) {
            // Это вторая попытка и ответ неверный -> пропускаем задание
            newResults[currentIndex] = 'skipped';
            finalTitle = 'Задание пропущено';
            const skipNote = 'Вы исчерпали 2 попытки. Задание пропущено, давай двигаться дальше!';
            finalFeedback = feedback ? `${feedback}\n\n${skipNote}` : skipNote;
        } else {
            newResults[currentIndex] = isCorrect;
        }
        
        setResults(newResults);

        // Обновляем visible, isCorrect, feedback и title атомарно — одним вызовом
        setBanner({ 
            visible: true, 
            isCorrect: finalIsCorrect, 
            feedback: finalFeedback, 
            title: finalTitle 
        });
    };

    const handleNext = () => {
        setBanner({ visible: false, isCorrect: banner.isCorrect }); // Скрываем баннер
        
        // Находим следующий не пройденный успешно или пропущенный тест (результат которого не равен true и не 'skipped')
        let nextIndex = currentIndex + 1;
        while (nextIndex < tests.length && (results[nextIndex] === true || results[nextIndex] === 'skipped')) {
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
                const firstSkippedIndex = results.findIndex((r, idx) => r === 'skipped' && (skipCounts[idx] || 0) < 2);
                if (firstSkippedIndex !== -1) {
                    // Анимируем переход назад к первому пропущенному тесту (уезжаем вправо)
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
                        setCurrentIndex(firstSkippedIndex);
                        slideAnim.setValue(-SCREEN_WIDTH);
                        
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
                    // Все тесты успешно пройдены или окончательно пропущены -> идем к шахматной доске
                    reportResults(results);
                    onAllTestsComplete();
                }
            }
        }
    };

    const handleSkip = () => {
        setBanner({ visible: false, isCorrect: banner.isCorrect });
        const newResults = [...results];
        newResults[currentIndex] = 'skipped';
        setResults(newResults);

        const newSkipCounts = {
            ...skipCounts,
            [currentIndex]: (skipCounts[currentIndex] || 0) + 1
        };
        setSkipCounts(newSkipCounts);
        
        let nextIndex = currentIndex + 1;
        while (nextIndex < tests.length && (results[nextIndex] === true || results[nextIndex] === 'skipped')) {
            nextIndex++;
        }

        if (nextIndex < tests.length) {
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
            const hasFailed = results.includes(false);
            if (hasFailed) {
                const firstFailedIndex = results.indexOf(false);
                const newResults2 = results.map(r => r === false ? null : r);
                setResults(newResults2);

                const newAttempts = [...attempts];
                results.forEach((r, idx) => {
                    if (r === false) {
                        newAttempts[idx] = newAttempts[idx] + 1;
                    }
                });
                setAttempts(newAttempts);

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
                const firstSkippedIndex = newResults.findIndex((r, idx) => r === 'skipped' && (newSkipCounts[idx] || 0) < 2);
                if (firstSkippedIndex !== -1) {
                    // Анимируем переход назад к первому пропущенному тесту (уезжаем вправо)
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
                        setCurrentIndex(firstSkippedIndex);
                        slideAnim.setValue(-SCREEN_WIDTH);
                        
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
                    reportResults(newResults);
                    onAllTestsComplete();
                }
            }
        }
    };

    const renderProgressDots = () => {
        return (
            <View style={styles.progressContainer}>
                {tests.map((_, idx) => {
                    let dotStyle = styles.progressDotInactive;
                    const isSkipped = results[idx] === 'skipped';
                    if (idx === currentIndex) {
                        dotStyle = styles.progressDotActive;
                    } else if (results[idx] === true) {
                        dotStyle = styles.progressDotDone;
                    } else if (results[idx] === false) {
                        dotStyle = styles.progressDotFailed;
                    } else if (isSkipped) {
                        dotStyle = styles.progressDotSkipped;
                    }

                    const dotElement = <View style={[styles.progressDot, dotStyle]} />;

                    if (isSkipped) {
                        return (
                            <TouchableOpacity
                                key={idx}
                                onPress={() => {
                                    const toLeft = idx > currentIndex;
                                    Animated.parallel([
                                        Animated.timing(slideAnim, {
                                            toValue: toLeft ? -SCREEN_WIDTH : SCREEN_WIDTH,
                                            duration: 250,
                                            useNativeDriver: true,
                                        }),
                                        Animated.timing(fadeAnim, {
                                            toValue: 0,
                                            duration: 200,
                                            useNativeDriver: true,
                                        })
                                    ]).start(() => {
                                        setCurrentIndex(idx);
                                        slideAnim.setValue(toLeft ? SCREEN_WIDTH : -SCREEN_WIDTH);
                                        
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
                                }}
                                activeOpacity={0.7}
                            >
                                {dotElement}
                            </TouchableOpacity>
                        );
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
        progressDotSkipped: {
            width: scale(8),
            backgroundColor: '#8E8E93',
        },
        testContainer: {
            flex: 1,
        },
        scrollContent: {
            flexGrow: 1,
            paddingHorizontal: scale(20),
            paddingBottom: scale(40),
            paddingTop: scale(48),
        },
    });
};

export default TestStepper;
