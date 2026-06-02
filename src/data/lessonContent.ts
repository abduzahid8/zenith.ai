/**
 * lessonContent.ts
 * Типизированный банк уроков для геймификации Zenyth.AI
 * 4 хобби × 7 дней = 28 уроков.
 * После 7-го дня контент генерируется через lessonGeneratorService.
 */

import { ChessPuzzleMove } from './chessPuzzlesBank';

export type HobbyId = 'english' | 'chess' | 'chinese' | 'coding';

export type TaskType =
  | 'fill_blank'      // Заполни пропуск (вставка слов-чипов)
  | 'multiple_choice' // Выбор одного из 4 вариантов ABCD
  | 'translate'       // Перевод
  | 'chess_puzzle'    // Шахматная задача (интерактивная доска, через Lichess)
  | 'free_text'       // Свободный ответ
  | 'code';           // Запуск Python-кода

export interface TaskStep {
  type: TaskType;
  prompt: string;             // Задание/вопрос
  hints?: string[];           // Подсказки
  correctAnswer?: string;     // Для автопроверки fill_blank/translate/free_text
  // Для multiple_choice
  options?: string[];         // 4 варианта ответа (ABCD)
  correctOptionIndex?: number; // Индекс правильного варианта (0-3)
  // Для fill_blank (слова-чипы)
  blanksText?: string;        // Текст с пропусками в виде ___
  wordPool?: string[];        // Пул слов-чипов для вставки
  correctOrder?: string[];    // Правильный порядок слов по пропускам
  // Для chess_puzzle
  puzzleFen?: string;         // Позиция FEN (для fallback без Lichess)
  puzzleMoves?: string[];     // Правильные ходы UCI
  puzzles?: {
    fen: string;
    moves?: string[];
    solution?: ChessPuzzleMove[];
    successExplanation?: string;
    failureExplanation?: string;
    prompt: string;
    hints?: string[];
  }[];
  // Для code
  starterCode?: string;       // Стартовый код в редакторе
}

export interface LessonContent {
  id: string;           // Уникальный идентификатор, напр. "english_d1"
  hobby: HobbyId;
  day: number;          // 1-7 (статические) или 8+ (AI-генерированные)
  learn: {
    title: string;        // Заголовок теории
    body: string;         // Текст урока
    keywords: string[];   // Кликабельные термины для объяснения через AI
  };
  do: TaskStep;           // Основное задание (для не-шахматных хобби)
  tests?: TaskStep[];     // 5 тестов (для шахмат: 2 ABCD + 2 FillBlank + 1 FreeText)
  deepen1?: TaskStep;     // @deprecated — используется только для legacy. Premium = повторные сессии
  deepen2?: TaskStep;     // @deprecated — используется только для legacy. Premium = повторные сессии
}

// ─────────────────────────────────────────────
// 🇬🇧 АНГЛИЙСКИЙ — 7 дней
// ─────────────────────────────────────────────
const englishLessons: LessonContent[] = [
  {
    id: 'english_d1',
    hobby: 'english',
    day: 1,
    learn: {
      title: 'Present Simple: Настоящее простое',
      body: 'Present Simple используется для описания регулярных действий, привычек и фактов. Структура: подлежащее + глагол (+ s/es для 3-го лица). Маркеры: always, usually, often, sometimes, never. Пример: "She reads every morning." (Она читает каждое утро.)',
      keywords: ['Present Simple', 'подлежащее', 'глагол', 'маркеры времени'],
    },
    do: {
      type: 'fill_blank',
      prompt: 'Вставь правильную форму глагола: She ___ (go) to school every day.',
      correctAnswer: 'goes',
      hints: ['Для 3-го лица ед. числа добавляем -s или -es'],
    },
    deepen1: {
      type: 'translate',
      prompt: 'Переведи на английский: "Я обычно пью кофе утром."',
      correctAnswer: 'I usually drink coffee in the morning.',
    },
    deepen2: {
      type: 'free_text',
      prompt: 'Напиши 3 предложения о своём распорядке дня, используя Present Simple.',
    },
  },
  {
    id: 'english_d2',
    hobby: 'english',
    day: 2,
    learn: {
      title: 'Present Continuous: Действие прямо сейчас',
      body: 'Present Continuous описывает действие, которое происходит прямо сейчас или в данный период. Структура: am/is/are + глагол-ing. Пример: "I am studying English right now." (Я сейчас изучаю английский.) Нельзя использовать с глаголами состояния: know, love, want, see.',
      keywords: ['Present Continuous', 'am/is/are', 'глаголы состояния'],
    },
    do: {
      type: 'fill_blank',
      prompt: 'Вставь правильную форму: They ___ (watch) a movie right now.',
      correctAnswer: 'are watching',
      hints: ['Подлежащее they → are', 'Добавь -ing к глаголу watch'],
    },
    deepen1: {
      type: 'translate',
      prompt: 'Переведи: "Он сейчас разговаривает по телефону."',
      correctAnswer: 'He is talking on the phone right now.',
    },
    deepen2: {
      type: 'free_text',
      prompt: 'Опиши 3 вещи, которые происходят вокруг тебя прямо сейчас, используя Present Continuous.',
    },
  },
  {
    id: 'english_d3',
    hobby: 'english',
    day: 3,
    learn: {
      title: 'Past Simple: Прошедшее простое',
      body: 'Past Simple описывает завершённые действия в прошлом. Правильные глаголы: добавляем -ed (work → worked). Неправильные глаголы учим наизусть (go → went, see → saw). Отрицание: did not (didn\'t) + инфинитив. Вопрос: Did + подлежащее + инфинитив?',
      keywords: ['Past Simple', 'правильные глаголы', 'неправильные глаголы', 'did'],
    },
    do: {
      type: 'fill_blank',
      prompt: 'Вставь правильную форму: Yesterday I ___ (go) to the gym.',
      correctAnswer: 'went',
      hints: ['go — неправильный глагол', 'go → went в прошедшем времени'],
    },
    deepen1: {
      type: 'translate',
      prompt: 'Переведи: "Вчера она не смотрела телевизор."',
      correctAnswer: "She didn't watch TV yesterday.",
    },
    deepen2: {
      type: 'free_text',
      prompt: 'Напиши 3 предложения о том, что ты делал(а) вчера, используя Past Simple.',
    },
  },
  {
    id: 'english_d4',
    hobby: 'english',
    day: 4,
    learn: {
      title: 'Future Simple: Будущее (will)',
      body: 'Will используется для спонтанных решений, обещаний и предсказаний. Структура: will + инфинитив. Отрицание: will not (won\'t). Пример: "I will call you tomorrow." (Я позвоню тебе завтра.) Be going to — для запланированных действий: "I am going to visit my parents this weekend."',
      keywords: ['Future Simple', 'will', 'won\'t', 'be going to'],
    },
    do: {
      type: 'fill_blank',
      prompt: 'Вставь правильную форму: I think it ___ (rain) tomorrow.',
      correctAnswer: 'will rain',
      hints: ['Предсказание → используем will', 'will + инфинитив без to'],
    },
    deepen1: {
      type: 'translate',
      prompt: 'Переведи: "Я собираюсь начать учить испанский в следующем месяце."',
      correctAnswer: 'I am going to start learning Spanish next month.',
    },
    deepen2: {
      type: 'free_text',
      prompt: 'Напиши 3 предложения о своих планах на следующую неделю, используя will и going to.',
    },
  },
  {
    id: 'english_d5',
    hobby: 'english',
    day: 5,
    learn: {
      title: 'Present Perfect: Опыт и результаты',
      body: 'Present Perfect связывает прошлое с настоящим. Структура: have/has + причастие прошедшего времени (V3). Используется для: опыта (Have you ever...?), результатов (I have finished my homework), недавних событий (She has just arrived). Маркеры: already, yet, just, ever, never.',
      keywords: ['Present Perfect', 'have/has', 'V3', 'ever', 'never', 'already'],
    },
    do: {
      type: 'fill_blank',
      prompt: 'Вставь правильную форму: I ___ (never/visit) Paris before.',
      correctAnswer: "I've never visited Paris before.",
      hints: ['never → ставится между have и V3', 'visit → visited (правильный глагол)'],
    },
    deepen1: {
      type: 'translate',
      prompt: 'Переведи: "Ты уже поел(а)?"',
      correctAnswer: 'Have you eaten yet?',
    },
    deepen2: {
      type: 'free_text',
      prompt: 'Напиши 3 предложения о своём жизненном опыте, используя "Have you ever...?" и Present Perfect.',
    },
  },
  {
    id: 'english_d6',
    hobby: 'english',
    day: 6,
    learn: {
      title: 'Модальные глаголы: can, must, should',
      body: 'Модальные глаголы выражают возможность, обязанность и совет. Can — умение/разрешение ("I can swim."). Must — строгая обязанность ("You must wear a seatbelt."). Should — совет ("You should sleep more."). После модальных глаголов всегда инфинитив без to.',
      keywords: ['модальные глаголы', 'can', 'must', 'should', 'инфинитив'],
    },
    do: {
      type: 'fill_blank',
      prompt: 'Выбери подходящий модальный глагол: You ___ eat more vegetables. It\'s good for your health. (can/should/must)',
      correctAnswer: 'should',
      hints: ['should = совет', 'must = строгое требование/закон', 'can = умение или разрешение'],
    },
    deepen1: {
      type: 'translate',
      prompt: 'Переведи: "Тебе не следует пропускать уроки."',
      correctAnswer: "You shouldn't skip classes.",
    },
    deepen2: {
      type: 'free_text',
      prompt: 'Напиши 3 совета для человека, который хочет выучить английский, используя should/shouldn\'t.',
    },
  },
  {
    id: 'english_d7',
    hobby: 'english',
    day: 7,
    learn: {
      title: 'Повторение: все основные времена',
      body: 'Подведём итог первой недели! Ты изучил(а) 5 времён: Present Simple (привычки), Present Continuous (сейчас), Past Simple (прошлое), Future Simple/will (будущее), Present Perfect (опыт). Ключевое правило: смотри на маркеры времени — они подскажут, какое время использовать.',
      keywords: ['времена глагола', 'маркеры времени', 'Present', 'Past', 'Future', 'Perfect'],
    },
    do: {
      type: 'fill_blank',
      prompt: 'Выбери правильное время: "When I was 10, I ___ (play) chess every day."',
      correctAnswer: 'played',
      hints: ['When I was 10 → прошлое время', 'every day → регулярное действие, но в прошлом → Past Simple'],
    },
    deepen1: {
      type: 'translate',
      prompt: 'Переведи весь абзац: "Я изучаю английский уже три месяца. Вчера я выучил 20 новых слов. Завтра я буду практиковаться с носителем языка."',
      correctAnswer: "I have been studying English for three months. Yesterday I learned 20 new words. Tomorrow I will practice with a native speaker.",
    },
    deepen2: {
      type: 'free_text',
      prompt: 'Напиши небольшой рассказ (5-7 предложений) о себе, используя минимум 4 разных времени. Можешь подчеркнуть каждое время.',
    },
  },
];

