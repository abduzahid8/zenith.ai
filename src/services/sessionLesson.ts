import type { HobbyId, LessonContent, TaskStep } from '../data/lessonContent';
import { buildDiscoveryLesson } from '../domain/sessions/discoveryBank';
import { isValidTestStep } from '../domain/sessions/sessionCapabilities';
import type { LessonCapabilities, LessonSource, ValidationProvenance } from './lessonCapabilityRegistry';
import { recordLessonCapabilities } from './lessonCapabilityRegistry';

/**
 * Shared session lesson loader (extracted from useTimer, behavior-identical).
 *
 * Resolution order:
 * 1. discovery topic -> micro lesson (review-only, weightless)
 * 2. static bank lesson for day <= 7
 * 3. generated lesson for day 8+ (or static miss)
 * 4. generator fallback lesson (never throws)
 *
 * Chess lessons get thematic puzzles injected into the do step.
 * Both the legacy timer screen and the swipe session use this — one loader,
 * never a second curriculum.
 */
export interface SessionLessonRequest {
    hobby: HobbyId;
    day: number;
    artifacts: Array<{ lessonId: string; hobbyId: string }>;
    discoveryId?: string | null;
    discoveryLanguage?: 'ru' | 'en';
}

export interface LoadedSessionLesson {
    lesson: LessonContent | null;
    source: LessonSource | null;
    capabilities: LessonCapabilities;
    validationProvenance: ValidationProvenance;
}

const EMPTY_CAPABILITIES: LessonCapabilities = {
    hasConcept: false,
    hasRecallSource: false,
    hasApplication: false,
    hasValidation: false,
};

function nonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}

function isValidDoTask(task: TaskStep | null | undefined): boolean {
    if (!task || typeof task !== 'object') return false;
    if (!nonEmptyString(task.prompt)) return false;
    return (
        task.type === 'multiple_choice' ||
        task.type === 'fill_blank' ||
        task.type === 'translate' ||
        task.type === 'free_text' ||
        task.type === 'code' ||
        task.type === 'chess_puzzle'
    );
}

/**
 * Normalize a loaded lesson: drop malformed tests (never fabricate valid
 * ones), derive factual capabilities + validation provenance from the real
 * normalized shape — never from day number or hobby alone.
 */
export function normalizeLessonContent(
    lesson: LessonContent | null | undefined,
    source: LessonSource,
): { lesson: LessonContent | null; capabilities: LessonCapabilities; validationProvenance: ValidationProvenance } {
    if (!lesson) {
        return { lesson: null, capabilities: { ...EMPTY_CAPABILITIES }, validationProvenance: 'none' };
    }
    const learnValid =
        !!lesson.learn && nonEmptyString(lesson.learn.title) && nonEmptyString(lesson.learn.body);
    const keywords = Array.isArray(lesson.learn?.keywords) ? lesson.learn.keywords.filter(nonEmptyString) : [];
    const validTests = Array.isArray(lesson.tests) ? lesson.tests.filter(isValidTestStep) : [];
    const doValid = isValidDoTask(lesson.do);
    // Authoritative contract: capabilities describe EXACTLY what the runtime
    // can render. Malformed parts are stripped (never fabricated over):
    // invalid do/tests disappear from the lesson object itself.
    const normalized: LessonContent = {
        ...lesson,
        learn: learnValid
            ? { ...lesson.learn, keywords }
            : { title: '', body: '', keywords: [] },
        do: doValid ? lesson.do : undefined,
        tests: validTests.length > 0 ? validTests : undefined,
    };
    const capabilities: LessonCapabilities = {
        hasConcept: learnValid,
        // The runtime falls back to a title recap from valid learn content,
        // so valid learn alone is a truthful recall source (policy §8).
        hasRecallSource: learnValid || keywords.length > 0 || validTests.length > 0,
        hasApplication: doValid,
        hasValidation: validTests.length > 0,
    };
    const validationProvenance: ValidationProvenance =
        !capabilities.hasValidation
            ? 'none'
            : source === 'static_bank'
              ? 'static_bank'
              : // Structurally valid generated tests are usable (known
                // capability) but untrusted until server validation arrives.
                'generated_unverified';
    return { lesson: normalized, capabilities, validationProvenance };
}

