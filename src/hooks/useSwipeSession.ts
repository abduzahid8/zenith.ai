import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTaskStore } from '../store/taskStore';
import { useAuthStore } from '../store/authStore';
import { useUserProfileStore } from '../store/userProfileStore';
import { useGamificationStore } from '../store/gamificationStore';
import { useLanguageStore } from '../store/languageStore';
import type { HobbyId, LessonContent } from '../data/lessonContent';
import { buildSessionBlueprint } from '../domain/sessions/sessionBlueprint';
import type { SessionKind, SessionOrigin, StepOutcome } from '../domain/sessions/sessionBlueprint';
import { parseVerdict } from '../domain/sessions/sessionBlueprint';
import {
    buildLearningCards,
    flowTransition,
    initialFlowState,
} from '../domain/sessions/learningCards';
import type { FlowEvent, FlowState, SessionResultData } from '../domain/sessions/learningCards';
import { buildAttemptEvent, buildExposureEvent } from '../domain/sessions/learningEvents';
import type { LearningEvent } from '../domain/sessions/learningEvents';
import type { MasteryOutcome } from '../domain/sessions/outcomePolicy';
import { defaultScopeForKind } from '../domain/sessions/sessionIntent';
import type { LearningStrategy, ProgressionScope } from '../domain/sessions/sessionIntent';
import { appendLearningEvent } from '../services/learningEventRepository';
import { loadSessionLesson } from '../services/sessionLesson';
import { recordAttemptArtifact, saveRecallArtifact } from '../services/sessionStepEffects';
import { finalizeSwipeSession } from '../services/sessionFinalizer';

export interface SwipeSessionInput {
    kind: SessionKind;
    origin: SessionOrigin;
    taskId?: string | null;
    discoveryId?: string | null;
    minutes: number;
    skillDay?: number | null;
    hobbyId?: string | null;
    /** Execution contract from the recommendation (defaults by kind). */
    scope?: ProgressionScope;
    strategy?: LearningStrategy;
    reasonCode?: string | null;
}

export type SwipeStatus = 'loading' | 'ready' | 'error' | 'no-hobby';

export interface SwipeNextAction {
    taskId: string;
    minutes: number;
    title: string;
}

let sessionSequence = 0;

/**
 * Swipe session controller — presentation state over the existing engine.
 *
 * Truth model:
 * - answers persist attempt artifacts + append attempt events immediately;
 *   they NEVER advance curriculum, sessions, goals or tasks.
 * - finish() evaluates required cards once, then runs progression exactly
 *   once for eligible sessions (pass/partial) and completes the DailyPlan
 *   task only under the canonical task-completion policy.
 */
