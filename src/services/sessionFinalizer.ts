import { useTaskStore } from '../store/taskStore';
import { useHobbyTimeStore } from '../store/hobbyTimeStore';
import { sessionService } from '../services/supabase/sessions';
import type { HobbyId, LessonContent } from '../data/lessonContent';
import { getLessonByDay, HOBBY_META } from '../data/lessonContent';
import type { SessionBlueprint } from '../domain/sessions/sessionBlueprint';
import type { SessionKind, SessionOrigin } from '../domain/sessions/sessionBlueprint';
import { evaluateSession } from '../domain/sessions/outcomePolicy';
import { findNextIncompleteTask } from '../domain/sessions/sessionCompletion';
import { buildProgressionDecision } from '../domain/sessions/progressionPolicy';
import type { LearningStrategy, ProgressionScope } from '../domain/sessions/sessionIntent';
import type { ProgressionDecision } from '../domain/sessions/progressionPolicy';
import { buildResultData } from '../domain/sessions/learningCards';
import type { CardStatus, LearningCard, SessionResultData } from '../domain/sessions/learningCards';
import {
    buildSessionCompletedEvent,
    buildTaskCompletedEvent,
} from '../domain/sessions/learningEvents';
import { appendLearningEvent } from './learningEventRepository';
import { applySessionProgression } from './sessionStepEffects';

export interface FinalizeSessionInput {
    sessionId: string;
    userId?: string;
    hobby: HobbyId;
    lesson: LessonContent;
    kind: SessionKind;
    origin: SessionOrigin;
    /** Curriculum scope: targeted sessions never move frontier/tasks. */
    scope: ProgressionScope;
    strategy?: LearningStrategy;
    reasonCode?: string | null;
    blueprint: SessionBlueprint;
    /** Explicit recommendation-time skill (preferred over re-derivation). */
    targetSkillKey?: string | null;
    cards: LearningCard[];
    status: Record<string, CardStatus>;
    /** DailyPlan task this session works toward (curriculum scope only). */
    targetTaskId?: string | null;
    targetTaskTitle?: string | null;
    elapsedSeconds: number;
    chessSolved: boolean;
}

export interface FinalizeSessionResult {
    sessionId: string;
    decision: ProgressionDecision;
    evaluation: ReturnType<typeof evaluateSession>;
    taskCompleted: boolean;
    advancedDay: boolean;
    result: SessionResultData;
    nextAction: { taskId: string; minutes: number; title: string } | null;
}

/**
 * Authoritative swipe-session finalizer — the ONLY place that may run
 * task completion, curriculum advance, session counting, goal progression
 * and chess credit for a swipe session.
 *
 * Exactly-once per sessionId, even under concurrent/duplicate calls:
 * - in-flight calls share one promise (no double effects while running);
 * - settled sessions return the stored result (no re-execution ever).
 * Event appends are idempotent by deterministic id as a second backstop.
 */
const inFlight = new Map<string, Promise<FinalizeSessionResult>>();
const settled = new Map<string, FinalizeSessionResult>();

export function finalizeSwipeSession(input: FinalizeSessionInput): Promise<FinalizeSessionResult> {
    const existing = inFlight.get(input.sessionId) ?? settled.get(input.sessionId);
    if (existing) return Promise.resolve(existing);
    const running = runFinalization(input).then(
        result => {
            inFlight.delete(input.sessionId);
            settled.set(input.sessionId, result);
            return result;
        },
        err => {
            inFlight.delete(input.sessionId);
            throw err;
        },
    );
    inFlight.set(input.sessionId, running);
    return running;
}

/** Test/dev only: drop memoized finalizations. Never called from product UI. */
export function __resetFinalizerForTests(): void {
    inFlight.clear();
    settled.clear();
}

