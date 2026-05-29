/**
 * FillBlankTest.tsx
 * Drag & Drop через react-native-gesture-handler (нативный уровень).
 * Работает корректно внутри ScrollView.
 */

import React, { useState, useMemo, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    LayoutChangeEvent,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    runOnJS,
} from 'react-native-reanimated';
import { scale } from '../../../constants';
import { fonts } from '../../../theme';
import { useAppTheme } from '../../../theme/useAppTheme';

interface FillBlankTestProps {
    question: string;
    blanksText: string;
    wordPool: string[];
    correctOrder: string[];
    onAnswer: (isCorrect: boolean) => void;
    onNext?: () => void;
    onDragStateChange?: (isDragging: boolean) => void;
}

function parseTextWithBlanks(text: string): string[] {
    return text.split('___');
}

// ─── Отдельный перетаскиваемый чип ───────────────────────────────────────────
interface DraggableChipProps {
    word: string;
    wordIndex: number;
    onTap: (word: string, index: number) => void;
    onDrop: (word: string, wordIndex: number, absX: number, absY: number) => void;
    onDragStart: () => void;
    onDragEnd: () => void;
    chipStyle: any;
    textStyle: any;
    disabled: boolean;
}

const DraggableChip: React.FC<DraggableChipProps> = ({
    word,
    wordIndex,
    onTap,
    onDrop,
    onDragStart,
    onDragEnd,
    chipStyle,
    textStyle,
    disabled,
}) => {
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const isDragging = useSharedValue(false);
    const startAbsX = useSharedValue(0);
    const startAbsY = useSharedValue(0);

    const pan = Gesture.Pan()
        .enabled(!disabled)
        .minDistance(5)
        .onStart((e) => {
            isDragging.value = true;
            startAbsX.value = e.absoluteX;
            startAbsY.value = e.absoluteY;
            runOnJS(onDragStart)();
        })
        .onUpdate((e) => {
            translateX.value = e.translationX;
            translateY.value = e.translationY;
        })
        .onEnd((e) => {
            isDragging.value = false;
            // Используем absoluteX/Y напрямую — самые точные координаты пальца
            runOnJS(onDrop)(word, wordIndex, e.absoluteX, e.absoluteY);
            runOnJS(onDragEnd)();
            translateX.value = withSpring(0, { damping: 20, stiffness: 300 });
            translateY.value = withSpring(0, { damping: 20, stiffness: 300 });
        })
        .onFinalize(() => {
            isDragging.value = false;
            runOnJS(onDragEnd)();
            translateX.value = withSpring(0, { damping: 20, stiffness: 300 });
            translateY.value = withSpring(0, { damping: 20, stiffness: 300 });
        });

    const tap = Gesture.Tap()
        .enabled(!disabled)
        .onEnd(() => {
            runOnJS(onTap)(word, wordIndex);
        });

    // Tap срабатывает если не было Pan; Pan приоритетнее
    const composed = Gesture.Race(pan, tap);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
            { scale: isDragging.value ? 1.08 : 1 },
        ],
        zIndex: isDragging.value ? 999 : 1,
        opacity: isDragging.value ? 0.9 : 1,
        shadowOpacity: isDragging.value ? 0.2 : 0.06,
        elevation: isDragging.value ? 12 : 2,
    }));

    return (
        <GestureDetector gesture={composed}>
            <Animated.View style={[chipStyle, animatedStyle]}>
                <Text style={textStyle}>
                    {word.charAt(0).toUpperCase() + word.slice(1)}
                </Text>
            </Animated.View>
        </GestureDetector>
    );
};

