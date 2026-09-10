import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, useWindowDimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { scale } from '../../../constants';
import { fonts } from '../../../theme';
import { useAppTheme } from '../../../theme/useAppTheme';
import { useUserProfileStore } from '../../../store/userProfileStore';
import type { SessionKind, SessionOrigin, StepOutcome } from '../../../domain/sessions/sessionBlueprint';
import { authorizeStepIndex } from '../../../domain/sessions/learningCards';
import type { LearningStrategy, ProgressionScope } from '../../../domain/sessions/sessionIntent';
import { HOBBY_META } from '../../../data/lessonContent';
import { useSwipeSession } from '../../../hooks/useSwipeSession';
import { LearningCardRenderer } from './LearningCardRenderer';
import { SessionClock } from './SessionClock';
import StopConfirmationModal from '../StopConfirmationModal';

interface SwipeLearningSessionProps {
    kind: SessionKind;
    origin: SessionOrigin;
    taskId?: string | null;
    discoveryId?: string | null;
    minutes: number;
    skillDay?: number | null;
    targetSkillKey?: string | null;
    scope?: ProgressionScope;
    strategy?: LearningStrategy;
    reasonCode?: string | null;
    onExit: () => void;
    /** Continue into the next real task (same session route, fresh mount). */
    onContinueNext?: (next: { taskId: string; minutes: number }) => void;
}

/**
 * Vertical swipe learning session — one gesture, one useful unit.
 * Full-screen cards over the existing engine: blueprint phases in,
 * validated outcomes out. Finite and goal-directed (ends in result).
 */
