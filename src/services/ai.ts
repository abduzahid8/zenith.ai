// AI Service — proxied through Supabase Edge Function
// All API keys are stored server-side; the client never sees them.

import { getSupabase } from './supabase/client';

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

// ── Helper: invoke the ai-proxy Edge Function ────────────

async function invokeAI<T>(action: string, payload: Record<string, unknown>): Promise<T> {
    const supabase = getSupabase();
    const { data, error } = await supabase.functions.invoke('ai-proxy', {
        body: { action, ...payload },
    });

    if (error) {
        console.error(`AI proxy error (${action}):`, error);
        if ('context' in error) {
            console.error('Error context:', (error as any).context);
        }
        throw error;
    }

    // The Edge Function returns { data: string }
    // Parse the inner data if it's a JSON string
    const raw = data?.data ?? data;
    if (typeof raw === 'string') {
        try {
            return JSON.parse(raw.replace(/```json|```/g, '').trim()) as T;
        } catch {
            return raw as unknown as T;
        }
    }
    return raw as T;
}

// ── Public AI Service ────────────────────────────────────

export const aiService = {
    // Send message to AI coach
    sendMessage: async (
        messages: ChatMessage[],
        hobby?: string
    ): Promise<string> => {
        try {
            return await invokeAI<string>('sendMessage', { messages, hobby });
        } catch (error) {
            const status = (error as any)?.context?.status ?? (error as any)?.status;
            if (status === 429) {
                return 'Слишком много запросов к ИИ. Подождите 10–20 секунд и попробуйте снова.';
            }
            return 'Извините, сейчас я не могу ответить. Проверьте соединение или попробуйте позже.';
        }
    },

    // Get personalized hobby recommendations based on quiz answers
    getHobbyRecommendations: async (
        answers: Record<number, number>
    ): Promise<string[]> => {
        try {
            const parsed = await invokeAI<string[]>('getHobbyRecommendations', { answers });
            return Array.isArray(parsed) ? parsed : ['chess', 'video_editing', 'drawing'];
        } catch {
            return ['chess', 'video_editing', 'drawing'];
        }
    },

    // Generate daily tasks for a hobby
    generateDailyTasks: async (
        hobby: string,
        dayOfWeek: number,
        weekNumber: number
    ): Promise<string[]> => {
        try {
            const parsed = await invokeAI<string[]>('generateDailyTasks', { hobby, dayOfWeek, weekNumber });
            return Array.isArray(parsed) ? parsed : ['Изучить основы', 'Практиковаться 30 минут'];
        } catch {
            return ['Изучить основы', 'Практиковаться 30 минут'];
        }
    },

    // Generate substitute content when user tries to open social media
    generateSubstituteContent: async (
        blockedApp: string,
        userHobby: string
    ): Promise<{ type: string; message: string; action: string }> => {
        try {
            const parsed = await invokeAI<{ type?: string; message?: string; action?: string }>(
                'generateSubstituteContent', { blockedApp, userHobby }
            );
            return {
                type: parsed.type || 'reminder',
                message: parsed.message || 'Хочешь заняться чем-то полезным?',
                action: parsed.action || 'Открой приложение и начни сессию',
            };
        } catch {
            return {
                type: 'reminder',
                message: 'Есть минутка? Может, практика вместо скроллинга? 🎯',
                action: 'Начать 15-минутную сессию',
            };
        }
    },

    // Analyze screen time patterns and suggest improvements
    analyzeScreenTimePatterns: async (
        weeklyData: { app: string; category: string; minutes: number }[]
    ): Promise<{ insights: string[]; suggestions: string[] }> => {
        try {
            const parsed = await invokeAI<{ insights?: string[]; suggestions?: string[] }>(
                'analyzeScreenTimePatterns', { weeklyData }
            );
            return {
                insights: parsed.insights || ['Анализ данных недоступен'],
                suggestions: parsed.suggestions || ['Попробуй сократить время в соцсетях'],
            };
        } catch {
            return {
                insights: ['Требуется больше данных для анализа'],
                suggestions: ['Продолжай отслеживать экранное время'],
            };
        }
    },

    // Get personalized content recommendations
    getContentRecommendations: async (
        userProfile: Record<string, unknown>,
        goals: string[]
    ): Promise<Array<{ title: string; category: string; reason: string }>> => {
        try {
            const parsed = await invokeAI<Array<{ title: string; category: string; reason: string }>>(
                'getContentRecommendations', { userProfile, goals }
            );
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    },

    // Get personalized earning ideas
    getPersonalizedEarningIdeas: async (
        userProfile: Record<string, unknown>,
        hobbies: string[]
    ): Promise<Array<{
        title: string;
        category: string;
        description: string;
        difficulty: string;
        income_min: number;
        income_max: number;
        time_to_start: string;
        match_score: number;
        reasons: string[];
    }>> => {
        try {
            type EarningIdea = {
                title: string;
                category: string;
                description: string;
                difficulty: string;
                income_min: number;
                income_max: number;
                time_to_start: string;
                match_score: number;
                reasons: string[];
            };
            const parsed = await invokeAI<EarningIdea[]>(
                'getPersonalizedEarningIdeas', { userProfile, hobbies }
            );
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    },

    // Generate a full weekly plan for a hobby
    generateWeeklyPlan: async (
        hobby: string,
        userLevel: string,
        weekNumber: number
    ): Promise<Array<{ day: number; tasks: string[]; focus: string }>> => {
        try {
            const parsed = await invokeAI<Array<{ day: number; tasks: string[]; focus: string }>>(
                'generateWeeklyPlan', { hobby, userLevel, weekNumber }
            );
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    },

    // Analyze user profile from quiz answers and behavior
    analyzeUserProfile: async (
        quizAnswers: Record<number, number>,
        behaviorData?: {
            avgSessionMinutes?: number;
            streakDays?: number;
            preferredTimes?: string[];
        }
    ): Promise<{
        personality_type: string;
        temperament: string;
        motivation_style: string;
        strengths: string[];
        growth_areas: string[];
    }> => {
        try {
            const parsed = await invokeAI<Record<string, unknown>>(
                'analyzeUserProfile', { quizAnswers, behaviorData }
            );
            return {
                personality_type: (parsed.personality_type as string) || 'аналитик',
                temperament: (parsed.temperament as string) || 'сбалансированный',
                motivation_style: (parsed.motivation_style as string) || 'soft',
                strengths: (parsed.strengths as string[]) || ['Целеустремлённость'],
                growth_areas: (parsed.growth_areas as string[]) || ['Регулярность практики'],
            };
        } catch {
            return {
                personality_type: 'аналитик',
                temperament: 'сбалансированный',
                motivation_style: 'soft',
                strengths: ['Целеустремлённость'],
                growth_areas: ['Регулярность практики'],
            };
        }
    },
};

export default aiService;
