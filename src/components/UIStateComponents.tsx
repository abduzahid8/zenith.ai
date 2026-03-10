import React, { useEffect, useRef, useMemo } from 'react';
import { View, Animated, StyleSheet, ViewStyle, DimensionValue } from 'react-native';
import { scale } from '../constants';
import { fonts } from '../theme';
import { useAppTheme } from '../theme/useAppTheme';

interface SkeletonProps {
    width: DimensionValue;
    height: number;
    borderRadius?: number;
    style?: ViewStyle;
    colors?: any;
}

/**
 * A single shimmering skeleton block.
 */
export const SkeletonBlock: React.FC<SkeletonProps> = ({
    width,
    height,
    borderRadius = scale(12),
    style,
}) => {
    const shimmer = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(shimmer, {
                    toValue: 1,
                    duration: 800,
                    useNativeDriver: true,
                }),
                Animated.timing(shimmer, {
                    toValue: 0.3,
                    duration: 800,
                    useNativeDriver: true,
                }),
            ]),
        );
        animation.start();
        return () => animation.stop();
    }, []);

    return (
        <Animated.View
            style={[
                {
                    width: typeof width === 'number' ? scale(width) : width,
                    height: scale(height),
                    borderRadius,
                    backgroundColor: '#E0E0E0',
                    opacity: shimmer,
                },
                style,
            ]}
        />
    );
};

export const HomeScreenSkeleton: React.FC = () => {
    const { colors } = useAppTheme();
    const skeletonStyles = useMemo(() => createStyles(colors), [colors]);

    return (
        <View style={skeletonStyles.homeContainer}>
            <SkeletonBlock width={200} height={32} borderRadius={scale(8)} />

            <View style={skeletonStyles.homeCards}>
                <SkeletonBlock width="100%" height={150} borderRadius={scale(25)} />

                <SkeletonBlock
                    width="100%"
                    height={70}
                    borderRadius={scale(50)}
                    style={{ marginTop: scale(24) }}
                />

                <View style={skeletonStyles.homeBottomRow}>
                    <SkeletonBlock width={180} height={155} borderRadius={scale(25)} />
                    <SkeletonBlock width={140} height={155} borderRadius={scale(25)} />
                </View>
            </View>
        </View>
    );
};

export const StatisticsEmptyState: React.FC<{ type: 'screenTime' | 'hobby' }> = ({ type }) => {
    const emoji = type === 'screenTime' ? '📊' : '🎯';
    const title = type === 'screenTime'
        ? 'Нет данных об экранном времени'
        : 'Нет данных о хобби';
    const subtitle = type === 'screenTime'
        ? 'Данные появятся после первого дня использования'
        : 'Начните сессию, чтобы отслеживать прогресс';

    const { colors } = useAppTheme();
    const skeletonStyles = useMemo(() => createStyles(colors), [colors]);

    return (
        <View style={skeletonStyles.emptyContainer}>
            <View style={skeletonStyles.emptyEmojiCircle}>
                <Animated.Text style={skeletonStyles.emptyEmoji}>{emoji}</Animated.Text>
            </View>
            <Animated.Text style={skeletonStyles.emptyTitle}>{title}</Animated.Text>
            <Animated.Text style={skeletonStyles.emptySubtitle}>{subtitle}</Animated.Text>
        </View>
    );
};

const createStyles = (colors: any) => StyleSheet.create({
    homeContainer: {
        flex: 1,
        paddingHorizontal: scale(24),
        paddingTop: scale(16),
    },
    homeCards: {
        flex: 1,
        paddingHorizontal: scale(0),
        marginTop: scale(160),
    },
    homeBottomRow: {
        flexDirection: 'row',
        gap: scale(16),
        marginTop: scale(24),
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: scale(40),
        paddingHorizontal: scale(32),
    },
    emptyEmojiCircle: {
        width: scale(80),
        height: scale(80),
        borderRadius: scale(40),
        backgroundColor: colors.surfaceLight,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: scale(20),
    },
    emptyEmoji: {
        fontSize: scale(36),
    },
    emptyTitle: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(20),
        color: colors.text,
        textAlign: 'center',
        marginBottom: scale(8),
    },
    emptySubtitle: {
        fontFamily: fonts.heading.light,
        fontSize: scale(15),
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: scale(22),
    },
});
