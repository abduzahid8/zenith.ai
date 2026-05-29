// Local Gemini AI Service
// ⚠️ SECURITY WARNING: API key is exposed in the app bundle.
// Consider using a backend proxy in production.

import { ChatMessage } from './ai';

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.5-flash';

// ── System Prompts (mirrored from edge function) ─────────

const AI_COACH_SYSTEM_PROMPT = `You are an AI coach in the zenyth.ai app. Your task is to help the user with their hobbies and personal development.

Your main functions:
1. Give advice on the user's chosen hobby
2. Motivate and support progress
3. Help with activity planning
4. Answer questions about techniques and learning methods

Communication style:
- Friendly and supportive
- Specific and practical
- Motivating, but not intrusive
- Always answer in English`;

const HOBBY_PROMPTS: Record<string, string> = {
    chess: `You specialize in chess: openings, tactics, strategy, endgame, analysis.`,
    video_editing: `You specialize in video editing: cutting, color correction, sound, effects.`,
    drawing: `You specialize in drawing: perspective, anatomy, light and shadow, composition.`,
};

// ── Core Gemini API Call ─────────────────────────────────

async function callGemini(
    messages: Array<{ role: string; content: string }>,
    systemPrompt: string,
    temperature = 0.7,
    maxTokens = 500,
): Promise<string> {
    console.log('[Gemini] Starting call, API key exists:', !!GEMINI_API_KEY);
    console.log('[Gemini] API key value:', GEMINI_API_KEY ? `${GEMINI_API_KEY.substring(0, 10)}...` : 'undefined');
    
    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'undefined' || GEMINI_API_KEY.trim() === '') {
        console.error('[Gemini] API key is missing or invalid');
        return 'Sorry, AI service is temporarily unavailable. Please try again later.';
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    console.log('[Gemini] URL:', url.replace(GEMINI_API_KEY, '***'));

    // Build contents array
    const contents = messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
        }));

    // Prepend system prompt to first user message
    if (systemPrompt && contents.length > 0 && contents[0].role === 'user') {
        contents[0].parts[0].text = systemPrompt + '\n\n' + contents[0].parts[0].text;
    } else if (systemPrompt) {
        contents.unshift({ role: 'user', parts: [{ text: systemPrompt }] });
    }

    console.log('[Gemini] Request contents:', JSON.stringify(contents, null, 2));

    // Gemini can respond with transient 429/503. Retry a few times with backoff.
    let lastErrorText = '';
    for (let attempt = 0; attempt < 3; attempt++) {
        console.log(`[Gemini] Attempt ${attempt + 1}/3`);
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents,
                    generationConfig: { temperature, maxOutputTokens: maxTokens },
                }),
            });

            console.log('[Gemini] Response status:', response.status);

            if (response.ok) {
                const data = await response.json();
                console.log('[Gemini] Response data:', JSON.stringify(data, null, 2).substring(0, 500));
                if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
                    return data.candidates[0].content.parts[0].text;
                }
                return 'Sorry, received an empty response from the service.';
            }

            lastErrorText = await response.text();
            console.error('[Gemini] Error response:', lastErrorText);
            const status = response.status;
        const retryAfterHeader = response.headers.get('retry-after');
        const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : NaN;

        const isRetryable = status === 429 || status === 503 || status === 500;
        const hasMoreAttempts = attempt < 2;

        if (isRetryable && hasMoreAttempts) {
            const backoffMs = Number.isFinite(retryAfterMs)
                ? Math.max(250, Math.min(10_000, retryAfterMs))
                : 350 * Math.pow(2, attempt);
            console.log(`[Gemini] Retrying after ${backoffMs}ms...`);
            await new Promise((r) => setTimeout(r, backoffMs));
            continue;
        }

        console.error('[Gemini] Throwing error:', `Gemini API ${status}: ${lastErrorText}`);
        throw new Error(`Gemini API ${status}: ${lastErrorText}`);
    } catch (fetchError) {
        console.error('[Gemini] Fetch error:', fetchError);
        throw fetchError;
    }
    }

    console.error('[Gemini] All retries failed');
    throw new Error(`Gemini API 429: ${lastErrorText || 'Too many requests'}`);
}

// ── Action Handlers ──────────────────────────────────────

