// ─── Mock Supabase client ────────────────────────────
const mockInvoke = jest.fn();

jest.mock('../services/supabase/client', () => ({
    getSupabase: () => ({
        functions: {
            invoke: mockInvoke,
        },
    }),
}));

import { aiService } from '../services/ai';

// ─── Reset ───────────────────────────────────────────

beforeEach(() => {
    jest.clearAllMocks();
});

// ─── sendMessage ─────────────────────────────────────

describe('aiService.sendMessage', () => {
    it('returns AI response on success', async () => {
        mockInvoke.mockResolvedValue({
            data: { data: 'Привет! Как дела?' },
            error: null,
        });

        const result = await aiService.sendMessage([
            { role: 'user', content: 'Привет' },
        ]);

        expect(result).toBe('Привет! Как дела?');
        expect(mockInvoke).toHaveBeenCalledWith('ai-proxy', {
            body: expect.objectContaining({ action: 'sendMessage' }),
        });
    });

    it('returns fallback message on error', async () => {
        mockInvoke.mockResolvedValue({
            data: null,
            error: new Error('Edge Function timeout'),
        });

        const result = await aiService.sendMessage([
            { role: 'user', content: 'test' },
        ]);

        expect(result).toContain('Извините');
    });
});

// ─── getHobbyRecommendations ─────────────────────────

describe('aiService.getHobbyRecommendations', () => {
    it('returns parsed array from AI', async () => {
        mockInvoke.mockResolvedValue({
            data: { data: JSON.stringify(['chess', 'drawing', 'coding']) },
            error: null,
        });

        const result = await aiService.getHobbyRecommendations({ 1: 0, 2: 1 });

        expect(result).toEqual(['chess', 'drawing', 'coding']);
    });

    it('returns defaults on non-array response', async () => {
        mockInvoke.mockResolvedValue({
            data: { data: '"invalid"' },
            error: null,
        });

        const result = await aiService.getHobbyRecommendations({});

        expect(result).toEqual(['chess', 'video_editing', 'drawing']);
    });

    it('returns defaults on error', async () => {
        mockInvoke.mockResolvedValue({
            data: null,
            error: new Error('fail'),
        });

        const result = await aiService.getHobbyRecommendations({});

        expect(result).toEqual(['chess', 'video_editing', 'drawing']);
    });
});

// ─── generateDailyTasks ──────────────────────────────

describe('aiService.generateDailyTasks', () => {
    it('returns parsed tasks', async () => {
        mockInvoke.mockResolvedValue({
            data: { data: JSON.stringify(['Learn basics', 'Practice 30 min']) },
            error: null,
        });

        const result = await aiService.generateDailyTasks('chess', 1, 1);

        expect(result).toEqual(['Learn basics', 'Practice 30 min']);
    });

    it('returns defaults on failure', async () => {
        mockInvoke.mockResolvedValue({ data: null, error: new Error('x') });

        const result = await aiService.generateDailyTasks('chess', 1, 1);

        expect(result).toHaveLength(2);
    });
});

// ─── generateSubstituteContent ───────────────────────

describe('aiService.generateSubstituteContent', () => {
    it('returns parsed substitute content', async () => {
        mockInvoke.mockResolvedValue({
            data: {
                data: JSON.stringify({
                    type: 'challenge',
                    message: 'Try this instead!',
                    action: 'Start session',
                }),
            },
            error: null,
        });

        const result = await aiService.generateSubstituteContent('instagram', 'chess');

        expect(result.type).toBe('challenge');
        expect(result.message).toBe('Try this instead!');
        expect(result.action).toBe('Start session');
    });

    it('fills missing fields with defaults', async () => {
        mockInvoke.mockResolvedValue({
            data: { data: JSON.stringify({}) },
            error: null,
        });

        const result = await aiService.generateSubstituteContent('tiktok', 'drawing');

        expect(result.type).toBe('reminder');
        expect(result.message).toBeTruthy();
        expect(result.action).toBeTruthy();
    });

    it('returns full fallback on error', async () => {
        mockInvoke.mockResolvedValue({ data: null, error: new Error('x') });

        const result = await aiService.generateSubstituteContent('youtube', 'coding');

        expect(result.type).toBe('reminder');
    });
});

// ─── analyzeScreenTimePatterns ───────────────────────

describe('aiService.analyzeScreenTimePatterns', () => {
    it('returns parsed insights and suggestions', async () => {
        mockInvoke.mockResolvedValue({
            data: {
                data: JSON.stringify({
                    insights: ['You spend 3h on social media'],
                    suggestions: ['Limit to 1h'],
                }),
            },
            error: null,
        });

        const result = await aiService.analyzeScreenTimePatterns([
            { app: 'Instagram', category: 'social', minutes: 180 },
        ]);

        expect(result.insights).toEqual(['You spend 3h on social media']);
        expect(result.suggestions).toEqual(['Limit to 1h']);
    });

    it('returns defaults on error', async () => {
        mockInvoke.mockResolvedValue({ data: null, error: new Error('x') });

        const result = await aiService.analyzeScreenTimePatterns([]);

        expect(result.insights).toBeTruthy();
        expect(result.suggestions).toBeTruthy();
    });
});

// ─── analyzeUserProfile ──────────────────────────────

describe('aiService.analyzeUserProfile', () => {
    it('returns parsed profile analysis', async () => {
        mockInvoke.mockResolvedValue({
            data: {
                data: JSON.stringify({
                    personality_type: 'визуал',
                    temperament: 'сангвиник',
                    motivation_style: 'hard',
                    strengths: ['Креативность'],
                    growth_areas: ['Дисциплина'],
                }),
            },
            error: null,
        });

        const result = await aiService.analyzeUserProfile({ 1: 0, 2: 1 });

        expect(result.personality_type).toBe('визуал');
        expect(result.strengths).toEqual(['Креативность']);
    });

    it('fills defaults for missing fields', async () => {
        mockInvoke.mockResolvedValue({
            data: { data: JSON.stringify({}) },
            error: null,
        });

        const result = await aiService.analyzeUserProfile({});

        expect(result.personality_type).toBe('аналитик');
        expect(result.strengths).toEqual(['Целеустремлённость']);
    });

    it('returns full defaults on error', async () => {
        mockInvoke.mockResolvedValue({ data: null, error: new Error('x') });

        const result = await aiService.analyzeUserProfile({});

        expect(result.personality_type).toBe('аналитик');
        expect(result.temperament).toBe('сбалансированный');
    });
});
