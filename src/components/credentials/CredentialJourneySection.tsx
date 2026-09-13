import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import type { LearningRecommendation } from '../../domain/sessions/nextBestAction';
import { getProjectRequirement } from '../../domain/credentials/catalog';
import { ensureEnrollment, isContentUnavailable, submitProject } from '../../services/trustApi';
import { useCredentialJourney } from '../../hooks/useCredentialJourney';
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
                showPracticalTeaser={journey.knowledge.state === 'passed' && journey.practical.state === 'locked'}
                alert={alert}
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
        </View>
    );
};

export default CredentialJourneySection;
