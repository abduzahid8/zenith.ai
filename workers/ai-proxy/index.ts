// Cloudflare Worker: AI Proxy
// Handles all AI calls server-side to keep API keys secure
// Deploy: npx wrangler deploy

const GEMINI_MODEL = 'gemini-2.5-flash';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export interface Env {
    GEMINI_API_KEY: string;
}

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
    apiKey: string,
    messages: Array<{ role: string; content: string }>,
    systemPrompt: string,
    temperature = 0.7,
    maxTokens = 500,
): Promise<string> {
    if (!messages || messages.length === 0) {
        throw new Error('Bad request: messages array is empty');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

    // Build contents array
    const contents = messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
        }));

    const requestBody: Record<string, unknown> = {
        ...(systemPrompt ? { systemInstruction: { parts: [{ text: systemPrompt }] } } : {}),
        contents,
        generationConfig: { temperature, maxOutputTokens: maxTokens },
    };

    console.log('[callGemini] Request URL:', url.replace(apiKey, '[REDACTED]'));
    console.log('[callGemini] Request body:', JSON.stringify(requestBody, null, 2));

    // Gemini can respond with transient 429/503. Retry a few times with backoff.
    let lastErrorText = '';
    for (let attempt = 0; attempt < 3; attempt++) {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        });

        console.log('[callGemini] Response status:', response.status);

        if (response.ok) {
            const data = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
            console.log('[callGemini] Success response data:', JSON.stringify(data, null, 2).substring(0, 500));
            if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
                return data.candidates[0].content.parts[0].text;
            }
            console.error('[callGemini] No text in response:', JSON.stringify(data, null, 2).substring(0, 500));
            return 'Sorry, received an empty response from the service.';
        }

        lastErrorText = await response.text();
        console.error('[callGemini] Error response body:', lastErrorText.substring(0, 1000));
        const status = response.status;
        const retryAfterHeader = response.headers.get('retry-after');
        const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : NaN;

        const isRetryable = status === 429 || status === 503 || status === 500;
        const hasMoreAttempts = attempt < 2;

        if (isRetryable && hasMoreAttempts) {
            const backoffMs = Number.isFinite(retryAfterMs)
                ? Math.max(250, Math.min(10_000, retryAfterMs))
                : ([500, 1000, 2000][attempt] ?? 2000);
            await new Promise((r) => setTimeout(r, backoffMs));
            continue;
        }

        throw new Error(`Gemini API ${status}: ${lastErrorText}`);
    }

    throw new Error(`Gemini API 429: ${lastErrorText || 'Too many requests'}`);
}

// ── Action Handlers ──────────────────────────────────────

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
- CRITICAL: Always respond in the SAME LANGUAGE that the user writes in. If they write in Russian, respond in Russian. If they write in English, respond in English. If they write in Uzbek, respond in Uzbek. Match their language exactly.`;

const HOBBY_PROMPTS: Record<string, string> = {
    chess: `You specialize in chess: openings, tactics, strategy, endgame, analysis.`,
    video_editing: `You specialize in video editing: cutting, color correction, sound, effects.`,
    drawing: `You specialize in drawing: perspective, anatomy, light and shadow, composition.`,
};

async function handleSendMessage(apiKey: string, body: RequestBody): Promise<string> {
    if (!body.messages || body.messages.length === 0) throw new Error('Bad request: missing messages');
    let systemPrompt = AI_COACH_SYSTEM_PROMPT;
    if (body.hobby && HOBBY_PROMPTS[body.hobby]) {
        systemPrompt += '\n\n' + HOBBY_PROMPTS[body.hobby];
    }
    return callGemini(apiKey, body.messages, systemPrompt, 0.7, 500);
}

async function handleGradeAnswer(apiKey: string, body: RequestBody): Promise<string> {
    if (!body.messages || body.messages.length === 0) throw new Error('Bad request: missing messages');
    const systemMessage = body.messages.find(m => m.role === 'system');
    const systemPrompt = systemMessage ? systemMessage.content : '';
    const userMessages = body.messages.filter(m => m.role !== 'system');
    return callGemini(apiKey, userMessages, systemPrompt, 0.2, 1000);
}

async function handleHobbyRecommendations(apiKey: string, body: RequestBody): Promise<string> {
    const prompt = `Based on the user's quiz answers, recommend 3 hobbies from the list: chess, video_editing, drawing.
