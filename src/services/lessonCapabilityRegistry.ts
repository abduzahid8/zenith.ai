/**
 * Lightweight generated-lesson capability registry (§14).
 * Records normalized capabilities of already-loaded lessons so future
 * recommendations can know real capabilities without loading sessions.
 * In-memory only (the lesson cache itself persists in AsyncStorage);
 * small, deterministic, keyed by hobby+day. Test-only reset included.
 */

export type LessonSource = 'static_bank' | 'generated' | 'fallback' | 'discovery';

export type ValidationProvenance = 'static_bank' | 'generated_validated' | 'generated_unverified' | 'none';

export interface LessonCapabilities {
    hasConcept: boolean;
    hasRecallSource: boolean;
    hasApplication: boolean;
    hasValidation: boolean;
}

export interface LessonCapabilityRecord extends LessonCapabilities {
    hobbyId: string;
    day: number;
    lessonId: string;
    source: LessonSource;
    validationProvenance: ValidationProvenance;
}

const registry = new Map<string, LessonCapabilityRecord>();

const keyOf = (hobbyId: string, day: number): string => `${hobbyId}:d${day}`;

export function recordLessonCapabilities(record: LessonCapabilityRecord): void {
    registry.set(keyOf(record.hobbyId, record.day), record);
}

export function getLessonCapabilities(hobbyId: string, day: number): LessonCapabilityRecord | null {
    return registry.get(keyOf(hobbyId, day)) ?? null;
}

/** Test/dev only. Never called from product UI. */
export function __resetLessonCapabilitiesForTests(): void {
    registry.clear();
}
