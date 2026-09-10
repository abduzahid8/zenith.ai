import { getLessonByDay } from '../../data/lessonContent';
import { buildSessionBlueprint } from './sessionBlueprint';
import type { SessionKind } from './sessionBlueprint';
import type { ProgressionScope } from './sessionIntent';

/**
 * Session capabilities — ONE truth shared by recommendation and runtime.
 * Derived from the SAME buildSessionBlueprint the session actually runs,
 * plus real lesson content presence. No duplicated minute thresholds.
 */
export interface SessionCapabilities {
    canRecall: boolean;
    canApply: boolean;
    canValidate: boolean;
    canCompleteDailyTask: boolean;
    canAdvanceCurriculum: boolean;
}

export interface CapabilityInput {
    minutes: number;
    kind: SessionKind;
    scope: ProgressionScope;
    /** Real lesson content presence (unknown when the lesson is generated). */
    hasTests?: boolean;
    hasDoTask?: boolean;
}

export function sessionCapabilities(input: CapabilityInput): SessionCapabilities {
    const blueprint = buildSessionBlueprint({
        minutes: input.minutes,
        hasTests: input.hasTests ?? false,
        kind: input.kind === 'certificate_review' ? 'certificate_review' : undefined,
        reviewOnly: input.kind !== 'structured',
    });
    const phases = blueprint.phases;
    const structural =
        input.scope === 'curriculum' &&
        input.kind === 'structured' &&
        blueprint.countsAsFullCompletion === true;
    return {
        canRecall: phases.includes('recall'),
        canApply: phases.includes('apply') && (input.hasDoTask ?? true),
        canValidate: phases.includes('validate') && (input.hasTests ?? false),
        canCompleteDailyTask: structural,
        canAdvanceCurriculum: structural,
    };
}

export interface LessonCapability {
    known: boolean;
    hasTests: boolean;
    hasDoTask: boolean;
}

/**
 * Real content presence for a static bank lesson. Generated days (8+) are
 * unknown — callers must decide explicitly (assume full vs require known).
 */
export function lessonCapabilities(hobbyId: string, day: number): LessonCapability {
    try {
        const lesson: any = getLessonByDay(hobbyId as any, day);
        if (!lesson) return { known: false, hasTests: false, hasDoTask: false };
        return {
            known: true,
            hasTests: Array.isArray(lesson.tests) && lesson.tests.length > 0,
            hasDoTask: !!lesson.do,
        };
    } catch {
        return { known: false, hasTests: false, hasDoTask: false };
    }
}
