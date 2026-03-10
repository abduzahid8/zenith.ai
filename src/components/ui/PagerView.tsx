import { Platform, ScrollView, View, StyleSheet } from 'react-native';
import React, { forwardRef, useImperativeHandle, useRef } from 'react';

let NativePagerView: any = null;
if (Platform.OS !== 'web') {
    NativePagerView = require('react-native-pager-view').default;
}

export type PagerViewProps = {
    style?: any;
    initialPage?: number;
    scrollEnabled?: boolean;
    onPageSelected?: (e: { nativeEvent: { position: number } }) => void;
    children?: React.ReactNode;
    [key: string]: any;
};

const WebPagerView = forwardRef<any, PagerViewProps>(({ children, style, initialPage = 0, onPageSelected, ...rest }, ref) => {
    const scrollRef = useRef<ScrollView>(null);

    useImperativeHandle(ref, () => ({
        setPage: (index: number) => {
            // Web fallback: no-op or scroll
        },
        setPageWithoutAnimation: (index: number) => {},
    }));

    return (
        <View style={[styles.container, style]}>
            {React.Children.map(children, (child, index) => (
                <View key={index} style={styles.page}>{child}</View>
            ))}
        </View>
    );
});

WebPagerView.displayName = 'WebPagerView';

const styles = StyleSheet.create({
    container: { flex: 1 },
    page: { flex: 1 },
});

const PagerView = Platform.OS === 'web' ? WebPagerView : NativePagerView;
export default PagerView;