export function useSwipeSession(input: SwipeSessionInput) {
    const { kind, origin, taskId, discoveryId, minutes } = input;
    const selectedHobby = useUserProfileStore(s => s.selectedHobby);
    const isPremium = useUserProfileStore(s => s.isPremium);
    const user = useAuthStore(s => s.user);
    const dailyTasks = useTaskStore(s => s.dailyTasks);
    const language = useLanguageStore(s => s.language);

    const hobby = (input.hobbyId ?? selectedHobby) as HobbyId | null;

    // Stable per-mount session identity (survives rerenders/retries).
    const sessionIdRef = useRef<string | null>(null);
    if (!sessionIdRef.current) {
        sessionIdRef.current = `sess_${Date.now().toString(36)}_${(sessionSequence++).toString(36)}`;
    }
    const startedRef = useRef(false);
    const exposedRef = useRef<Set<string>>(new Set());
    const chessSolvedRef = useRef(false);

    const [lesson, setLesson] = useState<LessonContent | null>(null);
    const [status, setStatus] = useState<SwipeStatus>('loading');
    const [flow, setFlow] = useState<FlowState | null>(null);
    const [elapsed, setElapsed] = useState(0);
    const [paused, setPaused] = useState(false);
    const [finished, setFinished] = useState<SessionResultData | null>(null);
    const [finishing, setFinishing] = useState(false);
    const [nextAction, setNextAction] = useState<SwipeNextAction | null>(null);

    const task = useMemo(
        () => (taskId ? dailyTasks.find(t => t.id === taskId) ?? null : null),
        [taskId, dailyTasks],
    );

    const blueprint = useMemo(
        () =>
            buildSessionBlueprint({
                minutes,
                taskTitle: task?.title ?? null,
                lessonTitle: lesson?.learn.title ?? null,
                hasTests: (lesson?.tests?.length ?? 0) > 0,
                kind: kind === 'certificate_review' ? 'certificate_review' : undefined,
                reviewOnly: kind !== 'structured',
            }),
        [minutes, task?.title, lesson, kind],
    );

    const cards = useMemo(() => {
        if (!lesson) return [];
        return buildLearningCards({
            blueprint,
            lesson,
            kind,
            minutes,
            isPremium,
            language,
            strategy: input.strategy ?? 'continue_curriculum',
        });
    }, [blueprint, lesson, kind, minutes, isPremium, language, input.strategy]);

    // Load lesson + start gamification session immediately (no idle screen).
    useEffect(() => {
        if (!hobby) {
            setStatus('no-hobby');
            return;
        }
        if (startedRef.current) return;
        startedRef.current = true;
        let cancelled = false;
        (async () => {
            try {
                const g = useGamificationStore.getState();
                const day = input.skillDay ?? g.currentDay[hobby] ?? 1;
                try {
                    g.startSession(hobby);
                } catch {}
                const loaded = await loadSessionLesson({
                    hobby,
                    day,
                    artifacts: g.artifacts,
                    discoveryId: discoveryId ?? null,
                    discoveryLanguage: language,
                });
                if (cancelled) return;
                if (!loaded) {
                    setStatus('error');
                    return;
                }
                setLesson(loaded);
                setStatus('ready');
            } catch (err) {
                console.error('[useSwipeSession] load failed:', err);
                if (!cancelled) setStatus('error');
            }
        })();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hobby]);

    useEffect(() => {
        if (status === 'ready' && cards.length > 0 && !flow) {
            setFlow(initialFlowState(cards));
        }
    }, [status, cards, flow]);

    // Elapsed clock starts immediately; pause only freezes counting.
    useEffect(() => {
        if (status !== 'ready' || paused || finished) return;
        const id = setInterval(() => setElapsed(e => e + 1), 1000);
        return () => clearInterval(id);
    }, [status, paused, finished]);

    const emit = useCallback((event: LearningEvent) => {
        try {
            appendLearningEvent(event);
        } catch (err) {
            console.error('[useSwipeSession] event append failed:', err);
        }
    }, []);

    const targetOf = useCallback(
        () => ({
            lessonId: lesson?.id,
            lessonDay: lesson?.day ?? null,
            taskId: kind === 'structured' ? (taskId ?? undefined) : undefined,
        }),
        [lesson, kind, taskId],
    );

    const dispatch = useCallback(
        (event: FlowEvent) => {
            if (event.type === 'VIEW' && lesson && hobby && sessionIdRef.current) {
                const card = flow?.cards.find(c => c.id === event.id);
                if (
                    card &&
                    (card.type === 'concept' || card.type === 'example' || card.type === 'key_idea') &&
                    !exposedRef.current.has(card.id)
                ) {
                    exposedRef.current.add(card.id);
                    const target = targetOf();
                    emit(
                        buildExposureEvent({
                            sessionId: sessionIdRef.current,
                            userId: user?.id,
                            hobbyId: hobby,
                            lessonId: target.lessonId,
                            lessonDay: target.lessonDay,
                            taskId: target.taskId,
                            cardId: card.id,
                            phase: card.phase,
                            sessionKind: kind,
                            origin,
                        }),
                    );
                }
            }
            setFlow(prev => {
                if (!prev) return prev;
                return flowTransition(prev, event, blueprint.maxRetries);
            });
        },
        [blueprint.maxRetries, lesson, hobby, flow?.cards, kind, origin, user?.id, targetOf, emit],
    );

    /** Record an interactive answer: artifact + attempt event now, never progression. */
    const answer = useCallback(
        (cardId: string, outcome: StepOutcome, userInput?: string, aiFeedback?: string, explanation?: string) => {
            const card = flow?.cards.find(c => c.id === cardId);
            const sessionId = sessionIdRef.current;
            if (card && lesson && hobby && sessionId) {
                const attemptNo = (flow?.status[cardId]?.attempts ?? 0) + 1;
                let artifactRef: string | undefined;
                if (card.sourceStepId === 'recall') {
                    if (userInput) {
                        artifactRef = saveRecallArtifact(lesson, userInput, aiFeedback) ?? undefined;
                    }
                } else if (card.sourceStepId && card.sourceStepId !== 'tests') {
                    if (userInput || aiFeedback) {
                        artifactRef =
                            recordAttemptArtifact(lesson, card.sourceStepId, userInput, aiFeedback) ?? undefined;
                    }
                }
                if (card.task?.type === 'chess_puzzle' && outcome === 'pass') {
                    chessSolvedRef.current = true;
                }
                const target = targetOf();
                emit(
                    buildAttemptEvent({
                        sessionId,
                        userId: user?.id,
                        hobbyId: hobby,
                        lessonId: target.lessonId,
                        lessonDay: target.lessonDay,
                        taskId: target.taskId,
                        cardId,
                        attemptNo,
                        phase: card.phase,
                        sessionKind: kind,
                        origin,
                        outcome: outcome as MasteryOutcome,
                        artifactRef,
                        cardType: card.type,
                    }),
                );
            }
            dispatch({ type: 'ANSWER', id: cardId, outcome, explanation });
        },
        [flow?.cards, flow?.status, lesson, hobby, kind, origin, user?.id, targetOf, emit, dispatch],
    );

    const answerFromFeedback = useCallback(
        (cardId: string, userInput: string, aiFeedback: string) => {
            answer(cardId, parseVerdict(aiFeedback), userInput, aiFeedback, aiFeedback);
        },
        [answer],
    );

    // Promise guard: concurrent finish() calls share one finalization.
    // The finalizer additionally memoizes per sessionId (survives remounts).
    const finalizePromiseRef = useRef<Promise<SessionResultData | null> | null>(null);

    const finish = useCallback((): Promise<SessionResultData | null> => {
        if (finalizePromiseRef.current) return finalizePromiseRef.current;
        const sessionId = sessionIdRef.current;
        if (!flow || !lesson || !hobby || !sessionId) return Promise.resolve(finished);
        setFinishing(true);
        const running = finalizeSwipeSession({
            sessionId,
            userId: user?.id,
            hobby,
            lesson,
            kind,
            origin,
            scope: input.scope ?? defaultScopeForKind(kind),
            strategy: input.strategy ?? 'continue_curriculum',
            reasonCode: input.reasonCode ?? null,
            blueprint,
            cards: flow.cards,
            status: flow.status,
            targetTaskId: kind === 'structured' ? (taskId ?? null) : null,
            targetTaskTitle: task?.title ?? null,
            elapsedSeconds: elapsed,
            chessSolved: chessSolvedRef.current,
        }).then(
            ({ result, nextAction: next }) => {
                setNextAction(next);
                setFinished(result);
                return result;
            },
            err => {
                console.error('[useSwipeSession] finish failed:', err);
                return finished;
            },
        ).finally(() => {
            setFinishing(false);
        });
        finalizePromiseRef.current = running;
        return running;
    }, [flow, lesson, hobby, finished, kind, origin, blueprint, taskId, task?.title, user, elapsed]);

    const elapsedLabel = useMemo(() => {
        const m = Math.floor(elapsed / 60);
        const s = elapsed % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }, [elapsed]);

    return {
        status,
        hobby,
        lesson,
        blueprint,
        cards: flow?.cards ?? [],
        index: flow?.index ?? 0,
        maxUnlocked: flow?.maxUnlocked ?? 0,
        cardStatus: flow?.status ?? {},
        elapsed,
        elapsedLabel,
        paused,
        setPaused,
        finishing,
        finished,
        nextAction,
        dispatch,
        answer,
        answerFromFeedback,
        finish,
    };
}

export default useSwipeSession;
