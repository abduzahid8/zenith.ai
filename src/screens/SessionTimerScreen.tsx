import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    StatusBar,
    TouchableOpacity,
    Dimensions,
    Modal,
    LayoutAnimation,
    Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import Svg, { Circle, G, Path } from 'react-native-svg';

// Screen Dimensions
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const FIGMA_WIDTH = 402;
const scale = (size: number) => (SCREEN_WIDTH / FIGMA_WIDTH) * size;

// Colors from Request
const COLORS = {
    background: '#FFFFFF',
    text: '#000000',
    primary: '#6E5EFF', // Timer function color
    toggleActiveBg: '#BABABA', // Darker grey for active toggle
    toggleInactiveBg: '#F1F1F1', // Light grey for inactive toggle
    controlLight: '#F1F1F1', // Second (Reset) and Fourth (Stop) buttons
    controlDark: '#C4C4C4', // Third (Play) button
    iconDark: '#3A3A3A',
    iconBlack: '#020202',
    summaryCardBg: '#D9D9D9', // Approx grey from screenshot
};

// Play Icon SVG
const PlayIcon = () => (
    <Svg width={scale(31)} height={scale(34)} viewBox="0 0 31 34" fill="none">
        <Path d="M28.3334 13.1556C31.0439 14.6864 31.0439 18.5904 28.3334 20.1213L5.96712 32.7538C3.30064 34.2598 2.98024e-07 32.3333 2.98024e-07 29.2709V4.00595C2.98024e-07 0.943553 3.30064 -0.982947 5.96712 0.523083L28.3334 13.1556Z" fill="#3A3A3A" />
    </Svg>
);

const TaskProgressIcon = ({ number }: { number: number }) => (
    <View style={{ width: scale(108), height: scale(108), justifyContent: 'center', alignItems: 'center' }}>
        <Svg width={scale(108)} height={scale(108)} viewBox="0 0 108 108" fill="none" style={{ position: 'absolute' }}>
            <Circle cx="54" cy="54" r="44" stroke="#DCDCDC" strokeWidth="20" />
            <Path d="M54 9.89734C54 4.43119 58.4678 -0.0919748 63.8424 0.904367C73.9807 2.78381 83.4429 7.54257 91.0451 14.7106C101.066 24.1588 107.098 37.0788 107.907 50.8274C108.716 64.5761 104.241 78.1144 95.398 88.6728C88.689 96.6831 79.8504 102.519 70.0025 105.575C64.7819 107.194 59.8144 103.227 59.1732 97.7982C58.532 92.3698 62.5184 87.5758 67.5381 85.4122C72.4056 83.3143 76.7616 80.0954 80.2228 75.9629C85.8244 69.2749 88.6588 60.6993 88.1462 51.9904C87.6337 43.2815 83.8129 35.0976 77.4656 29.1128C73.5435 25.4148 68.84 22.7291 63.7601 21.2166C58.5212 19.6568 54 15.3635 54 9.89734Z" fill="#BCBCBC" />
        </Svg>
        <Text style={{ fontFamily: 'Gramatika-Bold', fontSize: scale(40), color: '#000' }}>{number}</Text>
    </View>
);

