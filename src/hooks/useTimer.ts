import { useState, useEffect, useRef, useCallback } from 'react';
import { Animated, Easing } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { scale } from '../constants';
import { SessionTask } from '../components/session/TaskDrawer';
import { ChatMessage, aiService } from '../services/ai';

export type TimerStatus = 'idle' | 'running' | 'paused';

const TOTAL_TIME = 30 * 60; // 30 minutes

const DEFAULT_TASKS: SessionTask[] = [
    { id: '1', title: 'Теория', subtitle: 'Изучить Королевский Гамбит', completed: false, completedAt: null },
    { id: '2', title: 'Практика', subtitle: 'Сыграть 2 партии', completed: false, completedAt: null },
    { id: '3', title: 'Анализ', subtitle: 'Рассмотреть партию', completed: false, completedAt: null },
    { id: '4', title: 'Задачи', subtitle: 'Решить 15 тактических задач', completed: false, completedAt: null },
];

export function useTimer() {
    // --- Timer state ---
    const [timerStatus, setTimerStatus] = useState<TimerStatus>('idle');
    const [timeLeft, setTimeLeft] = useState(TOTAL_TIME);
    const progress = timeLeft / TOTAL_TIME;

    // --- Task state ---
    const [tasks, setTasks] = useState<SessionTask[]>(DEFAULT_TASKS);

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
        AsyncStorage.getItem('session_stop_confirm_pref').then(val => {
            if (val === 'true') setPrefDontShowStop(true);
        });
    }, []);

    // --- Set start time on mount ---
    useEffect(() => {
        setStartTime(Date.now());
    }, []);

    // --- Timer countdown ---
    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (timerStatus === 'running' && timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft(prev => prev - 1);
            }, 1000);
        } else if (timeLeft === 0) {
            setTimerStatus('idle');
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

    // --- Actions ---
    const formatTime = useCallback((seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }, []);

    const handlePlay = useCallback(() => setTimerStatus('running'), []);

    const handlePause = useCallback(() => {
        setTimerStatus(prev => (prev === 'running' ? 'paused' : 'running'));
    }, []);

    const handleReset = useCallback(() => {
        setTimeLeft(TOTAL_TIME);
        setTimerStatus('idle');
    }, []);

    const handleCompleteTask = useCallback((id: string) => {
        setTasks(prev =>
            prev.map(task =>
                task.id === id && !task.completed
                    ? { ...task, completed: true, completedAt: Date.now() }
                    : task
            )
        );
    }, []);

    const handleStopPress = useCallback(() => {
        if (prefDontShowStop) {
            const completedTasks = tasks.filter(t => t.completed);
            if (completedTasks.length > 0) {
                setShowSummary(true);
            } else {
                setTimeLeft(TOTAL_TIME);
                setTimerStatus('idle');
            }
        } else {
            setIsStopModalVisible(true);
        }
    }, [prefDontShowStop, tasks]);

    const confirmStop = useCallback(async () => {
        if (dontShowAgainChecked) {
            await AsyncStorage.setItem('session_stop_confirm_pref', 'true');
            setPrefDontShowStop(true);
        }
        setIsStopModalVisible(false);

        const completedTasks = tasks.filter(t => t.completed);
        if (completedTasks.length > 0) {
            setShowSummary(true);
        } else {
            setTimeLeft(TOTAL_TIME);
            setTimerStatus('idle');
        }
    }, [dontShowAgainChecked, tasks]);

    const handleSendMessage = useCallback(async () => {
        if (!chatInput.trim()) return;

        const userMsg: ChatMessage = { role: 'user', content: chatInput.trim() };
        const newMessages = [...messages, userMsg];
        setMessages(newMessages);
        setChatInput('');
        setIsAiLoading(true);

        try {
            const response = await aiService.sendMessage(newMessages, 'General');
            const assistantMsg: ChatMessage = { role: 'assistant', content: response };
            setMessages(prev => [...prev, assistantMsg]);
        } catch (error) {
            console.error(error);
            const errorMsg: ChatMessage = { role: 'assistant', content: 'Извините, ошибка соединения.' };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsAiLoading(false);
        }
    }, [chatInput, messages]);

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