// ─────────────────────────────────────────────
// 🇨🇳 КИТАЙСКИЙ — 7 дней
// ─────────────────────────────────────────────
const chineseLessons: LessonContent[] = [
  {
    id: 'chinese_d1',
    hobby: 'chinese',
    day: 1,
    learn: {
      title: 'Тоны китайского языка',
      body: 'В китайском языке 4 тона + нейтральный. От тона зависит смысл слова! Тон 1 (ˉ): высокий ровный — mā (妈, мама). Тон 2 (ˊ): восходящий — má (麻, конопля). Тон 3 (ˇ): нисходяще-восходящий — mǎ (马, лошадь). Тон 4 (ˋ): нисходящий — mà (骂, ругать). Нейтральный: ma (吗, вопросительная частица).',
      keywords: ['тон', 'пиньинь', 'иероглиф', 'произношение'],
    },
    do: {
      type: 'fill_blank',
      prompt: 'Как произносится слово "мама" по-китайски? Запиши тон: mā / má / mǎ / mà',
      correctAnswer: 'mā',
      hints: ['Мама — это что-то нежное и ровное', 'Первый тон — ровный, высокий'],
    },
    deepen1: {
      type: 'free_text',
      prompt: 'Произнеси вслух и запиши транскрипцию: 妈 (мама), 马 (лошадь), 骂 (ругать). Что разного в этих словах?',
    },
    deepen2: {
      type: 'translate',
      prompt: 'Переведи на русский: mā má mǎ mà ma',
      correctAnswer: 'мама, конопля, лошадь, ругать, (вопрос)',
    },
  },
  {
    id: 'chinese_d2',
    hobby: 'chinese',
    day: 2,
    learn: {
      title: 'Базовые приветствия',
      body: '你好 (nǐ hǎo) — Привет/Здравствуйте. 你好吗? (nǐ hǎo ma?) — Как дела? 我很好 (wǒ hěn hǎo) — Я хорошо. 谢谢 (xiè xie) — Спасибо. 不客气 (bù kè qi) — Пожалуйста. 再见 (zài jiàn) — До свидания. Запомни: 我 (wǒ) = я, 你 (nǐ) = ты, 他/她 (tā) = он/она.',
      keywords: ['你好', '谢谢', '再见', '我', '你', '他'],
    },
    do: {
      type: 'translate',
      prompt: 'Как сказать "Спасибо" по-китайски?',
      correctAnswer: '谢谢 (xiè xie)',
      hints: ['Это очень распространённое слово', 'Оно произносится дважды — xiè xiè'],
    },
    deepen1: {
      type: 'free_text',
      prompt: 'Составь мини-диалог из 4 реплик: поздоровайся, спроси как дела, ответь, попрощайся. Используй иероглифы и пиньинь.',
    },
    deepen2: {
      type: 'fill_blank',
      prompt: '我 ___ 好 (wǒ ___ hǎo) — Я хорошо. Вставь пропущенное слово.',
      correctAnswer: '很',
      hints: ['Это слово означает "очень"', 'hěn — степень качества'],
    },
  },
  {
    id: 'chinese_d3',
    hobby: 'chinese',
    day: 3,
    learn: {
      title: 'Цифры от 1 до 10',
      body: '一 yī (1), 二 èr (2), 三 sān (3), 四 sì (4), 五 wǔ (5), 六 liù (6), 七 qī (7), 八 bā (8), 九 jiǔ (9), 十 shí (10). Интересный факт: число 8 (八, bā) считается очень счастливым в Китае, потому что звучит похоже на 发 (fā) — процветание!',
      keywords: ['цифры', '一二三四五', 'счастливое число 8', 'иероглифы чисел'],
    },
    do: {
      type: 'fill_blank',
      prompt: 'Запиши иероглиф для числа 5: _ (wǔ)',
      correctAnswer: '五',
      hints: ['Пять — это середина', 'Пять пальцев на руке'],
    },
    deepen1: {
      type: 'translate',
      prompt: 'Переведи на китайский (иероглифы + пиньинь): 3, 7, 10',
      correctAnswer: '三 sān, 七 qī, 十 shí',
    },
    deepen2: {
      type: 'free_text',
      prompt: 'Запиши по памяти все 10 цифр от 1 до 10 на китайском (иероглифы и/или пиньинь).',
    },
  },
  {
    id: 'chinese_d4',
    hobby: 'chinese',
    day: 4,
    learn: {
      title: 'Базовые фразы: Я хочу...',
      body: '我想... (wǒ xiǎng...) — Я хочу... 我要... (wǒ yào...) — Я хочу/мне нужно... (более настойчиво). Примеры: 我想喝水 (wǒ xiǎng hē shuǐ) — Я хочу пить воды. 我要一杯茶 (wǒ yào yī bēi chá) — Мне чашку чая. 喝 (hē) = пить, 吃 (chī) = есть, 水 (shuǐ) = вода, 茶 (chá) = чай.',
      keywords: ['我想', '我要', '喝', '吃', '水', '茶'],
    },
    do: {
      type: 'translate',
      prompt: 'Переведи на китайский: "Я хочу есть."',
      correctAnswer: '我想吃 (wǒ xiǎng chī)',
      hints: ['我 = я', '想 = хочу', '吃 = есть (пищу)'],
    },
    deepen1: {
      type: 'free_text',
      prompt: 'Составь 3 предложения о том, что ты хочешь прямо сейчас, используя 我想 или 我要.',
    },
    deepen2: {
      type: 'fill_blank',
      prompt: '我想___(hē)水 — Я хочу пить воды. Вставь иероглиф.',
      correctAnswer: '喝',
      hints: ['喝 = пить'],
    },
  },
  {
    id: 'chinese_d5',
    hobby: 'chinese',
    day: 5,
    learn: {
      title: 'Семья: основные слова',
      body: '爸爸 (bàba) — папа. 妈妈 (māma) — мама. 哥哥 (gēge) — старший брат. 弟弟 (dìdi) — младший брат. 姐姐 (jiějie) — старшая сестра. 妹妹 (mèimei) — младшая сестра. 爷爷 (yéye) — дедушка. 奶奶 (nǎinai) — бабушка. В китайском важно различать старшего и младшего сиблинга!',
      keywords: ['семья', '爸爸', '妈妈', '哥哥', '弟弟', '姐姐', '妹妹'],
    },
    do: {
      type: 'translate',
      prompt: 'Переведи на русский: 爸爸 和 妈妈 (hé = и)',
      correctAnswer: 'папа и мама',
      hints: ['爸爸 = папа', '妈妈 = мама', '和 = и'],
    },
    deepen1: {
      type: 'free_text',
      prompt: 'Расскажи о своей семье на китайском, используя слова из урока. Минимум 3 предложения.',
    },
    deepen2: {
      type: 'fill_blank',
      prompt: '___ (gēge) — старший брат. Запиши иероглифы.',
      correctAnswer: '哥哥',
    },
  },
  {
    id: 'chinese_d6',
    hobby: 'chinese',
    day: 6,
    learn: {
      title: 'Вопросы: что? где? когда?',
      body: '什么 (shénme) — что? 哪里 (nǎlǐ) — где? 什么时候 (shénme shíhou) — когда? 为什么 (wèishénme) — почему? 谁 (shéi) — кто? Примеры: 这是什么? (zhè shì shénme?) — Что это? 你在哪里? (nǐ zài nǎlǐ?) — Где ты?',
      keywords: ['什么', '哪里', '什么时候', '为什么', '谁', 'вопросительные слова'],
    },
    do: {
      type: 'translate',
      prompt: 'Переведи вопрос: "Что это?"',
      correctAnswer: '这是什么? (zhè shì shénme?)',
      hints: ['这 (zhè) = это', '是 (shì) = есть/является', '什么 = что'],
    },
    deepen1: {
      type: 'free_text',
      prompt: 'Составь 3 вопроса о своём городе на китайском, используя 什么, 哪里 и 什么时候.',
    },
    deepen2: {
      type: 'fill_blank',
      prompt: '你在___ (nǎlǐ)? — Где ты? Вставь пропущенное слово.',
      correctAnswer: '哪里',
    },
  },
  {
    id: 'chinese_d7',
    hobby: 'chinese',
    day: 7,
    learn: {
      title: 'Повторение: лучшие фразы недели',
      body: 'За неделю ты изучил(а): тоны, приветствия, цифры 1-10, "я хочу...", семью и вопросительные слова. Самые важные фразы: 你好 (привет), 谢谢 (спасибо), 我想要 (я хочу), 你在哪里 (где ты). Продолжай в том же духе — через месяц ты сможешь общаться на базовые темы!',
      keywords: ['повторение', '你好', '谢谢', '数字', '家人', '问题'],
    },
    do: {
      type: 'free_text',
      prompt: 'Напиши мини-рассказ о себе на китайском (5-7 предложений): как тебя зовут, где живёшь, что хочешь, кто есть в семье.',
    },
    deepen1: {
      type: 'translate',
      prompt: 'Переведи диалог: "— Привет! Как дела? — Хорошо, спасибо! А ты? — Тоже хорошо."',
      correctAnswer: '— 你好！你好吗？— 我很好，谢谢！你呢？— 我也很好。',
    },
    deepen2: {
      type: 'fill_blank',
      prompt: '我___(hěn)好。— Я хорошо. Вставь пропущенное слово.',
      correctAnswer: '很',
    },
  },
];

