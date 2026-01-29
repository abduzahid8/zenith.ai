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
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme';
import { useAuthStore } from '../store/authStore';
import { MenuDrawer } from '../components/NavigationSidebar';

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
    const { selectedHobby, isPremium } = useAuthStore();
    const [greeting, setGreeting] = useState('Привет');
    const [streakDays] = useState(4);
    const [menuVisible, setMenuVisible] = useState(false);

    // Set greeting based on time of day
    useEffect(() => {
        const hour = new Date().getHours();
        if (hour < 12) {
            setGreeting('Доброе утро');
        } else if (hour < 18) {
            setGreeting('Добрый день');
        } else {
            setGreeting('Добрый вечер');
        }
    }, []);

    const handleStartSession = () => {
        router.push('/session-timer');
    };

    const handleDailyGoal = () => {
        router.push('/weekly-plan');
    };

    const handleAICoach = () => {
        router.push('/ai-coach');
    };

    const handleScreenTime = () => {
        router.push('/screen-time');
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.greetingText}>Привет !</Text>
                <View style={styles.headerRight}>
                    <ChessIcon />
                    <View style={styles.streakContainer}>
                        <Text style={styles.streakNumber}>{streakDays}</Text>
                        <FireIcon />
                    </View>
                    <TouchableOpacity style={styles.menuButton} onPress={() => setMenuVisible(true)}>
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
            <View style={styles.bottomNav}>
                <TouchableOpacity style={styles.navItem}>
                    <Ionicons name="home" size={scale(28)} color="#000" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.navItem} onPress={() => router.push('/statistics')}>
                    <Ionicons name="bar-chart" size={scale(28)} color="#A3A3A3" />
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
    // Figma: font-size 22px, weight 700, line-height 22px
    smallCardTitle: {
        fontFamily: 'Gramatika-Bold',
        fontSize: scale(22),
        lineHeight: scale(24),
        color: '#1E1E2E',
    },
    // Bottom Navigation - Figma: height 60px, border-radius 47px
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

export default HomeScreen;