async function handleSendMessage(messages: ChatMessage[], hobby?: string): Promise<string> {
    console.log('[Gemini] handleSendMessage called, hobby:', hobby);
    let systemPrompt = AI_COACH_SYSTEM_PROMPT;
    if (hobby && HOBBY_PROMPTS[hobby]) {
        systemPrompt += '\n\n' + HOBBY_PROMPTS[hobby];
    }
    try {
        const result = await callGemini(messages, systemPrompt, 0.7, 500);
        console.log('[Gemini] sendMessage success, result length:', result.length);
        return result;
    } catch (error) {
        console.error('[Gemini] sendMessage error:', error);
        throw error;
    }
}

async function handleGradeAnswer(messages: ChatMessage[], hobby?: string): Promise<string> {
    console.log('[Gemini] handleGradeAnswer called, hobby:', hobby);
    const systemMessage = messages.find(m => m.role === 'system');
    const systemPrompt = systemMessage ? systemMessage.content : '';
    const userMessages = messages.filter(m => m.role !== 'system');
    try {
        const result = await callGemini(userMessages, systemPrompt, 0.2, 1000);
        console.log('[Gemini] gradeAnswer success, result length:', result.length);
        return result;
    } catch (error) {
        console.error('[Gemini] gradeAnswer error:', error);
        throw error;
    }
}

async function handleHobbyRecommendations(answers: Record<number, number>): Promise<string[]> {
    const prompt = `Based on the user's quiz answers, recommend 3 hobbies from the list: chess, video_editing, drawing.
Answers: ${JSON.stringify(answers)}
Return ONLY a JSON array with hobby IDs: ["chess", "drawing", "video_editing"]`;

    const result = await callGemini(
        [{ role: 'user', content: prompt }],
        'You are an assistant that analyzes quiz answers. Reply only with a JSON array.',
        0.3, 100,
    );

    try {
        return JSON.parse(result.replace(/```json|```/g, '').trim());
    } catch {
        return ['chess', 'video_editing', 'drawing'];
    }
}

async function handleDailyTasks(
    hobby: string,
    dayOfWeek: number,
    weekNumber: number,
): Promise<string[]> {
    const hobbyName = ({ chess: 'chess', video_editing: 'video editing', drawing: 'drawing' } as Record<string, string>)[hobby] ?? hobby;
    const prompt = `Create 2-3 tasks for "${hobbyName}" on day of week ${dayOfWeek}, week number ${weekNumber}.
Return a JSON array of strings in English.`;

    const result = await callGemini(
        [{ role: 'user', content: prompt }],
        'You are an educational task generator. Reply ONLY with a JSON array of strings.',
        0.7, 200,
    );

    try {
        return JSON.parse(result.replace(/```json|```/g, '').trim());
    } catch {
        return ['Learn basics', 'Practice 30 minutes'];
    }
}

async function handleSubstituteContent(
    blockedApp: string,
    userHobby: string,
): Promise<{ type: string; message: string; action: string }> {
    const prompt = `User is about to open ${blockedApp}. Hobby: ${userHobby}.
Create a motivating message in English. Return JSON: {"type":"reminder|challenge|insight|motivation","message":"text","action":"action_text"}`;

    const result = await callGemini(
        [{ role: 'user', content: prompt }],
        'You are an assistant that gently motivates. Reply ONLY with JSON.',
        0.8, 200,
    );

    try {
        return JSON.parse(result.replace(/```json|```/g, '').trim());
    } catch {
        return {
            type: 'reminder',
            message: 'Have a minute? Maybe practice instead of scrolling? 🎯',
            action: 'Start a 15-minute session',
        };
    }
}

async function handleScreenTimeAnalysis(
    weeklyData: Array<{ app: string; category: string; minutes: number }>,
): Promise<{ insights: string[]; suggestions: string[] }> {
    const prompt = `Analyze screen time: ${JSON.stringify(weeklyData)}
Return JSON in English: {"insights":["insight1"],"suggestions":["suggestion1"]}`;

    const result = await callGemini(
        [{ role: 'user', content: prompt }],
        'You are a behavior analyst. Reply ONLY with JSON.',
        0.6, 300,
    );

    try {
        return JSON.parse(result.replace(/```json|```/g, '').trim());
    } catch {
        return { insights: [], suggestions: [] };
    }
}