// ─────────────────────────────────────────────
// ♟ ШАХМАТЫ — 7 дней
// ─────────────────────────────────────────────
const chessLessons: LessonContent[] = [
  {
    id: 'chess_d1',
    hobby: 'chess',
    day: 1,
    learn: {
      title: 'Как ходят фигуры',
      body: 'Шахматы — это игра на 8×8 клетках. Фигуры: Король ходит на 1 клетку в любом направлении. Ферзь — самая сильная фигура, ходит на любое количество клеток по прямой и диагонали. Ладья — только по прямым линиям. Слон — только по диагонали. Конь — буквой "Г" (2+1 клетки). Пешка — вперёд на 1 клетку (первый ход — на 2), бьёт по диагонали.',
      keywords: ['Король', 'Ферзь', 'Ладья', 'Слон', 'Конь', 'Пешка'],
    },
    do: {
      type: 'chess_puzzle',
      prompt: 'Реши серию из 8 обучающих задач на правила движения всех фигур!',
      puzzleFen: '4k3/8/8/8/8/8/8/4K3 w - - 0 1',
      puzzleMoves: ['e1e2'],
      puzzles: [
        {
          fen: '4k3/8/8/8/8/8/8/4K3 w - - 0 1',
          moves: ['e1e2'],
          prompt: 'Король — самая важная фигура, но ходит медленно, всего на одну клетку в любую сторону. Сделай шаг королем вперед.',
          hints: [
            'Король может переместиться на любую соседнюю клетку.',
            'Посмотри на клетку прямо перед белым королем.',
            'Сделай ход с e1 на e2.'
          ]
        },
        {
          fen: '4k3/r7/8/8/8/8/8/R3K3 w - - 0 1',
          moves: ['a1a7'],
          prompt: 'Ладья передвигается по прямой — по горизонтали и вертикали. Черная ладья подставилась под удар. Забери ее!',
          hints: [
            'Ладья на a1 может пойти вверх по всей вертикали \'a\'.',
            'Найди черную фигуру на этой вертикали.',
            'Сыграй ладьей с a1 на a7, чтобы совершить взятие.'
          ]
        },
        {
          fen: '4k3/8/8/6n1/8/8/8/2B1K3 w - - 0 1',
          moves: ['c1g5'],
          prompt: 'Слон ходит только по диагоналям своего цвета. Твой слон — белопольный. Найди и забери незащищенного черного коня.',
          hints: [
            'Посмотри, какая черная фигура стоит на одной диагонали со слоном c1.',
            'Диагональ тянется от c1 до самого королевского фланга.',
            'Сделай ход слоном с c1 на g5.'
          ]
        },
        {
          fen: '4k3/8/8/7p/8/8/8/3QK3 w - - 0 1',
          moves: ['d1h5'],
          prompt: 'Ферзь — самая мощная фигура. Он сочетает силу ладьи и слона. Забери черную пешку на краю доски.',
          hints: [
            'Ферзь на d1 может пойти по диагонали вправо и вверх.',
            'В конце этой диагонали стоит одинокая черная пешка.',
            'Сделай ход ферзем с d1 на h5.'
          ]
        },
        {
          fen: '4k3/8/8/8/8/8/8/4K1N1 w - - 0 1',
          moves: ['g1f3'],
          prompt: 'Конь передвигается необычно — буквой «Г» (две клетки в одну сторону и одна в бок). Сделай развивающий ход конем в центр.',
          hints: [
            'Из угла конь на g1 может прыгнуть на f3 или h3.',
            'Ход ближе к центру (на f3) считается более активным.',
            'Прыгни конем на f3.'
          ]
        },
        {
          fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          moves: ['e2e4'],
          prompt: 'Пешка ходит только вперед. Но со стартовой позиции она может прыгнуть сразу на две клетки. Захвати центр королевской пешкой!',
          hints: [
            'Ход e2-e4 открывает дорогу твоему слону и ферзю.',
            'Сделай широкий шаг этой пешкой на два поля вперед.',
            'Сыграй e2-e4.'
          ]
        },
        {
          fen: '4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1',
          moves: ['e4d5'],
          prompt: 'Пешка ходит прямо, но бьет по диагонали на одну клетку. Забери черную пешку, которая преграждает путь.',
          hints: [
            'Твоя пешка стоит на e4, а черная на d5.',
            'Диагональный шаг вправо-вверх позволяет совершить взятие.',
            'Побей пешку: e4-d5.'
          ]
        },
        {
          fen: '4k3/8/8/8/8/8/3p4/1N2K3 w - - 0 1',
          moves: ['b1d2'],
          prompt: 'Конь — единственная фигура, которая умеет перепрыгивать через другие. Черная пешка объявила шах королю. Забери ее конем!',
          hints: [
            'Твой король в опасности из-за пешки на d2.',
            'Конь на b1 может перепрыгнуть на d2 и спасти короля.',
            'Забери пешку ходом коня: b1-d2.'
          ]
        }
      ]
    },
    tests: [
      {
        type: 'multiple_choice',
        prompt: 'Какая фигура ходит буквой «Г»?',
        options: ['Слон', 'Ладья', 'Конь', 'Ферзь'],
        correctOptionIndex: 2,
      },
      {
        type: 'multiple_choice',
        prompt: 'Сколько клеток ходит Король за один ход?',
        options: ['На 2 клетки', 'Только по диагонали', 'Сколько угодно', 'Только на 1 клетку'],
        correctOptionIndex: 3,
      },
      {
        type: 'fill_blank',
        prompt: 'Вставь правильные слова',
        blanksText: 'Ферзь ходит по ___ и по ___. Ладья ходит только по ___.',
        wordPool: ['диагонали', 'прямым линиям', 'вертикалям', 'прямым и диагонали'],
        correctOrder: ['прямым и диагонали', 'диагонали', 'прямым линиям'],
      },
      {
        type: 'fill_blank',
        prompt: 'Вставь правильные слова',
        blanksText: 'Пешка бьёт ___, а ходит ___. В первый ход пешка может пойти на ___ клетки.',
        wordPool: ['по диагонали', 'вперёд', '2', '1', '3'],
        correctOrder: ['по диагонали', 'вперёд', '2'],
      },
      {
        type: 'free_text',
        prompt: 'Объясни своими словами: как ходит конь? Почему его ход называют «Г-образным»?',
        correctAnswer: 'Конь ходит на 2 клетки в одну сторону и 1 клетку перпендикулярно',
      },
    ]
  },
  {
    id: 'chess_d2',
    hobby: 'chess',
    day: 2,
    learn: {
      title: 'Chess Economics',
      body: 'Not all pieces are equal. Memorize the scale: Pawn=1, Knight=3, Bishop=3, Rook=5, Queen=9. The King is priceless. A trade is good if you capture more value than you lose. But always check: is the captured piece truly undefended? Can the opponent recapture with advantage? The goal is not just to trade — it\'s to come out ahead.',
      keywords: ['piece value', 'material', 'trade', 'advantage'],
    },
    do: {
      type: 'chess_puzzle',
      prompt: 'Реши серию из 8 задач на оценку ценности фигур и выгодные размены!',
      puzzleFen: '4k3/8/8/3q4/4P3/8/8/4K3 w - - 0 1',
      puzzleMoves: ['e4d5'],
      puzzles: [
        {
          fen: '4k3/8/8/3q4/4P3/8/8/4K3 w - - 0 1',
          moves: ['e4d5'],
          prompt: 'Пешка стоит 1 очко, а ферзь — целых 9! Найди невероятно выгодное взятие для белых.',
          hints: [
            'Твоя пешка на e4 может побить черную фигуру по диагонали.',
            'Черный ферзь неосторожно встал под бой пешки.',
            'Побей ферзя пешкой: e4-d5.'
          ]
        },
        {
          fen: '4k3/8/8/6r1/8/5N2/8/4K3 w - - 0 1',
          moves: ['f3g5'],
          prompt: 'Конь стоит 3 очка, а ладья — 5. Выиграй более дорогую фигуру соперника.',
          hints: [
            'Твой конь на f3 присматривается к королевскому флангу.',
            'Черная ладья на g5 осталась без защиты.',
            'Забери ладью конем: f3-g5.'
          ]
        },
        {
          fen: '4k3/5r2/8/8/2B5/8/8/4K3 w - - 0 1',
          moves: ['c4f7'],
          prompt: 'Слон (3 очка) и ладья (5 очков) — неравные по силе фигуры. Выменяй своего слона на более ценную ладью черных.',
          hints: [
            'Твой слон на c4 целится прямо в ладью f7.',
            'Взятие ладьи принесет белым материальный перевес.',
            'Сыграй слоном c4 на f7.'
          ]
        },
        {
          fen: '3n4/8/8/8/8/8/8/3QK2k w - - 0 1',
          moves: ['d1d8'],
          prompt: 'Ферзь (9 очков) легко справляется с одинокими фигурами. Забери черного коня (3 очка), пока он не убежал.',
          hints: [
            'Ферзь на d1 может атаковать по всей вертикали \'d\'.',
            'Черный конь на d8 никем не защищен.',
            'Сделай ход ферзем с d1 на d8.'
          ]
        },
        {
          fen: 'q3k3/8/8/8/8/8/8/R3K3 w - - 0 1',
          moves: ['a1a8'],
          prompt: 'Черный ферзь (9 очков) грозит твоему королю. Но твоя ладья (5 очков) может сама забрать его. Сделай выгодный размен!',
          hints: [
            'Ладья на a1 видит черного ферзя на противоположном конце доски.',
            'Обменять ладью на ферзя — отличная сделка.',
            'Забери ферзя ладьей: a1-a8.'
          ]
        },
        {
          fen: '4k3/8/8/3p4/4p3/2N5/8/4K3 w - - 0 1',
          moves: ['c3d5'],
          prompt: 'Твой конь может забрать черную пешку на d5 или на e4. Но будь осторожен: одна из пешек защищена другой! Выбери безопасное взятие.',
          hints: [
            'Помни, что черные пешки ходят сверху вниз и бьют по диагонали.',
            'Пешка d5 защищает пешку e4. Если взять на e4, твоего коня съедят.',
            'Забери незащищенную пешку на d5 ходом c3-d5.'
          ]
        },
        {
          fen: '4k3/7b/8/8/8/8/8/4K2R w - - 0 1',
          moves: ['h1h7'],
          prompt: 'Ладья (5 очков) сильнее слона (3 очка). Твоя ладья готова забрать слона соперника на противоположном конце доски. Сделай этот ход.',
          hints: [
            'Ладья на h1 может передвигаться вертикально вверх.',
            'Черный слон на h7 беззащитен.',
            'Сыграй ладьей на h7, выигрывая фигуру.'
          ]
        },
        {
          fen: '3r2k1/8/8/8/3Q4/8/8/4K3 w - - 0 1',
          moves: ['d4d8'],
          prompt: 'Твой ферзь может съесть черную ладью. Ладья защищена только королем, но ферзь настолько силен, что это все равно выгодно! Сделай лучший ход.',
          hints: [
            'Ферзь на d4 видит ладью на d8.',
            'Ферзь стоит 9 очков, а ладья — 5. После размена у белых останется огромный перевес.',
            'Забери ладью ферзем: d4-d8.'
          ]
        }
      ]
    },
    tests: [
      {
        type: 'multiple_choice',
        prompt: 'Сколько пешек стоит Ферзь?',
        options: ['5 пешек', '7 пешек', '9 пешек', '3 пешки'],
        correctOptionIndex: 2,
      },
      {
        type: 'multiple_choice',
        prompt: 'Что выгоднее: взять ладью или слона?',
        options: ['Слона — они равны', 'Ладью — она стоит 5 пешек', 'Слона — он стоит 5', 'Они одинаковые'],
        correctOptionIndex: 1,
      },
      {
        type: 'fill_blank',
        prompt: 'Вставь правильные значения',
        blanksText: 'Конь стоит ___ пешки, Ладья — ___ пешек, а Ферзь — ___ пешек.',
        wordPool: ['3', '5', '9', '1', '7'],
        correctOrder: ['3', '5', '9'],
      },
      {
        type: 'fill_blank',
        prompt: 'Вставь правильные слова',
        blanksText: 'Если соперник предлагает обменять Ферзя на Ладью, это ___ для тебя, потому что ферзь стоит ___ пешек.',
        wordPool: ['невыгодно', 'выгодно', '9', '5'],
        correctOrder: ['невыгодно', '9'],
      },
      {
        type: 'free_text',
        prompt: 'Объясни: когда конь может быть сильнее слона? Придумай ситуацию.',
        correctAnswer: 'Конь может быть сильнее слона в закрытых позициях или когда он занимает сильную клетку',
      },
    ]
  },
  {
    id: 'chess_d3',
    hobby: 'chess',
    day: 3,
    learn: {
      title: 'Opening Initiative',
      body: 'The opening is a race for activity. Three rules: 1) FIGHT FOR THE CENTER — control e4, d4, e5, d5 with pawns. 2) DEVELOP — bring out knights and bishops quickly. Never move the same piece twice without reason. 3) KING SAFETY — castle before attacking. Every move should either develop a piece, secure the king, or fight for the center. Wasted tempos lose games.',
      keywords: ['opening', 'center', 'development', 'tempo', 'initiative'],
    },
    do: {
      type: 'chess_puzzle',
      prompt: 'Реши серию из 8 задач на закрепление трех золотых принципов дебюта!',
      puzzleFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      puzzleMoves: ['e2e4'],
      puzzles: [
        {
          fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          moves: ['e2e4'],
          prompt: 'Принцип дебюта №1: борись за центр! Займи центральное поле e4 своей королевской пешкой.',
          hints: [
            'Ход e2-e4 открывает дорогу твоему слону и ферзю.',
            'Сделай широкий шаг этой пешкой на два поля вперед.',
            'Сыграй e2e4.'
          ]
        },
        {
          fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
          moves: ['e7e5'],
          prompt: 'Играешь за черных. Белые захватили центр пешкой e4. Ответь им тем же и заяви свои права на центр!',
          hints: [
            'Черная королевская пешка тоже может прыгнуть на две клетки вперед.',
            'Сделай симметричный ход пешкой перед черным королем.',
            'Сыграй e7-e5.'
          ]
        },
        {
          fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
          moves: ['g1f3'],
          prompt: 'Принцип дебюта №2: развивай легкие фигуры (коней и слонов). Выведи коня на активную позицию, нападая на пешку соперника.',
          hints: [
            'Королевский конь на g1 хочет пойти в бой.',
            'Поле f3 идеально: конь оттуда контролирует центр и атакует пешку e5.',
            'Сыграй конем на f3.'
          ]
        },
        {
          fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2',
          moves: ['b8c6'],
          prompt: 'Играешь за черных. Твоя пешка e5 под боем белого коня. Развей коня на c6, чтобы одновременно защитить пешку.',
          hints: [
            'Развивай ферзевого коня с b8.',
            'С поля c6 конь будет надежно охранять пешку e5.',
            'Сделай ход конем на c6.'
          ]
        },
        {
          fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
          moves: ['f1c4'],
          prompt: 'Выведи белопольного слона f1 на активную диагональ, целясь в слабое поле f7 около черного короля.',
          hints: [
            'Слон на f1 готов выйти на простор.',
            'Поле c4 — отличная стоянка для слона, откуда он грозит сопернику.',
            'Сделай ход слоном на c4.'
          ]
        },
        {
          fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3',
          moves: ['g8f6'],
          prompt: 'Играешь за черных. Пора развивать королевского коня. Выведи его на f6, чтобы контратаковать белую пешку e4.',
          hints: [
            'Конь на g8 ждет твоего приказа.',
            'Поле f6 — самое естественное и сильное для этого коня.',
            'Сыграй конем на f6.'
          ]
        },
        {
          fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
          moves: ['e1g1'],
          prompt: 'Принцип дебюта №3: безопасность короля! Сделай рокировку, чтобы спрятать короля в угол и ввести ладью в игру.',
          hints: [
            'Все фигуры между королем e1 и ладьей h1 уже вышли.',
            'Сделай рокировку в короткую сторону: передвинь короля на два поля вправо.',
            'Сыграй королем с e1 на g1 (рокировка произойдет автоматически).'
          ]
        },
        {
          fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQ1RK1 b kq - 5 4',
          moves: ['f8c5'],
          prompt: 'Играешь за черных. Твой слон на f8 пока заперт. Выведи его на активное поле c5, чтобы тоже подготовить рокировку.',
          hints: [
            'Черный слон f8 может пойти по открывшейся диагонали.',
            'Поле c5 зеркально копирует позицию белого слона.',
            'Сделай ход слоном на c5.'
          ]
        }
      ]
    },
    tests: [
      {
        type: 'multiple_choice',
        prompt: 'Первый принцип дебюта — это:',
        options: ['Рокировка', 'Занять центр', 'Развить ферзя', 'Атаковать сразу'],
        correctOptionIndex: 1,
      },
      {
        type: 'multiple_choice',
        prompt: 'Почему нельзя ходить одной фигурой дважды в дебюте?',
        options: ['Это запрещено правилами', 'Теряешь темп развития', 'Фигура устаёт', 'Нет причин'],
        correctOptionIndex: 1,
      },
      {
        type: 'fill_blank',
        prompt: 'Вставь правильные слова',
        blanksText: 'В дебюте нужно занять ___, вывести ___ и сделать ___.',
        wordPool: ['центр', 'рокировку', 'фигуры', 'пешку', 'шах'],
        correctOrder: ['центр', 'фигуры', 'рокировку'],
      },
      {
        type: 'fill_blank',
        prompt: 'Вставь правильные слова',
        blanksText: 'Хорошие пешечные ходы в дебюте: ___ и ___. Они занимают центр.',
        wordPool: ['e4', 'd4', 'a4', 'h4', 'g4'],
        correctOrder: ['e4', 'd4'],
      },
      {
        type: 'free_text',
        prompt: 'Объясни своими словами все 3 принципа дебюта. Почему важен именно такой порядок?',
        correctAnswer: 'Центр, развитие фигур, безопасность короля через рокировку',
      },
    ]
  },
  {
    id: 'chess_d4',
    hobby: 'chess',
    day: 4,
    learn: {
      title: 'King Safety',
      body: 'Castling is the only move that moves two pieces at once. Short castle (O-O): King to g1, Rook to f1. Long castle (O-O-O): King to c1, Rook to d1. Castling is illegal if: the king has already moved, the rook has already moved, any piece is between them, the king is in check, or the king would pass through an attacked square. A king stuck in the center is a target.',
      keywords: ['castling', 'king safety', 'short castle', 'long castle'],
    },
    do: {
      type: 'chess_puzzle',
      prompt: 'Реши серию из 8 задач на освоение короткой и длинной рокировки!',
      puzzleFen: 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1',
      puzzleMoves: ['e1g1'],
      puzzles: [
        {
          fen: 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1',
          moves: ['e1g1'],
          prompt: 'Рокировка защищает твоего короля. Сделай короткую рокировку (в сторону королевского фланга) за белых.',
          hints: [
            'Король должен сдвинуться на две клетки вправо.',
            'Перемести короля e1 на g1, ладья сама встанет на f1.',
            'Сделай ход e1g1.'
          ]
        },
        {
          fen: 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1',
          moves: ['e1c1'],
          prompt: 'А теперь попробуй сделать длинную рокировку (в сторону ферзевого фланга) за белых. Она уводит короля еще дальше.',
          hints: [
            'Король делает два шага влево.',
            'Перемести короля e1 на c1, ладья a1 встанет на d1.',
            'Сделай ход e1c1.'
          ]
        },
        {
          fen: 'r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1',
          moves: ['e8g8'],
          prompt: 'Сделай короткую рокировку за черных, чтобы обезопасить их короля.',
          hints: [
            'Играешь черными. Черный король должен сделать два шага вправо.',
            'Перемести короля e8 на g8.',
            'Сделай ход e8g8.'
          ]
        },
        {
          fen: 'r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1',
          moves: ['e8c8'],
          prompt: 'Сделай длинную рокировку за черных, уводя короля на ферзевый фланг.',
          hints: [
            'Играешь черными. Король должен сместиться на две клетки влево.',
            'Перемести короля e8 на c8.',
            'Сделай ход e8c8.'
          ]
        },
        {
          fen: 'r3k2r/8/8/8/8/8/8/R3K1NR w Qkq - 0 1',
          moves: ['g1f3'],
          prompt: 'Короткая рокировка невозможна, так как конь g1 преграждает путь. Освободи дорогу королю и ладье!',
          hints: [
            'Королю нужен свободный путь на g1.',
            'Сделай развивающий ход конем с g1 на f3.',
            'Сыграй g1-f3.'
          ]
        },
        {
          fen: 'r3k2r/8/8/8/8/8/8/RN2K2R w Kkq - 0 1',
          moves: ['b1c3'],
          prompt: 'Длинная рокировка заблокирована конем на b1. Развей коня в центр доски, освобождая путь для рокировки.',
          hints: [
            'Конь мешает королю пройти на c1.',
            'Выведи коня b1 на активное поле c3.',
            'Сыграй b1-c3.'
          ]
        },
        {
          fen: 'r3k2r/8/8/8/8/8/4r3/R3K2R w KQkq - 0 1',
          moves: ['e1f1'],
          prompt: 'Твой король находится под шахом черной ладьи e2. Запомни: рокироваться из-под шаха строго запрещено! Уйди королем в безопасное место.',
          hints: [
            'Король должен просто отступить, так как рокировка заблокирована шахом.',
            'Поле f1 — безопасная клетка для короля.',
            'Сделай ход e1-f1.'
          ]
        },
        {
          fen: 'r3k2r/8/8/8/b7/8/8/R3K2R w KQkq - 0 1',
          moves: ['e1g1'],
          prompt: 'Черный слон на a4 простреливает поле d1. Рокироваться через битое поле нельзя! Выбери безопасную короткую рокировку.',
          hints: [
            'При длинной рокировке король должен пересечь поле d1, которое атакует слон.',
            'Короткая рокировка полностью безопасна, так как поля f1 и g1 никто не атакует.',
            'Сделай короткую рокировку: e1-g1.'
          ]
        }
      ]
    },
    tests: [
      {
        type: 'multiple_choice',
        prompt: 'При короткой рокировке куда идёт король у белых?',
        options: ['На c1', 'На f1', 'На g1', 'На h1'],
        correctOptionIndex: 2,
      },
      {
        type: 'multiple_choice',
        prompt: 'Когда нельзя делать рокировку?',
        options: ['Если конь стоит на b1', 'Если король уже ходил', 'Если у соперника 2 ладьи', 'В первые 3 хода'],
        correctOptionIndex: 1,
      },
      {
        type: 'fill_blank',
        prompt: 'Вставь правильные слова',
        blanksText: 'Рокировка невозможна если между королём и ладьёй ___ фигуры, или если король ___ шаха.',
        wordPool: ['стоят', 'нет', 'под', 'далеко от'],
        correctOrder: ['стоят', 'под'],
      },
      {
        type: 'fill_blank',
        prompt: 'Вставь правильные слова',
        blanksText: 'При длинной рокировке белых, король встаёт на ___, а ладья на ___.',
        wordPool: ['c1', 'd1', 'b1', 'a1', 'e1'],
        correctOrder: ['c1', 'd1'],
      },
      {
        type: 'free_text',
        prompt: 'Назови 3 ситуации, когда рокировка невозможна. Почему каждое из этих правил важно?',
        correctAnswer: 'Король ходил, ладья ходила, между ними фигуры, король под шахом, проходит через атакованное поле',
      },
    ]
  },
  {
    id: 'chess_d5',
    hobby: 'chess',
    day: 5,
    learn: {
      title: 'Check, Mate & Stalemate',
      body: 'CHECK: the king is attacked. Three ways out: capture the attacker, block the check, or move the king. CHECKMATE: check with no escape — you win. STALEMATE: the king is not in check but has no legal moves — it\'s a draw. Beginners often stalemate when winning. Always ask: "Is the king in check? Does he have a safe square?" The difference between mate and stalemate is the difference between winning and drawing.',
      keywords: ['check', 'checkmate', 'stalemate', 'defense', 'draw'],
    },
    do: {
      type: 'chess_puzzle',
      prompt: 'Реши серию из 8 задач на защиту от шаха, мат и предотвращение пата!',
      puzzleFen: '4r1k1/8/8/8/8/8/8/4K1B1 w - - 0 1',
      puzzleMoves: ['g1e3'],
      puzzles: [
        {
          fen: '4r1k1/8/8/8/8/8/8/4K1B1 w - - 0 1',
          moves: ['g1e3'],
          prompt: 'Твоему королю объявили шах ладьей по линии \'e\'. Закрой короля от шаха своим слоном g1.',
          hints: [
            'Не обязательно ходить королем. Можно поставить фигуру на пути ладьи.',
            'Слон на g1 может встать на поле e3 и заблокировать шах.',
            'Сделай ход g1-e3.'
          ]
        },
        {
          fen: '4r1k1/8/8/8/8/8/8/4K3 w - - 0 1',
          moves: ['e1f1'],
          prompt: 'Король под шахом ладьи, а защитников нет. Уведи короля в безопасное место на королевском фланге.',
          hints: [
            'Король должен сделать шаг в сторону от линии \'e\'.',
            'Поле f1 — безопасный приют для короля.',
            'Сыграй e1-f1.'
          ]
        },
        {
          fen: '7k/5Q2/6K1/8/8/8/8/8 w - - 0 1',
          moves: ['f7f8'],
          prompt: 'Поставь мат в один ход! Черный король заперт в углу, ферзю нужно лишь нанести решающий удар на последней горизонтали.',
          hints: [
            'Ферзь должен напасть на короля так, чтобы у того не было спасительных ходов.',
            'Перемести ферзя на самую верхнюю линию — поле f8.',
            'Сыграй f7-f8.'
          ]
        },
        {
          fen: '6k1/6pp/8/8/8/8/8/5RK1 w - - 0 1',
          moves: ['f1f8'],
          prompt: 'Потренируйся объявлять шах. Отправь свою ладью на последнюю горизонталь.',
          hints: [
            'Ладья на f1 может пойти прямо вверх.',
            'Напади на черного короля на поле f8.',
            'Сыграй f1-f8.'
          ]
        },
        {
          fen: '7k/8/5K2/8/8/8/8/6Q1 w - - 0 1',
          moves: ['g1g7'],
          prompt: 'Король и ферзь вместе — грозное оружие. Поставь мат в один ход, подведя ферзя вплотную к черному королю под защиту твоего короля.',
          hints: [
            'Белый король на f6 контролирует поле g7.',
            'Ферзь может безопасно встать на g7, объявляя мат.',
            'Сыграй g1-g7.'
          ]
        },
        {
          fen: '7k/8/5K2/8/8/8/8/6Q1 w - - 0 1',
          moves: ['g1g6'],
          prompt: 'Будь осторожен с патом! Сделай ход g1-g6 и посмотри, как черному королю некуда ходить, хотя шаха нет. Это ничья (пат).',
          hints: [
            'При пате у слабейшей стороны нет ни одного легального хода, и король не атакован.',
            'Ход g1-g6 полностью запирает короля черных без шаха.',
            'Сыграй g1-g6, чтобы зафиксировать пат.'
          ]
        },
        {
          fen: '7k/8/6K1/8/8/8/8/5Q2 w - - 0 1',
          moves: ['f1f8'],
          prompt: 'Исправь ошибку из предыдущей задачи! Поставь чистый мат черному королю на f8, не допуская пата.',
          hints: [
            'Ферзь на f1 должен атаковать по вертикали \'f\'.',
            'Ход на f8 объявляет шах и мат одновременно.',
            'Сыграй f1-f8.'
          ]
        },
        {
          fen: '7k/8/6K1/8/8/8/8/5Q2 w - - 0 1',
          moves: ['f1f7'],
          prompt: 'Еще одна типичная ошибка новичка — сыграть f1-f7. Сделай этот ход, чтобы увидеть, как игра снова завершается патом.',
          hints: [
            'Черный король не находится под шахом, но все клетки вокруг него перекрыты.',
            'Ход f1-f7 не оставляет черным ходов.',
            'Сделай патовый ход f1-f7.'
          ]
        }
      ]
    },
    tests: [
      {
        type: 'multiple_choice',
        prompt: 'Что такое «пат»?',
        options: ['Нападение на короля', 'Нет ходов, но нет шаха — ничья', 'Победа за белых', 'Шах без защиты'],
        correctOptionIndex: 1,
      },
      {
        type: 'multiple_choice',
        prompt: 'Как можно защититься от шаха?',
        options: ['Только уйти королём', 'Уйти, закрыться или взять фигуру', 'Только взять атакующую фигуру', 'Сделать рокировку'],
        correctOptionIndex: 1,
      },
      {
        type: 'fill_blank',
        prompt: 'Вставь правильные слова',
        blanksText: 'Мат — это ___, от которого нет ___. Партия при мате ___.',
        wordPool: ['шах', 'защиты', 'заканчивается', 'продолжается', 'пат'],
        correctOrder: ['шах', 'защиты', 'заканчивается'],
      },
      {
        type: 'fill_blank',
        prompt: 'Вставь правильные слова',
        blanksText: 'Если ты проигрываешь, ищи ___. Это означает что у соперника нет ___, но и шаха нет.',
        wordPool: ['пат', 'мат', 'ходов', 'фигур'],
        correctOrder: ['пат', 'ходов'],
      },
      {
        type: 'free_text',
        prompt: 'Чем отличается мат от пата? Приведи пример, когда пат выгоден проигрывающей стороне.',
        correctAnswer: 'Мат — шах без защиты (проигрыш), пат — нет ходов без шаха (ничья). Пат спасает когда проигрываешь',
      },
    ]
  },
  {
    id: 'chess_d6',
    hobby: 'chess',
    day: 6,
    learn: {
      title: 'Tactical Weapons',
      body: 'A fork (or double attack) is one piece attacking two enemy pieces at once. The opponent can only save one. Knights are the best forking pieces — they attack in L-shapes that other pieces don\'t cover. A royal fork (attacking king + queen) is devastating. Bishops fork along diagonals, rooks along ranks/files, pawns can fork too. Always scan for forks before moving.',
      keywords: ['fork', 'double attack', 'knight', 'tactics', 'royal fork'],
    },
    do: {
      type: 'chess_puzzle',
      prompt: 'Реши серию из 8 задач на применение коварных вилок и двойных ударов!',
      puzzleFen: '3q3k/8/8/6N1/8/8/8/4K3 w - - 0 1',
      puzzleMoves: ['g5f7'],
      puzzles: [
        {
          fen: '3q3k/8/8/6N1/8/8/8/4K3 w - - 0 1',
          moves: ['g5f7'],
          prompt: 'Вилка конем — один из самых коварных приемов! Объяви шах черному королю и одновременно напади на черного ферзя.',
          hints: [
            'Ищи поле для коня, откуда он дотянется и до короля h8, и до ферзя d8.',
            'Поле f7 идеально подходит для прыжка.',
            'Сделай ход конем: g5-f7.'
          ]
        },
        {
          fen: 'r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1',
          moves: ['b5c7'],
          prompt: 'Снова вилка конем! На этот раз найди прыжок, который атакует черного короля и ладью на угловом поле a8.',
          hints: [
            'Конь на b5 может пойти на поле c7.',
            'Оттуда он объявит шах королю e8 и нападет на ладью a8.',
            'Сыграй конем на c7.'
          ]
        },
        {
          fen: '4k3/8/8/1r3q2/8/5N2/8/4K3 w - - 0 1',
          moves: ['f3d4'],
          prompt: 'Конь может атаковать две тяжелые фигуры даже без шаха. Найди двойной удар на черного ферзя и ладью.',
          hints: [
            'Ищи центральное поле, с которого конь дотянется до f5 и b5.',
            'Поле d4 находится как раз на нужном расстоянии от обеих фигур.',
            'Перемести коня на d4.'
          ]
        },
        {
          fen: '4k3/2q1r3/3b4/4P3/8/8/8/K7 w - - 0 1',
          moves: ['e5d6'],
          prompt: 'Даже скромная пешка может сделать вилку! Забери черного слона и одновременно атакуй ферзя c7 и ладью e7.',
          hints: [
            'Твоя пешка на e5 может совершить взятие по диагонали.',
            'Побей слона на d6. После этого пешка раздвоит атаку на ферзя и ладью.',
            'Забери слона пешкой: e5-d6.'
          ]
        },
        {
          fen: 'r5k1/8/8/8/8/8/8/3QK3 w - - 0 1',
          moves: ['d1d5'],
          prompt: 'Ферзь превосходно делает двойные удары по диагонали и прямой. Объяви шах королю и выиграй ладью на a8.',
          hints: [
            'Ферзь на d1 должен встать на большую диагональ.',
            'Ход на d5 дает шах королю g8 и одновременно нападает на ладью a8.',
            'Сыграй ферзем на d5.'
          ]
        },
        {
          fen: '8/b6k/8/8/8/8/8/3R1K2 w - - 0 1',
          moves: ['d1d7'],
          prompt: 'Ладья тоже умеет наносить двойные удары! Объяви шах черному королю по горизонтали и выиграй беззащитного слона на a7.',
          hints: [
            'Перемести ладью на 7-ю горизонталь, где стоят обе черные фигуры.',
            'Поле d7 позволяет атаковать короля на h7 и слона на a7.',
            'Сыграй ладьей на d7.'
          ]
        },
        {
          fen: '4k3/8/8/8/5q2/8/1r6/2N1K3 w - - 0 1',
          moves: ['c1d3'],
          prompt: 'Твой конь на c1 зажат, но у него есть спасительный двойной удар. Напади на черного ферзя и ладью одновременно.',
          hints: [
            'Конь должен выпрыгнуть в центр.',
            'Поле d3 находится под боем коня c1 и связывает фигуры f4 и b2.',
            'Сыграй конем на d3.'
          ]
        },
        {
          fen: 'r3k3/8/8/8/8/8/6B1/4K3 w - - 0 1',
          moves: ['g2c6'],
          prompt: 'Слон атакует по диагоналям в разные стороны. Сделай вилку: объяви шах королю e8 и атакуй ладью a8.',
          hints: [
            'Слон на g2 должен пойти по длинной белопольной диагонали.',
            'Поле c6 связывает короля на e8 и ладью на a8.',
            'Сыграй слоном на c6.'
          ]
        }
      ]
    },
    tests: [
      {
        type: 'multiple_choice',
        prompt: 'Что такое «вилка» в шахматах?',
        options: ['Жертва фигуры', 'Атака на двух фигур одновременно', 'Защитный манёвр', 'Ход пешкой'],
        correctOptionIndex: 1,
      },
      {
        type: 'multiple_choice',
        prompt: 'Какая фигура лучше всего делает вилки?',
        options: ['Ладья', 'Ферзь', 'Конь', 'Слон'],
        correctOptionIndex: 2,
      },
      {
        type: 'fill_blank',
        prompt: 'Вставь правильные слова',
        blanksText: 'Вилка — это когда ___ атакует ___ одновременно. Соперник не может спасти ___ фигуру.',
        wordPool: ['одна фигура', 'две', 'три', 'обе', 'одну'],
        correctOrder: ['одна фигура', 'две', 'обе'],
      },
      {
        type: 'fill_blank',
        prompt: 'Вставь правильные слова',
        blanksText: 'Конь опасен для вилок потому что атакует ___ клетки. Другие фигуры их не ___.',
        wordPool: ['необычные', 'обычные', 'прикрывают', 'атакуют'],
        correctOrder: ['необычные', 'прикрывают'],
      },
      {
        type: 'free_text',
        prompt: 'Объясни: почему вилка конём особенно опасна? Как защититься от вилки?',
        correctAnswer: 'Конь атакует с необычных углов, другие фигуры их не прикрывают. Защита — уйти обеими фигурами или взять коня',
      },
    ]
  },
  {
    id: 'chess_d7',
    hobby: 'chess',
    day: 7,
    learn: {
      title: 'Final Challenge',
      body: 'This is the test. Every puzzle hides a motif you\'ve learned: a fork, a mate, a winning trade, a discovered attack, a checkmate. The prompt won\'t tell you what to look for — that\'s the point. Recognize the pattern, calculate the sequence, execute the solution. You\'ve learned the tools. Now prove you can use them.',
      keywords: ['review', 'pattern recognition', 'mixed tactics', 'final test'],
    },
    do: {
      type: 'chess_puzzle',
      prompt: 'Реши серию из 8 смешанных задач на повторение всех тем первой недели!',
      puzzleFen: '4k3/4q3/8/8/8/8/8/4R1K1 w - - 0 1',
      puzzleMoves: ['e1e7'],
      puzzles: [
        {
          fen: '4k3/4q3/8/8/8/8/8/4R1K1 w - - 0 1',
          moves: ['e1e7'],
          prompt: 'Повторение: черная ферзь связана твоей ладьей и не может уйти из-под боя. Просто забери ее!',
          hints: [
            'Черный ферзь не может отступить, так как за ним стоит король.',
            'Ладья на e1 может бесплатно забрать ферзя на e7.',
            'Сделай взятие: e1-e7.'
          ]
        },
        {
          fen: '7k/5Q2/6K1/8/8/8/8/8 w - - 0 1',
          moves: ['f7f8'],
          prompt: 'Повторение: найди быструю победу! Поставь мат черному королю в один ход с помощью ферзя.',
          hints: [
            'Черный король полностью зажат на краю доски.',
            'Сделай ход ферзем на последнюю горизонталь — поле f8.',
            'Сыграй f7-f8.'
          ]
        },
        {
          fen: '3q3k/8/8/6N1/8/8/8/4K3 w - - 0 1',
          moves: ['g5f7'],
          prompt: 'Повторение: найди знаменитую вилку конем, чтобы забрать сильнейшую фигуру соперника.',
          hints: [
            'Конь на g5 может прыгнуть с шахом.',
            'Поле f7 позволяет атаковать короля и ферзя одновременно.',
            'Сыграй конем на f7.'
          ]
        },
        {
          fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          moves: ['e2e4'],
          prompt: 'Повторение дебюта: сделай лучший первый ход по первому принципу дебюта.',
          hints: [
            'Захвати центр пешкой и открой дорогу легким фигурам.',
            'Сыграй пешкой перед королем на две клетки вперед.',
            'Сделай ход e2-e4.'
          ]
        },
        {
          fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
          moves: ['e1g1'],
          prompt: 'Повторение: твой король все еще в центре. Обезопась его с помощью короткой рокировки.',
          hints: [
            'Король и ладья готовы поменяться местами.',
            'Перемести короля e1 на g1.',
            'Сыграй e1g1.'
          ]
        },
        {
          fen: '4r1k1/8/8/8/8/8/8/4K1B1 w - - 0 1',
          moves: ['g1e3'],
          prompt: 'Повторение: защити своего короля от шаха черной ладьи с помощью блокировки.',
          hints: [
            'Не уводи короля, а закрой его другой фигурой.',
            'Слон на g1 может перекрыть линию атаки на поле e3.',
            'Сыграй слоном на e3.'
          ]
        },
        {
          fen: '4k3/8/8/3q4/4P3/8/8/4K3 w - - 0 1',
          moves: ['e4d5'],
          prompt: 'Повторение ценности фигур: пешка (1 очко) может забрать ферзя (9 очков). Выиграй партию материально.',
          hints: [
            'Твоя пешка стоит на e4, а ферзь — на d5.',
            'Сделай выгодное диагональное взятие.',
            'Побей ферзя пешкой: e4-d5.'
          ]
        },
        {
          fen: 'r5k1/8/8/8/8/8/8/3QK3 w - - 0 1',
          moves: ['d1d5'],
          prompt: 'Повторение: используй ферзя для мощной вилки на короля g8 и ладью a8.',
          hints: [
            'Ферзь должен встать на активную диагональ с шахом.',
            'Поле d5 дает шах королю и целится в ладью в углу.',
            'Сыграй ферзем на d5.'
          ]
        }
      ]
    },
    tests: [
      {
        type: 'multiple_choice',
        prompt: 'Сколько пешек стоит Ладья?',
        options: ['3 пешки', '9 пешек', '5 пешек', '7 пешек'],
        correctOptionIndex: 2,
      },
      {
        type: 'multiple_choice',
        prompt: 'Что из этого НЕ является принципом дебюта?',
        options: ['Занять центр', 'Развить фигуры', 'Пожертвовать ферзя', 'Сделать рокировку'],
        correctOptionIndex: 2,
      },
      {
        type: 'fill_blank',
        prompt: 'Вставь правильные слова',
        blanksText: 'Вилка — атака ___ фигуры. Мат — ___ без защиты. Пат — нет ___, нет шаха.',
        wordPool: ['двух', 'шах', 'ходов', 'одной', 'пат'],
        correctOrder: ['двух', 'шах', 'ходов'],
      },
      {
        type: 'fill_blank',
        prompt: 'Вставь правильные слова',
        blanksText: 'При рокировке ___ и ___ меняются местами. Рокировка защищает ___.',
        wordPool: ['король', 'ладья', 'ферзь', 'короля', 'пешку'],
        correctOrder: ['король', 'ладья', 'короля'],
      },
      {
        type: 'free_text',
        prompt: 'Напиши свой «шахматный кодекс» — 5 правил, которые ты запомнил(а) за эту неделю.',
        correctAnswer: 'Занимай центр, развивай фигуры, делай рокировку, ищи тактику, следи за ценностью фигур',
      },
    ]
  }
];

