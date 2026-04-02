import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Animated,
    Modal,
    Platform,
    Linking,
    Image,
} from 'react-native';
import PagerView from 'react-native-pager-view';
import { WeeklyBarChart } from '../../components/WeeklyBarChart';
import { HobbyTimeBarChart } from '../../components/HobbyTimeBarChart';
import { useDeviceScreenTimeStore } from '../../store/deviceScreenTimeStore';
import { useHobbyTimeStore } from '../../store/hobbyTimeStore';
import { scale, SCREEN_WIDTH } from '../../constants';
import { fonts } from '../../theme';
import { useAppTheme } from '../../theme/useAppTheme';
import { useT, useLanguageStore } from '../../store/languageStore';

const WEEK_DAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEK_DAYS_RU = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export const ScreenTimeTab: React.FC = () => {
    const pagerRef = useRef<PagerView>(null);
    const t = useT();
    const language = useLanguageStore((s) => s.language);
    const weekDays = language === 'ru' ? WEEK_DAYS_RU : WEEK_DAYS_EN;
    
    // Animated page indicator
    const pagerPosition = useRef(new Animated.Value(0)).current;
    const pagerOffset = useRef(new Animated.Value(0)).current;
    const scrollX = useRef(Animated.add(pagerPosition, pagerOffset)).current;
    
    const dot1Width = scrollX.interpolate({
        inputRange: [0, 1],
        outputRange: [scale(65), scale(13)],
        extrapolate: 'clamp',
    });
    const dot2Width = scrollX.interpolate({
        inputRange: [0, 1],
        outputRange: [scale(13), scale(65)],
        extrapolate: 'clamp',
    });
    
    const {
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

    const { weeklyData: hobbyWeeklyData, getThisWeekSeconds, getProductivityChange } = useHobbyTimeStore();

    const [showPermissionModal, setShowPermissionModal] = useState(false);
    const [showManualSteps, setShowManualSteps] = useState(false);

    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    // Hobby time data — Mon→Sun of current week; falls back to last week if no data yet
    const hobbyChartData = useMemo(() => {
        const today = new Date();
        const dayOfWeek = today.getDay(); // 0=Sun
        const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const monday = new Date(today);
        monday.setDate(today.getDate() - daysFromMonday);

        const buildWeek = (startMonday: Date) =>
            Array.from({ length: 7 }, (_, i) => {
                const d = new Date(startMonday);
                d.setDate(startMonday.getDate() + i);
                const dateKey = d.toISOString().split('T')[0];
                const dataPoint = hobbyWeeklyData?.find(wd => wd.date === dateKey);
                return {
                    day: weekDays[(d.getDay() + 6) % 7], // Monday-first mapping
                    value: dataPoint ? Number((dataPoint.seconds / 3600).toFixed(1)) : 0,
                };
            });

        const currentWeek = buildWeek(monday);
        const hasData = currentWeek.some(d => d.value > 0);
        if (!hasData && hobbyWeeklyData?.length > 0) {
            const lastMonday = new Date(monday);
            lastMonday.setDate(monday.getDate() - 7);
            return buildWeek(lastMonday);
        }
        return currentWeek;
    }, [hobbyWeeklyData, weekDays]);

    const hobbyTotalFormatted = useMemo(() => {
        const today = new Date();
        const weekAgo = new Date(today);
        weekAgo.setDate(today.getDate() - 6);
        weekAgo.setHours(0, 0, 0, 0);
        console.log('[ScreenTimeTab] hobbyWeeklyData:', JSON.stringify(hobbyWeeklyData));
        const total = hobbyWeeklyData
            .filter(d => new Date(d.date) >= weekAgo)
            .reduce((acc, curr) => acc + curr.seconds, 0);
        console.log('[ScreenTimeTab] hobbyTotal seconds:', total);
        const hours = Math.floor(total / 3600);
        const minutes = Math.floor((total % 3600) / 60);
        const secs = Math.floor(total % 60);
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }, [hobbyWeeklyData]);

    const { value: productivityValue, isNewUser } = useMemo(() => getProductivityChange(), [hobbyWeeklyData]);

    useEffect(() => {
        const init = async () => {
            console.log('[ScreenTimeTab] Initializing screen time data');
            const granted = await checkPermission();
            console.log('[ScreenTimeTab] Permission check result:', granted);
            if (!granted) {
                setShowPermissionModal(true);
            }
            await Promise.all([fetchWeeklyData(), fetchTodayData()]);
        };
        init();
    }, [checkPermission, fetchWeeklyData, fetchTodayData]);

    const handleGrantAccess = async () => {
        console.log('[ScreenTimeTab] handleGrantAccess pressed - requesting permission');
        setShowManualSteps(false);
        const granted = await requestPermission();
        console.log('[ScreenTimeTab] Permission request result:', granted);
        if (granted) {
            console.log('[ScreenTimeTab] Permission granted - data fetched by store');
            setShowPermissionModal(false);
        } else {
            console.log('[ScreenTimeTab] Native dialog unavailable — showing manual steps');
            setShowPermissionModal(true);
            setShowManualSteps(true);
        }
    };

    const handleOpenSettings = () => {
        Linking.openSettings();
    };

    const chartData = useMemo(() => {
        if (!weeklyData || weeklyData.length === 0) {
            return weekDays.map((_, i) => {
                const d = new Date();
                d.setDate(d.getDate() - (6 - i));
                return { day: weekDays[(d.getDay() + 6) % 7], value: 0 };
            });
        }
        return weeklyData.map(d => {
            const date = new Date(d.date);
            return {
                day: weekDays[(date.getDay() + 6) % 7],
                value: Number((d.seconds / 3600).toFixed(1)),
            };
        }).slice(-7);
    }, [weeklyData, weekDays]);

    const totalDurationFormatted = useMemo(() => {
        const total = (weeklyData || []).reduce((acc, curr) => acc + curr.seconds, 0);
        const hours = Math.floor(total / 3600);
        const minutes = Math.floor((total % 3600) / 60);
        const secs = Math.floor(total % 60);
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }, [weeklyData]);

    // True only when there is at least one day with non-zero screen time
    const hasRealData = useMemo(
        () => (weeklyData || []).some(d => d.seconds > 0),
        [weeklyData]
    );
    const hasAnalyticsData = hasRealData;
    const hasHobbyData = hobbyWeeklyData.length > 0;

    return (
        <View style={styles.container}>
            <Modal
                visible={showPermissionModal}
                transparent
                animationType="slide"
                statusBarTranslucent
                onRequestClose={() => setShowPermissionModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalSheet}>
                        <View style={styles.modalHandle} />
                        <View style={styles.modalIconContainer}>
                            <Image
                                source={require('../../../assets/icons/stopwatch_premium.png')}
                                style={styles.modalIcon}
                                resizeMode="contain"
                            />
                        </View>
                        {!showManualSteps ? (
                            <>
                                <Text style={styles.modalTitle}>
                                    {t('Доступ к экранному времени')}
                                </Text>
                                <Text style={styles.modalDesc}>
                                    {Platform.OS === 'ios'
                                        ? t('Разреши доступ к Screen Time, чтобы видеть свою еженедельную аналитику использования телефона.')
                                        : t('Разреши доступ к статистике использования, чтобы видеть свою еженедельную аналитику использования телефона.')}
                                </Text>
                                <Text style={styles.modalHint}>
                                    {Platform.OS === 'ios'
                                        ? t('Нажми «Разрешить» — откроется системный диалог.')
                                        : t('Нажми «Разрешить» — откроются настройки доступа.')}
                                </Text>
                                <TouchableOpacity
                                    style={styles.modalAllowBtn}
                                    onPress={handleGrantAccess}
                                    activeOpacity={0.85}
                                    disabled={isChecking}
                                >
                                    {isChecking ? (
                                        <ActivityIndicator color={colors.buttonTextPrimary || '#fff'} />
                                    ) : (
                                        <Text style={styles.modalAllowText}>{t('Разрешить')}</Text>
                                    )}
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.modalLaterBtn}
                                    onPress={() => setShowPermissionModal(false)}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.modalLaterText}>{t('Не сейчас')}</Text>
                                </TouchableOpacity>
                            </>
                        ) : (
                            <>
                                <Text style={styles.modalTitle}>
                                    {t('Включи вручную')}
                                </Text>
                                <Text style={styles.modalDesc}>
                                    {t('Открой Настройки и включи доступ к Screen Time:')}
                                </Text>
                                <View style={styles.stepsContainer}>
                                    <Text style={styles.stepText}>{'1.  '}{t('Настройки → Экранное время')}</Text>
                                    <Text style={styles.stepText}>{'2.  '}{t('Включи «Экранное время»')}</Text>
                                    <Text style={styles.stepText}>{'3.  '}{t('Вернись в приложение')}</Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.modalAllowBtn}
                                    onPress={handleOpenSettings}
                                    activeOpacity={0.85}
                                >
                                    <Text style={styles.modalAllowText}>{t('Открыть Настройки')}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.modalLaterBtn}
                                    onPress={() => { setShowPermissionModal(false); setShowManualSteps(false); }}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.modalLaterText}>{t('Закрыть')}</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </View>
            </Modal>
            <PagerView
                ref={pagerRef}
                style={styles.pagerView}
                initialPage={0}
                onPageScroll={Animated.event(
                    [{ nativeEvent: { position: pagerPosition, offset: pagerOffset } }],
                    { useNativeDriver: false }
                )}
            >
                {/* Page 1: Screen Time */}
                <ScrollView
                    key="1"
                    style={styles.page}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    <Text style={styles.screenTitle}>{t('Экранное время')}</Text>
                    {!hasAnalyticsData ? (
                        // No data access - show zeros instead of permission card
                        <>
                            <WeeklyBarChart data={chartData} />

                            <View style={styles.statCardBlue}>
                                <Text style={styles.statCardBigText}>0%</Text>
                                <Text style={styles.lastWeekText}>{t('За последнюю неделю')}</Text>
                            </View>

                            <View style={styles.statCardDarkBlue}>
                                <Text style={styles.statCardBigText}>00:00:00</Text>
                                <Text style={styles.screenTimeText}>{t('Время экрана\nна этой неделе')}</Text>
                            </View>
                        </>
                    ) : (
                        <>
                            <WeeklyBarChart data={chartData} />

                            <View style={styles.statCardBlue}>
                                <Text style={styles.statCardBigText}>
                                    {changeFromLastWeek >= 0 ? '+' : ''}{changeFromLastWeek}%
                                </Text>
                                <Text style={styles.lastWeekText}>{t('За последнюю неделю')}</Text>
                            </View>

                            <View style={styles.statCardDarkBlue}>
                                <Text style={styles.statCardBigText}>{totalDurationFormatted}</Text>
                                <Text style={styles.screenTimeText}>{t('Время экрана\nна этой неделе')}</Text>
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

                {/* Page 2: Hobby Time */}
                <ScrollView
                    key="2"
                    style={styles.page}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    <Text style={styles.screenTitle}>{t('Время Хобби')}</Text>
                    <HobbyTimeBarChart data={hobbyChartData} />

                    <View style={styles.statCardPurple}>
                        <Text style={styles.statCardBigText}>
                            {productivityValue >= 0 ? '+' : ''}{productivityValue}%
                        </Text>
                        <Text style={styles.lastWeekText}>
                            {isNewUser ? t('Top productivity') : t('За последнюю неделю')}
                        </Text>
                    </View>

                    <View style={styles.statCardDarkPurple}>
                        <Text style={styles.statCardBigText}>{hobbyTotalFormatted}</Text>
                        <Text style={styles.screenTimeText}>{t('Spend time on Hobby')}</Text>
                    </View>

                    {!hasHobbyData && (
                        <View style={styles.emptyHint}>
                            <Text style={styles.emptyHintText}>
                                Complete hobby tasks to start tracking your productive time.
                            </Text>
                        </View>
                    )}
                </ScrollView>
            </PagerView>

            {/* Animated Page Indicator */}
            <View style={styles.pageIndicator}>
                <Animated.View style={[styles.mainDot, { width: dot1Width }]} />
                <Animated.View style={[styles.mainDot, { width: dot2Width }]} />
            </View>
        </View>
    );
};

const createStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
    },
    pagerView: {
        flex: 1,
    },
    page: {
        width: SCREEN_WIDTH,
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: scale(20),
        paddingBottom: scale(100),
    },
    pageIndicator: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: scale(8),
        paddingVertical: scale(16),
        marginBottom: scale(80),
    },
    mainDot: {
        height: scale(13),
        borderRadius: scale(31),
        backgroundColor: '#262A44',
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
        backgroundColor: colors.statistics?.screenTimeCard || '#7DD3FC',
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
        backgroundColor: colors.statistics?.screenTimeCardDark || '#60A5FA',
        marginBottom: scale(20),
        minHeight: scale(100),
    },
    statCardPurple: {
        paddingTop: scale(16.5),
        paddingRight: scale(111),
        paddingBottom: scale(16.5),
        paddingLeft: scale(20),
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'flex-start',
        alignSelf: 'stretch',
        borderRadius: scale(25),
        backgroundColor: colors.statistics?.hobbyCardLight || '#EFD6F8',
        marginTop: scale(31),
        marginBottom: scale(10),
        minHeight: scale(100),
    },
    statCardDarkPurple: {
        padding: scale(20),
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'flex-start',
        alignSelf: 'stretch',
        borderRadius: scale(25),
        backgroundColor: colors.statistics?.hobbyCardDark || '#C084FC',
        marginBottom: scale(20),
        minHeight: scale(100),
    },
    statCardBigText: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(32),
        color: colors.statistics?.darkText || '#1F2937',
    },
    lastWeekText: {
        fontFamily: fonts.body.light,
        fontSize: scale(20),
        color: colors.statistics?.darkText || '#1F2937',
        lineHeight: scale(20),
    },
    screenTimeText: {
        fontFamily: fonts.body.light,
        fontSize: scale(20),
        color: colors.statistics?.darkText || '#1F2937',
        lineHeight: scale(20),
    },
    permissionCard: {
        marginTop: scale(8),
        borderRadius: scale(20),
        backgroundColor: colors.surfaceLight || colors.background,
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
        backgroundColor: colors.buttonPrimary || colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    permissionButtonText: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(16),
        color: colors.buttonTextPrimary || colors.white,
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
        backgroundColor: colors.surfaceLight || colors.background,
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
        backgroundColor: colors.buttonPrimary || colors.primary,
    },
    fallbackButtonText: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(13),
        color: colors.buttonTextPrimary || colors.white,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'flex-end',
    },
    modalSheet: {
        backgroundColor: colors.background || '#fff',
        borderTopLeftRadius: scale(28),
        borderTopRightRadius: scale(28),
        paddingHorizontal: scale(24),
        paddingBottom: scale(40),
        paddingTop: scale(12),
        alignItems: 'center',
    },
    modalHandle: {
        width: scale(40),
        height: scale(5),
        borderRadius: scale(3),
        backgroundColor: colors.textSecondary ? colors.textSecondary + '55' : '#ccc',
        marginBottom: scale(20),
    },
    modalIconContainer: {
        width: scale(110),
        height: scale(110),
        marginBottom: scale(14),
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalIcon: {
        width: '100%',
        height: '100%',
    },
    modalTitle: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(22),
        color: colors.text,
        textAlign: 'center',
        marginBottom: scale(12),
    },
    modalDesc: {
        fontFamily: fonts.body.regular,
        fontSize: scale(15),
        lineHeight: scale(22),
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: scale(8),
    },
    modalHint: {
        fontFamily: fonts.body.light,
        fontSize: scale(13),
        lineHeight: scale(18),
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: scale(28),
        opacity: 0.7,
    },
    modalAllowBtn: {
        width: '100%',
        height: scale(54),
        borderRadius: scale(30),
        backgroundColor: colors.buttonPrimary || '#262A44',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: scale(12),
    },
    modalAllowText: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(16),
        color: colors.buttonTextPrimary || '#fff',
    },
    modalLaterBtn: {
        width: '100%',
        height: scale(46),
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalLaterText: {
        fontFamily: fonts.body.regular,
        fontSize: scale(15),
        color: colors.textSecondary,
    },
    stepsContainer: {
        alignSelf: 'stretch',
        gap: scale(10),
        marginBottom: scale(24),
        paddingHorizontal: scale(4),
    },
    stepText: {
        fontFamily: fonts.body.regular,
        fontSize: scale(15),
        lineHeight: scale(22),
        color: colors.text,
    },
    sourceText: {
        marginTop: scale(10),
        fontFamily: fonts.body.light,
        fontSize: scale(12),
        color: colors.textSecondary,
    },
    emptyHint: {
        marginTop: scale(16),
        padding: scale(16),
        borderRadius: scale(14),
        backgroundColor: colors.surfaceLight || colors.background,
        alignItems: 'center',
    },
    emptyHintText: {
        fontFamily: fonts.body.regular,
        fontSize: scale(14),
        color: colors.textSecondary,
        textAlign: 'center',
    },
});

export default ScreenTimeTab;
