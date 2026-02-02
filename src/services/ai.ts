import OpenAI from 'openai';

// OpenAI / Gemini configuration
const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

// Prefer Gemini if available, otherwise OpenAI (or dummy for safety)
const API_KEY = GEMINI_API_KEY || OPENAI_API_KEY || 'dummy-key';
const IS_GEMINI = !!GEMINI_API_KEY;

const openai = new OpenAI({
    apiKey: API_KEY,
    baseURL: IS_GEMINI ? 'https://generativelanguage.googleapis.com/v1beta/openai/' : undefined,
    dangerouslyAllowBrowser: true,
});

// Model to use
const AI_MODEL = IS_GEMINI ? 'gemini-1.5-flash' : 'gpt-4o-mini';

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

// AI Coach system prompt
const AI_COACH_SYSTEM_PROMPT = `Ты - ИИ-наставник в приложении zenyth.ai. Твоя задача - помогать пользователю с его хобби и личным развитием.

Твои основные функции:
1. Давать советы по выбранному хобби пользователя (шахматы, видео монтаж, рисование)
2. Мотивировать и поддерживать прогресс
3. Помогать с планированием занятий
4. Отвечать на вопросы о техниках и методах обучения

Стиль общения:
- Дружелюбный и поддерживающий
- Конкретный и практичный
- Мотивирующий, но не навязчивый
- Отвечай на русском языке

Если пользователь делится своим прогрессом, обязательно похвали его и дай конструктивный совет для следующего шага.`;

// Hobby-specific prompts
const HOBBY_PROMPTS: Record<string, string> = {
    chess: `Ты специализируешься на шахматах. Твои знания включают:
- Базовые и продвинутые дебюты
- Тактические приёмы (вилки, связки, двойные удары)
- Стратегические принципы
- Эндшпильная техника
- Анализ партий`,

    video_editing: `Ты специализируешься на видео монтаже. Твои знания включают:
- Основы монтажа и ритма
- Работа с программами (DaVinci Resolve, Premiere Pro)
- Цветокоррекция
- Звуковой дизайн
- Эффекты и переходы`,

    drawing: `Ты специализируешься на рисовании. Твои знания включают:
- Основы перспективы
- Анатомия и пропорции
- Светотень и объём
- Композиция
- Различные техники (карандаш, акварель, цифровое рисование)`,
};

export const aiService = {
    // Send message to AI coach
    sendMessage: async (
        messages: ChatMessage[],
        hobby?: string
    ): Promise<string> => {
        try {
            // Build system prompt based on hobby
            let systemPrompt = AI_COACH_SYSTEM_PROMPT;
            if (hobby && HOBBY_PROMPTS[hobby]) {
                systemPrompt += '\n\n' + HOBBY_PROMPTS[hobby];
            }

            const completion = await openai.chat.completions.create({
                model: AI_MODEL,
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...messages,
                ],
                max_tokens: 500,
                temperature: 0.7,
            });

            return completion.choices[0]?.message?.content || 'Извините, не могу ответить сейчас.';
        } catch (error) {
            console.error('AI Service Error:', error);
            throw new Error('Ошибка при обращении к ИИ-наставнику');
        }
    },

    // Get personalized hobby recommendations based on quiz answers
    getHobbyRecommendations: async (
        answers: Record<number, number>
    ): Promise<string[]> => {
        try {
            const prompt = `На основе ответов пользователя на анкету, рекомендуй 3 хобби из списка: шахматы, видео монтаж, рисование.

Ответы пользователя (номер вопроса: индекс выбранного ответа):
${JSON.stringify(answers)}

Верни только JSON массив с ID хобби в порядке приоритета, например: ["chess", "drawing", "video_editing"]`;

            const completion = await openai.chat.completions.create({
                model: AI_MODEL,
                messages: [
                    { role: 'system', content: 'Ты помощник, который анализирует ответы анкеты и рекомендует хобби. Отвечай только JSON массивом.' },
                    { role: 'user', content: prompt },
                ],
                max_tokens: 100,
                temperature: 0.3,
            });

            const response = completion.choices[0]?.message?.content || '[]';
            const parsed = JSON.parse(response.replace(/```json|```/g, '').trim());
            return Array.isArray(parsed) ? parsed : ['chess', 'video_editing', 'drawing'];
        } catch (error) {
            console.error('Hobby Recommendation Error:', error);
            // Default order if AI fails
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
            const hobbyName = {
                chess: 'шахматы',
                video_editing: 'видео монтаж',
                drawing: 'рисование',
            }[hobby] || hobby;

            const prompt = `Создай 2-3 задачи для занятия "${hobbyName}" на ${dayOfWeek} день недели ${weekNumber}.
Задачи должны быть конкретными и выполнимыми за 30-60 минут.
Верни JSON массив строк с задачами на русском языке.`;

            const completion = await openai.chat.completions.create({
                model: AI_MODEL,
                messages: [
                    { role: 'system', content: 'Ты генератор учебных задач. Отвечай только JSON массивом строк.' },
                    { role: 'user', content: prompt },
                ],
                max_tokens: 200,
                temperature: 0.7,
            });

            const response = completion.choices[0]?.message?.content || '[]';
            const parsed = JSON.parse(response.replace(/```json|```/g, '').trim());
            return Array.isArray(parsed) ? parsed : ['Изучить основы', 'Практиковаться 30 минут'];
        } catch (error) {
            console.error('Daily Tasks Error:', error);
            return ['Изучить основы', 'Практиковаться 30 минут'];
        }
    },
};

export default aiService;
