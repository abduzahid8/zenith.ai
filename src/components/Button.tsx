import React from 'react';
import {
    TouchableOpacity,
    Text,
    StyleSheet,
    ViewStyle,
    TextStyle,
    ActivityIndicator,
} from 'react-native';
import { colors, fonts } from '../theme';

interface ButtonProps {
    title: string;
    onPress: () => void;
    variant?: 'primary' | 'secondary' | 'outline' | 'gradient';
    size?: 'small' | 'medium' | 'large';
    disabled?: boolean;
    loading?: boolean;
    style?: ViewStyle;
    textStyle?: TextStyle;
}

export const Button: React.FC<ButtonProps> = ({
    title,
    onPress,
    variant = 'primary',
    size = 'medium',
    disabled = false,
    loading = false,
    style,
    textStyle,
}) => {
    const getButtonStyle = (): ViewStyle => {
        switch (variant) {
            case 'primary':
                return styles.primaryButton;
            case 'secondary':
                return styles.secondaryButton;
            case 'outline':
                return styles.outlineButton;
            case 'gradient':
                return styles.gradientButton;
            default:
                return styles.primaryButton;
        }
    };

    const getSizeStyle = (): ViewStyle => {
        switch (size) {
            case 'small':
                return { height: 40, paddingHorizontal: 20 };
            case 'large':
                return { height: 64, paddingHorizontal: 40 };
            default:
                return {}; // medium uses default button styles
        }
    };

    const getTextStyle = (): TextStyle => {
        switch (variant) {
            case 'primary':
                return { ...styles.buttonText, color: colors.buttonTextPrimary };
            case 'outline':
                return styles.outlineText;
            default:
                return styles.buttonText;
        }
    };

    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled || loading}
            style={[
                styles.button,
                getButtonStyle(),
                getSizeStyle(),
                disabled && styles.disabled,
                style,
            ]}
            activeOpacity={0.8}
        >
            {loading ? (
                <ActivityIndicator color={colors.text} />
            ) : (
                <Text style={[getTextStyle(), textStyle]}>{title}</Text>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    button: {
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
        width: '100%',
    },
    primaryButton: {
        backgroundColor: colors.buttonPrimary, // Dark blue from theme
    },
    secondaryButton: {
        backgroundColor: '#F5F5F5',
    },
    outlineButton: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: colors.text,
    },
    gradientButton: {
        backgroundColor: '#6E5EFF', // Gradient approximation as solid color
    },
    buttonText: {
        fontFamily: fonts.heading.bold,
        fontSize: 18,
        color: colors.text,
        textAlign: 'center',
    },
    outlineText: {
        fontFamily: fonts.heading.medium,
        fontSize: 16,
        color: colors.text,
        textAlign: 'center',
    },
    disabled: {
        opacity: 0.5,
    },
});

export default Button;
