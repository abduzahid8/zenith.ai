import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    StatusBar,
    Image,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fonts } from '../theme';
import { WeeklyBarChart } from '../components/WeeklyBarChart';
import { MenuDrawer } from '../components/NavigationSidebar';
import { useUserProfileStore } from '../store/userProfileStore';
import { BottomNavigation } from '../components/BottomNavigation';
import { useDeviceScreenTimeStore } from '../store/deviceScreenTimeStore';
import { scale } from '../constants';
import { useAppTheme } from '../theme/useAppTheme';

const FireIcon = () => <Image source={require('../../icons/fire.png')} style={{ width: scale(24), height: scale(24) }} resizeMode="contain" />;

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const ScreenTimeScreen: React.FC = () => {
    const { streakDays } = useUserProfileStore();
    const {
        isAuthorized,
        isChecking,
        isLoading,
        error,
        dataSource,
        checkPermission,
        requestPermission,
        changeFromLastWeek,
        weeklyData,
        fetchWeeklyData,
        fetchTodayData,
    } = useDeviceScreenTimeStore();
    const [menuVisible, setMenuVisible] = useState(false);

    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    useEffect(() => {
        const init = async () => {
            const granted = await checkPermission();
            if (!granted) {
                await Promise.all([fetchWeeklyData(), fetchTodayData()]);
                return;
            }
            await Promise.all([fetchWeeklyData(), fetchTodayData()]);
        };
        init();
    }, [checkPermission, fetchWeeklyData, fetchTodayData]);

    const handleGrantAccess = async () => {
        let granted = await requestPermission();
        if (!granted) {
            granted = await checkPermission();
        }
        if (granted) {
            await Promise.all([fetchWeeklyData(), fetchTodayData()]);
            return;
        }
        await Promise.all([fetchWeeklyData(), fetchTodayData()]);
    };

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

    const hasAnalyticsData = isAuthorized || (weeklyData?.length ?? 0) > 0;

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
                <Text style={styles.screenTitle}>Screen Time</Text>
                {!hasAnalyticsData ? (
                    <View style={styles.permissionCard}>
                        <Text style={styles.permissionTitle}>No data access</Text>
                        <Text style={styles.permissionText}>
                            Grant access to Screen Time/Usage Access to see weekly analytics.
                        </Text>
                        <TouchableOpacity
                            style={styles.permissionButton}
                            onPress={handleGrantAccess}
                            activeOpacity={0.8}
                            disabled={isChecking}
                        >
                            {isChecking ? (
                                <ActivityIndicator color={colors.white} />
                            ) : (
                                <Text style={styles.permissionButtonText}>Grant Access</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                ) : (
                    <>
                        {!isAuthorized && (
                            <View style={styles.fallbackInfo}>
                                <Text style={styles.fallbackInfoText}>
                                    No direct device data access. Showing server-side app analytics.
                                </Text>
                                <TouchableOpacity
                                    style={styles.fallbackButton}
                                    onPress={handleGrantAccess}
                                    activeOpacity={0.8}
                                    disabled={isChecking}
                                >
                                    {isChecking ? (
                                        <ActivityIndicator color={colors.white} />
                                    ) : (
                                        <Text style={styles.fallbackButtonText}>Grant Device Access</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        )}

                        <WeeklyBarChart data={chartData} />

                        <View style={styles.statCardBlue}>
                            <Text style={styles.statCardBigText}>
                                {changeFromLastWeek >= 0 ? '+' : ''}{changeFromLastWeek}%
                            </Text>
                            <Text style={styles.lastWeekText}>This past week</Text>
                        </View>

                        <View style={styles.statCardDarkBlue}>
                            <Text style={styles.statCardBigText}>{totalDurationFormatted}</Text>
                            <Text style={styles.screenTimeText}>Screen time{'\n'}this week</Text>
                        </View>

                        {(isLoading || isChecking) && (
                            <View style={styles.loadingRow}>
                                <ActivityIndicator color={colors.text} />
                                <Text style={styles.loadingText}>Updating data...</Text>
                            </View>
                        )}

                        {!!error && (
                            <Text style={styles.errorText}>{error}</Text>
                        )}

                        {dataSource === 'supabase' && (
                            <Text style={styles.sourceText}>Data source: server-side app logs</Text>
                        )}
                    </>
                )}
            </ScrollView>

            <BottomNavigation />
            <MenuDrawer visible={menuVisible} onClose={() => setMenuVisible(false)} />
        </SafeAreaView>
    );
};

const createStyles = (colors: any) => StyleSheet.create({
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
        color: colors.statistics.darkText,
    },
    lastWeekText: {
        fontFamily: fonts.body.light,
        fontSize: scale(20),
        color: colors.statistics.darkText,
        lineHeight: scale(20),
        width: scale(232),
        height: scale(24),
    },
    screenTimeText: {
        fontFamily: fonts.body.light,
        fontSize: scale(20),
        color: colors.statistics.darkText,
        lineHeight: scale(20),
        width: scale(168),
        height: scale(40),
    },
    permissionCard: {
        marginTop: scale(8),
        borderRadius: scale(20),
        backgroundColor: colors.surfaceLight,
        padding: scale(20),
        gap: scale(12),
    },
    permissionTitle: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(22),
        lineHeight: scale(26),
        color: colors.text,
    },
    permissionText: {
        fontFamily: fonts.body.regular,
        fontSize: scale(15),
        lineHeight: scale(22),
        color: colors.textSecondary,
    },
    permissionButton: {
        marginTop: scale(8),
        height: scale(52),
        borderRadius: scale(30),
        backgroundColor: colors.buttonPrimary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    permissionButtonText: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(16),
        color: colors.buttonTextPrimary,
    },
    loadingRow: {
        marginTop: scale(14),
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(8),
    },
    loadingText: {
        fontFamily: fonts.body.regular,
        fontSize: scale(14),
        color: colors.textSecondary,
    },
    errorText: {
        marginTop: scale(10),
        fontFamily: fonts.body.regular,
        fontSize: scale(14),
        color: colors.error,
    },
    fallbackInfo: {
        marginBottom: scale(12),
        padding: scale(12),
        borderRadius: scale(14),
        backgroundColor: colors.surfaceLight,
    },
    fallbackInfoText: {
        fontFamily: fonts.body.regular,
        fontSize: scale(13),
        lineHeight: scale(18),
        color: colors.textSecondary,
    },
    fallbackButton: {
        marginTop: scale(10),
        borderRadius: scale(20),
        height: scale(40),
        paddingHorizontal: scale(14),
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.buttonPrimary,
    },
    fallbackButtonText: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(13),
        color: colors.buttonTextPrimary,
    },
    sourceText: {
        marginTop: scale(10),
        fontFamily: fonts.body.light,
        fontSize: scale(12),
        color: colors.textSecondary,
    },
});

export default ScreenTimeScreen;
