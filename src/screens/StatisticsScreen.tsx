import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, StatusBar, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../theme';
import { scale } from '../constants';
import { useUserProfileStore } from '../store/userProfileStore';
import { MenuDrawer } from '../components/NavigationSidebar';
import { BottomNavigation } from '../components/BottomNavigation';
import { useDeviceScreenTimeStore } from '../store/deviceScreenTimeStore';
import StatisticsTab from './tabs/StatisticsTab';

const FireIcon = () => <Image source={require('../../icons/fire.png')} style={{ width: scale(24), height: scale(24) }} resizeMode="contain" />;

export const StatisticsScreen: React.FC = () => {
    const { streakDays } = useUserProfileStore();
    const { fetchWeeklyData, fetchTodayData } = useDeviceScreenTimeStore();
    const [menuVisible, setMenuVisible] = useState(false);

    useEffect(() => {
        fetchWeeklyData();
        fetchTodayData();
    }, []);

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

            <View style={styles.header}>
                <View style={styles.headerLeft} />
                <View style={styles.headerRight}>
                    <View style={styles.streakContainer}>
                        <Text style={styles.streakNumber}>{streakDays}</Text>
                        <FireIcon />
                    </View>
                    <TouchableOpacity
                        style={styles.menuButton}
                        onPress={() => setMenuVisible(true)}
                        activeOpacity={0.7}
                    >
                        <Image source={require('../../icons/menu.png')} style={{ width: scale(24), height: scale(24), tintColor: colors.text }} resizeMode="contain" />
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.content}>
                <StatisticsTab />
            </View>

            <BottomNavigation activeTab="statistics" />
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
    headerLeft: { flex: 1 },
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
        fontFamily: fonts.heading.bold,
        fontSize: scale(24),
        color: colors.text,
        lineHeight: scale(21),
    },
    menuButton: { padding: scale(4) },
    content: { flex: 1 },
});

export default StatisticsScreen;
