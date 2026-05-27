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
                <View style={styles.cardHeader}>
                    <View style={styles.headerDot} />
                    <Text style={styles.headerLabel}>ЗАПОЛНИ ПРОПУСКИ</Text>
                </View>
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
            borderWidth: 0,
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
            gap: scale(8),
            lineHeight: scale(32),
        },
        textPart: {
            fontFamily: fonts.body.regular,
            fontSize: scale(16),
            lineHeight: scale(28),
            color: '#08132A',
        },
        blankSlotBase: {
            borderRadius: scale(12),
            paddingHorizontal: scale(12),
            paddingVertical: scale(6),
            marginHorizontal: scale(4),
            minWidth: scale(72),
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 0,
        },
        blankSlot: {
            backgroundColor: '#EAF0F8', // Soft background matching main canvas
        },
        blankSlotFilled: {
            backgroundColor: '#DDE8F4',
        },
        blankSlotCorrect: {
            backgroundColor: '#EBF7EE', // Soft green background
        },
        blankSlotIncorrect: {
            backgroundColor: '#FDF2F2', // Soft red background
        },
        blankSlotTextBase: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(13),
        },
        blankSlotText: {
            color: 'rgba(15, 33, 71, 0.3)',
        },
        blankSlotFilledText: {
            color: '#1A253C',
        },
        blankTextCorrect: {
            color: '#155724',
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
            shadowOpacity: 0.02,
            shadowRadius: 4,
            elevation: 1,
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
            marginTop: scale(8),
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
