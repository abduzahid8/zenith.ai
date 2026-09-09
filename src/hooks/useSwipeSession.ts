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
import { resolveCompletionPlan } from '../domain/sessions/sessionCompletion';
import {
    aggregateOutcome,
    buildLearningCards,
    buildResultData,
    flowTransition,
    initialFlowState,
} from '../domain/sessions/learningCards';
import type { FlowEvent, FlowState, SessionResultData } from '../domain/sessions/learningCards';
import { loadSessionLesson } from '../services/sessionLesson';
import { applyStepEffects, saveRecallArtifact } from '../services/sessionStepEffects';

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

/**
 * Swipe session controller — presentation state over the existing engine.
 * Lesson loading, blueprints, completion rules, artifacts, goals, session
 * persistence all reuse current systems; this hook only sequences cards.
 */
export function useSwipeSession(input: SwipeSessionInput) {
    const { kind, taskId, discoveryId, minutes } = input;
    const selectedHobby = useUserProfileStore(s => s.selectedHobby);
    const isPremium = useUserProfileStore(s => s.isPremium);
    const user = useAuthStore(s => s.user);
    const dailyTasks = useTaskStore(s => s.dailyTasks);
    const language = useLanguageStore(s => s.language);
    const startedRef = useRef(false);

    const hobby = (input.hobbyId ?? selectedHobby) as HobbyId | null;

    const [lesson, setLesson] = useState<LessonContent | null>(null);
    const [status, setStatus] = useState<SwipeStatus>('loading');
    const [flow, setFlow] = useState<FlowState | null>(null);
    const [elapsed, setElapsed] = useState(0);
    const [paused, setPaused] = useState(false);
    const [finished, setFinished] = useState<SessionResultData | null>(null);
    const [finishing, setFinishing] = useState(false);
    const notifiedLearnRef = useRef(false);

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

    const dispatch = useCallback(
        (event: FlowEvent) => {
            setFlow(prev => {
                if (!prev) return prev;
                const next = flowTransition(prev, event, blueprint.maxRetries);
                // Leaving the understand section completes the legacy learn step.
                if (!notifiedLearnRef.current && lesson) {
                    const lastUnderstand = prev.cards.reduce(
                        (acc, c, i) => (c.phase === 'understand' ? i : acc),
                        -1,
                    );
                    if (next.index > lastUnderstand && lastUnderstand >= 0) {
                        notifiedLearnRef.current = true;
                        try {
                            applyStepEffects('learn', lesson, { isPremium });
                        } catch {}
                    }
                }
                return next;
            });
        },
        [blueprint.maxRetries, lesson, isPremium],
    );

    /** Record an interactive answer: outcome + side effects + flow advance. */
    const answer = useCallback(
        (cardId: string, outcome: StepOutcome, userInput?: string, aiFeedback?: string, explanation?: string) => {
            const card = flow?.cards.find(c => c.id === cardId);
            // Skip (no input, no feedback) advances without fabricating evidence.
            const hasEvidence = !!(userInput || aiFeedback);
            if (card?.sourceStepId && card.sourceStepId !== 'recall' && card.sourceStepId !== 'tests' && lesson && hasEvidence) {
                try {
                    applyStepEffects(card.sourceStepId, lesson, { userInput, aiFeedback, isPremium });
                } catch {}
            } else if (card?.sourceStepId === 'recall' && lesson && userInput) {
                // Recall attempts are light formative artifacts (legacy tests
                // parity: no goal actions, no day advance from a recall).
                try {
                    saveRecallArtifact(lesson, userInput, aiFeedback);
                } catch {}
            }
            dispatch({ type: 'ANSWER', id: cardId, outcome, explanation });
        },
        [flow?.cards, lesson, isPremium, dispatch],
    );

    const answerFromFeedback = useCallback(
        (cardId: string, userInput: string, aiFeedback: string) => {
            answer(cardId, parseVerdict(aiFeedback), userInput, aiFeedback, aiFeedback);
        },
        [answer],
    );

    const finish = useCallback(async (): Promise<SessionResultData | null> => {
        if (!flow || !lesson || !hobby || finishing) return finished;
        setFinishing(true);
        try {
            const outcome = aggregateOutcome(Object.fromEntries(Object.entries(flow.status)));
            const targetTaskId = kind === 'structured' ? (taskId ?? null) : null;
            const plan = resolveCompletionPlan({
                blueprint,
                outcome,
                tasks: dailyTasks,
                targetTaskId,
            });
            let taskCompleted = false;
            if (plan.completeTask && targetTaskId && user?.id) {
                try {
                    await useTaskStore.getState().completeTask(user.id, targetTaskId);
                    taskCompleted = true;
                } catch (err) {
                    console.error('[useSwipeSession] task completion failed:', err);
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
            const nextTitle =
                kind === 'discovery'
                    ? null
                    : (getLessonByDay(hobby, lesson.day + 1)?.learn.title ?? null);
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
    }, [flow, lesson, hobby, finishing, finished, kind, blueprint, dailyTasks, taskId, task?.title, user, elapsed]);

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
        dispatch,
        answer,
        answerFromFeedback,
        finish,
    };
}

export default useSwipeSession;
