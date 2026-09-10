import type { SessionKind } from './sessionBlueprint';

/**
 * Session execution contract — what to build, what may mutate.
 *
 * strategy          = what learning experience to build
 * progressionScope  = what the session is allowed to mutate
 * kind              = evidence/session behavior (existing SessionKind)
 */

export type LearningStrategy =
    | 'continue_curriculum'
    | 'repair_recall'
    | 'practice_application'
    | 'prove_skill'
    | 'review_skill';

export type ProgressionScope = 'curriculum' | 'targeted' | 'none';

export interface SessionIntent {
    strategy: LearningStrategy;
    progressionScope: ProgressionScope;
    kind: SessionKind;
    targetDay?: number;
    targetSkillKey?: string;
    taskId?: string | null;
    minutes: number;
    reasonCode?: string;
}

export function defaultScopeForKind(kind: SessionKind): ProgressionScope {
    return kind === 'structured' ? 'curriculum' : 'none';
}

export interface NormalizedIntent {
    kind: SessionKind;
    scope: ProgressionScope;
    strategy: LearningStrategy;
}

/**
 * Canonicalize arbitrary kind/scope/strategy combinations (deep links) into
 * safe semantics. The finalizer enforces progression independently — this
 * only guarantees the session is built with a coherent contract:
 * - discovery is always weightless review of nothing in particular
 * - prove_skill is always structured + targeted (never frontier/task)
 * - review bites can never carry a curriculum scope
 */
export function normalizeSessionIntent(input: {
    kind: SessionKind;
    scope: ProgressionScope;
    strategy: LearningStrategy;
}): NormalizedIntent {
    const { kind, scope, strategy } = input;
    if (kind === 'discovery') {
        return { kind: 'discovery', scope: 'none', strategy: 'continue_curriculum' };
    }
    if (strategy === 'prove_skill') {
        return { kind: 'structured', scope: 'targeted', strategy: 'prove_skill' };
    }
    if (kind === 'certificate_review') {
        const safe =
            strategy === 'repair_recall' ||
            strategy === 'practice_application' ||
            strategy === 'review_skill'
                ? strategy
                : 'review_skill';
        return { kind: 'certificate_review', scope: 'none', strategy: safe };
    }
    if (kind === 'structured') {
        return {
            kind: 'structured',
            scope: scope === 'targeted' ? 'targeted' : 'curriculum',
            strategy,
        };
    }
    return { kind, scope, strategy };
}
