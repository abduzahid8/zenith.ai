import React, { useState, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    StatusBar,
    TouchableOpacity,
    ScrollView,
    Dimensions,
    LayoutAnimation,
    Platform,
    UIManager,
} from 'react-native';

if (Platform.OS === 'android') {
    if (UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }
}
import { useRouter } from 'expo-router';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Path, Circle } from 'react-native-svg';
import PagerView from 'react-native-pager-view';
import { colors } from '../theme';
import { MenuDrawer } from '../components/MenuDrawer';
import { WeeklyBarChart } from '../components/WeeklyBarChart';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const FIGMA_WIDTH = 402;
const scale = (size: number) => (SCREEN_WIDTH / FIGMA_WIDTH) * size;

// Tab configuration
const TABS = [
    { key: 'home', icon: 'home', iconOutline: 'home-outline', type: 'ionicon' },
    { key: 'statistics', icon: 'bar-chart', iconOutline: 'bar-chart-outline', type: 'ionicon' },
    { key: 'ai-coach', icon: 'lightbulb', iconOutline: 'lightbulb-outline', type: 'material' },
    { key: 'weekly-plan', icon: 'clipboard-text', iconOutline: 'clipboard-text-outline', type: 'material' },
];

// Icons
const FireIcon = () => <Text style={{ fontSize: scale(24) }}>🔥</Text>;
const ChessIcon = () => (
    <View style={styles.chessIcon}>
        <Text style={{ fontSize: scale(22) }}>♞</Text>
    </View>
);

// Send icon for AI Coach
const SendIcon = () => (
    <Svg width={scale(25)} height={scale(25)} viewBox="0 0 25 25" fill="none">
        <Path
            d="M1.7207 24.4697C1.93894 24.5358 2.28825 24.5079 2.95801 24.2549C3.61366 24.0072 4.46761 23.5888 5.64941 23.0088L20.751 15.5977C21.9079 15.0299 22.7428 14.619 23.3359 14.2549C23.9356 13.8868 24.2008 13.6166 24.3135 13.3682C24.5622 12.8197 24.5621 12.1725 24.3135 11.624C24.2008 11.3755 23.9356 11.1044 23.3359 10.7363C22.7428 10.3723 21.9077 9.96223 20.751 9.39453L5.67578 1.99512C4.49043 1.41344 3.63313 0.994551 2.97559 0.746094C2.3035 0.492175 1.95364 0.464832 1.73535 0.53125C1.22288 0.687411 0.788236 1.10412 0.582031 1.68066C0.485874 1.94949 0.484274 2.3675 0.649414 3.12402C0.811859 3.86815 1.11147 4.84445 1.52344 6.18652L3.01758 11.0557C3.14237 11.4622 3.22438 11.7304 3.26367 11.9961H11.8428C12.1189 11.9961 12.3428 12.22 12.3428 12.4961C12.3427 12.7721 12.1188 12.9961 11.8428 12.9961H3.24414C3.19983 13.2234 3.12483 13.4678 3.02051 13.8105L1.49414 18.8262C1.08662 20.1652 0.791068 21.1394 0.630859 21.8818C0.468108 22.6362 0.470007 23.0538 0.566406 23.3223C0.773359 23.8977 1.20872 24.3144 1.7207 24.4697Z"
            fill="black"
        />
    </Svg>
);

