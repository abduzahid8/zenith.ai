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
