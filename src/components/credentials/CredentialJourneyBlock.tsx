import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { scale } from '../../constants';
import { fonts } from '../../theme';
import { useAppTheme } from '../../theme/useAppTheme';
import type { CredentialJourney, JourneyNextAction, KnowledgeState, PracticalState } from '../../hooks/useCredentialJourney';

/**
 * Slice 3 — compact credential journey block. Presentational only: every
 * value comes from useCredentialJourney (server truth). No percentages,
 * no dashboards, no local-store reads. One primary CTA. Final Assessment
 * is a non-interactive teaser only.
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
        case 'start_practical':
            return { label: 'Start Practical Check', kind: nextAction.kind };
        case 'continue_practical':
            return { label: 'Continue Practical Check', kind: nextAction.kind };
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

function practicalStatusLine(state: PracticalState): string {
    switch (state) {
        case 'locked':
            return 'Locked until Knowledge is passed';
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
    /** Slice 2 compat: when true and practical is not yet runnable, show the legacy teaser. */
    showPracticalTeaser?: boolean;
    /** Safe user-visible notice (e.g. connectivity). Never internal strings. */
    alert?: string | null;
}

export const CredentialJourneyBlock: React.FC<CredentialJourneyBlockProps> = ({
    journey,
    title,
    primary,
    showPracticalTeaser,
    alert,
}) => {
    const { colors } = useAppTheme();
    const showFinalTeaser = journey.practical.state === 'passed';
    const showLegacyPracticalTeaser =
        showPracticalTeaser === true && journey.knowledge.state === 'passed' && journey.practical.state !== 'passed';
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
            <Text style={[styles.section, { color: colors.textSecondary }]}>Practical</Text>
            {journey.practical.state === 'temporarily_unavailable' ? (
                <Text style={[styles.status, { color: colors.text }]}>
                    Practical check is temporarily unavailable. Try again later.
                </Text>
            ) : (
                <Text style={[styles.status, { color: colors.text }]}>
                    {journey.practical.state === 'passed' ? '✓' : practicalStatusLine(journey.practical.state)}
                    {journey.practical.state === 'passed' && journey.practical.score != null
                        ? ` · Score: ${Math.round(journey.practical.score)}%`
                        : ''}
                    {journey.practical.state === 'failed' && journey.practical.score != null
                        ? ` · Score: ${Math.round(journey.practical.score)}%`
                        : ''}
                </Text>
            )}
            {showLegacyPracticalTeaser && (
                <Text style={[styles.teaser, { color: colors.textSecondary }]}>
                    Practical{'\n'}Next step coming next
                </Text>
            )}
            {showFinalTeaser && (
                <Text style={[styles.teaser, { color: colors.textSecondary }]}>
                    Final Assessment{'\n'}Next step
                </Text>
            )}
            {alert && (
                <Text style={[styles.alert, { color: colors.text }]}>
                    {alert}
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
    alert: {
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
