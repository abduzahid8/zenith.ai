import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTaskStore } from '../store/taskStore';
import { useAuthStore } from '../store/authStore';
import { useUserProfileStore } from '../store/userProfileStore';
import { useGamificationStore } from '../store/gamificationStore';
import { useLanguageStore } from '../store/languageStore';
import { sessionService } from '../services/supabase/sessions';
import { useHobbyTimeStore } from '../store/hobbyTimeStore';
import type { HobbyId, LessonContent } from '../data/lessonContent';
import { getLessonByDay, HOBBY_META } from '../data/lessonContent';
import { buildSessionBlueprint } from '../domain/sessions/sessionBlueprint';
import type { SessionKind, SessionOrigin, StepOutcome } from '../domain/sessions/sessionBlueprint';
import { parseVerdict } from '../domain/sessions/sessionBlueprint';
import { findNextIncompleteTask } from '../domain/sessions/sessionCompletion';
import {
    canCompleteStructuredTask,
    evaluateSession,
    isRewardingEvaluation,
} from '../domain/sessions/outcomePolicy';
import type { MasteryOutcome } from '../domain/sessions/outcomePolicy';
import {
    buildLearningCards,
    buildResultData,
    flowTransition,
    initialFlowState,
} from '../domain/sessions/learningCards';
import type { FlowEvent, FlowState, SessionResultData } from '../domain/sessions/learningCards';
import { buildAttemptEvent } from '../domain/sessions/learningEvents';
import type { LearningEvent } from '../domain/sessions/learningEvents';
import { appendLearningEvent } from '../services/learningEventRepository';
import { loadSessionLesson } from '../services/sessionLesson';
import { applySessionProgression, recordAttemptArtifact, saveRecallArtifact } from '../services/sessionStepEffects';

