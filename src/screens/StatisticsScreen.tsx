import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    StatusBar,
    TouchableOpacity,
    ScrollView,
    Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../theme';
import { WeeklyBarChart } from '../components/WeeklyBarChart';
import { MenuDrawer } from '../components/MenuDrawer';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const FIGMA_WIDTH = 402;
const scale = (size: number) => (SCREEN_WIDTH / FIGMA_WIDTH) * size;

// Fire emoji component
const FireIcon = () => (
    <Text style={{ fontSize: scale(24) }}>🔥</Text>
);

// Tools/Wrench Icon from Figma SVG - width: 80px, height: 80px
const ToolsIcon = () => (
    <Svg width={scale(80)} height={scale(80)} viewBox="0 0 80 80" fill="none">
        <Path
            d="M12.54 27.5602C16.272 24.6602 19.368 26.6602 23.5 31.4442C23.964 31.9842 24.588 31.3522 24.944 31.0442C25.296 30.7322 30.748 25.8242 31.016 25.6002C31.28 25.3642 31.6 24.9242 31.18 24.4322C30.1683 23.1808 29.1775 21.9126 28.208 20.6282C20.976 11.1682 47.992 4.75217 43.844 4.65217C41.732 4.59617 33.26 4.49617 31.992 4.63617C26.86 5.17617 20.416 9.97217 17.172 12.2082C12.928 15.1122 11.344 16.8162 11.084 17.0522C9.884 18.1002 10.892 20.5202 8.716 22.4282C6.416 24.4402 4.98 22.9162 3.648 24.0842C2.988 24.6682 1.14 26.0522 0.612004 26.5122C0.0800045 26.9802 -0.0159955 27.7682 0.528004 28.3962C0.528004 28.3962 5.584 33.9802 6.008 34.4762C6.428 34.9642 7.572 35.3882 8.276 34.7602C8.984 34.1362 10.804 32.5482 11.108 32.2682C11.42 32.0042 10.908 28.8242 12.54 27.5602ZM35.372 29.6282C34.892 29.0722 34.296 29.0562 33.784 29.5122L28.048 34.5202C27.8266 34.7211 27.6916 35.0001 27.6715 35.2984C27.6513 35.5967 27.7476 35.8913 27.94 36.1202L61.116 73.8762C61.892 74.7682 63.236 74.8602 64.12 74.0882L68 70.8362C68.4271 70.4601 68.6885 69.9307 68.7274 69.3629C68.7664 68.7952 68.5797 68.2351 68.208 67.8042L35.372 29.6282ZM79.608 13.5602C79.312 11.5842 78.288 11.9962 77.756 12.8322C77.224 13.6762 74.872 17.2402 73.904 18.8562C72.944 20.4562 70.576 23.6202 66.168 20.4962C61.576 17.2522 63.172 14.9882 63.972 13.4642C64.776 11.9322 67.244 7.63617 67.6 7.10417C67.956 6.56417 67.54 4.99617 66.116 5.65217C64.688 6.30817 56.024 9.75217 54.824 14.6922C53.596 19.7162 55.852 24.2082 51.424 28.6682L46.052 34.2682L51.448 40.5322L58.064 34.2522C59.64 32.6682 63.008 31.1282 66.056 31.8242C72.588 33.3002 76.152 30.8482 78.3 26.7922C80.228 23.1682 79.908 15.5362 79.608 13.5602ZM10.956 68.2122C10.5559 68.6153 10.3314 69.1602 10.3314 69.7282C10.3314 70.2961 10.5559 70.8411 10.956 71.2442L14.76 74.9642C15.592 75.8002 16.912 75.4482 17.744 74.6122L37.372 55.3162L31.36 48.4602L10.956 68.2122Z"
            fill="#2E2E43"
        />
    </Svg>
);

interface WeeklyData {
    day: string;
    value: number;
}

const mockWeeklyData: WeeklyData[] = [
    { day: 'Пн', value: 3 },
    { day: 'Вт', value: 5 },
    { day: 'Ср', value: 3.5 },
    { day: 'Чт', value: 1 },
    { day: 'Пт', value: 2 },
    { day: 'Сб', value: 4.5 },
    { day: 'Вс', value: 2.5 },
];

