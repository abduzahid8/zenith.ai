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
    onAnswer: (isCorrect: boolean, feedback: string, title?: string) => void;
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
                    content: `Ты — ИИ-ассистент в образовательном приложении. Твоя задача проверить ответ пользователя.

ПРАВИЛА ОЦЕНКИ:
- Если ответ правильный или хотя бы частично правильный по смыслу (даже своими словами) -> "status": "correct" (или "partial").
- Если ответ вообще не по теме, случайный набор букв, бессмысленный или в корне неверный -> "status": "incorrect".

ФОРМАТ ОТВЕТА (ТОЛЬКО JSON):
{
  "status": "correct" | "partial" | "incorrect",
  "title": "Короткий заголовок (например, 'Верно', 'Почти правильно', 'Неверно')",
  "explanation": "Один короткий абзац объяснения, максимум 300-400 символов. Без списков."
}

ВАЖНО:
- Верни только JSON. Не используй маркдаун (\`\`\`json).`
                },
                {
                    role: 'user' as const,
                    content: promptText
                }
            ];

            const feedback = await aiService.gradeAnswer(checkPrompt, hobbyId);
            
            let isCorrect = false;
            let cleanFeedback = '';
            let title = '';

            try {
                const jsonMatch = feedback.match(/\{[\s\S]*\}/);
                const jsonStr = jsonMatch ? jsonMatch[0] : feedback;
                const parsed = JSON.parse(jsonStr);
                
                isCorrect = parsed.status === 'correct' || parsed.status === 'partial';
                cleanFeedback = parsed.explanation || '';
                title = parsed.title || (isCorrect ? 'Отлично!' : 'Неверно');
            } catch (e) {
                console.log('[FreeTextTest] JSON parse error, falling back to text analysis');
                const cleanText = feedback.trim().replace(/\*/g, '');
                const upperText = cleanText.toUpperCase();
                const hasIncorrect = upperText.includes('НЕВЕРНО');
                const hasCorrect = upperText.includes('ВЕРНО') && !hasIncorrect;
                
                isCorrect = hasCorrect;
                cleanFeedback = cleanText.replace(/^(ВЕРНО:|ВЕРНО|НЕВЕРНО:|НЕВЕРНО)/i, '').trim();
                if (!cleanFeedback) cleanFeedback = cleanText;
                title = isCorrect ? 'Отлично!' : 'Неверно';
            }

            setIsCorrectState(isCorrect);
            setChecked(true);
            
            setTimeout(() => onAnswer(isCorrect, cleanFeedback, title), 800);

        } catch (e) {
            console.error('[FreeTextTest] Error checking answer:', e);
            setIsCorrectState(false);
            setChecked(true);
            setTimeout(() => onAnswer(false, 'Произошла ошибка при проверке ответа. Пожалуйста, попробуйте еще раз.', 'Ошибка проверки'), 800);
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
                <View style={styles.cardHeader}>
                    <View style={styles.headerDot} />
                    <Text style={styles.headerLabel}>ОТКРЫТЫЙ ВОПРОС</Text>
                </View>
                <Text style={styles.questionText}>{question}</Text>
            </View>

            {/* Ввод ответа */}
            <View style={inputCardStyle}>
                <TextInput
                    style={inputTextStyle}
                    placeholder="Напиши свой ответ здесь..."
                    placeholderTextColor="rgba(8, 19, 42, 0.4)"
                    selectionColor="#8CA1C1"
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
            alignItems: 'center',
            width: '100%',
        },
        questionCard: {
            backgroundColor: 'transparent',
            borderRadius: 0,
            paddingVertical: scale(12),
            paddingHorizontal: scale(10),
            marginBottom: scale(8),
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
        inputCard: {
            backgroundColor: '#FFFFFF',
            borderRadius: scale(20),
            padding: scale(20),
            marginBottom: scale(24),
            borderWidth: 2,
            borderColor: '#E2E8F0',
            width: '100%',
            minHeight: scale(160),
            position: 'relative',
            shadowColor: '#0F2147',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.03,
            shadowRadius: 15,
            elevation: 2,
        },
        inputCardCorrect: {
            borderColor: '#34C759', // Crisp green border
        },
        inputCardIncorrect: {
            borderColor: '#FF3B30', // Crisp red border
        },
        feedbackCard: {
            backgroundColor: '#FFFFFF',
            borderRadius: scale(20),
            padding: scale(16),
            width: '100%',
            marginTop: scale(-12), // Слегка притягиваем к карточке ввода
            marginBottom: scale(20),
            borderWidth: 1.5,
            borderColor: '#E2E8F0',
            shadowColor: '#0F2147',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.02,
            shadowRadius: 8,
            elevation: 1,
        },
        feedbackCardCorrect: {
            borderColor: '#C2F0D0', // Мягкая зеленая обводка
            backgroundColor: '#F3FBF5',
        },
        feedbackCardIncorrect: {
            borderColor: '#FCA5A5', // Мягкая красная обводка
            backgroundColor: '#FEF2F2',
        },
        feedbackTitle: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(12),
            color: '#1A253C',
            marginBottom: scale(6),
            textTransform: 'uppercase',
            letterSpacing: 0.5,
        },
        feedbackText: {
            fontFamily: fonts.body.regular,
            fontSize: scale(14),
            lineHeight: scale(20),
            color: '#1A253C',
            textAlign: 'left',
        },
        textInput: {
            fontFamily: fonts.body.regular,
            fontSize: scale(15),
            color: '#1A253C',
            minHeight: scale(120),
            lineHeight: scale(20),
        },
        textInputChecked: {
            color: '#1A253C',
            fontFamily: fonts.body.regular,
        },
        checkIconContainer: {
            position: 'absolute',
            bottom: scale(16),
            right: scale(16),
            backgroundColor: '#34C759',
            borderRadius: scale(12),
            width: scale(24),
            height: scale(24),
            alignItems: 'center',
            justifyContent: 'center',
        },
        checkIcon: {
            color: '#FFFFFF',
            fontSize: scale(14),
            fontWeight: 'bold',
        },
        checkButton: {
            backgroundColor: '#102852',
            borderRadius: scale(26),
            height: scale(52),
            justifyContent: 'center',
            alignItems: 'center',
            width: '100%',
            marginTop: scale(16),
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

export default FreeTextTest;
