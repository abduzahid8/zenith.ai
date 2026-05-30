import { useState, useEffect, useRef, useCallback } from 'react';
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
import { useT } from '../store/languageStore';
import { useGamificationStore } from '../store/gamificationStore';
import { HobbyId, LessonContent } from '../data/lessonContent';


export type TimerStatus = 'idle' | 'running' | 'paused';

const TOTAL_TIME = 30 * 60; // 30 minutes
const STORAGE_KEY_PREF = 'session_stop_confirm_pref';
const STORAGE_KEY_START_TS = 'session_timer_start_ts';
const ENGINE_TYPES_ORDER = ['theory', 'practice', 'analysis', 'puzzles'];

export interface UseTimerOptions {
    onAllTasksDone?: (startAnyway: () => void) => void;
}

export function useTimer(options: UseTimerOptions = {}) {
    const { onAllTasksDone } = options;
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

        setIsLoadingLesson(true);
        try {
            const day = gamificationStore.currentDay[hobby] || 1;
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
    }, [selectedHobby, gamificationStore.currentDay, gamificationStore.artifacts]);

    const handleStepComplete = useCallback((step: string, userInput?: string, aiFeedback?: string) => {
        console.log('[useTimer] Completing step:', step);
        
        // Track legacy steps in gamification store
        if (['learn', 'do', 'deepen1', 'deepen2'].includes(step)) {
            gamificationStore.markStepComplete(step as any);
        }

        if (userInput && currentLesson) {
            gamificationStore.saveArtifact({
                hobbyId: currentLesson.hobby,
                lessonId: currentLesson.id,
                taskType: (step.startsWith('test_') ? 'do' : step) as any,
                userInput,
                aiFeedback: aiFeedback || '',
            });
        }

        // Advance to the next step
        if (step === 'learn') {
            if (currentLesson?.hobby === 'chess' && currentLesson.tests && currentLesson.tests.length > 0) {
                setActiveStep('tests');
            } else {
                setActiveStep('do');
            }
        } else if (step === 'tests') {
            setActiveStep('do'); // Переходим к финальной шахматной задаче
        } else if (step === 'do') {
            if (currentLesson?.hobby === 'chess') {
                gamificationStore.advanceDay(currentLesson?.hobby as HobbyId);
                gamificationStore.incrementSessionsCompleted();
                setActiveStep('complete');
            } else if (isPremium && currentLesson?.deepen1) {
                setActiveStep('deepen1');
            } else {
                gamificationStore.advanceDay(currentLesson?.hobby as HobbyId);
                gamificationStore.incrementSessionsCompleted();
                setActiveStep('complete');
            }
        } else if (step === 'deepen1') {
            if (isPremium && currentLesson?.deepen2) {
                setActiveStep('deepen2');
            } else {
                gamificationStore.advanceDay(currentLesson?.hobby as HobbyId);
                gamificationStore.incrementSessionsCompleted();
                setActiveStep('complete');
            }
        } else if (step === 'deepen2') {
            gamificationStore.advanceDay(currentLesson?.hobby as HobbyId);
            gamificationStore.incrementSessionsCompleted();
            setActiveStep('complete');
        }
    }, [currentLesson, isPremium]);


    const TYPE_LABEL: Record<string, string> = {
        theory: t('Узнай'),
        practice: t('Сделай'),
        analysis: t('Углуби 1'),
        puzzles: t('Углуби 2'),
    };

    // --- Timer state (Stopwatch count up) ---
    const [totalTime, setTotalTime] = useState(30 * 60); // Retained for type compatibility
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
        const maxTasks = isPremium ? 4 : 3;
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
        if (newlyCompletedTasks.length > 0) {
            console.log('[useTimer] Showing summary - newly completed tasks:', newlyCompletedTasks.length);
            setShowSummary(true);
        } else {
            console.log('[useTimer] No new tasks completed this session - resetting stopwatch');
            setTimeLeft(0);
            setTimerStatus('idle');
        }
    }, [tasks, lockedTaskIds, saveSessionToSupabase]);

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

        try {
            console.log('[useTimer] Sending message to AI service');
            const response = await aiService.sendMessage(newMessages, selectedHobby ?? undefined);
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


        // Constants
        // Removed static TOTAL_TIME
    };
}
