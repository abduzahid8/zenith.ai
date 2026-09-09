import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { scale } from '../../constants';
import { fonts } from '../../theme';
import { useAppTheme } from '../../theme/useAppTheme';
import { CredentialProgram } from '../../domain/credentials/types';
import { LevelBadge } from './LevelBadge';

interface Props {
    program: CredentialProgram;
    /** Certification progress 0..100 (skill graph overall), when enrolled. */
    progress: number | null;
    enrolled: boolean;
    issued: boolean;
    onPress: () => void;
}

const CARD_GRADIENTS: Record<string, [string, string]> = {
    'ai-foundations': ['#8CDEFF', '#D5F3FF'],
    'prompt-engineering': ['#D6D7F8', '#E0E2FF'],
    'data-analytics-foundation': ['#76B9FF', '#D2E8FF'],
    'python-foundations': ['#BFD8F9', '#DAEEFF'],
    'ai-productivity': ['#F4C0FD', '#E2D6F8'],
};

/** Program card in HomeTab/WeeklyPlan card style: gradient, radius 25. */
export const CredentialCard: React.FC<Props> = ({ program, progress, enrolled, issued, onPress }) => {
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const gradient = CARD_GRADIENTS[program.slug] ?? (['#BFD8F9', '#DAEEFF'] as [string, string]);
    return (
        <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.shadow}>
            <LinearGradient
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                colors={issued ? ['#D1FAE5', '#ECFDF5'] : gradient}
                style={styles.card}
            >
                <View style={styles.topRow}>
                    <LevelBadge level={program.level} />
                    {issued ? (
                        <Text style={styles.statusText}>Verified ✓</Text>
                    ) : enrolled && progress !== null ? (
                        <Text style={styles.statusText}>{Math.round(progress)}%</Text>
                    ) : (
                        <Text style={styles.statusText}>{program.estimatedHours}h</Text>
                    )}
                </View>
                <Text style={styles.title}>{program.title}</Text>
                <Text style={styles.subtitle}>{program.subtitle}</Text>
                {enrolled && progress !== null && !issued && (
                    <View style={styles.barTrack}>
                        <View style={[styles.barFill, { width: `${Math.min(100, Math.max(0, progress))}%` }]} />
                    </View>
                )}
            </LinearGradient>
        </TouchableOpacity>
    );
};

const createStyles = (colors: any) =>
    StyleSheet.create({
        shadow: {
            marginBottom: scale(16),
        },
        card: {
            borderRadius: scale(25),
            paddingHorizontal: scale(20),
            paddingVertical: scale(18),
            overflow: 'hidden',
        },
        topRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: scale(10),
        },
        statusText: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(16),
            color: '#1E1E2E',
        },
        title: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(20),
            lineHeight: scale(24),
            color: '#1E1E2E',
            marginBottom: scale(4),
        },
        subtitle: {
            fontFamily: fonts.body.regular,
            fontSize: scale(14),
            lineHeight: scale(20),
            color: '#1E1E2E',
            opacity: 0.75,
        },
        barTrack: {
            marginTop: scale(12),
            height: scale(8),
            borderRadius: scale(50),
            backgroundColor: 'rgba(255,255,255,0.6)',
            overflow: 'hidden',
        },
        barFill: {
            height: '100%',
            borderRadius: scale(50),
            backgroundColor: '#102852',
        },
    });

export default CredentialCard;
