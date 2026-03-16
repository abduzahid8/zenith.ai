import React, { useRef, useEffect, useMemo } from 'react';
import {
    Text,
    StyleSheet,
    TouchableWithoutFeedback,
    ViewStyle,
    TextStyle,
    Animated,
    View,
} from 'react-native';
import { fonts } from '../theme';
import { scale } from '../constants';
import { useAppTheme } from '../theme/useAppTheme';

interface LucidGlassButtonProps {
    /** Button text */
    label: string;
    /** Optional emoji to display after text */
    emoji?: string;
    /** Whether the button is currently selected */
    isSelected?: boolean;
    /** Callback when button is pressed */
    onPress: () => void;
    /** Custom container style */
    style?: ViewStyle;
    /** Custom text style */
    textStyle?: TextStyle;
    /** Disabled state */
    disabled?: boolean;
}

/**
 * LucidGlassButton - Animated button with lucid glass effect
 * 
 * Uses separate animation values for native-driver (scale) and JS-driver (colors/layout)
 */
export const LucidGlassButton: React.FC<LucidGlassButtonProps> = ({
    label,
    emoji,
    isSelected = false,
    onPress,
    style,
    textStyle,
    disabled = false,
}) => {
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const scaleAnim = useRef(new Animated.Value(1)).current;
    const selectionAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.spring(selectionAnim, {
            toValue: isSelected ? 1 : 0,
            damping: 15,
            stiffness: 120,
            mass: 0.8,
            useNativeDriver: false, // Required for layout/color animations
        }).start();
    }, [isSelected, selectionAnim]);

    const handlePressIn = () => {
        Animated.spring(scaleAnim, {
            toValue: 1.02,
            damping: 15,
            stiffness: 300,
            mass: 0.5,
            useNativeDriver: true, // Native driver for transform
        }).start();
    };

    const handlePressOut = () => {
        Animated.spring(scaleAnim, {
            toValue: 1,
            damping: 10,
            stiffness: 200,
            mass: 0.5,
            useNativeDriver: true,
        }).start();
    };

    // Interpolated styles for selection (JS driven)
    const backgroundColor = selectionAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['rgba(255,255,255,1)', 'rgba(217,217,217,1)'],
    });

    const paddingH = selectionAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [scale(24), scale(64)],
    });

    return (
        <TouchableWithoutFeedback
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={onPress}
            disabled={disabled}
        >
            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                <Animated.View
                    style={[
                        styles.container,
                        {
                            backgroundColor,
                            paddingLeft: paddingH,
                            paddingRight: paddingH,
                        },
                        style,
                    ]}
                >
                    <Text
                        style={[styles.text, textStyle]}
                        numberOfLines={1}
                    >
                        {label}{emoji ? ` ${emoji}` : ''}
                    </Text>
                </Animated.View>
            </Animated.View>
        </TouchableWithoutFeedback>
    );
};

const createStyles = (colors: any) => StyleSheet.create({
    container: {
        height: scale(45),
        paddingHorizontal: scale(24),
        borderRadius: scale(24),
        borderWidth: 2,
        borderColor: colors.text,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
    },
    text: {
        fontFamily: fonts.heading.medium,
        fontSize: scale(16),
        color: colors.text,
        textAlign: 'center',
    },
});

export default LucidGlassButton;
