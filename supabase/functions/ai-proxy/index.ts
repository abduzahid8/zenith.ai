// Supabase Edge Function: AI Proxy
// Handles all AI calls server-side to keep API keys secure
// Deploy: npx supabase functions deploy ai-proxy

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const GEMINI_MODEL = 'gemini-1.5-flash';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
    action: string;
    messages?: Array<{ role: string; content: string }>;
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
    // Action-specific fields
    hobby?: string;
    dayOfWeek?: number;
    weekNumber?: number;
    userLevel?: string;
    blockedApp?: string;
    userHobby?: string;
    weeklyData?: Array<{ app: string; category: string; minutes: number }>;
    userProfile?: Record<string, unknown>;
    goals?: string[];
    hobbies?: string[];
    quizAnswers?: Record<number, number>;
    behaviorData?: Record<string, unknown>;
    answers?: Record<number, number>;
}

// Call Gemini API
async function callGemini(
    messages: Array<{ role: string; content: string }>,
    systemPrompt: string,
    temperature = 0.7,
    maxTokens = 500,
): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

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

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents,
            generationConfig: { temperature, maxOutputTokens: maxTokens },
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
        return data.candidates[0].content.parts[0].text;
    }

    return 'Извините, получен пустой ответ от сервиса.';
}

// ── Action Handlers ──────────────────────────────────────

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

async function handleSendMessage(body: RequestBody): Promise<string> {
    let systemPrompt = AI_COACH_SYSTEM_PROMPT;
    if (body.hobby && HOBBY_PROMPTS[body.hobby]) {
        systemPrompt += '\n\n' + HOBBY_PROMPTS[body.hobby];
    }
    return callGemini(body.messages ?? [], systemPrompt, 0.7, 500);
}

async function handleHobbyRecommendations(body: RequestBody): Promise<string> {
    const prompt = `На основе ответов пользователя на анкету, рекомендуй 3 хобби из списка: шахматы, видео монтаж, рисование.
Ответы: ${JSON.stringify(body.answers)}
Верни только JSON массив с ID хобби: ["chess", "drawing", "video_editing"]`;

    return callGemini(
        [{ role: 'user', content: prompt }],
        'Ты помощник, который анализирует ответы анкеты. Отвечай только JSON массивом.',
        0.3, 100,
    );
}

async function handleDailyTasks(body: RequestBody): Promise<string> {
    const hobbyName = ({ chess: 'шахматы', video_editing: 'видео монтаж', drawing: 'рисование' } as Record<string, string>)[body.hobby ?? ''] ?? body.hobby;
    const prompt = `Создай 2-3 задачи для "${hobbyName}" на ${body.dayOfWeek} день недели ${body.weekNumber}.\nВерни JSON массив строк.`;
    return callGemini(
        [{ role: 'user', content: prompt }],
        'Ты генератор учебных задач. Отвечай только JSON массивом строк.',
        0.7, 200,
    );
}

async function handleSubstituteContent(body: RequestBody): Promise<string> {
    const prompt = `Пользователь собирается открыть ${body.blockedApp}. Хобби: ${body.userHobby}.
Создай мотивирующее сообщение. Верни JSON: {"type":"reminder|challenge|insight|motivation","message":"текст","action":"действие"}`;
    return callGemini(
        [{ role: 'user', content: prompt }],
        'Ты помощник, который мягко мотивирует. Отвечай только JSON.',
        0.8, 200,
    );
}

async function handleScreenTimeAnalysis(body: RequestBody): Promise<string> {
    const prompt = `Проанализируй экранное время: ${JSON.stringify(body.weeklyData)}
Верни JSON: {"insights":["инсайт1"],"suggestions":["совет1"]}`;
    return callGemini(
        [{ role: 'user', content: prompt }],
        'Ты аналитик поведения. Отвечай только JSON.',
        0.6, 300,
    );
}

async function handleContentRecommendations(body: RequestBody): Promise<string> {
    const prompt = `Профиль: ${JSON.stringify(body.userProfile)}\nЦели: ${(body.goals ?? []).join(', ')}
Рекомендуй 3-5 типов контента. Верни JSON массив: [{"title":"","category":"","reason":""}]`;
    return callGemini(
        [{ role: 'user', content: prompt }],
        'Ты рекомендательная система контента. Отвечай только JSON.',
        0.7, 400,
    );
}

async function handleEarningIdeas(body: RequestBody): Promise<string> {
    const prompt = `Профиль: ${JSON.stringify(body.userProfile)}\nХобби: ${(body.hobbies ?? []).join(', ')}
Предложи 3-5 способов заработка. Верни JSON массив.`;
    return callGemini(
        [{ role: 'user', content: prompt }],
        'Ты карьерный консультант. Отвечай только JSON.',
        0.7, 600,
    );
}

async function handleWeeklyPlan(body: RequestBody): Promise<string> {
    const hobbyName = ({ chess: 'шахматы', video_editing: 'видео монтаж', drawing: 'рисование' } as Record<string, string>)[body.hobby ?? ''] ?? body.hobby;
    const prompt = `Создай недельный план для "${hobbyName}". Уровень: ${body.userLevel}. Неделя: ${body.weekNumber}.
Верни JSON: [{"day":1,"tasks":["задача"],"focus":"тема"}]`;
    return callGemini(
        [{ role: 'user', content: prompt }],
        'Ты составитель учебных планов. Отвечай только JSON.',
        0.7, 500,
    );
}

async function handleProfileAnalysis(body: RequestBody): Promise<string> {
    const prompt = `Ответы: ${JSON.stringify(body.quizAnswers)}\nПоведение: ${JSON.stringify(body.behaviorData ?? {})}
Проанализируй и верни JSON: {"personality_type":"","temperament":"","motivation_style":"","strengths":[],"growth_areas":[]}`;
    return callGemini(
        [{ role: 'user', content: prompt }],
        'Ты психолог-аналитик. Отвечай только JSON.',
        0.5, 300,
    );
}

// ── Main handler ─────────────────────────────────────────

Deno.serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        if (!GEMINI_API_KEY) {
            throw new Error('GEMINI_API_KEY not configured. Run: npx supabase secrets set GEMINI_API_KEY=...');
        }

        const body: RequestBody = await req.json();
        const { action } = body;

        let result: string;

        switch (action) {
            case 'sendMessage':
                result = await handleSendMessage(body);
                break;
            case 'getHobbyRecommendations':
                result = await handleHobbyRecommendations(body);
                break;
            case 'generateDailyTasks':
                result = await handleDailyTasks(body);
                break;
            case 'generateSubstituteContent':
                result = await handleSubstituteContent(body);
                break;
            case 'analyzeScreenTimePatterns':
                result = await handleScreenTimeAnalysis(body);
                break;
            case 'getContentRecommendations':
                result = await handleContentRecommendations(body);
                break;
            case 'getPersonalizedEarningIdeas':
                result = await handleEarningIdeas(body);
                break;
            case 'generateWeeklyPlan':
                result = await handleWeeklyPlan(body);
                break;
            case 'analyzeUserProfile':
                result = await handleProfileAnalysis(body);
                break;
            default:
                throw new Error(`Unknown action: ${action}`);
        }

        return new Response(JSON.stringify({ data: result }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('ai-proxy error:', message);
        return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
