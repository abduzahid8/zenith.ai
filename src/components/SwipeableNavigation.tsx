import React, { useState, useRef } from 'react';
import {
    View,
    StyleSheet,
    Dimensions,
    TouchableOpacity,
    ScrollView,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const FIGMA_WIDTH = 402;
const scale = (size: number) => (SCREEN_WIDTH / FIGMA_WIDTH) * size;

// Tab configuration
const TABS = [
    { key: 'home', icon: 'home', iconOutline: 'home-outline', type: 'ionicon' },
    { key: 'statistics', icon: 'bar-chart', iconOutline: 'bar-chart-outline', type: 'ionicon' },
    { key: 'ai-coach', icon: 'lightbulb', iconOutline: 'lightbulb-outline', type: 'material' },
    { key: 'weekly-plan', icon: 'calendar-text', iconOutline: 'calendar-text-outline', type: 'material' },
];

interface SwipeableNavigationProps {
    children: React.ReactNode[];
    initialIndex?: number;
}

export const SwipeableNavigation: React.FC<SwipeableNavigationProps> = ({
    children,
    initialIndex = 0,
}) => {
    const scrollViewRef = useRef<ScrollView>(null);
    const [activeTab, setActiveTab] = useState(initialIndex);

    const handleTabPress = (index: number) => {
        scrollViewRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
        setActiveTab(index);
    };

    const handleScroll = (event: any) => {
        const offsetX = event.nativeEvent.contentOffset.x;
        const newIndex = Math.round(offsetX / SCREEN_WIDTH);
        if (newIndex !== activeTab && newIndex >= 0 && newIndex < children.length) {
            setActiveTab(newIndex);
        }
    };

    const renderTabIcon = (tab: typeof TABS[0], index: number) => {
        const isActive = activeTab === index;
        const color = isActive ? '#000' : '#A3A3A3';
        const iconName = isActive ? tab.icon : tab.iconOutline;

        if (tab.type === 'ionicon') {
            return <Ionicons name={iconName as any} size={scale(28)} color={color} />;
        } else {
            return <MaterialCommunityIcons name={iconName as any} size={scale(28)} color={color} />;
        }
    };

    return (
        <View style={styles.container}>
            {/* Swipeable Content */}
            <ScrollView
                ref={scrollViewRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                style={styles.scrollView}
            >
                {children.map((child, index) => (
                    <View key={index} style={styles.page}>
                        {child}
                    </View>
                ))}
            </ScrollView>

            {/* Bottom Navigation */}
            <View style={styles.bottomNav}>
                {TABS.slice(0, children.length).map((tab, index) => (
                    <TouchableOpacity
                        key={tab.key}
                        style={styles.navItem}
                        onPress={() => handleTabPress(index)}
                    >
                        {renderTabIcon(tab, index)}
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    page: {
        width: SCREEN_WIDTH,
        flex: 1,
    },
    bottomNav: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        height: scale(60),
        marginHorizontal: scale(16),
        marginBottom: scale(16),
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
