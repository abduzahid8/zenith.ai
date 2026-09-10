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
  python:  'программирование на Python (синтаксис, алгоритмы, практические задачи)',
  reading: 'чтение и работа с информацией (техники чтения, анализ, конспектирование, критическое мышление)',
};

const TASK_TYPE_BY_HOBBY: Record<HobbyId, TaskType[]> = {
  english: ['fill_blank', 'translate', 'free_text'],
  chinese: ['fill_blank', 'translate', 'free_text'],
  chess:   ['chess_puzzle', 'free_text'],
  coding:  ['code', 'free_text'],
  python:  ['code', 'free_text'],
  reading: ['free_text'],
};

// ─────────────────────────────────────────────
// Сервис генерации
// ─────────────────────────────────────────────

/**
 * Canonical prompt construction shared by both generation entry points,
 * so the AI sees byte-identical instructions either way.
 */
function buildGenerationMessages(
  hobby: HobbyId,
  dayNumber: number,
  completedTopics: string[],
  skillLevel: 'beginner' | 'intermediate' = 'beginner',
): ChatMessage[] {
  const taskTypes = TASK_TYPE_BY_HOBBY[hobby];
  const doType = taskTypes[Math.floor(Math.random() * taskTypes.length)];
  const hobbyContext = HOBBY_CONTEXT[hobby];

  const messages: ChatMessage[] = [
    {
      role: 'user',
      content: `Ты — генератор образовательного контента для приложения Zenyth.
Создай 1 урок по теме: "${hobbyContext}".
День обучения пользователя: #${dayNumber}.
Уровень: ${skillLevel === 'beginner' ? 'начинающий' : 'средний'}.
Уже пройденные темы (НЕ ПОВТОРЯЙ): ${completedTopics.length > 0 ? completedTopics.join(', ') : 'нет данных'}.
${hobby === 'chess' ? 'Выбери тип задания: "chess_puzzle".' : `Выбери тип задания: "${doType}".`}

ОТВЕЧАЙ СТРОГО В JSON-ФОРМАТЕ (без markdown-обёртки):
{
  "learn": {
    "title": "Краткое название темы урока",
    "body": "Объяснение темы (3-5 предложений, понятным языком)",
    "keywords": ["термин1", "термин2", "термин3"]
  },
  "do": {
    "type": "${hobby === 'chess' ? 'chess_puzzle' : doType}",
    "prompt": "${hobby === 'chess' ? 'Найди лучший ход (или мат в 1/2 хода) в этой позиции.' : 'Чёткое задание для пользователя'}",
    "correctAnswer": "Правильный ответ (если применимо, иначе null)",
    "hints": ["Подсказка 1", "Подсказка 2"]${hobby === 'chess' ? ',\n    "puzzleFen": "Стартовая позиция в формате FEN (например: 6k1/8/6K1/8/8/8/8/7Q w - - 0 1)",\n    "puzzleMoves": ["Правильные ходы в формате UCI, например: [\\"h1h7\\"]"]' : ''}
  }${hobby === 'chess' ? ',\n  "tests": [\n    {\n      "type": "multiple_choice",\n      "prompt": "Вопрос с 4 вариантами ответа",\n      "options": ["Вариант A", "Вариант B", "Вариант C", "Вариант D"],\n      "correctOptionIndex": 0\n    },\n    {\n      "type": "multiple_choice",\n      "prompt": "Второй вопрос с 4 вариантами ответа",\n      "options": ["Вариант A", "Вариант B", "Вариант C", "Вариант D"],\n      "correctOptionIndex": 1\n    },\n    {\n      "type": "fill_blank",\n      "prompt": "Задание на вставку слов",\n      "blanksText": "Текст с пропусками в виде ___",\n      "wordPool": ["слово1", "слово2", "слово3"],\n      "correctOrder": ["слово1", "слово2"]\n    },\n    {\n      "type": "fill_blank",\n      "prompt": "Второй тест на вставку слов",\n      "blanksText": "Текст с пропусками в виде ___",\n      "wordPool": ["слово1", "слово2", "слово3"],\n      "correctOrder": ["слово1", "слово2"]\n    },\n    {\n      "type": "free_text",\n      "prompt": "Открытый вопрос по теме теории",\n      "correctAnswer": "Эталонный правильный ответ"\n    }\n  ]' : ''}
}

ПРАВИЛА:
- Давай новую тему, не из пройденных
- Язык: русский (объяснения) + изучаемый язык (примеры)
- Для chess_puzzle — сгенерируй легальный и простой puzzleFen и puzzleMoves (1-2 полухода, например, мат в 1 ход или взятие фигуры). Сгенерируй короткий совет для шахматной задачи в поле "prompt". Он должен занимать ровно 2 строки на мобильном экране. Не используй координаты, не раскрывай точный ход, не превышай 95 символов и не делай его короче 75 символов. Пример хорошего совета: "Найди фигуру без защиты. Иногда лучший ход — просто забрать то, что соперник оставил."
- Для code — включи starterCode как часть prompt
- Не используй markdown в body и prompt`,
    },
  ];
  return messages;
}

/**
 * Fresh AI generation with explicit source contract (no cache involved).
 * AI/parse success -> { source: 'generated' }; any failure -> hand-built
 * fallback lesson with { source: 'fallback' }. Callers persist source
 * alongside their own cache entries — never infer it from lesson ids.
 */
