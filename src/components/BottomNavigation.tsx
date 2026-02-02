import React from 'react';
import { View, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const FIGMA_WIDTH = 402;
const scale = (size: number) => (SCREEN_WIDTH / FIGMA_WIDTH) * size;

export type TabKey = 'home' | 'statistics' | 'ai-coach' | 'weekly-plan';

interface BottomNavigationProps {
    activeTab: TabKey;
}

/**
 * Shared bottom navigation component used across multiple screens.
 * Provides consistent styling and navigation behavior.
 */
export const BottomNavigation: React.FC<BottomNavigationProps> = ({ activeTab }) => {
    const router = useRouter();

    const tabs: { key: TabKey; route: string; icon: string; iconActive: string; type: 'ionicon' | 'material' }[] = [
        { key: 'home', route: '/home', icon: 'home-outline', iconActive: 'home', type: 'ionicon' },
        { key: 'statistics', route: '/statistics', icon: 'bar-chart-outline', iconActive: 'bar-chart', type: 'ionicon' },
        { key: 'ai-coach', route: '/ai-coach-chat', icon: 'lightbulb-outline', iconActive: 'lightbulb', type: 'material' },
        { key: 'weekly-plan', route: '/weekly-plan', icon: 'clipboard-text-outline', iconActive: 'clipboard-text', type: 'material' },
    ];

    const handleTabPress = (tab: typeof tabs[number]) => {
        if (tab.key !== activeTab) {
            // Navigate to main-tabs which has PagerView with smooth animation
            // All main screens should use the same MainTabsScreen for consistent UX
            router.replace('/main-tabs');
        }
    };

    return (
        <View style={styles.bottomNav}>
            {tabs.map((tab) => {
                const isActive = tab.key === activeTab;
                const iconColor = isActive ? '#000' : '#A3A3A3';
                const iconName = isActive ? tab.iconActive : tab.icon;

                return (
                    <TouchableOpacity
                        key={tab.key}
                        style={styles.navItem}
                        onPress={() => handleTabPress(tab)}
                    >
                        {tab.type === 'ionicon' ? (
                            <Ionicons
                                name={iconName as any}
                                size={scale(28)}
                                color={iconColor}
                            />
                        ) : (
                            <MaterialCommunityIcons
                                name={iconName as any}
                                size={scale(28)}
                                color={iconColor}
                            />
                        )}
                    </TouchableOpacity>
                );
            })}
        </View>
    );
};

const styles = StyleSheet.create({
    bottomNav: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        height: scale(60),
        marginHorizontal: scale(16),
        marginBottom: scale(16),
        marginTop: 'auto',
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

export default BottomNavigation;