Answers: ${JSON.stringify(body.answers)}
Return ONLY a JSON array with hobby IDs: ["chess", "drawing", "video_editing"]`;

    return callGemini(
        apiKey,
        [{ role: 'user', content: prompt }],
        'You are an assistant that analyzes quiz answers. Reply only with a JSON array.',
        0.3, 100,
    );
}

async function handleDailyTasks(apiKey: string, body: RequestBody): Promise<string> {
    if (!body.hobby) throw new Error('Bad request: missing hobby');
    const hobbyName = ({ chess: 'chess', video_editing: 'video editing', drawing: 'drawing' } as Record<string, string>)[body.hobby] ?? body.hobby;
    const prompt = `Create 2-3 tasks for "${hobbyName}" on day of week ${body.dayOfWeek}, week number ${body.weekNumber}.\nReturn JSON array of strings. Detect the user's preferred language from context and respond in that language.`;
    return callGemini(
        apiKey,
        [{ role: 'user', content: prompt }],
        'You are an educational task generator. Reply ONLY with a JSON array of strings. Use the same language as the user.',
        0.7, 200,
    );
}

async function handleSubstituteContent(apiKey: string, body: RequestBody): Promise<string> {
    const prompt = `User is about to open ${body.blockedApp}. Hobby: ${body.userHobby}.
Create a motivating message. Detect the user's language and respond in that language. Return JSON: {"type":"reminder|challenge|insight|motivation","message":"text","action":"action_text"}`;
    return callGemini(
        apiKey,
        [{ role: 'user', content: prompt }],
        'You are an assistant that gently motivates. Reply ONLY with JSON. Use the user\'s preferred language.',
        0.8, 200,
    );
}

async function handleScreenTimeAnalysis(apiKey: string, body: RequestBody): Promise<string> {
    if (!body.weeklyData) throw new Error('Bad request: missing weeklyData');
    const prompt = `Analyze screen time: ${JSON.stringify(body.weeklyData)}
Return JSON with insights and suggestions in the user's preferred language: {"insights":["insight1"],"suggestions":["suggestion1"]}`;
    return callGemini(
        apiKey,
        [{ role: 'user', content: prompt }],
        'You are a behavior analyst. Reply ONLY with JSON. Detect and use the user\'s preferred language.',
        0.6, 300,
    );
}

async function handleContentRecommendations(apiKey: string, body: RequestBody): Promise<string> {
    const prompt = `Profile: ${JSON.stringify(body.userProfile)}\nGoals: ${(body.goals ?? []).join(', ')}
Recommend 3-5 types of content. Return JSON array in the user's language: [{"title":"","category":"","reason":""}]`;
    return callGemini(
        apiKey,
        [{ role: 'user', content: prompt }],
        'You are a content recommendation engine. Reply ONLY with JSON. Use the user\'s preferred language.',
        0.7, 400,
    );
}

async function handleEarningIdeas(apiKey: string, body: RequestBody): Promise<string> {
    const prompt = `Profile: ${JSON.stringify(body.userProfile)}\nHobbies: ${(body.hobbies ?? []).join(', ')}
Suggest 3-5 ways to earn money. Return a JSON array in the user's preferred language.`;
    return callGemini(
        apiKey,
        [{ role: 'user', content: prompt }],
        'You are a career consultant. Reply ONLY with JSON. Detect and use the user\'s language.',
        0.7, 600,
    );
}

