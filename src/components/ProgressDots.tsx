import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { scaleWidth } from '../theme/responsive';
import { useAppTheme } from '../theme/useAppTheme';

interface ProgressDotsProps {
    total: number;
    current: number;
    activeColor?: string;
    inactiveColor?: string;
}

export const ProgressDots: React.FC<ProgressDotsProps> = ({
    total,
    current,
    activeColor,
    inactiveColor,
}) => {
    const { colors } = useAppTheme();

    const finalActiveColor = activeColor || colors.text;
    const finalInactiveColor = inactiveColor || colors.surface;

    const styles = useMemo(() => createStyles(), []);

    return (
        <View style={styles.container}>
            {Array.from({ length: total }, (_, index) => (
                <View
                    key={index}
                    style={[
                        styles.dot,
                        {
                            backgroundColor: index < current ? finalActiveColor : finalInactiveColor,
                            width: scaleWidth(index === current - 1 ? 24 : 8),
                        },
                    ]}
                />
            ))}
        </View>
    );
};

const createStyles = () => StyleSheet.create({
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
