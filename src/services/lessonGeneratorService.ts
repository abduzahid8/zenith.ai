/**
 * lessonGeneratorService.ts
 * AI-генератор уроков для Zenyth.AI.
 * Используется когда пользователь прошёл статические 7 дней урока
 * и нуждается в новом контенте на Day 8+.
 * Генерирует через Gemini (через aiService), кэширует в AsyncStorage.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { aiService, ChatMessage } from './ai';
import { HobbyId, LessonContent, TaskType } from '../data/lessonContent';

// ─────────────────────────────────────────────
// Промпт-шаблоны по хобби
// ─────────────────────────────────────────────

const HOBBY_CONTEXT: Record<HobbyId, string> = {
  english: 'английский язык (грамматика, лексика, разговорные навыки)',
  chinese: 'китайский язык (иероглифы, пиньинь, базовые фразы, тоны)',
  chess:   'шахматы (стратегия, тактика, дебюты, эндшпили)',
  coding:  'программирование на Python (синтаксис, алгоритмы, практические задачи)',
};

const TASK_TYPE_BY_HOBBY: Record<HobbyId, TaskType[]> = {
  english: ['fill_blank', 'translate', 'free_text'],
  chinese: ['fill_blank', 'translate', 'free_text'],
  chess:   ['chess_puzzle', 'free_text'],
  coding:  ['code', 'free_text'],
};

// ─────────────────────────────────────────────
// Сервис генерации
// ─────────────────────────────────────────────

export const lessonGeneratorService = {

  /**
   * Генерирует новый урок через Gemini AI.
   * Сначала проверяет кэш в AsyncStorage — если урок уже был сгенерирован,
   * возвращает его без запроса к API.
   */
  generateLesson: async (
    hobby: HobbyId,
    dayNumber: number,
    completedTopics: string[],
    skillLevel: 'beginner' | 'intermediate' = 'beginner'
  ): Promise<LessonContent> => {
    const cacheKey = `lesson_gen_${hobby}_day${dayNumber}`;

    // 1. Проверяем кэш
    try {
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        console.log(`[lessonGenerator] Returning cached lesson: ${cacheKey}`);
        return JSON.parse(cached) as LessonContent;
      }
    } catch (e) {
      console.warn('[lessonGenerator] Cache read error:', e);
    }

    // 2. Генерируем через AI
    console.log(`[lessonGenerator] Generating lesson for ${hobby} day ${dayNumber}`);

    const taskTypes = TASK_TYPE_BY_HOBBY[hobby];
    const doType = taskTypes[Math.floor(Math.random() * taskTypes.length)];
    const hobbyContext = HOBBY_CONTEXT[hobby];

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `Ты — генератор образовательного контента для приложения Zenyth.
Создай 1 урок по теме: "${hobbyContext}".
День обучения пользователя: #${dayNumber}.
Уровень: ${skillLevel === 'beginner' ? 'начинающий' : 'средний'}.
Уже пройденные темы (НЕ ПОВТОРЯЙ): ${completedTopics.length > 0 ? completedTopics.join(', ') : 'нет данных'}.
Выбери тип задания: "${doType}".

ОТВЕЧАЙ СТРОГО В JSON-ФОРМАТЕ (без markdown-обёртки):
{
  "learn": {
    "title": "Краткое название темы урока",
    "body": "Объяснение темы (3-5 предложений, понятным языком)",
    "keywords": ["термин1", "термин2", "термин3"]
  },
  "do": {
    "type": "${doType}",
    "prompt": "Чёткое задание для пользователя",
    "correctAnswer": "Правильный ответ (если применимо, иначе null)",
    "hints": ["Подсказка 1", "Подсказка 2"]
  }
}

ПРАВИЛА:
- Давай новую тему, не из пройденных
- Язык: русский (объяснения) + изучаемый язык (примеры)
- Для chess_puzzle — не включай puzzleFen (его нет в AI)
- Для code — включи starterCode как часть prompt
- Не используй markdown в body и prompt`,
      },
    ];

    let generatedLesson: Partial<LessonContent> = {};

    try {
      const response = await aiService.sendMessage(messages);

      // Парсим JSON из ответа (aiService может вернуть строку)
      const raw = typeof response === 'string'
        ? response.replace(/```json|```/g, '').trim()
        : JSON.stringify(response);

      const parsed = JSON.parse(raw);
      generatedLesson = parsed;
    } catch (e) {
      console.error('[lessonGenerator] AI generation error:', e);
      // Fallback: возвращаем шаблонный урок
      return lessonGeneratorService.getFallbackLesson(hobby, dayNumber);
    }

    // 3. Собираем полный объект урока
    const lesson: LessonContent = {
      id: `${hobby}_gen_d${dayNumber}`,
      hobby,
      day: dayNumber,
      learn: generatedLesson.learn ?? {
        title: 'Новая тема',
        body: 'Продолжай изучение...',
        keywords: [],
      },
      do: generatedLesson.do ?? {
        type: 'free_text',
        prompt: 'Напиши всё, что запомнил из прошлых уроков.',
      },
    };

    // 4. Кэшируем результат
    try {
      await AsyncStorage.setItem(cacheKey, JSON.stringify(lesson));
    } catch (e) {
      console.warn('[lessonGenerator] Cache write error:', e);
    }

    return lesson;
  },

  /**
   * Fallback-урок на случай ошибки API или отсутствия сети.
   */
  getFallbackLesson: (hobby: HobbyId, dayNumber: number): LessonContent => {
    const fallbacks: Record<HobbyId, LessonContent> = {
      english: {
        id: `english_fallback_d${dayNumber}`,
        hobby: 'english',
        day: dayNumber,
        learn: {
          title: 'Повторение: разговорные фразы',
          body: 'Сегодня повторим полезные разговорные фразы. "How are you?" — "Fine, thanks!" "What do you do?" — "I\'m a student." "Where are you from?" — "I\'m from Russia."',
          keywords: ['разговорные фразы', 'greeting', 'small talk'],
        },
        do: {
          type: 'free_text',
          prompt: 'Напиши короткий диалог из 4 реплик, используя разговорные фразы из урока.',
          hints: ['Начни с приветствия', 'Спроси о профессии или происхождении'],
        },
      },
      chinese: {
        id: `chinese_fallback_d${dayNumber}`,
        hobby: 'chinese',
        day: dayNumber,
        learn: {
          title: 'Повторение: ключевые иероглифы',
          body: '好 (hǎo) — хорошо. 大 (dà) — большой. 小 (xiǎo) — маленький. 人 (rén) — человек. 日 (rì) — день/солнце. 月 (yuè) — месяц/луна. 水 (shuǐ) — вода. 火 (huǒ) — огонь.',
          keywords: ['иероглиф', '好', '大', '小', '人'],
        },
        do: {
          type: 'free_text',
          prompt: 'Запиши по памяти 5 иероглифов с их значениями и произношением (пиньинь).',
        },
      },
      chess: {
        id: `chess_fallback_d${dayNumber}`,
        hobby: 'chess',
        day: dayNumber,
        learn: {
          title: 'Повторение: тактические мотивы',
          body: 'Основные тактические приёмы: 1) Вилка — нападение на две фигуры одновременно. 2) Связка — фигура не может ходить, не подставив более ценную. 3) Открытый шах — ход открывает линию атаки на короля. 4) Двойной шах — два шаха одновременно.',
          keywords: ['вилка', 'связка', 'открытый шах', 'двойной шах', 'тактика'],
        },
        do: {
          type: 'free_text',
          prompt: 'Объясни своими словами разницу между вилкой и связкой. Приведи пример каждого.',
        },
      },
      coding: {
        id: `coding_fallback_d${dayNumber}`,
        hobby: 'coding',
        day: dayNumber,
        learn: {
          title: 'Повторение: основы Python',
          body: 'Ключевые конструкции Python: переменные (x = 5), условия (if x > 0:), циклы (for i in range(10):), функции (def my_func():), ввод (input()), вывод (print()).',
          keywords: ['переменная', 'условие', 'цикл', 'функция', 'Python'],
        },
        do: {
          type: 'code',
          prompt: 'Напиши программу, которая спрашивает число от пользователя и определяет: положительное оно, отрицательное или ноль.',
          starterCode: 'number = float(input("Введи число: "))\n# Напиши условия\n',
        },
      },
    };

    return fallbacks[hobby];
  },

  /**
   * Получить список тем, пройденных пользователем.
   * Используется для промпта генерации, чтобы не повторять темы.
   */
  getCompletedTopics: (artifacts: Array<{ lessonId: string; hobbyId: string }>, hobby: HobbyId): string[] => {
    return artifacts
      .filter(a => a.hobbyId === hobby)
      .map(a => a.lessonId)
      .slice(0, 20); // Берём последние 20 для промпта
  },
};
