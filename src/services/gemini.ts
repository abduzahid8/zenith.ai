// Local Gemini AI Service
// ⚠️ SECURITY WARNING: API key is exposed in the app bundle.
// Consider using a backend proxy in production.

import { ChatMessage } from './ai';

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.5-flash';

// ── System Prompts (mirrored from edge function) ─────────

const AI_COACH_SYSTEM_PROMPT = `Ты - ИИ-наставник в приложении zenyth.ai. Твоя задача - помогать пользователю с его хобби и личным развитием.

Твои основные функции:
1. Давать советы по выбранному хобби пользователя
2. Мотивировать и поддерживать прогресс
3. Помогать с планированием занятий
4. Отвечать на вопросы о техниках и методах обучения

Стиль общения:
- Дружелюбный и поддерживающий
- Конкретный и практичный
- Мотивирующий, но не навязчивый
- Отвечай на русском языке`;

const HOBBY_PROMPTS: Record<string, string> = {
    chess: `Ты специализируешься на шахматах: дебюты, тактика, стратегия, эндшпиль, анализ.`,
    video_editing: `Ты специализируешься на видео монтаже: монтаж, цветокоррекция, звук, эффекты.`,
    drawing: `Ты специализируешься на рисовании: перспектива, анатомия, светотень, композиция.`,
};

// ── Core Gemini API Call ─────────────────────────────────

async function callGemini(
    messages: Array<{ role: string; content: string }>,
    systemPrompt: string,
    temperature = 0.7,
    maxTokens = 500,
): Promise<string> {
    console.log('[Gemini] Starting call, API key exists:', !!GEMINI_API_KEY);
    
    if (!GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY not configured. Add EXPO_PUBLIC_GEMINI_API_KEY to your .env file.');
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
                return 'Извините, получен пустой ответ от сервиса.';
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

async function handleHobbyRecommendations(answers: Record<number, number>): Promise<string[]> {
    const prompt = `На основе ответов пользователя на анкету, рекомендуй 3 хобби из списка: шахматы, видео монтаж, рисование.
Ответы: ${JSON.stringify(answers)}
Верни только JSON массив с ID хобби: ["chess", "drawing", "video_editing"]`;

    const result = await callGemini(
        [{ role: 'user', content: prompt }],
        'Ты помощник, который анализирует ответы анкеты. Отвечай только JSON массивом.',
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
    const hobbyName = ({ chess: 'шахматы', video_editing: 'видео монтаж', drawing: 'рисование' } as Record<string, string>)[hobby] ?? hobby;
    const prompt = `Создай 2-3 задачи для "${hobbyName}" на ${dayOfWeek} день недели ${weekNumber}.
Верни JSON массив строк.`;

    const result = await callGemini(
        [{ role: 'user', content: prompt }],
        'Ты генератор учебных задач. Отвечай только JSON массивом строк.',
        0.7, 200,
    );

    try {
        return JSON.parse(result.replace(/```json|```/g, '').trim());
    } catch {
        return ['Изучить основы', 'Практиковаться 30 минут'];
    }
}

async function handleSubstituteContent(
    blockedApp: string,
    userHobby: string,
): Promise<{ type: string; message: string; action: string }> {
    const prompt = `Пользователь собирается открыть ${blockedApp}. Хобби: ${userHobby}.
Создай мотивирующее сообщение. Верни JSON: {"type":"reminder|challenge|insight|motivation","message":"текст","action":"действие"}`;

    const result = await callGemini(
        [{ role: 'user', content: prompt }],
        'Ты помощник, который мягко мотивирует. Отвечай только JSON.',
        0.8, 200,
    );

    try {
        return JSON.parse(result.replace(/```json|```/g, '').trim());
    } catch {
        return {
            type: 'reminder',
            message: 'Есть минутка? Может, практика вместо скроллинга? 🎯',
            action: 'Начать 15-минутную сессию',
        };
    }
}

async function handleScreenTimeAnalysis(
    weeklyData: Array<{ app: string; category: string; minutes: number }>,
): Promise<{ insights: string[]; suggestions: string[] }> {
    const prompt = `Проанализируй экранное время: ${JSON.stringify(weeklyData)}
Верни JSON: {"insights":["инсайт1"],"suggestions":["совет1"]}`;

    const result = await callGemini(
        [{ role: 'user', content: prompt }],
        'Ты аналитик поведения. Отвечай только JSON.',
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
    const prompt = `Профиль: ${JSON.stringify(userProfile)}\nЦели: ${goals.join(', ')}
Рекомендуй 3-5 типов контента. Верни JSON массив: [{"title":"","category":"","reason":""}]`;

    const result = await callGemini(
        [{ role: 'user', content: prompt }],
        'Ты рекомендательная система контента. Отвечай только JSON.',
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
    const prompt = `Профиль: ${JSON.stringify(userProfile)}\nХобби: ${hobbies.join(', ')}
Предложи 3-5 способов заработка. Верни JSON массив.`;

    const result = await callGemini(
        [{ role: 'user', content: prompt }],
        'Ты карьерный консультант. Отвечай только JSON.',
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
    const hobbyName = ({ chess: 'шахматы', video_editing: 'видео монтаж', drawing: 'рисование' } as Record<string, string>)[hobby] ?? hobby;
    const prompt = `Создай недельный план для "${hobbyName}". Уровень: ${userLevel}. Неделя: ${weekNumber}.
Верни JSON: [{"day":1,"tasks":["задача"],"focus":"тема"}]`;

    const result = await callGemini(
        [{ role: 'user', content: prompt }],
        'Ты составитель учебных планов. Отвечай только JSON.',
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
    const prompt = `Ответы: ${JSON.stringify(quizAnswers)}\nПоведение: ${JSON.stringify(behaviorData ?? {})}
Проанализируй и верни JSON: {"personality_type":"","temperament":"","motivation_style":"","strengths":[],"growth_areas":[]}`;

    const result = await callGemini(
        [{ role: 'user', content: prompt }],
        'Ты психолог-аналитик. Отвечай только JSON.',
        0.5, 300,
    );

    try {
        const parsed = JSON.parse(result.replace(/```json|```/g, '').trim());
        return {
            personality_type: parsed.personality_type || 'аналитик',
            temperament: parsed.temperament || 'сбалансированный',
            motivation_style: parsed.motivation_style || 'soft',
            strengths: parsed.strengths || ['Целеустремлённость'],
            growth_areas: parsed.growth_areas || ['Регулярность практики'],
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
}

// ── Public API ───────────────────────────────────────────

export const localAiService = {
    sendMessage: handleSendMessage,
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
