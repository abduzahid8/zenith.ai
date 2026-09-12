import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { scale } from '../../constants';
import { fonts } from '../../theme';
import { useAppTheme } from '../../theme/useAppTheme';
import type { CredentialJourney, JourneyNextAction, KnowledgeState } from '../../hooks/useCredentialJourney';

/**
 * Slice 2 — compact credential journey block. Presentational only: every
 * value comes from useCredentialJourney (server truth). No percentages,
 * no dashboards, no local-store reads.
 */

export interface JourneyPrimary {
    label: string;
    onPress: () => void;
}

export function primaryForAction(
    nextAction: JourneyNextAction,
    labels: { verify: (skillName: string) => string },
): { label: string; kind: JourneyNextAction['kind'] } | null {
    switch (nextAction.kind) {
        case 'verify_skill':
            return { label: labels.verify(nextAction.skillName), kind: nextAction.kind };
        case 'start_knowledge':
            return { label: 'Start Knowledge Check', kind: nextAction.kind };
        case 'continue_knowledge':
            return { label: 'Continue Knowledge Check', kind: nextAction.kind };
        case 'continue_learning':
            return { label: 'Continue learning', kind: nextAction.kind };
        default:
            return null;
    }
}

function knowledgeStatusLine(state: KnowledgeState): string {
    switch (state) {
        case 'locked':
            return 'Locked until all skills are verified';
        case 'ready':
            return 'Ready';
        case 'in_progress':
            return 'In progress';
        case 'passed':
            return 'Passed';
        case 'failed':
            return 'Not passed yet';
        case 'temporarily_unavailable':
            return 'Temporarily unavailable';
        default:
            return '';
    }
}

export interface CredentialJourneyBlockProps {
    journey: CredentialJourney;
    title: string;
    primary: JourneyPrimary | null;
    showPracticalTeaser: boolean;
}

export const CredentialJourneyBlock: React.FC<CredentialJourneyBlockProps> = ({
    journey,
    title,
    primary,
    showPracticalTeaser,
}) => {
    const { colors } = useAppTheme();
    return (
        <View style={[styles.card, { backgroundColor: colors.surfaceLight }]}>
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            <Text style={[styles.section, { color: colors.textSecondary }]}>
                Verified skills {journey.verifiedSkillCount}/{journey.totalSkillCount}
            </Text>
            {journey.skills.map(skill => (
                <View key={skill.key} style={styles.skillRow}>
                    <Text style={[styles.skillName, { color: colors.text }]}>{skill.name}</Text>
                    <Text style={[styles.skillMark, { color: colors.textSecondary }]}>
                        {skill.verified ? '✓' : '○'}
                    </Text>
                </View>
            ))}
            <Text style={[styles.section, { color: colors.textSecondary }]}>Knowledge</Text>
            {journey.knowledge.state === 'temporarily_unavailable' ? (
                <Text style={[styles.status, { color: colors.text }]}>
                    Knowledge check is temporarily unavailable. Try again later.
                </Text>
            ) : (
                <Text style={[styles.status, { color: colors.text }]}>
                    {knowledgeStatusLine(journey.knowledge.state)}
                    {journey.knowledge.score != null &&
                    (journey.knowledge.state === 'passed' || journey.knowledge.state === 'failed')
                        ? ` · Score: ${Math.round(journey.knowledge.score)}%`
                        : ''}
                </Text>
            )}
            {showPracticalTeaser && (
                <Text style={[styles.teaser, { color: colors.textSecondary }]}>
                    Practical{'\n'}Next step coming next
                </Text>
            )}
            {primary && (
                <TouchableOpacity
                    style={[styles.primary, { backgroundColor: colors.buttonPrimary }]}
                    onPress={primary.onPress}
                    activeOpacity={0.7}
                >
                    <Text style={[styles.primaryText, { color: colors.white }]}>{primary.label}</Text>
                </TouchableOpacity>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        borderRadius: scale(16),
        padding: scale(16),
        marginHorizontal: scale(16),
        marginBottom: scale(8),
    },
    title: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(17),
        marginBottom: scale(8),
    },
    section: {
        fontFamily: fonts.heading.medium,
        fontSize: scale(13),
        marginTop: scale(8),
        marginBottom: scale(4),
    },
    skillRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: scale(2),
    },
    skillName: {
        fontFamily: fonts.heading.regular,
        fontSize: scale(14),
    },
    skillMark: {
        fontSize: scale(14),
    },
    status: {
        fontFamily: fonts.heading.regular,
        fontSize: scale(14),
    },
    teaser: {
        fontFamily: fonts.heading.regular,
        fontSize: scale(13),
        marginTop: scale(8),
    },
    primary: {
        borderRadius: scale(12),
        paddingVertical: scale(12),
        alignItems: 'center',
        marginTop: scale(12),
    },
    primaryText: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(16),
    },
});

export default CredentialJourneyBlock;
