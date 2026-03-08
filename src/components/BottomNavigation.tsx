import React from 'react';
import { View, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
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
        <View style={styles.container}>
            <BlurView intensity={100} tint="light" style={styles.glassBackground} />
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
        width: 362,
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        height: 67,
        borderRadius: 47,
        // Precise Figma Drop Shadow (0 2px 4px rgba(0,0,0,0.25))
        shadowColor: 'rgba(0, 0, 0, 0.25)',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 4,
        elevation: 4,
    },
    glassBackground: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255, 255, 255, 0.1)', // CSS #FFFFFF at 10% opacity from Figma
        borderRadius: 47,
        borderWidth: StyleSheet.hairlineWidth, // Tahoe crisp thin edge
        borderColor: 'rgba(255, 255, 255, 0.4)', // Slightly pronounced edge for glass refractions
        overflow: 'hidden',
    },
    navItem: {
        padding: scale(12),
    },
});

export default BottomNavigation;