// Tools Icon for Statistics
const ToolsIcon = () => (
    <Svg width={scale(80)} height={scale(80)} viewBox="0 0 80 80" fill="none">
        <Path
            d="M12.54 27.5602C16.272 24.6602 19.368 26.6602 23.5 31.4442C23.964 31.9842 24.588 31.3522 24.944 31.0442C25.296 30.7322 30.748 25.8242 31.016 25.6002C31.28 25.3642 31.6 24.9242 31.18 24.4322C30.1683 23.1808 29.1775 21.9126 28.208 20.6282C20.976 11.1682 47.992 4.75217 43.844 4.65217C41.732 4.59617 33.26 4.49617 31.992 4.63617C26.86 5.17617 20.416 9.97217 17.172 12.2082C12.928 15.1122 11.344 16.8162 11.084 17.0522C9.884 18.1002 10.892 20.5202 8.716 22.4282C6.416 24.4402 4.98 22.9162 3.648 24.0842C2.988 24.6682 1.14 26.0522 0.612004 26.5122C0.0800045 26.9802 -0.0159955 27.7682 0.528004 28.3962C0.528004 28.3962 5.584 33.9802 6.008 34.4762C6.428 34.9642 7.572 35.3882 8.276 34.7602C8.984 34.1362 10.804 32.5482 11.108 32.2682C11.42 32.0042 10.908 28.8242 12.54 27.5602Z"
            fill="#2E2E43"
        />
    </Svg>
);

// Mock data
const mockWeeklyData = [
    { day: 'Пн', value: 3 },
    { day: 'Вт', value: 5 },
    { day: 'Ср', value: 3.5 },
    { day: 'Чт', value: 1 },
    { day: 'Пт', value: 2 },
    { day: 'Сб', value: 4.5 },
    { day: 'Вс', value: 2.5 },
];

