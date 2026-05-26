/**
 * FreeTextTest.tsx
 * Тест со свободным вводом текста. AI проверяет ответ.
 * UX по Frames 654, 659, 660.
 */

import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    Keyboard,
} from 'react-native';
import { scale } from '../../../constants';
import { fonts } from '../../../theme';
import { useAppTheme } from '../../../theme/useAppTheme';
import { aiService } from '../../../services/ai';

interface FreeTextTestProps {
    hobbyId: string;
    question: string;
    correctAnswer?: string;
    onAnswer: (isCorrect: boolean, feedback: string) => void;
}

export const FreeTextTest: React.FC<FreeTextTestProps> = ({
    hobbyId,
    question,
    correctAnswer,
    onAnswer,
}) => {
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const [answer, setAnswer] = useState('');
    const [isChecking, setIsChecking] = useState(false);
    const [checked, setChecked] = useState(false);
    const [isCorrectState, setIsCorrectState] = useState<boolean | null>(null);

    const handleCheck = async () => {
        if (!answer.trim() || isChecking || checked) return;
        
        Keyboard.dismiss();
        setIsChecking(true);

        try {
            let promptText = `Пользователь отвечает на вопрос теста по теме "${hobbyId}". Проверь его ответ.
Вопрос: ${question}
Ответ пользователя: ${answer}`;

            if (correctAnswer) {
                promptText += `\nПравильный (эталонный) ответ: ${correctAnswer}`;
            }

            const checkPrompt = [
                {
                    role: 'system' as const,
                    content: `Ты — строгий, но справедливый проверяющий.
Оцени ответ пользователя.
ПРАВИЛА:
1. Если ответ по смыслу верный (даже если есть опечатки или он написан своими словами) — начни ответ со слова "ВЕРНО:".
2. Если ответ в корне неверный — начни ответ со слова "НЕВЕРНО:".
3. После этого кратко (1-2 предложения) объясни почему.
Не используй markdown.`
                },
                {
                    role: 'user' as const,
                    content: promptText
                }
            ];

            const feedback = await aiService.sendMessage(checkPrompt, hobbyId);
            
            const isCorrect = feedback.trim().toUpperCase().startsWith('ВЕРНО:');
            const cleanFeedback = feedback.replace(/^(ВЕРНО:|НЕВЕРНО:)/i, '').trim();

            setIsCorrectState(isCorrect);
            setChecked(true);
            
            // Задержка для показа анимации/цветов перед переходом
            setTimeout(() => onAnswer(isCorrect, cleanFeedback), 1500);

        } catch (e) {
            console.error('[FreeTextTest] Error checking answer:', e);
            // Fallback: считаем верным если сервис недоступен, чтобы не блокировать флоу
            setIsCorrectState(true);
            setChecked(true);
            setTimeout(() => onAnswer(true, 'Отличный ответ!'), 1500);
        } finally {
            setIsChecking(false);
        }
    };

    let inputCardStyle: any = styles.inputCard;
    let inputTextStyle: any = styles.textInput;

    if (checked) {
        if (isCorrectState) {
            inputCardStyle = [styles.inputCard, styles.inputCardCorrect];
            inputTextStyle = [styles.textInput, styles.textInputChecked];
        } else {
            inputCardStyle = [styles.inputCard, styles.inputCardIncorrect];
            inputTextStyle = [styles.textInput, styles.textInputChecked];
        }
    }

    return (
        <View style={styles.container}>
            {/* Вопрос */}
            <View style={styles.questionCard}>
                <Text style={styles.questionText}>{question}</Text>
            </View>

            {/* Ввод ответа */}
            <View style={inputCardStyle}>
                <TextInput
                    style={inputTextStyle}
                    placeholder="Напиши свой ответ здесь..."
                    placeholderTextColor="rgba(8, 19, 42, 0.4)"
                    value={answer}
                    onChangeText={setAnswer}
                    multiline
                    autoCorrect={true}
                    editable={!isChecking && !checked}
                    textAlignVertical="top"
                />
                {checked && isCorrectState && (
                    <View style={styles.checkIconContainer}>
                        <Text style={styles.checkIcon}>✓</Text>
                    </View>
                )}
            </View>

            {/* Кнопка */}
            {!checked && (
                <TouchableOpacity
                    style={[
                        styles.checkButton,
                        (!answer.trim() || isChecking) && styles.checkButtonDisabled,
                    ]}
                    onPress={handleCheck}
                    disabled={!answer.trim() || isChecking}
                    activeOpacity={0.8}
                >
                    {isChecking ? (
                        <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                        <Text style={[
                            styles.checkButtonText,
                            !answer.trim() && styles.checkButtonTextDisabled,
                        ]}>
                            Далее
                        </Text>
                    )}
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
        inputCard: {
            backgroundColor: g.freeTextBg || '#F5F7FA',
            borderRadius: scale(16),
            padding: scale(16),
            marginBottom: scale(24),
            borderWidth: 1,
            borderColor: g.freeTextBorder || '#CBD5E1',
            minHeight: scale(140),
            position: 'relative',
        },
        inputCardCorrect: {
            backgroundColor: g.freeTextCorrect || '#4ADE80',
            borderColor: g.freeTextCorrectBorder || '#22C55E',
        },
        inputCardIncorrect: {
            backgroundColor: g.freeTextIncorrect || '#F87171',
            borderColor: g.freeTextIncorrectBorder || '#EF4444',
        },
        textInput: {
            fontFamily: fonts.body.regular,
            fontSize: scale(16),
            color: colors.text || '#08132A',
            minHeight: scale(100),
        },
        textInputChecked: {
            color: '#000000', // Тёмный текст на цветном фоне для читаемости
            fontFamily: fonts.heading.medium,
        },
        checkIconContainer: {
            position: 'absolute',
            bottom: scale(12),
            right: scale(16),
            backgroundColor: 'rgba(255,255,255,0.3)',
            borderRadius: scale(12),
            width: scale(24),
            height: scale(24),
            alignItems: 'center',
            justifyContent: 'center',
        },
        checkIcon: {
            color: '#065F46',
            fontSize: scale(16),
            fontWeight: 'bold',
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

export default FreeTextTest;
