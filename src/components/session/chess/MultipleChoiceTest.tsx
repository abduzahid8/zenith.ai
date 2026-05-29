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
        onAnswer(isCorrect);
    };

    const getOptionStyle = (index: number) => {
        if (!answered) return styles.optionDefault;
        if (index === correctIndex) return styles.optionCorrect;
        if (index === selectedIndex && index !== correctIndex) return styles.optionIncorrect;
        return styles.optionDimmed;
    };

    const getOptionLabelStyle = (index: number) => {
        if (!answered) return styles.labelContainerDefault;
        if (index === correctIndex) return styles.labelContainerCorrect;
        if (index === selectedIndex && index !== correctIndex) return styles.labelContainerIncorrect;
        return styles.labelContainerDimmed;
    };

    const getOptionLabelTextStyle = (index: number) => {
        if (!answered) return styles.labelTextDefault;
        if (index === correctIndex) return styles.labelTextCorrect;
        if (index === selectedIndex && index !== correctIndex) return styles.labelTextIncorrect;
        return styles.labelTextDimmed;
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
                <View style={styles.cardHeader}>
                    <View style={styles.headerDot} />
                    <Text style={styles.headerLabel}>ТЕОРЕТИЧЕСКИЙ ТЕСТ</Text>
                </View>
                <Text style={styles.questionText}>{question}</Text>
            </View>

            {/* Варианты — Вертикальный стек */}
            <View style={styles.optionsList}>
                {options.map((option, index) => (
                    <TouchableOpacity
                        key={index}
                        style={[styles.optionButton, getOptionStyle(index)]}
                        onPress={() => handleSelect(index)}
                        disabled={answered}
                        activeOpacity={0.75}
                    >
                        <View style={[styles.optionLabelContainer, getOptionLabelStyle(index)]}>
                            <Text style={[styles.optionLabel, getOptionLabelTextStyle(index)]}>
                                {getOptionLabel(index)}
                            </Text>
                        </View>
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
        optionsList: {
            width: '100%',
            gap: scale(12),
        },
        optionButton: {
            flexDirection: 'row',
            alignItems: 'center',
            width: '100%',
            borderRadius: scale(34),
            paddingVertical: scale(14), // slightly less padding because of border
            paddingHorizontal: scale(16),
            minHeight: scale(68),
            borderWidth: 2,
            shadowColor: '#0F2147',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.02,
            shadowRadius: 8,
            elevation: 2,
        },
        optionDefault: {
            backgroundColor: '#FFFFFF',
            borderColor: '#E2E8F0',
        },
        optionCorrect: {
            backgroundColor: '#FFFFFF', 
            borderColor: '#34C759', // Crisp green border
        },
        optionIncorrect: {
            backgroundColor: '#FFFFFF', 
            borderColor: '#FF3B30', // Crisp red border
        },
        optionDimmed: {
            backgroundColor: '#FFFFFF',
            borderColor: '#F1F5F9',
            opacity: 0.35,
        },
        optionLabelContainer: {
            width: scale(36),
            height: scale(36),
            borderRadius: scale(18),
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: scale(14),
        },
        labelContainerDefault: {
            backgroundColor: 'rgba(15, 33, 71, 0.05)',
        },
        labelContainerCorrect: {
            backgroundColor: '#34C759', // Зеленый кружок
        },
        labelContainerIncorrect: {
            backgroundColor: '#FF3B30', // Красный кружок
        },
        labelContainerDimmed: {
            backgroundColor: 'rgba(15, 33, 71, 0.02)',
        },
        optionLabel: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(14),
        },
        labelTextDefault: {
            color: '#1A253C',
        },
        labelTextCorrect: {
            color: '#FFFFFF',
        },
        labelTextIncorrect: {
            color: '#FFFFFF',
        },
        labelTextDimmed: {
            color: 'rgba(15, 33, 71, 0.3)',
        },
        optionText: {
            fontFamily: fonts.body?.light || fonts.heading.bold,
            fontSize: scale(15),
            lineHeight: scale(22),
            flex: 1,
            textAlign: 'left',
        },
        optionTextDefault: {
            color: '#1A253C',
        },
        optionTextCorrect: {
            color: '#102852',
        },
        optionTextIncorrect: {
            color: '#721C24',
        },
        optionTextDimmed: {
            color: 'rgba(15, 33, 71, 0.3)',
        },
    });
};

export default MultipleChoiceTest;
