import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    StatusBar,
    TouchableOpacity,
    ScrollView,
    Dimensions,
    Platform,
    UIManager,
    Image,
    Animated,
    Easing,
} from 'react-native';

if (Platform.OS === 'android') {
    if (UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }
}

import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import PagerView from 'react-native-pager-view';
import { colors } from '../theme';
import { MenuDrawer } from '../components/NavigationSidebar';
import { WeeklyBarChart } from '../components/WeeklyBarChart';
import { useAuthStore, getGreeting } from '../store/authStore';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const booksImage = require('../../assets/images/home-books.png');
const targetImage = require('../../assets/images/home-target.png');
const lightbulbImage = require('../../assets/images/home-lightbulb.png');
const chartImage = require('../../assets/images/home-chart.png');

const FIGMA_WIDTH = 402;
const scale = (size: number) => (SCREEN_WIDTH / FIGMA_WIDTH) * size;

// Tab configuration
const TABS = [
    { key: 'home', icon: 'home', iconOutline: 'home-outline', type: 'ionicon' },
    { key: 'weekly-plan', icon: 'clipboard-text', iconOutline: 'clipboard-text-outline', type: 'material' },
    { key: 'ai-coach', icon: 'lightbulb', iconOutline: 'lightbulb-outline', type: 'material' },
    { key: 'statistics', icon: 'bar-chart', iconOutline: 'bar-chart-outline', type: 'ionicon' },
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

export const MainTabsScreen: React.FC<{ initialTab?: number }> = ({ initialTab = 0 }) => {
    const router = useRouter();
    const pagerRef = useRef<PagerView>(null);
    const [activeTab, setActiveTab] = useState(initialTab);
    const { streakDays, userName, user } = useAuthStore();
    const isPremium = true; // ⚠️ FORCED PREMIUM FOR TESTING
    const [menuVisible, setMenuVisible] = useState(false);
    const [showTasks, setShowTasks] = useState(false); // 4th task card for premium users

    useEffect(() => {
        if (user?.id) {
            console.log('🆔 YOUR USER ID:', user.id);
        }
    }, [user]);

    // Animation values
    const fadeAnim = useRef(new Animated.Value(0)).current;

    const playAnimation = useCallback(() => {
        fadeAnim.setValue(0); // Reset to start
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
            easing: Easing.out(Easing.cubic),
        }).start();
    }, [fadeAnim]);

    // Trigger on internal tab switch
    useEffect(() => {
        if (activeTab === 0) {
            playAnimation();
        }
    }, [activeTab, playAnimation]);

    // Trigger on navigation return (screen focus)
    useFocusEffect(
        useCallback(() => {
            if (activeTab === 0) {
                playAnimation();
            }
        }, [activeTab, playAnimation])
    );

    const iconTranslateY = fadeAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [50, 0],
    });

    // Get dynamic greeting
    const greeting = getGreeting();

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

    // Dynamic header title based on active tab
    const getHeaderTitle = () => {
        switch (activeTab) {
            case 0: return greeting;
            default: return '';
        }
    };

    const getBackgroundColor = () => {
        return '#EAF0F8';
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
                    <TouchableOpacity style={styles.menuButton} onPress={() => setMenuVisible(true)} activeOpacity={0.7}>
                        <Feather name="menu" size={scale(24)} color="#000" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Swipeable Pages with PagerView */}
            <PagerView
                ref={pagerRef}
                style={styles.pagerView}
                initialPage={initialTab}
                onPageSelected={handlePageSelected}
            >
                {/* PAGE 1: Home */}
                <View key="1" style={styles.page}>
                    <View style={styles.homeContent}>
                        <TouchableOpacity
                            onPress={() => handleNavigate('/session-timer')}
                            activeOpacity={0.8}
                            style={styles.cardShadowProp}
                        >
                            <LinearGradient
                                start={{ x: 1, y: 1 }}
                                end={{ x: 0, y: 0 }}
                                colors={['#BFD8F9', '#CDE3FC', '#DAEEFF']}
                                locations={[0.0258, 0.6253, 1.0]}
                                style={styles.startSessionCard}
                            >
                                <Text style={styles.cardTitle}>Начать{'\n'}занятие</Text>
                                <Animated.Image
                                    source={booksImage}
                                    style={[
                                        styles.booksImage,
                                        {
                                            opacity: fadeAnim,
                                            transform: [
                                                { translateY: iconTranslateY },
                                                { rotate: '-5.4deg' }
                                            ]
                                        }
                                    ]}
                                    resizeMode="contain"
                                />
                            </LinearGradient>
                        </TouchableOpacity>

                        <TouchableOpacity activeOpacity={0.8} style={styles.cardShadowProp}>
                            <LinearGradient
                                start={{ x: 0, y: 0.5 }}
                                end={{ x: 1, y: 0.5 }}
                                colors={['#76B9FF', '#D2E8FF']}
                                locations={[0.0125, 1.0]}
                                style={styles.dailyGoalButton}
                            >
                                <Text style={styles.cardTitle}>Цель дня</Text>
                                <Animated.Image
                                    source={targetImage}
                                    style={[
                                        styles.targetImage,
                                        {
                                            opacity: fadeAnim,
                                            transform: [{ translateY: iconTranslateY }]
                                        }
                                    ]}
                                    resizeMode="contain"
                                />
                            </LinearGradient>
                        </TouchableOpacity>

                        <View style={styles.bottomCardsRow}>
                            <TouchableOpacity
                                onPress={() => handleNavigate('/ai-coach')}
                                activeOpacity={0.8}
                                style={[styles.cardShadowProp, { flex: 1.3 }]}
                            >
                                <LinearGradient
                                    start={{ x: 0.3, y: 0 }}
                                    end={{ x: 0.8, y: 1 }}
                                    colors={['#8CDEFF', '#D5F3FF']}
                                    locations={[0.1155, 0.9307]}
                                    style={styles.aiCoachCard}
                                >
                                    <View style={{ zIndex: 1 }}>
                                        <Text style={styles.smallCardTitle}>Личный{'\n'}наставник</Text>
                                    </View>
                                    <Animated.Image
                                        source={lightbulbImage}
                                        style={[
                                            styles.lightbulbImage,
                                            {
                                                opacity: fadeAnim,
                                                transform: [{ translateY: iconTranslateY }]
                                            }
                                        ]}
                                        resizeMode="contain"
                                    />
                                </LinearGradient>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => handleNavigate('/screen-time')}
                                activeOpacity={0.8}
                                style={[styles.cardShadowProp, { flex: 1 }]}
                            >
                                <LinearGradient
                                    start={{ x: 0.5, y: 0 }}
                                    end={{ x: 0.5, y: 1 }}
                                    colors={['#D6D7F8', '#E0E2FF']}
                                    style={styles.screenTimeCard}
                                >
                                    <View style={{ zIndex: 1 }}>
                                        <Text style={styles.smallCardTitle}>Экранное{'\n'}время</Text>
                                    </View>
                                    <Animated.Image
                                        source={chartImage}
                                        style={[
                                            styles.chartImage,
                                            {
                                                opacity: fadeAnim,
                                                transform: [{ translateY: iconTranslateY }]
                                            }
                                        ]}
                                        resizeMode="contain"
                                    />
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {/* PAGE 2: Your Day - New Design */}
                <View key="2" style={styles.yourDayPage}>
                    {/* Title */}
                    <Text style={styles.yourDayTitle}>Твой день</Text>

                    {/* Task Card 1: Theory */}
                    <TouchableOpacity style={styles.theoryCard} activeOpacity={0.8}>
                        <View style={styles.taskCardContent}>
                            <View style={styles.taskCardTextContainer}>
                                <Text style={styles.taskCardTitle}>Теория</Text>
                                <Text style={styles.taskCardDescription}>Изучить{"\n"}Королевский Гамбит</Text>
                            </View>
                            <View style={styles.theoryIconContainer}>
                                {/* Book Icon */}
                                <Svg width={scale(24)} height={scale(24)} viewBox="0 0 24 24" fill="none">
                                    <Path d="M4 19.5C4 18.837 4.26339 18.2011 4.73223 17.7322C5.20107 17.2634 5.83696 17 6.5 17H20" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    <Path d="M6.5 2H20V22H6.5C5.83696 22 5.20107 21.7366 4.73223 21.2678C4.26339 20.7989 4 20.163 4 19.5V4.5C4 3.83696 4.26339 3.20107 4.73223 2.73223C5.20107 2.26339 5.83696 2 6.5 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </Svg>
                            </View>
                        </View>
                    </TouchableOpacity>

                    {/* Task Card 2: Practice */}
                    <TouchableOpacity style={styles.practiceCard} activeOpacity={0.8}>
                        <View style={styles.taskCardContent}>
                            <View style={styles.taskCardTextContainer}>
                                <Text style={styles.taskCardTitle}>Практика</Text>
                                <Text style={styles.taskCardDescription}>Сыграть 2 партии</Text>
                            </View>
                            <View style={styles.practiceIconContainer}>
                                {/* Chess/Practice Icon */}
                                <Svg width={scale(24)} height={scale(24)} viewBox="0 0 24 24" fill="none">
                                    <Path d="M12 2L14.5 9H9.5L12 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    <Path d="M5 22H19" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    <Path d="M6 18H18" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    <Path d="M8 22V18" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    <Path d="M16 22V18" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    <Path d="M5 14H19L18 18H6L5 14Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    <Path d="M7 14L8 9H16L17 14" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </Svg>
                            </View>
                        </View>
                    </TouchableOpacity>

                    {/* Task Card 3: Analysis - Always visible */}
                    <View style={styles.analysisCard}>
                        <View style={styles.taskCardContent}>
                            <View style={styles.taskCardTextContainer}>
                                <Text style={styles.analysisTitle}>Анализ</Text>
                                <Text style={styles.analysisDescription}>Рассмотреть партию</Text>
                            </View>
                            <View style={styles.analysisIconContainer}>
                                {/* Magnifying Glass Icon */}
                                <Svg width={scale(24)} height={scale(24)} viewBox="0 0 24 24" fill="none">
                                    <Path d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    <Path d="M21 21L16.65 16.65" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </Svg>
                            </View>
                        </View>
                    </View>

                    {/* Task Card 4: Tasks - Only for premium users when showTasks is true */}
                    {isPremium && showTasks && (
                        <View style={styles.tasksCard}>
                            <View style={styles.taskCardContent}>
                                <View style={styles.taskCardTextContainer}>
                                    <Text style={styles.tasksTitle}>Задачи</Text>
                                    <Text style={styles.tasksDescription}>Решить 15 тактических{"\n"}задач</Text>
                                </View>
                                <View style={styles.tasksIconContainer}>
                                    {/* Puzzle Icon */}
                                    <Svg width={scale(28)} height={scale(28)} viewBox="0 0 24 24" fill="none">
                                        <Path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 0 1-.837.276c-.47-.07-.802-.48-.968-.925a2.501 2.501 0 1 0-3.214 3.214c.446.166.855.497.925.968a.979.979 0 0 1-.276.837l-1.61 1.611a2.404 2.404 0 0 1-1.705.707 2.402 2.402 0 0 1-1.704-.706l-1.568-1.568a1.026 1.026 0 0 0-.877-.29c-.493.074-.84.504-1.02.968a2.5 2.5 0 1 1-3.237-3.237c.464-.18.894-.527.967-1.02a1.026 1.026 0 0 0-.289-.877l-1.568-1.568A2.402 2.402 0 0 1 1.998 12c0-.617.236-1.234.706-1.704L4.315 8.685a.98.98 0 0 1 .837-.276c.47.07.802.48.968.925a2.501 2.501 0 1 0 3.214-3.214c-.446-.166-.855-.497-.925-.968a.979.979 0 0 1 .276-.837l1.61-1.611a2.404 2.404 0 0 1 1.705-.707c.617 0 1.234.236 1.704.706l1.568 1.568c.23.23.556.338.877.29.493-.074.84-.504 1.02-.968a2.5 2.5 0 1 1 3.237 3.237c-.464.18-.894.527-.967 1.02Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </Svg>
                                </View>
                            </View>
                        </View>
                    )}

                    {/* Add New Task Card - Lock for free users, Plus for premium */}
                    {/* Hide button if premium user has added the extra task */}
                    {(!isPremium || !showTasks) && (
                        <TouchableOpacity
                            style={styles.addTaskCard}
                            activeOpacity={0.8}
                            onPress={() => {
                                if (isPremium) {
                                    setShowTasks(true);
                                }
                                // Free users: button does nothing (locked)
                            }}
                        >
                            <Feather
                                name={isPremium ? "plus" : "lock"}
                                size={scale(32)}
                                color="#A0A0A0"
                            />
                        </TouchableOpacity>
                    )}
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

                {/* PAGE 4: Statistics */}
                <View key="4" style={styles.page}>
                    <ScrollView
                        style={styles.statsScroll}
                        contentContainerStyle={{ paddingBottom: scale(100) }}
                        showsVerticalScrollIndicator={false}
                    >
                        <Text style={styles.statsTitle}>Экранное время</Text>
                        <WeeklyBarChart
                            data={mockWeeklyData}
                        />

                        {/* First Button: -24% */}
                        <View style={styles.statCardBlue}>
                            <Text style={styles.statCardBigText}>-24%</Text>
                            <Text style={styles.statCardSmallText}>За последнюю неделю</Text>
                        </View>

                        {/* Second Button: Total Duration */}
                        <View style={styles.statCardDarkBlue}>
                            <Text style={styles.statCardBigText}>12:22:41</Text>
                            <Text style={styles.statCardSmallText}>Экранное время{'\n'}за неделю</Text>
                        </View>

                        {/* Pagination Component */}
                        <View style={styles.paginationContainer}>
                            <Svg width={scale(82)} height={scale(13)} viewBox="0 0 82 13" fill="none">
                                <Path fillRule="evenodd" clipRule="evenodd" d="M6.5 0H58.5C62.0899 0 65 2.91015 65 6.5C65 10.0899 62.0899 13 58.5 13H6.5C2.91015 13 0 10.0899 0 6.5C0 2.91015 2.91015 0 6.5 0Z" fill="#2E2E43" />
                                <Path fillRule="evenodd" clipRule="evenodd" d="M75.5 0H69V13H75.5C79.0899 13 82 10.0899 82 6.5C82 2.91015 79.0899 0 75.5 0Z" fill="#2E2E43" />
                            </Svg>
                        </View>
                    </ScrollView>
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
    cardShadowProp: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
        marginBottom: scale(24),
    },
    startSessionCard: {
        height: scale(150),
        borderRadius: scale(25),
        paddingHorizontal: scale(25),
        paddingTop: scale(26),
        overflow: 'hidden',
    },
    booksImage: {
        position: 'absolute',
        width: 213, // Using absolute pixels as requested, but scaled slightly for safety
        height: 188,
        right: scale(-20),
        bottom: scale(-30),
        transform: [{ rotate: '-5.4deg' }],
    },
    cardTitle: {
        fontFamily: 'Gramatika-Bold',
        fontSize: scale(24),
        lineHeight: scale(26),
        color: '#1E1E2E',
        zIndex: 1,
    },
    dailyGoalButton: {
        height: scale(74),
        borderRadius: scale(50),
        paddingHorizontal: scale(25),
        justifyContent: 'center',
        overflow: 'hidden',
    },
    targetImage: {
        position: 'absolute',
        width: scale(180),
        height: scale(180),
        right: scale(-40),
        top: scale(-53),
    },
    bottomCardsRow: {
        flexDirection: 'row',
        gap: scale(16),
        alignItems: 'flex-start',
    },
    aiCoachCard: {
        height: scale(155),
        borderRadius: scale(25),
        paddingHorizontal: scale(17),
        paddingVertical: scale(19),
        overflow: 'hidden',
    },
    lightbulbImage: {
        position: 'absolute',
        width: scale(199),
        height: scale(199),
        right: scale(-70),
        bottom: scale(-60),
    },
    screenTimeCard: {
        height: scale(155),
        borderRadius: scale(25),
        paddingHorizontal: scale(17),
        paddingVertical: scale(19),
        overflow: 'hidden',
    },
    chartImage: {
        position: 'absolute',
        width: scale(162),
        height: scale(162),
        right: scale(-40),
        bottom: scale(-40),
    },
    smallCardTitle: {
        fontFamily: 'Gramatika-Bold',
        fontSize: scale(20), // Slightly smaller to fit with images
        lineHeight: scale(24),
        color: '#1E1E2E',
    },
    // ============== STATISTICS PAGE STYLES ==============
    statsScroll: {
        flex: 1,
        paddingHorizontal: scale(20),
        paddingTop: 0, // content moved up
    },
    statsTitle: {
        fontFamily: 'Gramatika-Bold',
        fontSize: scale(32),
        lineHeight: scale(34),
        color: '#000',
        marginBottom: scale(20),
        marginTop: scale(0), // Removed negative margin to fix clipping
    },
    paginationContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: scale(0), // Moved higher (closer to cards)
    },
    statCardBlue: {
        // display: flex; (React Native implies flex)
        paddingTop: scale(16.5),
        paddingRight: scale(111),
        paddingBottom: scale(16.5),
        paddingLeft: scale(20),
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'flex-start',
        gap: scale(0), // Reduced to bring text closer
        alignSelf: 'stretch',
        borderRadius: scale(25),
        backgroundColor: '#8CDEFF',
        marginTop: scale(31), // Space between chart and this card
        marginBottom: scale(10), // Reduced gap between buttons
        minHeight: scale(100),
    },
    statCardDarkBlue: {
        // display: flex;
        padding: scale(20), // Updated to 20px all around
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'flex-start', // Updated to flex-start
        alignSelf: 'stretch',
        borderRadius: scale(25),
        backgroundColor: '#78BAFF',
        marginBottom: scale(20),
        minHeight: scale(100),
        gap: scale(0), // Reduced to bring text closer
    },
    statCardBigText: {
        fontFamily: 'Gramatika-Bold',
        fontSize: scale(32),
        color: '#000', // Assuming black text based on light background
    },
    statCardSmallText: {
        fontFamily: 'Gramatika-Light',
        fontSize: scale(16),
        color: '#2E2E43', // Using standard text color
        lineHeight: scale(20),
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
    // ============== YOUR DAY PAGE STYLES (New Figma Design) ==============
    yourDayPage: {
        width: SCREEN_WIDTH,
        flex: 1,
        backgroundColor: '#EAF0F8',
        paddingHorizontal: scale(20),
    },
    yourDayTitle: {
        fontFamily: 'Gramatika-Bold',
        fontSize: scale(32),
        lineHeight: scale(34), // Increased to > fontSize (32)
        color: '#2E2E43',
        marginBottom: scale(80),
        paddingHorizontal: scale(0), // Adding padding directly to Text to prevent clipping
    },
    // Theory Card - Light Blue
    theoryCard: {
        height: scale(119),
        alignSelf: 'stretch',
        borderRadius: scale(25),
        backgroundColor: '#8CDEFF',
        paddingLeft: scale(28),
        paddingRight: scale(20),
        paddingVertical: scale(18),
        marginBottom: scale(10),
    },
    // Practice Card - Darker Blue
    practiceCard: {
        height: scale(100),
        alignSelf: 'stretch',
        borderRadius: scale(25),
        backgroundColor: '#78BAFF',
        paddingLeft: scale(28),
        paddingRight: scale(20),
        paddingVertical: scale(18),
        marginBottom: scale(10),
    },
    // Analysis Card - Pink
    analysisCard: {
        height: scale(101),
        alignSelf: 'stretch',
        borderRadius: scale(25),
        backgroundColor: '#F4C0FD',
        paddingLeft: scale(28),
        paddingRight: scale(20),
        paddingVertical: scale(18),
        marginBottom: scale(10),
    },
    analysisTitle: {
        fontFamily: 'Gramatika-Bold',
        fontSize: scale(24),
        lineHeight: scale(26),
        color: '#000',
        marginBottom: scale(6),
    },
    analysisDescription: {
        fontFamily: 'Geometria-Light',
        fontSize: scale(19),
        lineHeight: scale(22),
        color: '#000',
        alignSelf: 'stretch',
    },
    analysisIconContainer: {
        width: scale(40),
        height: scale(40),
        backgroundColor: '#08132A',
        borderRadius: scale(10),
        justifyContent: 'center',
        alignItems: 'center',
    },
    // Tasks Card - Bright Pink (Premium only)
    tasksCard: {
        height: scale(123),
        alignSelf: 'stretch',
        borderRadius: scale(25),
        backgroundColor: '#F9A9FD',
        paddingLeft: scale(28),
        paddingRight: scale(20),
        paddingVertical: scale(18),
        marginBottom: scale(10),
    },
    tasksTitle: {
        fontFamily: 'Gramatika-Bold',
        fontSize: scale(24),
        lineHeight: scale(26),
        color: '#000',
        marginBottom: scale(6),
    },
    tasksDescription: {
        fontFamily: 'Geometria-Light',
        fontSize: scale(20),
        lineHeight: scale(22),
        color: '#2E2E43',
        width: scale(322),
    },
    tasksIconContainer: {
        width: scale(40),
        height: scale(100),
        backgroundColor: '#08132A',
        borderRadius: scale(10),
        justifyContent: 'center',
        alignItems: 'center',
    },
    // Shared task card styles
    taskCardContent: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    taskCardTextContainer: {
        flex: 1,
    },
    taskCardTitle: {
        fontFamily: 'Gramatika-Bold',
        fontSize: scale(24),
        lineHeight: scale(26), // Increased to > fontSize (24)
        color: '#08132A',
        marginBottom: scale(6),
        paddingHorizontal: scale(0), // Adding padding directly to Text
    },
    taskCardDescription: {
        fontFamily: 'Geometria-Light',
        fontSize: scale(19),
        lineHeight: scale(23),
        color: '#08132A',
    },
    // Theory Icon Container - 42x42
    theoryIconContainer: {
        width: scale(42),
        height: scale(42),
        backgroundColor: '#08132A',
        borderRadius: scale(10),
        justifyContent: 'center',
        alignItems: 'center',
    },
    // Practice Icon Container - 40x40
    practiceIconContainer: {
        width: scale(40),
        height: scale(40),
        backgroundColor: '#08132A',
        borderRadius: scale(10),
        justifyContent: 'center',
        alignItems: 'center',
    },
    // Add Task Card - Standard size (matching goal design)
    addTaskCard: {
        alignSelf: 'stretch',
        borderRadius: scale(25),
        backgroundColor: '#D3DEEE',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: scale(25),
    },
    // Add Task Card - Small (after analysis card added)
    addTaskCardSmall: {
        alignSelf: 'stretch',
        borderRadius: scale(25),
        backgroundColor: '#D3DEEE',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: scale(25),
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
