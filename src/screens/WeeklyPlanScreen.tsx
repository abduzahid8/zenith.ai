import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    StatusBar,
    TouchableOpacity,
    Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Circle, G, Defs, Filter, FeFlood, FeColorMatrix, FeOffset, FeGaussianBlur, FeComposite, FeBlend } from 'react-native-svg';
import { colors } from '../theme';

// Scale from Figma (402x874) to device
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const FIGMA_WIDTH = 402;
const scale = (size: number) => (SCREEN_WIDTH / FIGMA_WIDTH) * size;

// Fire emoji component
const FireIcon = () => (
    <Text style={{ fontSize: scale(24) }}>🔥</Text>
);

// Settings icon (3 vertical dots styled) - approximating visually from request description
const SettingsIcon = () => (
    <View style={{ width: scale(21), alignItems: 'center', justifyContent: 'center', gap: scale(3) }}>
        <View style={{ width: scale(4), height: scale(4), borderRadius: scale(2), backgroundColor: '#000' }} />
        <View style={{ width: scale(4), height: scale(4), borderRadius: scale(2), backgroundColor: '#000' }} />
        <View style={{ width: scale(4), height: scale(4), borderRadius: scale(2), backgroundColor: '#000' }} />
    </View>
);

// Circle Icon with Shadow SVG
const CircleIcon = () => (
    <Svg width={scale(26)} height={scale(26)} viewBox="0 0 26 26" fill="none">
        <G filter="url(#filter0_d)">
            <Circle cx="13" cy="12" r="12" fill="#C2C2C2" />
        </G>
        <Defs>
            <Filter id="filter0_d" x="0" y="0" width="26" height="26" filterUnits="userSpaceOnUse">
                <FeFlood floodOpacity="0" result="BackgroundImageFix" />
                <FeColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                <FeOffset dy="1" />
                <FeGaussianBlur stdDeviation="0.5" />
                <FeComposite in2="hardAlpha" operator="out" />
                <FeColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0" />
                <FeBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow" />
                <FeBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow" result="shape" />
            </Filter>
        </Defs>
    </Svg>
);

