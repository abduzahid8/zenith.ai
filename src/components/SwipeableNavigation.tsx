import React, { useState, useRef } from 'react';
import {
    View,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Image,
} from 'react-native';
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
            <View style={styles.bottomNav}>
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