export interface SwipeSessionInput {
    kind: SessionKind;
    origin: SessionOrigin;
    taskId?: string | null;
    discoveryId?: string | null;
    minutes: number;
    skillDay?: number | null;
    hobbyId?: string | null;
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
        return buildLearningCards({ blueprint, lesson, kind, minutes, isPremium, language });
    }, [blueprint, lesson, kind, minutes, isPremium, language]);

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
                    emit({
                        schemaVersion: 1,
                        id: `${sessionIdRef.current}:concept_exposed:${card.id}:0`,
                        sessionId: sessionIdRef.current,
                        userId: user?.id,
                        hobbyId: hobby,
                        lessonId: target.lessonId,
                        curriculumDay: target.lessonDay ?? undefined,
                        taskId: target.taskId,
                        cardId: card.id,
                        attemptNo: 0,
                        phase: card.phase,
                        sessionKind: kind,
                        origin,
                        source: kind === 'discovery' ? 'discovery' : kind === 'certificate_review' ? 'quick_bite' : 'structured_session',
                        eventType: 'concept_exposed',
                        evidenceStrength: 'none',
                        occurredAt: new Date().toISOString(),
                    });
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

    const finish = useCallback(async (): Promise<SessionResultData | null> => {
        const sessionId = sessionIdRef.current;
        if (!flow || !lesson || !hobby || !sessionId || finishing || finished) return finished;
        setFinishing(true);
        try {
            // Canonical evaluation over required cards (retries included).
            const evaluation = evaluateSession(flow.cards, flow.status);
            const eligible = isRewardingEvaluation(evaluation);

            // Task completion under the canonical policy (never on
            // unknown/skipped/fail; partial only for non-strict sessions).
            const targetTaskId = kind === 'structured' ? (taskId ?? null) : null;
            const evalOutcome = evaluation === 'pass' ? 'pass' : evaluation === 'partial' ? 'partial' : 'fail';
            let taskCompleted = false;
            if (
                eligible &&
                blueprint.countsAsFullCompletion &&
                canCompleteStructuredTask(evalOutcome, blueprint) &&
                targetTaskId &&
                user?.id
            ) {
                try {
                    await useTaskStore.getState().completeTask(user.id, targetTaskId);
                    taskCompleted = true;
                    emit({
                        schemaVersion: 1,
                        id: `${sessionId}:task_completed:${targetTaskId}:0`,
                        sessionId,
                        userId: user.id,
                        hobbyId: hobby,
                        lessonId: lesson.id,
                        curriculumDay: lesson.day,
                        taskId: targetTaskId,
                        sessionKind: kind,
                        origin,
                        source: 'daily_task',
                        eventType: 'task_completed',
                        outcome: evalOutcome,
                        outcomeValue: evalOutcome === 'pass' ? 1 : 0.5,
                        evidenceStrength: 'medium',
                        occurredAt: new Date().toISOString(),
                    });
                } catch (err) {
                    console.error('[useSwipeSession] task completion failed:', err);
                }
            }

            // Exactly-once validated progression (fail sends only a
            // difficulty signal; non-rewarding runs nothing).
            if (eligible || evaluation === 'fail') {
                try {
                    applySessionProgression({ lesson, evaluation, chessSolved: chessSolvedRef.current });
                } catch (err) {
                    console.error('[useSwipeSession] progression failed:', err);
                }
            }

            const durationSeconds = elapsed;
            try {
                if (user?.id) {
                    await sessionService.saveSession(user.id, hobby, durationSeconds, {
                        tasksCompleted: taskCompleted && targetTaskId ? [targetTaskId] : [],
                    });
                }
            } catch (err) {
                console.error('[useSwipeSession] session save failed:', err);
            }
            try {
                if (durationSeconds > 0) {
                    const hobbyStore = useHobbyTimeStore.getState();
                    if (!hobbyStore.userCreatedDate) hobbyStore.setUserCreatedDate(new Date().toISOString());
                    hobbyStore.addHobbyTime(durationSeconds);
                }
            } catch {}

            emit({
                schemaVersion: 1,
                id: `${sessionId}:session_completed:-:0`,
                sessionId,
                userId: user?.id,
                hobbyId: hobby,
                lessonId: lesson.id,
                curriculumDay: lesson.day,
                taskId: targetTaskId ?? undefined,
                sessionKind: kind,
                origin,
                source:
                    kind === 'discovery'
                        ? 'discovery'
                        : kind === 'certificate_review'
                          ? 'quick_bite'
                          : 'structured_session',
                eventType: 'session_completed',
                outcome: evaluation === 'non_rewarding' ? 'unknown' : evaluation,
                outcomeValue: evaluation === 'pass' ? 1 : evaluation === 'partial' ? 0.5 : 0,
                evidenceStrength: 'none',
                occurredAt: new Date().toISOString(),
            });

            const nextTitle =
                kind === 'discovery' ? null : (getLessonByDay(hobby, lesson.day + 1)?.learn.title ?? null);
            // One obvious next step: the next real open task (read AFTER
            // completion so the just-finished task is excluded). Never invented.
            const afterTasks = useTaskStore.getState().dailyTasks;
            const nextTask = kind === 'discovery' ? null : findNextIncompleteTask(afterTasks);
            if (nextTask?.id) {
                const mins =
                    nextTask.duration_minutes && nextTask.duration_minutes > 0 ? nextTask.duration_minutes : 15;
                setNextAction({ taskId: nextTask.id, minutes: mins, title: nextTask.title });
            } else {
                setNextAction(null);
            }
            const data = buildResultData({
                kind,
                objectiveTitle: lesson.learn.title,
                hobbyLabel: HOBBY_META[hobby]?.label ?? hobby,
                minutesFocused: durationSeconds / 60,
                status: flow.status,
                cards: flow.cards,
                taskCompleted,
                taskTitle: task?.title ?? null,
                nextTitle,
            });
            setFinished(data);
            return data;
        } finally {
            setFinishing(false);
        }
    }, [
        flow,
        lesson,
        hobby,
        finishing,
        finished,
        kind,
        origin,
        blueprint,
        taskId,
        task?.title,
        user,
        elapsed,
        emit,
    ]);

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
