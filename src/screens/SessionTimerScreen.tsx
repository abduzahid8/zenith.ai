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
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Circle, Path } from 'react-native-svg';

// Screen Dimensions
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const FIGMA_WIDTH = 402;
const scale = (size: number) => (SCREEN_WIDTH / FIGMA_WIDTH) * size;

// Colors - Blue Theme (Goal)
const COLORS = {
    background: '#F2F6FC', // Very light blue/grey typical of the design
    primary: '#37A0EF',   // Updated Blue color
    primaryFaded: '#D6EBFD', // Lighter faded blue for track matching Goal
    text: '#2E2E43',
    white: '#FFFFFF',
    navBg: 'rgba(255, 255, 255, 0.95)',
    controlDark: '#2E2E43', // Dark background for Reset/Stop buttons
};

// Types
const TABS = [
    { key: 'home', icon: 'home', iconOutline: 'home-outline', type: 'ionicon' },
    { key: 'statistics', icon: 'bar-chart', iconOutline: 'bar-chart-outline', type: 'ionicon' },
    { key: 'ai-coach', icon: 'lightbulb', iconOutline: 'lightbulb-outline', type: 'material' },
    { key: 'weekly-plan', icon: 'clipboard-text', iconOutline: 'clipboard-text-outline', type: 'material' },
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

    const handleStop = () => {
        setTimeLeft(totalTime);
        setTimerStatus('idle');
        router.back();
    };

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
                    color={COLORS.primary}
                    trackColor={COLORS.primaryFaded}
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
                                color={COLORS.white}
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
                                    <MaterialCommunityIcons name="replay" size={scale(32)} color={COLORS.white} />
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
                                    color={COLORS.white}
                                    style={timerStatus === 'running' ? {} : { marginLeft: scale(5) }}
                                />
                            </TouchableOpacity>

                            {/* Stop Button */}
                            <Animated.View style={{ transform: [{ translateX: translateXStop }] }}>
                                <TouchableOpacity
                                    style={styles.secondaryControl}
                                    onPress={handleStop}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="stop" size={scale(32)} color={COLORS.white} />
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

            {/* Drawer Overlay (Backdrop) */}
            {(isTaskListVisible || drawerAnim._value > -scale(286)) && (
                <Animated.View
                    style={[
                        styles.drawerBackdrop,
                        { opacity: backdropAnim }
                    ]}
                    pointerEvents={isTaskListVisible ? 'auto' : 'none'}
                >
                    <TouchableOpacity
                        style={{ flex: 1 }}
                        activeOpacity={1}
                        onPress={() => setIsTaskListVisible(false)}
                    />
                </Animated.View>
            )}

            {/* Side Drawer */}
            <Animated.View style={[styles.drawerContainer, { transform: [{ translateX: drawerAnim }] }]}>

                {/* Drawer Content */}
                <Text style={styles.drawerTitle}>Твои задачи</Text>

                <View style={styles.componentsContainer}>
                    {/* Task Card 1: Debut */}
                    <View style={styles.taskCard}>
                        <Text style={styles.taskTitle}>Дебют</Text>
                        <Text style={styles.taskSubtitle}>Изучить Королевский Гамбит</Text>
                        <TouchableOpacity style={styles.addButton}>
                            <Ionicons name="add" size={scale(24)} color="#1E1E2E" />
                        </TouchableOpacity>
                    </View>

                    {/* Task Card 2: Practice */}
                    <View style={styles.taskCard}>
                        <Text style={styles.taskTitle}>Практика</Text>
                        <Text style={styles.taskSubtitle}>Сыграть 2 партии</Text>
                        <TouchableOpacity style={styles.addButton}>
                            <Ionicons name="add" size={scale(24)} color="#1E1E2E" />
                        </TouchableOpacity>
                    </View>
                </View>
            </Animated.View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    header: {
        height: scale(50),
    },
    floatingMenu: {
        width: scale(48),
        height: scale(48),
        borderRadius: scale(24),
        backgroundColor: COLORS.white,
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
        color: COLORS.text,
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
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: COLORS.primary,
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
        backgroundColor: COLORS.controlDark,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 5,
    },
    bottomNav: {
        position: 'absolute',
        bottom: scale(40),
        left: scale(20),
        right: scale(20),
        height: scale(70),
        backgroundColor: COLORS.white,
        borderRadius: scale(35),
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingHorizontal: scale(10),
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.05,
        shadowRadius: 20,
        elevation: 5,
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
});

export default SessionTimerScreen;
