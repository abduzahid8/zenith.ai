// AI Service — now running locally via Gemini API
// ⚠️ SECURITY NOTE: API key is in the app bundle. Consider a backend proxy for production.
// To switch back to edge function: set USE_LOCAL_AI = false

import { getSupabase } from './supabase/client';
import { localAiService } from './gemini';

// Feature flag: true = use local Gemini, false = use edge function
const USE_LOCAL_AI = true;

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

// ── Helper: invoke the ai-proxy Edge Function ────────────

async function invokeAI<T>(action: string, payload: Record<string, unknown>): Promise<T> {
    const supabase = getSupabase();

    // Debug: Check if user is authenticated
    // Ensure we have a fresh session token
    let { data: { session } } = await supabase.auth.getSession();

    // If session is missing or expired (within a 60-second buffer), refresh it
    const isExpired = session?.expires_at ? (session.expires_at - Math.floor(Date.now() / 1000) < 60) : true;

    if (!session || isExpired) {
        console.log('[AI Service] Session expired or missing, refreshing...');
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
            console.error('[AI Service] Failed to refresh session:', refreshError);
        } else {
            session = refreshData.session;
        }
    }

    console.log('[AI Service] Session exists:', !!session);
    console.log('[AI Service] User ID:', session?.user?.id);
    console.log('[AI Service] Token length:', session?.access_token?.length || 0);

    const doInvoke = async () => {
        // Use supabase.functions.invoke - auth is handled automatically by Edge Runtime
        return await supabase.functions.invoke('ai-proxy', {
            body: { action, ...payload },
        });
    };

    let { data, error } = await doInvoke();

    // If 401 (Invalid JWT), try to refresh the session and retry once
    const status = (error as any)?.context?.status ?? (error as any)?.status;
    console.log('[AI Service] Response status:', status, 'Type:', typeof status);
    
    if (status == 401) {
        console.log('[AI Service] 401 encountered, attempting forced refresh...');
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
            console.error('[AI Service] Forced refresh failed:', refreshError);
        } else if (refreshData.session) {
            console.log('[AI Service] Refresh successful. New token length:', refreshData.session.access_token.length);
            console.log('[AI Service] Retrying invocation...');
            const retryResult = await doInvoke();
            data = retryResult.data;
            error = retryResult.error;
        }
    }

    if (error) {
        console.error(`AI proxy error (${action}):`, error);
        if ('context' in error) {
            const context = (error as any).context;
            console.error('Error Status:', context.status);

            // In React Native, the body might be a Blob that needs to be read
            const extractErrorBody = async () => {
                try {
                    if (context._bodyText) return context._bodyText;
                    if (context._bodyBlob) {
                        return new Promise((resolve) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result);
                            reader.readAsText(context._bodyBlob);
                        });
                    }
                    return null;
                } catch (e) {
                    return `Error reading body: ${e}`;
                }
            };

            const body = await extractErrorBody();
            if (body) {
                try {
                    console.error('Error Body (JSON):', JSON.parse(body as string));
                } catch {
                    console.error('Error Body (Raw):', body);
                }
            }
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
        if (USE_LOCAL_AI) {
            return localAiService.sendMessage(messages, hobby);
        }
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
        if (USE_LOCAL_AI) {
            return localAiService.getHobbyRecommendations(answers);
        }
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
        if (USE_LOCAL_AI) {
            return localAiService.generateDailyTasks(hobby, dayOfWeek, weekNumber);
        }
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
        if (USE_LOCAL_AI) {
            return localAiService.generateSubstituteContent(blockedApp, userHobby);
        }
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

    // Get personalized content recommendations
    getContentRecommendations: async (
        userProfile: Record<string, unknown>,
        goals: string[]
    ): Promise<Array<{ title: string; category: string; reason: string }>> => {
        if (USE_LOCAL_AI) {
            return localAiService.getContentRecommendations(userProfile, goals);
        }
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
        if (USE_LOCAL_AI) {
            return localAiService.getPersonalizedEarningIdeas(userProfile, hobbies);
        }
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
        if (USE_LOCAL_AI) {
            return localAiService.generateWeeklyPlan(hobby, userLevel, weekNumber);
        }
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
        if (USE_LOCAL_AI) {
            return localAiService.analyzeUserProfile(quizAnswers, behaviorData);
        }
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
