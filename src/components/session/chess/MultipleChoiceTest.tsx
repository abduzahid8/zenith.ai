/**
 * MultipleChoiceTest.tsx
 * Тест типа ABCD — выбор одного из 4 вариантов.
 * UX по Frames 652, 655, 656: сетка 2×2, зелёный/красный фидбек.
 */

import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
} from 'react-native';
import { scale } from '../../../constants';
import { fonts } from '../../../theme';
import { useAppTheme } from '../../../theme/useAppTheme';

interface MultipleChoiceTestProps {
    question: string;
    options: string[];           // Ровно 4 варианта
    correctIndex: number;        // Индекс правильного (0-3)
    onAnswer: (isCorrect: boolean) => void;
}

export const MultipleChoiceTest: React.FC<MultipleChoiceTestProps> = ({
    question,
    options,
    correctIndex,
    onAnswer,
}) => {
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const [answered, setAnswered] = useState(false);

    const handleSelect = (index: number) => {
        if (answered) return;
        setSelectedIndex(index);
        setAnswered(true);
        const isCorrect = index === correctIndex;
        // Небольшая задержка для анимации перед callback
        setTimeout(() => onAnswer(isCorrect), 1200);
    };

    const getOptionStyle = (index: number) => {
        if (!answered) return styles.optionDefault;
        if (index === correctIndex) return styles.optionCorrect;
        if (index === selectedIndex && index !== correctIndex) return styles.optionIncorrect;
        return styles.optionDimmed;
    };

    const getOptionTextStyle = (index: number) => {
        if (!answered) return styles.optionTextDefault;
        if (index === correctIndex) return styles.optionTextCorrect;
        if (index === selectedIndex && index !== correctIndex) return styles.optionTextIncorrect;
        return styles.optionTextDimmed;
    };

    const getOptionLabel = (index: number) => {
        return ['A', 'B', 'C', 'D'][index] || String(index + 1);
    };

    return (
        <View style={styles.container}>
            {/* Вопрос */}
            <View style={styles.questionCard}>
                <Text style={styles.questionText}>{question}</Text>
            </View>

            {/* Варианты 2×2 */}
            <View style={styles.optionsGrid}>
                {options.map((option, index) => (
                    <TouchableOpacity
                        key={index}
                        style={[styles.optionButton, getOptionStyle(index)]}
                        onPress={() => handleSelect(index)}
                        disabled={answered}
                        activeOpacity={0.75}
                    >
                        <Text style={styles.optionLabel}>{getOptionLabel(index)}</Text>
                        <Text style={[styles.optionText, getOptionTextStyle(index)]}>
                            {option}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
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
            padding: scale(20),
            marginBottom: scale(24),
            borderWidth: 1,
            borderColor: g.theoryCardBorder || '#B8D8F0',
        },
        questionText: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(18),
            lineHeight: scale(26),
            color: colors.text || '#08132A',
            textAlign: 'center',
        },
        optionsGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: scale(12),
        },
        optionButton: {
            width: '47%',
            borderRadius: scale(16),
            paddingVertical: scale(18),
            paddingHorizontal: scale(12),
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: scale(90),
            borderWidth: 1.5,
        },
        optionDefault: {
            backgroundColor: g.optionDefault || '#DDE8F4',
            borderColor: 'transparent',
        },
        optionCorrect: {
            backgroundColor: g.optionCorrect || '#4ADE80',
            borderColor: '#22C55E',
        },
        optionIncorrect: {
            backgroundColor: g.optionIncorrect || '#F87171',
            borderColor: '#EF4444',
        },
        optionDimmed: {
            backgroundColor: g.optionDefault || '#DDE8F4',
            borderColor: 'transparent',
            opacity: 0.45,
        },
        optionLabel: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(12),
            color: 'rgba(8, 19, 42, 0.45)',
            marginBottom: scale(4),
        },
        optionText: {
            fontFamily: fonts.heading.medium,
            fontSize: scale(14),
            lineHeight: scale(20),
            textAlign: 'center',
        },
        optionTextDefault: {
            color: g.optionDefaultText || '#08132A',
        },
        optionTextCorrect: {
            color: g.optionCorrectText || '#065F46',
        },
        optionTextIncorrect: {
            color: g.optionIncorrectText || '#FFFFFF',
        },
        optionTextDimmed: {
            color: 'rgba(8, 19, 42, 0.4)',
        },
    });
};

export default MultipleChoiceTest;
