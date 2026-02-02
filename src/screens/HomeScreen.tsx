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
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme';
import { useAuthStore, getGreeting } from '../store/authStore';
import { MenuDrawer } from '../components/NavigationSidebar';
import { BottomNavigation } from '../components/BottomNavigation';
import { Platform } from 'react-native';
// @ts-ignore
import { hasUsagePermission } from 'device-activity';

// Scale from Figma (402x874) to device
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const FIGMA_WIDTH = 402;
const scale = (size: number) => (SCREEN_WIDTH / FIGMA_WIDTH) * size;

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
    const router = useRouter();
    const { selectedHobby, isPremium, streakDays, userName } = useAuthStore();
    const [menuVisible, setMenuVisible] = useState(false);

    useEffect(() => {
        if (Platform.OS === 'android') {
            checkAutoPrompt();
        }
    }, []);

    const checkAutoPrompt = async () => {
        try {
            const hasPerm = await hasUsagePermission();
            if (!hasPerm) {
                Alert.alert(
                    "Allow Phone Analysis",
                    "We need access to your usage stats to provide insights. Would you like to enable this?",
                    [
                        { text: "No", style: "cancel" },
                        { text: "Yes", onPress: () => router.push('/phone-analysis') }
                    ]
                );
            }
        } catch (e) {
            console.log('Error checking permissions', e);
        }
    };

    // Get dynamic greeting based on time and user name
    const greeting = getGreeting();

    const handleStartSession = () => {
        router.push('/session-timer');
    };

    const handleDailyGoal = () => {
        router.replace('/main-tabs');
    };

    const handleAICoach = () => {
        router.push('/ai-coach');
    };

    const handleScreenTime = () => {
        router.replace('/main-tabs');
    };

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
                        <Feather name="menu" size={scale(24)} color="#000" />
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

                {/* Daily Goal Button */}
                <TouchableOpacity
                    style={styles.dailyGoalButton}
                    onPress={handleDailyGoal}
                    activeOpacity={0.8}
                >
                    <Text style={styles.cardTitle}>Цель дня</Text>
                </TouchableOpacity>

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
        color: '#000',
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
        color: '#000',
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
        backgroundColor: '#DCDCDC',
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
        color: '#1E1E2E',
    },
    // Daily Goal Button - Figma: border-radius 50px, padding 26px
    dailyGoalButton: {
        borderRadius: scale(50),
        backgroundColor: '#DCDCDC',
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
        backgroundColor: '#DCDCDC',
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
        backgroundColor: '#DCDCDC',
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
        color: '#1E1E2E',
    },
});

export default HomeScreen;
