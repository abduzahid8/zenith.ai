import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    StatusBar,
    Image,
    ScrollView,
    TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, fonts } from '../theme';
import { WeeklyBarChart } from '../components/WeeklyBarChart';
import { MenuDrawer } from '../components/NavigationSidebar';
import { useUserProfileStore } from '../store/userProfileStore';
import { BottomNavigation } from '../components/BottomNavigation';
import { useDeviceScreenTimeStore } from '../store/deviceScreenTimeStore';
import { scale } from '../constants';

const FireIcon = () => <Image source={require('../../icons/fire.png')} style={{ width: scale(24), height: scale(24) }} resizeMode="contain" />;

const WEEK_DAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

export const ScreenTimeScreen: React.FC = () => {
    const router = useRouter();
    const { streakDays } = useUserProfileStore();
    const {
        changeFromLastWeek,
        weeklyData,
        fetchWeeklyData,
        fetchTodayData,
    } = useDeviceScreenTimeStore();
    const [menuVisible, setMenuVisible] = useState(false);

    useEffect(() => {
        fetchWeeklyData();
        fetchTodayData();
    }, []);

    const chartData = useMemo(() => {
        if (!weeklyData || weeklyData.length === 0) {
            return WEEK_DAYS.map((_, i) => {
                const d = new Date();
                d.setDate(d.getDate() - (6 - i));
                return { day: WEEK_DAYS[d.getDay()], value: 0 };
            });
        }
        return weeklyData.map(d => {
            const date = new Date(d.date);
            return {
                day: WEEK_DAYS[date.getDay()],
                value: Number((d.seconds / 3600).toFixed(1)),
            };
        }).slice(-7);
    }, [weeklyData]);

    const totalDurationFormatted = useMemo(() => {
        const total = (weeklyData || []).reduce((acc, curr) => acc + curr.seconds, 0);
        const hours = Math.floor(total / 3600);
        const minutes = Math.floor((total % 3600) / 60);
        const secs = Math.floor(total % 60);
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }, [weeklyData]);

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

            <View style={styles.header}>
                <View style={styles.headerLeft} />
                <View style={styles.headerRight}>
                    <View style={styles.streakContainer}>
                        <Text style={styles.streakNumber}>{streakDays}</Text>
                        <FireIcon />
                    </View>
                    <TouchableOpacity style={styles.menuButton} onPress={() => setMenuVisible(true)} activeOpacity={0.7}>
                        <Image source={require('../../icons/menu.png')} style={{ width: scale(24), height: scale(24), tintColor: colors.text }} resizeMode="contain" />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <Text style={styles.screenTitle}>Экранное время</Text>
                <WeeklyBarChart data={chartData} />

                <View style={styles.statCardBlue}>
                    <Text style={styles.statCardBigText}>
                        {changeFromLastWeek >= 0 ? '+' : ''}{changeFromLastWeek}%
                    </Text>
                    <Text style={styles.lastWeekText}>За последнюю неделю</Text>
                </View>

                <View style={styles.statCardDarkBlue}>
                    <Text style={styles.statCardBigText}>{totalDurationFormatted}</Text>
                    <Text style={styles.screenTimeText}>Экранное время{'\n'}за неделю</Text>
                </View>
            </ScrollView>

            <BottomNavigation activeTab="statistics" />
            <MenuDrawer visible={menuVisible} onClose={() => setMenuVisible(false)} />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: scale(24),
        paddingTop: scale(16),
        paddingBottom: scale(16),
    },
    headerLeft: {
        flex: 1,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(8),
    },
    streakContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    // Figma: font-size: 24px, font-weight: 700, line-height: 21px
    streakNumber: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(24),
        color: colors.text,
        lineHeight: scale(21),
    },
    menuButton: { padding: scale(4) },
    scrollView: { flex: 1 },
    scrollContent: {
        paddingHorizontal: scale(20),
        paddingBottom: scale(100),
    },
    screenTitle: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(32),
        lineHeight: scale(34),
        color: colors.text,
        marginBottom: scale(20),
    },
    statCardBlue: {
        paddingTop: scale(16.5),
        paddingRight: scale(111),
        paddingBottom: scale(16.5),
        paddingLeft: scale(20),
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'flex-start',
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
    },
    statCardBigText: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(32),
        color: colors.text,
    },
    lastWeekText: {
        fontFamily: fonts.body.light,
        fontSize: scale(20),
        color: colors.text,
        lineHeight: scale(20),
        width: scale(232),
        height: scale(24),
    },
    screenTimeText: {
        fontFamily: fonts.body.light,
        fontSize: scale(20),
        color: colors.text,
        lineHeight: scale(20),
        width: scale(168),
        height: scale(40),
    },
});

export default ScreenTimeScreen;
