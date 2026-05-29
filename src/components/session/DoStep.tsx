import React, { useState, useMemo, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { scale } from '../../constants';
import { fonts } from '../../theme';
import { useAppTheme } from '../../theme/useAppTheme';
import { useT } from '../../store/languageStore';
import { aiService } from '../../services/ai';
import ChessBoard from './ChessBoard';
import PythonRunner from './PythonRunner';
import { TaskStep } from '../../data/lessonContent';

interface DoStepProps {
    hobbyId: string;
    task: TaskStep;
    onNext: (userInput: string, aiFeedback: string) => void;
    isLastStep?: boolean;
}

export const DoStep: React.FC<DoStepProps> = ({
    hobbyId,
    task,
    onNext,
    isLastStep,
}) => {
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const t = useT();

    // User response & AI feedback
    const [answer, setAnswer] = useState('');
    const [stdout, setStdout] = useState('');
    const [stderr, setStderr] = useState<string | null>(null);

    const [isChecking, setIsChecking] = useState(false);
    const [aiFeedback, setAiFeedback] = useState<string | null>(null);
    const [isSolved, setIsSolved] = useState(false); // Used for chess or automatic correct verification

    // Reset state when task changes
    useEffect(() => {
        setAnswer('');
        setStdout('');
        setStderr(null);
        setAiFeedback(null);
        setIsChecking(false);
        setIsSolved(false);
    }, [task]);

    // Handle python code output
    const handlePythonOutput = (out: string, err: string | null) => {
        setStdout(out);
        setStderr(err);
        setAnswer(out); // The output of the code serves as the user's primary answer
    };

    // Handle chess board completion
    const handleChessComplete = () => {
        setIsSolved(true);
        setAnswer('Успешно решено!');
        // Automatically check and complete
        handleCheckAnswer('Успешно решено!');
    };

    const handleCheckAnswer = async (forcedAnswer?: string) => {
        const finalAnswer = forcedAnswer || answer;
        if (!finalAnswer.trim() && task.type !== 'chess_puzzle') return;

        setIsChecking(true);
        setAiFeedback(null);

        try {
            let promptText = `Пользователь выполнил практическое задание по теме "${hobbyId}". Проверь его ответ.
Задание: ${task.prompt}
Ответ пользователя: ${finalAnswer}`;

            if (task.type === 'code') {
                promptText += `\n\nКод программы:\n${starterCode}\n\nВывод программы (stdout):\n${stdout}\nОшибки (stderr):\n${stderr || 'нет'}`;
            }

            if (task.correctAnswer) {
                promptText += `\nПравильный ответ для сравнения: ${task.correctAnswer}`;
            }

            const checkPrompt = [
                {
                    role: 'system' as const,
                    content: `Ты — AI-наставник в приложении Zenyth по хобби "${hobbyId}".
Проверь ответ пользователя и дай обратную связь.

ПРАВИЛА:
1. Отвечай СТРОГО на русском языке.
2. Начни с короткой оценки: правильно, частично правильно или неправильно (используй эмодзи 👍, 🤔 или ❌).
3. Объясни ошибки конкретно (если они есть).
4. Дай 1 короткий, практический совет для улучшения.
5. Заверши тёплой мотивирующей фразой.
6. НЕ используй разметку markdown (никаких **, ##, \`\`\`).
7. Длина ответа: 3-5 предложений.
8. Будь дружелюбным и поддерживающим.`
                },
                {
                    role: 'user' as const,
                    content: promptText
                }
            ];

            const feedback = await aiService.sendMessage(checkPrompt, hobbyId);
            setAiFeedback(feedback);
            setIsSolved(true);
        } catch (e) {
            console.error('[DoStep] Error checking answer:', e);
            setAiFeedback('Не удалось связаться с AI-наставником. Отличная попытка! Давайте продолжим.');
            setIsSolved(true);
        } finally {
            setIsChecking(false);
        }
    };

    const handleContinue = () => {
        onNext(answer, aiFeedback || 'Выполнено отлично!');
    };

    // Render interactive practice element based on type
    const renderInteractiveInput = () => {
        switch (task.type) {
            case 'chess_puzzle':
                return (
                    <ChessBoard
                        fen={task.puzzleFen || ''}
                        puzzleMoves={task.puzzleMoves || []}
                        question={task.prompt}
                        maxHints={3}
                        onComplete={handleChessComplete}
                        isLastStep={isLastStep}
                    />
                );

            case 'code':
                return (
                    <PythonRunner
                        starterCode={task.starterCode || ''}
                        onOutput={handlePythonOutput}
                    />
                );

            case 'fill_blank':
                return (
                    <View style={styles.inputCard}>
                        <Text style={styles.inputPrompt}>{task.prompt}</Text>
                        <TextInput
                            style={styles.textInput}
                            placeholder={t('Введи пропущенное слово...')}
                            placeholderTextColor="rgba(30, 30, 46, 0.4)"
                            value={answer}
                            onChangeText={setAnswer}
                            autoCapitalize="none"
                            autoCorrect={false}
                            editable={!isChecking && !isSolved}
                        />
                    </View>
                );

            case 'translate':
                return (
                    <View style={styles.inputCard}>
                        <Text style={styles.inputPrompt}>{task.prompt}</Text>
                        <TextInput
                            style={[styles.textInput, styles.multilineInput]}
                            placeholder={t('Напиши перевод...')}
                            placeholderTextColor="rgba(30, 30, 46, 0.4)"
                            value={answer}
                            onChangeText={setAnswer}
                            multiline
                            autoCorrect={true}
                            editable={!isChecking && !isSolved}
                        />
                    </View>
                );

            case 'free_text':
            default:
                return (
                    <View style={styles.inputCard}>
                        <Text style={styles.inputPrompt}>{task.prompt}</Text>
                        <TextInput
                            style={[styles.textInput, styles.multilineInput]}
                            placeholder={t('Твой ответ...')}
                            placeholderTextColor="rgba(30, 30, 46, 0.4)"
                            value={answer}
                            onChangeText={setAnswer}
                            multiline
                            autoCorrect={true}
                            editable={!isChecking && !isSolved}
                        />
                    </View>
                );
        }
    };

    // Render hint block
    const starterCode = task.starterCode || '';
    const hasHints = task.hints && task.hints.length > 0;

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
            keyboardVerticalOffset={Platform.OS === 'ios' ? scale(80) : 0}
        >
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* Interactive Area */}
                {renderInteractiveInput()}

                {/* Hint Capsule */}
                {hasHints && !isSolved && !isChecking && (
                    <View style={styles.hintContainer}>
                        <Ionicons name="bulb" size={scale(16)} color={colors.text || '#08132A'} style={{marginRight: 4}} />
                        <Text style={styles.hintText}>
                            {t('Подсказка:')} {task.hints?.[0]}
                        </Text>
                    </View>
                )}

                {/* Submit button (only for non-chess, which has its own complete triggers) */}
                {task.type !== 'chess_puzzle' && !isSolved && (
                    <TouchableOpacity
                        style={[
                            styles.submitButton,
                            (!answer.trim() || isChecking) && styles.disabledButton,
                        ]}
                        onPress={() => handleCheckAnswer()}
                        disabled={!answer.trim() || isChecking}
                        activeOpacity={0.8}
                    >
                        {isChecking ? (
                            <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                            <Text style={styles.submitButtonText}>{t('Проверить')}</Text>
                        )}
                    </TouchableOpacity>
                )}

                {/* AI Feedback Display */}
                {aiFeedback && (
                    <View style={styles.feedbackContainer}>
                        <View style={styles.feedbackHeader}>
                            <Text style={styles.feedbackTitle}>🤖 {t('Разбор AI-Наставника:')}</Text>
                        </View>
                        <Text style={styles.feedbackText}>{aiFeedback}</Text>
                    </View>
                )}

                {/* Next Step / Continue Action */}
                {isSolved && (
                    <TouchableOpacity
                        style={styles.continueButton}
                        onPress={handleContinue}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.continueButtonText}>{t('Далее')}</Text>
                    </TouchableOpacity>
                )}
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const createStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: scale(20),
    },
    scrollContent: {
        paddingTop: scale(16),
        paddingBottom: scale(120),
    },
    inputCard: {
        backgroundColor: colors.surfaceLight || 'rgba(255, 255, 255, 0.08)',
        borderRadius: scale(20),
        padding: scale(20),
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        marginBottom: scale(16),
    },
    inputPrompt: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(16),
        lineHeight: scale(22),
        color: colors.text || '#1E1E2E',
        marginBottom: scale(16),
    },
    textInput: {
        fontFamily: fonts.body?.light || fonts.heading.light,
        fontSize: scale(16),
        color: colors.text || '#1E1E2E',
        borderBottomWidth: 1,
        borderBottomColor: '#FF5722',
        paddingVertical: scale(8),
    },
    multilineInput: {
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
        borderRadius: scale(12),
        paddingHorizontal: scale(12),
        height: scale(100),
        textAlignVertical: 'top',
    },
    hintContainer: {
        marginTop: scale(16),
        padding: scale(12),
        backgroundColor: colors.theoryCard || '#D6EEFF',
        borderRadius: scale(8),
        flexDirection: 'row',
        alignItems: 'center',
    },
    hintText: {
        fontFamily: fonts.body?.light || fonts.heading.light,
        fontSize: scale(14),
        lineHeight: scale(20),
        color: 'rgba(30, 30, 46, 0.8)',
    },
    submitButton: {
        backgroundColor: '#FF5722',
        borderRadius: scale(30),
        height: scale(56),
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: scale(10),
    },
    disabledButton: {
        opacity: 0.6,
    },
    submitButtonText: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(18),
        color: '#FFFFFF',
    },
    feedbackContainer: {
        backgroundColor: 'rgba(255, 87, 34, 0.08)',
        borderRadius: scale(16),
        padding: scale(16),
        marginTop: scale(20),
        borderWidth: 1,
        borderColor: 'rgba(255, 87, 34, 0.2)',
    },
    feedbackHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: scale(8),
    },
    feedbackTitle: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(15),
        color: '#FF5722',
    },
    feedbackText: {
        fontFamily: fonts.body?.light || fonts.heading.light,
        fontSize: scale(15),
        lineHeight: scale(22),
        color: colors.text || '#1E1E2E',
    },
    continueButton: {
        backgroundColor: colors.buttonPrimary || '#1E1E2E',
        borderRadius: scale(30),
        height: scale(56),
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: scale(20),
    },
    continueButtonText: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(18),
        color: '#FFFFFF',
    },
});

export default DoStep;