export async function loadSessionLesson(req: SessionLessonRequest): Promise<LessonContent | null> {
    const result = await loadSessionLessonResult(req);
    return result.lesson;
}

/**
 * Full loader result with factual source + capabilities. Records normalized
 * capabilities so future recommendations can know real generated-lesson
 * capabilities without reloading sessions.
 */
export async function loadSessionLessonResult(req: SessionLessonRequest): Promise<LoadedSessionLesson> {
    const { hobby, discoveryId } = req;
    const day = req.day || 1;
    const finish = (
        lesson: LessonContent | null | undefined,
        source: LessonSource,
    ): LoadedSessionLesson => {
        const normalized = normalizeLessonContent(lesson ?? null, source);
        if (normalized.lesson) {
            try {
                recordLessonCapabilities({
                    hobbyId: hobby,
                    day,
                    lessonId: normalized.lesson.id,
                    hasApplication: normalized.capabilities.hasApplication,
                    hasRecallSource: normalized.capabilities.hasRecallSource,
                    hasConcept: normalized.capabilities.hasConcept,
                    hasValidation: normalized.capabilities.hasValidation,
                    source,
                    validationProvenance: normalized.validationProvenance,
                });
            } catch {}
        }
        return {
            lesson: normalized.lesson,
            source: normalized.lesson ? source : null,
            capabilities: normalized.capabilities,
            validationProvenance: normalized.validationProvenance,
        };
    };
    try {
        if (discoveryId) {
            const micro = buildDiscoveryLesson(discoveryId, hobby, req.discoveryLanguage ?? 'ru');
            if (micro) return finish(micro, 'discovery');
        }

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { getLessonByDay } = require('../data/lessonContent');
        let lesson: LessonContent | undefined;
        let source: LessonSource = 'generated';
        if (day <= 7) {
            lesson = getLessonByDay(hobby, day);
            if (lesson) source = 'static_bank';
        }

        if (!lesson) {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const { lessonGeneratorService } = require('../services/lessonGeneratorService');
            const completedTopics = lessonGeneratorService.getCompletedTopics(req.artifacts, hobby);
            // Explicit source contract: AI success -> 'generated',
            // AI/parse failure -> hand-built 'fallback'. Never inferred.
            const fresh = await lessonGeneratorService.generateLessonWithSource(hobby, day, completedTopics);
            lesson = fresh.lesson;
            source = fresh.source;
        }

        if (lesson && hobby === 'chess') {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const { getThematicPuzzles } = require('../data/chessPuzzlesBank');
            const puzzles = getThematicPuzzles(day);
            if (lesson.do && Array.isArray(puzzles) && puzzles.length > 0) {
                lesson.do.type = 'chess_puzzle';
                lesson.do.puzzleFen = puzzles[0].fen;
                lesson.do.puzzleMoves = puzzles[0].puzzleMoves;
                lesson.do.puzzles = puzzles.map((p: any) => ({
                    id: p.id,
                    fen: p.fen,
                    moves: p.puzzleMoves,
                    solution: p.solution,
                    sideToMove: p.sideToMove,
                    successExplanation: p.successExplanation,
                    failureExplanation: p.failureExplanation,
                    prompt: p.prompt,
                    hints: p.hints || ['Think about your best move!'],
                    metadata: p.metadata,
                    day: p.day,
                    topic: p.topic,
                    dayKey: p.dayKey,
                }));
            }
        }

        // Fix lesson hobby to match actual selected hobby
        // (LESSON_BANK aliases like python→codingLessons return wrong hobby)
        if (lesson && lesson.hobby !== hobby) {
            lesson = { ...lesson, hobby };
        }

        return finish(lesson || null, source);
    } catch (err) {
        console.error('[sessionLesson] Error loading lesson:', err);
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const { lessonGeneratorService } = require('../services/lessonGeneratorService');
            return finish(lessonGeneratorService.getFallbackLesson(hobby, req.day || 1), 'fallback');
        } catch {
            return finish(null, 'fallback');
        }
    }
}
