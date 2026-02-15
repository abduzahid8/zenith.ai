import React, { useEffect, useState, useRef } from 'react';
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
import { colors, fonts } from '../theme';
import { scale } from '../constants';
import { useUserProfileStore, getGreeting } from '../store/userProfileStore';
import { MenuDrawer } from '../components/NavigationSidebar';
import { BottomNavigation } from '../components/BottomNavigation';
import { HomeScreenSkeleton } from '../components/UIStateComponents';
import { useDeviceScreenTimeStore } from '../store/deviceScreenTimeStore';
import HomeTab from './tabs/HomeTab';

const FireIcon = () => (
    <Image source={require('../../icons/fire.png')} style={{ width: scale(24), height: scale(24) }} resizeMode="contain" />
);

// Chess piece icon
const ChessIcon = () => (
    <View style={styles.chessIcon}>
        <Text style={{ fontSize: scale(22) }}>♞</Text>
    </View>
);

export const HomeScreen: React.FC = () => {
    const { streakDays } = useUserProfileStore();
    const { fetchTodayData, checkPermission, requestPermission } = useDeviceScreenTimeStore();
    const [menuVisible, setMenuVisible] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const fadeAnim = useRef(new Animated.Value(1)).current;
    const iconTranslateY = fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [50, 0] });

    useEffect(() => {
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
                    <ChessIcon />
                    <View style={styles.streakContainer}>
                        <Text style={styles.streakNumber}>{streakDays}</Text>
                        <FireIcon />
                    </View>
                    <TouchableOpacity style={styles.menuButton} onPress={() => setMenuVisible(true)} activeOpacity={0.7}>
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
    // Figma: font-size 24px, weight 700
    streakNumber: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(24),
        color: colors.text,
    },
    menuButton: {
        padding: scale(4),
    },
    content: {
        flex: 1,
        marginTop: scale(0),
    },
});

export default HomeScreen;
