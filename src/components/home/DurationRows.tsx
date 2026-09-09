import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { scale } from '../../constants';
import { fonts } from '../../theme';
import { useAppTheme } from '../../theme/useAppTheme';
import { useT } from '../../store/languageStore';
import { QUICK_SESSION_OPTIONS } from '../../domain/sessions/sessionDurations';

/**
 * Shared single-select pill row (onboarding duration language):
 * full-width row, navy selected state, circle indicator.
 */
export const SelectRow: React.FC<{
    label: string;
    selected: boolean;
    onPress: () => void;
}> = ({ label, selected, onPress }) => {
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    return (
        <TouchableOpacity
            style={[styles.optionRow, selected && styles.optionRowSelected]}
            onPress={onPress}
            activeOpacity={0.8}
        >
            <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{label}</Text>
            <View
                style={[
                    styles.circle,
                    { backgroundColor: colors.hobbySelection?.unselectedBg || colors.border },
                    selected && { backgroundColor: '#FFF' },
                ]}
            />
        </TouchableOpacity>
    );
};

/** Duration picker reusing SelectRow (single source: QUICK_SESSION_OPTIONS). */
export const DurationRows: React.FC<{
    value: number;
    onChange: (minutes: number) => void;
}> = ({ value, onChange }) => {
    const t = useT();
    return (
        <View style={stylesRows.container}>
            {QUICK_SESSION_OPTIONS.map((minutes, i) => {
                const isLast = i === QUICK_SESSION_OPTIONS.length - 1;
                return (
                    <SelectRow
                        key={minutes}
                        label={`${minutes} ${t('min')}${isLast ? '+' : ''}`}
                        selected={value === minutes}
                        onPress={() => onChange(minutes)}
                    />
                );
            })}
        </View>
    );
};

const stylesRows = StyleSheet.create({
    container: {
        gap: scale(12),
    },
});

const createStyles = (colors: any) =>
    StyleSheet.create({
        optionRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: scale(50),
            paddingVertical: scale(11),
            paddingHorizontal: scale(20),
            borderRadius: scale(40),
            backgroundColor: colors.hobbySelection?.selectedBorderBg || colors.surfaceLight,
        },
        optionRowSelected: {
            backgroundColor: colors.hobbySelection?.selectedBg || colors.buttonPrimary,
        },
        optionLabel: {
            flex: 1,
            fontFamily: fonts.heading.bold,
            fontSize: scale(16),
            color: colors.home?.darkText || '#1E1E2E',
            marginRight: scale(12),
        },
        optionLabelSelected: {
            color: '#FFF',
        },
        circle: {
            width: scale(24),
            height: scale(24),
            borderRadius: scale(12),
        },
    });

export default DurationRows;
