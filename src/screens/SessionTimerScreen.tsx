import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    StatusBar,
    TouchableOpacity,
    Dimensions,
    LayoutAnimation,
    Animated,
    Easing,
    Image,
    Platform,
    Pressable,
    ScrollView,
    TextInput,
    KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import Svg, { Circle, Path, Rect, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import PagerView from 'react-native-pager-view';
import { scale, SCREEN_WIDTH } from '../constants';
import { colors } from '../theme';
import { aiService, ChatMessage } from '../services/ai'; // Import AI Service

// Types
const TABS = [
    { key: 'home', icon: 'home', iconOutline: 'home-outline', type: 'ionicon' },
    { key: 'weekly-plan', icon: 'clipboard-text', iconOutline: 'clipboard-text-outline', type: 'material' },
    { key: 'ai-coach', icon: 'lightbulb', iconOutline: 'lightbulb-outline', type: 'material' },
    { key: 'statistics', icon: 'bar-chart', iconOutline: 'bar-chart-outline', type: 'ionicon' },
];

// Circular Progress Component
const TimerProgress = ({ progress, size, strokeWidth, color, trackColor, children }: any) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const strokeDashoffset = circumference - (progress * circumference);

    return (
        <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
            <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
                {/* Track */}
                <Circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={trackColor}
                    strokeWidth={strokeWidth}
                    fill="none"
                />
                {/* Progress */}
                <Circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={color}
                    strokeWidth={strokeWidth}
                    fill="none"
                    strokeDasharray={`${circumference} ${circumference}`}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                />
            </Svg>
            {children}
        </View>
    );
};