export const MainTabsScreen: React.FC = () => {
    const router = useRouter();
    const pagerRef = useRef<PagerView>(null);
    const [activeTab, setActiveTab] = useState(0);
    const [streakDays] = useState(4);
    const [menuVisible, setMenuVisible] = useState(false);
    const [weeklyToggle, setWeeklyToggle] = useState<'day' | 'week'>('day');
    const [showPractice, setShowPractice] = useState(true);

    const handleTabPress = (index: number) => {
        pagerRef.current?.setPage(index);
        setActiveTab(index);
    };

    const handlePageSelected = (event: any) => {
        const newIndex = event.nativeEvent.position;
        if (newIndex !== activeTab) {
            setActiveTab(newIndex);
        }
    };

    const handleNavigate = (route: string) => {
        router.push(route as any);
    };

    const renderTabIcon = (tab: typeof TABS[0], index: number) => {
        const isActive = activeTab === index;
        const color = isActive ? '#000' : '#A3A3A3';
        const iconName = isActive ? tab.icon : tab.iconOutline;

        if (tab.type === 'ionicon') {
            return <Ionicons name={iconName as any} size={scale(28)} color={color} />;
        } else {
            return <MaterialCommunityIcons name={iconName as any} size={scale(28)} color={color} />;
        }
    };

    // Dynamic header title
    const getHeaderTitle = () => {
        switch (activeTab) {
            case 0: return 'Привет !';
            default: return '';
        }
    };

    const getBackgroundColor = () => {
        return activeTab === 3 ? '#EAF0F8' : colors.background;
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: getBackgroundColor() }]}>
            <StatusBar barStyle="dark-content" backgroundColor={getBackgroundColor()} />

            {/* Shared Header */}
            <View style={styles.header}>
                <Text style={styles.greetingText}>{getHeaderTitle()}</Text>
                <View style={styles.headerRight}>
                    {activeTab === 0 && <ChessIcon />}
                    <View style={styles.streakContainer}>
                        <Text style={styles.streakNumber}>{streakDays}</Text>
                        <FireIcon />
                    </View>
                    <TouchableOpacity style={styles.menuButton} onPress={() => setMenuVisible(true)}>
                        <Feather name="menu" size={scale(24)} color="#000" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Swipeable Pages with PagerView */}
            <PagerView
                ref={pagerRef}
                style={styles.pagerView}
                initialPage={0}
                onPageSelected={handlePageSelected}
            >
                {/* PAGE 1: Home */}
                <View key="1" style={styles.page}>
                    <View style={styles.homeContent}>
                        <TouchableOpacity
                            style={styles.startSessionCard}
                            onPress={() => handleNavigate('/session-timer')}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.cardTitle}>Начать занятие</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.dailyGoalButton} activeOpacity={0.8}>
                            <Text style={styles.cardTitle}>Цель дня</Text>
                        </TouchableOpacity>

                        <View style={styles.bottomCardsRow}>
                            <TouchableOpacity
                                style={styles.aiCoachCard}
                                onPress={() => handleNavigate('/ai-coach')}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.smallCardTitle}>ИИ-{'\n'}наставник</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.screenTimeCard}
                                onPress={() => handleNavigate('/screen-time')}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.smallCardTitle}>Экранное{'\n'}время:</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {/* PAGE 2: Statistics */}
                <View key="2" style={styles.page}>
                    <ScrollView style={styles.statsScroll} showsVerticalScrollIndicator={false}>
                        <WeeklyBarChart
                            data={mockWeeklyData}
                            changePercent={-24}
                            periodLabel={`за последнюю\nнеделю`}
                        />
                        <View style={styles.pageIndicators}>
                            <View style={styles.indicatorPill} />
                            <View style={styles.indicatorCircle} />
                        </View>
                        <View style={styles.maintenanceSection}>
                            <ToolsIcon />
                            <Text style={styles.maintenanceTitle}>Ой! Мы еще наводим здесь порядок</Text>
                            <Text style={styles.maintenanceSubtitle}>
                                Этот блок временно недоступен.{'\n'}
                                Совсем скоро здесь будет много{'\n'}
                                интересного!
                            </Text>
                        </View>
                    </ScrollView>
                </View>

                {/* PAGE 3: AI Coach */}
                <View key="3" style={styles.page}>
                    <View style={styles.aiContent}>
                        <View style={styles.aiTitleContainer}>
                            <Text style={styles.aiTitle}>Достигни{'\n'}своего зенита!</Text>
                        </View>
                        <View style={styles.aiBottomSection}>
                            <View style={styles.suggestionsContainer}>
                                <View style={styles.suggestionRowLeft}>
                                    <TouchableOpacity style={styles.suggestionButton} activeOpacity={0.8}>
                                        <Text style={styles.suggestionText}>Как быстрее прогрессировать?</Text>
                                    </TouchableOpacity>
                                </View>
                                <View style={styles.suggestionRowSpaced}>
                                    <TouchableOpacity style={styles.suggestionButton} activeOpacity={0.8}>
                                        <Text style={styles.suggestionText}>Объясни мой прогресс</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.suggestionButton} activeOpacity={0.8}>
                                        <Text style={styles.suggestionText}>Что сделать сегодня?</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                            <TouchableOpacity
                                style={styles.inputButton}
                                onPress={() => handleNavigate('/ai-coach')}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.inputPlaceholder}>С чего начнем?</Text>
                                <SendIcon />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {/* PAGE 4: Weekly Plan - New Design */}
                <View key="4" style={styles.planPage}>
                    {/* Title */}
                    <Text style={styles.planTitle}>Твой план</Text>

                    {/* Toggle Buttons */}
                    <View style={styles.planToggleContainer}>
                        <TouchableOpacity
                            style={[styles.planToggleButton, weeklyToggle === 'day' ? styles.planToggleActive : styles.planToggleInactive]}
                            onPress={() => setWeeklyToggle('day')}
                            activeOpacity={0.8}
                        >
                            <Text style={[styles.planToggleText, weeklyToggle === 'day' ? styles.planToggleTextActive : styles.planToggleTextInactive]}>
                                План на день
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.planToggleButton, weeklyToggle === 'week' ? styles.planToggleActive : styles.planToggleInactive]}
                            onPress={() => setWeeklyToggle('week')}
                            activeOpacity={0.8}
                        >
                            <Text style={[styles.planToggleText, weeklyToggle === 'week' ? styles.planToggleTextActive : styles.planToggleTextInactive]}>
                                План на неделю
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Settings Bar */}
                    <View style={styles.planSettingsBar}>
                        <View style={styles.planSettingsIcon}>
                            {/* "Checklist" Icon matching Figma */}
                            <Svg width={scale(24)} height={scale(24)} viewBox="0 0 24 24" fill="none">
                                {/* Top: Checkmark + Line */}
                                <Path d="M3 7L5 9L9 5" stroke="#EAF0F8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                <Path d="M12 7H21" stroke="#EAF0F8" strokeWidth="2" strokeLinecap="round" />

                                {/* Bottom: Circle + Line */}
                                <Circle cx="6" cy="17" r="3" stroke="#EAF0F8" strokeWidth="2" />
                                <Path d="M12 17H21" stroke="#EAF0F8" strokeWidth="2" strokeLinecap="round" />
                            </Svg>
                        </View>
                        <TouchableOpacity onPress={() => {
                            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                            setShowPractice(!showPractice);
                        }}>
                            <Svg width={scale(22)} height={scale(13)} viewBox="0 0 22 13" fill="none">
                                <Path d={showPractice ? "M2 11L10.2929 2.70711C10.6834 2.31658 11.3166 2.31658 11.7071 2.70711L20 11" : "M2 2L10.2929 10.2929C10.6834 10.6834 11.3166 10.6834 11.7071 10.2929L20 2"} stroke="#EAF0F8" strokeWidth="4" strokeLinecap="round" />
                            </Svg>
                        </TouchableOpacity>
                    </View>

                    {showPractice && (
                        <>
                            {/* Task Card 1: Дебют */}
                            <View style={styles.planTaskCard}>
                                <Text style={styles.planTaskTitle}>Дебют</Text>
                                <Text style={styles.planTaskDescription}>Изучить Королевский Гамбит</Text>
                            </View>

                            {/* Task Card 2: Практика */}
                            <View style={styles.planTaskCard}>
                                <Text style={styles.planTaskTitle}>Практика</Text>
                                <Text style={styles.planTaskDescription}>Сыграть 2 партии без отвлечений</Text>
                            </View>
                        </>
                    )}
                </View>
            </PagerView>

            {/* Shared Bottom Navigation */}
            <View style={styles.bottomNav}>
                {TABS.map((tab, index) => (
                    <TouchableOpacity
                        key={tab.key}
                        style={styles.navItem}
                        onPress={() => handleTabPress(index)}
                    >
                        {renderTabIcon(tab, index)}
                    </TouchableOpacity>
                ))}
            </View>

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
        paddingBottom: scale(16),
    },
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
    streakNumber: {
        fontFamily: 'Gramatika-Bold',
        fontSize: scale(24),
        color: '#000',
    },
    menuButton: {
        padding: scale(4),
    },
    // PagerView
    pagerView: {
        flex: 1,
    },
    page: {
        width: SCREEN_WIDTH,
        flex: 1,
    },
    // ============== HOME PAGE STYLES ==============
    homeContent: {
        flex: 1,
        paddingHorizontal: scale(16),
        marginTop: scale(140),
    },
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
    cardTitle: {
        fontFamily: 'Gramatika-Bold',
        fontSize: scale(24),
        lineHeight: scale(26),
        color: '#1E1E2E',
    },
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
    bottomCardsRow: {
        flexDirection: 'row',
        gap: scale(16),
        alignItems: 'flex-start',
    },
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
    // ============== STATISTICS PAGE STYLES ==============
    statsScroll: {
        flex: 1,
        paddingHorizontal: scale(16),
    },
    pageIndicators: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: scale(8),
        marginTop: scale(24),
        marginBottom: scale(32),
    },
    indicatorPill: {
        width: scale(65),
        height: scale(13),
        borderRadius: scale(31),
        backgroundColor: '#2E2E43',
    },
    indicatorCircle: {
        width: scale(13),
        height: scale(13),
        borderRadius: scale(31),
        backgroundColor: '#2E2E43',
    },
    maintenanceSection: {
        alignItems: 'center',
        paddingTop: scale(24),
    },
    maintenanceTitle: {
        fontFamily: 'Gramatika-Bold',
        fontSize: scale(16),
        lineHeight: scale(20),
        color: '#000',
        textAlign: 'center',
        marginTop: scale(20),
        marginBottom: scale(12),
    },
    maintenanceSubtitle: {
        fontFamily: 'Gramatika-Light',
        fontSize: scale(12),
        lineHeight: scale(15),
        color: '#666',
        textAlign: 'center',
    },
    // ============== AI COACH PAGE STYLES ==============
    aiContent: {
        flex: 1,
        paddingHorizontal: scale(20),
    },
    aiTitleContainer: {
        flex: 1,
        justifyContent: 'center',
        paddingBottom: scale(100),
    },
    aiTitle: {
        fontFamily: 'Gramatika-Bold',
        fontSize: scale(36),
        lineHeight: scale(36),
        color: '#000',
    },
    aiBottomSection: {
        paddingBottom: scale(24),
    },
    suggestionsContainer: {
        gap: scale(10),
        marginBottom: scale(20),
    },
    suggestionRowLeft: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    suggestionRowSpaced: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    suggestionButton: {
        paddingVertical: scale(8),
        paddingHorizontal: scale(23),
        borderRadius: scale(30),
        backgroundColor: '#D7D7D7',
    },
    suggestionText: {
        fontFamily: 'Gramatika-Light',
        fontSize: scale(13),
        lineHeight: scale(16),
        color: '#000',
    },
    inputButton: {
        width: '100%',
        height: scale(55),
        paddingHorizontal: scale(22),
        borderRadius: scale(25),
        borderWidth: 2,
        borderColor: '#000000',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    inputPlaceholder: {
        fontFamily: 'Gramatika-Light',
        fontSize: scale(20),
        color: '#4E4E4E',
    },
    // ============== PLAN PAGE STYLES (New Figma Design) ==============
    planPage: {
        width: SCREEN_WIDTH,
        flex: 1,
        backgroundColor: '#EAF0F8',
        paddingHorizontal: scale(20),
    },
    planTitle: {
        fontFamily: 'Gramatika-Bold',
        fontSize: scale(32),
        lineHeight: scale(30),
        color: '#2E2E43',
        width: scale(214),
        marginBottom: scale(24),
    },
    planToggleContainer: {
        flexDirection: 'column',
        gap: scale(10),
        marginBottom: scale(24),
    },
    planToggleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: scale(10),
        paddingHorizontal: scale(20),
        borderRadius: scale(25),
        alignSelf: 'flex-start',
        gap: scale(10),
    },
    planToggleActive: {
        backgroundColor: '#2E2E43',
    },
    planToggleInactive: {
        backgroundColor: '#FFFFFF',
    },
    planToggleText: {
        fontFamily: 'Gramatika-Bold',
        fontSize: scale(24),
        lineHeight: scale(25),
    },
    planToggleTextActive: {
        color: '#EAF0F8',
    },
    planToggleTextInactive: {
        color: '#000000',
    },
    planSettingsBar: {
        width: scale(340),
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: scale(20),
        paddingLeft: scale(25),
        paddingRight: scale(36),
        borderRadius: scale(30),
        backgroundColor: '#2E2E43',
        marginBottom: scale(16),
    },
    planSettingsIcon: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    planTaskCard: {
        width: scale(340),
        padding: scale(25),
        borderRadius: scale(25),
        backgroundColor: '#D6DEF8',
        alignSelf: 'center',
        marginBottom: scale(10),
    },
    planTaskTitle: {
        fontFamily: 'Gramatika-Bold',
        fontSize: scale(24),
        lineHeight: scale(28),
        color: '#2E2E43',
        alignSelf: 'stretch',
        marginBottom: scale(10),
    },
    planTaskDescription: {
        fontFamily: 'Geometria-Light',
        fontSize: scale(19),
        lineHeight: scale(23),
        color: '#2E2E43',
        alignSelf: 'stretch',
    },
    // ============== BOTTOM NAVIGATION ==============
    bottomNav: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        height: scale(60),
        marginHorizontal: scale(16),
        marginBottom: scale(16),
        borderRadius: scale(47),
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
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

export default MainTabsScreen;
