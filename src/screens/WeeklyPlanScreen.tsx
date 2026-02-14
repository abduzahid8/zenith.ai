import React, { useState } from 'react';
import { View, Text, StyleSheet, StatusBar, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors } from '../theme';
import { scale } from '../constants';
import { useUserProfileStore } from '../store/userProfileStore';
import { MenuDrawer } from '../components/NavigationSidebar';
import { BottomNavigation } from '../components/BottomNavigation';
import WeeklyPlanTab from './tabs/WeeklyPlanTab';

const FireIcon = () => <Text style={{ fontSize: scale(24) }}>🔥</Text>;

export const WeeklyPlanScreen: React.FC = () => {
    const [menuVisible, setMenuVisible] = useState(false);
    const { streakDays, subscriptionLevel } = useUserProfileStore();
    const isPremium = subscriptionLevel === 'premium' || subscriptionLevel === 'trial';

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
                        <Feather name="menu" size={scale(24)} color={colors.text} />
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
        fontFamily: 'Gramatika-Bold',
        fontSize: scale(24),
        color: colors.text,
    },
    menuButton: { padding: scale(4) },
    content: { flex: 1 },
});

export default WeeklyPlanScreen;
