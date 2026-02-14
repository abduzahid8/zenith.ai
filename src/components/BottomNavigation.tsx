import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { scale } from '../constants';
import { colors } from '../theme';
import { APP_TAB_ROUTES, getMainTabUrl, type AppTabKey } from '../config/navigation';

export type TabKey = AppTabKey;

interface BottomNavigationProps {
    activeTab: TabKey;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({ activeTab }) => {
    const router = useRouter();

    const handleTabPress = (key: AppTabKey) => {
        router.replace(getMainTabUrl(key) as any);
    };

    return (
        <View style={styles.bottomNav}>
            {APP_TAB_ROUTES.map((tab) => {
                const isActive = tab.key === activeTab;
                const iconColor = isActive ? colors.text : colors.textLight;
                const iconName = isActive ? tab.icon : tab.iconOutline;

                return (
                    <TouchableOpacity
                        key={tab.key}
                        style={styles.navItem}
                        onPress={() => handleTabPress(tab.key)}
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

export default BottomNavigation;
