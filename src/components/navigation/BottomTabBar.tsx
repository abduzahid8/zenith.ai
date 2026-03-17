import React, { useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet, Image, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { scale, SCREEN_WIDTH } from '../../constants';
import { useAppTheme } from '../../theme/useAppTheme';

interface BottomTabBarProps {
    activeTab: number;
    onTabPress: (index: number) => void;
}

export const BottomTabBar: React.FC<BottomTabBarProps> = ({ activeTab, onTabPress }) => {
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(), []);

    const activeIconTint = '#262A44';
    const inactiveIconTint = '#C7CCE1';
    const activeDotColor = '#262A44';

    return (
        <View style={styles.container}>
            <BlurView intensity={60} tint={'light'} style={styles.glassBackground} />

            {/* Tab 1: Home */}
            <TouchableOpacity
                style={styles.tabItem}
                onPress={() => onTabPress(0)}
                activeOpacity={0.7}
            >
                <Image
                    source={require('../../../icons/home.png')}
                    style={[
                        {
                            height: activeTab === 0 ? scale(31) : scale(31),
                            width: activeTab === 0 ? scale(24) : undefined,
                            aspectRatio: 1,
                            tintColor: activeTab === 0 ? activeIconTint : inactiveIconTint,
                            transform: activeTab === 0 ? [{ translateY: -scale(1) }] : [],
                        }
                    ]}
                    resizeMode="contain"
                />
                {activeTab === 0 && <View style={[styles.activeDot, { backgroundColor: activeDotColor }]} />}
            </TouchableOpacity>

            {/* Tab 2: Weekly Plan */}
            <TouchableOpacity
                style={styles.tabItem}
                onPress={() => onTabPress(1)}
                activeOpacity={0.7}
            >
                <Image
                    source={require('../../../icons/tasks.png')}
                    style={[
                        {
                            height: activeTab === 1 ? scale(31) : scale(31),
                            width: activeTab === 1 ? scale(24) : undefined,
                            aspectRatio: 1,
                            tintColor: activeTab === 1 ? activeIconTint : inactiveIconTint,
                            transform: activeTab === 1 ? [{ translateY: -scale(2) }] : [],
                        }
                    ]}
                    resizeMode="contain"
                />
                {activeTab === 1 && <View style={[styles.activeDot, { backgroundColor: activeDotColor }]} />}
            </TouchableOpacity>

            {/* Tab 3: AI Coach */}
            <TouchableOpacity
                style={styles.tabItem}
                onPress={() => onTabPress(2)}
                activeOpacity={0.7}
            >
                <Image
                    source={require('../../../icons/assistant.png')}
                    style={[
                        {
                            height: activeTab === 2 ? scale(31) : scale(31),
                            width: activeTab === 2 ? scale(24) : undefined,
                            aspectRatio: 1,
                            tintColor: activeTab === 2 ? activeIconTint : inactiveIconTint,
                            transform: activeTab === 2 ? [{ translateY: -scale(2) }] : [],
                        }
                    ]}
                    resizeMode="contain"
                />
                {activeTab === 2 && <View style={[styles.activeDot, { backgroundColor: activeDotColor }]} />}
            </TouchableOpacity>


        </View>
    );
};

const createStyles = () => StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: scale(34),
        alignSelf: 'center',
        width: 280,
        height: 67,
        borderRadius: 47,
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingHorizontal: scale(10),
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 5,
        elevation: 3,
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
    tabItem: {
        width: 50,
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    activeDot: {
        position: 'absolute',
        bottom: scale(12),
        width: scale(30),
        height: scale(5),
        borderRadius: scale(20),
    }
});

export default BottomTabBar;
