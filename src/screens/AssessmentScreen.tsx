import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { scale } from '../constants';
import { fonts } from '../theme';
import { useAppTheme } from '../theme/useAppTheme';
import { getProgram } from '../domain/credentials/catalog';
import { buildAttemptQuestions, PreparedQuestion, scoreAnswer } from '../data/assessmentBank';
import { gradeAttempt } from '../services/credentialService';
import { useCredentialStore } from '../store/credentialStore';
import { EncouragementBanner } from '../components/session/chess/EncouragementBanner';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

/**
 * Timed final assessment, styled like the session tests (TestStepper):
 * tappable progress dots, white radius-34 options with letter circles,
 * green/red verdict states, Check → encouragement banner → next.
 * Results feed the skill graph as tagged assessment evidence (+10 XP each).
 */
export const AssessmentScreen: React.FC = () => {
    const router = useRouter();
    const params = useLocalSearchParams();
    const slug = String(params.slug ?? '');
    const program = getProgram(slug);

    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const startAttempt = useCredentialStore(s => s.startAttempt);
    const completeAttempt = useCredentialStore(s => s.completeAttempt);
    const recordAssessmentAnswers = useCredentialStore(s => s.recordAssessmentAnswers);

    const [questions] = useState<PreparedQuestion[]>(() =>
        program ? buildAttemptQuestions(program.slug, program.assessment.questionCount) : [],
    );
    const [index, setIndex] = useState(0);
    const [selected, setSelected] = useState<Record<string, number[]>>({});
    const [bools, setBools] = useState<Record<string, boolean>>({});
    const [revealed, setRevealed] = useState<Record<string, boolean>>({});
    const [secondsLeft, setSecondsLeft] = useState((program?.assessment.timeLimitMinutes ?? 30) * 60);
    const [submitted, setSubmitted] = useState(false);

    useEffect(() => {
        if (program) startAttempt(program.slug);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [program?.slug]);

    const handleSubmit = React.useCallback(() => {
        if (submitted || !program) return;
        setSubmitted(true);
        const answers = questions.map(q => ({
            questionId: q.id,
            selectedIndices: selected[q.id] ?? [],
            booleanAnswer: q.questionKind === 'true_false' ? (bools[q.id] ?? null) : null,
        }));
        const graded = gradeAttempt(questions, answers);
        recordAssessmentAnswers(program.slug, graded.perSkill);
        completeAttempt(program.slug, graded.score);
        console.log('[Assessment] submitted:', program.slug, graded.score, `${graded.correctCount}/${questions.length}`);
        Alert.alert(
            graded.score >= program.requiredScore ? 'Assessment passed' : 'Assessment complete',
            `Score: ${Math.round(graded.score)}% (required ${program.requiredScore}%). ${graded.correctCount} of ${questions.length} correct.`,
            [{ text: 'See results', onPress: () => router.replace(`/credential/${program.slug}` as any) }],
        );
    }, [bools, completeAttempt, program, questions, recordAssessmentAnswers, router, selected, submitted]);

    useEffect(() => {
        if (submitted) return;
        if (secondsLeft <= 0) {
            handleSubmit();
            return;
        }
        const timer = setTimeout(() => setSecondsLeft(s => s - 1), 1000);
        return () => clearTimeout(timer);
    }, [secondsLeft, handleSubmit, submitted]);

    const correctness = useMemo(() => {
        const map: Record<string, boolean> = {};
        for (const q of questions) {
            map[q.id] = scoreAnswer(q, selected[q.id] ?? [], q.questionKind === 'true_false' ? (bools[q.id] ?? null) : null);
        }
        return map;
    }, [questions, selected, bools]);

    if (!program || questions.length === 0) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <Text style={styles.title}>No questions available</Text>
            </SafeAreaView>
        );
    }

    const question = questions[index];
    const options = question.displayOptions ?? question.options ?? [];
    const isMulti = question.questionKind === 'multiple_choice';
    const isBool = question.questionKind === 'true_false';
    const current = selected[question.id] ?? [];
    const isRevealed = !!revealed[question.id];
    const isCorrect = correctness[question.id];
    const hasAnswer = isBool ? bools[question.id] !== undefined : current.length > 0;

    const toggleOption = (i: number) => {
        if (isRevealed || isBool) return;
        setSelected(prev => {
            const prevSel = prev[question.id] ?? [];
            if (isMulti) {
                return {
                    ...prev,
                    [question.id]: prevSel.includes(i) ? prevSel.filter(x => x !== i) : [...prevSel, i],
                };
            }
            return { ...prev, [question.id]: [i] };
        });
    };

    const handleCheck = () => {
        if (!hasAnswer || isRevealed) return;
        console.log('[Assessment] check:', question.id);
        setRevealed(prev => ({ ...prev, [question.id]: true }));
    };

    const handleBannerNext = () => {
        setRevealed(prev => {
            const next = { ...prev };
            delete next[question.id];
            return next;
        });
        if (index < questions.length - 1) {
            setIndex(i => i + 1);
        } else {
            handleSubmit();
        }
    };

    const answeredCount = questions.filter(q =>
        q.questionKind === 'true_false' ? bools[q.id] !== undefined : (selected[q.id] ?? []).length > 0,
    ).length;

    const mm = Math.floor(secondsLeft / 60);
    const ss = String(secondsLeft % 60).padStart(2, '0');

    const boolOptions = ['True', 'False'];
    const rows = isBool ? boolOptions : options;

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
            {/* Session-style header: timer pill + phase label */}
            <View style={styles.topBar}>
                <View style={styles.timerPill}>
                    <Text style={styles.timerText}>
                        {mm}:{ss}
                    </Text>
                </View>
                <Text style={styles.phaseLabel}>
                    Prove · {index + 1}/{questions.length}
                </Text>
            </View>
            {/* TestStepper-style dots */}
            <View style={styles.dots}>
                {questions.map((q, i) => {
                    const done = revealed[q.id];
                    return (
                        <TouchableOpacity
                            key={q.id}
                            onPress={() => {
                                if (!isRevealed) setIndex(i);
                            }}
                            style={[
                                styles.dot,
                                i === index && styles.dotActive,
                                done && (correctness[q.id] ? styles.dotDone : styles.dotFailed),
                            ]}
                        />
                    );
                })}
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <Animated.View key={question.id} entering={FadeInRight.duration(250)}>
                    <Text style={styles.kind}>
                        ● {question.kind === 'knowledge' ? 'Knowledge check' : question.kind === 'applied' ? 'Applied task' : 'Scenario'}
                    </Text>
                    <Text style={styles.prompt}>{question.prompt}</Text>

                    <View style={styles.options}>
                        {rows.map((opt, i) => {
                            const picked = isBool ? (bools[question.id] === (i === 0)) : current.includes(i);
                            const correctIdx = isBool
                                ? (question.correctBoolean ? 0 : 1)
                                : (question.displayCorrectIndices ?? question.correctIndices ?? []);
                            const isRightAnswer = isBool ? i === correctIdx : (correctIdx as number[]).includes(i);
                            return (
                                <TouchableOpacity
                                    key={i}
                                    style={[
                                        styles.option,
                                        picked && !isRevealed && styles.optionPicked,
                                        isRevealed && isRightAnswer && styles.optionCorrect,
                                        isRevealed && picked && !isRightAnswer && styles.optionWrong,
                                        isRevealed && !picked && !isRightAnswer && styles.optionDimmed,
                                    ]}
                                    onPress={() => {
                                        if (isBool && !isRevealed) {
                                            setBools(prev => ({ ...prev, [question.id]: i === 0 }));
                                        } else {
                                            toggleOption(i);
                                        }
                                    }}
                                    activeOpacity={0.8}
                                >
                                    <View
                                        style={[
                                            styles.letter,
                                            picked && !isRevealed && styles.letterPicked,
                                            isRevealed && isRightAnswer && styles.letterCorrect,
                                            isRevealed && picked && !isRightAnswer && styles.letterWrong,
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.letterText,
                                                ((picked && !isRevealed) || (isRevealed && (isRightAnswer || picked))) &&
                                                    styles.letterTextActive,
                                            ]}
                                        >
                                            {LETTERS[i]}
                                        </Text>
                                    </View>
                                    <Text style={styles.optionText}>{opt}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                    {isMulti && !isRevealed && <Text style={styles.hint}>Select all that apply.</Text>}
                </Animated.View>
            </ScrollView>

            {!isRevealed && (
                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.checkBtn, !hasAnswer && styles.checkDisabled]}
                        disabled={!hasAnswer}
                        onPress={handleCheck}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.checkText}>Check</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Session encouragement banner with the explanation */}
            <EncouragementBanner
                isCorrect={isCorrect}
                visible={isRevealed && !submitted}
                onNext={handleBannerNext}
                feedback={question.explanation || undefined}
                showFeedbackOnIncorrect
                buttonText={index < questions.length - 1 ? 'Next' : 'Finish'}
            />
        </SafeAreaView>
    );
};

