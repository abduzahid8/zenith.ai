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
import { sessionService } from '../services/supabase/sessions';

export type TimerStatus = 'idle' | 'running' | 'paused';

const TOTAL_TIME = 30 * 60; // 30 minutes
const STORAGE_KEY_PREF = 'session_stop_confirm_pref';
const STORAGE_KEY_START_TS = 'session_timer_start_ts';

const TYPE_LABEL: Record<string, string> = {
    theory: 'Теория',
    practice: 'Практика',
    analysis: 'Анализ',
    puzzles: 'Задачи',
};

export function useTimer() {
    const { dailyTasks, completeTask } = useTaskStore();
    const user = useAuthStore(s => s.user);
    const { selectedHobby } = useUserProfileStore();

    // --- Timer state ---
    const [timerStatus, setTimerStatus] = useState<TimerStatus>('idle');
    const [timeLeft, setTimeLeft] = useState(TOTAL_TIME);
    const progress = timeLeft / TOTAL_TIME;

    // --- Tasks derived from real store ---
    const [tasks, setTasks] = useState<SessionTask[]>([]);

    // Sync tasks from store whenever dailyTasks changes
    useEffect(() => {
        const sessionTasks: SessionTask[] = dailyTasks
            .filter(t => t.status !== 'skipped')
            .map(t => ({
                id: t.id ?? String(Math.random()),
                title: TYPE_LABEL[t.type] ?? t.type,
                subtitle: t.title,
                completed: t.status === 'completed',
                completedAt: t.status === 'completed' ? Date.now() : null,
            }));
        setTasks(sessionTasks);
    }, [dailyTasks]);

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
    useEffect(() => {
        const subscription = AppState.addEventListener('change', async (nextState: AppStateStatus) => {
            if (timerStatus === 'running') {
                if (nextState === 'background' || nextState === 'inactive') {
                    // Save the timestamp when app goes to background
                    await AsyncStorage.setItem(STORAGE_KEY_START_TS, String(Date.now()));
                } else if (nextState === 'active') {
                    // Recover elapsed time
                    const savedTs = await AsyncStorage.getItem(STORAGE_KEY_START_TS);
                    if (savedTs) {
                        const elapsed = Math.floor((Date.now() - Number(savedTs)) / 1000);
                        await AsyncStorage.removeItem(STORAGE_KEY_START_TS);
                        setTimeLeft(prev => {
                            const updated = prev - elapsed;
                            return updated <= 0 ? 0 : updated;
                        });
                    }
                }
            }
        });
        return () => subscription.remove();
    }, [timerStatus]);

    // --- Timer countdown ---
    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (timerStatus === 'running' && timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft(prev => prev - 1);
            }, 1000);
        } else if (timeLeft === 0 && timerStatus === 'running') {
            // Timer naturally completed — save session and show summary
            setTimerStatus('idle');
            saveSessionToSupabase(TOTAL_TIME);
            setShowSummary(true);
        }
        return () => clearInterval(interval);
    }, [timerStatus, timeLeft]);

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
            .map(t => t.id);
        sessionService.saveSession(user.id, selectedHobby, durationSeconds, {
            tasksCompleted: completedTaskIds,
        }).catch(err => console.error('Failed to save session:', err));
    }, [user, selectedHobby, tasks]);

    // --- Actions ---
    const formatTime = useCallback((seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }, []);

    const handlePlay = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setTimerStatus('running');
    }, []);

    const handlePause = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setTimerStatus(prev => (prev === 'running' ? 'paused' : 'running'));
    }, []);

    const handleReset = useCallback(() => {
        setTimeLeft(TOTAL_TIME);
        setTimerStatus('idle');
    }, []);

    const handleCompleteTask = useCallback((id: string) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // Update local session UI immediately
        setTasks(prev =>
            prev.map(task =>
                task.id === id && !task.completed
                    ? { ...task, completed: true, completedAt: Date.now() }
                    : task
            )
        );
        // Persist completion to real task store and Supabase
        if (user?.id) {
            completeTask(user.id, id).catch(err =>
                console.error('Failed to persist task completion:', err)
            );
        }
    }, [user, completeTask]);

    const handleStopPress = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        if (prefDontShowStop) {
            finishSession();
        } else {
            setIsStopModalVisible(true);
        }
    }, [prefDontShowStop, tasks]);

    const finishSession = useCallback(() => {
        const elapsed = TOTAL_TIME - timeLeft;
        const durationSeconds = elapsed > 0 ? elapsed : 0;
        saveSessionToSupabase(durationSeconds);

        const completedTasks = tasks.filter(t => t.completed);
        if (completedTasks.length > 0) {
            setShowSummary(true);
        } else {
            setTimeLeft(TOTAL_TIME);
            setTimerStatus('idle');
        }
    }, [timeLeft, tasks, saveSessionToSupabase]);

    const confirmStop = useCallback(async () => {
        if (dontShowAgainChecked) {
            await AsyncStorage.setItem(STORAGE_KEY_PREF, 'true');
            setPrefDontShowStop(true);
        }
        setIsStopModalVisible(false);
        finishSession();
    }, [dontShowAgainChecked, finishSession]);

    const handleSendMessage = useCallback(async () => {
        if (!chatInput.trim() || isAiLoading) return;

        const userMsg: ChatMessage = { role: 'user', content: chatInput.trim() };
        const newMessages = [...messages, userMsg];
        setMessages(newMessages);
        setChatInput('');
        setIsAiLoading(true);

        try {
            const response = await aiService.sendMessage(newMessages, selectedHobby ?? undefined);
            const assistantMsg: ChatMessage = { role: 'assistant', content: response };
            setMessages(prev => [...prev, assistantMsg]);
        } catch (error) {
            console.error(error);
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

        // Tasks
        tasks,
        handleCompleteTask,

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

        // Constants
        totalTime: TOTAL_TIME,
    };
}