export const SessionTimerScreen: React.FC = () => {
    const router = useRouter();
    const [timerStatus, setTimerStatus] = useState<'idle' | 'running' | 'paused'>('idle');
    const [timeLeft, setTimeLeft] = useState(30 * 60); // 30 minutes in seconds
    const [isTaskListVisible, setIsTaskListVisible] = useState(false);
    const totalTime = 30 * 60;

    const controlsAnim = useRef(new Animated.Value(0)).current;
    const drawerAnim = useRef(new Animated.Value(-scale(286))).current; // Start hidden (left)

    const backdropAnim = useRef(new Animated.Value(0)).current; // Opacity 0

    // Session Summary State
    const [showSummary, setShowSummary] = useState(false);
    const [startTime, setStartTime] = useState<number | null>(null);

    // Weekly Plan UI State (Page 2)
    // AI Chat UI State (Page 2)
    // AI Chat UI State (Page 2)
    const [chatInput, setChatInput] = useState('');
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const pagerViewRef = useRef<PagerView>(null);

    const handleSendMessage = async () => {
        if (!chatInput.trim()) return;

        const userMsg: ChatMessage = { role: 'user', content: chatInput.trim() };
        const newMessages = [...messages, userMsg];
        setMessages(newMessages);
        setChatInput('');
        setIsAiLoading(true);

        try {
            // Context: You can pass the current task/hobby if available. For now, general chat.
            // Using "General" or deriving from current task could be better.
            const response = await aiService.sendMessage(newMessages, 'General');
            const assistantMsg: ChatMessage = { role: 'assistant', content: response };
            setMessages(prev => [...prev, assistantMsg]);
        } catch (error) {
            console.error(error);
            const errorMsg: ChatMessage = { role: 'assistant', content: "Извините, ошибка соединения." };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsAiLoading(false);
        }
    };


    // Initial Start Time
    useEffect(() => {
        // Set start time when component mounts or first timer start?
        // Let's set it when timer status first becomes 'running' or just on mount if it auto-starts?
        // User flow: "Start Session" -> enters screen -> usually explicit start.
        // Assuming session starts when they hit play or enter screen?
        // Let's set it on mount for simplicity of "Elapsed since entry".
        const now = Date.now();

        setStartTime(now);
    }, []);

    // Stop Confirmation State
    const [isStopModalVisible, setIsStopModalVisible] = useState(false);
    const [dontShowAgainChecked, setDontShowAgainChecked] = useState(false);
    const [prefDontShowStop, setPrefDontShowStop] = useState(false);

    // Load preference
    useEffect(() => {
        AsyncStorage.getItem('session_stop_confirm_pref').then(val => {
            if (val === 'true') setPrefDontShowStop(true);
        });
    }, []);

    // Task State
    const [tasks, setTasks] = useState([
        { id: '1', title: 'Теория', subtitle: 'Изучить Королевский Гамбит', completed: false, completedAt: null as number | null },
        { id: '2', title: 'Практика', subtitle: 'Сыграть 2 партии', completed: false, completedAt: null as number | null },
        { id: '3', title: 'Анализ', subtitle: 'Рассмотреть партию', completed: false, completedAt: null as number | null },
        { id: '4', title: 'Задачи', subtitle: 'Решить 15 тактических задач', completed: false, completedAt: null as number | null },
    ]);

    const handleCompleteTask = (id: string) => {
        // Only allow completing if timer is running? User request: "When user start clocks and then he can click..."
        // We'll allow it anytime for flexibility, or restrict if strictly required.
        // Let's assume we capture the time regardless.

        setTasks(prev => prev.map(task => {
            if (task.id === id && !task.completed) {
                const timestamp = Date.now();

                return { ...task, completed: true, completedAt: timestamp };
            }
            return task;
        }));
    };

    // Timer Logic
    useEffect(() => {
        let interval: any;
        if (timerStatus === 'running' && timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft((prev) => prev - 1);
            }, 1000);
        } else if (timeLeft === 0) {
            setTimerStatus('idle'); // Or 'completed' if we had that state
        }
        return () => clearInterval(interval);
    }, [timerStatus, timeLeft]);

    // Animation Logic for Controls
    useEffect(() => {
        if (timerStatus !== 'idle') {
            Animated.timing(controlsAnim, {
                toValue: 1,
                duration: 1600, // Slowed down to 1 second
                useNativeDriver: true,
                easing: Easing.out(Easing.back(1.5)), // Slight overshoot for "pop" effect but smooth
            }).start();
        } else {
            controlsAnim.setValue(0);
        }
    }, [timerStatus]);

    // Drawer Animation Logic
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
                    toValue: -scale(300), // Move back off-screen
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

    // Format time mm:ss
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const progress = timeLeft / totalTime;

    const handlePlay = () => {
        setTimerStatus('running');
    };

    const handlePause = () => {
        if (timerStatus === 'running') {
            setTimerStatus('paused');
        } else {
            setTimerStatus('running');
        }
    };

    const handleReset = () => {
        setTimeLeft(totalTime);
        setTimerStatus('idle');
    };

    const handleStopPress = () => {
        if (prefDontShowStop) {
            handleStop();
        } else {
            setIsStopModalVisible(true);
        }
    };

    const confirmStop = async () => {
        if (dontShowAgainChecked) {
            await AsyncStorage.setItem('session_stop_confirm_pref', 'true');
            setPrefDontShowStop(true);
        }
        setIsStopModalVisible(false);

        // Check if there are completed tasks to show summary for
        const completedTasks = tasks.filter(t => t.completed);


        if (completedTasks.length > 0) {

            setShowSummary(true);
        } else {

            handleStop();
        }
    };

    const handleStop = () => {
        setTimeLeft(totalTime);
        setTimerStatus('idle');
        router.back();
    };

    // Render Summary if active
    if (showSummary && startTime) {
        return <SessionSummaryView tasks={tasks} startTime={startTime} onExit={handleStop} />;
    }

    const renderTabIcon = (tab: typeof TABS[0], index: number) => {
        const isActive = tab.key === 'home';
        const color = isActive ? '#000' : '#A3A3A3';
        const iconName = isActive ? tab.icon : tab.iconOutline;

        if (tab.type === 'ionicon') {
            return <Ionicons name={iconName as any} size={scale(28)} color={color} />;
        } else {
            return <MaterialCommunityIcons name={iconName as any} size={scale(28)} color={color} />;
        }
    };

    // Interpolations for sliding animations (Long Slide)
    const translateXReset = controlsAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [scale(120), 0], // Starts far right (behind center button), moves left to position
    });

    const translateXStop = controlsAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [scale(-120), 0], // Starts far left (behind center button), moves right to position
    });

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />

            <PagerView style={{ flex: 1 }} initialPage={0} ref={pagerViewRef}>
                {[
                    // Page 1: Timer
                    <View key="1" style={{ flex: 1 }}>
                        <View style={styles.header} />

                        {/* Visual Menu Button (Top Left) - Only visible when active */}
                        {timerStatus !== 'idle' && (
                            <Animated.View style={{ opacity: controlsAnim, position: 'absolute', top: scale(20), left: scale(24), zIndex: 10 }}>
                                <TouchableOpacity
                                    style={styles.floatingMenu}
                                    activeOpacity={0.7}
                                    onPress={() => setIsTaskListVisible(true)}
                                >
                                    <MaterialCommunityIcons name="format-list-checks" size={scale(24)} color="#1E1E2E" />
                                </TouchableOpacity>
                            </Animated.View>
                        )}

                        {/* Main Content */}
                        <View style={styles.content}>

                            {/* Timer Circle */}
                            <TimerProgress
                                size={scale(300)}
                                strokeWidth={scale(25)}
                                color={timerStatus === 'paused' ? colors.sessionTimer.pausedPrimary : colors.sessionTimer.primary}
                                trackColor={colors.sessionTimer.primaryFaded}
                                progress={progress}
                            >
                                <Text style={styles.timerText}>{formatTime(timeLeft)}</Text>
                            </TimerProgress>

                            {/* Controls */}
                            <View style={styles.controlsContainer}>
                                {timerStatus === 'idle' ? (
                                    // Initial State: Single Play Button
                                    <TouchableOpacity
                                        style={styles.playButton}
                                        onPress={handlePlay}
                                        activeOpacity={0.8}
                                    >
                                        <Ionicons
                                            name="play"
                                            size={scale(40)}
                                            color={colors.buttonTextPrimary}
                                            style={{ marginLeft: scale(5) }}
                                        />
                                    </TouchableOpacity>
                                ) : (
                                    // Active State: 3 Buttons
                                    <View style={styles.activeControls}>
                                        {/* Reset Button */}
                                        <Animated.View style={{ transform: [{ translateX: translateXReset }] }}>
                                            <TouchableOpacity
                                                style={styles.secondaryControl}
                                                onPress={handleReset}
                                                activeOpacity={0.8}
                                            >
                                                <MaterialCommunityIcons name="replay" size={scale(32)} color={colors.buttonTextPrimary} />
                                            </TouchableOpacity>
                                        </Animated.View>

                                        {/* Pause/Resume Button */}
                                        <TouchableOpacity
                                            style={[styles.playButton, { zIndex: 10, backgroundColor: timerStatus === 'paused' ? colors.sessionTimer.pausedPrimary : colors.sessionTimer.primary, shadowColor: timerStatus === 'paused' ? colors.sessionTimer.pausedPrimary : colors.sessionTimer.primary }]}
                                            onPress={handlePause}
                                            activeOpacity={0.8}
                                        >
                                            <Ionicons
                                                name={timerStatus === 'running' ? "pause" : "play"}
                                                size={scale(40)}
                                                color={colors.buttonTextPrimary}
                                                style={timerStatus === 'running' ? {} : { marginLeft: scale(5) }}
                                            />
                                        </TouchableOpacity>

                                        {/* Stop Button */}
                                        <Animated.View style={{ transform: [{ translateX: translateXStop }] }}>
                                            <TouchableOpacity
                                                style={styles.secondaryControl}
                                                onPress={handleStopPress}
                                                activeOpacity={0.8}
                                            >
                                                <Ionicons name="stop" size={scale(32)} color={colors.buttonTextPrimary} />
                                            </TouchableOpacity>
                                        </Animated.View>
                                    </View>
                                )}
                            </View>
                        </View>
                    </View>,

                    // Page 2: AI Chat UI - Only visible when timer is active
                    ...(timerStatus !== 'idle' ? [
                        <KeyboardAvoidingView
                            key="2"
                            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                            style={{ flex: 1 }}
                            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
                        >
                            <View key="2" style={styles.chatPage}>
                                {/* Header */}
                                <View style={styles.chatHeader}>
                                    <TouchableOpacity
                                        style={styles.chatMenuButton}
                                        activeOpacity={0.7}
                                        onPress={() => setIsTaskListVisible(true)}
                                    >
                                        <MaterialCommunityIcons name="format-list-checks" size={scale(24)} color="#1E1E2E" />
                                    </TouchableOpacity>
                                </View>

                                {/* Chat Area */}
                                <ScrollView
                                    style={styles.chatArea}
                                    contentContainerStyle={styles.chatContent}
                                    keyboardShouldPersistTaps="handled"
                                >
                                    {messages.length === 0 ? (
                                        <View style={{ marginTop: scale(100), alignItems: 'center' }}>
                                            <MaterialCommunityIcons name="robot-happy-outline" size={scale(48)} color="#A3A3A3" />
                                            <Text style={{ marginTop: scale(10), color: '#A3A3A3', fontFamily: 'Geometria-Light' }}>
                                                Я готов помочь!
                                            </Text>
                                        </View>
                                    ) : (
                                        messages.map((msg, index) => (
                                            <View
                                                key={index}
                                                style={[
                                                    styles.messageBubble,
                                                    msg.role === 'user' ? styles.userBubble : styles.assistantBubble
                                                ]}
                                            >
                                                <Text style={[
                                                    styles.messageText,
                                                    msg.role === 'user' ? styles.userText : styles.assistantText
                                                ]}>
                                                    {msg.content}
                                                </Text>
                                            </View>
                                        ))
                                    )}
                                    {isAiLoading && (
                                        <View style={[styles.messageBubble, styles.assistantBubble]}>
                                            <Text style={[styles.messageText, styles.assistantText]}>...</Text>
                                        </View>
                                    )}
                                </ScrollView>

                                {/* Input Area */}
                                <View style={styles.chatInputContainer}>
                                    <TextInput
                                        style={styles.chatInput}
                                        placeholder="Чем я могу помочь?"
                                        placeholderTextColor="#A3A3A3"
                                        value={chatInput}
                                        onChangeText={setChatInput}
                                        onSubmitEditing={handleSendMessage}
                                        returnKeyType="send"
                                    />
                                    <TouchableOpacity
                                        style={styles.sendButton}
                                        activeOpacity={0.8}
                                        onPress={handleSendMessage}
                                        disabled={isAiLoading}
                                    >
                                        <Ionicons name="send" size={scale(20)} color="white" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </KeyboardAvoidingView>
                    ] : [])
                ]}

            </PagerView>

            {/* Bottom Navigation */}
            <View style={styles.bottomNav}>
                {TABS.map((tab, index) => (
                    <TouchableOpacity
                        key={tab.key}
                        style={styles.navItem}
                        onPress={() => {
                            if (tab.key === 'home') router.dismissAll();
                            else router.push('/' + tab.key as any);
                        }}
                    >
                        {renderTabIcon(tab, index)}
                    </TouchableOpacity>
                ))}
            </View>

            <Animated.View
                style={[
                    styles.drawerBackdrop,
                    { opacity: backdropAnim }
                ]}
            >
                <Pressable
                    style={StyleSheet.absoluteFill}
                    onPress={() => {

                        setIsTaskListVisible(false);
                    }}
                />
            </Animated.View>

            {/* Side Drawer */}
            <Animated.View style={[styles.drawerContainer, { transform: [{ translateX: drawerAnim }] }]}>

                {/* Drawer Content */}
                <Text style={styles.drawerTitle}>Твои задачи</Text>

                <View style={styles.componentsContainer}>
                    {tasks.map(task => (
                        <View key={task.id} style={styles.taskCard}>
                            <Text style={styles.taskTitle}>{task.title}</Text>
                            <Text style={styles.taskSubtitle}>{task.subtitle}</Text>
                            <TouchableOpacity
                                style={[styles.addButton, task.completed && styles.completedButton]}
                                onPress={() => handleCompleteTask(task.id)}
                                disabled={task.completed}
                            >
                                <Ionicons
                                    name={task.completed ? "checkmark" : "add"}
                                    size={scale(24)}
                                    color={task.completed ? "#FFFFFF" : "#1E1E2E"}
                                />
                            </TouchableOpacity>
                        </View>
                    ))}
                </View>
            </Animated.View>


            {/* Stop Confirmation Modal */}
            {
                isStopModalVisible && (
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContainer}>
                            {/* Red Hand Icon */}
                            <View style={{ marginBottom: scale(20), alignItems: 'center', justifyContent: 'center', width: scale(80), height: scale(80) }}>
                                <Svg width={scale(80)} height={scale(80)} viewBox="0 0 100 100" fill="none" style={{ position: 'absolute' }}>
                                    <Circle cx="50" cy="50" r="50" fill="#FF4B55" />
                                </Svg>
                                <MaterialCommunityIcons name="hand-back-right" size={scale(40)} color="white" />
                            </View>

                            <Text style={styles.modalTitle}>Вы действительно хотите завершить занятие?</Text>

                            {/* Checkbox */}
                            <TouchableOpacity
                                style={styles.checkboxContainer}
                                activeOpacity={0.8}
                                onPress={() => setDontShowAgainChecked(!dontShowAgainChecked)}
                            >
                                <View style={[styles.checkboxData, dontShowAgainChecked && styles.checkboxChecked]}>
                                    {dontShowAgainChecked && <Ionicons name="checkmark" size={scale(12)} color="white" />}
                                </View>
                                <Text style={styles.checkboxLabel}>Больше не показывать</Text>
                            </TouchableOpacity>

                            {/* Buttons */}
                            <View style={styles.modalButtonsRow}>
                                <TouchableOpacity
                                    style={styles.modalButtonGray}
                                    onPress={() => setIsStopModalVisible(false)}
                                >
                                    <Text style={styles.modalButtonText}>Назад</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.modalButtonGray}
                                    onPress={confirmStop}
                                >
                                    <Text style={styles.modalButtonTextBold}>Завершить</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                )
            }
        </SafeAreaView >
    );
};

