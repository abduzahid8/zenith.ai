/**
 * FillBlankTest.tsx
 * Тест на вставку слов в текст (слова-чипы → тап → вставка в пропуск).
 * UX по Frames 653, 657, 658.
 */

import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
} from 'react-native';
import { scale } from '../../../constants';
import { fonts } from '../../../theme';
import { useAppTheme } from '../../../theme/useAppTheme';

interface FillBlankTestProps {
    question: string;        // Текст задания сверху
    blanksText: string;      // Текст с пропусками в формате "Слово ___ другое слово ___"
    wordPool: string[];      // Доступные слова-чипы
    correctOrder: string[];  // Правильный порядок слов в пропусках
    onAnswer: (isCorrect: boolean) => void;
}

// Разбиваем текст с пропусками на части
function parseTextWithBlanks(text: string): string[] {
    return text.split('___');
}

export const FillBlankTest: React.FC<FillBlankTestProps> = ({
    question,
    blanksText,
    wordPool,
    correctOrder,
    onAnswer,
}) => {
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const parts = parseTextWithBlanks(blanksText);
    const blankCount = parts.length - 1;

    // Слова в слотах: null = пустой
    const [filledSlots, setFilledSlots] = useState<(string | null)[]>(
        Array(blankCount).fill(null)
    );
    // Доступные слова для выбора (исходный пул)
    const [availableWords, setAvailableWords] = useState<string[]>([...wordPool]);
    const [checked, setChecked] = useState(false);
    const [slotResults, setSlotResults] = useState<(boolean | null)[]>(
        Array(blankCount).fill(null)
    );

    // Тап на слово → вставить в первый пустой слот
    const handleWordTap = (word: string, wordIndex: number) => {
        if (checked) return;

        const firstEmpty = filledSlots.findIndex(s => s === null);
        if (firstEmpty === -1) return; // Все слоты заполнены

        const newSlots = [...filledSlots];
        newSlots[firstEmpty] = word;
        setFilledSlots(newSlots);

        const newWords = [...availableWords];
        newWords.splice(wordIndex, 1);
        setAvailableWords(newWords);
    };

    // Тап на слот → вернуть слово в пул
    const handleSlotTap = (slotIndex: number) => {
        if (checked) return;
        const word = filledSlots[slotIndex];
        if (!word) return;

        const newSlots = [...filledSlots];
        newSlots[slotIndex] = null;
        setFilledSlots(newSlots);
        setAvailableWords(prev => [...prev, word]);
    };

    // Проверка ответа
    const handleCheck = () => {
        if (filledSlots.some(s => s === null)) return;
        setChecked(true);

        const results = filledSlots.map(
            (word, idx) => word === correctOrder[idx]
        );
        setSlotResults(results);

        const isAllCorrect = results.every(Boolean);
        setTimeout(() => onAnswer(isAllCorrect), 1500);
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
            <TouchableOpacity
                key={index}
                style={[styles.blankSlotBase, slotStyle]}
                onPress={() => handleSlotTap(index)}
                disabled={checked}
                activeOpacity={0.7}
            >
                <Text style={[styles.blankSlotTextBase, textStyle]}>
                    {word || '  ???  '}
                </Text>
            </TouchableOpacity>
        );
    };

    // Рендер текста с встроенными слотами
    const renderTextWithBlanks = () => {
        return (
            <View style={styles.textContainer}>
                {parts.map((part, idx) => (
                    <React.Fragment key={idx}>
                        {part !== '' && (
                            <Text style={styles.textPart}>{part}</Text>
                        )}
                        {idx < blankCount && renderSlot(idx)}
                    </React.Fragment>
                ))}
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {/* Вопрос */}
            <View style={styles.questionCard}>
                <Text style={styles.questionText}>{question}</Text>
            </View>

            {/* Текст с пропусками */}
            <View style={styles.blanksCard}>
                <ScrollView showsVerticalScrollIndicator={false}>
                    {renderTextWithBlanks()}
                </ScrollView>
            </View>

            {/* Пул слов */}
            <View style={styles.wordPoolSection}>
                <Text style={styles.wordPoolLabel}>Слова для вставки:</Text>
                <View style={styles.wordPool}>
                    {availableWords.map((word, idx) => (
                        <TouchableOpacity
                            key={`${word}_${idx}`}
                            style={styles.wordChip}
                            onPress={() => handleWordTap(word, idx)}
                            disabled={checked}
                            activeOpacity={0.75}
                        >
                            <Text style={styles.wordChipText}>{word}</Text>
                        </TouchableOpacity>
                    ))}
                    {availableWords.length === 0 && !checked && (
                        <Text style={styles.allUsedText}>Все слова использованы</Text>
                    )}
                </View>
            </View>

            {/* Кнопка проверки */}
            {!checked && (
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
            )}
        </View>
    );
};