export const StatisticsScreen: React.FC = () => {
    const router = useRouter();
    const [streakDays] = useState(4);
    const [menuVisible, setMenuVisible] = useState(false);
    const [totalChange] = useState(-24);

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

            {/* Header - Streak counter and menu */}
            <View style={styles.header}>
                <View style={styles.headerLeft} />
                <View style={styles.headerRight}>
                    {/* Figma: color: #000, font-family: Gramatika, font-size: 24px, font-weight: 700, line-height: 21px */}
                    <View style={styles.streakContainer}>
                        <Text style={styles.streakNumber}>{streakDays}</Text>
                        <FireIcon />
                    </View>
                    <TouchableOpacity style={styles.menuButton} onPress={() => setMenuVisible(true)}>
                        <Feather name="menu" size={scale(24)} color="#000" />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Weekly Bar Chart - Figma: width: 362px, height: 304px, border-radius: 30px, background: #D6DEF8 */}
                <WeeklyBarChart
                    data={mockWeeklyData}
                    changePercent={totalChange}
                    periodLabel={`за последнюю\nнеделю`}
                />

                {/* Page Indicators - Figma: pill 65x13, circle 13x13, background: #2E2E43 */}
                <View style={styles.pageIndicators}>
                    {/* Figma: width: 65px, height: 13px, border-radius: 31px, background: #2E2E43 */}
                    <View style={styles.indicatorPill} />
                    {/* Figma: width: 13px, height: 13px, border-radius: 31px, background: #2E2E43 */}
                    <View style={styles.indicatorCircle} />
                </View>

                {/* Maintenance/Coming Soon Section */}
                <View style={styles.maintenanceSection}>
                    {/* Icon - Figma: width: 80px, height: 80px, aspect-ratio: 1/1 */}
                    <View style={styles.iconContainer}>
                        <ToolsIcon />
                    </View>

                    {/* Title - "Ой! Мы еще наводим здесь порядок" */}
                    <Text style={styles.maintenanceTitle}>
                        Ой! Мы еще наводим здесь порядок
                    </Text>

                    {/* Subtitle - Figma: font-size: 12px, font-weight: 300, line-height: 15px, width: 251px */}
                    <Text style={styles.maintenanceSubtitle}>
                        Этот блок временно недоступен.{'\n'}
                        Совсем скоро здесь будет много{'\n'}
                        интересного!
                    </Text>
                </View>
            </ScrollView>

            {/* Bottom Navigation */}
            <View style={styles.bottomNav}>
                <TouchableOpacity style={styles.navItem} onPress={() => router.push('/home')}>
                    <Ionicons name="home-outline" size={scale(28)} color="#A3A3A3" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.navItem}>
                    <Ionicons name="bar-chart" size={scale(28)} color="#000" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.navItem} onPress={() => router.push('/ai-coach-chat')}>
                    <MaterialCommunityIcons name="lightbulb-outline" size={scale(28)} color="#A3A3A3" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.navItem} onPress={() => router.push('/weekly-plan')}>
                    <MaterialCommunityIcons name="calendar-text" size={scale(28)} color="#A3A3A3" />
                </TouchableOpacity>
            </View>

            {/* Menu Drawer */}
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
        fontFamily: 'Gramatika-Bold',
        fontSize: scale(24),
        color: '#000',
        lineHeight: scale(21),
    },
    menuButton: {
        padding: scale(4),
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingVertical: scale(8),
        paddingBottom: scale(24),
    },
    // Page Indicators
    pageIndicators: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: scale(8),
        marginTop: scale(20),
        marginBottom: scale(32),
    },
    // Figma: width: 65px, height: 13px, border-radius: 31px, background: #2E2E43
    indicatorPill: {
        width: scale(65),
        height: scale(13),
        borderRadius: scale(31),
        backgroundColor: '#2E2E43',
    },
    // Figma: width: 13px, height: 13px, border-radius: 31px, background: #2E2E43
    indicatorCircle: {
        width: scale(13),
        height: scale(13),
        borderRadius: scale(31),
        backgroundColor: '#2E2E43',
    },
    // Maintenance Section
    maintenanceSection: {
        alignItems: 'center',
        paddingHorizontal: scale(32),
    },
    iconContainer: {
        width: scale(80),
        height: scale(80),
        marginBottom: scale(16),
    },
    // Figma: font-family: Geometria, font-size: 20px, font-weight: 300, line-height: 22px
    maintenanceTitle: {
        fontFamily: 'Geometria-Bold',
        fontSize: scale(18),
        color: '#000',
        textAlign: 'center',
        lineHeight: scale(22),
        marginBottom: scale(12),
    },
    // Figma: font-size: 12px, font-weight: 300, line-height: 15px, width: 251px
    maintenanceSubtitle: {
        fontFamily: 'Geometria-Light',
        fontSize: scale(12),
        color: '#2E2E43',
        textAlign: 'center',
        lineHeight: scale(15),
        width: scale(251),
    },
    bottomNav: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        height: scale(60),
        marginHorizontal: scale(16),
        marginBottom: scale(16),
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
});

export default StatisticsScreen;
