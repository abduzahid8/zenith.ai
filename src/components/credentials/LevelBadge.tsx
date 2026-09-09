import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { scale } from '../../constants';
import { fonts } from '../../theme';
import { useAppTheme } from '../../theme/useAppTheme';
import { CredentialLevel } from '../../domain/credentials/types';
import { LEVEL_LABEL } from '../../domain/credentials/catalog';

export const LevelBadge: React.FC<{ level: CredentialLevel }> = ({ level }) => {
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const label =
        level === 'completion'
            ? 'Completion'
            : level === 'verified-skill'
              ? 'Verified Skill'
              : 'Professional';
    return (
        <View
            style={[
                styles.badge,
                level === 'professional' && styles.professional,
                level === 'verified-skill' && styles.verified,
            ]}
        >
            <Text style={styles.badgeText}>{label}</Text>
        </View>
    );
};

export const levelDescription = (level: CredentialLevel): string =>
    LEVEL_LABEL[level] ?? level;

const createStyles = (colors: any) =>
    StyleSheet.create({
        badge: {
            alignSelf: 'flex-start',
            backgroundColor: colors.surfaceLight,
            borderRadius: scale(50),
            paddingVertical: scale(4),
            paddingHorizontal: scale(12),
        },
        verified: {
            backgroundColor: '#D1FAE5',
        },
        professional: {
            backgroundColor: '#102852',
        },
        badgeText: {
            fontFamily: fonts.heading.medium,
            fontSize: scale(12),
            lineHeight: scale(16),
            color: colors.text,
        },
    });

export default LevelBadge;