const TOTAL_SESSION_SECONDS = 30 * 60; // 30 minutes = 100% of circle

const SessionSummaryView = ({ tasks, startTime, onExit }: { tasks: any[], startTime: number, onExit: () => void }) => {
    const completedTasks = tasks.filter(t => t.completed).sort((a, b) => (a.completedAt || 0) - (b.completedAt || 0));
    const scrollX = useRef(new Animated.Value(0)).current; // Track scroll position
    const pagerRef = useRef<PagerView>(null);

    // Formatting helper
    const getElapsedString = (completedAt: number) => {
        if (!startTime) return "0:00";
        const diffSeconds = Math.max(0, Math.floor((completedAt - startTime) / 1000));
        const mins = Math.floor(diffSeconds / 60);
        const secs = diffSeconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Calculate circle progress: elapsed time / 30 minutes, capped at 1.0
    const getTaskProgress = (completedAt: number) => {
        if (!startTime || !completedAt) return 0;
        const diffSeconds = Math.max(0, Math.floor((completedAt - startTime) / 1000));
        return Math.min(diffSeconds / TOTAL_SESSION_SECONDS, 1.0);
    };

    return (
        <View style={styles.summaryContainer}>
            <PagerView
                style={styles.pagerView}
                initialPage={0}
                ref={pagerRef}
                onPageScroll={Animated.event(
                    [{ nativeEvent: { position: scrollX, offset: scrollX } }], // Simplify to just passed directly? No, onPageScroll payload is {position, offset}
                    {
                        useNativeDriver: false,
                        listener: (e: any) => {
                            const { position, offset } = e.nativeEvent;
                            scrollX.setValue(position + offset);
                        }
                    }
                ) as any}
            >
                {completedTasks.map((task, index) => {
                    const taskProgress = getTaskProgress(task.completedAt);
                    const circumference = 2 * Math.PI * 109;
                    return (
                        <View key={task.id} style={styles.summaryPage}>
                            {/* Circle with Number */}
                            <View style={styles.summaryCircleContainer}>
                                <Svg
                                    style={{ position: 'absolute' }}
                                    width={256}
                                    height={256}
                                    viewBox="0 0 256 256"
                                    fill="none"
                                >
                                    <Circle cx="128" cy="128" r="109" stroke={index % 2 === 0 ? "#B3C6F2" : "#B0D5F3"} strokeWidth="38" />
                                    <Circle
                                        cx="128"
                                        cy="128"
                                        r="109"
                                        stroke={index % 2 === 0 ? "#3975E5" : "#43C2F8"} // Alternate colors
                                        strokeWidth="38"
                                        strokeDasharray={`${circumference * taskProgress} ${circumference}`}
                                        strokeLinecap="round"
                                        rotation="-90"
                                        origin="128, 128"
                                    />
                                </Svg>
                                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' }}>
                                    <Text style={styles.summaryCountText}>{index + 1}</Text>
                                </View>
                            </View>

                            <Text style={styles.summaryTimeText}>{getElapsedString(task.completedAt)}</Text>
                            <Text style={styles.summaryLabelText}>
                                Время выполнения{'\n'}
                                {index + 1} задачи
                            </Text>


                        </View>
                    );
                })}
            </PagerView>

            <View style={styles.paginationRow}>
                {completedTasks.map((_, i) => {
                    const inputRange = [i - 1, i, i + 1];
                    const dotWidth = scrollX.interpolate({
                        inputRange,
                        outputRange: [scale(13), scale(65), scale(13)],
                        extrapolate: 'clamp',
                    });
                    const dotOpacity = scrollX.interpolate({
                        inputRange,
                        outputRange: [0.2, 1, 0.2], // Inactive dots have 20% opacity
                        extrapolate: 'clamp',
                    });

                    return (
                        <Animated.View
                            key={i}
                            style={[
                                styles.activeDot, // Base style (height, radius)
                                {
                                    width: dotWidth,
                                    backgroundColor: '#2E2E43', // Uniform color as requested
                                    opacity: dotOpacity
                                }
                            ]}
                        />
                    );
                })}
            </View>

            <View style={styles.summaryFooter}>
                <TouchableOpacity style={styles.summaryButton} onPress={onExit}>
                    <Text style={styles.summaryButtonText}>Завершить</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.sessionTimer.background,
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    header: {
        height: scale(50),
    },
    floatingMenu: {
        width: scale(48),
        height: scale(48),
        borderRadius: scale(24),
        backgroundColor: colors.buttonTextPrimary,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
    },
    content: {
        flex: 1,
        justifyContent: 'center', // Center vertically
        alignItems: 'center', // Center horizontally
        marginTop: scale(20), // Added to push the timer further down
    },
    timerText: {
        fontSize: scale(64),
        fontFamily: 'Gramatika-Bold', // Ensure this font exists or use System/Roboto
        color: colors.sessionTimer.text,
        fontWeight: 'bold',
        position: 'absolute',
    },
    controlsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: scale(20), // Space between Timer and Controls
        height: scale(100), // Fixed height to prevent layout jumps
    },
    playButton: {
        width: scale(80),
        height: scale(80),
        borderRadius: scale(40),
        backgroundColor: colors.sessionTimer.primary,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: colors.sessionTimer.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    },
    activeControls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(20), // Reduced gap to keep buttons closer
        position: 'absolute', // To overlay perfectly if needed, but flex gap is safer
    },
    secondaryControl: {
        width: scale(60),
        height: scale(60),
        borderRadius: scale(30),
        backgroundColor: colors.sessionTimer.text,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 5,
    },
    bottomNav: {
        height: scale(60),
        marginHorizontal: scale(16),
        marginBottom: scale(16),
        borderRadius: scale(47),
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
    },
    navItem: {
        padding: scale(12),
    },
    // Drawer Styles
    drawerBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
        zIndex: 100, // Below drawer but above content
    },
    drawerContainer: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: scale(286), // Fixed width from request
        backgroundColor: '#102852', // Dark Blue background
        zIndex: 101, // Top most
        paddingHorizontal: scale(25),
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center', // Center content vertically
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 5, height: 0 }, // Right shadow
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 20,
    },
    drawerTitle: {
        color: '#EAF0F8',
        fontFamily: 'Gramatika-Bold',
        fontSize: scale(32),
        fontWeight: '700',
        lineHeight: scale(38), // Increased to avoid clipping (was 23px)
        alignSelf: 'stretch',
        marginBottom: scale(20),
    },
    componentsContainer: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: scale(10),
        alignSelf: 'stretch',
    },
    // Shared Task Card Styling for Drawer
    taskCard: {
        backgroundColor: '#1E293B',
        borderRadius: scale(16),
        padding: scale(16),
        width: '100%',
    },
    taskTitle: {
        color: 'white',
        fontSize: scale(18),
        fontFamily: 'Gramatika-Bold',
        marginBottom: scale(4),
    },
    taskSubtitle: {
        color: '#94A3B8',
        fontSize: scale(14),
        fontFamily: 'Gramatika-Regular',
        marginBottom: scale(12),
    },
    addButton: {
        backgroundColor: '#E2E8F0',
        borderRadius: scale(20),
        height: scale(36),
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: scale(8),
    },
    completedButton: {
        backgroundColor: '#4ADE80', // Green color (Tailwind green-400 equivalent)
    },
    // Modal Styles
    modalOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 200,
    },
    modalContainer: {
        width: '85%', // Responsive width
        backgroundColor: 'white',
        borderRadius: scale(24),
        padding: scale(24),
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 10,
    },
    modalIconContainer: {
        marginBottom: scale(16),
    },
    modalTitle: {
        fontFamily: 'Gramatika-Bold',
        fontSize: scale(20),
        color: '#1E1E2E',
        textAlign: 'center',
        marginBottom: scale(24),
        lineHeight: scale(26),
    },
    checkboxContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: scale(32),
    },
    checkboxData: {
        width: scale(20),
        height: scale(20),
        borderRadius: scale(10), // Circle
        borderWidth: 1,
        borderColor: '#C4C4C4',
        marginRight: scale(10),
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F5F5F5',
    },
    checkboxChecked: {
        backgroundColor: '#37A0EF', // Primary Blue
        borderColor: '#37A0EF',
    },
    checkboxLabel: {
        fontFamily: 'Gramatika-Regular',
        fontSize: scale(14),
        color: '#8E8E93',
    },
    modalButtonsRow: {
        flexDirection: 'row',
        gap: scale(12),
        width: '100%',
    },
    modalButtonGray: {
        flex: 1,
        backgroundColor: '#E5E5EA', // Light gray standard iOS style
        borderRadius: scale(14),
        paddingVertical: scale(16),
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalButtonText: {
        fontFamily: 'Gramatika-Regular',
        fontSize: scale(16),
        color: '#000',
    },
    modalButtonTextBold: {
        fontFamily: 'Gramatika-Bold',
        fontSize: scale(16),
        color: '#000',
    },
    // Summary Styles
    summaryContainer: {
        flex: 1,
        backgroundColor: colors.sessionTimer.background,
    },
    pagerView: {
        flex: 1,
    },
    summaryPage: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    summaryCircleContainer: {
        width: 256,
        height: 256,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: scale(24),
        marginTop: scale(120), // Push lower as requested
    },
    summaryCountText: {
        fontFamily: 'Gramatika-Bold',
        fontSize: 96,
        color: '#08132A',
        textAlign: 'center',
    },
    summaryTimeText: {
        fontFamily: 'Gramatika-Bold',
        fontSize: 48,
        lineHeight: 56,
        color: '#08132A',
        marginBottom: scale(8),
        textAlign: 'center',
    },
    summaryLabelText: {
        fontFamily: 'Geometria-Light',
        fontSize: 24,
        lineHeight: 24,
        color: '#08132A',
        textAlign: 'center',
    },
    // ... items before ...
    activeDot: {
        width: 65,
        height: 13,
        borderRadius: 31,
        backgroundColor: '#2E2E43', // Reverted to Dark Grey to match Goal (was #102852)
    },
    inactiveDot: {
        width: 13,
        height: 13,
        borderRadius: 31,
        backgroundColor: '#2E2E43',
        opacity: 0.5,
    },
    paginationRow: {
        flexDirection: 'row',
        paddingBottom: scale(40), // Match MainTabsScreen style
        gap: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    summaryFooter: {
        alignItems: 'center',
        paddingBottom: scale(48),
    },
    summaryButton: {
        backgroundColor: '#102852',
        width: 359,
        height: 55,
        borderRadius: 45,
        justifyContent: 'center',
        alignItems: 'center',
    },
    summaryButtonText: {
        fontFamily: 'Gramatika-Bold',
        fontSize: 18,
        color: 'white',
    },
    yourDayPage: {
        width: SCREEN_WIDTH,
        flex: 1,
        backgroundColor: '#EAF0F8',
        paddingHorizontal: scale(20),
    },
    yourDayTitle: {
        fontFamily: 'Gramatika-Bold',
        fontSize: scale(32),
        lineHeight: scale(34),
        color: '#2E2E43',
        marginBottom: scale(80),
        paddingHorizontal: scale(0),
    },
    theoryCard: {
        height: scale(119),
        alignSelf: 'stretch',
        borderRadius: scale(25),
        backgroundColor: '#8CDEFF',
        paddingLeft: scale(28),
        paddingRight: scale(20),
        paddingVertical: scale(18),
        marginBottom: scale(10),
    },
    practiceCard: {
        height: scale(100),
        alignSelf: 'stretch',
        borderRadius: scale(25),
        backgroundColor: '#78BAFF',
        paddingLeft: scale(28),
        paddingRight: scale(20),
        paddingVertical: scale(18),
        marginBottom: scale(10),
    },
    analysisCard: {
        height: scale(101),
        alignSelf: 'stretch',
        borderRadius: scale(25),
        backgroundColor: '#F4C0FD',
        paddingLeft: scale(28),
        paddingRight: scale(20),
        paddingVertical: scale(18),
        marginBottom: scale(10),
    },
    analysisTitle: {
        fontFamily: 'Gramatika-Bold',
        fontSize: scale(24),
        lineHeight: scale(26),
        color: '#000',
        marginBottom: scale(6),
    },
    analysisDescription: {
        fontFamily: 'Geometria-Light',
        fontSize: scale(19),
        lineHeight: scale(22),
        color: '#000',
        alignSelf: 'stretch',
    },
    analysisIconContainer: {
        width: scale(40),
        height: scale(40),
        backgroundColor: '#08132A',
        borderRadius: scale(10),
        justifyContent: 'center',
        alignItems: 'center',
    },
    tasksCard: {
        height: scale(123),
        alignSelf: 'stretch',
        borderRadius: scale(25),
        backgroundColor: '#F9A9FD',
        paddingLeft: scale(28),
        paddingRight: scale(20),
        paddingVertical: scale(18),
        marginBottom: scale(10),
    },
    tasksTitle: {
        fontFamily: 'Gramatika-Bold',
        fontSize: scale(24),
        lineHeight: scale(26),
        color: '#000',
        marginBottom: scale(6),
    },
    tasksDescription: {
        fontFamily: 'Geometria-Light',
        fontSize: scale(20),
        lineHeight: scale(22),
        color: '#2E2E43',
        width: scale(322),
    },
    tasksIconContainer: {
        width: scale(40),
        height: scale(100),
        backgroundColor: '#08132A',
        borderRadius: scale(10),
        justifyContent: 'center',
        alignItems: 'center',
    },
    taskCardContent: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    taskCardTextContainer: {
        flex: 1,
    },
    taskCardTitle: {
        fontFamily: 'Gramatika-Bold',
        fontSize: scale(24),
        lineHeight: scale(26),
        color: '#08132A',
        marginBottom: scale(6),
        paddingHorizontal: scale(0),
    },
    taskCardDescription: {
        fontFamily: 'Geometria-Light',
        fontSize: scale(19),
        lineHeight: scale(23),
        color: '#08132A',
    },
    theoryIconContainer: {
        width: scale(42),
        height: scale(42),
        backgroundColor: '#08132A',
        borderRadius: scale(10),
        justifyContent: 'center',
        alignItems: 'center',
    },
    practiceIconContainer: {
        width: scale(40),
        height: scale(40),
        backgroundColor: '#08132A',
        borderRadius: scale(10),
        justifyContent: 'center',
        alignItems: 'center',
    },
    addTaskCard: {
        alignSelf: 'stretch',
        borderRadius: scale(25),
        backgroundColor: '#D3DEEE',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: scale(25),
    },
    // AI Chat Styles
    chatPage: {
        flex: 1,
        backgroundColor: '#EAF0F8', // Matches screenshot background
        paddingTop: Platform.OS === 'android' ? scale(60) : scale(60), // Space for status bar/header
    },
    chatHeader: {
        position: 'absolute',
        top: scale(20), // Higher position
        left: scale(24),
        zIndex: 10,
    },
    chatMenuButton: {
        width: scale(48),
        height: scale(48),
        borderRadius: scale(24),
        backgroundColor: '#E2E8F0', // Slightly darker than background for button
        justifyContent: 'center',
        alignItems: 'center',
    },
    chatArea: {
        flex: 1,
        paddingHorizontal: scale(20),
    },
    chatContent: {
        paddingBottom: scale(100), // Space for input area
    },
    chatInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E2E8F0', // Input background
        borderRadius: scale(30),
        marginHorizontal: scale(20),
        marginBottom: scale(20), // Lift up above bottom nav
        paddingHorizontal: scale(6), // Padding for the container
        paddingVertical: scale(6),
        height: scale(60),
    },
    // Message Bubbles
    messageBubble: {
        maxWidth: '80%',
        padding: scale(12),
        borderRadius: scale(16),
        marginBottom: scale(10),
    },
    userBubble: {
        alignSelf: 'flex-end',
        backgroundColor: '#102852', // Dark blue for user
        borderBottomRightRadius: scale(4),
    },
    assistantBubble: {
        alignSelf: 'flex-start',
        backgroundColor: '#FFFFFF', // White for AI
        borderBottomLeftRadius: scale(4),
    },
    messageText: {
        fontSize: scale(16),
        fontFamily: 'Geometria-Light',
        lineHeight: scale(22),
    },
    userText: {
        color: '#FFFFFF',
    },
    assistantText: {
        color: '#1E1E2E',
    },
    chatInput: {
        flex: 1,
        height: '100%',
        paddingHorizontal: scale(16),
        fontFamily: 'Geometria-Light',
        fontSize: scale(16),
        color: '#1E1E2E',
    },
    sendButton: {
        width: scale(48),
        height: scale(48),
        borderRadius: scale(24),
        backgroundColor: '#102852', // Dark blue specific to app theme
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default SessionTimerScreen;
