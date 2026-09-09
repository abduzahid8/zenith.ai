/**
 * Lesson coverage: every playable hobby (TASK_BANK) must resolve a lesson
 * offline. Regression test for "Урок не найден" on python/reading sessions:
 * those hobbies are selectable and recommended but had no generator maps,
 * fallback, or bank entries, so lesson loading collapsed to null.
 */
import { TASK_BANK } from '../data/taskBank';
import { getLessonByDay } from '../data/lessonContent';
import { lessonGeneratorService } from '../services/lessonGeneratorService';

jest.mock('../services/ai', () => ({
    aiService: { sendMessage: jest.fn() },
}));

import { aiService } from '../services/ai';

const mockSend = aiService.sendMessage as jest.Mock;
const bankHobbies = Object.keys(TASK_BANK);

describe('lesson coverage for playable hobbies', () => {
    beforeEach(() => {
        mockSend.mockReset();
    });

    it('covers every TASK_BANK hobby (incl. python + reading)', () => {
        expect(bankHobbies).toEqual(
            expect.arrayContaining(['python', 'reading', 'english', 'chess', 'chinese']),
        );
    });

    it('returns a valid offline fallback lesson for every playable hobby', () => {
        for (const hobby of bankHobbies) {
            const lesson = lessonGeneratorService.getFallbackLesson(hobby as any, 1);
            expect(lesson).toBeDefined();
            expect(lesson.learn?.title?.length).toBeGreaterThan(0);
            expect(lesson.learn?.body?.length).toBeGreaterThan(0);
            expect(lesson.do?.prompt?.length).toBeGreaterThan(0);
        }
    });

    it('never throws on static lookup for playable hobbies', () => {
        for (const hobby of bankHobbies) {
            expect(() => getLessonByDay(hobby as any, 1)).not.toThrow();
        }
    });

    it('generates + caches a python lesson when AI succeeds', async () => {
        mockSend.mockResolvedValue(
            JSON.stringify({
                learn: { title: 'Переменные', body: 'x = 5 создаёт переменную.', keywords: ['var'] },
                do: { type: 'code', prompt: 'Выведи 2+2.', hints: [] },
            }),
        );
        const first = await lessonGeneratorService.generateLesson('python', 11, []);
        expect(first.id).toBe('python_gen_d11');
        expect(first.learn.title).toBe('Переменные');
        expect(mockSend).toHaveBeenCalledTimes(1);

        const second = await lessonGeneratorService.generateLesson('python', 11, []);
        expect(second).toEqual(first);
        expect(mockSend).toHaveBeenCalledTimes(1); // served from cache
    });

    it('falls back when AI generation fails (offline)', async () => {
        mockSend.mockRejectedValue(new Error('offline'));
        const lesson = await lessonGeneratorService.generateLesson('reading', 12, []);
        expect(lesson).toBeDefined();
        expect(lesson.id).toContain('reading_fallback');
        expect(lesson.learn?.title?.length).toBeGreaterThan(0);
    });

    it('degrades unknown hobbies to a valid lesson without calling AI', async () => {
        const lesson = await lessonGeneratorService.generateLesson('klingon' as any, 13, []);
        expect(lesson).toBeDefined();
        expect(lesson.do?.prompt?.length).toBeGreaterThan(0);
        expect(mockSend).not.toHaveBeenCalled();
    });
});
