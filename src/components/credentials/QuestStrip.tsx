import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { scale } from '../../constants';
import { fonts } from '../../theme';
import { useAppTheme } from '../../theme/useAppTheme';
import { getProgramForHobby, programShortTitle } from '../../domain/credentials/catalog';
import { useCertificateProgress } from '../../hooks/useCertificateProgress';
import { useUserProfileStore } from '../../store/userProfileStore';

/**
 * Compact quest strip embedded in the session flows (Quick Session) instead
 * of a separate Home button: "this session grows X of your quest".
 * Canonical progress only — same % as every other surface.
 */
export const QuestStrip: React.FC = () => {
    const router = useRouter();
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const selectedHobby = useUserProfileStore(s => s.selectedHobby);
    const slug = selectedHobby ? (getProgramForHobby(selectedHobby)?.slug ?? null) : null;
    const cert = useCertificateProgress(slug);

    const program = cert.program;
    if (!program || !cert.eligible) return null;
    const pct = Math.round(cert.overall);
    const byWeakest = [...cert.skills].sort((a, b) => a.score - b.score);
    const nextSkill = byWeakest.find(s => !s.passed) ?? byWeakest[0];

    return (
        <TouchableOpacity
            style={styles.strip}
            activeOpacity={0.85}
            onPress={() => {
                console.log('[QuestStrip] pressed:', program.slug);
                router.push(`/credential/${program.slug}` as any);
            }}
        >
            <Ionicons name="shield-checkmark-outline" size={scale(26)} color="#1E1E2E" />
            <View style={styles.textWrap}>
                <Text style={styles.title} numberOfLines={1}>
                    {programShortTitle(program.title)} · {pct}%
                </Text>
                <Text style={styles.subtitle} numberOfLines={2}>
                    This session grows {nextSkill ? `«${nextSkill.name}»` : 'your quest'} — verdicts count as proof
                </Text>
            </View>
            <Ionicons name="chevron-forward" size={scale(22)} color="#1E1E2E" />
        </TouchableOpacity>
    );
};

const createStyles = (colors: any) =>
    StyleSheet.create({
        strip: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: scale(12),
            backgroundColor: '#D1FAE5',
            borderRadius: scale(25),
            paddingHorizontal: scale(20),
            paddingVertical: scale(14),
            marginBottom: scale(16),
        },
        textWrap: {
            flex: 1,
        },
        title: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(16),
            color: '#1E1E2E',
        },
        subtitle: {
            fontFamily: fonts.body.regular,
            fontSize: scale(13),
            lineHeight: scale(18),
            color: '#1E1E2E',
            opacity: 0.7,
        },
    });

export default QuestStrip;
