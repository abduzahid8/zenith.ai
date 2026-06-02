// ─── Mock fetch (ai.ts uses fetch() directly, not supabase) ──
const mockFetch = jest.fn();

beforeAll(() => {
    jest.spyOn(global, 'fetch').mockImplementation(mockFetch);
});

afterAll(() => {
    (global.fetch as jest.Mock).mockRestore();
});

import { aiService } from '../services/ai';

// ─── Reset ───────────────────────────────────────────

beforeEach(() => {
    jest.clearAllMocks();
});

// ─── sendMessage ─────────────────────────────────────

describe('aiService.sendMessage', () => {
    it('returns AI response on success', async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ data: 'Привет! Как дела?' }),
        });

        const result = await aiService.sendMessage([
            { role: 'user', content: 'Привет' },
        ]);

        expect(result).toBe('Привет! Как дела?');
        expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining('workers.dev'),
            expect.objectContaining({
                method: 'POST',
                body: expect.stringContaining('sendMessage'),
            })
        );
    });

    it('returns fallback message on error', async () => {
        mockFetch.mockResolvedValue({
            ok: false,
            status: 500,
            json: async () => ({ error: 'Worker error' }),
        });

        const result = await aiService.sendMessage([
            { role: 'user', content: 'test' },
        ]);

        expect(result).toContain('Sorry');
    });
});

// ─── getHobbyRecommendations ─────────────────────────

describe('aiService.getHobbyRecommendations', () => {
    it('returns parsed array from AI', async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ data: JSON.stringify(['chess', 'drawing', 'coding']) }),
        });

        const result = await aiService.getHobbyRecommendations({ 1: 0, 2: 1 });

        expect(result).toEqual(['chess', 'drawing', 'coding']);
    });

    it('returns defaults on non-array response', async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ data: '"invalid"' }),
        });

        const result = await aiService.getHobbyRecommendations({});

        expect(result).toEqual(['chess', 'video_editing', 'drawing']);
    });

    it('returns defaults on error', async () => {
        mockFetch.mockResolvedValue({
            ok: false,
            status: 500,
            json: async () => ({ error: 'fail' }),
        });

        const result = await aiService.getHobbyRecommendations({});

        expect(result).toEqual(['chess', 'video_editing', 'drawing']);
    });
});

// ─── generateDailyTasks ──────────────────────────────

describe('aiService.generateDailyTasks', () => {
    it('returns parsed tasks', async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ data: JSON.stringify(['Learn basics', 'Practice 30 min']) }),
        });

        const result = await aiService.generateDailyTasks('chess', 1, 1);

        expect(result).toEqual(['Learn basics', 'Practice 30 min']);
    });

    it('returns defaults on failure', async () => {
        mockFetch.mockResolvedValue({
            ok: false,
            status: 500,
            json: async () => ({ error: 'x' }),
        });

        const result = await aiService.generateDailyTasks('chess', 1, 1);

        expect(result).toHaveLength(2);
    });
});

// ─── generateSubstituteContent ───────────────────────

describe('aiService.generateSubstituteContent', () => {
    it('returns parsed substitute content', async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                data: JSON.stringify({
                    type: 'challenge',
                    message: 'Try this instead!',
                    action: 'Start session',
                }),
            }),
        });

        const result = await aiService.generateSubstituteContent('instagram', 'chess');

        expect(result.type).toBe('challenge');
        expect(result.message).toBe('Try this instead!');
        expect(result.action).toBe('Start session');
    });

    it('fills missing fields with defaults', async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ data: JSON.stringify({}) }),
        });

        const result = await aiService.generateSubstituteContent('tiktok', 'drawing');

        expect(result.type).toBe('reminder');
        expect(result.message).toBeTruthy();
        expect(result.action).toBeTruthy();
    });

    it('returns full fallback on error', async () => {
        mockFetch.mockResolvedValue({
            ok: false,
            status: 500,
            json: async () => ({ error: 'x' }),
        });

        const result = await aiService.generateSubstituteContent('youtube', 'coding');

        expect(result.type).toBe('reminder');
    });
});

// ─── analyzeUserProfile ──────────────────────────────

describe('aiService.analyzeUserProfile', () => {
    it('returns parsed profile analysis', async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                data: JSON.stringify({
                    personality_type: 'визуал',
                    temperament: 'сангвиник',
                    motivation_style: 'hard',
                    strengths: ['Креативность'],
                    growth_areas: ['Дисциплина'],
                }),
            }),
        });

        const result = await aiService.analyzeUserProfile({ 1: 0, 2: 1 });

        expect(result.personality_type).toBe('визуал');
        expect(result.strengths).toEqual(['Креативность']);
    });

    it('fills defaults for missing fields', async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ data: JSON.stringify({}) }),
        });

        const result = await aiService.analyzeUserProfile({});

        expect(result.personality_type).toBe('Analyst');
        expect(result.strengths).toEqual(['Determination']);
    });

    it('returns full defaults on error', async () => {
        mockFetch.mockResolvedValue({
            ok: false,
            status: 500,
            json: async () => ({ error: 'x' }),
        });

        const result = await aiService.analyzeUserProfile({});

        expect(result.personality_type).toBe('Analyst');
        expect(result.temperament).toBe('Balanced');
    });
});
