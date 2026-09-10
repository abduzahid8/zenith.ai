import { getLessonByDay } from '../../data/lessonContent';
import type { TaskStep } from '../../data/lessonContent';
import type { ValidationProvenance } from '../../services/lessonCapabilityRegistry';
import { getLessonCapabilities } from '../../services/lessonCapabilityRegistry';
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

function nonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Structural validity for one test step. Shared by the loader
 * (normalization) and recommendation capability — both sides agree
 * byte-for-byte on what counts as usable validation. Never content-judges.
 */
export function isValidTestStep(task: TaskStep | null | undefined): boolean {
    if (!task || typeof task !== 'object') return false;
    if (!nonEmptyString(task.prompt)) return false;
    switch (task.type) {
        case 'multiple_choice':
            return (
                Array.isArray(task.options) &&
                task.options.length >= 2 &&
                Number.isInteger(task.correctOptionIndex) &&
                (task.correctOptionIndex as number) >= 0 &&
                (task.correctOptionIndex as number) < task.options.length
            );
        case 'fill_blank':
            return (
                typeof task.blanksText === 'string' &&
                task.blanksText.includes('___') &&
                Array.isArray(task.wordPool) &&
                task.wordPool.length > 0 &&
                Array.isArray(task.correctOrder) &&
                task.correctOrder.length > 0
            );
        case 'translate':
        case 'free_text':
        case 'code':
            return true;
        case 'chess_puzzle':
            return (
                (nonEmptyString(task.puzzleFen) && Array.isArray(task.puzzleMoves) && task.puzzleMoves.length > 0) ||
                (Array.isArray(task.puzzles) && task.puzzles.length > 0)
            );
        default:
            return false;
    }
}

export interface LessonCapability {
    known: boolean;
    hasTests: boolean;
    hasDoTask: boolean;
}

/**
 * Real content presence for a static bank lesson, validated with the SAME
 * predicate the loader normalizes with. Generated days (8+) are unknown —
 * callers must decide explicitly (assume full vs require known).
 */
export function lessonCapabilities(hobbyId: string, day: number): LessonCapability {
    try {
        const lesson: any = getLessonByDay(hobbyId as any, day);
        if (!lesson) return { known: false, hasTests: false, hasDoTask: false };
        const tests = Array.isArray(lesson.tests) ? lesson.tests.filter(isValidTestStep) : [];
        return {
            known: true,
            hasTests: tests.length > 0,
            hasDoTask: !!lesson.do,
        };
    } catch {
        return { known: false, hasTests: false, hasDoTask: false };
    }
}

export type ValidationCapabilityState = 'known-valid' | 'known-invalid' | 'unknown';

export interface ResolvedValidationCapability {
    state: ValidationCapabilityState;
    /**
     * Proof-worthy: static_bank (or future generated_validated) provenance.
     * generated_unverified/fallback content renders fine (known-valid) but
     * must never back a prove_skill recommendation.
     */
    trusted: boolean;
}

/**
 * Validation capability for a target day across every factual source:
 * static bank first, then the recorded capabilities of already-loaded
 * generated lessons. Anything else is UNKNOWN — and unknown never
 * qualifies for proof. Callers must downgrade (practice/review/continue).
 */
export function resolveValidationCapability(
    hobbyId: string,
    day: number,
    recorded?: { hasValidation: boolean; validationProvenance?: ValidationProvenance } | null,
    override?: ((hobbyId: string, day: number) => { known: boolean; hasTests: boolean } | null) | null,
): ResolvedValidationCapability {
    if (override) {
        const o = override(hobbyId, day);
        if (!o || !o.known) return { state: 'unknown', trusted: false };
        // Test doubles model curated content unless stated otherwise.
        return { state: o.hasTests ? 'known-valid' : 'known-invalid', trusted: o.hasTests };
    }
    const caps = lessonCapabilities(hobbyId, day);
    if (caps.known) {
        return { state: caps.hasTests ? 'known-valid' : 'known-invalid', trusted: caps.hasTests };
    }
    const seen = recorded ?? getLessonCapabilities(hobbyId, day);
    if (seen) {
        const trusted = seen.validationProvenance === 'static_bank' || seen.validationProvenance === 'generated_validated';
        return { state: seen.hasValidation ? 'known-valid' : 'known-invalid', trusted };
    }
    return { state: 'unknown', trusted: false };
}
