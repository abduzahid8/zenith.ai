import React from 'react';
import { View, TouchableOpacity, StyleSheet, Image, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { scale, SCREEN_WIDTH } from '../../constants';
import { colors } from '../../theme';

interface BottomTabBarProps {
    activeTab: number;
    onTabPress: (index: number) => void;
}

export const BottomTabBar: React.FC<BottomTabBarProps> = ({ activeTab, onTabPress }) => {
    return (
        <View style={styles.container}>
            <BlurView intensity={60} tint="light" style={styles.glassBackground} />

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
                            tintColor: activeTab === 0 ? '#262A44' : '#C7CCE1',
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
                            tintColor: activeTab === 1 ? '#262A44' : '#C7CCE1',
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
                            tintColor: activeTab === 2 ? '#262A44' : '#C7CCE1',
                            transform: activeTab === 2 ? [{ translateY: -scale(2) }] : [],
                        }
                    ]}
                    resizeMode="contain"
                />
                {activeTab === 2 && <View style={styles.activeDot} />}
            </TouchableOpacity>


        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: scale(34),
        alignSelf: 'center',
        width: 280, // Reduced from 362 since we removed a tab
        height: 67, // From Figma
        borderRadius: 47, // From Figma
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingHorizontal: scale(10),
        // Precise Figma Drop Shadow (0 2px 4px rgba(0,0,0,0.25))
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
