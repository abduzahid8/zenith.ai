import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { scale } from '../../constants';
import { fonts } from '../../theme';
import { useAppTheme } from '../../theme/useAppTheme';
import type { CredentialJourney, FinalAssessmentState, JourneyCredential, JourneyNextAction, KnowledgeState, PracticalState, ProjectState } from '../../hooks/useCredentialJourney';

/**
 * Slice 5 — compact credential journey block. Presentational only: every
 * value comes from useCredentialJourney (server truth). No percentages,
 * no dashboards, no local-store reads. One primary CTA. Project is a
 * real stage once unlocked.
 *
 * Slice 6 — the Credential section below renders ONLY the server claim
 * state (useCredentialJourney.credential, from get_credential_status).
 * Score/grade/identity are never calculated locally. The claim/issued
 * CTA itself arrives via the single `primary` prop, owned by the
 * section's claim machine.
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
        case 'start_final':
            return { label: 'Start Final Assessment', kind: nextAction.kind };
        case 'continue_final':
            return { label: 'Continue Final Assessment', kind: nextAction.kind };
        case 'submit_project':
            return { label: 'Submit Project', kind: nextAction.kind };
        case 'revise_project':
            return { label: 'Revise Project', kind: nextAction.kind };
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

function finalStatusLine(state: FinalAssessmentState): string {
    switch (state) {
        case 'locked':
            return 'Locked until Practical is passed';
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

function projectStatusLine(state: ProjectState): string {
    switch (state) {
        case 'locked':
            return 'Locked until Final Assessment is passed';
        case 'ready':
            return 'Ready';
        case 'under_review':
            return 'Under review';
        case 'needs_revision':
            return 'Needs revision';
        case 'passed':
            return 'Passed';
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
    /** Slice 6 server claim state. Null/undefined while unknown: no claim UI. */
    credential?: JourneyCredential | null;
    /** Mapped claim error copy (already safe). Rendered in the Credential section. */
    claimError?: string | null;
}

/** Stable short date for server timestamps (locale-independent). */
export function shortDate(iso: string | null): string | null {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
}

export function gradeLabel(grade: string | null): string | null {
    if (!grade) return null;
    return grade.charAt(0).toUpperCase() + grade.slice(1);
}

function credentialStatusLine(state: NonNullable<JourneyCredential>['state']): string {
    switch (state) {
        case 'ready_to_issue':
            return 'Ready to claim';
        case 'issued':
            return 'Issued';
        case 'revoked':
            return 'Revoked';
        case 'expired':
            return 'Expired';
        case 'temporarily_unavailable':
            return 'Temporarily unavailable';
        case 'locked':
        default:
            return '';
    }
}

export const CredentialJourneyBlock: React.FC<CredentialJourneyBlockProps> = ({
    journey,
    title,
    primary,
    showPracticalTeaser,
    alert,
    credential,
    claimError,
}) => {
    const { colors } = useAppTheme();
    // Real Project stage once the Final is passed or a submission exists.
    const showProject =
        journey.finalAssessment.state === 'passed' || journey.project.submissionId != null;
    // Slice 6: the server claim state drives the Credential section.
    // locked/null keeps the byte-identical legacy teaser; every other
    // state renders authoritative server fields only.
    const credentialState = credential?.state ?? null;
    const showClaimSection =
        credentialState === 'ready_to_issue' ||
        credentialState === 'issued' ||
        credentialState === 'revoked' ||
        credentialState === 'expired' ||
        credentialState === 'temporarily_unavailable';
    const showLegacyTeaser = !showClaimSection && journey.project.state === 'passed';
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
            <Text style={[styles.section, { color: colors.textSecondary }]}>Final Assessment</Text>
            {journey.finalAssessment.state === 'temporarily_unavailable' ? (
                <Text style={[styles.status, { color: colors.text }]}>
                    Final Assessment is temporarily unavailable. Try again later.
                </Text>
            ) : (
                <Text style={[styles.status, { color: colors.text }]}>
                    {journey.finalAssessment.state === 'passed' ? '✓' : finalStatusLine(journey.finalAssessment.state)}
                    {journey.finalAssessment.score != null &&
                    (journey.finalAssessment.state === 'passed' || journey.finalAssessment.state === 'failed')
                        ? ` · Score: ${Math.round(journey.finalAssessment.score)}%`
                        : ''}
                </Text>
            )}
            {showProject && (
                <View>
                    <Text style={[styles.section, { color: colors.textSecondary }]}>Project</Text>
                    {journey.project.state === 'temporarily_unavailable' ? (
                        <Text style={[styles.status, { color: colors.text }]}>
                            Project status is temporarily unavailable.
                        </Text>
                    ) : (
                        <Text style={[styles.status, { color: colors.text }]}>
                            {journey.project.state === 'passed' ? '✓ Passed' : projectStatusLine(journey.project.state)}
                            {journey.project.score != null &&
                            (journey.project.state === 'passed' || journey.project.state === 'needs_revision')
                                ? ` · Score: ${Math.round(journey.project.score)}%`
                                : ''}
                        </Text>
                    )}
                </View>
            )}
            {showClaimSection && credential ? (
                <View>
                    <Text style={[styles.section, { color: colors.textSecondary }]}>Credential</Text>
                    {credentialState === 'ready_to_issue' ? (
                        <Text style={[styles.status, { color: colors.text }]}>
                            {credentialStatusLine('ready_to_issue')}
                            {credential.score != null ? ` · Score: ${Math.round(credential.score)}%` : ''}
                            {gradeLabel(credential.grade) ? ` · ${gradeLabel(credential.grade)}` : ''}
                        </Text>
                    ) : credentialState === 'issued' ? (
                        <Text style={[styles.status, { color: colors.text }]}>
                            {'✓ '}
                            {credentialStatusLine('issued')}
                            {credential.score != null ? ` · Score: ${Math.round(credential.score)}%` : ''}
                            {gradeLabel(credential.grade) ? ` · ${gradeLabel(credential.grade)}` : ''}
                            {shortDate(credential.issuedAt) ? ` · Issued ${shortDate(credential.issuedAt)}` : ''}
                        </Text>
                    ) : (
                        <Text style={[styles.status, { color: colors.text }]}>
                            {credentialState ? credentialStatusLine(credentialState) : ''}
                        </Text>
                    )}
                    {claimError && (
                        <Text style={[styles.alert, { color: colors.text }]}>
                            {claimError}
                        </Text>
                    )}
                </View>
            ) : null}
            {showLegacyTeaser && (
                <Text style={[styles.teaser, { color: colors.textSecondary }]}>
                    Credential{'\n'}Next step
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
