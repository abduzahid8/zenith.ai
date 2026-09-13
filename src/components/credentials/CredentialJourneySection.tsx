import React, { useMemo, useState } from 'react';
import { Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { LearningRecommendation } from '../../domain/sessions/nextBestAction';
import { getProjectRequirement } from '../../domain/credentials/catalog';
import { ensureEnrollment, isContentUnavailable, issueCredential, parseClaimError, submitProject } from '../../services/trustApi';
import {
    CLAIM_ALREADY_ISSUED_COPY,
    CLAIM_BUTTON_COPY,
    CLAIM_NETWORK_COPY,
    CLAIM_NOT_READY_COPY,
    CLAIM_TEMPORARILY_UNAVAILABLE_COPY,
    CLAIMING_BUTTON_COPY,
    VIEW_CREDENTIAL_BUTTON_COPY,
} from '../../services/trustApi';
import { useCredentialJourney } from '../../hooks/useCredentialJourney';
import { useUserProfileStore } from '../../store/userProfileStore';
import { useAppTheme } from '../../theme/useAppTheme';
import { scale } from '../../constants';
import { fonts } from '../../theme';
import type { KnowledgeSubmitResult, RunnerMode } from './CredentialChallengeRunner';
import { CredentialChallengeRunner } from './CredentialChallengeRunner';
import { CredentialJourneyBlock, primaryForAction } from './CredentialJourneyBlock';
import type { ProjectSheetOutcome } from './CredentialProjectSubmission';
import { CredentialProjectSubmission } from './CredentialProjectSubmission';

/**
 * Slice 5 — credential journey section (container). Owns the journey read
 * model, the runner sheet (knowledge + practical + final), the project
 * submission sheet, and server-truth refresh. Rendered inside the Coach
 * experience; returns null unless the program is officially available.
 * One primary CTA only. Project submits go solely through the
 * submitProject RPC; server outcomes map to safe copy, never raw errors.
 */

export interface CredentialJourneySectionProps {
    programSlug: string | null;
    programTitle: string;
    recommendation: LearningRecommendation | null;
    onVerifySkill: (target: { skillKey: string; skillName: string }) => void;
    onContinueLearning: () => void;
    /**
     * Parent-owned refresh signal. Bumped after trusted verification
     * completes (pass or fail) so the journey re-reads server truth.
     */
    refreshToken?: number;
}

export type ProjectSubmitBlock =
    | { kind: 'not_ready' }
    | { kind: 'already_passed' }
    | { kind: 'unavailable' }
    | { kind: 'empty' }
    | { kind: 'network' };

/** Typed client parsing for project submission outcomes. Raw backend
 *  strings never reach the UI. */
export function parseProjectSubmitError(message: string): ProjectSubmitBlock {
    if (message.includes('project_not_ready:final')) {
        return { kind: 'not_ready' };
    }
    if (message.includes('project_already_passed')) {
        return { kind: 'already_passed' };
    }
    if (message.includes('project_submission_empty')) {
        return { kind: 'empty' };
    }
    if (message.includes('project_unavailable') || isContentUnavailable(message)) {
        return { kind: 'unavailable' };
    }
    return { kind: 'network' };
}

export const PROJECT_PATH_CHANGED_COPY =
    'Your credential path changed. Complete the current verification step first.';
export const PROJECT_TEMPORARILY_UNAVAILABLE_COPY =
    'Project submission is temporarily unavailable. Try again later.';
export const PROJECT_EMPTY_COPY = 'Add a project reference or your project notes.';
export const PROJECT_NETWORK_COPY = 'Project submission needs an internet connection.';

export const CredentialJourneySection: React.FC<CredentialJourneySectionProps> = ({
    programSlug,
    programTitle,
    recommendation,
    onVerifySkill,
    onContinueLearning,
    refreshToken,
}) => {
    const { journey, refresh } = useCredentialJourney(programSlug, { recommendation, refreshToken });
    const [runnerOpen, setRunnerOpen] = useState(false);
    const [runnerMode, setRunnerMode] = useState<RunnerMode>('knowledge');
    const [starting, setStarting] = useState(false);
    const [unavailable, setUnavailable] = useState(false);
    const [prepareError, setPrepareError] = useState<null | 'network'>(null);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [sheetMode, setSheetMode] = useState<'submit' | 'revise'>('submit');
    const [notice, setNotice] = useState<string | null>(null);
    // Slice 6 claim lifecycle: idle → submitting → server response →
    // authoritative refresh. No optimistic issuance, ever.
    const [claimSubmitting, setClaimSubmitting] = useState(false);
    const [claimError, setClaimError] = useState<string | null>(null);
    const [holderSheetOpen, setHolderSheetOpen] = useState(false);
    const [holderDraft, setHolderDraft] = useState('');
    const router = useRouter();
    const { colors } = useAppTheme();
    const profileName = useUserProfileStore(s => s.userName);

    const skillNames = useMemo(() => {
        const map: Record<string, string> = {};
        for (const skill of journey?.skills ?? []) {
            map[skill.key] = skill.name;
        }
        return map;
    }, [journey?.skills]);

    const projectMeta = useMemo(() => {
        const entry = programSlug ? getProjectRequirement(programSlug) : null;
        return entry ?? { label: 'Project', description: 'Submit your project.' };
    }, [programSlug]);

    if (!journey || !journey.visible) return null;

    const openRunner = async (mode: RunnerMode) => {
        if (!programSlug || starting) return;
        setStarting(true);
        setUnavailable(false);
        setPrepareError(null);
        setNotice(null);
        try {
            // Server enrollment first (idempotent); the runner then resumes
            // or creates the one active server attempt — never a client one.
            await ensureEnrollment(programSlug);
            // Re-read: enrolled must come from the current-version server
            // row, never a local optimistic patch.
            refresh();
            setRunnerMode(mode);
            setRunnerOpen(true);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            if (isContentUnavailable(message)) {
                setUnavailable(true);
            } else {
                // Never silent, never internal strings: safe connectivity copy.
                setPrepareError('network');
            }
        } finally {
            setStarting(false);
        }
    };

    const startKnowledge = () => void openRunner('knowledge');
    const startPractical = () => void openRunner('practical');
    const startFinal = () => void openRunner('final');

    const openSheet = (mode: 'submit' | 'revise') => {
        setNotice(null);
        setSheetMode(mode);
        setSheetOpen(true);
    };

    /**
     * Slice 6 Claim: exactly one server call (trustApi.issueCredential),
     * guarded against double-tap locally but correct regardless — the
     * server is idempotent and any same-identity success counts. Never
     * sets issued state locally: the authoritative refresh decides.
     */
    const runClaim = async (holderName: string) => {
        if (!programSlug || claimSubmitting) return;
        setClaimSubmitting(true);
        setClaimError(null);
        setNotice(null);
        try {
            // Success, first or duplicate: the server returns the
            // authoritative credential identity either way.
            await issueCredential(programSlug, holderName);
            setHolderSheetOpen(false);
            refresh();
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            const block = parseClaimError(message);
            switch (block.kind) {
                case 'not_ready':
                    // The journey moved under us: never fake success,
                    // re-read the authoritative state and show it.
                    refresh();
                    setClaimError(CLAIM_NOT_READY_COPY);
                    break;
                case 'already_issued':
                    refresh();
                    setClaimError(CLAIM_ALREADY_ISSUED_COPY);
                    break;
                case 'unavailable':
                    refresh();
                    setClaimError(CLAIM_TEMPORARILY_UNAVAILABLE_COPY);
                    break;
                case 'network':
                default:
                    // Offline: keep the current view, offer retry. Never
                    // refresh into a fail-closed hide on a network blip.
                    setClaimError(CLAIM_NETWORK_COPY);
                    break;
            }
        } finally {
            setClaimSubmitting(false);
        }
    };

    const startClaim = () => {
        if (!programSlug || claimSubmitting) return;
        setClaimError(null);
        // Reuse the trustworthy onboarding display name when present;
        // otherwise ask for a display name (never identity verification).
        const known = (profileName ?? '').trim();
        if (known) {
            void runClaim(known);
        } else {
            setHolderDraft('');
            setHolderSheetOpen(true);
        }
    };

    const confirmHolderName = () => {
        const name = holderDraft.trim();
        if (!name) return;
        void runClaim(name);
    };

    const viewCredential = () => {
        if (!programSlug) return;
        router.push(`/credential/${programSlug}` as any);
    };

    const handleRunnerComplete = (_result: KnowledgeSubmitResult) => {
        // Re-read server truth (attempts + component snapshot). Nothing is
        // set manually: the block recomputes from the refreshed model.
        refresh();
    };

    const handleSheetSubmit = async (artifactRef: string, notes: string): Promise<ProjectSheetOutcome> => {
        if (!programSlug) {
            return { ok: false, errorCopy: PROJECT_NETWORK_COPY };
        }
        try {
            // Sole creation path: the server re-validates everything
            // (readiness, payload, idempotency, revision discipline).
            await submitProject(programSlug, artifactRef, notes);
            setSheetOpen(false);
            setNotice(null);
            refresh();
            return { ok: true };
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            const block = parseProjectSubmitError(message);
            switch (block.kind) {
                case 'already_passed':
                    // Stale client read: the canonical journey already holds
                    // the pass. Silent refresh, never an error UI.
                    setSheetOpen(false);
                    setNotice(null);
                    refresh();
                    return { ok: true };
                case 'not_ready':
                    // Raced rotation/authority: upstream CTA takes over.
                    setSheetOpen(false);
                    refresh();
                    setNotice(PROJECT_PATH_CHANGED_COPY);
                    return { ok: true };
                case 'unavailable':
                    setSheetOpen(false);
                    refresh();
                    setNotice(PROJECT_TEMPORARILY_UNAVAILABLE_COPY);
                    return { ok: true };
                case 'empty':
                    return { ok: false, errorCopy: PROJECT_EMPTY_COPY };
                case 'network':
                default:
                    return { ok: false, errorCopy: PROJECT_NETWORK_COPY };
            }
        }
    };

    const retryCurrent = () => {
        const action = journey.nextAction;
        if (action.kind === 'start_practical' || action.kind === 'continue_practical') {
            return void openRunner('practical');
        }
        if (action.kind === 'start_final' || action.kind === 'continue_final') {
            return void openRunner('final');
        }
        if (action.kind === 'submit_project' || action.kind === 'revise_project') {
            return openSheet(action.kind === 'revise_project' ? 'revise' : 'submit');
        }
        return void openRunner('knowledge');
    };

    const primary = (() => {
        // Slice 6: the server claim state owns the single primary CTA.
        // ready/expired → Claim; issued → View; revoked/unavailable →
        // no action. Stage CTAs never compete with the claim CTA.
        const credentialState = journey.credential?.state ?? null;
        if (credentialState === 'ready_to_issue' || credentialState === 'expired') {
            if (claimError === CLAIM_NETWORK_COPY) {
                return { label: 'Try again', onPress: startClaim };
            }
            if (claimSubmitting) {
                return { label: CLAIMING_BUTTON_COPY, onPress: () => {} };
            }
            return { label: CLAIM_BUTTON_COPY, onPress: startClaim };
        }
        if (credentialState === 'issued') {
            return { label: VIEW_CREDENTIAL_BUTTON_COPY, onPress: viewCredential };
        }
        if (prepareError === 'network') {
            return { label: 'Try again', onPress: retryCurrent };
        }
        const action = journey.nextAction;
        if (action.kind === 'verify_skill') {
            return {
                label: `Verify ${action.skillName}`,
                onPress: () => onVerifySkill({ skillKey: action.skillKey, skillName: action.skillName }),
            };
        }
        if (action.kind === 'continue_learning') {
            return { label: 'Continue learning', onPress: onContinueLearning };
        }
        const mapped = primaryForAction(action, { verify: name => `Verify ${name}` });
        if (!mapped) return null;
        if (mapped.kind === 'start_practical' || mapped.kind === 'continue_practical') {
            return { label: mapped.label, onPress: startPractical };
        }
        if (mapped.kind === 'start_final' || mapped.kind === 'continue_final') {
            return { label: mapped.label, onPress: startFinal };
        }
        if (mapped.kind === 'submit_project') {
            return { label: mapped.label, onPress: () => openSheet('submit') };
        }
        if (mapped.kind === 'revise_project') {
            return { label: mapped.label, onPress: () => openSheet('revise') };
        }
        return { label: mapped.label, onPress: startKnowledge };
    })();

    const knowledge = unavailable
        ? { ...journey.knowledge, state: 'temporarily_unavailable' as const }
        : journey.knowledge;
    const practical = unavailable
        ? { ...journey.practical, state: 'temporarily_unavailable' as const }
        : journey.practical;
    const finalAssessment = unavailable
        ? { ...journey.finalAssessment, state: 'temporarily_unavailable' as const }
        : journey.finalAssessment;

    const alert = notice ?? (prepareError === 'network'
        ? (journey.nextAction.kind === 'start_final' || journey.nextAction.kind === 'continue_final'
            ? 'Final Assessment needs an internet connection.'
            : journey.nextAction.kind === 'start_practical' || journey.nextAction.kind === 'continue_practical'
                ? 'Practical check needs an internet connection.'
                : 'Knowledge check needs an internet connection.')
        : null);

    return (
        <View>
            <CredentialJourneyBlock
                journey={{ ...journey, knowledge, practical, finalAssessment }}
                title={programTitle}
                primary={starting ? null : primary}
                showPracticalTeaser={journey.knowledge.state === 'passed' && journey.practical.state !== 'passed'}
                alert={alert}
                credential={journey.credential}
                claimError={claimError}
            />
            <CredentialChallengeRunner
                visible={runnerOpen}
                mode={runnerMode}
                programSlug={programSlug ?? ''}
                programTitle={programTitle}
                onClose={() => setRunnerOpen(false)}
                onComplete={handleRunnerComplete}
                onVerifySkill={onVerifySkill}
                skillNames={skillNames}
            />
            <CredentialProjectSubmission
                visible={sheetOpen}
                headline={projectMeta.label}
                description={projectMeta.description}
                submitLabel={sheetMode === 'revise' ? 'Submit revision' : 'Submit Project'}
                onSubmit={handleSheetSubmit}
                onClose={() => setSheetOpen(false)}
            />
            <Modal visible={holderSheetOpen} transparent animationType="fade" onRequestClose={() => setHolderSheetOpen(false)}>
                <View style={sheetStyles.backdrop}>
                    <View style={[sheetStyles.card, { backgroundColor: colors.surfaceLight }]}>
                        <Text style={[sheetStyles.title, { color: colors.text }]}>Name for your credential</Text>
                        <Text style={[sheetStyles.body, { color: colors.textSecondary }]}>
                            This display name appears on your credential. It is not identity verification.
                        </Text>
                        <TextInput
                            style={[sheetStyles.input, { color: colors.text }]}
                            placeholder="Your name"
                            value={holderDraft}
                            onChangeText={setHolderDraft}
                            autoCapitalize="words"
                            returnKeyType="done"
                            onSubmitEditing={confirmHolderName}
                        />
                        <TouchableOpacity
                            style={[sheetStyles.confirm, { backgroundColor: colors.buttonPrimary, opacity: holderDraft.trim() && !claimSubmitting ? 1 : 0.5 }]}
                            onPress={confirmHolderName}
                            disabled={!holderDraft.trim() || claimSubmitting}
                            activeOpacity={0.7}
                        >
                            <Text style={[sheetStyles.confirmText, { color: colors.white }]}>
                                {claimSubmitting ? CLAIMING_BUTTON_COPY : CLAIM_BUTTON_COPY}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setHolderSheetOpen(false)} activeOpacity={0.7}>
                            <Text style={[sheetStyles.cancel, { color: colors.textSecondary }]}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const sheetStyles = {
    backdrop: {
        flex: 1,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        backgroundColor: 'rgba(0,0,0,0.4)',
        padding: scale(24),
    },
    card: {
        borderRadius: scale(16),
        padding: scale(20),
        width: '100%' as const,
    },
    title: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(18),
        marginBottom: scale(8),
    },
    body: {
        fontFamily: fonts.heading.regular,
        fontSize: scale(14),
        marginBottom: scale(12),
    },
    input: {
        fontFamily: fonts.heading.regular,
        fontSize: scale(16),
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: scale(10),
        paddingHorizontal: scale(12),
        paddingVertical: scale(10),
        marginBottom: scale(12),
    },
    confirm: {
        borderRadius: scale(12),
        paddingVertical: scale(12),
        alignItems: 'center' as const,
        marginBottom: scale(8),
    },
    confirmText: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(16),
    },
    cancel: {
        fontFamily: fonts.heading.regular,
        fontSize: scale(14),
        textAlign: 'center' as const,
        paddingVertical: scale(6),
    },
};

export default CredentialJourneySection;