// ─── Основной компонент ────────────────────────────────────────────────────────
export const FillBlankTest: React.FC<FillBlankTestProps> = ({
    question,
    blanksText,
    wordPool,
    correctOrder,
    onAnswer,
    onNext,
    onDragStateChange,
}) => {
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const parts = parseTextWithBlanks(blanksText);
    const blankCount = parts.length - 1;

    const [filledSlots, setFilledSlots] = useState<(string | null)[]>(
        Array(blankCount).fill(null)
    );
    const [availableWords, setAvailableWords] = useState<string[]>([...wordPool]);
    const [checked, setChecked] = useState(false);
    const [slotResults, setSlotResults] = useState<(boolean | null)[]>(
        Array(blankCount).fill(null)
    );
    // Сохраняем результат чтобы передать в onAnswer при нажатии Далее
    const [isAllCorrectResult, setIsAllCorrectResult] = useState<boolean | null>(null);

    // Координаты слотов — обновляются через measureInWindow
    const slotRefs = useRef<View[]>([]);
    const slotCoords = useRef<{ left: number; top: number; right: number; bottom: number }[]>([]);

    const measureSlot = useCallback((index: number) => {
        const ref = slotRefs.current[index];
        if (!ref) return;
        ref.measureInWindow((x: number, y: number, w: number, h: number) => {
            slotCoords.current[index] = {
                left: x - 6,
                top: y - 6,
                right: x + w + 6,
                bottom: y + h + 6,
            };
        });
    }, []);

    const measureAllSlots = useCallback(() => {
        for (let i = 0; i < blankCount; i++) {
            measureSlot(i);
        }
    }, [blankCount, measureSlot]);

    // Drag начался — блокируем ScrollView у родителя
    const handleDragStart = useCallback(() => {
        measureAllSlots();
        onDragStateChange?.(true);
    }, [measureAllSlots, onDragStateChange]);

    const handleDragEnd = useCallback(() => {
        onDragStateChange?.(false);
    }, [onDragStateChange]);

    // Тап → вставить в первый пустой слот
    const handleWordTap = useCallback((word: string, wordIndex: number) => {
        if (checked) return;
        const firstEmpty = filledSlots.findIndex(s => s === null);
        if (firstEmpty === -1) return; // Нет пустых слотов, ничего не делаем

        setFilledSlots(prev => {
            const next = [...prev];
            next[firstEmpty] = word;
            return next;
        });
        setAvailableWords(prev => {
            const next = [...prev];
            next.splice(wordIndex, 1);
            return next;
        });
    }, [checked, filledSlots]);

    // Дроп — проверяем координаты слотов
    const handleWordDrop = useCallback((word: string, wordIndex: number, absX: number, absY: number) => {
        if (checked) return;

        let foundIndex = -1;
        for (let i = 0; i < slotCoords.current.length; i++) {
            const c = slotCoords.current[i];
            if (!c) continue;
            if (absX >= c.left && absX <= c.right && absY >= c.top && absY <= c.bottom) {
                foundIndex = i;
                break;
            }
        }

        if (foundIndex === -1) return; // промах — слово возвращается на место

        // Проверяем занятость слота ДО изменения состояния
        // Если слот занят — НЕ трогаем ни слоты ни пул (слово остаётся)
        if (filledSlots[foundIndex] !== null) return;

        // Слот пустой — вставляем слово и убираем из пула
        setFilledSlots(prev => {
            const next = [...prev];
            next[foundIndex] = word;
            return next;
        });
        setAvailableWords(prev => {
            const next = [...prev];
            next.splice(wordIndex, 1);
            return next;
        });
    }, [checked, filledSlots]);

    // Тап по слоту → вернуть слово в пул
    const handleSlotTap = (slotIndex: number) => {
        if (checked) return;
        const word = filledSlots[slotIndex];
        if (!word) return;
        setFilledSlots(prev => {
            const next = [...prev];
            next[slotIndex] = null;
            return next;
        });
        setAvailableWords(prev => [...prev, word]);
    };

    // Проверка ответа
    const handleCheck = () => {
        if (filledSlots.some(s => s === null)) return;
        setChecked(true);
        const results = filledSlots.map((w, idx) => w === correctOrder[idx]);
        setSlotResults(results);
        const isAllCorrect = results.every(Boolean);
        setIsAllCorrectResult(isAllCorrect);
        // Вызываем onAnswer сразу — баннер подбадривания выйдет моментально
        onAnswer(isAllCorrect);
    };

    const handleNext = () => {
        onNext?.();
    };

    const allFilled = filledSlots.every(s => s !== null);

    // Рендер слота
    const renderSlot = (index: number) => {
        const word = filledSlots[index];
        const result = slotResults[index];

        let slotStyle: any = styles.blankSlot;
        let textStyle: any = styles.blankSlotText;
        if (word && checked) {
            slotStyle = result ? styles.blankSlotCorrect : styles.blankSlotIncorrect;
            textStyle = result ? styles.blankTextCorrect : styles.blankTextIncorrect;
        } else if (word) {
            slotStyle = styles.blankSlotFilled;
            textStyle = styles.blankSlotFilledText;
        }

        return (
            <View
                key={index}
                ref={el => { if (el) slotRefs.current[index] = el; }}
                collapsable={false}
                onLayout={() => setTimeout(() => measureSlot(index), 100)}
            >
                <TouchableOpacity
                    style={[styles.blankSlotBase, slotStyle]}
                    onPress={() => handleSlotTap(index)}
                    disabled={checked}
                    activeOpacity={0.7}
                >
                    <Text style={[styles.blankSlotTextBase, textStyle]}>
                        {word ? (word.charAt(0).toUpperCase() + word.slice(1)) : '  ???  '}
                    </Text>
                </TouchableOpacity>
            </View>
        );
    };

    const renderTextWithBlanks = () => (
        <View style={styles.textContainer}>
            {parts.map((part, idx) => (
                <React.Fragment key={idx}>
                    {part !== '' && part.split(' ').filter(Boolean).map((w, wi) => (
                        <Text key={wi} style={styles.textPart}>{w}</Text>
                    ))}
                    {idx < blankCount && renderSlot(idx)}
                </React.Fragment>
            ))}
        </View>
    );

    return (
        <View style={styles.container}>
            {/* Вопрос */}
            <View style={styles.questionCard}>
                <View style={styles.cardHeader}>
                    <View style={styles.headerDot} />
                    <Text style={styles.headerLabel}>ЗАПОЛНИ ПРОПУСКИ</Text>
                </View>
                <Text style={styles.questionText}>{question}</Text>
            </View>

            {/* Текст с пропусками */}
            <View style={styles.blanksCard}>
                {renderTextWithBlanks()}
            </View>

            {/* Пул слов */}
            <View style={styles.wordPoolSection}>
                <Text style={styles.wordPoolLabel}>Слова для вставки:</Text>
                <View style={styles.wordPool}>
                    {availableWords.map((word, idx) => (
                        <DraggableChip
                            key={`${word}_${idx}`}
                            word={word}
                            wordIndex={idx}
                            onTap={handleWordTap}
                            onDrop={handleWordDrop}
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                            chipStyle={styles.wordChip}
                            textStyle={styles.wordChipText}
                            disabled={checked}
                        />
                    ))}
                    {availableWords.length === 0 && !checked && (
                        <Text style={styles.allUsedText}>Все слова использованы</Text>
                    )}
                </View>
            </View>

            {/* Кнопка проверки / Далее */}
            {!checked ? (
                <TouchableOpacity
                    style={[
                        styles.checkButton,
                        !allFilled && styles.checkButtonDisabled,
                    ]}
                    onPress={handleCheck}
                    disabled={!allFilled}
                    activeOpacity={0.8}
                >
                    <Text style={[
                        styles.checkButtonText,
                        !allFilled && styles.checkButtonTextDisabled,
                    ]}>
                        Проверить
                    </Text>
                </TouchableOpacity>
            ) : (
                <TouchableOpacity
                    style={styles.checkButton}
                    onPress={handleNext}
                    activeOpacity={0.8}
                >
                    <Text style={styles.checkButtonText}>Далее</Text>
                </TouchableOpacity>
            )}
        </View>
    );
};

