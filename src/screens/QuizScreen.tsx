import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    StatusBar,
    TouchableOpacity,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LogoNew } from '../components/Logo';
import { Button } from '../components/Button';
import { fonts } from '../theme';
import { scale } from '../constants';
import { useQuizStore, QUIZ_QUESTIONS } from '../store/quizStore';
import { useAuthStore } from '../store/authStore';
import { dbService } from '../services/supabase';
import { useAppTheme } from '../theme/useAppTheme';

export default function QuizScreen() {
    const router = useRouter();
    const user = useAuthStore((s) => s.user);
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const {
        currentQuestion,
        answers,
        setAnswer,
        nextQuestion,
        completeQuiz,
    } = useQuizStore();
    const [saving, setSaving] = useState(false);

    const question = QUIZ_QUESTIONS[currentQuestion - 1];
    const selectedOption = answers[currentQuestion];
    const isLastQuestion = currentQuestion === QUIZ_QUESTIONS.length;
    const canProceed = selectedOption !== undefined;

    const handleNext = async () => {
        console.log('[QuizScreen] handleNext pressed - currentQuestion:', currentQuestion, 'isLastQuestion:', isLastQuestion);
        if (isLastQuestion) {
            if (user) {
                console.log('[QuizScreen] Saving quiz answers for user:', user.id);
                setSaving(true);
                try {
                    await dbService.saveQuizAnswers(user.id, answers);
                    console.log('[QuizScreen] Quiz answers saved successfully');
                } catch (e: unknown) {
                    console.log('[QuizScreen] Error saving quiz answers:', e);
                    setSaving(false);
                    Alert.alert(
                        'Error',
                        e instanceof Error ? e.message : 'Failed to save answers. Check your internet and try again.',
                        [{ text: 'OK' }]
                    );
                    return;
                }
            }
            console.log('[QuizScreen] Completing quiz - navigating to /hobby-selection');
            completeQuiz();
            router.push('/hobby-selection');
        } else {
            console.log('[QuizScreen] Moving to next question');
            nextQuestion();
        }
    };

    const handleSelectOption = (optionIndex: number) => {
        console.log('[QuizScreen] handleSelectOption - question:', currentQuestion, 'optionIndex:', optionIndex);
        setAnswer(currentQuestion, optionIndex);
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

            {/* Logo at top */}
            <View style={styles.logoContainer}>
                <LogoNew width={scale(160)} height={scale(36)} variant="full" color={colors.text} />
            </View>

            {/* Progress indicator */}
            <View style={styles.progressContainer}>
                <View style={styles.progressTrack}>
                    <View
                        style={[
                            styles.progressFill,
                            { width: `${(currentQuestion / QUIZ_QUESTIONS.length) * 100}%` },
                        ]}
                    />
                </View>
                <Text style={styles.progressLabel}>
                    {currentQuestion} / {QUIZ_QUESTIONS.length}
                </Text>
            </View>

            {/* Content Wrapper to center vertically */}
            <View style={styles.contentWrapper}>
                {/* Question area */}
                <View style={styles.questionContainer}>
                    <Text style={styles.questionText}>{question.question}</Text>
                </View>

                {/* Options area */}
                <View style={styles.optionsContainer}>
                    {question.options.map((option, index) => (
                        <TouchableOpacity
                            key={index}
                            style={styles.optionRow}
                            onPress={() => handleSelectOption(index)}
                            activeOpacity={0.7}
                        >
                            <View style={[
                                styles.radioCircle,
                                selectedOption === index && styles.radioCircleSelected
                            ]}>
                                {selectedOption === index && <View style={styles.radioInner} />}
                            </View>
                            <Text style={styles.optionText}>{option}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Bottom controls */}
            <View style={styles.bottomContainer}>
                <Button
                    title={isLastQuestion ? 'Finish' : 'Next'}
                    onPress={handleNext}
                    disabled={!canProceed || saving}
                    size="large"
                />
            </View>
        </SafeAreaView>
    );
}

const createStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    logoContainer: {
        alignItems: 'center',
        marginTop: 60,
    },
    progressContainer: {
        position: 'absolute',
        top: 250, // Adjust this value to position it correctly beneath the logo
        left: 0,
        right: 0,
        paddingHorizontal: 24,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        zIndex: 1,
    },
    progressTrack: {
        flex: 1,
        height: 4,
        borderRadius: 2,
        backgroundColor: colors.surface || colors.surfaceLight,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 2,
        backgroundColor: '#102852',
    },
    progressLabel: {
        fontFamily: fonts.body.medium,
        fontSize: 13,
        color: colors.textSecondary,
        minWidth: 36,
        textAlign: 'right',
    },
    contentWrapper: {
        flex: 1,
        justifyContent: 'center',
    },
    questionContainer: {
        paddingHorizontal: 24,
        marginBottom: 32,
    },
    questionText: {
        fontFamily: fonts.heading.bold,
        fontSize: 24,
        lineHeight: 32,
        color: colors.text,
    },
    optionsContainer: {
        paddingHorizontal: 24,
    },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        minHeight: 48,
    },
    radioCircle: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: colors.text,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    radioCircleSelected: {
        borderColor: colors.text,
    },
    radioInner: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: colors.text,
    },
    optionText: {
        flex: 1,
        fontFamily: fonts.body.light,
        fontSize: 16,
        lineHeight: 24,
        color: colors.text,
    },
    bottomContainer: {
        paddingHorizontal: 24,
        paddingBottom: 48,
    },
});
