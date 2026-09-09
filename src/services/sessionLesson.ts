import type { HobbyId, LessonContent } from '../data/lessonContent';
import { buildDiscoveryLesson } from '../domain/sessions/discoveryBank';

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

export async function loadSessionLesson(req: SessionLessonRequest): Promise<LessonContent | null> {
    const { hobby, discoveryId } = req;
    try {
        if (discoveryId) {
            const micro = buildDiscoveryLesson(discoveryId, hobby, req.discoveryLanguage ?? 'ru');
            if (micro) return micro;
        }

        const day = req.day || 1;
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { getLessonByDay } = require('../data/lessonContent');
        let lesson: LessonContent | undefined;
        if (day <= 7) {
            lesson = getLessonByDay(hobby, day);
        }

        if (!lesson) {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const { lessonGeneratorService } = require('../services/lessonGeneratorService');
            const completedTopics = lessonGeneratorService.getCompletedTopics(req.artifacts, hobby);
            lesson = await lessonGeneratorService.generateLesson(hobby, day, completedTopics);
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

        return lesson || null;
    } catch (err) {
        console.error('[sessionLesson] Error loading lesson:', err);
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const { lessonGeneratorService } = require('../services/lessonGeneratorService');
            return lessonGeneratorService.getFallbackLesson(hobby, req.day || 1);
        } catch {
            return null;
        }
    }
}
