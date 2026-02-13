import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    StatusBar,
    TouchableOpacity,
    Dimensions,
    Image,
    Alert,
    Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme';
import { scale } from '../constants';
import { useAuthStore } from '../store/authStore';
import { useUserProfileStore, getGreeting } from '../store/userProfileStore';
import { MenuDrawer } from '../components/NavigationSidebar';
import { BottomNavigation } from '../components/BottomNavigation';
import { HomeScreenSkeleton } from '../components/UIStateComponents';
import { useDeviceScreenTimeStore, formatScreenTime } from '../store/deviceScreenTimeStore';
import { hasUsagePermission, requestScreenTimePermission } from 'device-activity';
import { DailyTasksList } from '../components/DailyTasksList';

// Fire emoji SVG component
const FireIcon = () => (
    <Text style={{ fontSize: scale(24) }}>🔥</Text>
);

// Chess piece icon
const ChessIcon = () => (
    <View style={styles.chessIcon}>
        <Text style={{ fontSize: scale(22) }}>♞</Text>
    </View>
);

export const HomeScreen: React.FC = () => {
    // HomeScreen mounted
    const router = useRouter();
    const { selectedHobby, isPremium, streakDays, userName } = useUserProfileStore();
    const { todayTotalSeconds, fetchTodayData, checkPermission, requestPermission, isAuthorized } = useDeviceScreenTimeStore();
    const [menuVisible, setMenuVisible] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Check permissions and fetch data on mount
        const initScreenTime = async () => {
            try {
                if (Platform.OS === 'ios' || Platform.OS === 'android') {
                    const authorized = await checkPermission();
                    if (!authorized) {
                        await requestPermission();
                    } else {
                        await fetchTodayData();
                    }
                }
            } finally {
                setIsLoading(false);
            }
        };
        initScreenTime();
    }, []);


    // ... existing code ...

    // Get dynamic greeting based on time and user name
    const greeting = getGreeting();

    const handleStartSession = () => {
        router.push('/session-timer');
    };

    const handleDailyGoal = () => {
        router.push('/(app)/weekly-plan' as any);
    };

    const handleAICoach = () => {
        router.push('/ai-coach');
    };

    const handleScreenTime = () => {
        router.push('/(app)/screen-time' as any);
    };

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
                <HomeScreenSkeleton />
                <BottomNavigation activeTab="home" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.greetingText}>{greeting}</Text>
                <View style={styles.headerRight}>
                    <ChessIcon />
                    <View style={styles.streakContainer}>
                        <Text style={styles.streakNumber}>{streakDays}</Text>
                        <FireIcon />
                    </View>
                    <TouchableOpacity style={styles.menuButton} onPress={() => setMenuVisible(true)} activeOpacity={0.7}>
                        <Feather name="menu" size={scale(24)} color={colors.text} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Content */}
            <View style={styles.content}>
                {/* Start Session Card - Large */}
                <TouchableOpacity
                    style={styles.startSessionCard}
                    onPress={handleStartSession}
                    activeOpacity={0.8}
                >
                    <Text style={styles.cardTitle}>Начать занятие</Text>
                </TouchableOpacity>

                {/* Daily Tasks List */}
                <DailyTasksList />

                {/* Two side-by-side cards */}
                <View style={styles.bottomCardsRow}>
                    {/* AI Coach Card - Taller */}
                    <TouchableOpacity
                        style={styles.aiCoachCard}
                        onPress={handleAICoach}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.smallCardTitle}>ИИ-{'\n'}наставник</Text>
                    </TouchableOpacity>

                    {/* Screen Time Card - Shorter, text at top */}
                    <TouchableOpacity
                        style={styles.screenTimeCard}
                        onPress={handleScreenTime}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.smallCardTitle}>Экранное{'\n'}время:</Text>
                    </TouchableOpacity>
                </View>
            </View>



            {/* Bottom Navigation */}
            <BottomNavigation activeTab="home" />

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
    // Header
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: scale(24),
        paddingTop: scale(16),
        paddingBottom: scale(24),
    },
    // Figma: font-size 32px, weight 700, line-height 22px
    greetingText: {
        fontFamily: 'Gramatika-Bold',
        fontSize: scale(32),
        lineHeight: scale(38),
        color: colors.text,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(8),
    },
    chessIcon: {
        width: scale(28),
        height: scale(28),
        justifyContent: 'center',
        alignItems: 'center',
    },
    streakContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    // Figma: font-size 24px, weight 700
    streakNumber: {
        fontFamily: 'Gramatika-Bold',
        fontSize: scale(24),
        color: colors.text,
    },
    menuButton: {
        padding: scale(4),
    },
    // Content - pushed down from header
    content: {
        flex: 1,
        paddingHorizontal: scale(16),
        marginTop: scale(140),
    },
    // Start Session Card - Figma: height 150px, border-radius 25px, background #DCDCDC
    startSessionCard: {
        height: scale(150),
        borderRadius: scale(25),
        backgroundColor: colors.home.cardBorder,
        paddingHorizontal: scale(17),
        paddingTop: scale(26),
        marginBottom: scale(24),
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
    },
    // Figma: font-size 24px, weight 700, line-height 22px, color #1E1E2E
    cardTitle: {
        fontFamily: 'Gramatika-Bold',
        fontSize: scale(24),
        lineHeight: scale(26),
        color: colors.home.darkText,
    },
    // Daily Goal Button - Figma: border-radius 50px, padding 26px
    dailyGoalButton: {
        borderRadius: scale(50),
        backgroundColor: colors.home.cardBorder,
        paddingVertical: scale(26),
        paddingHorizontal: scale(26),
        marginBottom: scale(24),
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
    },
    // Bottom row with two cards
    bottomCardsRow: {
        flexDirection: 'row',
        gap: scale(16),
        alignItems: 'flex-start',
    },
    // AI Coach Card - WIDER and text at bottom
    aiCoachCard: {
        flex: 1.3,
        height: scale(155),
        borderRadius: scale(25),
        backgroundColor: colors.home.cardBorder,
        paddingHorizontal: scale(17),
        paddingVertical: scale(19),
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
        justifyContent: 'flex-end',
    },
    // Screen Time Card - Narrower, text at top
    screenTimeCard: {
        flex: 1,
        height: scale(155),
        borderRadius: scale(25),
        backgroundColor: colors.home.cardBorder,
        paddingHorizontal: scale(17),
        paddingVertical: scale(19),
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
        justifyContent: 'flex-start',
    },
    smallCardTitle: {
        fontFamily: 'Gramatika-Bold',
        fontSize: scale(22),
        lineHeight: scale(24),
        color: colors.home.darkText,
    },
});

export default HomeScreen;
