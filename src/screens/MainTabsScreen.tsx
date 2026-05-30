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
import useTaskStore from '../store/taskStore';
import { scale, SCREEN_WIDTH } from '../constants';
import { BottomTabBar } from '../components/navigation/BottomTabBar';
import { HobbyIcon } from '../components/HobbyIcon';
import { useAppTheme } from '../theme/useAppTheme';

// Tab components
import HomeTab from './tabs/HomeTab';
import WeeklyPlanTab from './tabs/WeeklyPlanTab';
import AICoachTab from './tabs/AICoachTab';
import ScreenTimeTab from './tabs/ScreenTimeTab';

const FireIcon = () => <Image source={require('../../icons/fire.png')} style={{ width: scale(24), height: scale(24), marginTop: -scale(2) }} resizeMode="contain" />;

export const MainTabsScreen: React.FC<{ initialTab?: number }> = ({ initialTab = 0 }) => {
    const router = useRouter();
    const pagerRef = useRef<typeof PagerView>(null);
    const [activeTab, setActiveTab] = useState(initialTab);

    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    useEffect(() => {
        setActiveTab(initialTab);
        pagerRef.current?.setPage(initialTab);
    }, [initialTab]);

    useEffect(() => {
        const forceReset = async () => {
            const AsyncStorage = require('@react-native-async-storage/async-storage').default;
            const hasForced = await AsyncStorage.getItem('force_reset_v5');
            if (!hasForced) {
                console.log('[MainTabsScreen] Forcing gamification reset to Day 1...');
                const { useGamificationStore } = require('../store/gamificationStore');
                useGamificationStore.getState().resetGamification();
                await AsyncStorage.setItem('force_reset_v5', 'true');
            }
        };
        forceReset();
    }, []);

    const { subscriptionLevel } = useUserProfileStore();
    const dailyTasks = useTaskStore(state => state.dailyTasks);
    const completedTasksCount = dailyTasks.filter(t => t.status === 'completed').length;
    const isPremium = subscriptionLevel === 'premium' || subscriptionLevel === 'trial';


    const [menuVisible, setMenuVisible] = useState(false);

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
        console.log('[MainTabsScreen] handleTabPress - tab index:', index);
        pagerRef.current?.setPage(index);
        setActiveTab(index);
    };

    const handlePageSelected = (event: { nativeEvent: { position: number } }) => {
        const newIndex = event.nativeEvent.position;
        console.log('[MainTabsScreen] handlePageSelected - new page index:', newIndex);
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
                        <Text style={styles.streakNumber}>{completedTasksCount}</Text>
                        <FireIcon />
                    </View>
                    {/* Временная кнопка дебага геймификации */}
                    <TouchableOpacity 
                        style={{
                            backgroundColor: '#FF5722',
                            padding: scale(6),
                            borderRadius: scale(8),
                            marginRight: scale(4)
                        }} 
                        onPress={() => {
                            console.log('Navigating to gamification debug');
                            router.push('/gamification-debug');
                        }}
                        activeOpacity={0.7}
                    >
                        <Text style={{ color: '#FFF', fontSize: scale(14), fontWeight: 'bold' }}>🛠</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.menuButton} onPress={() => {
                        console.log('[MainTabsScreen] Menu button pressed - opening menu');
                        setMenuVisible(true);
                    }} activeOpacity={0.7}>
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
                    />
                </View>

                <View key="2" style={styles.page}>
                    <WeeklyPlanTab isPremium={isPremium} />
                </View>

                <View key="3" style={styles.page}>
                    <AICoachTab />
                </View>

                <View key="4" style={styles.page}>
                    <ScreenTimeTab />
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
