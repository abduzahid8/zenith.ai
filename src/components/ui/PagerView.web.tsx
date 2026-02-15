import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { ScrollView, View, StyleSheet, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';

export type PagerViewProps = {
    initialPage?: number;
    onPageScroll?: (event: any) => void;
    onPageSelected?: (event: any) => void;
    style?: any;
    children: React.ReactNode;
    scrollEnabled?: boolean;
};

const PagerView = forwardRef<any, PagerViewProps>(({
    initialPage = 0,
    onPageScroll,
    onPageSelected,
    style,
    children,
    scrollEnabled = true
}, ref) => {
    const scrollViewRef = useRef<ScrollView>(null);
    const [layoutWidth, setLayoutWidth] = React.useState(0);

    useImperativeHandle(ref, () => ({
        setPage: (index: number) => {
            if (scrollViewRef.current && layoutWidth > 0) {
                scrollViewRef.current.scrollTo({ x: index * layoutWidth, animated: true });
                if (onPageSelected) {
                    onPageSelected({ nativeEvent: { position: index } });
                }
            }
        },
        setPageWithoutAnimation: (index: number) => {
            if (scrollViewRef.current && layoutWidth > 0) {
                scrollViewRef.current.scrollTo({ x: index * layoutWidth, animated: false });
                if (onPageSelected) {
                    onPageSelected({ nativeEvent: { position: index } });
                }
            }
        }
    }));

    const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        if (onPageScroll) {
            const { contentOffset, layoutMeasurement } = event.nativeEvent;
            const width = layoutMeasurement.width;
            if (width > 0) {
                const position = Math.floor(contentOffset.x / width);
                const offset = (contentOffset.x % width) / width;
                onPageScroll({
                    nativeEvent: {
                        position,
                        offset,
                    },
                });
            }
        }
    };

    const handleMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        if (onPageSelected) {
            const { contentOffset, layoutMeasurement } = event.nativeEvent;
            const width = layoutMeasurement.width;
            if (width > 0) {
                const position = Math.round(contentOffset.x / width);
                onPageSelected({ nativeEvent: { position } });
            }
        }
    }

    return (
        <ScrollView
            ref={scrollViewRef}
            style={style}
            horizontal
            pagingEnabled
            scrollEnabled={scrollEnabled}
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            onMomentumScrollEnd={handleMomentumScrollEnd}
            scrollEventThrottle={16}
            onLayout={(e) => setLayoutWidth(e.nativeEvent.layout.width)}
        >
            {React.Children.map(children, (child) => (
                <View style={{ width: layoutWidth, height: '100%' }}>
                    {child}
                </View>
            ))}
        </ScrollView>
    );
});

export default PagerView;
