import type { SessionBlueprint } from './sessionBlueprint';
import type { SessionKind } from './sessionBlueprint';
import { canCompleteStructuredTask } from './outcomePolicy';
import type { SessionEvaluation } from './outcomePolicy';

/**
 * Canonical progression policy — ONE place deciding what a finished
 * session may change. No scattered ifs across hooks/components.
 *
 * The five meanings of "completed" stay independent:
 * - participation (the user did a session)       -> countSession
 * - DailyPlan task completed                     -> completeDailyTask
 * - curriculum frontier may advance              -> advanceCurriculum
 * - Goal receives progress/difficulty signal     -> goalSignal
 *
 * Truth table (kind x evaluation, blueprint gates applied):
 * - structured + full-completion + pass
 *     task (if target), advance, count, success signal
 * - structured + full-completion + partial, non-strict
 *     task (if target), advance, count, struggled signal
 * - structured + full-completion + partial, strict (requiresValidation)
 *     NO task, NO advance; count + struggled signal + partial evidence
 * - structured micro (countsAsFullCompletion=false), any outcome
 *     NO task, NO advance (participation still counts when rewarding)
 * - certificate_review pass/partial
 *     weak evidence + session count; NO task, NO advance
 * - discovery / fail / unknown / skipped / unanswered
 *     nothing except the persisted session record itself
 */

export type GoalSignal = 'success' | 'struggled' | 'failure' | null;

export interface ProgressionDecision {
    completeDailyTask: boolean;
    advanceCurriculum: boolean;
    countSession: boolean;
    goalSignal: GoalSignal;
}

export interface ProgressionInput {
    kind: SessionKind;
    evaluation: SessionEvaluation;
    blueprint: Pick<SessionBlueprint, 'countsAsFullCompletion' | 'requiresValidation'>;
    hasTargetTask: boolean;
}

const NOTHING: ProgressionDecision = {
    completeDailyTask: false,
    advanceCurriculum: false,
    countSession: false,
    goalSignal: null,
};

export function buildProgressionDecision(input: ProgressionInput): ProgressionDecision {
    const { kind, evaluation, blueprint, hasTargetTask } = input;
    // Discovery is weightless by construction (and can never evaluate to
    // pass/partial — it has no required cards), but force nothing anyway.
    if (kind === 'discovery') return { ...NOTHING };
    if (evaluation === 'non_rewarding') return { ...NOTHING };
    if (evaluation === 'fail') {
        // Failure signal only: difficulty adapts, nothing else moves.
        return { ...NOTHING, goalSignal: 'failure' };
    }

    // pass | partial from here.
    const fullCompletion = blueprint.countsAsFullCompletion === true;
    // Strict validation (requiresValidation) is satisfied by PASS only:
    // a strict PARTIAL moves nothing on the frontier or the DailyPlan.
    const strictOk =
        evaluation === 'pass' || (evaluation === 'partial' && blueprint.requiresValidation === false);
    const canComplete =
        kind === 'structured' &&
        fullCompletion &&
        strictOk &&
        canCompleteStructuredTask(evaluation, blueprint) &&
        hasTargetTask;
    // The frontier advances only for real structured learning that the
    // blueprint itself marks as full completion (never micro/review).
    const advance = kind === 'structured' && fullCompletion && strictOk;
    // Participation counts for rewarding structured/review sessions
    // (discovery never has required cards, so it cannot be rewarding).
    const count = kind === 'structured' || kind === 'certificate_review';

    if (evaluation === 'pass') {
        return {
            completeDailyTask: canComplete,
            advanceCurriculum: advance,
            countSession: count,
            goalSignal: 'success',
        };
    }
    return {
        completeDailyTask: canComplete,
        advanceCurriculum: advance,
        countSession: count,
        goalSignal: 'struggled',
    };
}
