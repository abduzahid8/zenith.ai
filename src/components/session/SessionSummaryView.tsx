import React, { useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import PagerView from '../ui/PagerView';
import { scale } from '../../constants';
import { fonts } from '../../theme';
import { SessionTask } from './TaskDrawer';
import { useAppTheme } from '../../theme/useAppTheme';

const TOTAL_SESSION_SECONDS = 30 * 60; // 30 minutes = 100% of circle

export interface SessionSummaryViewProps {
    tasks: SessionTask[];
    startTime: number;
    onExit: () => void;
    /** Evidence lines: what this session improved (minutes, skills, answers). */
    deltaLines?: string[];
}

const SessionSummaryView: React.FC<SessionSummaryViewProps> = ({ tasks, startTime, onExit, deltaLines = [] }) => {
    const completedTasks = tasks.filter(t => t.completed).sort((a, b) => (a.completedAt || 0) - (b.completedAt || 0));
    const pagerPosition = useRef(new Animated.Value(0)).current;
    const pagerOffset = useRef(new Animated.Value(0)).current;
    const scrollX = useRef(Animated.add(pagerPosition, pagerOffset)).current;
    const pagerRef = useRef<any>(null);
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const getElapsedString = (completedAt: number) => {
        if (!startTime) return '0:00';
        const diffSeconds = Math.max(0, Math.floor((completedAt - startTime) / 1000));
        const mins = Math.floor(diffSeconds / 60);
        const secs = diffSeconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const getTaskProgress = (completedAt: number) => {
        if (!startTime || !completedAt) return 0;
        const diffSeconds = Math.max(0, Math.floor((completedAt - startTime) / 1000));
        return Math.min(diffSeconds / TOTAL_SESSION_SECONDS, 1.0);
    };

    return (
        <View style={styles.summaryContainer}>
            {completedTasks.length > 0 ? (
                <>
                    <PagerView
                        style={styles.pagerView}
                        initialPage={0}
                        ref={pagerRef}
                        onPageScroll={Animated.event(
                            [{ nativeEvent: { position: pagerPosition, offset: pagerOffset } }],
                            { useNativeDriver: false }
                        )}
                    >
                        {completedTasks.map((task, index) => {
                    const taskProgress = getTaskProgress(task.completedAt!);
                    const circumference = 2 * Math.PI * 109;
                    return (
                        <View key={task.id} style={styles.summaryPage}>
                            <View style={styles.summaryCircleContainer}>
                                <Svg
                                    style={{ position: 'absolute' }}
                                    width={256}
                                    height={256}
                                    viewBox="0 0 256 256"
                                    fill="none"
                                >
                                    <Circle cx="128" cy="128" r="109" stroke={index % 2 === 0 ? colors.sessionTimer.ringTrackA : colors.sessionTimer.ringTrackB} strokeWidth="38" />
                                    <Circle
                                        cx="128"
                                        cy="128"
                                        r="109"
                                        stroke={index % 2 === 0 ? colors.sessionTimer.ringStrokeA : colors.sessionTimer.ringStrokeB}
                                        strokeWidth="38"
                                        strokeDasharray={`${circumference} ${circumference}`}
                                        strokeDashoffset={circumference - (taskProgress * circumference)}
                                        strokeLinecap="round"
                                        rotation="-90"
                                        origin="128, 128"
                                    />
                                </Svg>
                                <View style={styles.summaryCountWrapper}>
                                    <Text style={styles.summaryCountText}>{index + 1}</Text>
                                </View>
                            </View>

                            <Text style={styles.summaryTimeText}>{getElapsedString(task.completedAt!)}</Text>
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
                        outputRange: [0.2, 1, 0.2],
                        extrapolate: 'clamp',
                    });

                    return (
                        <Animated.View
                            key={i}
                            style={[
                                styles.activeDot,
                                { width: dotWidth, backgroundColor: colors.sessionTimer.dotActive, opacity: dotOpacity },
                            ]}
                        />
                    );
                })}
            </View>
                </>
            ) : (
                <View style={styles.linesWrap}>
                    {deltaLines.map((line, i) => (
                        <Text key={i} style={styles.lineText}>{line}</Text>
                    ))}
                </View>
            )}

            {completedTasks.length > 0 && deltaLines.length > 0 ? (
                <View style={styles.linesCompact}>
                    {deltaLines.map((line, i) => (
                        <Text key={i} style={styles.lineText}>{line}</Text>
                    ))}
                </View>
            ) : null}

            <View style={styles.summaryFooter}>
                <TouchableOpacity style={styles.summaryButton} onPress={onExit}>
                    <Text style={styles.summaryButtonText}>Завершить</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const createStyles = (colors: any) => StyleSheet.create({
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
        marginTop: scale(120),
    },
    summaryCountWrapper: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
    },
    summaryCountText: {
        fontFamily: fonts.heading.bold,
        fontSize: 96,
        color: colors.sessionTimer.textDark,
        textAlign: 'center',
    },
    summaryTimeText: {
        fontFamily: fonts.heading.bold,
        fontSize: 48,
        lineHeight: 56,
        color: colors.sessionTimer.textDark,
        marginBottom: scale(8),
        textAlign: 'center',
    },
    summaryLabelText: {
        fontFamily: fonts.body.light,
        fontSize: 24,
        lineHeight: 24,
        color: colors.sessionTimer.textDark,
        textAlign: 'center',
    },
    activeDot: {
        width: 65,
        height: 13,
        borderRadius: 31,
        backgroundColor: colors.sessionTimer.dotActive,
    },
    paginationRow: {
        flexDirection: 'row',
        paddingBottom: scale(40),
        gap: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    linesWrap: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: scale(32),
        gap: scale(12),
    },
    linesCompact: {
        alignItems: 'center',
        paddingHorizontal: scale(32),
        paddingBottom: scale(16),
        gap: scale(6),
    },
    lineText: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(18),
        lineHeight: scale(26),
        color: colors.sessionTimer.textDark,
        textAlign: 'center',
    },
    summaryFooter: {
        alignItems: 'center',
        paddingBottom: scale(48),
    },
    summaryButton: {
        backgroundColor: colors.sessionTimer.button,
        width: 359,
        height: 55,
        borderRadius: 45,
        justifyContent: 'center',
        alignItems: 'center',
    },
    summaryButtonText: {
        fontFamily: fonts.heading.bold,
        fontSize: 18,
        color: 'white',
    },
});

export default SessionSummaryView;
