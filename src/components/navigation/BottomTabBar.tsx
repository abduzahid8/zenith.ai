import React from 'react';
import { View, TouchableOpacity, StyleSheet, Image, Platform } from 'react-native';
import { scale, SCREEN_WIDTH } from '../../constants';
import { colors } from '../../theme';

interface BottomTabBarProps {
    activeTab: number;
    onTabPress: (index: number) => void;
}

export const BottomTabBar: React.FC<BottomTabBarProps> = ({ activeTab, onTabPress }) => {
    return (
        <View style={styles.container}>
            <View style={styles.glassBackground} />

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
                            tintColor: activeTab === 0 ? colors.black : colors.iconMuted,
                            transform: activeTab === 0 ? [{ translateY: -scale(2) }] : [],
                        }
                    ]}
                    resizeMode="contain"
                />
                {activeTab === 0 && <View style={styles.activeDot} />}
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
                            tintColor: activeTab === 1 ? colors.black : colors.iconMuted,
                            transform: activeTab === 1 ? [{ translateY: -scale(2) }] : [],
                        }
                    ]}
                    resizeMode="contain"
                />
                {activeTab === 1 && <View style={styles.activeDot} />}
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
                            tintColor: activeTab === 2 ? colors.black : colors.iconMuted,
                            transform: activeTab === 2 ? [{ translateY: -scale(2) }] : [],
                        }
                    ]}
                    resizeMode="contain"
                />
                {activeTab === 2 && <View style={styles.activeDot} />}
            </TouchableOpacity>

            {/* Tab 4: Statistics */}
            <TouchableOpacity
                style={styles.tabItem}
                onPress={() => onTabPress(3)}
                activeOpacity={0.7}
            >
                <Image
                    source={require('../../../icons/stats.png')}
                    style={[
                        {
                            height: activeTab === 3 ? scale(31) : scale(31),
                            width: activeTab === 3 ? scale(24) : undefined,
                            aspectRatio: 1,
                            tintColor: activeTab === 3 ? colors.black : colors.iconMuted,
                            transform: activeTab === 3 ? [{ translateY: -scale(2) }] : [],
                        }
                    ]}
                    resizeMode="contain"
                />
                {activeTab === 3 && <View style={styles.activeDot} />}
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: scale(34),
        alignSelf: 'center',
        width: scale(362),
        height: scale(67),
        borderRadius: scale(47),
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingHorizontal: scale(10),
        // Shadow for depth
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5,
    },
    glassBackground: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255, 255, 255, 0.85)', // High opacity white for milk-glass look
        borderRadius: scale(47),
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.9)', // Frosty border
    },
    tabItem: {
        width: 50,
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    icon: {
        width: 24, // Fallback, will be overridden
        height: 24, // Fallback, will be overridden
        resizeMode: 'contain',
    },
    activeDot: {
        position: 'absolute',
        bottom: scale(12),
        width: scale(30),
        height: scale(5),
        borderRadius: scale(20),
        backgroundColor: '#262A44',
    }
});