async function handleWeeklyPlan(apiKey: string, body: RequestBody): Promise<string> {
    if (!body.hobby) throw new Error('Bad request: missing hobby');
    const hobbyName = ({ chess: 'chess', video_editing: 'video editing', drawing: 'drawing' } as Record<string, string>)[body.hobby] ?? body.hobby;
    const prompt = `Create a weekly plan for "${hobbyName}". Level: ${body.userLevel}. Week: ${body.weekNumber}.
Return JSON in the user's language: [{"day":1,"tasks":["task"],"focus":"topic"}]`;
    return callGemini(
        apiKey,
        [{ role: 'user', content: prompt }],
        'You are a study planner. Reply ONLY with JSON. Use the user\'s preferred language.',
        0.7, 500,
    );
}

async function handleProfileAnalysis(apiKey: string, body: RequestBody): Promise<string> {
    const prompt = `Answers: ${JSON.stringify(body.quizAnswers)}\nBehavior: ${JSON.stringify(body.behaviorData ?? {})}
Analyze and return JSON in the user's language: {"personality_type":"","temperament":"","motivation_style":"","strengths":[],"growth_areas":[]}`;
    return callGemini(
        apiKey,
        [{ role: 'user', content: prompt }],
        'You are a psychoanalyst. Reply ONLY with JSON. Detect and use the user\'s preferred language.',
        0.5, 300,
    );
}

// ── Main handler ─────────────────────────────────────────

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response('ok', { headers: corsHeaders });
        }

        try {
            const apiKey = env.GEMINI_API_KEY;
            if (!apiKey) {
                throw new Error('GEMINI_API_KEY not configured. Run: npx wrangler secret put GEMINI_API_KEY');
            }

            console.log('[ai-proxy] Received request, parsing body...');
            const body: RequestBody = await request.json();
            console.log('[ai-proxy] Request body:', JSON.stringify(body, null, 2));
            const { action } = body;
            if (!action) {
                throw new Error('Bad request: missing action');
            }
            console.log('[ai-proxy] Action:', action);

            let result: string;

            switch (action) {
                case 'sendMessage':
                    result = await handleSendMessage(apiKey, body);
                    break;
                case 'gradeAnswer':
                    result = await handleGradeAnswer(apiKey, body);
                    break;
                case 'getHobbyRecommendations':
                    result = await handleHobbyRecommendations(apiKey, body);
                    break;
                case 'generateDailyTasks':
                    result = await handleDailyTasks(apiKey, body);
                    break;
                case 'generateSubstituteContent':
                    result = await handleSubstituteContent(apiKey, body);
                    break;
                case 'analyzeScreenTimePatterns':
                    result = await handleScreenTimeAnalysis(apiKey, body);
                    break;
                case 'getContentRecommendations':
                    result = await handleContentRecommendations(apiKey, body);
                    break;
                case 'getPersonalizedEarningIdeas':
                    result = await handleEarningIdeas(apiKey, body);
                    break;
                case 'generateWeeklyPlan':
                    result = await handleWeeklyPlan(apiKey, body);
                    break;
                case 'analyzeUserProfile':
                    result = await handleProfileAnalysis(apiKey, body);
                    break;
                default:
                    throw new Error(`Unknown action: ${action}`);
            }

            return new Response(JSON.stringify({ data: result }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            console.error('[ai-proxy] Error details:', {
                message,
                name: error instanceof Error ? error.name : 'Unknown',
                stack: error instanceof Error ? error.stack : undefined,
            });

            let status = 500;
            if (message.startsWith('Unauthorized')) {
                status = 401;
            } else if (message.startsWith('Bad request')) {
                status = 400;
            }
            if (message.includes('429') || message.includes('Quota')) {
                status = 429;
            }

            const errorResponse = {
                error: message,
                timestamp: new Date().toISOString(),
            };
            console.error('[ai-proxy] Error response being sent:', JSON.stringify(errorResponse));

            return new Response(JSON.stringify(errorResponse), {
                status,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
    },
};