const createStyles = (colors: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.background,
        },
        topBar: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: scale(20),
            paddingTop: scale(8),
        },
        timerPill: {
            backgroundColor: 'rgba(91,163,230,0.12)',
            borderRadius: scale(16),
            paddingVertical: scale(6),
            paddingHorizontal: scale(14),
        },
        timerText: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(15),
            color: '#2B5B84',
        },
        phaseLabel: {
            fontFamily: fonts.body.regular,
            fontSize: scale(13),
            color: colors.textSecondary,
        },
        dots: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: scale(8),
            paddingHorizontal: scale(20),
            paddingVertical: scale(12),
        },
        dot: {
            width: scale(8),
            height: scale(6),
            borderRadius: scale(3),
            backgroundColor: 'rgba(15,33,71,0.1)',
        },
        dotActive: {
            width: scale(28),
            backgroundColor: '#37A0EF',
        },
        dotDone: {
            width: scale(8),
            backgroundColor: '#34C759',
        },
        dotFailed: {
            width: scale(8),
            backgroundColor: '#FF3B30',
        },
        content: {
            paddingHorizontal: scale(20),
            paddingBottom: scale(120),
        },
        kind: {
            fontFamily: fonts.heading.medium,
            fontSize: scale(11),
            letterSpacing: 1.5,
            textTransform: 'uppercase',
            color: 'rgba(15,33,71,0.4)',
            textAlign: 'center',
            marginBottom: scale(8),
        },
        prompt: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(22),
            lineHeight: scale(30),
            color: '#1A253C',
            textAlign: 'center',
            marginBottom: scale(20),
        },
        options: {
            gap: scale(10),
        },
        option: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#FFFFFF',
            borderRadius: scale(34),
            minHeight: scale(68),
            paddingVertical: scale(12),
            paddingHorizontal: scale(14),
            borderWidth: 2,
            borderColor: '#E2E8F0',
            gap: scale(12),
        },
        optionPicked: {
            borderColor: '#102852',
        },
        optionCorrect: {
            borderColor: '#34C759',
        },
        optionWrong: {
            borderColor: '#FF3B30',
        },
        optionDimmed: {
            opacity: 0.35,
        },
        letter: {
            width: scale(36),
            height: scale(36),
            borderRadius: scale(18),
            backgroundColor: 'rgba(15,33,71,0.05)',
            alignItems: 'center',
            justifyContent: 'center',
        },
        letterPicked: {
            backgroundColor: '#102852',
        },
        letterCorrect: {
            backgroundColor: '#34C759',
        },
        letterWrong: {
            backgroundColor: '#FF3B30',
        },
        letterText: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(16),
            color: '#1A253C',
        },
        letterTextActive: {
            color: '#FFFFFF',
        },
        optionText: {
            flex: 1,
            fontFamily: fonts.body.regular,
            fontSize: scale(16),
            lineHeight: scale(22),
            color: '#08132A',
        },
        hint: {
            fontFamily: fonts.body.regular,
            fontSize: scale(13),
            color: colors.textSecondary,
            marginTop: scale(8),
            textAlign: 'center',
        },
        title: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(22),
            color: colors.text,
            padding: scale(20),
        },
        footer: {
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            paddingHorizontal: scale(20),
            paddingBottom: scale(24),
        },
        checkBtn: {
            backgroundColor: '#102852',
            height: scale(56),
            borderRadius: scale(9999),
            alignItems: 'center',
            justifyContent: 'center',
        },
        checkDisabled: {
            opacity: 0.4,
        },
        checkText: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(18),
            color: '#FFFFFF',
        },
    });

export default AssessmentScreen;
