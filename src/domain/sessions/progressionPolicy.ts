import type { SessionBlueprint } from './sessionBlueprint';
import type { SessionKind } from './sessionBlueprint';
import { canCompleteStructuredTask } from './outcomePolicy';
import type { SessionEvaluation } from './outcomePolicy';
import type { ProgressionScope } from './sessionIntent';

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
    /**
     * curriculum: normal Home/Your-Day learning (may complete + advance).
     * targeted: revisit/prove encountered skill — structured evidence allowed,
     *   but never completes an unrelated task nor advances the frontier.
     * none: discovery/weak review — no task, no advance.
     */
    scope?: ProgressionScope;
}

const NOTHING: ProgressionDecision = {
    completeDailyTask: false,
    advanceCurriculum: false,
    countSession: false,
    goalSignal: null,
};

export function buildProgressionDecision(input: ProgressionInput): ProgressionDecision {
    const { kind, evaluation, blueprint, hasTargetTask } = input;
    const scope: ProgressionScope = input.scope ?? (kind === 'structured' ? 'curriculum' : 'none');
    // Discovery is fully weightless: no task, no advance, no count, no goal
    // signal — the persisted session record is the only trace.
    if (kind === 'discovery') return { ...NOTHING };
    if (scope === 'none') {
        if (evaluation === 'fail') return { ...NOTHING, goalSignal: 'failure' };
        if (evaluation === 'non_rewarding') return { ...NOTHING };
        // Weak formative participation only: count + truth-aware signal.
        return {
            ...NOTHING,
            countSession: true,
            goalSignal: evaluation === 'pass' ? 'success' : 'struggled',
        };
    }
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
    const structural = kind === 'structured' && fullCompletion && strictOk;
    const canComplete =
        structural &&
        scope === 'curriculum' &&
        canCompleteStructuredTask(evaluation, blueprint) &&
        hasTargetTask;
    // Targeted scope revisits encountered skill with structured evidence
    // but never moves the frontier or an unrelated task.
    const advance = structural && scope === 'curriculum';
    // Participation counts for rewarding structured/review sessions.
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
