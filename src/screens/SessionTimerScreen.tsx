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
import LearnStep from '../components/session/LearnStep';
import DoStep from '../components/session/DoStep';
import SessionCompleteStep from '../components/session/SessionCompleteStep';
import TestStepper from '../components/session/chess/TestStepper';
import ChessBoard from '../components/session/ChessBoard';

import { BottomTabBar } from '../components/navigation/BottomTabBar';
import { useAppTheme } from '../theme/useAppTheme';
import { useUserProfileStore } from '../store/userProfileStore';
import { ActivityIndicator } from 'react-native';


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
        tasks, handleToggleTask, lockedTaskIds,
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
        // Gamification
        activeStep,
        setActiveStep,
        currentLesson,
        isLoadingLesson,
        handleStepComplete,
    } = useTimer();

    const { streakDays, isPremium } = useUserProfileStore();


    const handleStop = () => {
        console.log('[SessionTimerScreen] handleStop pressed - navigating back');
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

    // Render Summary if active — only show tasks completed in this session (not pre-completed/locked ones)
    if (showSummary && startTime) {
        const newlyCompletedTasks = tasks.filter(t => t.completed && !lockedTaskIds.has(t.id));
        return <SessionSummaryView tasks={newlyCompletedTasks} startTime={startTime} onExit={handleStop} />;
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
                scrollEnabled={false}
                onPageScroll={Animated.event(
                    [{ nativeEvent: { position: mainPagerPosition, offset: mainPagerOffset } }],
                    { useNativeDriver: false }
                )}
            >
                {[                    // Page 1: Timer & Interactive Lesson
                    <View key="1" style={{ flex: 1 }}>

                        {timerStatus === 'idle' ? (
                            <View style={{ flex: 1 }}>
                                <View style={styles.header} />
                                {/* Timer Circle + Controls */}
                                <View style={styles.content}>
                                    <TimerProgress
                                        size={scale(300)}
                                        strokeWidth={scale(25)}
                                        color={colors.sessionTimer.primary}
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
                                        <TouchableOpacity style={styles.playButton} onPress={handlePlay} activeOpacity={0.8}>
                                            <Image source={require('../../icons/play.png')} style={{ width: scale(30), height: scale(40), tintColor: colors.buttonTextPrimary || 'white', marginLeft: scale(5) }} resizeMode="contain" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        ) : (
                            /* Interactive Gamification Stepper */
                            <View style={{ flex: 1 }}>
                                {/* Small floating active timer & stop pill */}
                                {activeStep !== 'complete' && (
                                    <View style={styles.activeSessionHeader}>
                                        <View style={styles.activeSessionTimerPill}>
                                            <Text style={styles.activeSessionTimerText}>{formatTime(timeLeft)}</Text>
                                        </View>
                                    </View>
                                )}

                                {isLoadingLesson ? (
                                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                                        <ActivityIndicator size="large" color="#5BA3E6" />
                                        <Text style={{ marginTop: scale(10), color: colors.text, fontFamily: fonts.heading.bold }}>
                                            Загрузка урока...
                                        </Text>
                                    </View>
                                ) : currentLesson ? (
                                    activeStep === 'learn' ? (
                                        <LearnStep
                                            hobbyId={currentLesson.hobby}
                                            title={currentLesson.learn.title}
                                            body={currentLesson.learn.body}
                                            keywords={currentLesson.learn.keywords}
                                            onNext={() => handleStepComplete('learn')}
                                            onOpenChat={() => pagerViewRef.current?.setPage(1)}
                                            onOpenTaskList={() => setIsTaskListVisible(true)}
                                        />
                                    ) : activeStep === 'tests' && currentLesson.tests ? (
                                        <TestStepper
                                            hobbyId={currentLesson.hobby}
                                            tests={currentLesson.tests}
                                            onAllTestsComplete={() => handleStepComplete('tests')}
                                        />
                                    ) : activeStep === 'do' ? (
                                        currentLesson.hobby === 'chess' && currentLesson.do.type === 'chess_puzzle' ? (
                                            <ChessBoard
                                                fen={currentLesson.do.puzzleFen!}
                                                puzzleMoves={currentLesson.do.puzzleMoves!}
                                                question={currentLesson.do.prompt}
                                                maxHints={isPremium ? 5 : 3}
                                                onComplete={() => handleStepComplete('do', 'solved')}
                                            />
                                        ) : (
                                            <DoStep
                                                hobbyId={currentLesson.hobby}
                                                task={currentLesson.do}
                                                onNext={(ans, fb) => handleStepComplete('do', ans, fb)}
                                            />
                                        )
                                    ) : activeStep === 'deepen1' && currentLesson.deepen1 ? (
                                        <DoStep
                                            hobbyId={currentLesson.hobby}
                                            task={currentLesson.deepen1}
                                            onNext={(ans, fb) => handleStepComplete('deepen1', ans, fb)}
                                        />
                                    ) : activeStep === 'deepen2' && currentLesson.deepen2 ? (
                                        <DoStep
                                            hobbyId={currentLesson.hobby}
                                            task={currentLesson.deepen2}
                                            onNext={(ans, fb) => handleStepComplete('deepen2', ans, fb)}
                                        />
                                    ) : (
                                        <SessionCompleteStep
                                            isPremium={isPremium}
                                            streakDays={streakDays}
                                            onExit={handleStop}
                                        />
                                    )
                                ) : (
                                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                                        <Text style={{ color: colors.text, fontFamily: fonts.heading.bold }}>
                                            Урок не найден. Попробуйте перезапустить сессию.
                                        </Text>
                                    </View>
                                )}
                            </View>
                        )}
                    </View>
                ]}
            </PagerView>

            {/* Main Session Pagination (Timer vs Chat) — Removed as requested */}

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
                lockedTaskIds={lockedTaskIds}
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
    activeSessionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: scale(20),
        marginBottom: scale(10),
    },
    activeSessionTimerPill: {
        backgroundColor: 'rgba(91, 163, 230, 0.12)',
        borderRadius: scale(16),
        paddingHorizontal: scale(16),
        paddingVertical: scale(6),
    },
    activeSessionTimerText: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(15),
        color: '#2B5B84',
    },
    stopButtonPill: {
        backgroundColor: 'rgba(120, 144, 156, 0.12)',
        borderRadius: scale(16),
        paddingHorizontal: scale(12),
        paddingVertical: scale(6),
        borderWidth: 1,
        borderColor: 'rgba(120, 144, 156, 0.25)',
    },
    stopButtonText: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(13),
        color: '#607D8B',
    },
});

export default SessionTimerScreen;
