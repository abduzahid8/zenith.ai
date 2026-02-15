import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    StatusBar,
    TouchableOpacity,
    Image,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LogoNew } from '../components/Logo';
import { Button } from '../components/Button';
import { colors, fonts } from '../theme';
import { scale } from '../constants';
import { useQuizStore, QUIZ_QUESTIONS } from '../store/quizStore';
import { useAuthStore } from '../store/authStore';
import { dbService } from '../services/supabase';

export default function QuizScreen() {
    const router = useRouter();
    const user = useAuthStore((s) => s.user);
    const {
        currentQuestion,
        answers,
        setAnswer,
        nextQuestion,
        prevQuestion,
        completeQuiz,
    } = useQuizStore();
    const [saving, setSaving] = useState(false);

    const question = QUIZ_QUESTIONS[currentQuestion - 1];
    const selectedOption = answers[currentQuestion];
    const isLastQuestion = currentQuestion === QUIZ_QUESTIONS.length;
    const canProceed = selectedOption !== undefined;

    const handleNext = async () => {
        if (isLastQuestion) {
            if (user) {
                setSaving(true);
                try {
                    await dbService.saveQuizAnswers(user.id, answers);
                } catch (e: unknown) {
                    setSaving(false);
                    Alert.alert(
                        'Ошибка',
                        e instanceof Error ? e.message : 'Не удалось сохранить ответы. Проверьте интернет и попробуйте снова.',
                        [{ text: 'OK' }]
                    );
                    return;
                }
            }
            completeQuiz();
            router.push('/hobby-selection');
        } else {
            nextQuestion();
        }
    };

    const handleBack = () => {
        if (currentQuestion > 1) {
            prevQuestion();
        } else {
            router.back();
        }
    };

    const handleSelectOption = (optionIndex: number) => {
        setAnswer(currentQuestion, optionIndex);
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

            {/* Logo at top */}
            <View style={styles.logoContainer}>
                <LogoNew width={scale(160)} height={scale(36)} variant="full" />
            </View>

            {/* Question area - fixed height */}
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

            {/* Spacer */}
            <View style={styles.spacer} />

            {/* Bottom controls */}
            <View style={styles.bottomContainer}>
                <View style={styles.bottomRow}>
                    {/* Back button */}
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={handleBack}
                    >
                        <Image
                            source={require('../../assets/icons/back-arrow.png')}
                            style={styles.backIcon}
                            resizeMode="contain"
                        />
                    </TouchableOpacity>

                    {/* Next button */}
                    <View style={styles.nextButtonContainer}>
                        <Button
                            title={isLastQuestion ? 'Завершить' : 'Далее'}
                            onPress={handleNext}
                            disabled={!canProceed || saving}
                        />
                    </View>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    logoContainer: {
        alignItems: 'center',
        marginTop: 60,
    },
    questionContainer: {
        height: 120,
        paddingHorizontal: 24,
        marginTop: 40,
        justifyContent: 'flex-start',
    },
    questionText: {
        fontFamily: fonts.heading.bold,
        fontSize: 24,
        lineHeight: 32,
        color: colors.text, // Color change
    },
    optionsContainer: {
        paddingHorizontal: 24,
    },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingVertical: 12,
        minHeight: 48,
    },
    radioCircle: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: colors.text, // Color change
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
        marginTop: 2,
    },
    radioCircleSelected: {
        borderColor: colors.text, // Color change
    },
    radioInner: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: colors.text, // Color change
    },
    optionText: {
        flex: 1,
        fontFamily: fonts.body.light, // Font change
        fontSize: 16,
        lineHeight: 24,
        color: colors.text, // Color change
    },
    spacer: {
        flex: 1,
    },
    bottomContainer: {
        paddingHorizontal: 24,
        paddingBottom: 48,
    },
    bottomRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    backButton: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: colors.quiz.backButtonBg,
        justifyContent: 'center',
        alignItems: 'center',
    },
    backIcon: {
        width: 24,
        height: 24,
    },
    nextButtonContainer: {
        flex: 1,
    },
});
