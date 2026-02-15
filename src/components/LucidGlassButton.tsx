import React, { useRef, useEffect } from 'react';
import {
    Text,
    StyleSheet,
    TouchableWithoutFeedback,
    ViewStyle,
    TextStyle,
    Animated,
    View,
} from 'react-native';
import { colors, fonts } from '../theme';
import { scale } from '../constants';

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
    // Separate animation values:
    // - scaleAnim: uses native driver (transform only)
    // - selectionAnim: uses JS driver (layout/color properties)
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const selectionAnim = useRef(new Animated.Value(0)).current;

    // Animate selection state (JS driver for layout properties)
    useEffect(() => {
        Animated.spring(selectionAnim, {
            toValue: isSelected ? 1 : 0,
            damping: 15,
            stiffness: 120,
            mass: 0.8,
            useNativeDriver: false, // Required for layout/color animations
        }).start();
    }, [isSelected, selectionAnim]);

    // Press handlers (native driver for scale - smooth 60fps)
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
            useNativeDriver: true, // Native driver for transform
        }).start();
    };

    // Interpolated styles for selection (JS driven)
    const backgroundColor = selectionAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['#FFFFFF', '#D9D9D9'],
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
            {/* Outer wrapper for native-driver scale transform */}
            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                {/* Inner view for JS-driver layout/color animations */}
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

const styles = StyleSheet.create({
    container: {
        height: scale(45),
        paddingHorizontal: scale(24),
        borderRadius: scale(24),
        borderWidth: 2,
        borderColor: colors.black,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
    },
    text: {
        fontFamily: fonts.heading.medium,
        fontSize: scale(16),
        color: colors.black,
        textAlign: 'center',
    },
});

export default LucidGlassButton;
