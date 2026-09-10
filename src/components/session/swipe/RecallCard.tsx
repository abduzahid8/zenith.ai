import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { scale } from '../../../constants';
import { fonts } from '../../../theme';
import { useAppTheme } from '../../../theme/useAppTheme';
import type { RecallPayload } from '../../../domain/sessions/learningCards';
import type { StepOutcome } from '../../../domain/sessions/sessionBlueprint';
import DoStep from '../DoStep';
import TestStepper from '../chess/TestStepper';

interface RecallCardProps {
    cardId: string;
    hobbyId: string;
    recall: RecallPayload;
    /** Retry round — resets local selection. */
    attempts: number;
    completed: boolean;
    onAnswer: (outcome: StepOutcome, userInput?: string, explanation?: string) => void;
    onAnswerFeedback: (userInput: string, aiFeedback: string) => void;
    onTestsDone: (passed: number, total: number, skipped: number) => void;
    onContinue: () => void;
}

/**
 * Recall card: choice questions grade locally from real options;
 * free-text recall reuses the existing DoStep AI grader.
 */
export const RecallCard: React.FC<RecallCardProps> = ({
    cardId,
    hobbyId,
    recall,
    attempts,
    completed,
    onAnswer,
    onAnswerFeedback,
    onTestsDone,
    onContinue,
}) => {
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const [selected, setSelected] = useState<number | null>(null);
    const [checked, setChecked] = useState(false);

    const isChoice = !recall.tests?.length && !!recall.options && recall.options.length > 0 && typeof recall.correctOptionIndex === 'number';

    // Stable task identity: the parent re-renders every elapsed second and
    // DoStep resets on task change — an inline literal would wipe typing.
    const textTask = useMemo(
        () => ({
            type: 'free_text' as const,
            prompt: recall.prompt,
            correctAnswer: recall.correctAnswer,
            hints: recall.hint ? [recall.hint] : undefined,
        }),
        [recall.prompt, recall.correctAnswer, recall.hint],
    );

    if (recall.tests && recall.tests.length > 0) {
        return (
            <View style={styles.viewport}>
                <View style={styles.miniHeader}>
                    <Text style={styles.eyebrow}>Быстрое повторение</Text>
                </View>
                <View style={styles.doHost}>
                    <TestStepper
                        hobbyId={hobbyId}
                        tests={recall.tests}
                        onAllTestsComplete={() => {}}
                        onResult={onTestsDone}
                    />
                </View>
                {completed && (
                    <TouchableOpacity style={styles.continueButton} onPress={onContinue} activeOpacity={0.8}>
                        <Text style={styles.continueText}>Далее ↑</Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    }

    const handleCheck = () => {
        if (selected === null) return;
        setChecked(true);
        const correct = selected === recall.correctOptionIndex;
        const correctText = recall.options?.[recall.correctOptionIndex ?? 0] ?? '';
        onAnswer(
            correct ? 'pass' : 'fail',
            recall.options?.[selected] ?? '',
            correct ? correctText : `Правильный ответ: ${correctText}`,
        );
    };

    // Reset choice state on retry round change.
    const [round, setRound] = useState(attempts);
    if (round !== attempts) {
        setRound(attempts);
        setSelected(null);
        setChecked(false);
    }

    if (!isChoice) {
        return (
            <View style={styles.viewport} key={`${cardId}-${attempts}`}>
                <View style={styles.miniHeader}>
                    <Text style={styles.eyebrow}>Быстрое повторение</Text>
                </View>
                <View style={styles.doHost}>
                    <DoStep
                        hobbyId={hobbyId}
                        task={textTask}
                        onNext={(ans, fb) => onAnswerFeedback(ans, fb)}
                        isLastStep
                    />
                </View>
            </View>
        );
    }

    const isCorrect = checked && selected === recall.correctOptionIndex;
    return (
        <View style={styles.viewport}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <Text style={styles.eyebrow}>Быстрое повторение</Text>
                <Text style={styles.prompt}>{recall.prompt}</Text>
                {recall.options!.map((opt, i) => {
                    const isSel = selected === i;
                    const showVerdict = checked && (isSel || i === recall.correctOptionIndex);
                    return (
                        <TouchableOpacity
                            key={i}
                            style={[
                                styles.option,
                                isSel && styles.optionSelected,
                                showVerdict && i === recall.correctOptionIndex && styles.optionCorrect,
                                showVerdict && isSel && i !== recall.correctOptionIndex && styles.optionWrong,
                            ]}
                            onPress={() => {
                                if (!checked) setSelected(i);
                            }}
                            activeOpacity={0.8}
                            disabled={checked}
                        >
                            <Text style={[styles.optionText, isSel && styles.optionTextSelected]}>{opt}</Text>
                        </TouchableOpacity>
                    );
                })}
                {checked && (
                    <Text style={styles.explain}>
                        {isCorrect ? 'Верно ✓' : `Правильный ответ: ${recall.options![recall.correctOptionIndex ?? 0]}`}
                    </Text>
                )}
            </ScrollView>
            {!checked ? (
                <TouchableOpacity
                    style={[styles.checkButton, selected === null && styles.disabledButton]}
                    onPress={handleCheck}
                    disabled={selected === null}
                    activeOpacity={0.8}
                >
                    <Text style={styles.checkText}>Проверить</Text>
                </TouchableOpacity>
            ) : (
                completed && (
                    <TouchableOpacity style={styles.continueButton} onPress={onContinue} activeOpacity={0.8}>
                        <Text style={styles.continueText}>Далее ↑</Text>
                    </TouchableOpacity>
                )
            )}
        </View>
    );
};

const createStyles = (colors: any) =>
    StyleSheet.create({
        viewport: {
            flex: 1,
            backgroundColor: '#EDF2F7',
            paddingHorizontal: scale(24),
            paddingTop: scale(12),
            paddingBottom: scale(24),
        },
        miniHeader: {
            paddingTop: scale(4),
            paddingBottom: scale(8),
        },
        doHost: {
            flex: 1,
        },
        scrollContent: {
            flexGrow: 1,
            justifyContent: 'center',
            paddingBottom: scale(12),
        },
        eyebrow: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(13),
            letterSpacing: 2,
            textTransform: 'uppercase',
            color: '#5BA3E6',
            marginBottom: scale(12),
        },
        prompt: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(24),
            lineHeight: scale(30),
            color: '#1A253C',
            marginBottom: scale(20),
        },
        option: {
            backgroundColor: '#FFFFFF',
            borderRadius: scale(16),
            paddingHorizontal: scale(18),
            paddingVertical: scale(16),
            marginBottom: scale(12),
            borderWidth: 1,
            borderColor: 'rgba(15, 33, 71, 0.1)',
        },
        optionSelected: {
            borderColor: '#0F2147',
            borderWidth: 2,
        },
        optionCorrect: {
            backgroundColor: '#D1FAE5',
            borderColor: '#34C759',
        },
        optionWrong: {
            backgroundColor: '#FDE8E8',
            borderColor: '#E5484D',
        },
        optionText: {
            fontFamily: fonts.heading.medium,
            fontSize: scale(17),
            color: '#1A253C',
        },
        optionTextSelected: {
            color: '#0F2147',
        },
        explain: {
            fontFamily: fonts.body?.regular || fonts.heading.regular,
            fontSize: scale(16),
            lineHeight: scale(24),
            color: '#1A253C',
            marginTop: scale(8),
        },
        checkButton: {
            backgroundColor: '#0F2147',
            borderRadius: 9999,
            height: scale(56),
            justifyContent: 'center',
            alignItems: 'center',
            marginTop: scale(12),
        },
        disabledButton: {
            opacity: 0.4,
        },
        checkText: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(18),
            color: '#FFFFFF',
        },
        continueButton: {
            backgroundColor: 'transparent',
            borderRadius: 9999,
            borderWidth: 1.5,
            borderColor: '#0F2147',
            height: scale(52),
            justifyContent: 'center',
            alignItems: 'center',
            marginTop: scale(12),
        },
        continueText: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(16),
            color: '#0F2147',
        },
    });

export default RecallCard;
