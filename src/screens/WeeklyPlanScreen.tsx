import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, StatusBar, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fonts } from '../theme';
import { scale } from '../constants';
import { useUserProfileStore } from '../store/userProfileStore';
import { MenuDrawer } from '../components/NavigationSidebar';
import { BottomNavigation } from '../components/BottomNavigation';
import WeeklyPlanTab from './tabs/WeeklyPlanTab';
import { useAppTheme } from '../theme/useAppTheme';

const FireIcon = () => <Image source={require('../../icons/fire.png')} style={{ width: scale(24), height: scale(24) }} resizeMode="contain" />;

export const WeeklyPlanScreen: React.FC = () => {
    const [menuVisible, setMenuVisible] = useState(false);
    const { streakDays, subscriptionLevel } = useUserProfileStore();
    const isPremium = subscriptionLevel === 'premium' || subscriptionLevel === 'trial';

    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

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
                        onPress={() => {
                            console.log('[WeeklyPlanScreen] Menu button pressed - opening menu');
                            setMenuVisible(true);
                        }}
                        activeOpacity={0.7}
                    >
                        <Image source={require('../../icons/menu.png')} style={{ width: scale(24), height: scale(24), tintColor: colors.text }} resizeMode="contain" />
                    </TouchableOpacity>
                </View>
            </View>
            <View style={styles.content}>
                <WeeklyPlanTab isPremium={isPremium} />
            </View>
            <BottomNavigation activeTab="weekly-plan" />
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
    },
    menuButton: { padding: scale(4) },
    content: { flex: 1 },
});

export default WeeklyPlanScreen;
