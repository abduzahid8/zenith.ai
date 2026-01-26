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

interface WeeklyData {
    day: string;
    value: number;
}

const mockWeeklyData: WeeklyData[] = [
    { day: 'Пн', value: 3 },
    { day: 'Вт', value: 5 },
    { day: 'Ср', value: 3 },
    { day: 'Чт', value: 1 },
    { day: 'Пт', value: 2 },
    { day: 'Сб', value: 4 },
    { day: 'Вс', value: 2 },
];

export const ScreenTimeScreen: React.FC = () => {
    const router = useRouter();
    const [streakDays] = useState(4);
    const [menuVisible, setMenuVisible] = useState(false);
    const [totalChange] = useState(-24);
    const [weeklyTime] = useState('12ч 22 мин');

    const handleShare = () => {
        // TODO: Implement share functionality
        console.log('Share pressed');
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

            {/* Header - Streak counter and menu */}
            <View style={styles.header}>
                <View style={styles.headerLeft} />
                <View style={styles.headerRight}>
                    {/* Figma: font-size: 24px, font-weight: 700, line-height: 21px */}
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
                {/* Weekly Bar Chart */}
                <WeeklyBarChart
                    data={mockWeeklyData}
                    changePercent={totalChange}
                    periodLabel={`за последнюю\nнеделю`}
                />

                {/* Share/Upload Button - Figma: 362x50, border-radius: 30px, background: #E0E0E0 */}
                <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
                    <Ionicons name="arrow-up" size={scale(24)} color="#000" />
                </TouchableOpacity>

                {/* Stats Card - Figma: padding: 25px, border-radius: 25px, background: #E0E0E0 */}
                <View style={styles.statsCard}>
                    {/* Figma: -24% with border-radius: 25px, background: #E0E0E0 */}
                    <Text style={styles.statsPercent}>
                        {totalChange > 0 ? '+' : ''}{totalChange}%
                    </Text>
                    {/* Figma: font-family: Geometria, font-size: 20px, font-weight: 300, line-height: 22px */}
                    <Text style={styles.statsLabel}>экранного времени</Text>

                    {/* Figma: font-family: Geometria, font-size: 18px, font-weight: 500, line-height: 20px, letter-spacing: -1px */}
                    <Text style={styles.timeLabel}>Экранное время за{'\n'}неделю:</Text>
                    {/* Figma: font-family: Gramatika, font-size: 26px, font-weight: 700, line-height: 22px */}
                    <Text style={styles.timeValue}>{weeklyTime}</Text>
                </View>
            </ScrollView>

            {/* Bottom Navigation */}
            <View style={styles.bottomNav}>
                <TouchableOpacity style={styles.navItem} onPress={() => router.push('/home')}>
                    <Ionicons name="home-outline" size={scale(28)} color="#A3A3A3" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.navItem} onPress={() => router.push('/statistics')}>
                    <Ionicons name="bar-chart" size={scale(28)} color="#000" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.navItem} onPress={() => router.push('/ai-coach-chat')}>
                    <MaterialCommunityIcons name="lightbulb-outline" size={scale(28)} color="#A3A3A3" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.navItem}>
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
    // Figma: width: 362px, height: 50px, border-radius: 30px, background: #E0E0E0
    shareButton: {
        alignSelf: 'center',
        width: scale(362),
        height: scale(50),
        backgroundColor: '#E0E0E0',
        borderRadius: scale(30),
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: scale(16),
        marginBottom: scale(16),
    },
    // Figma: padding: 25px 145px 27px 20px, border-radius: 30px, gap: 15px
    statsCard: {
        alignSelf: 'center',
        width: scale(362),
        backgroundColor: '#E0E0E0',
        borderRadius: scale(30),
        paddingTop: scale(6),
        paddingBottom: scale(6),
        paddingLeft: scale(20),
        paddingRight: scale(145),
        gap: scale(5), // Reduced for compact look
    },
    // Figma: border-radius: 25px, background: #E0E0E0 (inherits from card)
    statsPercent: {
        fontFamily: 'Gramatika-Bold',
        fontSize: scale(48),
        color: '#000',
        marginBottom: scale(4),
    },
    // Figma: font-family: Geometria, font-size: 20px, font-weight: 300, line-height: 22px
    statsLabel: {
        fontFamily: 'Gramatika-Light',
        fontSize: scale(20),
        color: '#000',
        lineHeight: scale(22),
        marginBottom: scale(15),
    },
    // Figma: font-family: Geometria, font-size: 18px, font-weight: 500, line-height: 20px, letter-spacing: -1px
    timeLabel: {
        fontFamily: 'Gramatika-Medium',
        fontSize: scale(18),
        color: '#000',
        lineHeight: scale(20),
        letterSpacing: -1,
    },
    // Figma: font-family: Gramatika, font-size: 26px, font-weight: 700, line-height: 22px
    timeValue: {
        fontFamily: 'Gramatika-Bold',
        fontSize: scale(26),
        color: '#000',
        lineHeight: scale(22),
        marginTop: scale(8),
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

export default ScreenTimeScreen;
