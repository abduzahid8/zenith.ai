import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    StatusBar,
    TouchableOpacity,
    Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Logo } from '../components/Logo';
import { Button } from '../components/Button';
import { colors } from '../theme';
import { useQuizStore, QUIZ_QUESTIONS } from '../store/quizStore';

export default function QuizScreen() {
    const router = useRouter();
    const {
        currentQuestion,
        answers,
        setAnswer,
        nextQuestion,
        prevQuestion,
        completeQuiz,
    } = useQuizStore();

    const question = QUIZ_QUESTIONS[currentQuestion - 1];
    const selectedOption = answers[currentQuestion];
    const isLastQuestion = currentQuestion === QUIZ_QUESTIONS.length;
    const canProceed = selectedOption !== undefined;

    const handleNext = () => {
        if (isLastQuestion) {
            completeQuiz();
            router.push('/profile-complete');
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
                <Logo size="large" />
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
                            disabled={!canProceed}
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
        fontFamily: 'Gramatika-Bold',
        fontSize: 24,
        lineHeight: 32,
        color: colors.text,
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
        borderColor: colors.text,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
        marginTop: 2,
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
        fontFamily: 'Gramatika-Regular',
        fontSize: 16,
        lineHeight: 24,
        color: colors.text,
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
        backgroundColor: '#F5F5F5',
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
