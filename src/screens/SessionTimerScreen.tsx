import React, { useRef, useMemo } from 'react';
import { BlurView } from 'expo-blur';
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
import { fonts } from '../theme';
import { APP_TAB_ROUTES } from '../config/navigation';
import { useTimer } from '../hooks/useTimer';

// Extracted components
import {
    TimerProgress,
    SessionChat,
    TaskDrawer,
    StopConfirmationModal,
    SessionSummaryView,
    TimePickerModal,
} from '../components/session';
import { BottomTabBar } from '../components/navigation/BottomTabBar';
import { useAppTheme } from '../theme/useAppTheme';

export const SessionTimerScreen: React.FC = () => {
    const router = useRouter();
    const pagerViewRef = useRef<any>(null);
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const {
        // Timer
        timerStatus, timeLeft, progress, formatTime,
        handlePlay, handlePause, handleReset, handleStopPress,
        // Tasks
        tasks, handleToggleTask,
        // Drawer
        isTaskListVisible, setIsTaskListVisible,
        // Summary
        showSummary, startTime,
        // Stop modal
        isStopModalVisible, setIsStopModalVisible,
        dontShowAgainChecked, setDontShowAgainChecked, confirmStop,
        // Time selection
        totalTime, setTotalTime,
        // Chat
        chatInput, setChatInput, messages, isAiLoading, handleSendMessage,
        // Animations
        controlsAnim, drawerAnim, backdropAnim, bottomNavVisible,
    } = useTimer();

    const handleStop = () => {
        router.back();
    };

    const [isTimePickerVisible, setIsTimePickerVisible] = React.useState(false);

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

    // Control button slide animations
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
            <StatusBar barStyle="dark-content" backgroundColor={colors.sessionTimer.background} />

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
                                    <BlurView intensity={80} tint="light" style={styles.floatingMenuGlass} />
                                    <Image source={require('../../icons/tasks.png')} style={{ width: scale(24), height: scale(24), tintColor: '#1E1E2E', zIndex: 1 }} resizeMode="contain" />
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
                                <TouchableOpacity
                                    activeOpacity={0.7}
                                    onPress={() => timerStatus === 'idle' && setIsTimePickerVisible(true)}
                                    disabled={timerStatus !== 'idle'}
                                    style={{ justifyContent: 'center', alignItems: 'center' }}
                                >
                                    <Text style={styles.timerText}>{formatTime(timeLeft)}</Text>
                                </TouchableOpacity>
                            </TimerProgress>

                            <View style={styles.controlsContainer}>
                                {timerStatus === 'idle' ? (
                                    <TouchableOpacity style={styles.playButton} onPress={handlePlay} activeOpacity={0.8}>
                                        <Image source={require('../../icons/play.png')} style={{ width: scale(30), height: scale(40), tintColor: colors.buttonTextPrimary || 'white', marginLeft: scale(5) }} resizeMode="contain" />
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
                                                        tintColor: colors.buttonTextPrimary || 'white'
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
                                                        tintColor: colors.buttonTextPrimary || 'white',
                                                        marginLeft: timerStatus === 'running' ? 0 : scale(5)
                                                    },
                                                    timerStatus === 'running'
                                                        ? {
                                                            width: scale(29),
                                                            height: scale(35),
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
                                                        tintColor: colors.buttonTextPrimary || 'white',
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
                    styles.bottomNavWrapper,
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
                    activeTab={0}
                    onTabPress={(index) => {
                        const routes = ['/(app)/', '/(app)/weekly-plan', '/(app)/ai-coach'] as const;
                        router.replace(routes[index] as any);
                    }}
                />
            </Animated.View>

            {/* Task Drawer */}
            <TaskDrawer
                tasks={tasks}
                drawerAnim={drawerAnim}
                backdropAnim={backdropAnim}
                onCompleteTask={handleToggleTask}
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

            {/* Time Picker Modal */}
            <TimePickerModal
                visible={isTimePickerVisible}
                currentDuration={totalTime}
                onSelect={(mins) => setTotalTime(mins * 60)}
                onClose={() => setIsTimePickerVisible(false)}
            />
        </SafeAreaView>
    );
};

const createStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.sessionTimer.background,
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    header: {
        height: scale(50),
    },
    floatingMenu: {
        width: scale(55),
        height: scale(55),
        borderRadius: scale(27.5),
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    floatingMenuGlass: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: scale(27.5),
        overflow: 'hidden',
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.4)',
        borderTopColor: 'rgba(255, 255, 255, 1)',
        borderLeftColor: 'rgba(255, 255, 255, 0.9)',
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
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 5,
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
    bottomNavWrapper: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        alignItems: 'center',
    },
});

export default SessionTimerScreen;
