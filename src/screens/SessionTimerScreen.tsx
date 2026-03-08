import React, { useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    StatusBar,
    TouchableOpacity,
    Animated,
    Platform,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import PagerView from '../components/ui/PagerView';
import { scale } from '../constants';
import { colors, fonts } from '../theme';
import { APP_TAB_ROUTES, getMainTabUrl } from '../config/navigation';
import { useTimer } from '../hooks/useTimer';

// Extracted components
import {
    TimerProgress,
    SessionChat,
    TaskDrawer,
    StopConfirmationModal,
    SessionSummaryView,
} from '../components/session';
import { BottomTabBar } from '../components/navigation/BottomTabBar';

const TABS = APP_TAB_ROUTES;

export const SessionTimerScreen: React.FC = () => {
    const router = useRouter();
    const pagerViewRef = useRef<PagerView>(null);

    const {
        // Timer
        timerStatus, timeLeft, progress, formatTime,
        handlePlay, handlePause, handleReset, handleStopPress,
        // Tasks
        tasks, handleCompleteTask,
        // Drawer
        isTaskListVisible, setIsTaskListVisible,
        // Summary
        showSummary, startTime,
        // Stop modal
        isStopModalVisible, setIsStopModalVisible,
        dontShowAgainChecked, setDontShowAgainChecked, confirmStop,
        // Chat
        chatInput, setChatInput, messages, isAiLoading, handleSendMessage,
        // Animations
        controlsAnim, drawerAnim, backdropAnim, bottomNavVisible,
        // Constants
        totalTime,
    } = useTimer();

    const handleStop = () => {
        router.back();
    };

    // --- All hooks must be called before any conditional return (React rules of hooks) ---

    // Main pager scroll animation
    const mainPagerPosition = useRef(new Animated.Value(0)).current;
    const mainPagerOffset = useRef(new Animated.Value(0)).current;
    const mainScrollX = useRef(Animated.add(mainPagerPosition, mainPagerOffset)).current;

    const timerDot1Width = mainScrollX.interpolate({
        inputRange: [0, 1],
        outputRange: [scale(65), scale(13)],
        extrapolate: 'clamp',
    });
    const timerDot2Width = mainScrollX.interpolate({
        inputRange: [0, 1],
        outputRange: [scale(13), scale(65)],
        extrapolate: 'clamp',
    });

    // Render Summary if active
    if (showSummary && startTime) {
        return <SessionSummaryView tasks={tasks} startTime={startTime} onExit={handleStop} />;
    }



    // --- Control button slide animations ---
    const translateXReset = controlsAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [scale(120), 0],
    });
    const translateXStop = controlsAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [scale(-120), 0],
    });

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <StatusBar barStyle="dark-content" />

            <PagerView
                style={{ flex: 1 }}
                initialPage={0}
                ref={pagerViewRef}
                onPageScroll={Animated.event(
                    [{ nativeEvent: { position: mainPagerPosition, offset: mainPagerOffset } }],
                    { useNativeDriver: false }
                )}
            >
                {[
                    // Page 1: Timer
                    <View key="1" style={{ flex: 1 }}>
                        <View style={styles.header} />

                        {/* Task List Button — only when timer is active */}
                        {timerStatus !== 'idle' && (
                            <Animated.View style={{ opacity: controlsAnim, position: 'absolute', top: scale(20), left: scale(24), zIndex: 10 }}>
                                <TouchableOpacity
                                    style={styles.floatingMenu}
                                    activeOpacity={0.7}
                                    onPress={() => setIsTaskListVisible(true)}
                                >
                                    <Image source={require('../../icons/tasks.png')} style={{ width: scale(24), height: scale(24), tintColor: '#1E1E2E' }} resizeMode="contain" />
                                </TouchableOpacity>
                            </Animated.View>
                        )}

                        {/* Timer Circle + Controls */}
                        <View style={styles.content}>
                            <TimerProgress
                                size={scale(300)}
                                strokeWidth={scale(25)}
                                color={timerStatus === 'paused' ? colors.sessionTimer.pausedPrimary : colors.sessionTimer.primary}
                                trackColor={colors.sessionTimer.primaryFaded}
                                progress={progress}
                            >
                                <Text style={styles.timerText}>{formatTime(timeLeft)}</Text>
                            </TimerProgress>

                            <View style={styles.controlsContainer}>
                                {timerStatus === 'idle' ? (
                                    <TouchableOpacity style={styles.playButton} onPress={handlePlay} activeOpacity={0.8}>
                                        <Image source={require('../../icons/play.png')} style={{ width: scale(30), height: scale(40), tintColor: colors.buttonTextPrimary, marginLeft: scale(5) }} resizeMode="contain" />
                                    </TouchableOpacity>
                                ) : (
                                    <View style={styles.activeControls}>
                                        <Animated.View style={{ transform: [{ translateX: translateXReset }] }}>
                                            <TouchableOpacity style={styles.secondaryControl} onPress={handleReset} activeOpacity={0.8}>
                                                <Image
                                                    source={require('../../icons/back.png')}
                                                    style={{
                                                        width: scale(34.437),
                                                        height: scale(32.746),
                                                        tintColor: colors.buttonTextPrimary
                                                    }}
                                                    resizeMode="contain"
                                                />
                                            </TouchableOpacity>
                                        </Animated.View>

                                        <TouchableOpacity
                                            style={[styles.playButton, {
                                                zIndex: 10,
                                                backgroundColor: timerStatus === 'paused' ? colors.sessionTimer.pausedPrimary : colors.sessionTimer.primary,
                                                shadowColor: timerStatus === 'paused' ? colors.sessionTimer.pausedPrimary : colors.sessionTimer.primary,
                                            }]}
                                            onPress={handlePause}
                                            activeOpacity={0.8}
                                        >
                                            <Image
                                                source={timerStatus === 'running' ? require('../../icons/pause.png') : require('../../icons/play.png')}
                                                style={[
                                                    {
                                                        tintColor: colors.buttonTextPrimary,
                                                        marginLeft: timerStatus === 'running' ? 0 : scale(5)
                                                    },
                                                    timerStatus === 'running'
                                                        ? {
                                                            width: scale(29),
                                                            height: scale(35),
                                                            flexShrink: 0
                                                        }
                                                        : {
                                                            width: scale(40),
                                                            height: scale(40)
                                                        }
                                                ]}
                                                resizeMode="contain"
                                            />
                                        </TouchableOpacity>

                                        <Animated.View style={{ transform: [{ translateX: translateXStop }] }}>
                                            <TouchableOpacity style={styles.secondaryControl} onPress={handleStopPress} activeOpacity={0.8}>
                                                <Image
                                                    source={require('../../icons/stop.png')}
                                                    style={{
                                                        width: scale(24),
                                                        height: scale(24),
                                                        tintColor: colors.buttonTextPrimary,
                                                        flexShrink: 0
                                                    }}
                                                    resizeMode="contain"
                                                />
                                            </TouchableOpacity>
                                        </Animated.View>
                                    </View>
                                )}
                            </View>
                        </View>
                    </View>,

                    // Page 2: AI Chat — only when timer is active
                    ...(timerStatus !== 'idle'
                        ? [
                            <SessionChat
                                key="2"
                                messages={messages}
                                chatInput={chatInput}
                                isAiLoading={isAiLoading}
                                onChangeText={setChatInput}
                                onSendMessage={handleSendMessage}
                                onOpenTaskList={() => setIsTaskListVisible(true)}
                            />,
                        ]
                        : []),
                ]}
            </PagerView>

            {/* Main Session Pagination (Timer vs Chat) */}
            {timerStatus !== 'idle' && (
                <View style={styles.mainPaginationContainer}>
                    <Animated.View style={[styles.mainDot, { width: timerDot1Width }]} />
                    <Animated.View style={[styles.mainDot, { width: timerDot2Width }]} />
                </View>
            )}

            {/* Bottom Navigation — animates out when timer is running/paused */}
            <Animated.View
                style={[
                    {
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        alignItems: 'center',
                    },
                    {
                        opacity: bottomNavVisible,
                        transform: [{
                            translateY: bottomNavVisible.interpolate({
                                inputRange: [0, 1],
                                outputRange: [scale(80), 0],
                            }),
                        }],
                    },
                ]}
                pointerEvents={timerStatus === 'idle' ? 'auto' : 'none'}
            >
                <BottomTabBar
                    activeTab={0} // Highlighting Home as per screenshot
                    onTabPress={(index) => {
                        // Map index to tab logic
                        // If index is 0 (Home), we just want to go back to the main screen.
                        // Since SessionTimer is likely pushed on top, router.back() or dismissAll() works.
                        // For other tabs, we might need to reset navigation state or replace with params.

                        // Simplest approach: Navigate to the main screen with parameter
                        // We need to import BottomTabBar first!

                        // NOTE: MainTabsScreen accepts { initialTab }.
                        // We can use navigate (push/pop) to go back.

                        if (index === 0) {
                            router.dismissAll();
                        } else {
                            // If we want to switch tab, we can navigate to root with params
                            router.replace({ pathname: '/(app)', params: { initialTab: index } });
                        }
                    }}
                />
            </Animated.View>

            {/* Task Drawer */}
            <TaskDrawer
                tasks={tasks}
                drawerAnim={drawerAnim}
                backdropAnim={backdropAnim}
                onCompleteTask={handleCompleteTask}
                onClose={() => setIsTaskListVisible(false)}
            />

            {/* Stop Confirmation Modal */}
            <StopConfirmationModal
                visible={isStopModalVisible}
                dontShowAgainChecked={dontShowAgainChecked}
                onToggleDontShowAgain={() => setDontShowAgainChecked(!dontShowAgainChecked)}
                onCancel={() => setIsStopModalVisible(false)}
                onConfirm={confirmStop}
            />
        </SafeAreaView>
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
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: scale(20),
        paddingBottom: scale(80),
    },
    timerText: {
        fontSize: scale(64),
        fontFamily: fonts.heading.bold,
        color: colors.sessionTimer.text,
        fontWeight: 'bold',
        position: 'absolute',
    },
    controlsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: scale(20),
        height: scale(100),
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
        gap: scale(36),
        position: 'absolute',
    },
    secondaryControl: {
        width: scale(65),
        height: scale(65),
        borderRadius: scale(32.5),
        backgroundColor: colors.sessionTimer.text,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: colors.shadow,
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
        backgroundColor: colors.nav.floatingBg,
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        borderWidth: 1,
        borderColor: colors.nav.floatingBorder,
    },
    navItem: {
        padding: scale(12),
    },
    mainPaginationContainer: {
        position: 'absolute',
        top: scale(72),
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: scale(8),
        zIndex: 20,
    },
    mainDot: {
        height: scale(13),
        borderRadius: scale(31),
        backgroundColor: colors.sessionTimer.dotActive,
    },
});

export default SessionTimerScreen;