async function runFinalization(input: FinalizeSessionInput): Promise<FinalizeSessionResult> {
    const { sessionId, userId, hobby, lesson, kind, origin, scope, blueprint, cards, status } = input;
    // Explicit recommendation-time skill wins over re-derivation so the
    // event preserves what the recommendation knew (catalog drift-safe).
    const explicitSkill = input.targetSkillKey && input.targetSkillKey.length > 0 ? input.targetSkillKey : null;
    const evaluation = evaluateSession(cards, status);
    // Scope is enforced here, not trusted from any single caller: only
    // curriculum scope may touch the frontier or an unrelated task.
    const targetTaskId = scope === 'curriculum' && kind === 'structured' ? (input.targetTaskId ?? null) : null;
    const decision = buildProgressionDecision({
        kind,
        evaluation,
        blueprint,
        hasTargetTask: !!targetTaskId,
        scope,
    });

    let taskCompleted = false;
    if (decision.completeDailyTask && targetTaskId && userId) {
        try {
            await useTaskStore.getState().completeTask(userId, targetTaskId);
            taskCompleted = true;
            appendLearningEvent(
                buildTaskCompletedEvent({
                    sessionId,
                    userId,
                    hobbyId: hobby,
                    lessonId: lesson.id,
                    lessonDay: lesson.day,
                    explicitSkillKey: explicitSkill,
                    taskId: targetTaskId,
                    sessionKind: kind,
                    origin,
                    strategy: input.strategy,
                    reasonCode: input.reasonCode ?? null,
                    outcome: evaluation === 'pass' ? 'pass' : 'partial',
                }),
            );
        } catch (err) {
            console.error('[sessionFinalizer] task completion failed:', err);
        }
    }

    let advancedDay = false;
    try {
        const res = applySessionProgression({ lesson, decision, chessSolved: input.chessSolved });
        advancedDay = res.advancedDay;
    } catch (err) {
        console.error('[sessionFinalizer] progression failed:', err);
    }

    const durationSeconds = Math.max(0, Math.floor(input.elapsedSeconds));
    try {
        if (userId) {
            await sessionService.saveSession(userId, hobby, durationSeconds, {
                tasksCompleted: taskCompleted && input.targetTaskId ? [input.targetTaskId] : [],
            });
        }
    } catch (err) {
        console.error('[sessionFinalizer] session save failed:', err);
    }
    try {
        if (durationSeconds > 0) {
            const hobbyStore = useHobbyTimeStore.getState();
            if (!hobbyStore.userCreatedDate) hobbyStore.setUserCreatedDate(new Date().toISOString());
            hobbyStore.addHobbyTime(durationSeconds);
        }
    } catch {}

    appendLearningEvent(
        buildSessionCompletedEvent({
            sessionId,
            userId,
            hobbyId: hobby,
            lessonId: lesson.id,
            lessonDay: lesson.day,
            explicitSkillKey: explicitSkill,
            taskId: targetTaskId ?? undefined,
            sessionKind: kind,
            origin,
            strategy: input.strategy,
            reasonCode: input.reasonCode ?? null,
            outcome: evaluation === 'non_rewarding' ? 'unknown' : evaluation,
            outcomeValue: evaluation === 'pass' ? 1 : evaluation === 'partial' ? 0.5 : 0,
        }),
    );

    const nextTitle =
        kind === 'discovery' ? null : (getLessonByDay(hobby, lesson.day + 1)?.learn.title ?? null);
    const afterTasks = useTaskStore.getState().dailyTasks;
    const nextTask = kind === 'discovery' ? null : findNextIncompleteTask(afterTasks);
    const nextAction =
        nextTask?.id != null
            ? {
                  taskId: nextTask.id,
                  minutes:
                      nextTask.duration_minutes && nextTask.duration_minutes > 0
                          ? nextTask.duration_minutes
                          : 15,
                  title: nextTask.title,
              }
            : null;

    const result = buildResultData({
        kind,
        objectiveTitle: lesson.learn.title,
        hobbyLabel: HOBBY_META[hobby]?.label ?? hobby,
        minutesFocused: durationSeconds / 60,
        status,
        cards,
        taskCompleted,
        taskTitle: input.targetTaskTitle ?? null,
        nextTitle,
    });

    return { sessionId, decision, evaluation, taskCompleted, advancedDay, result, nextAction };
}
