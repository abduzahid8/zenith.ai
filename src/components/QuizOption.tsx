import React, { useMemo } from 'react';
import {
    TouchableOpacity,
    View,
    Text,
    StyleSheet,
    ViewStyle,
} from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
} from 'react-native-reanimated';
import { borderRadius, spacing } from '../theme';
import { scaleWidth, scaleHeight, scaleFont } from '../theme/responsive';
import { useAppTheme } from '../theme/useAppTheme';

interface QuizOptionProps {
    text: string;
    selected: boolean;
    onSelect: () => void;
    style?: ViewStyle;
}

export const QuizOption: React.FC<QuizOptionProps> = ({
    text,
    selected,
    onSelect,
    style,
}) => {
    const scale = useSharedValue(1);
    const { colors, typography } = useAppTheme();
    const styles = useMemo(() => createStyles(colors, typography), [colors, typography]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const handlePressIn = () => {
        scale.value = withSpring(0.98);
    };

    const handlePressOut = () => {
        scale.value = withSpring(1);
    };

    return (
        <Animated.View style={[animatedStyle, style]}>
            <TouchableOpacity
                onPress={onSelect}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                activeOpacity={0.9}
                style={[
                    styles.container,
                    selected && styles.containerSelected,
                ]}
            >
                <View style={[styles.circle, selected && styles.circleSelected]}>
                    {selected && <View style={styles.circleFilled} />}
                </View>
                <Text style={[styles.text, selected && styles.textSelected]}>
                    {text}
                </Text>
            </TouchableOpacity>
        </Animated.View>
    );
};

const createStyles = (colors: any, typography: any) => StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surfaceLight,
        borderRadius: borderRadius.md,
        paddingVertical: scaleHeight(16),
        paddingHorizontal: scaleWidth(16),
        borderWidth: 1,
        borderColor: 'transparent',
    },
    containerSelected: {
        backgroundColor: colors.background,
        borderColor: colors.text,
    },
    circle: {
        width: scaleWidth(20),
        height: scaleWidth(20),
        borderRadius: scaleWidth(10),
        borderWidth: 1,
        borderColor: colors.text,
        marginRight: scaleWidth(12),
        justifyContent: 'center',
        alignItems: 'center',
    },
    circleSelected: {
        borderColor: colors.text,
    },
    circleFilled: {
        width: scaleWidth(12),
        height: scaleWidth(12),
        borderRadius: scaleWidth(6),
        backgroundColor: colors.text,
    },
    text: {
        flex: 1,
        fontFamily: typography.quizOption.fontFamily,
        fontSize: scaleFont(typography.quizOption.fontSize),
        color: colors.text,
    },
    textSelected: {
        fontFamily: typography.quizOption.fontFamily,
    },
});

export default QuizOption;