const createStyles = (colors: any) => {
    const g = colors.gamification || {};
    return StyleSheet.create({
        container: {
            flex: 1,
        },
        questionCard: {
            backgroundColor: g.theoryCard || '#D6EEFF',
            borderRadius: scale(16),
            padding: scale(16),
            marginBottom: scale(16),
            borderWidth: 1,
            borderColor: g.theoryCardBorder || '#B8D8F0',
        },
        questionText: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(16),
            lineHeight: scale(24),
            color: colors.text || '#08132A',
            textAlign: 'center',
        },
        blanksCard: {
            backgroundColor: '#FFFFFF',
            borderRadius: scale(16),
            padding: scale(16),
            marginBottom: scale(16),
            borderWidth: 1,
            borderColor: g.blankSlotBorder || '#94A3B8',
            maxHeight: scale(180),
        },
        textContainer: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: scale(4),
        },
        textPart: {
            fontFamily: fonts.body.regular,
            fontSize: scale(16),
            lineHeight: scale(26),
            color: colors.text || '#08132A',
        },
        blankSlotBase: {
            borderRadius: scale(8),
            paddingHorizontal: scale(10),
            paddingVertical: scale(4),
            marginHorizontal: scale(2),
            borderWidth: 1.5,
            minWidth: scale(60),
            alignItems: 'center',
            justifyContent: 'center',
        },
        blankSlot: {
            backgroundColor: g.blankSlot || '#E2E8F0',
            borderColor: g.blankSlotBorder || '#94A3B8',
            borderStyle: 'dashed',
        },
        blankSlotFilled: {
            backgroundColor: g.wordChip || '#DDE8F4',
            borderColor: '#5BA3E6',
            borderStyle: 'solid',
        },
        blankSlotCorrect: {
            backgroundColor: g.wordChipFilled || '#4ADE80',
            borderColor: '#22C55E',
            borderStyle: 'solid',
        },
        blankSlotIncorrect: {
            backgroundColor: g.wordChipWrong || '#F87171',
            borderColor: '#EF4444',
            borderStyle: 'solid',
        },
        blankSlotTextBase: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(13),
        },
        blankSlotText: {
            color: 'rgba(8, 19, 42, 0.4)',
        },
        blankSlotFilledText: {
            color: '#08132A',
        },
        blankTextCorrect: {
            color: g.wordChipFilledText || '#065F46',
        },
        blankTextIncorrect: {
            color: g.wordChipWrongText || '#FFFFFF',
        },
        wordPoolSection: {
            marginBottom: scale(16),
        },
        wordPoolLabel: {
            fontFamily: fonts.body.regular,
            fontSize: scale(13),
            color: colors.textSecondary || '#666666',
            marginBottom: scale(10),
        },
        wordPool: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: scale(8),
        },
        wordChip: {
            backgroundColor: g.wordChip || '#DDE8F4',
            borderRadius: scale(20),
            paddingHorizontal: scale(14),
            paddingVertical: scale(8),
        },
        wordChipText: {
            fontFamily: fonts.heading.medium,
            fontSize: scale(14),
            color: g.wordChipText || '#08132A',
        },
        allUsedText: {
            fontFamily: fonts.body.regular,
            fontSize: scale(13),
            color: colors.textSecondary || '#666',
            fontStyle: 'italic',
        },
        checkButton: {
            backgroundColor: g.buttonConfirm || '#102852',
            borderRadius: scale(30),
            height: scale(52),
            justifyContent: 'center',
            alignItems: 'center',
        },
        checkButtonDisabled: {
            backgroundColor: g.buttonConfirmDisabled || '#CBD5E1',
        },
        checkButtonText: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(17),
            color: g.buttonConfirmText || '#FFFFFF',
        },
        checkButtonTextDisabled: {
            color: g.buttonConfirmDisabledText || '#94A3B8',
        },
    });
};

export default FillBlankTest;
