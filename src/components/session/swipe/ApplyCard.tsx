import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { scale } from '../../../constants';
import { fonts } from '../../../theme';
import { useAppTheme } from '../../../theme/useAppTheme';
import type { TaskStep } from '../../../data/lessonContent';
import DoStep from '../DoStep';
import ChessBoard from '../ChessBoard';
import TestStepper from '../chess/TestStepper';

interface ApplyCardProps {
    cardId: string;
    hobbyId: string;
    task: TaskStep;
    isPremium: boolean;
    completed: boolean;
    onAnswerFeedback: (userInput: string, aiFeedback: string) => void;
    onSolved: () => void;
    onContinue: () => void;
}

/** Apply card hosts the existing DoStep grader / chess board unchanged. */
export const ApplyCard: React.FC<ApplyCardProps> = ({
    hobbyId,
    task,
    isPremium,
    completed,
    onAnswerFeedback,
    onSolved,
    onContinue,
}) => {
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    return (
        <View style={styles.viewport}>
            <View style={styles.miniHeader}>
                <Text style={styles.eyebrow}>Сделай</Text>
            </View>
            <View style={styles.host}>
                {task.type === 'chess_puzzle' ? (
                    <ChessBoard
                        fen={task.puzzleFen!}
                        puzzleMoves={task.puzzleMoves!}
                        puzzles={task.puzzles}
                        question={task.prompt}
                        maxHints={isPremium ? 5 : 3}
                        onComplete={onSolved}
                        isLastStep
                    />
                ) : (
                    <DoStep hobbyId={hobbyId} task={task} onNext={onAnswerFeedback} isLastStep />
                )}
            </View>
            {completed && (
                <TouchableOpacity style={styles.continueButton} onPress={onContinue} activeOpacity={0.8}>
                    <Text style={styles.continueText}>Далее ↑</Text>
                </TouchableOpacity>
            )}
        </View>
    );
};

interface ChallengeCardProps {
    hobbyId: string;
    tests?: TaskStep[];
    task?: TaskStep;
    isPremium: boolean;
    completed: boolean;
    onTestsDone: (passed: number, total: number, skipped: number) => void;
    onAnswerFeedback: (userInput: string, aiFeedback: string) => void;
    onContinue: () => void;
}

/** Challenge card: real tests via TestStepper, chess board, or deepen task. */
export const ChallengeCard: React.FC<ChallengeCardProps> = ({
    hobbyId,
    tests,
    task,
    isPremium,
    completed,
    onTestsDone,
    onAnswerFeedback,
    onContinue,
}) => {
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    return (
        <View style={styles.viewport}>
            <View style={styles.miniHeader}>
                <Text style={styles.eyebrow}>Вызов</Text>
            </View>
            <View style={styles.host}>
                {tests && tests.length > 0 ? (
                    <TestStepper
                        hobbyId={hobbyId}
                        tests={tests}
                        onAllTestsComplete={() => {}}
                        onResult={onTestsDone}
                    />
                ) : task?.type === 'chess_puzzle' ? (
                    <ChessBoard
                        fen={task.puzzleFen!}
                        puzzleMoves={task.puzzleMoves!}
                        puzzles={task.puzzles}
                        question={task.prompt}
                        maxHints={isPremium ? 5 : 3}
                        onComplete={() => onTestsDone(1, 1, 0)}
                        isLastStep
                    />
                ) : task ? (
                    <DoStep hobbyId={hobbyId} task={task} onNext={onAnswerFeedback} isLastStep />
                ) : null}
            </View>
            {completed && (
                <TouchableOpacity style={styles.continueButton} onPress={onContinue} activeOpacity={0.8}>
                    <Text style={styles.continueText}>Далее ↑</Text>
                </TouchableOpacity>
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
        eyebrow: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(13),
            letterSpacing: 2,
            textTransform: 'uppercase',
            color: '#5BA3E6',
        },
        host: {
            flex: 1,
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

export default ApplyCard;
