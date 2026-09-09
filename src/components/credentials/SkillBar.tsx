import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { scale } from '../../constants';
import { fonts } from '../../theme';
import { useAppTheme } from '../../theme/useAppTheme';

/** Horizontal progress bar in app style (rounded track + gradient-ready fill). */
export const ProgressBar: React.FC<{ value: number; height?: number; fillColor?: string }> = ({
    value,
    height,
    fillColor,
}) => {
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const clamped = Math.min(100, Math.max(0, value));
    return (
        <View style={[styles.track, height ? { height: scale(height) } : null]}>
            <View style={[styles.fill, { width: `${clamped}%` }, fillColor ? { backgroundColor: fillColor } : null]} />
        </View>
    );
};

/** One skill row: name, score, minimum gate marker, verified check. */
export const SkillBar: React.FC<{
    name: string;
    score: number;
    minimumScore: number;
    locked?: boolean;
}> = ({ name, score, minimumScore, locked }) => {
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const passed = score >= minimumScore;
    return (
        <View style={styles.skillRow}>
            <View style={styles.skillHeader}>
                <Text style={styles.skillName}>
                    {locked ? `${name} — Locked` : passed ? `${name} ✓` : name}
                </Text>
                <Text style={styles.skillScore}>{locked ? '—' : `${Math.round(score)}%`}</Text>
            </View>
            <View style={styles.barWrap}>
                <ProgressBar value={locked ? 0 : score} height={8} fillColor={passed ? '#34C759' : '#FF9500'} />
                {/* minimum-gate marker */}
                {!locked && (
                    <View style={[styles.gate, { left: `${Math.min(100, Math.max(0, minimumScore))}%` }]} />
                )}
            </View>
        </View>
    );
};

const createStyles = (colors: any) =>
    StyleSheet.create({
        track: {
            height: scale(10),
            borderRadius: scale(50),
            backgroundColor: '#DDE8F4',
            overflow: 'hidden',
        },
        fill: {
            height: '100%',
            borderRadius: scale(50),
            backgroundColor: colors.sessionTimer?.primary ?? '#37A0EF',
        },
        skillRow: {
            marginBottom: scale(12),
        },
        skillHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: scale(6),
        },
        skillName: {
            fontFamily: fonts.body.regular,
            fontSize: scale(15),
            lineHeight: scale(20),
            color: colors.text,
            flex: 1,
        },
        skillScore: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(15),
            color: colors.text,
        },
        barWrap: {
            position: 'relative',
            justifyContent: 'center',
        },
        gate: {
            position: 'absolute',
            top: scale(-2),
            width: scale(2),
            height: scale(12),
            backgroundColor: colors.text,
            opacity: 0.5,
        },
    });

export default SkillBar;
