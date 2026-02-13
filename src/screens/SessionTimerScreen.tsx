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
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Circle, Path, Rect, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import PagerView from 'react-native-pager-view';
import { scale } from '../constants';
import { colors } from '../theme';

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
        { id: '1', title: 'Дебют', subtitle: 'Изучить Королевский Гамбит', completed: false, completedAt: null as number | null },
        { id: '2', title: 'Практика', subtitle: 'Сыграть 2 партии', completed: false, completedAt: null as number | null },
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

            <View style={styles.header} />

            {/* Visual Menu Button (Top Left) - Only visible when active */}
            {timerStatus !== 'idle' && (
                <Animated.View style={{ opacity: controlsAnim, position: 'absolute', top: scale(100), left: scale(24), zIndex: 10 }}>
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
                    color={colors.sessionTimer.primary}
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
                                style={[styles.playButton, { zIndex: 10 }]}
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
                                    <Circle cx="128" cy="128" r="109" stroke="#B3C6F2" strokeWidth="38" />
                                    <Circle
                                        cx="128"
                                        cy="128"
                                        r="109"
                                        stroke="#3975E5"
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
        marginBottom: scale(80), // Lift it up slightly from bottom nav
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
        marginTop: scale(60), // Space between Timer and Controls
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
});

export default SessionTimerScreen;
