import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

/**
 * Coach action bar (Phase 1 — one canonical next action).
 *
 * Exactly ONE primary CTA (the precedence-resolved canonical action) plus
 * info-only secondaries that never imply a competing "do this now".
 * Pure presentational: the model is built by the caller from
 * `resolveCoachPrimary`; this component enforces at most one primary
 * structurally (a single optional slot).
 */

export interface CoachSecondaryAction {
    id: string;
    label: string;
    icon: string;
    onPress: () => void;
}

export interface CoachActionModel {
    primary: { label: string; icon: string; onPress: () => void } | null;
    secondaries: CoachSecondaryAction[];
}

export const CoachActionBar: React.FC<{ model: CoachActionModel }> = ({ model }) => (
    <View>
        <View style={styles.row}>
            {model.primary && (
                <TouchableOpacity
                    testID="coach-primary-action"
                    accessibilityRole="button"
                    style={[styles.chip, styles.primary]}
                    onPress={model.primary.onPress}
                    activeOpacity={0.7}
                >
                    <Text style={[styles.label, styles.primaryLabel]}>
                        {model.primary.icon} {model.primary.label}
                    </Text>
                </TouchableOpacity>
            )}
            {model.secondaries.map(s => (
                <TouchableOpacity
                    key={s.id}
                    testID="coach-secondary-action"
                    accessibilityRole="button"
                    style={styles.chip}
                    onPress={s.onPress}
                    activeOpacity={0.7}
                >
                    <Text style={styles.label}>
                        {s.icon} {s.label}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
    </View>
);

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8 as any,
        paddingVertical: 8,
    },
    chip: {
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 20,
        backgroundColor: '#F0F0F5',
        borderWidth: 1,
        borderColor: '#E0E0E8',
    },
    primary: {
        backgroundColor: '#059669',
        borderColor: '#059669',
    },
    label: {
        fontSize: 13,
        color: '#333',
    },
    primaryLabel: {
        color: '#FFF',
        fontWeight: '600' as any,
    },
});

export default CoachActionBar;