async function handleContentRecommendations(
    userProfile: Record<string, unknown>,
    goals: string[],
): Promise<Array<{ title: string; category: string; reason: string }>> {
    const prompt = `Profile: ${JSON.stringify(userProfile)}\nGoals: ${goals.join(', ')}
Recommend 3-5 types of content. Return JSON array in English: [{"title":"","category":"","reason":""}]`;

    const result = await callGemini(
        [{ role: 'user', content: prompt }],
        'You are a content recommendation engine. Reply ONLY with JSON.',
        0.7, 400,
    );

    try {
        return JSON.parse(result.replace(/```json|```/g, '').trim());
    } catch {
        return [];
    }
}

async function handleEarningIdeas(
    userProfile: Record<string, unknown>,
    hobbies: string[],
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
}>> {
    const prompt = `Profile: ${JSON.stringify(userProfile)}\nHobbies: ${hobbies.join(', ')}
Suggest 3-5 ways to earn money. Return a JSON array in English.`;

    const result = await callGemini(
        [{ role: 'user', content: prompt }],
        'You are a career consultant. Reply ONLY with JSON.',
        0.7, 600,
    );

    try {
        return JSON.parse(result.replace(/```json|```/g, '').trim());
    } catch {
        return [];
    }
}

async function handleWeeklyPlan(
    hobby: string,
    userLevel: string,
    weekNumber: number,
): Promise<Array<{ day: number; tasks: string[]; focus: string }>> {
    const hobbyName = ({ chess: 'chess', video_editing: 'video editing', drawing: 'drawing' } as Record<string, string>)[hobby] ?? hobby;
    const prompt = `Create a weekly plan for "${hobbyName}". Level: ${userLevel}. Week: ${weekNumber}.
Return JSON in English: [{"day":1,"tasks":["task"],"focus":"topic"}]`;

    const result = await callGemini(
        [{ role: 'user', content: prompt }],
        'You are a study planner. Reply ONLY with JSON.',
        0.7, 500,
    );

    try {
        return JSON.parse(result.replace(/```json|```/g, '').trim());
    } catch {
        return [];
    }
}

async function handleProfileAnalysis(
    quizAnswers: Record<number, number>,
    behaviorData?: {
        avgSessionMinutes?: number;
        streakDays?: number;
        preferredTimes?: string[];
    },
): Promise<{
    personality_type: string;
    temperament: string;
    motivation_style: string;
    strengths: string[];
    growth_areas: string[];
}> {
    const prompt = `Answers: ${JSON.stringify(quizAnswers)}\nBehavior: ${JSON.stringify(behaviorData ?? {})}
Analyze and return JSON in English: {"personality_type":"","temperament":"","motivation_style":"","strengths":[],"growth_areas":[]}`;

    const result = await callGemini(
        [{ role: 'user', content: prompt }],
        'You are a psychoanalyst. Reply ONLY with JSON.',
        0.5, 300,
    );

    try {
        const parsed = JSON.parse(result.replace(/```json|```/g, '').trim());
        return {
            personality_type: parsed.personality_type || 'Analyst',
            temperament: parsed.temperament || 'Balanced',
            motivation_style: parsed.motivation_style || 'Soft',
            strengths: parsed.strengths || ['Determination'],
            growth_areas: parsed.growth_areas || ['Regular Practice'],
        };
    } catch {
        return {
            personality_type: 'Analyst',
            temperament: 'Balanced',
            motivation_style: 'Soft',
            strengths: ['Determination'],
            growth_areas: ['Regular Practice'],
        };
    }
}

// ── Public API ───────────────────────────────────────────

export const localAiService = {
    sendMessage: handleSendMessage,
    gradeAnswer: handleGradeAnswer,
    getHobbyRecommendations: handleHobbyRecommendations,
    generateDailyTasks: handleDailyTasks,
    generateSubstituteContent: handleSubstituteContent,
    analyzeScreenTimePatterns: handleScreenTimeAnalysis,
    getContentRecommendations: handleContentRecommendations,
    getPersonalizedEarningIdeas: handleEarningIdeas,
    generateWeeklyPlan: handleWeeklyPlan,
    analyzeUserProfile: handleProfileAnalysis,
};

export default localAiService;
