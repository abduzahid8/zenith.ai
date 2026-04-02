import React, { useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scale } from '../constants';
import { APP_TAB_ROUTES, getMainTabUrl, type AppTabKey } from '../config/navigation';
import { useAppTheme } from '../theme/useAppTheme';

export type TabKey = AppTabKey;

interface BottomNavigationProps {
    activeTab?: TabKey;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({ activeTab }) => {
    const router = useRouter();
    const { colors } = useAppTheme();
    const insets = useSafeAreaInsets();
    const styles = useMemo(() => createStyles(insets.bottom), [insets.bottom]);

    const handleTabPress = (key: AppTabKey) => {
        router.replace(getMainTabUrl(key) as any);
    };

    return (
        <View style={styles.container}>
            <BlurView intensity={60} tint={'light'} style={styles.glassBackground} />
            {APP_TAB_ROUTES.map((tab) => {
                const isActive = tab.key === activeTab;
                // Currently tab icons are images, so we manage opacity. If they were SVGs we would use iconColor.
                // const iconColor = isActive ? colors.text : colors.textLight;

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
                                opacity: isActive ? 1 : 0.5,
                                tintColor: undefined,
                            }}
                            resizeMode="contain"
                        />
                    </TouchableOpacity>
                );
            })}
        </View>
    );
};

const createStyles = (bottomInset: number) => StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: bottomInset + scale(8),
        alignSelf: 'center',
        width: 280,
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        height: 67,
        borderRadius: 47,
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
