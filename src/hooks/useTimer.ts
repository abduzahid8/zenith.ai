import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Animated, Easing, AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { scale } from '../constants';
import { SessionTask } from '../components/session/TaskDrawer';
import { ChatMessage, aiService } from '../services/ai';
import { useTaskStore } from '../store/taskStore';
import { useAuthStore } from '../store/authStore';
import { useUserProfileStore } from '../store/userProfileStore';
import { useHobbyTimeStore } from '../store/hobbyTimeStore';
import { sessionService } from '../services/supabase/sessions';
import { useT, useLanguageStore } from '../store/languageStore';
import { getMaxTasksPerDay } from '../domain/tasks/rules';
import { useGamificationStore } from '../store/gamificationStore';
import { HobbyId, LessonContent } from '../data/lessonContent';
import { buildDiscoveryLesson } from '../domain/sessions/discoveryBank';
import {
    buildSessionBlueprint,
    normalizeKind,
    normalizeOrigin,
    SessionBlueprint,
    SessionKind,
    SessionOrigin,
    SessionStepId,
    StepOutcome,
} from '../domain/sessions/sessionBlueprint';
import { isLocalOnlyTaskId } from '../utils/e2eBypass';
import { resolveCompletionPlan } from '../domain/sessions/sessionCompletion';
import { captureSkillSnapshot, diffSkillSnapshot, SessionDelta, SkillSnapshot } from '../services/sessionEvidence';


export type TimerStatus = 'idle' | 'running' | 'paused';

const TOTAL_TIME = 30 * 60; // 30 minutes
const STORAGE_KEY_PREF = 'session_stop_confirm_pref';
const STORAGE_KEY_START_TS = 'session_timer_start_ts';
const ENGINE_TYPES_ORDER = ['theory', 'practice', 'analysis', 'puzzles'];

export interface UseTimerOptions {
    onAllTasksDone?: (startAnyway: () => void) => void;
    /** Timebox for this session (minutes). Drives the blueprint + timer. */
    timeboxMinutes?: number;
    /** Daily-plan task this session proves. Auto-completed only on rewarded outcome. */
    targetTaskId?: string | null;
    /** Discovery topic id — runs a lightweight review-only session, never progression. */
    discoveryId?: string | null;
    /**
     * Curriculum day override for skill-targeted review (certificate bites):
     * loads that week's lesson instead of the frontier day, always review-only.
     */
    skillDay?: number | null;
    /** WHAT the session is — completion behavior depends only on this. */
    kind?: SessionKind | string;
    /** Entry point — drives completion return routing, never the engine. */
    origin?: SessionOrigin | string;
}