// ─────────────────────────────────────────────
// 💻 КОДИНГ (Python) — 7 дней
// ─────────────────────────────────────────────
const codingLessons: LessonContent[] = [
  {
    id: 'coding_d1',
    hobby: 'coding',
    day: 1,
    learn: {
      title: 'Первая программа: print()',
      body: 'Python — один из самых популярных языков программирования в мире. Программа начинается с самого простого: функция print() выводит текст на экран. Текст нужно писать в кавычках. Пример: print("Привет, мир!") выведет: Привет, мир! Комментарии (строки объяснения) начинаются с символа # и не выполняются.',
      keywords: ['print()', 'функция', 'строка', 'комментарий', 'вывод'],
    },
    do: {
      type: 'code',
      prompt: 'Напиши программу, которая выводит твоё имя, возраст и любимое хобби — каждое на отдельной строке.',
      starterCode: '# Напиши свою программу здесь\nprint("Привет!")\n',
      hints: ['Используй print() для каждой строки', 'Текст должен быть в кавычках'],
    },
    deepen1: {
      type: 'code',
      prompt: 'Напиши программу, которая выводит таблицу умножения на 3 (от 3×1 до 3×10).',
      starterCode: '# Таблица умножения на 3\n',
    },
    deepen2: {
      type: 'code',
      prompt: 'Напиши программу, которая выводит первые 10 чётных чисел (2, 4, 6, ... 20).',
      starterCode: '# Чётные числа от 2 до 20\n',
    },
  },
  {
    id: 'coding_d2',
    hobby: 'coding',
    day: 2,
    learn: {
      title: 'Переменные: хранение данных',
      body: 'Переменная — это контейнер для данных. Создаётся так: name = "Саша" (тогда name хранит "Саша"). Правила именования: используй латинские буквы, можно цифры (не в начале), подчёркивание вместо пробела. Плохие имена: 1name, my name. Хорошие: user_name, age, hobby_list. Python чувствителен к регистру: age ≠ Age.',
      keywords: ['переменная', 'присваивание', 'имя переменной', 'регистр'],
    },
    do: {
      type: 'code',
      prompt: 'Создай 3 переменные: своё имя, возраст и город. Затем выведи их все через print() в одном предложении.',
      starterCode: '# Создай переменные\nname = ""\nage = 0\ncity = ""\n\n# Выведи результат\nprint()\n',
      hints: ['Текст помещают в кавычки', 'Числа пишут без кавычек', 'В print() можно соединять строки через запятую'],
    },
    deepen1: {
      type: 'code',
      prompt: 'Напиши программу, которая меняет значения двух переменных местами. Например: a=5, b=10 → после: a=10, b=5.',
      starterCode: 'a = 5\nb = 10\n# Поменяй значения местами\n\nprint("a =", a)\nprint("b =", b)\n',
    },
    deepen2: {
      type: 'code',
      prompt: 'Напиши программу-калькулятор: создай переменные длина=10, ширина=5, вычисли и выведи периметр и площадь прямоугольника.',
      starterCode: 'length = 10\nwidth = 5\n# Вычисли периметр и площадь\n\n',
    },
  },
  {
    id: 'coding_d3',
    hobby: 'coding',
    day: 3,
    learn: {
      title: 'Типы данных: int, float, str, bool',
      body: 'Python работает с разными типами данных: int (целое число): age = 25. float (число с точкой): price = 9.99. str (строка — текст): name = "Алиса". bool (логический): is_student = True. Функция type() показывает тип: type(age) → int. Можно конвертировать: int("42") → 42, str(25) → "25".',
      keywords: ['int', 'float', 'str', 'bool', 'type()', 'конвертация'],
    },
    do: {
      type: 'code',
      prompt: 'Создай по одной переменной каждого типа (int, float, str, bool). Для каждой выведи значение и её тип через type().',
      starterCode: '# Создай переменные разных типов\n\n# Выведи значение и тип каждой\n',
      hints: ['type(переменная) показывает тип', 'print("Тип:", type(x)) — удобный формат вывода'],
    },
    deepen1: {
      type: 'code',
      prompt: 'Напиши конвертер температуры: получи температуру в Цельсиях как float, конвертируй в Фаренгейт (F = C × 9/5 + 32), выведи результат.',
      starterCode: 'celsius = 25.0\n# Конвертируй в Фаренгейт\n\n',
    },
    deepen2: {
      type: 'code',
      prompt: 'Напиши программу, которая вычисляет, сколько секунд в сутках, неделе и месяце (30 дней). Используй понятные переменные для каждого шага.',
      starterCode: 'seconds_per_minute = 60\nminutes_per_hour = 60\n# Продолжи вычисления\n\n',
    },
  },
  {
    id: 'coding_d4',
    hobby: 'coding',
    day: 4,
    learn: {
      title: 'Ввод данных: input()',
      body: 'Функция input() позволяет программе получать данные от пользователя. Пример: name = input("Как тебя зовут? "). ВАЖНО: input() всегда возвращает строку (str). Если нужно число — преобразуй: age = int(input("Твой возраст: ")). Для числа с точкой: price = float(input("Цена: ")).',
      keywords: ['input()', 'ввод пользователя', 'int()', 'float()', 'str()'],
    },
    do: {
      type: 'code',
      prompt: 'Напиши программу: спроси имя пользователя и год его рождения. Вычисли его возраст и выведи: "Привет, [имя]! Тебе [возраст] лет."',
      starterCode: '# Спроси имя и год рождения\nname = input("Как тебя зовут? ")\nbirth_year = int(input("В каком году ты родился(ась)? "))\n\n# Вычисли возраст\ncurrent_year = 2025\n\n',
      hints: ['Возраст = текущий год - год рождения', 'Используй f-строку: f"Привет, {name}!"'],
    },
    deepen1: {
      type: 'code',
      prompt: 'Напиши простой калькулятор: запроси два числа от пользователя, выведи их сумму, разность, произведение и частное.',
      starterCode: 'a = float(input("Первое число: "))\nb = float(input("Второе число: "))\n# Вычисли и выведи результаты\n\n',
    },
    deepen2: {
      type: 'code',
      prompt: 'Напиши конвертер единиц: спроси пользователя сколько километров, переведи в мили (1 км = 0.621371 мили) и в метры.',
      starterCode: 'km = float(input("Введи расстояние в километрах: "))\n# Конвертируй\n\n',
    },
  },
  {
    id: 'coding_d5',
    hobby: 'coding',
    day: 5,
    learn: {
      title: 'Условия: if, elif, else',
      body: 'Условный оператор позволяет программе принимать решения. Структура: if условие: (код если верно) elif другое_условие: (код для второго варианта) else: (код если ничего не совпало). ВАЖНО: Python использует отступ (4 пробела или Tab) вместо скобок! Операторы сравнения: == (равно), != (не равно), >, <, >=, <=.',
      keywords: ['if', 'elif', 'else', 'условие', 'отступ', 'операторы сравнения'],
    },
    do: {
      type: 'code',
      prompt: 'Напиши программу, которая спрашивает возраст пользователя и выводит: до 18 — "Ты несовершеннолетний", 18-64 — "Ты взрослый", 65+ — "Ты пенсионер".',
      starterCode: 'age = int(input("Введи свой возраст: "))\n\n# Напиши условия\n',
      hints: ['Используй if, elif, else', 'Не забудь отступ 4 пробела после двоеточия'],
    },
    deepen1: {
      type: 'code',
      prompt: 'Напиши калькулятор оценок: 90-100 → "Отлично (A)", 75-89 → "Хорошо (B)", 60-74 → "Удовлетворительно (C)", ниже 60 → "Неудовлетворительно (F)".',
      starterCode: 'score = int(input("Введи оценку (0-100): "))\n# Определи рейтинг\n\n',
    },
    deepen2: {
      type: 'code',
      prompt: 'Напиши программу проверки доступа: нужен возраст 18+ И правильный пароль ("python2025"). Используй логический оператор and.',
      starterCode: 'age = int(input("Твой возраст: "))\npassword = input("Пароль: ")\n# Проверь доступ\n\n',
    },
  },
  {
    id: 'coding_d6',
    hobby: 'coding',
    day: 6,
    learn: {
      title: 'Циклы: for и while',
      body: 'Циклы позволяют повторять действия. for — для заданного количества повторений: for i in range(5): print(i) выводит 0,1,2,3,4. range(start, stop, step): range(1,10,2) → 1,3,5,7,9. while — повторяет пока условие истинно: while x > 0: x -= 1. ВАЖНО: в while должно быть условие выхода, иначе — бесконечный цикл!',
      keywords: ['for', 'while', 'range()', 'цикл', 'итерация', 'break'],
    },
    do: {
      type: 'code',
      prompt: 'Напиши программу, которая выводит таблицу умножения для числа, которое вводит пользователь (от 1 до 10).',
      starterCode: 'number = int(input("Для какого числа таблицу умножения? "))\n\n# Используй цикл for\n',
      hints: ['for i in range(1, 11):', 'В каждой итерации выводи number * i'],
    },
    deepen1: {
      type: 'code',
      prompt: 'Напиши игру "Угадай число": программа загадывает число от 1 до 10 (используй import random; n = random.randint(1,10)), пользователь угадывает с подсказками "больше"/"меньше".',
      starterCode: 'import random\nfrom random import randint\n\nsecret = randint(1, 10)\n# Напиши игровой цикл с while\n\n',
    },
    deepen2: {
      type: 'code',
      prompt: 'Напиши программу FizzBuzz: для чисел 1-30 выводи "Fizz" если кратно 3, "Buzz" если кратно 5, "FizzBuzz" если кратно обоим, иначе само число.',
      starterCode: '# FizzBuzz от 1 до 30\nfor i in range(1, 31):\n    # Добавь условия\n    pass\n',
    },
  },
  {
    id: 'coding_d7',
    hobby: 'coding',
    day: 7,
    learn: {
      title: 'Функции: def и return',
      body: 'Функция — это именованный блок кода, который можно вызывать многократно. Определение: def имя_функции(параметры): код. Вызов: имя_функции(аргументы). return возвращает результат. Пример: def add(a, b): return a + b. Вызов: result = add(3, 5) → result = 8. Функции помогают не повторять код и делают программу понятнее.',
      keywords: ['def', 'функция', 'параметры', 'аргументы', 'return', 'вызов функции'],
    },
    do: {
      type: 'code',
      prompt: 'Напиши 3 функции: 1) greet(name) — выводит приветствие, 2) square(n) — возвращает квадрат числа, 3) is_even(n) — возвращает True если число чётное. Вызови каждую функцию и выведи результат.',
      starterCode: '# Функция приветствия\ndef greet(name):\n    pass\n\n# Функция квадрата\ndef square(n):\n    pass\n\n# Функция проверки чётности\ndef is_even(n):\n    pass\n\n# Вызови все функции\n',
      hints: ['pass заменяется твоим кодом', 'return возвращает значение из функции', 'Чётное число: n % 2 == 0'],
    },
    deepen1: {
      type: 'code',
      prompt: 'Напиши функцию is_prime(n), которая проверяет является ли число простым. Вызови её для чисел 2, 7, 10, 17, 25.',
      starterCode: 'def is_prime(n):\n    """Возвращает True если n простое число"""\n    if n < 2:\n        return False\n    # Проверь делимость от 2 до n-1\n    \n\n# Проверь числа\nfor num in [2, 7, 10, 17, 25]:\n    print(f"{num}: {is_prime(num)}")\n',
    },
    deepen2: {
      type: 'code',
      prompt: 'Финальный проект недели: напиши программу-анкету. Функция collect_info() спрашивает имя, возраст, город. Функция display_info(data) красиво выводит данные. Функция main() вызывает обе.',
      starterCode: 'def collect_info():\n    """Собирает данные от пользователя"""\n    info = {}\n    # Задай вопросы и сохрани ответы в словарь info\n    return info\n\ndef display_info(data):\n    """Красиво выводит данные"""\n    print("=== Ваша анкета ===")\n    # Выведи все данные из словаря\n\ndef main():\n    data = collect_info()\n    display_info(data)\n\nmain()\n',
    },
  },
];

// ─────────────────────────────────────────────
// Экспорт банка уроков
// ─────────────────────────────────────────────

/** Все статические уроки первых 7 дней, индексированные по хобби */
export const LESSON_BANK: Record<HobbyId, LessonContent[]> = {
  english: englishLessons,
  chinese: chineseLessons,
  chess: chessLessons,
  coding: codingLessons,
};

/**
 * Получить урок по хобби и дню.
 * Если день > 7 — вернёт undefined (нужна AI-генерация).
 */
export function getLessonByDay(hobby: HobbyId, day: number): LessonContent | undefined {
  return LESSON_BANK[hobby]?.find(l => l.day === day);
}

/**
 * Получить список хобби для отображения (используется в UI).
 */
export const HOBBY_META: Record<HobbyId, { label: string; emoji: string; color: string }> = {
  english: { label: 'Английский', emoji: '🇬🇧', color: '#4F8EF7' },
  chinese: { label: 'Китайский', emoji: '🇨🇳', color: '#F7544F' },
  chess: { label: 'Шахматы', emoji: '♟', color: '#8B5CF6' },
  coding: { label: 'Python', emoji: '💻', color: '#10B981' },
};