async function fetchFreshLesson(
  hobby: HobbyId,
  dayNumber: number,
  messages: ChatMessage[],
): Promise<{ lesson: LessonContent; source: 'generated' | 'fallback' }> {
  let generatedLesson: Partial<LessonContent> = {};

  try {
    const response = await aiService.sendMessage(messages);

    // Парсим JSON из ответа более надежно
    let raw = '';
    if (typeof response === 'string') {
      const mdMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (mdMatch) {
        raw = mdMatch[1];
      } else {
        const firstBrace = response.indexOf('{');
        const lastBrace = response.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1) {
          raw = response.substring(firstBrace, lastBrace + 1);
        } else {
          raw = response;
        }
      }
    } else {
      raw = JSON.stringify(response);
    }

    const parsed = JSON.parse(raw);
    generatedLesson = parsed;
  } catch (e) {
    console.warn('[lessonGenerator] AI generation error:', e);
    // Fallback: возвращаем шаблонный урок с честным источником
    return { lesson: lessonGeneratorService.getFallbackLesson(hobby, dayNumber), source: 'fallback' as const };
  }

  // Собираем полный объект урока
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
    tests: generatedLesson.tests,
  };
  return { lesson, source: 'generated' as const };
}

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
    const cacheKey = `lesson_gen_v2_${hobby}_day${dayNumber}`;

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

    const messages = buildGenerationMessages(hobby, dayNumber, completedTopics, skillLevel);

    const fresh = await fetchFreshLesson(hobby, dayNumber, messages);
    const lesson = fresh.lesson;

    // 4. Кэшируем результат
    try {
      await AsyncStorage.setItem(cacheKey, JSON.stringify(lesson));
    } catch (e) {
      console.warn('[lessonGenerator] Cache write error:', e);
    }

    return lesson;
  },

  /**
   * Генерация с явным источником (v3-кэш хранит { lesson, source }).
   * AI success -> source='generated'; AI/parse failure -> source='fallback'.
   * Старый v2-кэш здесь не читается: у него нет источника.
   */
  generateLessonWithSource: async (
    hobby: HobbyId,
    dayNumber: number,
    completedTopics: string[],
    skillLevel: 'beginner' | 'intermediate' = 'beginner'
  ): Promise<{ lesson: LessonContent; source: 'generated' | 'fallback' }> => {
    const cacheKey = `lesson_gen_v3_${hobby}_day${dayNumber}`;
    try {
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as { lesson?: LessonContent; source?: string };
        if (parsed && parsed.lesson && (parsed.source === 'generated' || parsed.source === 'fallback')) {
          console.log(`[lessonGenerator] Returning cached lesson: ${cacheKey} (${parsed.source})`);
          return { lesson: parsed.lesson as LessonContent, source: parsed.source };
        }
      }
    } catch (e) {
      console.warn('[lessonGenerator] Cache read error:', e);
    }
    // Defer prompt construction to the canonical path by reusing the same
    // inputs generateLesson would use (no duplication of prompt templates).
    const fresh = await fetchFreshLesson(
      hobby,
      dayNumber,
      buildGenerationMessages(hobby, dayNumber, completedTopics, skillLevel),
    );
    try {
      await AsyncStorage.setItem(cacheKey, JSON.stringify(fresh));
    } catch (e) {
      console.warn('[lessonGenerator] Cache write error:', e);
    }
    return fresh;
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
          type: 'chess_puzzle',
          prompt: 'Найди вилку конём — ход, который нападает на короля И ладью одновременно.',
          puzzleFen: 'k7/8/8/8/3R4/8/8/4K1n1 b - - 0 1',
          puzzleMoves: ['g1f3'],
        },
        tests: [
          {
            type: 'multiple_choice',
            prompt: 'Какой тактический приём нападает на две фигуры одновременно?',
            options: ['Связка', 'Вилка', 'Открытый шах', 'Рокировка'],
            correctOptionIndex: 1,
          },
          {
            type: 'multiple_choice',
            prompt: 'Что происходит при «пате»?',
            options: ['Мат королю', 'У игрока нет ходов, но нет шаха (ничья)', 'Выигрыш белых', 'Потеря ферзя'],
            correctOptionIndex: 1,
          },
          {
            type: 'fill_blank',
            prompt: 'Заполни пропуски в шахматных понятиях',
            blanksText: 'Вилка наносит ___ удар, а ___ ограничивает движение фигуры.',
            wordPool: ['двойной', 'связка', 'одинарный', 'мат'],
            correctOrder: ['двойной', 'связка'],
          },
          {
            type: 'fill_blank',
            prompt: 'Вставь пропущенные слова',
            blanksText: 'При связке фигура защищает более ___ фигуру от ___ удара.',
            wordPool: ['ценную', 'прямого', 'дешевую', 'косого'],
            correctOrder: ['ценную', 'прямого'],
          },
          {
            type: 'free_text',
            prompt: 'Объясни своими словами разницу между вилкой и связкой.',
            correctAnswer: 'Вилка нападает на две фигуры сразу, а связка не дает одной фигуре отойти из-за угрозы другой',
          },
        ]
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
      python: {
        id: `python_fallback_d${dayNumber}`,
        hobby: 'python',
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
      reading: {
        id: `reading_fallback_d${dayNumber}`,
        hobby: 'reading',
        day: dayNumber,
        learn: {
          title: 'Повторение: техники чтения',
          body: 'Эффективные техники чтения: SQ3R (просмотр → вопросы → чтение → пересказ → повтор), активное чтение с пометками, skimming (быстрый просмотр), scanning (поиск информации), метод Cornell для конспектов.',
          keywords: ['SQ3R', 'активное чтение', 'skimming', 'Cornell', 'конспект'],
        },
        do: {
          type: 'free_text',
          prompt: 'Прочитай любую короткую статью, применив хотя бы одну технику чтения, и запиши: что прочитал, какую технику применил, что понял нового.',
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