export const WeeklyPlanScreen: React.FC = () => {
    const router = useRouter();
    const [streakDays] = useState(4);
    const [activeTab, setActiveTab] = useState<'day' | 'week'>('day');

    const handleNavigateHome = () => {
        router.replace('/home');
    };

    const handleNavigateStatistics = () => {
        router.push('/statistics');
    };

    const handleNavigateAICoach = () => {
        router.push('/ai-coach-chat');
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerRight}>
                    <View style={styles.streakContainer}>
                        <Text style={styles.streakNumber}>{streakDays}</Text>
                        <FireIcon />
                    </View>
                    <TouchableOpacity style={styles.menuButton}>
                        <SettingsIcon />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Title */}
            <Text style={styles.screenTitle}>Твоя неделя</Text>

            {/* Toggle Buttons */}
            <View style={styles.toggleContainer}>
                <TouchableOpacity
                    style={[styles.toggleButton, activeTab === 'day' ? styles.toggleActiveDay : styles.toggleInactive]}
                    onPress={() => setActiveTab('day')}
                    activeOpacity={0.8}
                >
                    <Text style={styles.toggleText}>План на день</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.toggleButton, activeTab === 'week' ? styles.toggleActiveWeek : styles.toggleInactive]}
                    onPress={() => setActiveTab('week')}
                    activeOpacity={0.8}
                >
                    <Text style={styles.toggleText}>План на неделю</Text>
                </TouchableOpacity>
            </View>

            {/* Main Content Card */}
            <View style={styles.mainCard}>
                {/* Calendar Placeholder */}
                <View style={styles.calendarBlock} />

                {/* Day Content */}
                <View style={styles.dayContent}>
                    <Text style={styles.dayTitle}>Понедельник</Text>

                    <View style={styles.taskList}>
                        <View style={styles.taskItem}>
                            <CircleIcon />
                            <Text style={styles.taskText}>Изучить 1 базовый дебют</Text>
                        </View>
                        <View style={styles.taskItem}>
                            <CircleIcon />
                            <Text style={styles.taskText}>Сыграть 2 партии без{'\n'}отвлечений</Text>
                        </View>
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.actionButtonsRow}>
                        <TouchableOpacity
                            style={styles.actionButton}
                            activeOpacity={0.8}
                            onPress={() => router.push('/session-timer')}
                        >
                            <Text style={styles.actionButtonText}>Начать занятие</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.actionButton} onPress={handleNavigateAICoach} activeOpacity={0.8}>
                            <Text style={styles.actionButtonText}>ИИ-тренер</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            {/* Bottom Navigation */}
            <View style={styles.bottomNav}>
                <TouchableOpacity style={styles.navItem} onPress={handleNavigateHome}>
                    <Ionicons name="home-outline" size={scale(28)} color="#A3A3A3" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.navItem} onPress={handleNavigateStatistics}>
                    <Ionicons name="bar-chart" size={scale(28)} color="#A3A3A3" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.navItem} onPress={handleNavigateAICoach}>
                    <MaterialCommunityIcons name="lightbulb-outline" size={scale(28)} color="#A3A3A3" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.navItem}>
                    <MaterialCommunityIcons name="calendar-text" size={scale(28)} color="#000" />
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    // Header
    header: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingHorizontal: scale(24),
        paddingTop: scale(16),
        paddingBottom: scale(10), // Reduced bottom padding since title is below
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
        fontFamily: 'Gramatika-Bold',
        fontSize: scale(24),
        lineHeight: scale(21),
        color: '#000',
    },
    menuButton: {
        padding: scale(4),
    },
    // Title
    screenTitle: {
        fontFamily: 'Gramatika-Bold',
        fontSize: scale(32),
        lineHeight: scale(30),
        color: '#000',
        paddingHorizontal: scale(20),
        marginBottom: scale(24),
    },
    // Toggle Buttons
    toggleContainer: {
        flexDirection: 'column',
        paddingHorizontal: scale(20),
        gap: scale(10),
        marginBottom: scale(24),
    },
    toggleButton: {
        height: scale(45),
        borderRadius: scale(25),
        paddingHorizontal: scale(20),
        justifyContent: 'center',
        alignSelf: 'flex-start',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 4,
    },
    toggleActiveDay: {
        backgroundColor: '#A5A5A5',
        // width: scale(182), // Removed fixed width to prevent text clipping
    },
    toggleActiveWeek: { // Assuming styling might differ or be same as inactive but active state handling
        backgroundColor: '#A5A5A5',
    },
    toggleInactive: {
        backgroundColor: '#E0E0E0',
        // width: scale(214), // Removed fixed width to prevent text clipping
    },
    toggleText: {
        fontFamily: 'Gramatika-Bold',
        fontSize: scale(24),
        lineHeight: scale(25),
        color: '#000',
    },
    // Main Content Card
    mainCard: {
        width: scale(362),
        height: scale(404),
        backgroundColor: '#E0E0E0',
        borderRadius: scale(25),
        alignSelf: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 4,
        overflow: 'hidden', // Ensure children don't overflow rounded corners
    },
    calendarBlock: {
        width: scale(333),
        height: scale(140),
        backgroundColor: '#C2C2C2',
        borderRadius: scale(22),
        alignSelf: 'center',
        marginTop: scale(14), // Adjusted visually
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 4,
    },
    dayContent: {
        paddingHorizontal: scale(24),
        paddingTop: scale(20),
    },
    dayTitle: {
        fontFamily: 'Gramatika-Bold',
        fontSize: scale(32),
        lineHeight: scale(32), // Adjusted line height heavily as spec said 21 which is too small for 32px font
        color: '#000',
        marginBottom: scale(16),
    },
    taskList: {
        gap: scale(12),
        marginBottom: scale(24),
    },
    taskItem: {
        flexDirection: 'row',
        alignItems: 'center', // Or flex-start if multi-line text alignment needs it
        gap: scale(12),
    },
    taskText: {
        fontFamily: 'Geometria-Light', // Using Light as '300' weight corresponds to Light usually
        fontSize: scale(19),
        lineHeight: scale(21),
        color: '#000',
    },
    // Action Buttons Row
    actionButtonsRow: {
        flexDirection: 'row',
        gap: scale(10),
    },
    actionButton: {
        paddingVertical: scale(10),
        paddingHorizontal: scale(19),
        backgroundColor: '#C2C2C2',
        borderRadius: scale(30),
    },
    actionButtonText: {
        fontFamily: 'Gramatika-Bold',
        fontSize: scale(18),
        lineHeight: scale(25),
        color: '#000',
    },
    // Bottom Navigation
    bottomNav: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        height: scale(60),
        marginHorizontal: scale(16),
        marginBottom: scale(16),
        marginTop: 'auto', // Push to bottom
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

export default WeeklyPlanScreen;
