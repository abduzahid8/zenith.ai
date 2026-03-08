import React, { useState, useRef } from 'react';
import {
    View,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Image,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { scale, SCREEN_WIDTH } from '../constants';
import { colors } from '../theme';
import { APP_TAB_ROUTES } from '../config/navigation';

const TABS = APP_TAB_ROUTES;

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

    const handleScroll = (event: { nativeEvent: { contentOffset: { x: number } } }) => {
        const offsetX = event.nativeEvent.contentOffset.x;
        const newIndex = Math.round(offsetX / SCREEN_WIDTH);
        if (newIndex !== activeTab && newIndex >= 0 && newIndex < children.length) {
            setActiveTab(newIndex);
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
            <View style={styles.bottomNavContainer}>
                <BlurView intensity={100} tint="light" style={styles.glassBackground} />
                {TABS.slice(0, children.length).map((tab, index) => (
                    <TouchableOpacity
                        key={tab.key}
                        style={styles.navItem}
                        onPress={() => handleTabPress(index)}
                    >
                        <Image
                            source={tab.image}
                            style={{
                                width: scale(28),
                                height: scale(28),
                                opacity: activeTab === index ? 1 : 0.5
                            }}
                            resizeMode="contain"
                        />
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
    bottomNavContainer: {
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
