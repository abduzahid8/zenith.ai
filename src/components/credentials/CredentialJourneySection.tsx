import React, { useState } from 'react';
import { View } from 'react-native';
import type { LearningRecommendation } from '../../domain/sessions/nextBestAction';
import { ensureEnrollment, isContentUnavailable } from '../../services/trustApi';
import { useCredentialJourney } from '../../hooks/useCredentialJourney';
import type { KnowledgeSubmitResult, RunnerMode } from './CredentialChallengeRunner';
import { CredentialChallengeRunner } from './CredentialChallengeRunner';
import { CredentialJourneyBlock, primaryForAction } from './CredentialJourneyBlock';

/**
 * Slice 3 — credential journey section (container). Owns the journey read
 * model, the runner sheet (knowledge + practical), and server-truth
 * refresh. Rendered inside the Coach experience; returns null unless the
 * program is officially available. One primary CTA only.
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

    if (!journey || !journey.visible) return null;

    const openRunner = async (mode: RunnerMode) => {
        if (!programSlug || starting) return;
        setStarting(true);
        setUnavailable(false);
        setPrepareError(null);
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

    const handleRunnerComplete = (_result: KnowledgeSubmitResult) => {
        // Re-read server truth (attempts + component snapshot). Nothing is
        // set manually: the block recomputes from the refreshed model.
        refresh();
    };

    const retryCurrent = () => {
        const action = journey.nextAction;
        if (action.kind === 'start_practical' || action.kind === 'continue_practical') {
            return void openRunner('practical');
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
        return { label: mapped.label, onPress: startKnowledge };
    })();

    const knowledge = unavailable
        ? { ...journey.knowledge, state: 'temporarily_unavailable' as const }
        : journey.knowledge;
    const practical = unavailable
        ? { ...journey.practical, state: 'temporarily_unavailable' as const }
        : journey.practical;

    const alert = prepareError === 'network'
        ? (journey.nextAction.kind === 'start_practical' || journey.nextAction.kind === 'continue_practical'
            ? 'Practical check needs an internet connection.'
            : 'Knowledge check needs an internet connection.')
        : null;

    return (
        <View>
            <CredentialJourneyBlock
                journey={{ ...journey, knowledge, practical }}
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
            />
        </View>
    );
};

export default CredentialJourneySection;
