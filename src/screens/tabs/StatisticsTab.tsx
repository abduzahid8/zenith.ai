import React, { useRef, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Animated,
} from 'react-native';
import PagerView from '../../components/ui/PagerView';
import { scale } from '../../constants';
import { colors, fonts } from '../../theme';
import { WeeklyBarChart } from '../../components/WeeklyBarChart';
import { HobbyTimeBarChart } from '../../components/HobbyTimeBarChart';
import { useDeviceScreenTimeStore } from '../../store/deviceScreenTimeStore';
import { useHobbyTimeStore, formatHobbyTime } from '../../store/hobbyTimeStore';


const StatisticsTab: React.FC = () => {
    const statsPagerRef = useRef<PagerView>(null);

    // Animated pagination dots
    const dot1Width = useRef(new Animated.Value(scale(65))).current;
    const dot2Width = useRef(new Animated.Value(scale(13))).current;
    const scrollProgress = useRef(new Animated.Value(0)).current;

    const dot1Color = scrollProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [colors.statistics.darkText, colors.statistics.muted],
    });
    const dot2Color = scrollProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [colors.statistics.muted, colors.statistics.darkText],
    });

    const { weeklyData } = useDeviceScreenTimeStore();
    const hobbyTimeStore = useHobbyTimeStore();



    // Handle stats page scroll for pagination animation
    const handleStatsPageScroll = useCallback((e: { nativeEvent: { position: number; offset: number } }) => {
        const { position, offset } = e.nativeEvent;
        const progress = position + offset;
        const minWidth = scale(13);
        const maxWidth = scale(65);

        dot1Width.setValue(maxWidth - (progress * (maxWidth - minWidth)));
        dot2Width.setValue(minWidth + (progress * (maxWidth - minWidth)));
        scrollProgress.setValue(progress);
    }, []);

    // Screen time chart data
    const chartData = useMemo(() => {
        const weekDays = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
        if (!weeklyData || weeklyData.length === 0) {
            const zeroData = [];
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                zeroData.push({ day: weekDays[d.getDay()], value: 0 });
            }
            return zeroData;
        }
        return weeklyData.map(d => {
            const date = new Date(d.date);
            return {
                day: weekDays[date.getDay()],
                value: Number((d.seconds / 3600).toFixed(1))
            };
        }).slice(-7);
    }, [weeklyData]);

    // Total screen time formatted
    const totalDurationFormatted = useMemo(() => {
        const seconds = weeklyData.reduce((acc, curr) => acc + curr.seconds, 0);
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }, [weeklyData]);

    // Screen time change percentage (computed from real data)
    const screenTimeChange = useMemo(() => {
        if (!weeklyData || weeklyData.length < 2) return 0;
        const sorted = [...weeklyData].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const recentDays = sorted.slice(-7);
        if (recentDays.length < 2) return 0;

        const mid = Math.floor(recentDays.length / 2);
        const firstHalf = recentDays.slice(0, mid);
        const secondHalf = recentDays.slice(mid);

        const firstAvg = firstHalf.reduce((sum, d) => sum + d.seconds, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((sum, d) => sum + d.seconds, 0) / secondHalf.length;

        if (firstAvg === 0) return 0;
        return Math.round(((secondAvg - firstAvg) / firstAvg) * 100);
    }, [weeklyData]);

    // Hobby chart data
    const hobbyChartData = useMemo(() => {
        const weekDays = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
        if (!hobbyTimeStore.weeklyData || hobbyTimeStore.weeklyData.length === 0) {
            const zeroData = [];
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                zeroData.push({ day: weekDays[d.getDay()], value: 0 });
            }
            return zeroData;
        }
        return hobbyTimeStore.weeklyData.map(d => {
            const date = new Date(d.date);
            return {
                day: weekDays[date.getDay()],
                value: Number((d.seconds / 3600).toFixed(1))
            };
        }).slice(-7);
    }, [hobbyTimeStore.weeklyData]);

    const hobbyTotalFormatted = useMemo(() => {
        return formatHobbyTime(hobbyTimeStore.getTotalSeconds());
    }, [hobbyTimeStore.weeklyData]);

    const productivityChange = useMemo(() => {
        return hobbyTimeStore.getProductivityChange();
    }, [hobbyTimeStore.weeklyData]);

    return (
        <View style={{ flex: 1 }}>
            <PagerView
                ref={statsPagerRef}
                style={styles.statsPagerView}
                initialPage={0}
                onPageScroll={handleStatsPageScroll}
            >
                {/* Sub-page 1: Screen Time */}
                <ScrollView
                    key="stats-screen-time"
                    style={styles.statsScroll}
                    contentContainerStyle={{ paddingBottom: scale(100) }}
                    showsVerticalScrollIndicator={false}
                >
                    <Text style={styles.statsTitle}>Экранное время</Text>
                    <WeeklyBarChart data={chartData} />

                    <View style={styles.statCardBlue}>
                        <Text style={styles.statCardBigText}>
                            {screenTimeChange >= 0 ? '+' : ''}{screenTimeChange}%
                        </Text>
                        <Text style={styles.statCardSmallText}>За последнюю неделю</Text>
                    </View>

                    <View style={styles.statCardDarkBlue}>
                        <Text style={styles.statCardBigText}>{totalDurationFormatted}</Text>
                        <Text style={styles.statCardSmallText}>Экранное время{'\n'}за неделю</Text>
                    </View>
                </ScrollView>

                {/* Sub-page 2: Hobby Time */}
                <ScrollView
                    key="stats-hobby-time"
                    style={styles.statsScroll}
                    contentContainerStyle={{ paddingBottom: scale(100) }}
                    showsVerticalScrollIndicator={false}
                >
                    <Text style={styles.statsTitle}>Время хобби</Text>
                    <HobbyTimeBarChart data={hobbyChartData} />

                    <View style={styles.statCardPink}>
                        <Text style={styles.statCardBigText}>
                            {productivityChange.value >= 0 ? '+' : ''}{productivityChange.value}%
                        </Text>
                        <Text style={styles.statCardSmallText}>
                            {productivityChange.isNewUser ? 'За последний день' : 'К продуктивности'}
                        </Text>
                    </View>

                    <View style={styles.statCardPurple}>
                        <Text style={styles.statCardBigText}>{hobbyTotalFormatted}</Text>
                        <Text style={styles.statCardSmallText}>Потраченно на Хобби{'\n'}за неделю</Text>
                    </View>
                </ScrollView>
            </PagerView>

            {/* Pagination dots */}
            <View style={styles.statsPaginationContainer}>
                <Animated.View style={[
                    styles.statsDot,
                    { width: dot1Width, backgroundColor: dot1Color }
                ]} />
                <Animated.View style={[
                    styles.statsDot,
                    { width: dot2Width, backgroundColor: dot2Color }
                ]} />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    statsPagerView: {
        flex: 1,
    },
    statsScroll: {
        flex: 1,
        paddingHorizontal: scale(20),
        paddingTop: 0,
    },
    statsTitle: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(32),
        lineHeight: scale(34),
        color: colors.black,
        marginBottom: scale(20),
        marginTop: scale(0),
    },
    statCardBlue: {
        paddingTop: scale(16.5),
        paddingRight: scale(111),
        paddingBottom: scale(16.5),
        paddingLeft: scale(20),
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'flex-start',
        gap: scale(0),
        alignSelf: 'stretch',
        borderRadius: scale(25),
        backgroundColor: colors.statistics.screenTimeCard,
        marginTop: scale(31),
        marginBottom: scale(10),
        minHeight: scale(100),
    },
    statCardDarkBlue: {
        padding: scale(20),
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'flex-start',
        alignSelf: 'stretch',
        borderRadius: scale(25),
        backgroundColor: colors.statistics.screenTimeCardDark,
        marginBottom: scale(20),
        minHeight: scale(100),
        gap: scale(0),
    },
    statCardPink: {
        paddingTop: scale(16.5),
        paddingRight: scale(111),
        paddingBottom: scale(16.5),
        paddingLeft: scale(20),
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'flex-start',
        gap: scale(0),
        alignSelf: 'stretch',
        borderRadius: scale(25),
        backgroundColor: colors.statistics.hobbyCardLight,
        marginTop: scale(31),
        marginBottom: scale(10),
        minHeight: scale(100),
    },
    statCardPurple: {
        padding: scale(20),
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'flex-start',
        alignSelf: 'stretch',
        borderRadius: scale(25),
        backgroundColor: colors.statistics.hobbyCardDark,
        marginBottom: scale(20),
        minHeight: scale(100),
        gap: scale(0),
    },
    statCardBigText: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(32),
        color: colors.black,
    },
    statCardSmallText: {
        fontFamily: fonts.heading.light,
        fontSize: scale(16),
        color: colors.statistics.darkText,
        lineHeight: scale(20),
    },
    statsPaginationContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: scale(8),
        paddingBottom: scale(16),
    },
    statsDot: {
        width: scale(13),
        height: scale(13),
        borderRadius: scale(31),
        backgroundColor: colors.statistics.muted,
    },
});

export default StatisticsTab;
