import { Chess } from 'chess.js';

export interface ChessPuzzleMove {
  userMove: string;
  opponentMove?: string | null;
  explanation?: string;
}

export interface ChessPuzzle {
  id?: string;
  day?: number;
  topic?: string;
  skill?: string;
  goalType?: string;
  fen: string;       // Позиция на доске в FEN
  sideToMove?: 'w' | 'b';
  solution?: ChessPuzzleMove[];
  moves?: string[];   // Правильные ходы в UCI-формате, например ["e2e4"] (для обратной совместимости)
  prompt: string;    // Текст задания для пользователя
  hints?: string[] | { soft: string; medium: string; strong: string };  // Подсказки при нажатии на кнопку лампочки
  successExplanation?: string;
  failureExplanation?: string;
  learningPoint?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface ChessPuzzleTask {
  id: string;
  fen: string;
  puzzleMoves: string[];
  solution?: ChessPuzzleMove[];
  successExplanation?: string;
  failureExplanation?: string;
  rating: number;
  themes: string[];
  prompt: string;
  hints: string[];
  sideToMove?: 'w' | 'b';
  metadata?: Record<string, any>;
  day?: number;
  topic?: string;
}


export const day3_opening_initiative: ChessPuzzle[] = [
  {
    id: "day3_opening_initiative_p1",
    day: 3,
    topic: "day3_opening_initiative",
    skill: "Наказание раннего вывода ферзя",
    goalType: "best_move",
    fen: "r1b1kb1r/pp3ppp/2pp1q2/8/2BpP3/5N2/PPP2PPP/R1BQ1RK1 w kq - 0 6",
    sideToMove: "w",
    solution: [
      {
        userMove: "c1g5",
        opponentMove: null,
        explanation: "Отлично! Слон развит с нападением на ферзя, что вынуждает соперника терять время на его защиту."
      }
    ],
    prompt: "Ферзь соперника вышел слишком рано в начале партии. Используй развитие с темпом.",
    hints: {
      soft: "Обрати внимание на легкие фигуры.",
      medium: "Найди фигуру, которая может напасть на ферзя соперника.",
      strong: "Выведи слона, чтобы атаковать вражеского ферзя."
    },
    successExplanation: "Отлично! Слон развит с нападением на ферзя, что вынуждает соперника терять время на его защиту.",
    failureExplanation: "Этот ход не создает угроз сопернику. Ищи развивающий ход, который нападает на ферзя.",
    learningPoint: "Ранний выход ферзя соперника — отличный повод развить фигуру с темпом.",
    tags: ["opening", "initiative", "tempo"],
    metadata: {
      isStatic: true,
      estimatedTimeSec: 30,
      moveCount: 1,
      engineChecked: false
    }
  },
  {
    id: "day3_opening_initiative_p2",
    day: 3,
    topic: "day3_opening_initiative",
    skill: "Борьба за центр",
    goalType: "win_material",
    fen: "r1b1kb1r/ppp3pp/2n5/3q1p2/4n3/8/PPP1QPPP/RNB1R1K1 w kq - 0 8",
    sideToMove: "w",
    solution: [
      {
        userMove: "b1c3",
        opponentMove: null,
        explanation: "Превосходно! Конь вошел в игру с нападением на ферзя. Черный конь не может забрать твоего коня из-за связки ладьей."
      }
    ],
    prompt: "Центр шахматной доски открыт для борьбы. Найди развивающий ход с давлением.",
    hints: {
      soft: "Смотри на фигуры первого ряда.",
      medium: "Черный конь в центре связан по вертикали.",
      strong: "Выведи ферзевого коня, нападая на ферзя соперника и используя связку."
    },
    successExplanation: "Превосходно! Конь вошел в игру с нападением на ферзя. Черный конь не может забрать твоего коня из-за связки ладьей.",
    failureExplanation: "Простой размен или защита упускают инициативу. Найди развивающий ход, который использует связку.",
    learningPoint: "Связанная фигура не может защищать другие поля. Используй это для развития с темпом.",
    tags: ["opening", "initiative", "center", "pin"],
    metadata: {
      isStatic: true,
      estimatedTimeSec: 30,
      moveCount: 1,
      engineChecked: false
    }
  },
  {
    id: "day3_opening_initiative_p3",
    day: 3,
    topic: "day3_opening_initiative",
    skill: "Использование потери темпа",
    goalType: "best_move",
    fen: "r1bq1rk1/ppp2ppp/2n5/4p3/6n1/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 1",
    sideToMove: "w",
    solution: [
      {
        userMove: "c1g5",
        opponentMove: null,
        explanation: "Великолепно! Ты наказал соперника за бесцельный маневр конем, развив слона с нападением на его ферзя."
      }
    ],
    prompt: "Соперник потратил драгоценный темп на лишний маневр. Заставь его защищаться.",
    hints: {
      soft: "Ищи способ напасть на вражескую фигуру.",
      medium: "Конь соперника ушел далеко от своего лагеря.",
      strong: "Выведи своего слона с темпом, нападая на ферзя."
    },
    successExplanation: "Великолепно! Ты наказал соперника за бесцельный маневр конем, развив слона с нападением на его ферзя.",
    failureExplanation: "Не трать время на пассивные ходы. Соперник потерял темп, ответь активным развитием.",
    learningPoint: "Если соперник тратит темпы впустую, захватывай инициативу активным развитием фигур.",
    tags: ["opening", "initiative", "tempo"],
    metadata: {
      isStatic: true,
      estimatedTimeSec: 30,
      moveCount: 1,
      engineChecked: false
    }
  },
  {
    id: "day3_opening_initiative_p4",
    day: 3,
    topic: "day3_opening_initiative",
    skill: "Активное развитие с угрозой",
    goalType: "best_move",
    fen: "r1bq1rk1/ppp2ppp/2nb4/3pp3/4P3/2NB1N2/PPP2PPP/R1BQ1RK1 w - - 0 7",
    sideToMove: "w",
    solution: [
      {
        userMove: "c1g5",
        opponentMove: null,
        explanation: "Потрясающе! Вместо пассивной защиты пешки ты развил слона и напал на ферзя соперника, перехватив инициативу."
      }
    ],
    prompt: "Не нужно уходить в пассивную оборону. Найди активный развивающий ход с угрозой.",
    hints: {
      soft: "Вместо пассивной защиты ищи нападение.",
      medium: "Вражеский ферзь стоит на одной диагонали с твоим слоном.",
      strong: "Выведи слона с нападением на вражеского ферзя."
    },
    successExplanation: "Потрясающе! Вместо пассивной защиты пешки ты развил слона и напал на ферзя соперника, перехватив инициативу.",
    failureExplanation: "Пассивная защита отдает инициативу сопернику. Найди активную контругрозу.",
    learningPoint: "Инициатива важнее пешек. Лучшая защита в дебюте — это создание встречных угроз.",
    tags: ["opening", "initiative", "counterattack"],
    metadata: {
      isStatic: true,
      estimatedTimeSec: 30,
      moveCount: 1,
      engineChecked: false
    }
  },
  {
    id: "day3_opening_initiative_p5",
    day: 3,
    topic: "day3_opening_initiative",
    skill: "Борьба за центр и темп",
    goalType: "tactical_sequence",
    fen: "r1bq1rk1/ppp2ppp/2np1n2/2b1p1B1/2B1P3/2NP1N1P/PPP2PP1/R2Q1RK1 w - - 0 8",
    sideToMove: "w",
    solution: [
      {
        userMove: "g5f6",
        opponentMove: "d8f6",
        explanation: "Отлично! Устраняем защитника важного поля d5."
      },
      {
        userMove: "c3d5",
        opponentMove: null,
        explanation: "Превосходно! Конь занимает сильное центральное поле d5 с темпом, нападая на ферзя черных."
      }
    ],
    prompt: "Черный конь на королевском фланге связан. Разрушь защиту и займи центр с темпом.",
    hints: {
      soft: "Обрати внимание на связку твоего слона g5 и черного коня f6.",
      medium: "Разменяй слона на коня, чтобы освободить поле d5 для атаки конем.",
      strong: "Забери коня на f6 слоном, а после взятия ферзем сыграй конем на d5."
    },
    successExplanation: "Превосходно! Взятие на f6 разрушило оборону черных, а ход Nd5 позволил коню занять доминирующую центральную позицию с нападением на ферзя.",
    failureExplanation: "Этот ход упускает возможность перехватить инициативу. Ищи способ разменять коня f6 и атаковать ферзя.",
    learningPoint: "Устранение ключевых защитников позволяет твоим фигурам занимать сильные центральные поля с выигрышем темпа.",
    tags: ["opening", "initiative", "tempo", "center", "exchange"],
    metadata: {
      isStatic: true,
      estimatedTimeSec: 45,
      moveCount: 2,
      engineChecked: false
    }
  },
  {
    id: "day3_opening_initiative_p6",
    day: 3,
    topic: "day3_opening_initiative",
    skill: "Наказание раннего выхода ферзя",
    goalType: "tactical_sequence",
    fen: "r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 3",
    sideToMove: "b",
    solution: [
      {
        userMove: "g7g6",
        opponentMove: "h5f3",
        explanation: "Отличная защита! Нападение пешкой прогоняет ферзя и защищает пункт f7."
      },
      {
        userMove: "g8f6",
        opponentMove: null,
        explanation: "Отличная игра! Ты защитился от мата с нападением на ферзя, а затем вывел коня, получив перевес в развитии."
      }
    ],
    prompt: "Соперник грозит поставить быстрый мат, но его ферзь уязвим. Перехвати инициативу.",
    hints: {
      soft: "Защити слабое поле перед своим королем.",
      medium: "Используй нападение пешкой, чтобы прогнать ферзя.",
      strong: "Напади на ферзя пешкой перед слоном, а затем выведи королевского коня."
    },
    successExplanation: "Отличная игра! Ты защитился от мата с нападением на ферзя, а затем вывел коня, получив перевес в развитии.",
    failureExplanation: "Пассивные ходы вроде защиты ферзем перекрывают развитие других фигур. Защищайся активно.",
    learningPoint: "Даже защищаться в дебюте нужно с темпом, одновременно готовя развитие своих фигур.",
    tags: ["opening", "defense", "initiative", "tempo"],
    metadata: {
      isStatic: true,
      estimatedTimeSec: 45,
      moveCount: 2,
      engineChecked: false
    }
  },
  {
    id: "day3_opening_initiative_p7",
    day: 3,
    topic: "day3_opening_initiative",
    skill: "Борьба за центр",
    goalType: "tactical_sequence",
    fen: "r1bqkb1r/ppp2ppp/2n2n2/3pP3/2Bp4/5N2/PPP2PPP/RNBQK2R w KQkq - 0 6",
    sideToMove: "w",
    solution: [
      {
        userMove: "c4b5",
        opponentMove: "f6e4",
        explanation: "Отличный развивающий ход! Связка вражеского коня позволяет перехватить инициативу."
      },
      {
        userMove: "f3d4",
        opponentMove: null,
        explanation: "Блестяще! Связка слоном позволила тебе захватить центр и выиграть пешку конем."
      }
    ],
    prompt: "Борьба за центр доски обостряется. Завладей пространством с активным нападением.",
    hints: {
      soft: "Используй связку вражеского коня.",
      medium: "Выведи слона с шахом или связкой.",
      strong: "Свяжи вражеского коня слоном, а затем забери пешку в центре другим конем."
    },
    successExplanation: "Блестяще! Связка слоном позволила тебе захватить центр и выиграть пешку конем.",
    failureExplanation: "Не упускай контроль над центром. Найди способ развить фигуру с сильным давлением.",
    learningPoint: "Активное развитие с угрозами помогает быстро вскрыть и подчинить себе центр доски.",
    tags: ["opening", "initiative", "center", "pin"],
    metadata: {
      isStatic: true,
      estimatedTimeSec: 45,
      moveCount: 2,
      engineChecked: false
    }
  }
];


export const chessLessonPuzzles: Record<string, ChessPuzzle[]> = {
  day1_board_geometry: [
    {
      id: "day1_geometry_p1",
      day: 1,
      topic: "day1_board_geometry",
      skill: "Взятие без защиты",
      goalType: "win_material",
      fen: "4k3/8/8/7n/8/8/8/3QK3 w - - 0 1",
      sideToMove: "w",
      moves: ["d1h5"],
      solution: [
        {
          userMove: "d1h5",
          opponentMove: null,
          explanation: "Отлично! Незащищенный конь взят."
        }
      ],
      prompt: "Твой соперник совершил грубую ошибку и зевнул фигуру. Поспеши и выиграй её!",
      hints: {
        soft: "Обрати внимание на дальние фланги.",
        medium: "Один из коней противника остался совсем один.",
        strong: "Используй диагональный удар ферзя, чтобы выиграть оставленного без присмотра коня."
      },
      successExplanation: "Отлично! Незащищенный конь взят.",
      failureExplanation: "Попробуй найти самую уязвимую фигуру на краю доски.",
      learningPoint: "Обнаружение незащищенных фигур на краях доски.",
      metadata: { moveCount: 1 }
    },
    {
      id: "day1_geometry_p2",
      day: 1,
      topic: "day1_board_geometry",
      skill: "Отступление",
      goalType: "save_piece",
      fen: "4r1k1/ppp3pp/5p2/8/4N3/2P3P1/P2P1P1P/6K1 w - - 0 1",
      sideToMove: "w",
      moves: ["e4c5"],
      solution: [
        {
          userMove: "e4c5",
          opponentMove: null,
          explanation: "Отлично. Конь спасен от линейной атаки ладьи и занял безопасное поле."
        }
      ],
      prompt: "Твой конь оказался под атакой врага — быстро найди для него безопасное поле!",
      hints: {
        soft: "Тяжелая фигура соперника простреливает вертикаль, на которой стоит твой конь.",
        medium: "Большинство полей для отхода коня либо заняты твоими собственными пешками, либо находятся под прицелом соперника.",
        strong: "Сделай прыжок конем на левый фланг на пятую горизонталь, где он будет полностью недосягаем."
      },
      successExplanation: "Отлично. Конь спасен от линейной атаки ладьи и занял безопасное поле.",
      failureExplanation: "Конь остался под ударом ладьи или отступил на небезопасное поле. Попробуй еще раз.",
      learningPoint: "Нахождение единственного безопасного поля для отступления фигуры при плотном контроле доски.",
      metadata: { moveCount: 1 }
    },
    {
      id: "day1_geometry_p3",
      day: 1,
      topic: "day1_board_geometry",
      skill: "Оцени риски",
      goalType: "best_move",
      fen: "4r1k1/6n1/8/3p4/4p3/8/8/3QK3 w - - 0 1",
      sideToMove: "w",
      moves: ["d1d5"],
      solution: [
        {
          userMove: "d1d5",
          opponentMove: null,
          explanation: "Прекрасно! Ты выбрал безопасное продолжение и выиграл пешку."
        }
      ],
      prompt: "Взятие фигуры выглядит очень заманчиво, но будь предельно осторожен с этим!",
      hints: {
        soft: "У тебя есть выбор между взятием двух разных пешек.",
        medium: "Одна из пешек находится под защитой ладьи. Другая — беззащитна.",
        strong: "Выбери для взятия ту пешку, которую не защищает тяжелая фигура черных."
      },
      successExplanation: "Прекрасно! Ты выбрал безопасное продолжение и выиграл пешку.",
      failureExplanation: "Взятие защищенной пешки привело к потере сильнейшей фигуры. Будь внимательнее.",
      learningPoint: "Оценка безопасности взятий и распознавание защищенных фигур противника.",
      metadata: { moveCount: 1 }
    },
    {
      id: "day1_geometry_p4",
      day: 1,
      topic: "day1_board_geometry",
      skill: "Дальнобойное зрение",
      goalType: "win_material",
      fen: "4k1r1/8/8/8/8/8/B7/4K3 w - - 0 1",
      sideToMove: "w",
      moves: ["a2g8"],
      solution: [
        {
          userMove: "a2g8",
          opponentMove: null,
          explanation: "Отлично! Ты заметил дальнобойную угрозу слона и выиграл ладью."
        }
      ],
      prompt: "В оборонительной линии черных наметилась брешь. Быстрее найди уязвимое место!",
      hints: {
        soft: "Посмотри на дальнобойные возможности твоего слона.",
        medium: "На большой диагонали слона стоит незащищенная тяжелая фигура черных.",
        strong: "Сделай взятие слоном на самом конце длинной белой диагонали."
      },
      successExplanation: "Отлично! Ты заметил дальнобойную угрозу слона и выиграл ладью.",
      failureExplanation: "Слон не сделал взятие. Проверь всю диагональ слона до самого конца.",
      learningPoint: "Видение длинных диагоналей и скрытых дальнобойных угроз.",
      metadata: { moveCount: 1 }
    },
    {
      id: "day1_geometry_p5",
      day: 1,
      topic: "day1_board_geometry",
      skill: "Промежуточный темп",
      goalType: "tactical_sequence",
      fen: "3qk3/5p2/8/8/2B5/8/8/3QK3 w - - 0 1",
      sideToMove: "w",
      moves: ["c4f7", "d1d8"],
      solution: [
        {
          userMove: "c4f7",
          opponentMove: "e8f7",
          explanation: "Отличный ход! Шах слоном отвлекает короля соперника от защиты ферзя."
        },
        {
          userMove: "d1d8",
          opponentMove: null,
          explanation: "Великолепно! Ферзь соперника выигран благодаря промежуточному шаху."
        }
      ],
      prompt: "Прямое и очевидное взятие сейчас не работает — попробуй найти обходной путь.",
      hints: {
        soft: "Черный король защищает своего ферзя.",
        medium: "Найди способ объявить шах и отвлечь короля соперника от защиты.",
        strong: "Сделай промежуточный ход слоном с нападением на короля, чтобы отвлечь его от защиты ферзя."
      },
      successExplanation: "Потрясающе! Ты применил промежуточный шах и выиграл ферзя.",
      failureExplanation: "Прямой размен ферзей не приносит выгоды. Ищи форсированный промежуточный шах.",
      learningPoint: "Использование промежуточного шаха для отвлечения защитников противника.",
      metadata: { moveCount: 2 }
    },
    {
      id: "day1_geometry_p6",
      day: 1,
      topic: "day1_board_geometry",
      skill: "Вынужденное отступление",
      goalType: "tactical_sequence",
      fen: "6k1/4nppp/8/2B4Q/8/8/8/4K2R w - - 0 1",
      sideToMove: "w",
      moves: ["h5h7", "h7h8"],
      solution: [
        {
          userMove: "h5h7",
          opponentMove: "g8f8",
          explanation: "Отличный ход! Шах ферзем заставляет короля соперника покинуть его укрытие."
        },
        {
          userMove: "h7h8",
          opponentMove: null,
          explanation: "Шах и мат! Защита соперника полностью разрушена."
        }
      ],
      prompt: "Король черных остался без надежного прикрытия. Начни атаку совместными силами!",
      hints: {
        soft: "Король соперника защищен пешечным щитом, но ферзь и ладья готовы к совместной атаке.",
        medium: "Используй открытую крайнюю вертикаль для первой атаки ферзем.",
        strong: "Начни атаку со взятия крайней пешки у короля с шахом, а после его вынужденного отступления объяви мат ферзем на последней горизонтали."
      },
      successExplanation: "Великолепно! Ты выманил короля из укрытия и поставил мат.",
      failureExplanation: "Король соперника смог спастись. Просчитай точную матовую линию.",
      learningPoint: "Координация ферзя и ладьи для проведения форсированной матовой атаки.",
      metadata: { moveCount: 2 }
    }
  ],

  day2_piece_value: [
    {
      id: "day2_piece_value_p1",
      day: 2,
      topic: "day2_piece_value",
      skill: "Незащищённая фигура",
      goalType: "win_material",
      fen: "2r3k1/p1p2p1p/1p4p1/3b4/7P/2P3P1/PP3P1K/3R4 w - - 0 1",
      sideToMove: "w",
      moves: ["d1d5"],
      solution: [
        {
          userMove: "d1d5",
          opponentMove: null,
          explanation: "Отлично! Ладья забирает незащищенного слона черных."
        }
      ],
      prompt: "Внимательно осмотри позицию, найди незащищённую фигуру соперника и забери её!",
      hints: {
        soft: "Обрати внимание на фигуры в центре доски.",
        medium: "Один из черных слонов никем не защищен.",
        strong: "Используй ладью на первой горизонтали, чтобы забрать слона."
      },
      successExplanation: "Отлично! Ладья забирает незащищенного слона черных.",
      failureExplanation: "Попробуй найти фигуру, которая осталась совсем без защиты.",
      learningPoint: "Выигрыш незащищенной фигуры (чистый перевес в 3 пешки).",
      metadata: { moveCount: 1 }
    },
    {
      id: "day2_piece_value_p2",
      day: 2,
      topic: "day2_piece_value",
      skill: "Выгодное взятие",
      goalType: "win_material",
      fen: "3r3k/p4ppp/1pn5/3q4/4P3/P1P2NP1/1P3P1P/4R1K1 w - - 0 1",
      sideToMove: "w",
      moves: ["e4d5"],
      solution: [
        {
          userMove: "e4d5",
          opponentMove: null,
          explanation: "Потрясающе! Размен пешки на ферзя черных — это огромный успех."
        }
      ],
      prompt: "Сильнейший ферзь твоего соперника оказался под боем — обязательно используй это!",
      hints: {
        soft: "Ферзь — самая ценная фигура противника после короля.",
        medium: "Какая твоя фигура может напасть на ферзя?",
        strong: "Твоя пешка в центре может забрать вражеского ферзя."
      },
      successExplanation: "Потрясающе! Размен пешки на ферзя черных — это огромный успех.",
      failureExplanation: "Взять ферзя гораздо выгоднее, чем сделать любой другой ход.",
      learningPoint: "Оценка ценности фигур при размене (пешка за ферзя дает +8 очков).",
      metadata: { moveCount: 1 }
    },
    {
      id: "day2_piece_value_p3",
      day: 2,
      topic: "day2_piece_value",
      skill: "Не попадайся на жадность",
      goalType: "best_move",
      fen: "2r4k/ppp2ppp/8/3p4/4p3/1PN5/P1P2PPP/4R1K1 w - - 0 1",
      sideToMove: "w",
      moves: ["c3d5"],
      solution: [
        {
          userMove: "c3d5",
          opponentMove: null,
          explanation: "Отлично! Ты забрал беззащитную пешку и спас своего коня от гибели."
        }
      ],
      prompt: "Впереди опасная ловушка соперника — хорошенько подумай и забери фигуру правильно!",
      hints: {
        soft: "Одна из черных пешек защищена другой пешкой, а вторая — беззащитна.",
        medium: "Если ты заберешь защищенную пешку, то потеряешь своего коня.",
        strong: "Забери конем ту пешку, которая никем не защищена."
      },
      successExplanation: "Отлично! Ты забрал беззащитную пешку и спас своего коня от гибели.",
      failureExplanation: "Не бери защищенную пешку, иначе противник заберет твоего коня.",
      learningPoint: "Распознавание защищенных фигур и уклонение от невыгодных разменов.",
      metadata: { moveCount: 1 }
    },
    {
      id: "day2_piece_value_p4",
      day: 2,
      topic: "day2_piece_value",
      skill: "Лучшее взятие",
      goalType: "win_material",
      fen: "r4k2/p1p2ppp/1p2r3/1b6/2B5/P1P4P/1P3PP1/R3R2K w - - 0 1",
      sideToMove: "w",
      moves: ["c4e6"],
      solution: [
        {
          userMove: "c4e6",
          opponentMove: null,
          explanation: "Совершенно верно! Выиграть ладью (5 очков) намного выгоднее, чем разменять слонов."
        }
      ],
      prompt: "Перед тобой открылись сразу два разных взятия — выбери наиболее выгодное из них.",
      hints: {
        soft: "Сравни ценность двух вражеских фигур, которые находятся под ударом.",
        medium: "Ладья стоит пять очков, а слон — только три.",
        strong: "Забери слоном более ценную фигуру — ладью."
      },
      successExplanation: "Совершенно верно! Выиграть ладью намного выгоднее, чем разменять слонов.",
      failureExplanation: "Попробуй оценить ценность фигур. Ладья дороже слона.",
      learningPoint: "Выбор наиболее ценной цели для атаки при наличии альтернатив.",
      metadata: { moveCount: 1 }
    },
    {
      id: "day2_piece_value_p5",
      day: 2,
      topic: "day2_piece_value",
      skill: "Шах как инструмент темпа",
      goalType: "tactical_sequence",
      fen: "2b3k1/p2r1p2/1pn3pp/8/7P/2P2NP1/PP3P1K/4R3 w - - 0 1",
      sideToMove: "w",
      moves: ["e1e8", "e8c8"],
      solution: [
        {
          userMove: "e1e8",
          opponentMove: "g8h7",
          explanation: "Отличный шах! Черный король вынужден отступить."
        },
        {
          userMove: "e8c8",
          opponentMove: null,
          explanation: "Потрясающе! Белопольный слон выигран благодаря промежуточному шаху."
        }
      ],
      prompt: "Объяви промежуточный шах вражескому королю, чтобы выиграть незащищенную фигуру!",
      hints: {
        soft: "Начни с нападения на короля противника.",
        medium: "Объяви шах ладьей на последней горизонтали.",
        strong: "После шаха ладьей король уйдет, и ты сможешь забрать слона."
      },
      successExplanation: "Потрясающе! Ты выиграл слона с помощью промежутового шаха.",
      failureExplanation: "Немедленное взятие слона невозможно, так как он защищен. Начни с шаха.",
      learningPoint: "Использование шаха для завоевания темпа и проведения двойного удара.",
      metadata: { moveCount: 2 }
    },
    {
      // P6 remains untouched as explicitly requested by the user
      fen: "4k3/8/8/3p4/4p3/2N5/8/4K3 w - - 0 1",
      moves: ["c3d5"],
      prompt: "Одна из пешек соперника находится под защитой, а другая нет. Сделай верный выбор!",
      hints: [
        "Помни, что черные пешки ходят сверху вниз и бьют по диагонали.",
        "Пешка d5 защищает пешку e4. Если взять на e4, твоего коня съедят.",
        "Забери незащищенную пешку на d5 ходом c3-d5."
      ]
    },
    {
      id: "day2_piece_value_p7",
      day: 2,
      topic: "day2_piece_value",
      skill: "Двойной удар — вилка конём",
      goalType: "tactical_sequence",
      fen: "8/pp1k2pp/2r5/8/8/3N4/PP3PPP/4R1K1 w - - 0 1",
      sideToMove: "w",
      moves: ["d3e5", "e5c6"],
      solution: [
        {
          userMove: "d3e5",
          opponentMove: "d7d6",
          explanation: "Превосходная вилка! Король черных под шахом, а ладья под боем коня."
        },
        {
          userMove: "e5c6",
          opponentMove: null,
          explanation: "Отлично! Вражеская ладья выиграна."
        }
      ],
      prompt: "Используй своего коня, чтобы сделать двойную вилку и выиграть ладью противника.",
      hints: {
        soft: "Найди поле, с которого твой конь может напасть и на короля, и на ладью.",
        medium: "Используй шах конем, чтобы вынудить короля отступить.",
        strong: "Объяви шах конем с нападением на ладью, а затем забери её."
      },
      successExplanation: "Отлично! Вилка конём помогла тебе выиграть целую ладью.",
      failureExplanation: "Ищи двойной удар конем на короля и ладью одновременно.",
      learningPoint: "Применение вилки конем для выигрыша тяжелой фигуры.",
      metadata: { moveCount: 2 }
    },
    {
      id: "day2_piece_value_p8",
      day: 2,
      topic: "day2_piece_value",
      skill: "Шах с двойной угрозой",
      goalType: "tactical_sequence",
      fen: "3r2k1/1r4pp/1p1p1pp1/3n4/7P/2P2BP1/1P3P2/R4RK1 w - - 0 1",
      sideToMove: "w",
      moves: ["f3d5", "d5b7"],
      solution: [
        {
          userMove: "f3d5",
          opponentMove: "g8h8",
          explanation: "Отличный шах слоном с нападением на ладью!"
        },
        {
          userMove: "d5b7",
          opponentMove: null,
          explanation: "Здорово! Ладья выиграна благодаря шаху."
        }
      ],
      prompt: "Сделай шах слоном с одновременным двойным нападением и выиграй тяжелую фигуру!",
      hints: {
        soft: "Твой слон может объявить шах королю и одновременно напасть на ладью.",
        medium: "Найди поле для шаха слоном под защитой пешки.",
        strong: "Объяви шах слоном, а после отступления короля забери ладью."
      },
      successExplanation: "Здорово! Ладья выиграна благодаря шаху.",
      failureExplanation: "Найди поле для слона, где он объявит шах и нападет на ладью черных.",
      learningPoint: "Координация слона и пешечной защиты для выигрыша качества.",
      metadata: { moveCount: 2 }
    }
  ],

  day3_opening_initiative: day3_opening_initiative,


  day4_castling: [
    // ── Задача 1 ── Одноходовая | castle_safety
    {
      id: "day4_task1",
      day: 4,
      topic: "Безопасность короля",
      skill: "Рокировка как спасение",
      goalType: "castle_safety",
      fen: "r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQK2R w KQ - 4 7",
      sideToMove: "w",
      solution: [
        {
          userMove: "e1g1",
          opponentMove: null,
          explanation: "Белые убирают короля с открытой вертикали е и занимают безопасную позицию."
        }
      ],
      prompt: "Центр доски вскрыт, твой король в опасности. Спрячь его в надежном укрытии.",
      hints: {
        soft: "Посмотри, как открыта центральная вертикаль.",
        medium: "Есть способ за один ход улучшить позицию короля и соединить ладьи.",
        strong: "Король может уйти за пешечный заслон на королевском фланге."
      },
      successExplanation: "Рокировка убирает короля с опасного центра и соединяет ладьи — теперь белые готовы к игре.",
      failureExplanation: "Активные ходы выглядят привлекательно, но пока король стоит в центре, любое вскрытие линий опасно.",
      learningPoint: "Рокируй, как только центр вскрывается — король в центре под огнём опасен даже при равных силах.",
      tags: ["рокировка", "безопасность_короля", "центр", "одноходовая"],
      metadata: { difficulty: 1, moveCount: 1, multiStep: false, isStatic: true, estimatedTimeSec: 20, engineChecked: false }
    },

    // ── Задача 2 ── Одноходовая | castle_safety
    {
      id: "day4_task2",
      day: 4,
      topic: "Безопасность короля",
      skill: "Выбор стороны рокировки",
      goalType: "castle_safety",
      fen: "2kr1b1r/ppp1qppp/2np1n2/4p3/3PP3/2N1BN2/PPP1BPPP/R3K2R w KQ - 2 10",
      sideToMove: "w",
      solution: [
        {
          userMove: "e1c1",
          opponentMove: null,
          explanation: "Длинная рокировка уводит короля подальше от активности чёрных на королевском фланге."
        }
      ],
      prompt: "Враг атакует правый фланг. Выбери наиболее безопасную сторону для рокировки.",
      hints: {
        soft: "Посмотри, где больше активности у чёрных.",
        medium: "Королевский фланг уже под давлением — есть ли смысл туда идти?",
        strong: "Длинная рокировка уводит короля в тихое место и освобождает ладью для центра."
      },
      successExplanation: "Длинная рокировка уводит короля от атаки чёрных на королевском фланге. Ферзевая ладья сразу входит в игру через d1.",
      failureExplanation: "Короткая рокировка ставит короля прямо под будущую атаку. Важно чувствовать, с какой стороны давление сильнее.",
      learningPoint: "Выбор стороны рокировки — это не привычка, а анализ: смотри, где активность противника.",
      tags: ["длинная_рокировка", "выбор_стороны", "безопасность_короля", "одноходовая"],
      metadata: { difficulty: 1, moveCount: 1, multiStep: false, isStatic: true, estimatedTimeSec: 25, engineChecked: false }
    },

    // ── Задача 3 ── Одноходовая | best_move
    {
      id: "day4_task3",
      day: 4,
      topic: "Безопасность короля",
      skill: "Не брать материал ценой безопасности",
      goalType: "best_move",
      fen: "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",
      sideToMove: "w",
      solution: [
        {
          userMove: "e1g1",
          opponentMove: null,
          explanation: "Рокировка надёжнее жадного взятия. Король уходит за пешечный заслон, и атака соперника теряет силу."
        }
      ],
      prompt: "Соблазн взять пешку велик, но слон соперника смотрит в центр. Сначала обезопась короля.",
      hints: {
        soft: "Прежде чем брать что-то, проверь — нет ли у соперника ответного удара.",
        medium: "Если конь пойдёт вперёд, слон противника сможет нанести удар с шахом. Куда деться королю?",
        strong: "Рокировка убирает короля из-под потенциального удара и активирует ладью одним ходом."
      },
      successExplanation: "Верно! Жадный ход конём вёл к Bxf2+ с шахом — король терял рокировку, а конь был бы потерян. После O-O такой атаки нет, и ладья готова к игре.",
      failureExplanation: "Брать пешку было опасно: слон отвечал бы ударом с шахом, и король оказывался под огнём. Рокировка была надёжнее.",
      learningPoint: "Перед взятием материала убедись, что у соперника нет атакующего ответа. Безопасность короля стоит пешки.",
      tags: ["не_брать_материал", "безопасность_короля", "рокировка", "одноходовая"],
      metadata: { difficulty: 2, moveCount: 1, multiStep: false, isStatic: true, estimatedTimeSec: 30, engineChecked: true }
    },

    // ── Задача 4 ── Одноходовая | best_move
    {
      id: "day4_task4",
      day: 4,
      topic: "Безопасность короля",
      skill: "Закрыть линию атаки",
      goalType: "best_move",
      fen: "r1bqk2r/ppp1bppp/2np1n2/4p3/2B1P3/2NP1N2/PPP2PPP/R1BQK2R w KQkq - 2 7",
      sideToMove: "w",
      solution: [
        {
          userMove: "e1g1",
          opponentMove: null,
          explanation: "Рокировка немедленно убирает короля из-под диагональной атаки слона e7 и защищает позицию."
        }
      ],
      prompt: "Слон врага целится в твоего короля по диагонали. Уведи лидера из-под удара.",
      hints: {
        soft: "Найди диагональ, по которой работает слон противника.",
        medium: "Пока король в центре, эта диагональ опасна. Есть способ её закрыть или уйти от неё.",
        strong: "Рокировка ставит короля за пешечный заслон и убирает его с диагонали."
      },
      successExplanation: "Рокировка убирает короля с опасной диагонали. Теперь слон e7 не представляет угрозы.",
      failureExplanation: "Продолжать развитие без короля в безопасности — риск. Диагональ слона остаётся открытой.",
      learningPoint: "Следи за диагоналями слонов противника. Рокировка закрывает линии атаки и убирает короля из-под огня.",
      tags: ["закрыть_линию", "диагональ", "безопасность_короля", "одноходовая"],
      metadata: { difficulty: 2, moveCount: 1, multiStep: false, isStatic: true, estimatedTimeSec: 30, engineChecked: false }
    },

    // ── Задача 5 ── Многоходовая | tactical_sequence
    {
      id: "day4_task5",
      day: 4,
      topic: "Безопасность короля",
      skill: "Подготовка рокировки",
      goalType: "tactical_sequence",
      fen: "r1bqk2r/ppp2ppp/2n2n2/3pp3/2B1P3/2NP1N2/PPP2PPP/R1BQK2R w KQkq - 0 7",
      sideToMove: "w",
      solution: [
        {
          userMove: "c3d5",
          opponentMove: "f6d5",
          explanation: "Белые разменивают коня, убирая защитника d5 и освобождая напряжение в центре."
        },
        {
          userMove: "e1g1",
          opponentMove: null,
          explanation: "Теперь король в безопасности. Позиция стабилизирована."
        }
      ],
      prompt: "В центре доски сильное напряжение. Найди промежуточный размен перед рокировкой.",
      hints: {
        soft: "Иногда перед рокировкой стоит сделать один полезный ход.",
        medium: "Обмен на центральном поле может упростить позицию и снять напряжение.",
        strong: "Разменяй коня в центре, а потом спрячь короля."
      },
      successExplanation: "Сначала обмен в центре снял напряжение, затем рокировка убрала короля в безопасное место.",
      failureExplanation: "Если сразу рокировать, не разрядив центр, противник может вскрыть позицию и атаковать.",
      learningPoint: "Иногда рокировку нужно подготовить: сначала разряди напряжение в центре, потом прячь короля.",
      tags: ["подготовка_рокировки", "центр", "безопасность_короля", "многоходовая"],
      metadata: { difficulty: 3, moveCount: 2, multiStep: true, isStatic: true, estimatedTimeSec: 40, engineChecked: false }
    },

    // ── Задача 6 ── Многоходовая | best_move
    {
      id: "day4_task6",
      day: 4,
      topic: "Безопасность короля",
      skill: "Опасность открытого центра",
      goalType: "best_move",
      fen: "r2qk2r/ppp1bppp/2np1n2/4p3/3PP3/2N1BN2/PPP2PPP/R2QKB1R w KQkq - 2 8",
      sideToMove: "w",
      solution: [
        {
          userMove: "f1e2",
          opponentMove: "e8g8",
          explanation: "Белые развивают слона, готовясь к рокировке. Чёрные немедленно рокируют."
        },
        {
          userMove: "e1g1",
          opponentMove: null,
          explanation: "Теперь белые рокируют и убирают короля с вскрывающегося центра."
        }
      ],
      prompt: "Центр вот-вот откроется. Что важнее сделать: начать атаку или обезопасить себя?",
      hints: {
        soft: "Противник уже рокировал. А твой король?",
        medium: "Перед рокировкой нужно расчистить путь для слона.",
        strong: "Развей последнюю фигуру между королём и ладьёй, потом рокируй."
      },
      successExplanation: "Развитие слона освободило путь для рокировки. Теперь белый король в безопасности, пока центр вскрывается.",
      failureExplanation: "Попытка атаковать без рокировки — риск. Когда центр откроется, твой король окажется под ударами.",
      learningPoint: "Если центр вот-вот вскроется, сначала убери короля. Атака подождёт.",
      tags: ["открытый_центр", "безопасность_короля", "развитие", "многоходовая"],
      metadata: { difficulty: 3, moveCount: 2, multiStep: true, isStatic: true, estimatedTimeSec: 40, engineChecked: false }
    },

    // ── Задача 7 ── Многоходовая | castle_safety
    {
      id: "day4_task7",
      day: 4,
      topic: "Безопасность короля",
      skill: "Битые поля и невозможность рокировки",
      goalType: "castle_safety",
      fen: "r1bqk2r/ppp2ppp/2n2n2/3pp3/1b2P3/2NP1N2/PPP1BPPP/R1BQK2R w KQkq - 2 7",
      sideToMove: "w",
      solution: [
        {
          userMove: "c1d2",
          opponentMove: "b4d2",
          explanation: "Белые разменивают слона, который перекрывал угрозу. Чёрные берут слона."
        },
        {
          userMove: "d1d2",
          opponentMove: "e8g8",
          explanation: "Ферзь берёт, освобождая поле f1 для короля. Чёрные рокируют."
        },
        {
          userMove: "e1g1",
          opponentMove: null,
          explanation: "Наконец-то рокировка возможна — король уходит в безопасное место."
        }
      ],
      prompt: "Вражеская фигура блокирует твою рокировку. Сначала реши эту проблему разменом.",
      hints: {
        soft: "Поищи, какая фигура мешает расчистить путь для короля.",
        medium: "Чтобы рокировать, нужно убрать угрозу — сначала займись слоном противника.",
        strong: "Разменяй мешающую фигуру, восстанови контроль над нужными полями, потом рокируй."
      },
      successExplanation: "Сначала размен убрал опасного слона, затем рокировка стала возможной и безопасной.",
      failureExplanation: "Попытка рокировать сразу не работает — поля под контролем противника. Нужно сначала устранить угрозу.",
      learningPoint: "Иногда рокировка невозможна не из-за правил, а из-за битых полей. Сначала устрани угрозу.",
      tags: ["битые_поля", "невозможность_рокировки", "безопасность_короля", "многоходовая"],
      metadata: { difficulty: 4, moveCount: 3, multiStep: true, isStatic: true, estimatedTimeSec: 55, engineChecked: false }
    },

    // ── Задача 8 ── Многоходовая | tactical_sequence (мини-босс)
    {
      id: "day4_task8",
      day: 4,
      topic: "Безопасность короля",
      skill: "Защита от вскрытой атаки",
      goalType: "tactical_sequence",
      fen: "r1bqk2r/ppp2ppp/2n1pn2/3p4/2PPP3/2N2N2/PP3PPP/R1BQKB1R w KQkq - 0 8",
      sideToMove: "w",
      solution: [
        {
          userMove: "d4d5",
          opponentMove: "c6e7",
          explanation: "Белые продвигают пешку, вскрывая напряжение. Чёрный конь вынужден отступить."
        },
        {
          userMove: "f1e2",
          opponentMove: "e8g8",
          explanation: "Белые развивают слона, готовясь к рокировке. Чёрные немедленно рокируют."
        },
        {
          userMove: "e1g1",
          opponentMove: null,
          explanation: "Белые рокируют до того, как центр полностью вскрылся. Король в безопасности."
        }
      ],
      prompt: "Центр вскрывается, а твой король не защищен. Успей увести его за три точных хода.",
      hints: {
        soft: "Центральное напряжение нарастает. Подумай, что будет, когда линии откроются.",
        medium: "Прежде чем рокировать, нужно завершить развитие. Какая фигура ещё не вышла?",
        strong: "Двигай центральную пешку, потом развивай слона — и только потом рокируй."
      },
      successExplanation: "Три точных хода: вскрытие центра под контролем, завершение развития и рокировка — король успел спрятаться.",
      failureExplanation: "Пропустив рокировку, ты оставляешь короля под удар в момент, когда центр открывается. Этого противник и ждёт.",
      learningPoint: "Когда центр вскрывается, у тебя есть только несколько ходов, чтобы укрыть короля. Не трать их на жадность.",
      tags: ["открытый_центр", "вскрытая_атака", "рокировка", "многоходовая", "мини_босс"],
      metadata: { difficulty: 5, moveCount: 3, multiStep: true, isStatic: true, estimatedTimeSec: 60, engineChecked: false }
    }
  ],

  day5_check_mate_stalemate: [
    {
      id: "day5_check_mate_stalemate_p1",
      day: 5,
      topic: "day5_check_mate_stalemate",
      skill: "Арабский мат ладьей и конем",
      goalType: "mate",
      fen: "3r3k/pp3R2/2p2N1p/3n4/3B4/2P5/PP3PPP/6K1 w - - 0 1",
      sideToMove: "w",
      solution: [
        {
          userMove: "f7h7",
          opponentMove: null,
          explanation: "Отлично! Ладья объявляет мат при поддержке коня, контролирующего поле отступления."
        }
      ],
      prompt: "Король соперника зажат в углу, а твой конь контролирует ключевое поле отступления. Нанеси решающий удар тяжелой фигурой.",
      hints: {
        soft: "Сочетание ладьи и коня на краю доски создает смертельную угрозу.",
        medium: "Твой конь защищает поле прямо рядом с королем соперника.",
        strong: "Используй ладью на седьмой горизонтали, чтобы объявить мат прямо перед королем соперника."
      },
      successExplanation: "Король противника отрезан: твой конь держит поля g8 и h7, а ладья наносит финальный удар под его защитой.",
      failureExplanation: "Этот ход выпускает победу. Обрати внимание на взаимодействие ладьи и коня у вражеского короля.",
      learningPoint: "Арабский мат — классический мотив, где конь на f6 надежно прикрывает атакующую ладью на h7 и поле g8.",
      tags: ["day5", "mate", "arabian_mate", "rook_knight"],
      metadata: {
        isStatic: true,
        estimatedTimeSec: 30,
        moveCount: 1,
        engineChecked: false
      }
    },
    {
      id: "day5_check_mate_stalemate_p2",
      day: 5,
      topic: "day5_check_mate_stalemate",
      skill: "Поиск единственного матующего шаха",
      goalType: "mate",
      fen: "3r1rk1/pp1q1ppp/8/6NQ/2B5/B1P5/PP3PPP/6K1 w - - 0 1",
      sideToMove: "w",
      solution: [
        {
          userMove: "h5h7",
          opponentMove: null,
          explanation: "Превосходно! Это единственный шах, который сразу завершает партию."
        }
      ],
      prompt: "Королевский фланг соперника ослаблен, и у тебя есть несколько атакующих шахов. Найди тот, который не оставляет шанса на спасение.",
      hints: {
        soft: "Будь внимателен к защитным возможностям соперника после каждого твоего шаха.",
        medium: "Вражеский король может спастись, если атаковать пешку перед ним. Ищи более прямой матующий путь.",
        strong: "Объяви шах ферзем на крайнюю вертикаль доски, используя поддержку своего коня."
      },
      successExplanation: "Ферзь наносит удар при поддержке коня. Королю некуда бежать, а защитить это поле черные не могут.",
      failureExplanation: "Другие шахи лишь помогают сопернику перегруппироваться или спастись. Всегда ищи самый форсированный ответ.",
      learningPoint: "Не все шахи одинаково полезны. Всегда проверяй пути отступления короля соперника перед нанесением удара.",
      tags: ["day5", "mate", "mate_in_1", "accuracy"],
      metadata: {
        isStatic: true,
        estimatedTimeSec: 30,
        moveCount: 1,
        engineChecked: false
      }
    },
    {
      id: "day5_check_mate_stalemate_p3",
      day: 5,
      topic: "day5_check_mate_stalemate",
      skill: "Отличие мата от пата",
      goalType: "avoid_stalemate",
      fen: "7k/pp1Q3p/2p2K1P/8/8/2P5/PP4P1/8 w - - 0 1",
      sideToMove: "w",
      solution: [
        {
          userMove: "d7g7",
          opponentMove: null,
          explanation: "Идеально! Шах ферзем забирает последние поля и объявляет мат."
        }
      ],
      prompt: "Соперник полностью зажат, но неосторожное действие может подарить ему спасительную ничью. Заверши партию без помарок.",
      hints: {
        soft: "Пат — это ничья, когда у соперника нет ходов, но его король не находится под шахом.",
        medium: "Обычный тихий ход ферзем лишит соперника последних ходов, не создавая угрозы королю.",
        strong: "Объяви шах ферзем на поле прямо перед королем, где он будет защищен твоим собственным королем."
      },
      successExplanation: "Ферзь объявляет шах под защитой короля, забирая последние свободные поля. Это чистый мат.",
      failureExplanation: "Этот ход не объявляет шах и запирает короля без ходов — обидный пат. Ищи прямое нападение.",
      learningPoint: "В выигранных позициях важно не допускать пата. Матующий ход должен обязательно объявлять шах королю.",
      tags: ["day5", "avoid_stalemate", "mate_in_1"],
      metadata: {
        isStatic: true,
        estimatedTimeSec: 35,
        moveCount: 1,
        engineChecked: false
      }
    },
    {
      id: "day5_check_mate_stalemate_p4",
      day: 5,
      topic: "day5_check_mate_stalemate",
      skill: "Контроль полей отступления",
      goalType: "mate",
      fen: "7k/7p/6p1/8/3B4/8/PP4PP/5Q1K w - - 0 1",
      sideToMove: "w",
      solution: [
        {
          userMove: "f1f8",
          opponentMove: null,
          explanation: "Превосходно! Ферзь объявляет мат, пока слон перекрывает единственный путь отступления."
        }
      ],
      prompt: "Вражеский король пытается спрятаться за пешками, но твой слон отрезает его ключевой маршрут отхода. Найди завершающий удар.",
      hints: {
        soft: "Посмотри, какую важную диагональ контролирует твой слон.",
        medium: "Слон полностью отрезает королю поле отступления. Используй это для линейной атаки ферзем.",
        strong: "Прорвись ферзем на восьмую горизонталь доски, чтобы объявить мат."
      },
      successExplanation: "Ферзь атакует по восьмой горизонтали, а слон надежно контролирует поле g7, не давая королю сбежать.",
      failureExplanation: "Простой шах на f6 позволяет сопернику прикрыться слоном или пешкой. Ищи линейный удар.",
      learningPoint: "Матовая сеть плетется совместными усилиями: дальнобойный слон держит пути отхода, пока ферзь атакует короля.",
      tags: ["day5", "mate", "coordination", "bishop_control"],
      metadata: {
        isStatic: true,
        estimatedTimeSec: 30,
        moveCount: 1,
        engineChecked: false
      }
    },
    {
      id: "day5_check_mate_stalemate_p5",
      day: 5,
      topic: "day5_check_mate_stalemate",
      skill: "Красивая матовая комбинация",
      goalType: "mate",
      fen: "r4r1k/ppp1N1pp/8/7Q/8/3R4/PPP2PPP/5RK1 w - - 0 1",
      sideToMove: "w",
      solution: [
        {
          userMove: "h5h7",
          opponentMove: "h8h7",
          explanation: "Потрясающая жертва ферзя вскрывает вертикаль для ладьи."
        },
        {
          userMove: "d3h3",
          opponentMove: null,
          explanation: "Ладья объявляет мат по открытой линии. Король заперт конем."
        }
      ],
      prompt: "Король соперника заперт на краю доски, но защищен пешечным барьером. Пожертвуй сильнейшую фигуру, чтобы открыть дорогу ладье.",
      hints: {
        soft: "Иногда для победы нужно отдать самую дорогую фигуру.",
        medium: "Взятие крайней пешки королем откроет крайнюю вертикаль для твоей ладьи.",
        strong: "Забери ферзем пешку прямо перед королем, а после его вынужденного ответа подключи ладью с фланга."
      },
      successExplanation: "Потрясающая жертва ферзя позволила вскрыть вертикаль, после чего ладья объявила неизбежный мат по открытой линии.",
      failureExplanation: "Пассивные ходы позволяют сопернику защититься. Ищи форсированное взятие с шахом для вскрытия линий.",
      learningPoint: "Жертва фигуры — мощное средство для разрушения пешечного прикрытия короля и вскрытия линий для ладьи.",
      tags: ["day5", "mate", "sacrifice", "anastasias_mate", "mating_net"],
      metadata: {
        isStatic: true,
        estimatedTimeSec: 45,
        moveCount: 2,
        engineChecked: false
      }
    },
    {
      id: "day5_check_mate_stalemate_p6",
      day: 5,
      topic: "day5_check_mate_stalemate",
      skill: "Атака вместо выигрыша материала",
      goalType: "mate",
      fen: "4r1k1/pp3ppp/2p2Q2/q5N1/8/2P5/PP3PPP/R5K1 w - - 0 1",
      sideToMove: "w",
      solution: [
        {
          userMove: "f6f7",
          opponentMove: "g8h8",
          explanation: "Ферзь врывается в лагерь черных с шахом при поддержке коня."
        },
        {
          userMove: "f7e8",
          opponentMove: null,
          explanation: "Отличный мат на последней горизонтали!"
        }
      ],
      prompt: "На левом фланге висит незащищенный ферзь черных, но твоя цель — король. Не отвлекайся на материальную выгоду и иди на штурм.",
      hints: {
        soft: "Не поддавайся искушению забрать ферзя соперника. Ищи более быструю победу.",
        medium: "Сделай первый шаг ферзем с шахом на седьмую горизонталь при поддержке коня.",
        strong: "Начни с атаки пешки перед королем, а после его отхода забери ладью в углу."
      },
      successExplanation: "Великолепно! Ты проигнорировал вражеского ферзя и провел быструю матовую атаку через слабое поле f7.",
      failureExplanation: "Взятие ферзя дает перевес, но затягивает партию или упускает быстрый мат. Фокусируйся на короле.",
      learningPoint: "Поставив мат, ты немедленно выигрываешь партию. Матовая атака всегда имеет приоритет над сбором материала.",
      tags: ["day5", "mate", "accuracy", "back_rank"],
      metadata: {
        isStatic: true,
        estimatedTimeSec: 40,
        moveCount: 2,
        engineChecked: false
      }
    },
    {
      id: "day5_check_mate_stalemate_p7",
      day: 5,
      topic: "day5_check_mate_stalemate",
      skill: "Спертый мат",
      goalType: "mate",
      fen: "5r1k/pp4pp/2p4N/8/2Q5/2P5/PP3PPP/5RK1 w - - 0 1",
      sideToMove: "w",
      solution: [
        {
          userMove: "c4g8",
          opponentMove: "f8g8",
          explanation: "Потрясающая жертва ферзя зажимает короля собственными фигурами."
        },
        {
          userMove: "h6f7",
          opponentMove: null,
          explanation: "Конь объявляет мат королю, которому мешает собственная ладья."
        }
      ],
      prompt: "Король соперника окружен собственными фигурами. Принеси ферзя в жертву ради эффектного финала.",
      hints: {
        soft: "Король зажат в углу. Собственные фигуры мешают ему спастись.",
        medium: "Заставь ладью соперника встать прямо перед своим королем, пожертвовав ферзя на восьмой горизонтали.",
        strong: "Поставь ферзя под удар ладьи в углу доски, а вторым ходом объяви шах конем."
      },
      successExplanation: "Потрясающий спертый мат! Собственные фигуры задушили короля черных, лишив его малейшего шанса на спасение.",
      failureExplanation: "Обычные шахи позволяют королю убежать. Ищи способ форсированно заблокировать его в углу.",
      learningPoint: "Спертый мат — это тактический прием, когда конь объявляет мат королю, полностью заблокированному своими же фигурами.",
      tags: ["day5", "mate", "smothered_mate", "sacrifice"],
      metadata: {
        isStatic: true,
        estimatedTimeSec: 45,
        moveCount: 2,
        engineChecked: false
      }
    },
    {
      id: "day5_check_mate_stalemate_p8",
      day: 5,
      topic: "day5_check_mate_stalemate",
      skill: "Финальный расчет в атаке",
      goalType: "tactical_sequence",
      fen: "3r2k1/pp1q1ppp/5B1Q/6N1/8/8/PP3PPP/3RR1K1 w - - 0 1",
      sideToMove: "w",
      solution: [
        {
          userMove: "h6h7",
          opponentMove: "g8f8",
          explanation: "Ферзь берет пешку с шахом, вынуждая короля соперника бежать."
        },
        {
          userMove: "h7h8",
          opponentMove: null,
          explanation: "Шах и мат! Король отрезан слоном и ладьями."
        }
      ],
      prompt: "Перед тобой россыпь заманчивых взятий, включая вражеского ферзя и ладью. Расчитай форсированную матовую цепочку.",
      hints: {
        soft: "Не трать время на взятие чужих фигур. Король черных раскрыт — матуй.",
        medium: "Первый шах ферзем должен быть защищен твоим конем. Король соперника побежит на соседнюю вертикаль.",
        strong: "Атакуй ферзем пешку на крайней линии под защитой коня, а затем нанеси финальный удар на восьмой горизонтали."
      },
      successExplanation: "Отличный расчет! Вместо взятия материала ты форсировал мат в два хода, перекрыв королю все пути спасения слоном и ладьей.",
      failureExplanation: "Взятие ферзя или ладьи упускает немедленный выигрыш. Всегда ищи кратчайший путь к победе.",
      learningPoint: "В атаке важна точность: форсированные матовые ходы не дают сопернику шанса на защиту и контригру.",
      tags: ["day5", "mate", "mini_boss", "accuracy", "tactical_sequence"],
      metadata: {
        isStatic: true,
        estimatedTimeSec: 60,
        moveCount: 2,
        engineChecked: false
      }
    }
  ],

  day6_fork_double_attack: [
    {
      fen: "3q3k/8/8/6N1/8/8/8/4K3 w - - 0 1",
      moves: ["g5f7"],
      prompt: "Твой конь готов нанести сокрушительный двойной удар. Напади на короля и ферзя сразу.",
      hints: [
        "Ищи поле для коня, откуда он дотянется и до короля h8, и до ферзя d8.",
        "Поле f7 идеально подходит для прыжка.",
        "Сделай ход конем: g5-f7."
      ]
    },
    {
      fen: "r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1",
      moves: ["b5c7"],
      prompt: "Найди прыжок коня, который одновременно объявит шах королю и нападет на ладью врага.",
      hints: [
        "Конь на b5 может пойти на поле c7.",
        "Оттуда он объявит шах королю e8 и нападет на ладью a8.",
        "Сыграй конем на c7."
      ]
    },
    {
      fen: "4k3/8/8/1r3q2/8/5N2/8/4K3 w - - 0 1",
      moves: ["f3d4"],
      prompt: "Ищи центральное поле для своего коня, чтобы атаковать ферзя и ладью одновременно.",
      hints: [
        "Ищи центральное поле, с которого конь дотянется до f5 и b5.",
        "Поле d4 находится как раз на нужном расстоянии от обеих фигур.",
        "Перемести коня на d4."
      ]
    },
    {
      fen: "4k3/2q1r3/3b4/4P3/8/8/8/K7 w - - 0 1",
      moves: ["e5d6"],
      prompt: "Даже самая скромная пешка способна сделать вилку. Забери слона с двойным нападением.",
      hints: [
        "Твоя пешка на e5 может совершить взятие по диагонали.",
        "Побей слона на d6. После этого пешка раздвоит атаку на ферзя и ладью.",
        "Забери слона пешкой: e5-d6."
      ]
    },
    {
      fen: "r5k1/8/8/8/8/8/8/3QK3 w - - 0 1",
      moves: ["d1d5"],
      prompt: "Выведи своего ферзя на ударную диагональ, объяви шах королю и выиграй ладью в углу.",
      hints: [
        "Ферзь на d1 должен встать на большую диагональ.",
        "Ход на d5 дает шах королю g8 и одновременно нападает на ладью a8.",
        "Сыграй ферзем на d5."
      ]
    },
    {
      fen: "8/b6k/8/8/8/8/8/3R1K2 w - - 0 1",
      moves: ["d1d7"],
      prompt: "Перемести ладью на нужную горизонталь, чтобы напасть на короля и беззащитного слона.",
      hints: [
        "Перемести ладью на 7-ю горизонталь, где стоят обе черные фигуры.",
        "Поле d7 позволяет атаковать короля на h7 и слона на a7.",
        "Сыграй ладьей на d7."
      ]
    },
    {
      fen: "4k3/8/8/8/5q2/8/1r6/2N1K3 w - - 0 1",
      moves: ["c1d3"],
      prompt: "Твой конь оказался в ловушке, но может спастись с помощью мощного двойного удара.",
      hints: [
        "Конь должен выпрыгнуть в центр.",
        "Поле d3 находится под боем коня c1 и связывает фигуры f4 и b2.",
        "Сыграй конем на d3."
      ]
    },
    {
      fen: "r3k3/8/8/8/8/8/6B1/4K3 w - - 0 1",
      moves: ["g2c6"],
      prompt: "Используй дальнобойную силу белопольного слона для двойного нападения с шахом.",
      hints: [
        "Слон на g2 должен пойти по длинной белопольной диагонали.",
        "Поле c6 связывает короля на e8 и ладью на a8.",
        "Сыграй слоном на c6."
      ]
    }
  ],

  day7_review_mixed: [
    {
      fen: "4k3/4q3/8/8/8/8/8/4R1K1 w - - 0 1",
      moves: ["e1e7"],
      prompt: "Вражеский ферзь полностью обездвижен связкой. Не упускай шанс и забери его ладьёй.",
      hints: [
        "Черный ферзь не может отступить, так как за ним стоит король.",
        "Ладья на e1 может бесплатно забрать ферзя на e7.",
        "Сделай взятие: e1-e7."
      ]
    },
    {
      fen: "7k/5Q2/6K1/8/8/8/8/8 w - - 0 1",
      moves: ["f7f8"],
      prompt: "Король противника отрезан. Сделай решающий ход ферзем на последнюю горизонталь доски.",
      hints: [
        "Черный король полностью зажат на краю доски.",
        "Сделай ход ферзем на последнюю горизонталь — поле f8.",
        "Сыграй f7-f8."
      ]
    },
    {
      fen: "3q3k/8/8/6N1/8/8/8/4K3 w - - 0 1",
      moves: ["g5f7"],
      prompt: "Найди прыжок коня с шахом, который позволит выиграть ферзя соперника на следующем ходу.",
      hints: [
        "Конь на g5 может прыгнуть с шахом.",
        "Поле f7 позволяет атаковать короля и ферзя одновременно.",
        "Сыграй конем на f7."
      ]
    },
    {
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      moves: ["e2e4"],
      prompt: "Начни партию правильно. Захвати пешкой центральное пространство и открой путь фигурам.",
      hints: [
        "Захвати центр пешкой и открой дорогу легким фигурам.",
        "Сыграй пешкой перед королем на две клетки вперед.",
        "Сделай ход e2-e4."
      ]
    },
    {
      fen: "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",
      moves: ["e1g1"],
      prompt: "Белый король всё ещё стоит в центре. Уведи его в безопасное укрытие прямо сейчас.",
      hints: [
        "Король и ладья готовы поменяться местами.",
        "Перемести короля e1 на g1.",
        "Сыграй e1g1."
      ]
    },
    {
      fen: "4r1k1/8/8/8/8/8/8/4K1B1 w - - 0 1",
      moves: ["g1e3"],
      prompt: "На твоего короля совершено нападение. Найди способ перекрыть эту атакующую линию.",
      hints: [
        "Не уводи короля, а закрой его другой фигурой.",
        "Слон на g1 может перекрыть линию атаки на поле e3.",
        "Сыграй слоном на e3."
      ]
    },
    {
      fen: "4k3/8/8/3q4/4P3/8/8/4K3 w - - 0 1",
      moves: ["e4d5"],
      prompt: "Соперник совершил грубую ошибку и оставил сильную фигуру под боем пешки. Забери её!",
      hints: [
        "Твоя пешка стоит на e4, а ферзь — на d5.",
        "Сделай выгодное диагональное взятие.",
        "Побей ферзя пешкой: e4-d5."
      ]
    },
    {
      fen: "r5k1/8/8/8/8/8/8/3QK3 w - - 0 1",
      moves: ["d1d5"],
      prompt: "Объяви шах королю соперника и одновременно выиграй незащищенную ладью в углу доски.",
      hints: [
        "Ферзь должен встать на активную диагональ с шахом.",
        "Поле d5 дает шах королю и целится в ладью в углу.",
        "Сыграй ферзем на d5."
      ]
    }
  ]
};

export const getThematicPuzzles = (day: number): ChessPuzzleTask[] => {
  const keys = [
    'day1_board_geometry',
    'day2_piece_value',
    'day3_opening_initiative',
    'day4_castling',
    'day5_check_mate_stalemate',
    'day6_fork_double_attack',
    'day7_review_mixed'
  ];
  const key = keys[day - 1] || 'day1_board_geometry';
  const puzzles = chessLessonPuzzles[key] || [];
  return puzzles.map((p, idx) => ({
    id: p.id || `chess_puzzle_${day}_${idx + 1}`,
    fen: p.fen,
    puzzleMoves: p.moves || [],
    solution: p.solution,
    successExplanation: p.successExplanation,
    failureExplanation: p.failureExplanation,
    rating: 1000,
    themes: [],
    prompt: p.prompt,
    hints: Array.isArray(p.hints)
      ? p.hints
      : p.hints && typeof p.hints === 'object'
        ? [p.hints.soft, p.hints.medium, p.hints.strong].filter(Boolean) as string[]
        : ['Подумай над лучшим ходом!'],
    sideToMove: p.sideToMove,
    metadata: p.metadata,
    day: p.day || day,
    topic: p.topic || key,
  }));
};

export const ACTIVE_CHESS_PUZZLES: ChessPuzzleTask[] = getThematicPuzzles(1);

export function validateChessPuzzles(puzzles: ChessPuzzleTask[]) {
  const fens = new Set<string>();
  puzzles.forEach((puzzle, index) => {
    const { id, fen, puzzleMoves, solution, prompt, hints, sideToMove, metadata, day, topic } = puzzle;
    let chess: Chess;
    try {
      chess = new Chess(fen);
    } catch (e: any) {
      console.warn(`[Chess Validation Error] Puzzle "${id}" (index ${index}) failed to load FEN: "${fen}". Error: ${e.message}`);
      return;
    }

    if (fens.has(fen)) {
      console.warn(`[Chess Validation Warning] Puzzle "${id}" has duplicate FEN: "${fen}"`);
    }
    fens.add(fen);

    // Static text validation: prompt must not contain coordinates like e4, f7, a1
    const coordRegex = /\b[a-h][1-8]\b/i;
    if (coordRegex.test(prompt)) {
      console.warn(`[Chess Validation Error] Puzzle "${id}" (Day ${day}, Topic: "${topic}"): prompt "${prompt}" contains single coordinates.`);
    }

    // soft and medium hints must not contain coordinates
    if (hints) {
      if (hints[0] && coordRegex.test(hints[0])) {
        console.warn(`[Chess Validation Error] Puzzle "${id}" (Day ${day}, Topic: "${topic}"): soft hint "${hints[0]}" contains single coordinates.`);
      }
      if (hints[1] && coordRegex.test(hints[1])) {
        console.warn(`[Chess Validation Error] Puzzle "${id}" (Day ${day}, Topic: "${topic}"): medium hint "${hints[1]}" contains single coordinates.`);
      }
    }

    // prompt must not contain direct commands
    const forbiddenPhrases = ["сыграй", "ходом", "сделай ход", "перемести", "побей на"];
    const lowerPrompt = prompt.toLowerCase();
    for (const phrase of forbiddenPhrases) {
      if (lowerPrompt.includes(phrase)) {
        console.warn(`[Chess Validation Error] Puzzle "${id}" (Day ${day}, Topic: "${topic}"): prompt contains forbidden phrase "${phrase}".`);
      }
    }

    // Determine if V2 solution or V1 moves should be validated
    if (solution && solution.length > 0) {
      // Validation for V2 task with solution[]
      
      // 2. sideToMove matches the active side in FEN
      if (sideToMove) {
        const activeColor = chess.turn(); // 'w' or 'b'
        if (sideToMove !== activeColor) {
          console.warn(`[Chess Validation Error] Puzzle "${id}" (Day ${day}, Topic: "${topic}"): sideToMove "${sideToMove}" does not match active color "${activeColor}" in FEN.`);
        }
      }

      // 7. metadata.moveCount must match solution.length
      if (metadata && metadata.moveCount !== undefined) {
        if (metadata.moveCount !== solution.length) {
          console.warn(`[Chess Validation Error] Puzzle "${id}" (Day ${day}, Topic: "${topic}"): metadata.moveCount (${metadata.moveCount}) does not match solution.length (${solution.length}).`);
        }
      }

      // Validate each step in the solution
      let tempChess = new Chess(fen);
      for (let i = 0; i < solution.length; i++) {
        const step = solution[i];
        
        // 4. Each solution[i].userMove is legal in the current position
        const userMove = step.userMove;
        const fromUser = userMove.slice(0, 2);
        const toUser = userMove.slice(2, 4);
        const promotionUser = userMove.slice(4) || undefined;
        
        try {
          const result = tempChess.move({ from: fromUser, to: toUser, promotion: promotionUser });
          if (!result) throw new Error("Move returned null");
        } catch (e: any) {
          console.warn(`[Chess Validation Error] Puzzle "${id}" (Day ${day}, Topic: "${topic}"): User Move #${i + 1} ("${userMove}") is illegal. Current FEN: "${tempChess.fen()}". Error: ${e.message}`);
          break;
        }

        // 5. After userMove, if there is opponentMove:
        if (step.opponentMove) {
          const oppMove = step.opponentMove;
          const fromOpp = oppMove.slice(0, 2);
          const toOpp = oppMove.slice(2, 4);
          const promotionOpp = oppMove.slice(4) || undefined;
          
          try {
            const result = tempChess.move({ from: fromOpp, to: toOpp, promotion: promotionOpp });
            if (!result) throw new Error("Move returned null");
          } catch (e: any) {
            console.warn(`[Chess Validation Error] Puzzle "${id}" (Day ${day}, Topic: "${topic}"): Opponent Move #${i + 1} ("${oppMove}") is illegal. Current FEN: "${tempChess.fen()}". Error: ${e.message}`);
            break;
          }
        }
      }
    } else {
      // Fallback: old V1 moves validation
      if (puzzleMoves.length === 0) {
        console.warn(`[Chess Validation Warning] Puzzle "${id}" has no moves defined.`);
        return;
      }

      let tempChess = new Chess(fen);
      for (let i = 0; i < puzzleMoves.length; i++) {
        const moveUci = puzzleMoves[i];
        const from = moveUci.slice(0, 2);
        const to = moveUci.slice(2, 4);
        const promotion = moveUci.slice(4) || undefined;

        try {
          const result = tempChess.move({ from, to, promotion });
          if (!result) {
            throw new Error(`Move returned null`);
          }
        } catch (e: any) {
          console.warn(`[Chess Validation Warning] Puzzle "${id}" ("${prompt.slice(0, 30)}..."): Move #${i + 1} ("${moveUci}") is illegal. Current FEN: "${tempChess.fen()}". Error: ${e.message}`);
          break;
        }
      }
    }
  });
}

declare const __DEV__: boolean;
if (typeof __DEV__ !== 'undefined' && __DEV__) {
  console.log('[Chess puzzles bank] Running automated validation on startup...');
  for (let d = 1; d <= 7; d++) {
    validateChessPuzzles(getThematicPuzzles(d));
  }
  console.log('[Chess puzzles bank] Validation completed.');
}
