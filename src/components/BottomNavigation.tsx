import React from 'react';
import { View, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { scale } from '../constants';
import { colors } from '../theme';
import { APP_TAB_ROUTES, getMainTabUrl, type AppTabKey } from '../config/navigation';

export type TabKey = AppTabKey;

interface BottomNavigationProps {
    activeTab?: TabKey;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({ activeTab }) => {
    const router = useRouter();

    const handleTabPress = (key: AppTabKey) => {
        router.replace(getMainTabUrl(key) as any);
    };

    return (
        <View style={styles.container}>
            <BlurView intensity={60} tint="light" style={styles.glassBackground} />
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
                        <Image
                            source={tab.image}
                            style={{
                                width: scale(28),
                                height: scale(28),
                                opacity: isActive ? 1 : 0.5
                            }}
                            resizeMode="contain"
                        />
                    </TouchableOpacity>
                );
            })}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: scale(34),
        alignSelf: 'center',
        width: 280,
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        height: 67,
        borderRadius: 47,
        // Precise Figma Drop Shadow (0 2px 4px rgba(0,0,0,0.25))
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 10,
    },
    glassBackground: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255, 255, 255, 0.45)',
        borderRadius: 47,
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.8)',
        borderBottomColor: 'rgba(255, 255, 255, 0.3)',
        borderRightColor: 'rgba(255, 255, 255, 0.3)',
        overflow: 'hidden',
    },
    navItem: {
        padding: scale(12),
    },
});

export default BottomNavigation;
