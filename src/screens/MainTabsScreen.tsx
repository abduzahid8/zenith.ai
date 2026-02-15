import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    StatusBar,
    TouchableOpacity,
    Dimensions,
    Platform,
    UIManager,
    Animated,
    Easing,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

if (Platform.OS === 'android') {
    if (UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }
}

import { useRouter, useFocusEffect } from 'expo-router';
// import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons'; // Removing unused vector icons
import PagerView from 'react-native-pager-view';
import { colors, fonts } from '../theme';
import { MenuDrawer } from '../components/NavigationSidebar';
import { useAuthStore } from '../store/authStore';
import { useUserProfileStore, getGreeting } from '../store/userProfileStore';
import { useDeviceScreenTimeStore } from '../store/deviceScreenTimeStore';
import { requestScreenTimePermission } from 'device-activity';
import { scale, SCREEN_WIDTH, TABS } from '../constants';

// Tab components
import HomeTab from './tabs/HomeTab';
import WeeklyPlanTab from './tabs/WeeklyPlanTab';
import AICoachTab from './tabs/AICoachTab';
import StatisticsTab from './tabs/StatisticsTab';

const FireIcon = () => <Image source={require('../../icons/fire.png')} style={{ width: scale(24), height: scale(24) }} resizeMode="contain" />;
const ChessIcon = () => (
    <View style={styles.chessIcon}>
        <Text style={{ fontSize: scale(22) }}>♞</Text>
    </View>
);

export const MainTabsScreen: React.FC<{ initialTab?: number }> = ({ initialTab = 0 }) => {
    const router = useRouter();
    const pagerRef = useRef<PagerView>(null);
    const [activeTab, setActiveTab] = useState(initialTab);

    useEffect(() => {
        setActiveTab(initialTab);
        pagerRef.current?.setPage(initialTab);
    }, [initialTab]);

    const { user } = useAuthStore();
    const { streakDays, subscriptionLevel } = useUserProfileStore();
    const isPremium = subscriptionLevel === 'premium' || subscriptionLevel === 'trial';


    const {
        checkPermission,
        requestPermission: storeRequestPermission,
        fetchWeeklyData,
        fetchTodayData,
    } = useDeviceScreenTimeStore();

    const [menuVisible, setMenuVisible] = useState(false);

    // Fetch data on mount
    useEffect(() => {
        fetchTodayData();
        fetchWeeklyData();
    }, []);

    // Permissions
    useEffect(() => {
        const initPermissions = async () => {
            if (Platform.OS === 'ios') {
                const hasPermission = await checkPermission();
                if (!hasPermission) {
                    await storeRequestPermission();
                }
            }
        };
        initPermissions();
    }, []);

    // Home tab animation
    const fadeAnim = useRef(new Animated.Value(0)).current;

    const playAnimation = useCallback(() => {
        fadeAnim.setValue(0);
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
            easing: Easing.out(Easing.cubic),
        }).start();
    }, [fadeAnim]);

    useEffect(() => {
        if (activeTab === 0) playAnimation();
    }, [activeTab, playAnimation]);

    useFocusEffect(
        useCallback(() => {
            if (activeTab === 0) playAnimation();
        }, [activeTab, playAnimation])
    );

    const iconTranslateY = fadeAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [50, 0],
    });

    const greeting = getGreeting();

    const handleTabPress = (index: number) => {
        pagerRef.current?.setPage(index);
        setActiveTab(index);
    };

    const handlePageSelected = (event: { nativeEvent: { position: number } }) => {
        const newIndex = event.nativeEvent.position;
        if (newIndex !== activeTab) {
            setActiveTab(newIndex);
        }
    };

    const renderTabIcon = (tab: (typeof TABS)[number], index: number) => {
        const isActive = activeTab === index;
        return (
            <Image
                source={tab.image}
                style={{
                    width: scale(28),
                    height: scale(28),
                    opacity: isActive ? 1 : 0.5
                }}
                resizeMode="contain"
            />
        );
    };

    const getHeaderTitle = () => {
        switch (activeTab) {
            case 0: return greeting;
            default: return '';
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

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
                        <Image source={require('../../icons/menu.png')} style={{ width: scale(24), height: scale(24), tintColor: colors.text }} resizeMode="contain" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Swipeable Pages */}
            <PagerView
                ref={pagerRef}
                style={styles.pagerView}
                initialPage={initialTab}
                onPageSelected={handlePageSelected}
            >
                <View key="1" style={styles.page}>
                    <HomeTab
                        fadeAnim={fadeAnim}
                        iconTranslateY={iconTranslateY}
                        onDailyGoal={() => handleTabPress(1)}
                        onAICoach={() => handleTabPress(2)}
                        onScreenTime={() => handleTabPress(3)}
                    />
                </View>

                <View key="2" style={styles.page}>
                    <WeeklyPlanTab isPremium={isPremium} />
                </View>

                <View key="3" style={styles.page}>
                    <AICoachTab />
                </View>

                <View key="4" style={styles.page}>
                    <StatisticsTab />
                </View>
            </PagerView>

            {/* Bottom Navigation */}
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
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: scale(24),
        paddingTop: scale(16),
        paddingBottom: scale(16),
    },
    greetingText: {
        fontFamily: fonts.heading.bold,
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
    streakNumber: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(24),
        color: colors.text,
    },
    menuButton: {
        padding: scale(4),
    },
    pagerView: {
        flex: 1,
    },
    page: {
        width: SCREEN_WIDTH,
        flex: 1,
    },
    bottomNav: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        height: scale(60),
        marginHorizontal: scale(16),
        marginBottom: scale(16),
        borderRadius: scale(47),
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        shadowColor: colors.text,
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
