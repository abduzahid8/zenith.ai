// AI Service — proxied through Cloudflare Worker
// API key is kept server-side in the Worker secret.
// To fall back to local Gemini (key in bundle): set USE_LOCAL_AI = true

import { localAiService } from './gemini';

const USE_LOCAL_AI = false;
const AI_PROXY_URL =
    process.env.EXPO_PUBLIC_AI_PROXY_URL ?? 'https://ai-proxy.ppolqx065.workers.dev';

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

// ── Helper: call the Cloudflare Worker ai-proxy ──────────

async function invokeAI<T>(action: string, payload: Record<string, unknown>): Promise<T> {
    console.log('[AI Service] Calling worker action:', action);

    const response = await fetch(AI_PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
    });

    console.log('[AI Service] Response status:', response.status);

    const json = await response.json() as { data?: unknown; error?: string; timestamp?: string };

    if (!response.ok) {
        const message = json.error ?? `Worker error ${response.status}`;
        console.warn(`[AI Service] Worker error (${action}):`, json);
        throw new Error(message);
    }

    const raw = json.data;
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
        hobby?: string,
        userContext?: string
    ): Promise<string> => {
        const enrichedMessages: ChatMessage[] = [];
        if (userContext) {
            enrichedMessages.push({
                role: 'system',
                content: 'Current user app data (use this to answer questions about their activity):\n' + userContext + '\n\nAnswer concisely: explain progress, what it means, what to do next. Not too short, not too long. The app has already chosen the user\'s next action (see "Canonical next action" in the data when present) — explain and encourage that action; do not invent a different activity.',
            });
        }
        enrichedMessages.push(...messages);

        if (USE_LOCAL_AI) {
            return localAiService.sendMessage(enrichedMessages, hobby);
        }
        try {
            return await invokeAI<string>('sendMessage', { messages: enrichedMessages, hobby });
        } catch (error) {
            const status = (error as any)?.context?.status ?? (error as any)?.status;
            if (status === 429) {
                return 'Too many requests. Please wait 10-20 seconds and try again.';
            }
            return 'Sorry, I cannot answer right now. Check your connection or try again later.';
        }
    },

    gradeAnswer: async (
        messages: ChatMessage[],
        hobby?: string
    ): Promise<string> => {
        if (USE_LOCAL_AI) {
            return (localAiService as any).gradeAnswer(messages, hobby);
        }
        try {
            return await invokeAI<string>('gradeAnswer', { 
                messages: messages, 
                hobby
            });
        } catch (error) {
            console.warn('[AI Service] Worker gradeAnswer failed, falling back to local Gemini service:', error);
            try {
                return await (localAiService as any).gradeAnswer(messages, hobby);
            } catch (fallbackError) {
                console.error('[AI Service] Local fallback also failed:', fallbackError);
                return JSON.stringify({
                    status: 'incorrect',
                    title: 'Ошибка проверки',
                    explanation: 'Ошибка проверки. Попробуйте еще раз.'
                });
            }
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
            return Array.isArray(parsed) ? parsed : ['Learn basics', 'Practice 30 mins'];
        } catch {
            return ['Learn basics', 'Practice 30 mins'];
        }
    },

    // Generate personalised daily coaching content for a goal snapshot
    generateDailyCoaching: async (prompt: string): Promise<string> => {
      if (USE_LOCAL_AI) {
        return (localAiService as any).generateDailyCoaching(prompt);
      }
      try {
        // Worker returns raw text (or JSON-stringified text). We want the
        // raw string — not auto-parsed JSON — because the caller parses it.
        const response = await fetch(AI_PROXY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'generateDailyCoaching', prompt }),
        });
        const json = await response.json().catch(() => ({} as any));
        if (!response.ok) return '';
        const raw = json.data;
        if (typeof raw === 'string') return raw;
        if (raw && typeof raw === 'object') return JSON.stringify(raw);
        return '';
      } catch {
        return '';
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
                message: parsed.message || 'Want to do something useful?',
                action: parsed.action || 'Open the app and start session',
            };
        } catch {
            return {
                type: 'reminder',
                message: 'Have a minute? Maybe practice instead of scrolling? 🎯',
                action: 'Start 15-min session',
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

    // Decompose a goal into today's next action
    decomposeDailyAction: async (
        goalSnapshot: {
            hobby: string;
            goalDescription: string;
            percentComplete: number;
            daysRemaining: number;
            projectedCompletion: string;
            unitsRemaining: number;
            dailyRateNeeded: number;
            currentDay: number;
            category: string;
        }
    ): Promise<string> => {
        const isExecution = goalSnapshot.category === 'execution';

        if (isExecution) {
            const { getRecommendations } = await import('../data/toolRecommendations');
            const pattern = getRecommendations(goalSnapshot.goalDescription);
            if (pattern) {
                const topRec = pattern.recommendations[0];
                return `Focus on: ${pattern.bottleneck} Try ${topRec.name} — ${topRec.reason}`;
            }
        }

        if (USE_LOCAL_AI) {
            return (localAiService as any).decomposeDailyAction(goalSnapshot);
        }
        try {
            const parsed = await invokeAI<string>('decomposeDailyAction', { goalSnapshot });
            if (isExecution) {
                return parsed || 'Run your numbers — every check-in moves the needle. Log your count today.';
            }
            return parsed || 'Continue with today\'s lesson — every session brings you closer to your goal.';
        } catch {
            if (isExecution) {
                return 'Run your numbers — every check-in moves the needle. Log your count today.';
            }
            return 'Continue with today\'s lesson — every session brings you closer to your goal.';
        }
    },

    // Propose measurable proxies for an execution goal with no natural count
    proposeMetrics: async (
        goalDescription: string
    ): Promise<Array<{
        label: string;
        unit: string;
        startingValue: number;
        target: number;
        deadlineDays: number;
        reasoning: string;
    }>> => {
        const payload = { goalDescription };
        if (USE_LOCAL_AI) {
            try {
                return await (localAiService as any).proposeMetrics(goalDescription);
            } catch {
                return [];
            }
        }
        try {
            const parsed = await invokeAI<Array<Record<string, unknown>>>('proposeMetrics', payload);
            return Array.isArray(parsed) ? parsed.map((p: any) => ({
                label: p.label || 'Progress',
                unit: p.unit || 'units',
                startingValue: typeof p.startingValue === 'number' ? p.startingValue : 0,
                target: typeof p.target === 'number' ? p.target : 10,
                deadlineDays: typeof p.deadlineDays === 'number' ? p.deadlineDays : 90,
                reasoning: p.reasoning || '',
            })) : [];
        } catch {
            return [];
        }
    },

    // Break an execution goal into strategic milestones
    breakDownMilestones: async (
        goalDescription: string,
        metricLabel: string,
        target: number,
        unit: string
    ): Promise<Array<{
        label: string;
        target: number;
        unit: string;
    }>> => {
        const payload = { goalDescription, metricLabel, target, unit };
        if (USE_LOCAL_AI) {
            try {
                return await (localAiService as any).breakDownMilestones(goalDescription, metricLabel, target, unit);
            } catch {
                return [];
            }
        }
        try {
            const parsed = await invokeAI<Array<Record<string, unknown>>>('breakDownMilestones', payload);
            return Array.isArray(parsed) ? parsed.map((m: any) => ({
                label: m.label || 'Phase',
                target: typeof m.target === 'number' ? m.target : Math.ceil(target / 3),
                unit: m.unit || unit,
            })) : [];
        } catch {
            const p1 = Math.ceil(target * 0.4);
            const p2 = Math.ceil(target * 0.35);
            return [
                { label: 'Phase 1: Foundation', target: p1, unit },
                { label: 'Phase 2: Momentum', target: p2, unit },
                { label: 'Phase 3: Finish', target: target - p1 - p2, unit },
            ];
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
                personality_type: (parsed.personality_type as string) || 'Analyst',
                temperament: (parsed.temperament as string) || 'Balanced',
                motivation_style: (parsed.motivation_style as string) || 'Soft',
                strengths: (parsed.strengths as string[]) || ['Determination'],
                growth_areas: (parsed.growth_areas as string[]) || ['Regular practice'],
            };
        } catch {
            return {
                personality_type: 'Analyst',
                temperament: 'Balanced',
                motivation_style: 'Soft',
                strengths: ['Determination'],
                growth_areas: ['Regular practice'],
            };
        }
    },

    // Generate a goal-specific Plan-of-Attack: a tile sequence sized to the
    // user's free-form description, target, unit and deadline. Returns an
    // empty array on any failure so the caller can fall back to a heuristic.
    generatePlanOfAttack: async (input: {
        description: string;
        category: string;
        target: number;
        startingValue: number;
        unit: string;
        deadline: string;
        startDate: string;
    }): Promise<{ summary: string; steps: Array<{ label: string; detail?: string; day?: number; estimatedMinutes?: number }> }> => {
        if (USE_LOCAL_AI) {
            try {
                return await (localAiService as any).generatePlanOfAttack(input);
            } catch {
                return { summary: '', steps: [] };
            }
        }
        try {
            const parsed = await invokeAI<{ summary?: string; steps?: Array<{ label?: string; detail?: string; day?: number; estimatedMinutes?: number }> }>(
                'generatePlanOfAttack', input
            );
            const summary = typeof parsed.summary === 'string' ? parsed.summary : '';
            const steps = Array.isArray(parsed.steps)
                ? parsed.steps.map((s: any) => ({
                    label: String(s?.label || '').slice(0, 120),
                    detail: String(s?.detail || '').slice(0, 280),
                    day: typeof s?.day === 'number' ? s.day : undefined,
                    estimatedMinutes: typeof s?.estimatedMinutes === 'number' ? s.estimatedMinutes : undefined,
                })).filter((s: any) => s.label)
                : [];
            return { summary, steps };
        } catch {
            return { summary: '', steps: [] };
        }
    },

    // Recommend 1 ranked tool given a free-text bottleneck. The caller may
    // pre-supply a catalog of tools/URLs to constrain the answer to safe picks.
    recommendToolsForBottleneck: async (input: {
        goalDescription: string;
        bottleneck: string;
        allowedTools?: Array<{ name: string; reason: string; url?: string; cost?: string; setup?: string }>;
    }): Promise<Array<{ name: string; reason: string; url?: string; cost?: string; setup?: string }>> => {
        if (USE_LOCAL_AI) {
            try {
                return await (localAiService as any).recommendToolsForBottleneck(input);
            } catch {
                return [];
            }
        }
        try {
            const parsed = await invokeAI<Array<{ name?: string; reason?: string; url?: string; cost?: string; setup?: string }>>(
                'recommendToolsForBottleneck', input
            );
            return (Array.isArray(parsed) ? parsed : [])
                .map((r: any) => ({
                    name: String(r?.name || '').slice(0, 80),
                    reason: String(r?.reason || '').slice(0, 200),
                    url: r?.url && typeof r.url === 'string' ? r.url : undefined,
                    cost: r?.cost && typeof r.cost === 'string' ? r.cost : undefined,
                    setup: r?.setup && typeof r.setup === 'string' ? r.setup : undefined,
                }))
                .filter((r: any) => r.name);
        } catch {
            return [];
        }
    },
};

export default aiService;
