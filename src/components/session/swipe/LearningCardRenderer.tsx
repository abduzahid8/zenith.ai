import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { scale } from '../../../constants';
import { fonts } from '../../../theme';
import type { LearningCard, CardStatus, SessionResultData } from '../../../domain/sessions/learningCards';
import type { StepOutcome } from '../../../domain/sessions/sessionBlueprint';
import { ConceptCard, ExampleCard, KeyIdeaCard } from './ConceptCard';
import { FeedbackCard, SessionResultCard } from './FeedbackCard';
import { RecallCard } from './RecallCard';
import { ApplyCard, ChallengeCard } from './ApplyCard';

interface RendererProps {
    card: LearningCard;
    status: CardStatus;
    /** Full status map (resolves proof barriers for support cards). */
    statusByCard: Record<string, CardStatus>;
    hobbyId: string;
    hobbyEyebrow: string;
    isPremium: boolean;
    result: SessionResultData | null;
    resultContinueLabel: string;
    onResultContinue: () => void;
    resultDoneLabel?: string | null;
    onResultDone?: () => void;
    onAnswer: (cardId: string, outcome: StepOutcome, userInput?: string, aiFeedback?: string, explanation?: string) => void;
    onAnswerFeedback: (cardId: string, userInput: string, aiFeedback: string) => void;
    onTestsDone: (cardId: string, passed: number, total: number, skipped: number) => void;
    onSolved: (cardId: string) => void;
    onAdvance: () => void;
    onRetryProof: (cardId: string) => void;
}

/** Remount key so a retry genuinely re-runs the hosted interaction. */
export function retryKey(cardId: string, attempts: number): string {
    return `${cardId}:retry:${attempts}`;
}

/** Routes each card to its renderer. Interactive hosts reuse legacy components. */
export const LearningCardRenderer: React.FC<RendererProps> = (props) => {
    const { card, status } = props;
    const completed = status.completed;

    switch (card.type) {
        case 'concept':
            return <ConceptCard eyebrow={props.hobbyEyebrow} title={card.title} body={card.body ?? ''} />;
        case 'example':
            return <ExampleCard body={card.body ?? ''} />;
        case 'key_idea':
            return <KeyIdeaCard term={card.body ?? ''} />;
        case 'feedback': {
            const blockedBy = card.feedback?.blockedByCardId ?? null;
            const proofOpen = blockedBy ? !(props.statusByCard[blockedBy]?.completed ?? false) : false;
            return (
                <FeedbackCard
                    title={card.title ?? ''}
                    body={card.feedback?.body ?? ''}
                    verdict={card.feedback?.verdict ?? ''}
                    onRetry={blockedBy && proofOpen ? () => props.onRetryProof(blockedBy) : undefined}
                />
            );
        }
        case 'recall':
            if (!card.recall) return null;
            return (
                <View style={styles.fill}>
                    <RecallCard
                        key={retryKey(card.id, status.attempts)}
                        cardId={card.id}
                        hobbyId={props.hobbyId}
                        recall={card.recall}
                        attempts={status.attempts}
                        completed={completed}
                        onAnswer={(outcome, userInput, explanation) =>
                            props.onAnswer(card.id, outcome, userInput, undefined, explanation)
                        }
                        onAnswerFeedback={(ans, fb) => props.onAnswerFeedback(card.id, ans, fb)}
                        onTestsDone={(passed, total, skipped) => props.onTestsDone(card.id, passed, total, skipped)}
                        onContinue={props.onAdvance}
                    />
                    <SkipLink card={card} completed={completed} onSkip={() => props.onAnswer(card.id, 'unknown')} />
                </View>
            );
        case 'apply':
            if (!card.task) return null;
            return (
                <View style={styles.fill}>
                    <ApplyCard
                        key={retryKey(card.id, status.attempts)}
                        cardId={card.id}
                        hobbyId={props.hobbyId}
                        task={card.task}
                        isPremium={props.isPremium}
                        completed={completed}
                        onAnswerFeedback={(ans, fb) => props.onAnswerFeedback(card.id, ans, fb)}
                        onSolved={() => props.onSolved(card.id)}
                        onContinue={props.onAdvance}
                    />
                    <SkipLink card={card} completed={completed} onSkip={() => props.onAnswer(card.id, 'unknown')} />
                </View>
            );
        case 'challenge':
            return (
                <View style={styles.fill}>
                    <ChallengeCard
                        key={retryKey(card.id, status.attempts)}
                        hobbyId={props.hobbyId}
                        tests={card.taskTests}
                        task={card.task}
                        isPremium={props.isPremium}
                        completed={completed}
                        onTestsDone={(passed, total, skipped) => props.onTestsDone(card.id, passed, total, skipped)}
                        onAnswerFeedback={(ans, fb) => props.onAnswerFeedback(card.id, ans, fb)}
                        onContinue={props.onAdvance}
                    />
                    <SkipLink card={card} completed={completed} onSkip={() => props.onAnswer(card.id, 'unknown')} />
                </View>
            );
        case 'result':
            if (!props.result) return null;
            return (
                <SessionResultCard
                    data={props.result}
                    continueLabel={props.resultContinueLabel}
                    onContinue={props.onResultContinue}
                    doneLabel={props.resultDoneLabel}
                    onDone={props.onResultDone}
                />
            );
        default:
            return null;
    }
};

const SkipLink: React.FC<{ card: LearningCard; completed: boolean; onSkip: () => void }> = ({
    card,
    completed,
    onSkip,
}) => {
    if (!card.required || completed) return null;
    return (
        <TouchableOpacity onPress={onSkip} activeOpacity={0.7} style={skipStyles.wrap}>
            <Text style={skipStyles.text}>Пропустить</Text>
        </TouchableOpacity>
    );
};

const skipStyles = StyleSheet.create({
    wrap: {
        alignItems: 'center',
        paddingVertical: scale(10),
        backgroundColor: '#EDF2F7',
    },
    text: {
        fontFamily: fonts.heading.medium,
        fontSize: scale(14),
        color: 'rgba(15, 33, 71, 0.45)',
    },
});

const styles = StyleSheet.create({
    fill: { flex: 1 },
});

export default LearningCardRenderer;
