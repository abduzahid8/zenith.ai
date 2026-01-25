import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '../theme';
import { scaleWidth } from '../theme/responsive';

interface ProgressDotsProps {
    total: number;
    current: number;
    activeColor?: string;
    inactiveColor?: string;
}

export const ProgressDots: React.FC<ProgressDotsProps> = ({
    total,
    current,
    activeColor = colors.text,
    inactiveColor = colors.surface,
}) => {
    return (
        <View style={styles.container}>
            {Array.from({ length: total }, (_, index) => (
                <View
                    key={index}
                    style={[
                        styles.dot,
                        {
                            backgroundColor: index < current ? activeColor : inactiveColor,
                            width: scaleWidth(index === current - 1 ? 24 : 8),
                        },
                    ]}
                />
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: scaleWidth(6),
    },
    dot: {
        height: scaleWidth(8),
        borderRadius: scaleWidth(4),
    },
});

export default ProgressDots;