export function useTimer(options: UseTimerOptions = {}) {
    const { onAllTasksDone } = options;
    const timeboxMinutes = Math.max(1, Math.floor(options.timeboxMinutes ?? 30));
    const targetTaskId = options.targetTaskId ?? null;
    const discoveryId = options.discoveryId ?? null;
    const skillDay =
        typeof options.skillDay === 'number' && Number.isFinite(options.skillDay) && options.skillDay >= 1 && options.skillDay <= 28
            ? Math.floor(options.skillDay)
            : null;
    const sessionKind: SessionKind = normalizeKind(options.kind, discoveryId ? 'discovery' : 'structured');
    const origin: SessionOrigin = normalizeOrigin(options.origin);
    const { dailyTasks, completeTask } = useTaskStore();
    const user = useAuthStore(s => s.user);
    const { selectedHobby, isPremium } = useUserProfileStore();
    useHobbyTimeStore(); // subscribed for potential future reactivity; mutations use getState() directly
    const t = useT();

    // --- Gamification State ---
    const gamificationStore = useGamificationStore();
    const [activeStep, setActiveStep] = useState<string>('learn');
    const [currentLesson, setCurrentLesson] = useState<LessonContent | null>(null);
    const [isLoadingLesson, setIsLoadingLesson] = useState(false);

    const loadLessonForSession = useCallback(async () => {
        const hobby = selectedHobby as HobbyId;
        if (!hobby) return;

        // Discovery topics carry their own content — no bank/AI needed.
        if (discoveryId) {
            console.log('[useTimer] Loading discovery topic:', discoveryId);
            const language = useLanguageStore.getState().language;
            setCurrentLesson(buildDiscoveryLesson(discoveryId, hobby, language));
            setIsLoadingLesson(false);
            return;
        }

        setIsLoadingLesson(true);
        try {
            // Skill-targeted review loads that curriculum week, not the frontier.
            const day = skillDay ?? gamificationStore.currentDay[hobby] ?? 1;
            console.log('[useTimer] Loading lesson for day:', day, 'hobby:', hobby);
            
            let lesson: LessonContent | undefined;
            if (day <= 7) {
                // Static lessons
                const { getLessonByDay } = require('../data/lessonContent');
                lesson = getLessonByDay(hobby, day);
            }
            
            if (!lesson) {
                // Generator lessons for Day 8+ or fallback
                const { lessonGeneratorService } = require('../services/lessonGeneratorService');
                const completedTopics = lessonGeneratorService.getCompletedTopics(gamificationStore.artifacts, hobby);
                lesson = await lessonGeneratorService.generateLesson(hobby, day, completedTopics);
                // The generator must never resolve empty — guarantee a lesson.
                if (!lesson) {
                    lesson = lessonGeneratorService.getFallbackLesson(hobby, day);
                }
            }

            if (lesson && hobby === 'chess') {
                // Загружаем 8 тематических шахматных задач для доски (do step)
                const { getThematicPuzzles } = require('../data/chessPuzzlesBank');
                const puzzles = getThematicPuzzles(day);
                if (lesson.do) {
                    lesson.do.type = 'chess_puzzle';
                    lesson.do.puzzleFen = puzzles[0].fen;
                    lesson.do.puzzleMoves = puzzles[0].puzzleMoves;
                    lesson.do.puzzles = puzzles.map((p: any, index: number) => ({
                        fen: p.fen,
                        moves: p.puzzleMoves,
                        solution: p.solution,
                        successExplanation: p.successExplanation,
                        failureExplanation: p.failureExplanation,
                        prompt: p.prompt,
                        hints: p.hints || ['Подумай над лучшим ходом!']
                    }));
                }
            }

            setCurrentLesson(lesson || null);
        } catch (err) {
            console.error('[useTimer] Error loading lesson:', err);
            // Fallback lesson
            const { lessonGeneratorService } = require('../services/lessonGeneratorService');
            const day = gamificationStore.currentDay[hobby] || 1;
            const fallback = lessonGeneratorService.getFallbackLesson(hobby, day);
            setCurrentLesson(fallback);
        } finally {
            setIsLoadingLesson(false);
        }
    }, [selectedHobby, discoveryId, skillDay, gamificationStore.currentDay, gamificationStore.artifacts]);

    // --- Session blueprint: one objective, time-scaled phases ---
    const [stepOutcomes, setStepOutcomes] = useState<Record<string, StepOutcome>>({});
    const outcomesRef = useRef<Record<string, StepOutcome>>({});
    const rewardsGrantedRef = useRef(false);
    const progressBeforeRef = useRef<SkillSnapshot | null>(null);
    const [progressDelta, setProgressDelta] = useState<SessionDelta | null>(null);
    const ctxSentRef = useRef(false);

    const blueprint: SessionBlueprint | null = useMemo(() => {
        if (!currentLesson) return null;
        const targetTask = targetTaskId
            ? dailyTasks.find((dt) => dt.id === targetTaskId)
            : undefined;
        const built = buildSessionBlueprint({
            minutes: timeboxMinutes,
            taskTitle: targetTask?.title ?? null,
            taskType: targetTask?.type ?? null,
            lessonTitle: currentLesson.learn.title,
            hasTests: !!currentLesson.tests?.length,
            // Skill-targeted review revisits instead of advancing the frontier.
            reviewOnly: skillDay != null,
            t,
        });
        // Discovery is always review-only: time counts, nothing advances.
        // The id prefix is a second signal so deep links stay safe.
        if (sessionKind === 'discovery' || currentLesson.id.startsWith('discovery-')) {
            return { ...built, countsAsFullCompletion: false, requiresValidation: false };
        }
        return built;
    }, [currentLesson, dailyTasks, targetTaskId, timeboxMinutes, skillDay, t]);

    // Ordered step ids for this session. Micro sessions run learn→recall only;
    // standard adds apply; deep adds validate (tests UI when present).
    // Premium static lessons keep their legacy deepen tail after apply.
    const sessionSteps: SessionStepId[] = useMemo(() => {
        if (!blueprint || !currentLesson) return ['learn'];
        const steps: SessionStepId[] = ['learn'];
        if (blueprint.phases.includes('recall')) steps.push('recall');
        const isChess = currentLesson.hobby === 'chess';
        const hasTests = !!currentLesson.tests?.length;
        const applyIncluded = blueprint.phases.includes('apply');
        if (isChess && applyIncluded) {
            if (hasTests && blueprint.phases.includes('validate')) steps.push('tests');
            steps.push('do');
        } else if (applyIncluded) {
            steps.push('do');
            if (isPremium && currentLesson.deepen1) {
                steps.push('deepen1');
                if (currentLesson.deepen2) steps.push('deepen2');
            }
            if (!isChess && hasTests && blueprint.phases.includes('validate')) steps.push('tests');
        }
        return steps;
    }, [blueprint, currentLesson, isPremium]);

    // Evidence delta builder shared by BOTH completion surfaces (step flow
    // reaching 'complete', and the stop-button summary flow).
    const buildDelta = useCallback((): SessionDelta | null => {
        if (!selectedHobby) return null;
        const verifiedCount = Object.values(outcomesRef.current).filter(
            (o) => o === 'pass' || o === 'partial',
        ).length;
        const targetTitle = rewardsGrantedRef.current && targetTaskId
            ? (dailyTasks.find((dt) => dt.id === targetTaskId)?.title ?? null)
            : null;
        return diffSkillSnapshot(progressBeforeRef.current, selectedHobby, {
            minutes: Math.round(timeLeftRef.current / 60),
            rewarded: rewardsGrantedRef.current,
            verifiedCount,
            taskCompletedTitle: targetTitle,
        });
    }, [dailyTasks, targetTaskId, selectedHobby]);

    const handleStepComplete = useCallback((
        step: string,
        userInput?: string,
        aiFeedback?: string,
        outcome: StepOutcome = 'unknown',
    ) => {
        console.log('[useTimer] Completing step:', step, 'outcome:', outcome);

        // Track legacy steps in gamification store (checklist progress, not rewards)
        if (['learn', 'do', 'deepen1', 'deepen2'].includes(step)) {
            gamificationStore.markStepComplete(step as any);
        }

        if (userInput && currentLesson) {
            gamificationStore.saveArtifact({
                hobbyId: currentLesson.hobby,
                lessonId: currentLesson.id,
                taskType: (step.startsWith('test_') ? 'do' : step) as any,
                userInput,
                aiFeedback: outcome !== 'unknown' ? `[verdict:${outcome}] ${aiFeedback || ''}` : (aiFeedback || ''),
            });
        }

        setStepOutcomes((prev) => ({ ...prev, [step]: outcome }));
        outcomesRef.current = { ...outcomesRef.current, [step]: outcome };

        // Blueprint-driven progression (replaces the hardcoded step chain so
        // 5-minute and 45-minute sessions run structurally different flows).
        const idx = sessionSteps.indexOf(step as SessionStepId);
        const next = idx >= 0 ? sessionSteps[idx + 1] : undefined;
        if (next) {
            setActiveStep(next);
            return;
        }

        // Terminal step — one completion pipeline (§6): rewards, task credit,
        // and next-task resolution all derive from blueprint + outcome.
        const plan = resolveCompletionPlan({
            blueprint,
            outcome,
            tasks: dailyTasks,
            targetTaskId,
        });
        rewardsGrantedRef.current = plan.advance;
        if (plan.advance) {
            if (currentLesson) {
                gamificationStore.advanceDay(currentLesson.hobby as HobbyId);
                gamificationStore.incrementSessionsCompleted();
            }
            if (plan.completeTask && user?.id && targetTaskId && !isLocalOnlyTaskId(targetTaskId)) {
                completeTask(user.id, targetTaskId).catch((err) =>
                    console.log('[useTimer] Failed to auto-complete target task:', err),
                );
            }
        } else {
            console.log(
                '[useTimer] Session completes without progression rewards. full:',
                !!blueprint?.countsAsFullCompletion,
                'outcome:',
                outcome,
            );
        }
        // Evidence delta for BOTH completion surfaces (step flow + stop flow).
        setProgressDelta(buildDelta());
        setActiveStep('complete');
    }, [currentLesson, isPremium, sessionSteps, blueprint, user, targetTaskId, completeTask, dailyTasks, buildDelta]);


    const TYPE_LABEL: Record<string, string> = {
        theory: t('Узнай'),
        practice: t('Сделай'),
        analysis: t('Углуби 1'),
        puzzles: t('Углуби 2'),
    };

    // --- Timer state (Stopwatch count up) ---
    const [totalTime, setTotalTime] = useState(timeboxMinutes * 60); // Session timebox; adjustable via picker
    const [timerStatus, setTimerStatus] = useState<TimerStatus>('idle');
    const [timeLeft, setTimeLeft] = useState(0); // Starts at 0
    const progress = (timeLeft % 60) / 60; // Animates every minute like a second hand

    useEffect(() => {
        if (timerStatus === 'idle') {
            setTimeLeft(0);
        }
    }, [timerStatus]);

    // --- Tasks derived from real store ---
    const [tasks, setTasks] = useState<SessionTask[]>([]);

    // --- Locked tasks: completed BEFORE the current session started ---
    const [lockedTaskIds, setLockedTaskIds] = useState<Set<string>>(new Set());

    // Sync tasks from store whenever dailyTasks changes
    useEffect(() => {
        const maxTasks = getMaxTasksPerDay(isPremium);
        const orderedFiltered = ENGINE_TYPES_ORDER
            .flatMap(type => dailyTasks.filter(task => task.type === type && task.status !== 'skipped'))
            .slice(0, maxTasks);
        const sessionTasks: SessionTask[] = orderedFiltered
            .map((task, index) => ({
                id: task.id ?? `local-${task.type}-${index}`,
                storeTaskId: task.id ?? null,
                title: TYPE_LABEL[task.type] ?? task.type,
                subtitle: t(task.title),
                completed: task.status === 'completed',
                completedAt: task.status === 'completed' ? Date.now() : null,
                startedAt: null, // Will be set when user starts working on this task
            }));
        setTasks(sessionTasks);
    }, [dailyTasks, isPremium]);

    // --- UI state ---
    const [isTaskListVisible, setIsTaskListVisible] = useState(false);
    const [showSummary, setShowSummary] = useState(false);
    const [startTime, setStartTime] = useState<number | null>(null);

    // --- Stop confirmation ---
    const [isStopModalVisible, setIsStopModalVisible] = useState(false);
    const [dontShowAgainChecked, setDontShowAgainChecked] = useState(false);
    const [prefDontShowStop, setPrefDontShowStop] = useState(false);

    // --- Chat state ---
    const [chatInput, setChatInput] = useState('');
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isAiLoading, setIsAiLoading] = useState(false);

    // --- Animation refs ---
    const controlsAnim = useRef(new Animated.Value(0)).current;
    const drawerAnim = useRef(new Animated.Value(-scale(286))).current;
    const backdropAnim = useRef(new Animated.Value(0)).current;
    const bottomNavVisible = useRef(new Animated.Value(1)).current;

    // --- Load preferences ---
    useEffect(() => {
        AsyncStorage.getItem(STORAGE_KEY_PREF).then(val => {
            if (val === 'true') setPrefDontShowStop(true);
        });
    }, []);

    // --- Set start time on mount ---
    useEffect(() => {
        setStartTime(Date.now());
    }, []);



    // --- Persist timer across app background ---
    const timeLeftRef = useRef(timeLeft);
    useEffect(() => { timeLeftRef.current = timeLeft; }, [timeLeft]);

    useEffect(() => {
        const subscription = AppState.addEventListener('change', async (nextState: AppStateStatus) => {
            if (timerStatus === 'running') {
                if (nextState === 'background' || nextState === 'inactive') {
                    // Save both timestamp and current timeLeft so foreground recovery is authoritative
                    await AsyncStorage.multiSet([
                        [STORAGE_KEY_START_TS, String(Date.now())],
                        ['session_timer_time_left', String(timeLeftRef.current)],
                    ]);
                } else if (nextState === 'active') {
                    // Recover elapsed time against saved timeLeft (avoids double-counting interval ticks)
                    const pairs = await AsyncStorage.multiGet([STORAGE_KEY_START_TS, 'session_timer_time_left']);
                    const savedTs = pairs[0][1];
                    const savedLeft = pairs[1][1];
                    if (savedTs && savedLeft) {
                        const elapsed = Math.floor((Date.now() - Number(savedTs)) / 1000);
                        await AsyncStorage.multiRemove([STORAGE_KEY_START_TS, 'session_timer_time_left']);
                        const corrected = Number(savedLeft) - elapsed;
                        setTimeLeft(corrected <= 0 ? 0 : corrected);
                    }
                }
            }
        });
        return () => subscription.remove();
    }, [timerStatus]);

    // --- Stopwatch count up ---
    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (timerStatus === 'running') {
            interval = setInterval(() => {
                setTimeLeft(prev => prev + 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [timerStatus]);

    // --- Animate controls ---
    useEffect(() => {
        if (timerStatus !== 'idle') {
            Animated.timing(controlsAnim, {
                toValue: 1,
                duration: 1600,
                useNativeDriver: true,
                easing: Easing.out(Easing.back(1.5)),
            }).start();
        } else {
            controlsAnim.setValue(0);
        }
    }, [timerStatus]);

    // --- Animate bottom nav ---
    useEffect(() => {
        const isVisible = timerStatus === 'idle';
        Animated.timing(bottomNavVisible, {
            toValue: isVisible ? 1 : 0,
            duration: 250,
            useNativeDriver: true,
            easing: Easing.out(Easing.cubic),
        }).start();
    }, [timerStatus]);

    // --- Animate drawer ---
    useEffect(() => {
        if (isTaskListVisible) {
            Animated.parallel([
                Animated.timing(drawerAnim, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                    easing: Easing.out(Easing.ease),
                }),
                Animated.timing(backdropAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(drawerAnim, {
                    toValue: -scale(300),
                    duration: 250,
                    useNativeDriver: true,
                    easing: Easing.in(Easing.ease),
                }),
                Animated.timing(backdropAnim, {
                    toValue: 0,
                    duration: 250,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [isTaskListVisible]);

    // --- Save session to Supabase (fire-and-forget) ---
    const saveSessionToSupabase = useCallback((durationSeconds: number) => {
        if (!user?.id || !selectedHobby) return;
        const completedTaskIds = tasks
            .filter(t => t.completed)
            .map(t => t.storeTaskId)
            .filter((id): id is string => !!id);
        sessionService.saveSession(user.id, selectedHobby, durationSeconds, {
            tasksCompleted: completedTaskIds,
        }).catch(err => console.error('Failed to save session:', JSON.stringify(err, null, 2)));
    }, [user, selectedHobby, tasks]);

    // --- Actions ---
    const formatTime = useCallback((seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }, []);

    const startSession = useCallback(() => {
        console.log('[useTimer] Starting session');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setLockedTaskIds(new Set(tasks.filter(t => t.completed).map(t => t.id)));

        // Fresh evidence slate for this session.
        setStepOutcomes({});
        outcomesRef.current = {};
        rewardsGrantedRef.current = false;
        setProgressDelta(null);
        ctxSentRef.current = false;
        progressBeforeRef.current = captureSkillSnapshot(selectedHobby);
        
        // Set startedAt for the first incomplete task to session start time
        const now = Date.now();
        setTasks(prev => {
            const firstIncompleteIndex = prev.findIndex(t => !t.completed);
            if (firstIncompleteIndex === -1) return prev;
            return prev.map((task, index) =>
                index === firstIncompleteIndex ? { ...task, startedAt: now } : task
            );
        });

        // Start gamification session
        if (selectedHobby) {
            gamificationStore.startSession(selectedHobby as HobbyId);
            loadLessonForSession();
            setActiveStep('learn');
        }
        
        setTimerStatus('running');
    }, [tasks, selectedHobby, loadLessonForSession]);


    const handlePlay = useCallback(() => {
        console.log('[useTimer] handlePlay pressed');
        const allCompleted = tasks.length > 0 && tasks.every(t => t.completed);

        if (allCompleted) {
            console.log('[useTimer] All tasks already completed - invoking callback');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            if (onAllTasksDone) {
                onAllTasksDone(startSession);
            } else {
                startSession();
            }
            return;
        }

        startSession();
    }, [tasks, onAllTasksDone, startSession]);

    // --- Automatically start session on mount to skip the idle timer screen ---
    useEffect(() => {
        if (selectedHobby && tasks.length >= 0 && timerStatus === 'idle') {
            console.log('[useTimer] Automatically starting session on mount');
            startSession();
        }
    }, [selectedHobby, tasks, timerStatus, startSession]);

    const handlePause = useCallback(() => {
        console.log('[useTimer] handlePause pressed - current status will toggle');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setTimerStatus(prev => (prev === 'running' ? 'paused' : 'running'));
    }, []);

    const handleReset = useCallback(() => {
        console.log('[useTimer] handleReset pressed');
        // Uncomplete tasks that were completed during this session (not pre-session locked ones)
        if (user?.id) {
            tasks
                .filter(t => t.completed && !lockedTaskIds.has(t.id))
                .forEach(task => {
                    const isRealId = task.storeTaskId && !task.storeTaskId.startsWith('temp-');
                    if (isRealId) {
                        useTaskStore.getState().uncompleteTask(user.id!, task.storeTaskId!);
                    }
                });
        }
        // Immediately reset local task state so UI doesn't show stale completed tasks
        // while the async store update propagates through dailyTasks
        setTasks(prev => prev.map(task =>
            task.completed && !lockedTaskIds.has(task.id)
                ? { ...task, completed: false, completedAt: null, startedAt: null }
                : task
        ));
        setTimeLeft(0);
        setTimerStatus('idle');
        setLockedTaskIds(new Set());
    }, [totalTime, tasks, lockedTaskIds, user]);

    const handleToggleTask = useCallback((id: string) => {
        console.log('[useTimer] handleToggleTask - task id:', id);
        const selectedTask = tasks.find(task => task.id === id);
        if (!selectedTask) {
            console.log('[useTimer] Task not found:', id);
            return;
        }

        // Tasks completed before this session started are locked — cannot be toggled
        if (lockedTaskIds.has(id)) {
            console.log('[useTimer] Task is locked - cannot toggle:', id);
            return;
        }

        const isCurrentlyCompleted = selectedTask.completed;
        console.log('[useTimer] Toggling task - id:', id, 'current status:', isCurrentlyCompleted, 'new status:', !isCurrentlyCompleted);

        Haptics.notificationAsync(
            isCurrentlyCompleted 
                ? Haptics.NotificationFeedbackType.Warning 
                : Haptics.NotificationFeedbackType.Success
        );

        // Update local session UI immediately
        const now = Date.now();
        setTasks(prev => {
            const taskIndex = prev.findIndex(t => t.id === id);
            if (taskIndex === -1) return prev;
            
            const newCompleted = !isCurrentlyCompleted;
            const updates: SessionTask[] = [...prev];
            
            // Update current task
            updates[taskIndex] = {
                ...updates[taskIndex],
                completed: newCompleted,
                completedAt: newCompleted ? now : null,
            };
            
            if (newCompleted) {
                // Task completed - start the next incomplete task
                const nextIncompleteIndex = updates.findIndex((t, i) => i > taskIndex && !t.completed);
                if (nextIncompleteIndex !== -1) {
                    updates[nextIncompleteIndex] = {
                        ...updates[nextIncompleteIndex],
                        startedAt: now,
                    };
                }
            } else {
                // Task uncompleted - clear startedAt for this task and all subsequent tasks
                // (user is going backwards)
                for (let i = taskIndex; i < updates.length; i++) {
                    updates[i] = { ...updates[i], startedAt: null };
                }
            }
            
            return updates;
        });

        // Persist toggling to real task store and Supabase
        // Skip if storeTaskId is a temporary ID (Supabase requires a real UUID)
        const isRealId = selectedTask.storeTaskId && !selectedTask.storeTaskId.startsWith('temp-');
        if (user?.id && isRealId) {
            const storeAction = isCurrentlyCompleted
                ? useTaskStore.getState().uncompleteTask(user.id, selectedTask.storeTaskId!)
                : completeTask(user.id, selectedTask.storeTaskId!);
            
            storeAction.catch(err =>
                console.log('[useTimer] Failed to persist task toggle:', err)
            );
        }
    }, [user, completeTask, tasks, lockedTaskIds]);

    const finishSession = useCallback(() => {
        console.log('[useTimer] finishSession called');
        const durationSeconds = timeLeftRef.current; // Elapsed seconds
        console.log('[useTimer] Session finished - elapsed:', durationSeconds, 'seconds');
        saveSessionToSupabase(durationSeconds);
        if (durationSeconds > 0) {
            console.log('[useTimer] calling addHobbyTime with', durationSeconds, 'seconds');
            const hobbyStore = useHobbyTimeStore.getState();
            if (!hobbyStore.userCreatedDate) hobbyStore.setUserCreatedDate(new Date().toISOString());
            hobbyStore.addHobbyTime(durationSeconds);
        } else {
            console.log('[useTimer] durationSeconds is 0 - skipping addHobbyTime');
        }

        const newlyCompletedTasks = tasks.filter(t => t.completed && !lockedTaskIds.has(t.id));

        // Evidence delta shared with the step-flow completion surface.
        const delta = buildDelta();
        setProgressDelta(delta);

        if (newlyCompletedTasks.length > 0 || (delta && delta.minutes > 0 && Object.keys(outcomesRef.current).length > 0)) {
            console.log('[useTimer] Showing summary - newly completed tasks:', newlyCompletedTasks.length);
            setShowSummary(true);
        } else {
            console.log('[useTimer] No new tasks completed this session - resetting stopwatch');
            setTimeLeft(0);
            setTimerStatus('idle');
        }
    }, [tasks, lockedTaskIds, saveSessionToSupabase, buildDelta]);

    const handleStopPress = useCallback(() => {
        console.log('[useTimer] handleStopPress pressed');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        if (prefDontShowStop) {
            console.log('[useTimer] Skip confirmation modal - finishing session');
            finishSession();
        } else {
            console.log('[useTimer] Showing stop confirmation modal');
            setIsStopModalVisible(true);
        }
    }, [prefDontShowStop, finishSession]);

    const confirmStop = useCallback(async () => {
        console.log('[useTimer] confirmStop pressed - dontShowAgain:', dontShowAgainChecked);
        if (dontShowAgainChecked) {
            await AsyncStorage.setItem(STORAGE_KEY_PREF, 'true');
            setPrefDontShowStop(true);
        }
        setIsStopModalVisible(false);
        finishSession();
    }, [dontShowAgainChecked, finishSession]);

    const handleSendMessage = useCallback(async () => {
        const trimmedInput = chatInput.trim();
        console.log('[useTimer] handleSendMessage - input:', trimmedInput.substring(0, 50));
        if (!trimmedInput || isAiLoading) {
            console.log('[useTimer] Cannot send - empty input or already loading');
            return;
        }

        const userMsg: ChatMessage = { role: 'user', content: trimmedInput };
        const newMessages = [...messages, userMsg];
        setMessages(newMessages);
        setChatInput('');
        setIsAiLoading(true);

        // Session context for the mentor: injected once per session as a hidden
        // system message (never rendered — UI shows only user/assistant turns).
        // The existing AI service is reused; only its input gains context.
        let apiMessages = newMessages;
        if (currentLesson && activeStep !== 'complete' && !ctxSentRef.current) {
            const objective = blueprint?.learningObjective || currentLesson.learn.title;
            apiMessages = [
                {
                    role: 'system',
                    content: `Session context (for you only, never repeat it): skill "${selectedHobby}", topic "${currentLesson.learn.title}", learning objective "${objective}", stage "${activeStep}", steps finished so far: ${Object.keys(outcomesRef.current).length}. Reply in the user's language. For assessed work give a hint first and a full solution only when appropriate.`,
                } as ChatMessage,
                ...newMessages,
            ];
            ctxSentRef.current = true;
        }

        try {
            console.log('[useTimer] Sending message to AI service');
            const response = await aiService.sendMessage(apiMessages, selectedHobby ?? undefined);
            console.log('[useTimer] AI response received');
            const assistantMsg: ChatMessage = { role: 'assistant', content: response };
            setMessages(prev => [...prev, assistantMsg]);
        } catch (error) {
            console.log('[useTimer] Error sending message:', error);
            const errorMsg: ChatMessage = { role: 'assistant', content: 'Извините, ошибка соединения.' };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsAiLoading(false);
        }
    }, [chatInput, isAiLoading, messages, selectedHobby]);

    return {
        // Timer
        timerStatus,
        timeLeft,
        progress,
        formatTime,
        handlePlay,
        handlePause,
        handleReset,
        handleStopPress,
        setTotalTime,
        totalTime,

        // Tasks
        tasks,
        handleToggleTask,
        lockedTaskIds,

        // Drawer
        isTaskListVisible,
        setIsTaskListVisible,

        // Summary
        showSummary,
        startTime,

        // Stop modal
        isStopModalVisible,
        setIsStopModalVisible,
        dontShowAgainChecked,
        setDontShowAgainChecked,
        confirmStop,

        // Chat
        chatInput,
        setChatInput,
        messages,
        isAiLoading,
        handleSendMessage,

        // Animations
        controlsAnim,
        drawerAnim,
        backdropAnim,
        bottomNavVisible,

        // Gamification
        activeStep,
        setActiveStep,
        currentLesson,
        isLoadingLesson,
        handleStepComplete,

        // Session blueprint (objective + time-scaled phases + evidence)
        blueprint,
        sessionSteps,
        stepOutcomes,
        timeboxMinutes,
        targetTaskId,
        origin,
        sessionKind,
        progressDelta,


        // Constants
        // Removed static TOTAL_TIME
    };
}