export const SwipeLearningSession: React.FC<SwipeLearningSessionProps> = (props) => {
    const { kind, origin, taskId, discoveryId, minutes, skillDay, targetSkillKey, scope, strategy, reasonCode, onExit, onContinueNext } = props;
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { height } = useWindowDimensions();
    const isPremium = useUserProfileStore(s => s.isPremium);

    const session = useSwipeSession({ kind, origin, taskId, discoveryId, minutes, skillDay, targetSkillKey, scope, strategy, reasonCode });
    const listRef = useRef<FlatList>(null);
    const finishOnce = useRef(false);
    const [stopVisible, setStopVisible] = useState(false);
    const [dontShowAgain, setDontShowAgain] = useState(false);

    const { cards, index, finished } = session;

    const scrollTo = useCallback(
        (i: number) => {
            try {
                listRef.current?.scrollToIndex({ index: i, animated: true });
            } catch {}
        },
        [],
    );

    // Reaching the result card finalizes the session (real data only).
    useEffect(() => {
        const last = cards[cards.length - 1];
        if (
            !finishOnce.current &&
            last?.type === 'result' &&
            session.index >= cards.length - 1 &&
            cards.length > 0 &&
            session.status === 'ready'
        ) {
            finishOnce.current = true;
            session.finish().catch(() => {});
        }
    }, [session.index, cards, session.status]);

    // Forward navigation is AUTHORIZED by the domain reducer, never by the
    // gesture itself: overscroll past unanswered required cards snaps back.
    const handleMomentumEnd = useCallback(
        (e: any) => {
            const y = e?.nativeEvent?.contentOffset?.y ?? 0;
            const target = Math.round(y / height);
            const at = authorizeStepIndex(
                { cards: session.cards, index: session.index, maxUnlocked: session.maxUnlocked, status: session.cardStatus },
                target,
            );
            if (at !== target) {
                scrollTo(at);
            }
            session.dispatch({ type: 'GOTO', index: target });
        },
        [session.cards, session.index, session.maxUnlocked, session.cardStatus, session.dispatch, height, scrollTo],
    );

    const handleAnswer = useCallback(
        (cardId: string, outcome: StepOutcome, userInput?: string, aiFeedback?: string, explanation?: string) => {
            session.answer(cardId, outcome, userInput, aiFeedback, explanation);
        },
        [session.answer],
    );

    const handleTestsDone = useCallback(
        (cardId: string, passed: number, total: number, skipped: number) => {
            const outcome: StepOutcome =
                passed >= total ? 'pass' : passed > 0 ? 'partial' : skipped > 0 ? 'unknown' : 'fail';
            // No synthetic answer text: the validated outcome is the evidence.
            session.answer(
                cardId,
                outcome,
                undefined,
                undefined,
                passed >= total ? undefined : `${passed}/${total} correct — review and retry.`,
            );
        },
        [session.answer],
    );

    const hobbyLabel = useMemo(() => {
        const h = session.hobby;
        if (!h) return '';
        return HOBBY_META[h]?.label ?? h;
    }, [session.hobby]);

    const objective = session.lesson?.learn.title ?? '';

    if (session.status === 'loading') {
        return (
            <SafeAreaView style={styles.center}>
                <ActivityIndicator size="large" color="#5BA3E6" />
            </SafeAreaView>
        );
    }

    if (session.status === 'error' || session.status === 'no-hobby' || cards.length === 0) {
        return (
            <SafeAreaView style={styles.center}>
                <Text style={styles.errorText}>Урок не найден. Попробуйте перезапустить сессию.</Text>
                <TouchableOpacity style={styles.exitButton} onPress={onExit} activeOpacity={0.8}>
                    <Text style={styles.exitText}>Назад</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            {/* Minimal chrome: objective · elapsed · pause · close */}
            <View style={styles.header}>
                <Text style={styles.headerTitle} numberOfLines={1}>
                    {hobbyLabel}
                    {objective ? ` · ${objective}` : ''}
                </Text>
                <TouchableOpacity
                    style={styles.timePill}
                    onPress={() => session.setPaused(!session.paused)}
                    activeOpacity={0.7}
                >
                    <SessionClock
                        paused={session.paused}
                        stopped={!!session.finished}
                        onTick={session.onTick}
                    />
                </TouchableOpacity>
                <TouchableOpacity style={styles.closeButton} onPress={() => setStopVisible(true)} activeOpacity={0.7}>
                    <Text style={styles.closeText}>×</Text>
                </TouchableOpacity>
            </View>
            <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.min(100, ((index + 1) / cards.length) * 100)}%` }]} />
            </View>

            <FlatList
                ref={listRef}
                testID="swipe-card-list"
                data={cards}
                keyExtractor={c => c.id}
                renderItem={({ item }) => (
                    <View style={{ height }}>
                        <LearningCardRenderer
                            card={item}
                            status={session.cardStatus[item.id] ?? { completed: false, attempts: 0 }}
                            hobbyId={session.hobby ?? ''}
                            hobbyEyebrow={hobbyLabel}
                            isPremium={isPremium}
                            result={finished}
                            resultContinueLabel={
                                session.nextAction ? `Далее: ${session.nextAction.title}` : 'Готово'
                            }
                            onResultContinue={() => {
                                if (session.nextAction && onContinueNext) {
                                    onContinueNext({
                                        taskId: session.nextAction.taskId,
                                        minutes: session.nextAction.minutes,
                                    });
                                } else {
                                    onExit();
                                }
                            }}
                            resultDoneLabel={session.nextAction ? 'Готово' : null}
                            onResultDone={() => onExit()}
                            onAnswer={handleAnswer}
                            onAnswerFeedback={session.answerFromFeedback}
                            onTestsDone={handleTestsDone}
                            onSolved={(cardId) => session.answer(cardId, 'pass', 'puzzle solved')}
                            onAdvance={() => scrollTo(Math.min(index + 1, cards.length - 1))}
                        />
                    </View>
                )}
                getItemLayout={(_, i) => ({ length: height, offset: height * i, index: i })}
                pagingEnabled
                snapToInterval={height}
                snapToAlignment="start"
                decelerationRate="fast"
                showsVerticalScrollIndicator={false}
                onMomentumScrollEnd={handleMomentumEnd}
                onViewableItemsChanged={({ viewableItems }) => {
                    const first = viewableItems[0]?.item;
                    if (first) session.dispatch({ type: 'VIEW', id: first.id });
                }}
                viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
                initialNumToRender={2}
                maxToRenderPerBatch={2}
                windowSize={3}
                removeClippedSubviews
            />

            <View style={styles.counter}>
                <Text style={styles.counterText}>
                    {index + 1} / {cards.length}
                </Text>
            </View>

            <StopConfirmationModal
                visible={stopVisible}
                dontShowAgainChecked={dontShowAgain}
                onToggleDontShowAgain={() => setDontShowAgain(!dontShowAgain)}
                onCancel={() => setStopVisible(false)}
                onConfirm={async () => {
                    setStopVisible(false);
                    await session.finish().catch(() => {});
                    onExit();
                }}
            />
        </SafeAreaView>
    );
};

const createStyles = (colors: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: '#EDF2F7',
        },
        center: {
            flex: 1,
            backgroundColor: '#EDF2F7',
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: scale(32),
        },
        errorText: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(17),
            color: '#1A253C',
            textAlign: 'center',
            marginBottom: scale(20),
        },
        exitButton: {
            backgroundColor: '#0F2147',
            borderRadius: 9999,
            paddingVertical: scale(14),
            paddingHorizontal: scale(40),
        },
        exitText: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(16),
            color: '#FFFFFF',
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: scale(16),
            paddingTop: scale(8),
            paddingBottom: scale(6),
            gap: scale(8),
        },
        headerTitle: {
            flex: 1,
            fontFamily: fonts.heading.bold,
            fontSize: scale(15),
            color: '#1A253C',
        },
        timePill: {
            backgroundColor: 'rgba(91, 163, 230, 0.12)',
            borderRadius: scale(16),
            paddingHorizontal: scale(14),
            paddingVertical: scale(6),
        },
        timeText: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(14),
            color: '#2B5B84',
        },
        closeButton: {
            width: scale(32),
            height: scale(32),
            borderRadius: scale(16),
            backgroundColor: 'rgba(15, 33, 71, 0.08)',
            justifyContent: 'center',
            alignItems: 'center',
        },
        closeText: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(20),
            lineHeight: scale(22),
            color: '#1A253C',
        },
        progressTrack: {
            height: scale(3),
            backgroundColor: 'rgba(15, 33, 71, 0.1)',
        },
        progressFill: {
            height: '100%',
            backgroundColor: '#37A0EF',
        },
        counter: {
            position: 'absolute',
            bottom: scale(10),
            alignSelf: 'center',
            backgroundColor: 'rgba(15, 33, 71, 0.55)',
            borderRadius: scale(12),
            paddingHorizontal: scale(10),
            paddingVertical: scale(4),
        },
        counterText: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(12),
            color: '#FFFFFF',
        },
    });

export default SwipeLearningSession;