export const SessionTimerScreen: React.FC = () => {
    const router = useRouter();
    const [streakDays] = useState(4);
    const [activeView, setActiveView] = useState<'timer' | 'list' | 'ai-chat'>('timer');

    // Helper to switch to AI Chat with animation
    const handleAICoachClick = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setActiveView('ai-chat');
    };

    // Helper to switch to list view with animation
    const handleListClick = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setActiveView('list');
    };

    // Timer State
    const INITIAL_DURATION = 30 * 60; // 30 minutes
    const [timeLeft, setTimeLeft] = useState(INITIAL_DURATION);
    const [isRunning, setIsRunning] = useState(false);
    const [hasStarted, setHasStarted] = useState(false);
    const [showChecklist, setShowChecklist] = useState(false);
    const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);

    // Tasks List - Not used in new design but kept for state reference if needed
    const initialTasks = [
        'Изучить 1 базовый дебют',
        'Сыграть 2 партии без отвлечений',
    ];
    const [tasks, setTasks] = useState(initialTasks.map(t => ({ text: t, completed: false })));

    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const progressAnim = useRef(new Animated.Value(1)).current;
    const [progressValue, setProgressValue] = useState(1);

    // Circle config
    const size = scale(310);
    const strokeWidth = scale(25);
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;

    // Listen to animated value changes
    useEffect(() => {
        const listenerId = progressAnim.addListener(({ value }) => {
            setProgressValue(value);
        });
        return () => {
            progressAnim.removeListener(listenerId);
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, []);

    // Calculate strokeDashoffset based on progress
    const strokeDashoffset = circumference * (1 - progressValue);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const handleStartPause = () => {
        if (!hasStarted) setHasStarted(true);

        if (isRunning) {
            // PAUSE
            setIsRunning(false);
            if (intervalRef.current) clearInterval(intervalRef.current);
            progressAnim.stopAnimation();
        } else {
            // START
            setIsRunning(true);

            // Animate progress to 0 over the remaining time
            Animated.timing(progressAnim, {
                toValue: 0,
                duration: timeLeft * 1000,
                easing: (t) => t, // linear
                useNativeDriver: false,
            }).start();

            intervalRef.current = setInterval(() => {
                setTimeLeft((prev) => {
                    if (prev <= 1) {
                        if (intervalRef.current) clearInterval(intervalRef.current);
                        setIsRunning(false);
                        progressAnim.stopAnimation();
                        progressAnim.setValue(0);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
    };

    const handleReset = () => {
        setIsRunning(false);
        if (intervalRef.current) clearInterval(intervalRef.current);
        progressAnim.stopAnimation();
        setTimeLeft(INITIAL_DURATION);
        Animated.timing(progressAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: false,
        }).start();
    };

    const handleStop = () => {
        console.log('Stop button clicked');
        setIsRunning(false);
        if (intervalRef.current) clearInterval(intervalRef.current);
        progressAnim.stopAnimation();

        // Show second picture page (List View)
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setActiveView('list');
        setIsSummaryExpanded(true);
    };

    const handleFinishSession = () => {
        console.log('Finishing session -> Navigating to stats');
        setShowChecklist(false);
        // Navigate to statistics or home after finishing
        router.replace('/statistics');
    };

    const toggleTask = (index: number) => {
        const newTasks = [...tasks];
        newTasks[index].completed = !newTasks[index].completed;
        setTasks(newTasks);
    };

    const handleNavigateHome = () => router.replace('/home');
    const handleNavigateStatistics = () => router.push('/statistics');
    const handleNavigateAICoach = () => router.push('/ai-coach-chat');
    const handleNavigateWeeklyPlan = () => router.push('/weekly-plan');

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerRight}>
                    <View style={styles.streakContainer}>
                        <Text style={styles.streakNumber}>{streakDays}</Text>
                        <Text style={styles.fireIcon}>🔥</Text>
                    </View>
                    <TouchableOpacity style={styles.menuButton}>
                        <Feather name="menu" size={scale(24)} color="#000" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Toggles Row - Common */}
            <View style={styles.togglesRow}>
                <TouchableOpacity
                    style={[
                        styles.toggleButton,
                        { backgroundColor: activeView === 'timer' ? COLORS.toggleActiveBg : COLORS.toggleInactiveBg }
                    ]}
                    onPress={() => setActiveView('timer')}
                >
                    <MaterialCommunityIcons
                        name="clock-outline"
                        size={scale(32)}
                        color={COLORS.iconBlack}
                    />
                </TouchableOpacity>

                {/* List Toggle - Only visible after start */}
                {hasStarted && (
                    <TouchableOpacity
                        style={[
                            styles.toggleButton,
                            { backgroundColor: activeView === 'list' ? COLORS.toggleActiveBg : COLORS.toggleInactiveBg }
                        ]}
                        onPress={() => setActiveView('list')}
                    >
                        <MaterialCommunityIcons
                            // Updated icon to match screenshot (List with checks)
                            name="format-list-checks"
                            size={scale(32)}
                            color={COLORS.iconBlack}
                        />
                    </TouchableOpacity>
                )}
            </View>

            {activeView === 'timer' ? (
                /* Timer View Logic */
                <>
                    {/* Timer Circle */}
                    <View style={styles.timerContainer}>
                        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                            <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
                                <Circle
                                    cx={size / 2}
                                    cy={size / 2}
                                    r={radius}
                                    stroke="#E0E0E0"
                                    strokeWidth={strokeWidth}
                                    fill="none"
                                />
                                <Circle
                                    cx={size / 2}
                                    cy={size / 2}
                                    r={radius}
                                    stroke={COLORS.primary}
                                    strokeWidth={strokeWidth}
                                    strokeLinecap="round"
                                    strokeDasharray={`${circumference} ${circumference}`}
                                    strokeDashoffset={strokeDashoffset}
                                    fill="none"
                                />
                            </G>
                        </Svg>

                        <View style={[styles.timeDisplay, { width: size, height: size }]}>
                            <Text style={styles.timeText}>{formatTime(timeLeft)}</Text>
                        </View>
                    </View>

                    {/* Controls */}
                    <View style={styles.controlsRow}>
                        <TouchableOpacity style={styles.secondButton} onPress={handleReset}>
                            <MaterialCommunityIcons name="restart" size={scale(34)} color={COLORS.iconDark} />
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.thirdButton} onPress={handleStartPause}>
                            {isRunning ? (
                                <Ionicons name="pause" size={scale(40)} color={COLORS.iconDark} />
                            ) : (
                                <PlayIcon />
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.fourthButton} onPress={handleStop}>
                            <View style={styles.fourthButtonIcon} />
                        </TouchableOpacity>
                    </View>

                    {/* Bottom Navigation */}
                    <View style={styles.bottomNav}>
                        <TouchableOpacity style={styles.navItem} onPress={handleNavigateHome}>
                            <Ionicons name="home" size={scale(28)} color="#000" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.navItem} onPress={handleNavigateStatistics}>
                            <Ionicons name="bar-chart-outline" size={scale(28)} color="#A3A3A3" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.navItem} onPress={handleNavigateAICoach}>
                            <MaterialCommunityIcons name="lightbulb-outline" size={scale(28)} color="#A3A3A3" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.navItem} onPress={handleNavigateWeeklyPlan}>
                            <MaterialCommunityIcons name="calendar-text" size={scale(28)} color="#A3A3A3" />
                        </TouchableOpacity>
                    </View>
                </>
            ) : (
                /* Summary / List View */
                <View style={styles.listContainer}>
                    {/* Buttons 3 & 4 (Top Row) */}
                    <View style={styles.listControlRow}>
                        <View style={{ height: scale(50), width: activeView === 'list' ? scale(240) : scale(70) }}>
                            <TouchableOpacity
                                style={[
                                    styles.thirdButtonNew,
                                    {
                                        width: '100%',
                                        backgroundColor: activeView === 'list' ? '#C2C2C2' : '#E2E2E2'
                                    }
                                ]}
                                onPress={handleListClick}
                                activeOpacity={0.8}
                            >
                                <MaterialCommunityIcons name="format-list-checks" size={scale(24)} color="#000" />
                            </TouchableOpacity>
                        </View>

                        <View style={{ height: scale(50), width: activeView === 'ai-chat' ? scale(240) : scale(70) }}>
                            <TouchableOpacity
                                style={[
                                    styles.fourthButtonNew,
                                    {
                                        width: '100%',
                                        backgroundColor: activeView === 'ai-chat' ? '#C2C2C2' : '#E2E2E2'
                                    }
                                ]}
                                onPress={handleAICoachClick}
                                activeOpacity={0.8}
                            >
                                <MaterialCommunityIcons name="lightbulb-on-outline" size={scale(24)} color="#000" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {activeView === 'list' ? (
                        <View style={{ flex: 1, width: '100%', alignItems: 'center' }}>
                            {/* Button 5 (Task 1) */}
                            <TouchableOpacity style={styles.taskButton}>
                                <View style={styles.taskIconWrapper}>
                                    <Svg width={scale(28)} height={scale(28)} viewBox="0 0 28 28" fill="none">
                                        <Circle cx="14" cy="12" r="12" fill="#C2C2C2" />
                                    </Svg>
                                </View>
                                <Text style={styles.taskText}>Изучить 1 базовый дебют</Text>
                            </TouchableOpacity>

                            {/* Button 6 (Task 2) */}
                            <TouchableOpacity style={styles.taskButton}>
                                <View style={styles.taskIconWrapper}>
                                    <Svg width={scale(28)} height={scale(28)} viewBox="0 0 28 28" fill="none">
                                        <Circle cx="14" cy="12" r="12" fill="#C2C2C2" />
                                    </Svg>
                                </View>
                                {/* Width limited text per spec */}
                                <Text style={[styles.taskText, { maxWidth: scale(263) }]}>Сыграть 2 партии без отвлечений</Text>
                            </TouchableOpacity>

                            <View style={styles.continueButtonWrapper}>
                                <TouchableOpacity
                                    style={styles.continueButton}
                                    onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setActiveView('timer'); }}
                                >
                                    <Text style={styles.continueButtonText}>Продолжить</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        // AI Chat View
                        <View style={{ flex: 1, width: '100%', justifyContent: 'flex-end', marginBottom: scale(34) }}>
                            <View style={styles.chatInputBar}>
                                <Text style={styles.chatInputPlaceholder}>Чем я могу помочь?</Text>
                                <TouchableOpacity>
                                    <Ionicons name="arrow-forward" size={scale(24)} color="#000" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                </View>
            )}

            {/* Checklist Popup */}
            <Modal
                visible={showChecklist}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowChecklist(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Что удалось сделать?</Text>

                        {tasks.map((task, index) => (
                            <TouchableOpacity
                                key={index}
                                style={styles.modalTaskRow}
                                onPress={() => toggleTask(index)}
                            >
                                <View style={[styles.checkbox, task.completed && styles.checkboxChecked]}>
                                    {task.completed && <Ionicons name="checkmark" size={scale(16)} color="#FFF" />}
                                </View>
                                <Text style={styles.modalTaskText}>{task.text}</Text>
                            </TouchableOpacity>
                        ))}

                        <TouchableOpacity
                            style={styles.finishButton}
                            onPress={handleFinishSession}
                        >
                            <Text style={styles.finishButtonText}>Завершить</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

        </SafeAreaView >
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingHorizontal: scale(24),
        paddingTop: scale(16),
        paddingBottom: scale(10),
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(8),
    },
    streakContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(4),
    },
    streakNumber: {
        fontFamily: 'Gramatika-Bold',
        fontSize: scale(24),
        lineHeight: scale(21),
        color: '#000',
    },
    fireIcon: {
        fontSize: scale(24),
    },
    menuButton: {
        padding: scale(4),
    },

    // Toggles
    togglesRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: scale(20),
        marginTop: scale(20),
        marginBottom: scale(40),
    },
    toggleButton: {
        width: scale(75),
        height: scale(75),
        borderRadius: scale(25),
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Timer
    timerContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: scale(50),
    },
    timeDisplay: {
        position: 'absolute',
        justifyContent: 'center',
        alignItems: 'center',
    },
    timeText: {
        fontFamily: 'Gramatika-Bold',
        fontSize: scale(64),
        lineHeight: scale(70),
        color: '#1E1E2E',
        textAlign: 'right',
    },

    // Controls
    controlsRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: scale(20),
        // bottom: scale(190), // Removed as we want it in flow or aligned by margin now, 
        // user requested "higher" before but now we structure it in flow unless user wants fixed.
        // I will keep it in flow with margin to be safe in the 'timer' block.
        marginTop: scale(40),
        marginBottom: scale(40),
    },
    secondButton: {
        width: scale(65),
        height: scale(65),
        padding: scale(17),
        borderRadius: scale(32.5),
        backgroundColor: COLORS.controlLight,
        justifyContent: 'center',
        alignItems: 'center',
    },
    thirdButton: {
        width: scale(85),
        height: scale(85),
        borderRadius: scale(42.5),
        backgroundColor: COLORS.controlDark,
        justifyContent: 'center',
        alignItems: 'center',
    },
    fourthButton: {
        width: scale(65),
        height: scale(65),
        padding: scale(20),
        borderRadius: scale(32.5),
        backgroundColor: COLORS.controlLight,
        justifyContent: 'center',
        alignItems: 'center',
    },
    fourthButtonIcon: {
        width: scale(24),
        height: scale(24),
        borderRadius: scale(5),
        backgroundColor: COLORS.iconDark,
    },

    // Bottom Navigation
    bottomNav: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        height: scale(60),
        marginHorizontal: scale(16),
        marginBottom: scale(16),
        marginTop: 'auto',
        borderRadius: scale(47),
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
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

    // Summary View Styles
    summaryContainer: {
        flex: 1,
        paddingHorizontal: scale(24),
        paddingTop: scale(20),
    },
    summaryCard: {
        backgroundColor: COLORS.summaryCardBg,
        borderRadius: scale(24),
        padding: scale(32), // Increased padding
        width: '100%',
        height: scale(150), // Approx height
    },
    summaryTimeText: {
        fontFamily: 'Gramatika-Bold',
        fontSize: scale(36),
        color: '#000',
        marginBottom: scale(4),
    },
    summaryLabelText: {
        fontFamily: 'Gramatika-Regular',
        fontSize: scale(18),
        color: '#000',
        lineHeight: scale(22),
        maxWidth: '80%', // Ensure wrapping
    },
    // New Expanded Styles
    expandedList: {
        marginTop: scale(24),
        gap: scale(24),
    },
    expandedRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(20),
    },
    expandedTime: {
        fontFamily: 'Gramatika-Bold',
        fontSize: scale(36),
        fontWeight: '700',
        lineHeight: scale(40),
        color: '#000',
    },
    expandedLabel: {
        fontFamily: 'Geometria', // Assuming available or fallback
        fontSize: scale(24),
        fontWeight: '300',
        lineHeight: scale(28),
        color: '#000',
    },
    summaryHeader: {
        width: '100%',
        alignItems: 'flex-start',
    },
    expandedContent: {
        width: '100%',
    },
    summaryChevron: {
        position: 'absolute',
        bottom: scale(24),
        right: scale(24),
    },
    continueButtonWrapper: {
        position: 'absolute',
        bottom: scale(34),
        width: '100%',
        alignSelf: 'center',
    },
    continueButton: {
        backgroundColor: COLORS.summaryCardBg,
        height: scale(60),
        borderRadius: scale(30),
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
    },
    continueButtonText: {
        fontFamily: 'Gramatika-Bold',
        fontSize: scale(18),
        color: '#000',
    },

    // Checkbox Styles
    checkbox: {
        width: scale(24),
        height: scale(24),
        borderRadius: scale(6),
        borderWidth: 2,
        borderColor: '#C2C2C2',
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkboxChecked: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },

    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        width: '85%',
        borderRadius: scale(24),
        padding: scale(24),
        alignItems: 'center',
    },
    modalTitle: {
        fontFamily: 'Gramatika-Bold',
        fontSize: scale(20),
        marginBottom: scale(20),
        color: '#000',
    },
    modalTaskRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: scale(16),
        width: '100%',
        gap: scale(12),
    },
    modalTaskText: {
        fontFamily: 'Gramatika-Regular',
        fontSize: scale(16),
        color: '#000',
        flex: 1,
    },
    finishButton: {
        backgroundColor: COLORS.primary,
        width: '100%',
        height: scale(50),
        borderRadius: scale(25),
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: scale(10),
    },
    finishButtonText: {
        fontFamily: 'Gramatika-Bold',
        fontSize: scale(16),
        color: '#FFF',
    },

    // New List View Styles
    listContainer: {
        flex: 1,
        paddingHorizontal: scale(20),
        marginTop: scale(20),
        alignItems: 'center',
    },
    listControlRow: {
        flexDirection: 'row',
        gap: scale(10),
        marginBottom: scale(40),
        width: '100%',
        justifyContent: 'center',
    },
    thirdButtonNew: {
        width: scale(240),
        height: scale(50),
        backgroundColor: '#C2C2C2',
        borderRadius: scale(30),
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 3,
    },
    fourthButtonNew: {
        width: scale(70),
        height: scale(50),
        backgroundColor: '#E2E2E2',
        borderRadius: scale(30),
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 3,
    },
    taskButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(12),
        backgroundColor: '#E0E0E0',
        borderRadius: scale(45),
        paddingHorizontal: scale(25),
        paddingVertical: scale(15),
        marginBottom: scale(18), // Increased from 12
        width: '100%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 3,
    },
    taskIconWrapper: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 2,
        elevation: 2,
    },
    taskText: {
        fontFamily: 'Gramatika-Regular',
        fontSize: scale(19),
        fontWeight: '300',
        lineHeight: scale(23),
        color: '#000',
        flex: 1,
    },
    chatInputBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFFFFF',
        borderRadius: scale(30),
        paddingHorizontal: scale(24),
        paddingVertical: scale(16),
        width: '100%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        borderWidth: 1,
        borderColor: '#EFEFEF',
    },
    chatInputPlaceholder: {
        fontFamily: 'Gramatika-Regular',
        fontSize: scale(16),
        color: '#A0A0A0',
    },
});

export default SessionTimerScreen;
