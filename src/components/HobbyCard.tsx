import React, { useMemo } from 'react';
import {
    TouchableOpacity,
    View,
    Text,
    StyleSheet,
    ImageBackground,
    ViewStyle,
    Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { borderRadius } from '../theme';
import { scaleWidth, scaleHeight, scaleFont } from '../theme/responsive';
import { useAppTheme } from '../theme/useAppTheme';

interface HobbyCardProps {
    id: string;
    title: string;
    emoji: string;
    description?: string;
    selected?: boolean;
    onSelect: () => void;
    style?: ViewStyle;
}

// Hobby configurations // colors updated for dark theme compatibility
export const HOBBIES = {
    chess: {
        id: 'chess',
        title: 'Chess',
        emoji: '♟',
        description: 'Develop strategic thinking',
        color: '#1a1a2e',
    },
    video_editing: {
        id: 'video_editing',
        title: 'Video Editing',
        emoji: '📹',
        description: 'Create impressive videos',
        color: '#16213e',
    },
    drawing: {
        id: 'drawing',
        title: 'Drawing',
        emoji: '🎨',
        description: 'Express yourself through art',
        color: '#1f4068',
    },
} as const;

export const HobbyCard: React.FC<HobbyCardProps> = ({
    id,
    title,
    emoji,
    description,
    selected = false,
    onSelect,
    style,
}) => {
    const hobby = HOBBIES[id as keyof typeof HOBBIES];
    const bgColor = hobby?.color || '#1a1a2e';
    const { colors, typography } = useAppTheme();
    const styles = useMemo(() => createStyles(colors, typography), [colors, typography]);

    return (
        <TouchableOpacity
            onPress={onSelect}
            activeOpacity={0.9}
            style={[styles.container, selected && styles.containerSelected, style]}
        >
            <LinearGradient
                colors={[bgColor, `${bgColor}dd`]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradient}
            >
                <Text style={styles.emoji}>{emoji}</Text>
                <Text style={styles.title}>{title}</Text>
                {description && (
                    <Text style={styles.description}>{description}</Text>
                )}
                {selected && (
                    <View style={styles.selectedBadge}>
                        <Image source={require('../../icons/Vector.png')} style={styles.checkIcon} />
                    </View>
                )}
            </LinearGradient>
        </TouchableOpacity>
    );
};

const createStyles = (colors: any, typography: any) => StyleSheet.create({
    container: {
        width: scaleWidth(160),
        height: scaleHeight(200),
        borderRadius: borderRadius.md,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    containerSelected: {
        borderColor: colors.primary,
    },
    gradient: {
        flex: 1,
        padding: scaleWidth(16),
        justifyContent: 'center',
        alignItems: 'center',
    },
    emoji: {
        fontSize: scaleFont(48),
        marginBottom: scaleHeight(12),
    },
    title: {
        fontFamily: typography.h3.fontFamily,
        fontSize: scaleFont(16),
        color: '#FAFAFA', // Force light text on dark gradient backgrounds
        textAlign: 'center',
        marginBottom: scaleHeight(4),
    },
    description: {
        fontFamily: typography.bodySmall.fontFamily,
        fontSize: scaleFont(12),
        color: 'rgba(255,255,255,0.7)',
        textAlign: 'center',
    },
    selectedBadge: {
        position: 'absolute',
        top: scaleHeight(12),
        right: scaleWidth(12),
        width: scaleWidth(24),
        height: scaleWidth(24),
        borderRadius: scaleWidth(12),
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkIcon: {
        width: scaleWidth(14),
        height: scaleWidth(14),
        tintColor: '#FFFFFF',
    },
});

export default HobbyCard;
