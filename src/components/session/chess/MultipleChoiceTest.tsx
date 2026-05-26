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
            {/* Ambient glowing backdrops */}
            <View style={styles.glowTopLeft} />
            <View style={styles.glowBottomRight} />

            {/* Вопрос */}
            <View style={styles.questionCard}>
                <View style={styles.cardHeader}>
                    <View style={styles.headerDot} />
                    <Text style={styles.headerLabel}>ТЕОРЕТИЧЕСКИЙ ТЕСТ</Text>
                </View>
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
                        <Text style={[styles.optionLabel, answered && { color: 'rgba(255, 255, 255, 0.7)' }]}>
                            {getOptionLabel(index)}
                        </Text>
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
            justifyContent: 'center',
            alignItems: 'center',
            width: '100%',
            position: 'relative',
        },
        glowTopLeft: {
            position: 'absolute',
            top: -scale(40),
            left: -scale(40),
            width: scale(240),
            height: scale(240),
            borderRadius: scale(120),
            backgroundColor: '#8CDEFF',
            opacity: 0.15,
            zIndex: -1,
        },
        glowBottomRight: {
            position: 'absolute',
            bottom: -scale(60),
            right: -scale(40),
            width: scale(260),
            height: scale(260),
            borderRadius: scale(130),
            backgroundColor: '#F4C0FD',
            opacity: 0.18,
            zIndex: -1,
        },
        questionCard: {
            backgroundColor: '#FFFFFF',
            borderRadius: scale(24),
            padding: scale(24),
            marginBottom: scale(28),
            borderWidth: 0,
            width: '100%',
            shadowColor: '#0F2147',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.04,
            shadowRadius: 20,
            elevation: 3,
        },
        cardHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: scale(6),
            marginBottom: scale(14),
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
            fontSize: scale(10),
            color: 'rgba(15, 33, 71, 0.4)',
            letterSpacing: 1.5,
        },
        questionText: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(19),
            lineHeight: scale(28),
            color: '#1A253C',
            textAlign: 'center',
        },
        optionsGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: scale(12),
            justifyContent: 'center',
            width: '100%',
        },
        optionButton: {
            width: '48%',
            borderRadius: scale(20),
            paddingVertical: scale(22),
            paddingHorizontal: scale(12),
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: scale(100),
            borderWidth: 0,
            shadowColor: '#0F2147',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.03,
            shadowRadius: 10,
            elevation: 2,
        },
        optionDefault: {
            backgroundColor: '#FFFFFF',
        },
        optionCorrect: {
            backgroundColor: '#22C55E',
        },
        optionIncorrect: {
            backgroundColor: '#EF4444',
        },
        optionDimmed: {
            backgroundColor: '#FFFFFF',
            opacity: 0.4,
        },
        optionLabel: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(12),
            color: 'rgba(15, 33, 71, 0.35)',
            marginBottom: scale(4),
        },
        optionText: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(15),
            lineHeight: scale(22),
            textAlign: 'center',
        },
        optionTextDefault: {
            color: '#1A253C',
        },
        optionTextCorrect: {
            color: '#FFFFFF',
        },
        optionTextIncorrect: {
            color: '#FFFFFF',
        },
        optionTextDimmed: {
            color: 'rgba(15, 33, 71, 0.3)',
        },
    });
};

export default MultipleChoiceTest;
