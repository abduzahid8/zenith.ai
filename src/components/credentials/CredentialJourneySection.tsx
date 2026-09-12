import React, { useState } from 'react';
import { View } from 'react-native';
import type { LearningRecommendation } from '../../domain/sessions/nextBestAction';
import { ensureEnrollment, isContentUnavailable } from '../../services/trustApi';
import { useCredentialJourney } from '../../hooks/useCredentialJourney';
import type { KnowledgeSubmitResult } from './CredentialChallengeRunner';
import { CredentialChallengeRunner } from './CredentialChallengeRunner';
import { CredentialJourneyBlock, primaryForAction } from './CredentialJourneyBlock';

/**
 * Slice 2 — credential journey section (container). Owns the journey read
 * model, the runner sheet, and server-truth refresh. Rendered inside the
 * Coach experience; returns null unless the program is officially
 * available. Knowledge is the only runnable mode in this slice.
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
    const [starting, setStarting] = useState(false);
    const [unavailable, setUnavailable] = useState(false);
    const [prepareError, setPrepareError] = useState<null | 'network'>(null);

    if (!journey || !journey.visible) return null;

    const startKnowledge = async () => {
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

    const handleRunnerComplete = (_result: KnowledgeSubmitResult) => {
        // Re-read server truth (attempts + component snapshot). Nothing is
        // set manually: the block recomputes from the refreshed model.
        refresh();
    };

    const primary = (() => {
        if (prepareError === 'network') {
            return { label: 'Try again', onPress: () => void startKnowledge() };
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
        return { label: mapped.label, onPress: () => void startKnowledge() };
    })();

    const knowledge = unavailable
        ? { ...journey.knowledge, state: 'temporarily_unavailable' as const }
        : journey.knowledge;

    return (
        <View>
            <CredentialJourneyBlock
                journey={{ ...journey, knowledge }}
                title={programTitle}
                primary={starting ? null : primary}
                showPracticalTeaser={journey.knowledge.state === 'passed'}
                alert={prepareError === 'network' ? 'Knowledge check needs an internet connection.' : null}
            />
            <CredentialChallengeRunner
                visible={runnerOpen}
                mode="knowledge"
                programSlug={programSlug ?? ''}
                programTitle={programTitle}
                onClose={() => setRunnerOpen(false)}
                onComplete={handleRunnerComplete}
            />
        </View>
    );
};

export default CredentialJourneySection;
