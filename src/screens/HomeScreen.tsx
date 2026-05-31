import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    StatusBar,
    TouchableOpacity,
    Platform,
    Animated,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { scale } from '../constants';
import { fonts } from '../theme';
import { useUserProfileStore, getGreeting } from '../store/userProfileStore';
import { MenuDrawer } from '../components/NavigationSidebar';
import { BottomNavigation } from '../components/BottomNavigation';
import { HomeScreenSkeleton } from '../components/UIStateComponents';
import HomeTab from './tabs/HomeTab';
import { HobbyIcon } from '../components/HobbyIcon';
import { useAppTheme } from '../theme/useAppTheme';

const FireIcon = () => (
    <Image source={require('../../icons/fire.png')} style={{ width: scale(24), height: scale(24), marginTop: -scale(2) }} resizeMode="contain" />
);

export const HomeScreen: React.FC = () => {
    const { streakDays } = useUserProfileStore();
    const [menuVisible, setMenuVisible] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const fadeAnim = useRef(new Animated.Value(1)).current;
    const iconTranslateY = fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [50, 0] });

    const greeting = getGreeting();

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

            <View style={styles.header}>
                <Text style={styles.greetingText}>{greeting}</Text>
                <View style={styles.headerRight}>
                    <HobbyIcon />
                    <View style={styles.streakContainer}>
                        <Text style={styles.streakNumber}>{streakDays}</Text>
                        <FireIcon />
                    </View>
                    {/* 🛠 DEBUG: временная кнопка для тестирования геймификации (скрыта)
                    <TouchableOpacity
                        style={styles.debugButton}
                        onPress={() => router.push('/gamification-debug')}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.debugButtonText}>🛠</Text>
                    </TouchableOpacity>
                    */}
                    <TouchableOpacity style={styles.menuButton} onPress={() => {
                        console.log('[HomeScreen] Menu button pressed - opening menu');
                        setMenuVisible(true);
                    }} activeOpacity={0.7}>
                        <Image source={require('../../icons/menu.png')} style={{ width: scale(24), height: scale(24), tintColor: colors.text }} resizeMode="contain" />
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.content}>
                <HomeTab fadeAnim={fadeAnim} iconTranslateY={iconTranslateY} />
            </View>

            <BottomNavigation activeTab="home" />
            <MenuDrawer visible={menuVisible} onClose={() => setMenuVisible(false)} />
        </SafeAreaView>
    );
};

const createStyles = (colors: any) => StyleSheet.create({
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
    // 🛠 DEBUG кнопка
    debugButton: {
        backgroundColor: '#FF6B35',
        width: scale(32),
        height: scale(32),
        borderRadius: scale(16),
        alignItems: 'center',
        justifyContent: 'center',
    },
    debugButtonText: {
        fontSize: scale(16),
    },
    content: {
        flex: 1,
        marginTop: scale(0),
    },
});

export default HomeScreen;