const createStyles = (colors: any) => {
    const g = colors.gamification || {};
    return StyleSheet.create({
        container: {
            flex: 1,
            alignItems: 'center',
            width: '100%',
        },
        questionCard: {
            backgroundColor: 'transparent',
            borderRadius: 0,
            paddingVertical: scale(20),
            paddingHorizontal: scale(10),
            marginBottom: scale(24),
            borderWidth: 0,
            width: '100%',
            alignItems: 'center',
            justifyContent: 'center',
        },
        cardHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: scale(6),
            marginBottom: scale(12),
            justifyContent: 'center',
        },
        headerDot: {
            width: scale(6),
            height: scale(6),
            borderRadius: scale(3),
            backgroundColor: '#37a0ef',
        },
        headerLabel: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(11),
            color: 'rgba(15, 33, 71, 0.4)',
            letterSpacing: 1.5,
        },
        questionText: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(22),
            lineHeight: scale(30),
            color: '#1A253C',
            textAlign: 'center',
        },
        blanksCard: {
            backgroundColor: '#FFFFFF',
            borderRadius: scale(20),
            paddingVertical: scale(24),
            paddingHorizontal: scale(20),
            marginBottom: scale(24),
            borderWidth: 1.5,
            borderColor: '#8CA1C1',
            width: '100%',
            shadowColor: '#0F2147',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.03,
            shadowRadius: 15,
            elevation: 2,
            minHeight: scale(140),
        },
        textContainer: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            columnGap: scale(6),
            rowGap: scale(8),
        },
        textPart: {
            fontFamily: fonts.body.regular,
            fontSize: scale(16),
            lineHeight: scale(26),
            color: '#08132A',
        },
        blankSlotBase: {
            borderRadius: scale(20),
            paddingHorizontal: scale(14),
            paddingVertical: scale(8),
            marginHorizontal: scale(2),
            minWidth: scale(76),
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 2,
            borderColor: 'transparent',
        },
        blankSlot: {
            backgroundColor: '#E8EEF6',
            borderColor: '#E8EEF6',
        },
        blankSlotFilled: {
            backgroundColor: '#DDE8F4',
            borderColor: '#DDE8F4',
        },
        blankSlotCorrect: {
            backgroundColor: '#FFFFFF',
            borderColor: '#34C759',
        },
        blankSlotIncorrect: {
            backgroundColor: '#FFFFFF',
            borderColor: '#FF3B30',
        },
        blankSlotTextBase: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(15),
        },
        blankSlotText: {
            color: 'rgba(15, 33, 71, 0.3)',
        },
        blankSlotFilledText: {
            color: '#1A253C',
        },
        blankTextCorrect: {
            color: '#138D4F',
        },
        blankTextIncorrect: {
            color: '#721C24',
        },
        wordPoolSection: {
            width: '100%',
            marginBottom: scale(24),
            alignItems: 'flex-start',
        },
        wordPoolLabel: {
            fontFamily: fonts.body.regular,
            fontSize: scale(13),
            color: 'rgba(15, 33, 71, 0.5)',
            marginBottom: scale(12),
        },
        wordPool: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: scale(10),
            justifyContent: 'flex-start',
            width: '100%',
        },
        wordChip: {
            backgroundColor: '#FFFFFF',
            borderRadius: scale(20),
            paddingHorizontal: scale(16),
            paddingVertical: scale(10),
            shadowColor: '#0F2147',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.06,
            shadowRadius: 4,
            elevation: 2,
        },
        wordChipText: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(14),
            color: '#1A253C',
        },
        allUsedText: {
            fontFamily: fonts.body.regular,
            fontSize: scale(13),
            color: 'rgba(15, 33, 71, 0.4)',
            fontStyle: 'italic',
        },
        checkButton: {
            backgroundColor: '#102852',
            borderRadius: scale(26),
            height: scale(52),
            justifyContent: 'center',
            alignItems: 'center',
            width: '100%',
            marginTop: scale(20),
            shadowColor: '#102852',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 2,
        },
        checkButtonDisabled: {
            backgroundColor: g.buttonConfirmDisabled || '#CBD5E1',
            shadowOpacity: 0,
            elevation: 0,
        },
        checkButtonText: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(17),
            color: '#FFFFFF',
        },
        checkButtonTextDisabled: {
            color: g.buttonConfirmDisabledText || '#94A3B8',
        },
    });
};

export default FillBlankTest;
