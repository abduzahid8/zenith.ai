import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    StatusBar,
    TouchableOpacity,
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
import PagerView from '../components/ui/PagerView';
import { fonts } from '../theme';
import { MenuDrawer } from '../components/NavigationSidebar';
import { useUserProfileStore, getGreeting } from '../store/userProfileStore';
import { useDeviceScreenTimeStore } from '../store/deviceScreenTimeStore';
import { scale, SCREEN_WIDTH } from '../constants';
import { BottomTabBar } from '../components/navigation/BottomTabBar';
import { HobbyIcon } from '../components/HobbyIcon';
import { useAppTheme } from '../theme/useAppTheme';

// Tab components
import HomeTab from './tabs/HomeTab';
import WeeklyPlanTab from './tabs/WeeklyPlanTab';
import AICoachTab from './tabs/AICoachTab';

const FireIcon = () => <Image source={require('../../icons/fire.png')} style={{ width: scale(24), height: scale(24), marginTop: -scale(2) }} resizeMode="contain" />;

export const MainTabsScreen: React.FC<{ initialTab?: number }> = ({ initialTab = 0 }) => {
    const router = useRouter();
    const pagerRef = useRef<PagerView>(null);
    const [activeTab, setActiveTab] = useState(initialTab);

    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    useEffect(() => {
        setActiveTab(initialTab);
        pagerRef.current?.setPage(initialTab);
    }, [initialTab]);

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
                    <HobbyIcon />
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
                        onScreenTime={() => router.push('/(app)/screen-time')}
                    />
                </View>

                <View key="2" style={styles.page}>
                    <WeeklyPlanTab isPremium={isPremium} />
                </View>

                <View key="3" style={styles.page}>
                    <AICoachTab />
                </View>
            </PagerView>

            {/* Bottom Navigation */}
            <BottomTabBar activeTab={activeTab} onTabPress={handleTabPress} />

            <MenuDrawer visible={menuVisible} onClose={() => setMenuVisible(false)} />
        </SafeAreaView>
    );
};

const createStyles = (colors: any) => StyleSheet.create({
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
        gap: scale(16),
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

});

export default MainTabsScreen;
