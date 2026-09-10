import type { SessionBlueprint, StepOutcome } from './sessionBlueprint';
import type { LearningCard } from './learningCards';

/**
 * Central outcome policy — the ONLY place outcome semantics live.
 *
 * Evidence values (mastery weight of one evaluated interaction):
 *   pass    = 1.0  positive evidence, may qualify for progression
 *   partial = 0.5  weaker evidence, NEVER equivalent to a verified pass
 *   fail    = 0.0  zero positive mastery evidence
 *   unknown = 0.0  zero positive mastery evidence (offline/free-form)
 *   skipped = 0.0  zero positive mastery evidence (explicitly bypassed)
 *
 * Verified = PASS only. Components must not scatter these constants.
 */

export type MasteryOutcome = 'pass' | 'partial' | 'fail' | 'unknown' | 'skipped';

const EVIDENCE_VALUE: Record<MasteryOutcome, number> = {
    pass: 1.0,
    partial: 0.5,
    fail: 0.0,
    unknown: 0.0,
    skipped: 0.0,
};

/** Mastery weight of an outcome. Unknown/skipped/fail contribute nothing. */
export function evidenceValueOf(outcome: StepOutcome | MasteryOutcome | undefined): number {
    if (!outcome) return 0;
    return EVIDENCE_VALUE[outcome as MasteryOutcome] ?? 0;
}

/** Verified answer = PASS only. Partial is reported separately, never as verified. */
export function isVerifiedOutcome(outcome: StepOutcome | MasteryOutcome | undefined): boolean {
    return outcome === 'pass';
}

/** Any positive mastery evidence (pass or partial). */
export function hasPositiveEvidence(outcome: StepOutcome | MasteryOutcome | undefined): boolean {
    return evidenceValueOf(outcome) > 0;
}

/**
 * Task completion policy — separates participation from completion.
 * pass    -> eligible
 * partial -> eligible only for non-strict structured learning
 *            (blueprint.requiresValidation === false). NEVER full mastery.
 * fail / unknown / skipped -> never eligible.
 */
export function canCompleteStructuredTask(
    outcome: StepOutcome | MasteryOutcome | undefined,
    blueprint: Pick<SessionBlueprint, 'requiresValidation'> | null,
): boolean {
    if (outcome === 'pass') return true;
    if (outcome === 'partial') return !!blueprint && blueprint.requiresValidation === false;
    return false;
}

export type SessionEvaluation = 'pass' | 'partial' | 'fail' | 'non_rewarding';

function toMastery(outcome: StepOutcome | undefined): MasteryOutcome {
    if (outcome === 'pass' || outcome === 'partial' || outcome === 'fail' || outcome === 'unknown') {
        return outcome;
    }
    return 'unknown';
}

/**
 * Required-card-aware session evaluation (replaces "any card passed".
 * Only required interactive cards (recall/apply/challenge) determine proof;
 * passive concept/example/feedback cards never do.
 *
 * - every required card PASS                       -> 'pass'
 * - required cards all PASS/PARTIAL, >=1 PARTIAL    -> 'partial'
 * - any required card final FAIL                   -> 'fail'
 * - required card unanswered/UNKNOWN/SKIPPED        -> 'non_rewarding'
 * - no required cards at all                       -> 'non_rewarding'
 */
export function evaluateSession(
    cards: LearningCard[],
    status: Record<string, { completed: boolean; outcome?: StepOutcome; attempts: number }>,
): SessionEvaluation {
    const required = cards.filter(
        c => c.required && (c.type === 'recall' || c.type === 'apply' || c.type === 'challenge'),
    );
    if (required.length === 0) return 'non_rewarding';
    let sawPartial = false;
    for (const card of required) {
        const outcome = toMastery(status[card.id]?.outcome);
        if (outcome === 'fail') return 'fail';
        if (outcome === 'unknown' || outcome === 'skipped') return 'non_rewarding';
        if (outcome === 'partial') sawPartial = true;
    }
    return sawPartial ? 'partial' : 'pass';
}

/** Session evaluations that may drive ANY progression (task/day/sessions). */
export function isRewardingEvaluation(evaluation: SessionEvaluation): boolean {
    return evaluation === 'pass' || evaluation === 'partial';
}
