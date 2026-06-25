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
  dayKey?: string;
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
  dayKey?: string;
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
      soft: "Обрати внимание на связку твоего слона с конем противника на королевском фланге.",
      medium: "Разменяй слона на коня, чтобы освободить центральное поле для атаки конем.",
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
      id: "day2_piece_value_p6",
      day: 2,
      topic: "day2_piece_value",
      skill: "Выбор цели — защищенная vs незащищенная",
      goalType: "win_material",
      fen: "4k3/8/8/3p4/4p3/2N5/8/4K3 w - - 0 1",
      sideToMove: "w",
      moves: ["c3d5"],
      solution: [
        {
          userMove: "c3d5",
          opponentMove: null,
          explanation: "Верно! Пешка на d5 беззащитна, а на e4 — защищена."
        }
      ],
      prompt: "Одна из пешек соперника находится под защитой, а другая нет. Сделай верный выбор!",
      hints: {
        soft: "Одна из чёрных пешек прикрывает другую. Выбери безопасную цель.",
        medium: "Не бери ту пешку, которая под защитой соседки — иначе потеряешь коня.",
        strong: "Забери незащищенную пешку на d5 ходом c3-d5."
      },
      successExplanation: "Верно! Конь забирает беззащитную пешку на d5.",
      failureExplanation: "Пешка на e4 защищена пешкой d5. Нужно взять ту, что без защиты.",
      learningPoint: "Распознавание защищённых и незащищённых фигур при выборе цели.",
      metadata: { moveCount: 1 }
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


  day4_king_safety: [
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
      prompt: "Слон соперника целится в слабое место, но твой король ещё в центре. Сначала обезопась лидера.",
      hints: {
        soft: "Прежде чем брать что-то, проверь — нет ли у соперника ответного удара.",
        medium: "Если конь пойдёт вперёд, слон противника сможет нанести удар с шахом. Куда деться королю?",
        strong: "Рокировка убирает короля из-под потенциального удара и активирует ладью одним ходом."
      },
      successExplanation: "Верно! Жадный ход конём вёл к Bxf2+ с шахом — король терял рокировку, а конь был бы потерян. После O-O такой атаки нет, и ладья готова к игре.",
      failureExplanation: "Атаковать конём было опасно: слон противника отвечал ударом с шахом и король терял рокировку.",
      learningPoint: "Слон соперника в центре — сигнал опасности. Сначала убери короля, потом думай об атаке.",
      tags: ["не_брать_материал", "безопасность_короля", "рокировка", "одноходовая"],
      metadata: { difficulty: 2, moveCount: 1, multiStep: false, isStatic: true, estimatedTimeSec: 30, engineChecked: true }
    },

    // ── Задача 4 ── Одноходовая | best_move
    {
      id: "day4_task4",
      day: 4,
      topic: "Безопасность короля",
      skill: "Профилактика безопасности",
      goalType: "best_move",
      fen: "r1bqk2r/ppp1bppp/2np1n2/4p3/2B1P3/2NP1N2/PPP2PPP/R1BQK2R w KQkq - 2 7",
      sideToMove: "w",
      solution: [
        {
          userMove: "e1g1",
          opponentMove: null,
          explanation: "Рокировка уводит короля в безопасное укрытие и завершает развитие королевского фланга."
        }
      ],
      prompt: "Пока в центре доски сохраняется затишье, успей спрятать короля в безопасное место.",
      hints: {
        soft: "Заверши развитие королевского фланга и подготовь безопасность короля.",
        medium: "Король в центре уязвим. Найди способ увести его одним движением под защиту пешек.",
        strong: "Используй рокировку, чтобы скрыть лидера за пешечным щитом и активировать ладью."
      },
      successExplanation: "Рокировка — важнейший профилактический ход. Теперь твой король защищён пешками, а ладья готова бороться за центр.",
      failureExplanation: "В спокойных позициях важно вовремя обезопасить короля. Оставлять его в центре без необходимости — неоправданный риск.",
      learningPoint: "Не откладывай рокировку. Безопасность короля — фундамент для начала любых активных действий на доске.",
      tags: ["рокировка", "безопасность_короля", "профилактика", "одноходовая"],
      metadata: { difficulty: 2, moveCount: 1, multiStep: false, isStatic: true, estimatedTimeSec: 30, engineChecked: false }
    },

    // ── Задача 5 ── Многоходовая | tactical_sequence
    {
      id: "day4_task5",
      day: 4,
      topic: "Безопасность короля",
      skill: "Подготовка рокировки",
      goalType: "tactical_sequence",
      fen: "r2qkb1r/ppp2ppp/2n1b3/3np3/2B1P3/2NP1N2/PPP2PPP/R1BQK2R w KQkq - 0 7",
      sideToMove: "w",
      solution: [
        {
          userMove: "c3d5",
          opponentMove: "e6d5",
          explanation: "Белые разменивают активного коня соперника в центре, разряжая обстановку."
        },
        {
          userMove: "e1g1",
          opponentMove: null,
          explanation: "Теперь, когда центр стабилизирован, рокировка безопасно уводит короля."
        }
      ],
      prompt: "В центре напряжение. Сначала сними главную угрозу, затем уведи короля из центра.",
      hints: {
        soft: "Посмотри на активного коня соперника в самом центре доски.",
        medium: "Разменяй центральную фигуру противника, чтобы разрядить обстановку.",
        strong: "После размена коней у тебя появится темп, чтобы сделать рокировку."
      },
      successExplanation: "Отлично! Размен активного коня чёрных в центре снял напряжение, после чего рокировка позволила увести короля в безопасное место.",
      failureExplanation: "Если сразу сделать рокировку, чёрные сохранят сильную фигуру в центре и могут начать опасную атаку.",
      learningPoint: "Перед рокировкой важно нейтрализовать наиболее активные фигуры соперника в центре, чтобы стабилизировать позицию.",
      tags: ["подготовка_рокировки", "центр", "размен", "многоходовая"],
      metadata: { difficulty: 3, moveCount: 2, multiStep: true, isStatic: true, estimatedTimeSec: 40, engineChecked: true }
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
      fen: "r1bqk2r/ppp2ppp/2n2n2/3pp3/Nb2P3/5N2/PPP1BPPP/R1BQK2R w KQkq - 2 7",
      sideToMove: "w",
      solution: [
        {
          userMove: "c1d2",
          opponentMove: "b4d2",
          explanation: "Белые разменивают слона, убирая блокировщика. Чёрные берут слона."
        },
        {
          userMove: "d1d2",
          opponentMove: "e8g8",
          explanation: "Ферзь берёт, освобождая путь для короля. Чёрные рокируют."
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
          userMove: "e4d5",
          opponentMove: "c6e7",
          explanation: "Белые берут пешку, вскрывая центр. Чёрный конь вынужден отступить."
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
    },

    // ── Задача 9 ── Одноходовая | профилактика коневой вилки
    {
      id: "day4_task9",
      day: 4,
      topic: "Безопасность короля",
      skill: "Профилактика после рокировки",
      goalType: "best_move",
      fen: "r1bq1rk1/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP4/PPP2PPP/R1BQ1RK1 w - - 0 7",
      sideToMove: "w",
      solution: [
        {
          userMove: "h2h3",
          opponentMove: null,
          explanation: "Пешка на h3 не даёт чёрному коню прыгнуть на g4 и угрожать вилкой на f2."
        }
      ],
      prompt: "Твой король уже в укрытии, но враг прощупывает слабые поля рядом. Предотврати угрозу.",
      hints: {
        soft: "Посмотри на самое слабое поле вокруг короля.",
        medium: "Чёрный конь хочет прыгнуть на уязвимое поле рядом с королем и напасть на твои ценные фигуры.",
        strong: "Ход пешкой на h3 отнимет у коня поле g4 и обезопасит королевский фланг."
      },
      successExplanation: "Отлично! Ход h3 не даёт чёрному коню прыгнуть на g4. Если бы конь туда попал, он угрожал бы вилкой на f2 — атакой на ферзя и ладью. Профилактика — лучшая защита.",
      failureExplanation: "Оставив поле g4 без присмотра, ты позволяешь коню противника ворваться на f2 с вилкой.",
      learningPoint: "После рокировки следи за полем f2 — оно остаётся самым слабым. Один профилактический ход пешкой (h3) нейтрализует угрозу коня.",
      tags: ["профилактика", "безопасность_короля", "поле_f2", "одноходовая"],
      metadata: { difficulty: 2, moveCount: 1, multiStep: false, isStatic: true, estimatedTimeSec: 30, engineChecked: false }
    },

    // ── Задача 10 ── Одноходовая | профилактика связки
    {
      id: "day4_task10",
      day: 4,
      topic: "Безопасность короля",
      skill: "Профилактика против связки",
      goalType: "best_move",
      fen: "r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 7",
      sideToMove: "w",
      solution: [
        {
          userMove: "h2h3",
          opponentMove: null,
          explanation: "Пешка на h3 не даёт чёрному слону выйти на g4 и связать коня с ферзём."
        }
      ],
      prompt: "Враг целится в твоего коня, чтобы обездвижить его связкой. Предотврати угрозу.",
      hints: {
        soft: "Посмотри, какая фигура соперника может стать очень активной.",
        medium: "Чёрный слон хочет выйти на активную позицию и обездвижить твоего коня связкой.",
        strong: "Ход пешкой на h3 навсегда закроет слону дорогу на g4."
      },
      successExplanation: "Верно! Ход h3 не даёт чёрному слону выйти на g4 и связать коня с ферзём. Связка сковала бы твои фигуры и ослабила защиту короля.",
      failureExplanation: "Пропустив h3, ты позволяешь слону противника создать неприятную связку. Связанный конь не сможет защищать короля.",
      learningPoint: "Связка коня на f3 — одна из частых угроз после рокировки. Ход h3 заранее снимает эту проблему.",
      tags: ["профилактика", "связка", "безопасность_короля", "одноходовая"],
      metadata: { difficulty: 2, moveCount: 1, multiStep: false, isStatic: true, estimatedTimeSec: 30, engineChecked: false }
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
      prompt: "Король соперника зажат в углу. Нанеси решающий удар тяжелой фигурой.",
      hints: {
        soft: "Сочетание ладьи и коня на краю доски создает смертельную угрозу.",
        medium: "Твой конь защищает ключевое поле прямо рядом с королем соперника.",
        strong: "Объяви мат ладьей в углу доски под защитой своего коня."
      },
      successExplanation: "Ладья ставит мат под защитой коня, который также контролирует поле побега.",
      failureExplanation: "Этот ход упускает победу. Используй совместную силу ладьи и коня.",
      learningPoint: "Арабский мат — это взаимодействие ладьи и коня на краю шахматной доски.",
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
      prompt: "Королевский фланг соперника ослаблен. Найди единственный матующий шах.",
      hints: {
        soft: "Будь внимателен к защитным возможностям соперника после твоего шаха.",
        medium: "Ищи шах, который полностью перекрывает все пути отступления короля.",
        strong: "Объяви шах ферзем на краю доски, используя поддержку своего коня."
      },
      successExplanation: "Ферзь наносит удар при поддержке коня, и у короля нет путей спасения.",
      failureExplanation: "Другие шахи позволяют королю соперника спастись или защититься.",
      learningPoint: "Перед шахом всегда проверяй все пути отступления вражеского короля.",
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
      fen: "7k/1R5p/5K1P/8/8/8/8/8 w - - 0 1",
      sideToMove: "w",
      solution: [
        {
          userMove: "b7b8",
          opponentMove: null,
          explanation: "Идеально! Ход ладьей ставит мат, не оставляя сопернику шанса на спасение."
        }
      ],
      prompt: "Преимущество огромное. Найди путь к победе, избегая коварной ловушки.",
      hints: {
        soft: "Не торопись забирать фигуры соперника.",
        medium: "Взятие ладьи соперника приведет к ничьей. Ищи матующий удар.",
        strong: "Поставь мат ладьей на последней горизонтали, не трогая фигуру черных."
      },
      successExplanation: "Отлично! Ты избежал пата и сразу поставил мат ладьей на краю доски.",
      failureExplanation: "Взятие ладьи лишает соперника ходов. Это пат и обидная ничья.",
      learningPoint: "В выигрышных позициях всегда проверяй, есть ли у соперника легальные ходы.",
      tags: ["day5", "avoid_stalemate", "mate_in_1"],
      metadata: {
        isStatic: true,
        estimatedTimeSec: 35,
        moveCount: 1,
        engineChecked: true
      }
    },
    {
      id: "day5_check_mate_stalemate_p4",
      day: 5,
      topic: "day5_check_mate_stalemate",
      skill: "Мат по последней горизонтали",
      goalType: "mate",
      fen: "7k/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1",
      sideToMove: "w",
      solution: [
        {
          userMove: "d1d8",
          opponentMove: null,
          explanation: "Превосходно! Ладья врывается на последнюю горизонталь, объявляя мат."
        }
      ],
      prompt: "Король соперника заперт собственными пешками. Заверши партию матом.",
      hints: {
        soft: "Обрати внимание на слабость последнего ряда, где стоит король соперника.",
        medium: "Используй тяжелую фигуру, чтобы атаковать всю последнюю горизонталь.",
        strong: "Отправь ладью в самый конец доски на последнюю горизонталь."
      },
      successExplanation: "Ладья ставит мат по последней горизонтали, так как пешки мешают королю.",
      failureExplanation: "Этот ход не создает угроз. Атакуй короля на последней линии.",
      learningPoint: "Следи за безопасностью последней горизонтали и вовремя создавай форточку.",
      tags: ["day5", "mate", "back_rank", "mate_in_1"],
      metadata: {
        isStatic: true,
        estimatedTimeSec: 30,
        moveCount: 1,
        engineChecked: true
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
      prompt: "Король соперника прижат к краю. Пожертвуй ферзя для вскрытия линии.",
      hints: {
        soft: "Иногда для быстрой победы нужно пожертвовать сильнейшую фигуру.",
        medium: "Взятие крайней пешки ферзем откроет линию для атаки ладьи.",
        strong: "Забери ферзем пешку перед королем, а затем атакуй ладьей по линии."
      },
      successExplanation: "Жертва ферзя вскрыла вертикаль, и ладья поставила мат при поддержке коня.",
      failureExplanation: "Пассивные ходы дают сопернику защиту. Ищи форсированную жертву с шахом.",
      learningPoint: "Жертва фигуры помогает разрушить пешечный щит короля и открыть линии.",
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
      prompt: "На левом фланге висит ферзь черных. Выбери прямую атаку на короля.",
      hints: {
        soft: "Не поддавайся искушению забрать ферзя соперника. Ищи быстрый мат.",
        medium: "Начни атаку с шаха ферзем на седьмой горизонтали при поддержке коня.",
        strong: "Атакуй пешку у короля, а после его отхода забери ладью с матом."
      },
      successExplanation: "Ты проигнорировал ферзя и провел быструю матовую атаку на короля.",
      failureExplanation: "Взятие ферзя затягивает партию. Матовая атака всегда в приоритете.",
      learningPoint: "Матовая атака на короля важнее выигрыша любого материала.",
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
      prompt: "Король соперника зажат своими фигурами. Найди красивый финал.",
      hints: {
        soft: "Собственные фигуры мешают вражескому королю спастись от шаха.",
        medium: "Заставь ладью соперника заблокировать короля, пожертвовав ферзя.",
        strong: "Поставь ферзя под удар ладьи в углу, а затем объяви мат конем."
      },
      successExplanation: "Жертва ферзя зажала короля в тиски, и конь поставил эффектный мат.",
      failureExplanation: "Обычные шахи выпускают победу. Запри короля его собственными фигурами.",
      learningPoint: "Спертый мат возникает, когда конь атакует короля, зажатого своими фигурами.",
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
      skill: "Пат как защитный ресурс",
      goalType: "best_move",
      fen: "8/8/8/6p1/5p2/5Ppk/5p2/6RK w - - 0 1",
      sideToMove: "w",
      solution: [
        {
          userMove: "g1g3",
          opponentMove: "h3h4",
          explanation: "Ладья принесена в жертву с шахом, заставляя соперника отступить."
        },
        {
          userMove: "g3h3",
          opponentMove: null,
          explanation: "Вторая жертва ладьи вынуждает пат!"
        }
      ],
      prompt: "Позиция безнадежна. Спаси партию с помощью форсированного пата.",
      hints: {
        soft: "Когда поражение неизбежно, ищи способ спастись на ничью.",
        medium: "Пожертвуй ладью так, чтобы у твоего короля не осталось ходов.",
        strong: "Отдай ладью с шахом сначала на одну клетку, а затем на другую."
      },
      successExplanation: "Отлично! Ты пожертвовал ладью и спас партию с помощью пата.",
      failureExplanation: "Обычная защита ведет к поражению. Форсируй ничью жертвой ладьи.",
      learningPoint: "Пат — это ценный защитный ресурс в безнадежных эндшпилях.",
      tags: ["day5", "best_move", "desperado_rook", "stalemate_in_2"],
      metadata: {
        isStatic: true,
        estimatedTimeSec: 60,
        moveCount: 2,
        engineChecked: true
      }
    }
  ],

  

          day6_fork_double_attack: [
    {
      id: "day6_fork_double_attack_p1",
      day: 6,
      topic: "day6_fork_double_attack",
      skill: "Быстрая вилка",
      goalType: "win_material",
      fen: "r4rk1/pp1b1ppp/2q1p3/3N4/8/3RB3/PP3PPP/5RK1 w - - 0 1",
      sideToMove: "w",
      solution: [
        {
          userMove: "d5e7",
          opponentMove: null,
          explanation: "Превосходно! Конь наносит вилку королю и ферзю, выигрывая сильнейшую фигуру соперника."
        }
      ],
      prompt: "Найди двойной удар конем, чтобы выиграть ценную фигуру.",
      hints: {
        soft: "Обрати внимание на расположение короля и ферзя соперника.\nОни находятся на близком расстоянии.",
        medium: "Твой конь может совершить прыжок с шахом.\nИщи поле, откуда он атакует сразу две цели.",
        strong: "Объяви шах конем с поля рядом с пешками.\nЭто позволит забрать ферзя на следующем ходу."
      },
      successExplanation: "Отлично! Вилка конем позволила выиграть ферзя соперника.",
      failureExplanation: "Не торопись развивать фигуры без угрозы. Ищи прямую двойную атаку.",
      learningPoint: "Вилка конем — один из самых опасных тактических приемов из-за непредсказуемой траектории фигуры.",
      tags: ["day6", "fork", "knight_fork", "one_move"],
      metadata: {
        isStatic: true,
        estimatedTimeSec: 20,
        moveCount: 1,
        engineChecked: false
      }
    },
    {
      id: "day6_fork_double_attack_p2",
      day: 6,
      topic: "day6_fork_double_attack",
      skill: "Двойной удар слоном",
      goalType: "win_material",
      fen: "r5k1/p1q1b1pp/1p3p2/8/8/3PPB2/P1P2PPP/R1Q2RK1 w - - 0 1",
      sideToMove: "w",
      solution: [
        {
          userMove: "f3d5",
          opponentMove: null,
          explanation: "Великолепный двойной удар! Слон наносит двойной удар с шахом, выигрывая незащищенную ладью на a8."
        }
      ],
      prompt: "Создай двойную угрозу слоном и выиграй ладью соперника.",
      hints: {
        soft: "Посмотри на диагональ, ведущую к королю соперника.\nТвой слон может активизироваться.",
        medium: "Найди ход слоном с объявлением шаха.\nЭтот же ход должен атаковать ладью в углу.",
        strong: "Поставь слона на центральное поле по диагонали.\nЭто создаст неотразимый двойной удар."
      },
      successExplanation: "Превосходно! Слон объявил шах и выиграл незащищенную ладью.",
      failureExplanation: "Простой уход из-под давления упускает инициативу. Используй активный шах.",
      learningPoint: "Двойной удар слоном часто использует геометрические слабости в лагере соперника.",
      tags: ["day6", "double_attack", "bishop_attack", "one_move"],
      metadata: {
        isStatic: true,
        estimatedTimeSec: 25,
        moveCount: 1,
        engineChecked: false
      }
    },
    {
      id: "day6_fork_double_attack_p3",
      day: 6,
      topic: "day6_fork_double_attack",
      skill: "Вскрытый шах",
      goalType: "win_material",
      fen: "3r2k1/pp3ppp/3q4/8/8/3B4/PPPR1PPP/3Q2K1 w - - 0 1",
      sideToMove: "w",
      solution: [
        {
          userMove: "d3h7",
          opponentMove: null,
          explanation: "Блестящий вскрытый шах! Король соперника вынужден защищаться от шаха, оставляя своего ферзя под ударом твоей ладьи на d2 (поддерживаемой ферзем на d1)."
        }
      ],
      prompt: "Используй вскрытый шах слоном, чтобы забрать чужого ферзя.",
      hints: {
        soft: "Твоя ладья и слон стоят на одной вертикали с ферзем.\nЭто отличный повод для вскрытого удара.",
        medium: "Ищи ход слоном с шахом королю соперника.\nПосле этого ладья сможет атаковать ферзя.",
        strong: "Забери крайнюю пешку слоном с шахом.\nВражеский ферзь окажется под ударом ладьи."
      },
      successExplanation: "Здорово! Шах слоном отвлек короля, и ладья выиграла ферзя.",
      failureExplanation: "Простой размен ферзей не дает преимущества. Ищи вскрытую атаку с шахом.",
      learningPoint: "Вскрытый шах — мощное оружие, так как соперник обязан защищаться от шаха, игнорируя вторую угрозу.",
      tags: ["day6", "discovered_attack", "discovered_check", "one_move"],
      metadata: {
        isStatic: true,
        estimatedTimeSec: 30,
        moveCount: 1,
        engineChecked: false
      }
    },
    {
      id: "day6_fork_double_attack_p4",
      day: 6,
      topic: "day6_fork_double_attack",
      skill: "Двойная угроза ферзем",
      goalType: "win_material",
      fen: "3r1rk1/pp1p1ppp/8/1n6/8/4P3/PPB2PPP/R2Q1RK1 w - - 0 1",
      sideToMove: "w",
      solution: [
        {
          userMove: "d1d3",
          opponentMove: null,
          explanation: "Отличный ход! Ферзь грозит матом на королевском фланге и одновременно нападает на беззащитного коня на b5."
        }
      ],
      prompt: "Создай двойную угрозу: мат королю и нападение на коня.",
      hints: {
        soft: "Посмотри на фигуру соперника на левом фланге.\nУ нее нет защиты от нападения.",
        medium: "Ищи маневр ферзем на третью горизонталь.\nСоздай одновременно две серьезные проблемы.",
        strong: "Установи ферзя так, чтобы грозил мат на крайнем поле,\nи одновременно атаковал беззащитного коня."
      },
      successExplanation: "Отлично! Ферзь создал угрозу мата и одновременно забрал беззащитную фигуру.",
      failureExplanation: "Взятие пешек дает сопернику время защитить фигуры. Ищи двойную угрозу.",
      learningPoint: "Ферзь — идеальная фигура для двойного удара благодаря своей мобильности.",
      tags: ["day6", "unprotected_piece", "queen_attack", "one_move"],
      metadata: {
        isStatic: true,
        estimatedTimeSec: 30,
        moveCount: 1,
        engineChecked: false
      }
    },
    {
      id: "day6_fork_double_attack_p5",
      day: 6,
      topic: "day6_fork_double_attack",
      skill: "Тактический размен и вилка",
      goalType: "win_material",
      fen: "r4rk1/pp1nq1pp/5p2/8/6B1/8/PP3PPP/3R2K1 w - - 0 1",
      sideToMove: "w",
      solution: [
        {
          userMove: "d1d7",
          opponentMove: "e7d7",
          explanation: "Белые забирают коня на d7, завлекая черного ферзя под удар слона."
        },
        {
          userMove: "g4d7",
          opponentMove: null,
          explanation: "Отлично! Белый слон забирает выигранного ферзя."
        }
      ],
      prompt: "Разменяй защитника в центре и выиграй ферзя противника.",
      hints: {
        soft: "Позиция требует решительных действий в центре.\nСначала избавься от защитника.",
        medium: "Забери коня соперника ладьей.\nПосле этого твой слон сможет нанести двойной удар.",
        strong: "После размена ладей и взятия ферзем\nпросто забери ферзя соперника своим слоном."
      },
      successExplanation: "Блестяще! Ты убрал защитника, а затем слоном забрал выигранного ферзя.",
      failureExplanation: "Попытка сразу напасть не работает из-за защитных фигур соперника. Сначала разменяй их.",
      learningPoint: "Иногда для создания тактического мотива нужно сначала уничтожить защищающую фигуру соперника.",
      tags: ["day6", "combination", "exchange", "bishop_fork", "multi_move"],
      metadata: {
        isStatic: true,
        estimatedTimeSec: 40,
        moveCount: 2,
        engineChecked: false
      }
    },
    {
      id: "day6_fork_double_attack_p6",
      day: 6,
      topic: "day6_fork_double_attack",
      skill: "Заманивание под вилку",
      goalType: "win_material",
      fen: "5rk1/pp1q1ppp/6N1/7Q/8/8/PP3PPP/5RK1 w - - 0 1",
      sideToMove: "w",
      solution: [
        {
          userMove: "h5h7",
          opponentMove: "g8h7",
          explanation: "Белые жертвуют ферзя ради того, чтобы завлечь черного короля под семейную вилку."
        },
        {
          userMove: "g6f8",
          opponentMove: "h7g8",
          explanation: "Конь объявляет шах, одновременно забирая ладью и нацеливаясь на ферзя."
        },
        {
          userMove: "f8d7",
          opponentMove: null,
          explanation: "Здорово! В результате комбинации белые остаются с лишним материалом."
        }
      ],
      prompt: "Пожертвуй фигуру, чтобы завлечь короля под вилку коня.",
      hints: {
        soft: "Иногда для победы нужно отдать самую сильную фигуру.\nИщи форсированный шах.",
        medium: "Пожертвуй ферзя на крайнем поле у короля.\nЭто заманит его под вилку коня.",
        strong: "Забери пешку ферзем с шахом, а затем\nсделай вилку конем с поля рядом с ладьей."
      },
      successExplanation: "Невероятно! Жертва ферзя завлекла короля под сокрушительную вилку коня.",
      failureExplanation: "Взятие ладьи дает черным перехватить инициативу. Ищи форсированное завлечение.",
      learningPoint: "Завлечение соперника под вилку — классический способ превратить равную позицию в выигрышную.",
      tags: ["day6", "fork_preparation", "sacrifice", "knight_fork", "multi_move"],
      metadata: {
        isStatic: true,
        estimatedTimeSec: 50,
        moveCount: 3,
        engineChecked: false
      }
    },
    {
      id: "day6_fork_double_attack_p7",
      day: 6,
      topic: "day6_fork_double_attack",
      skill: "Промежуточный шах (Zwischenzug)",
      goalType: "win_material",
      fen: "r4rk1/ppp2ppp/4p1q1/3n4/8/2N3Q1/PP3PPP/R4RK1 w - - 0 1",
      sideToMove: "w",
      solution: [
        {
          userMove: "c3d5",
          opponentMove: "g6g3",
          explanation: "Белые забирают коня. Черные отвечают взятием ферзя, надеясь на симметричный размен."
        },
        {
          userMove: "d5e7",
          opponentMove: "g8h8",
          explanation: "Вместо взятия ферзя белые делают промежуточный шах, уводя своего коня в безопасность."
        },
        {
          userMove: "h2g3",
          opponentMove: null,
          explanation: "После отступления короля белые забирают ферзя черных, оставаясь с лишней фигурой."
        }
      ],
      prompt: "Разменяй фигуры в центре и найди промежуточный шах конем.",
      hints: {
        soft: "Соперник хочет разменять ферзей.\nИщи способ нарушить его планы.",
        medium: "Сначала забери коня соперника в центре.\nЕсли он заберет ферзя, ответь промежуточным шахом.",
        strong: "После взятия ферзя объяви шах конем на крайнем поле,\nа затем спокойно забери вражеского ферзя."
      },
      successExplanation: "Отлично! Промежуточный шах конем позволил спасти фигуру и выиграть материал.",
      failureExplanation: "Поспешное взятие ферзя ведет к равному размену. Используй промежуточный ход.",
      learningPoint: "Промежуточный ход (Zwischenzug) ломает расчеты соперника, заставляя его реагировать на новую угрозу.",
      tags: ["day6", "discovered_attack", "intermediate_move", "zwischenzug", "multi_move"],
      metadata: {
        isStatic: true,
        estimatedTimeSec: 55,
        moveCount: 3,
        engineChecked: false
      }
    },
    {
      id: "day6_fork_double_attack_p8",
      day: 6,
      topic: "day6_fork_double_attack",
      skill: "Отвлечение и решающая вилка",
      goalType: "win_material",
      fen: "3r2k1/ppq2ppp/8/6N1/2B5/3Q4/PP3PPP/4R1K1 w - - 0 1",
      sideToMove: "w",
      solution: [
        {
          userMove: "d3d8",
          opponentMove: "c7d8",
          explanation: "Потрясающий отвлекающий удар! Белые жертвуют ферзя за ладью, чтобы завлечь черного ферзя на d8."
        },
        {
          userMove: "g5f7",
          opponentMove: "g8f8",
          explanation: "Конь забирает пешку с шахом при поддержке слона, нанося вилку королю и ферзю."
        },
        {
          userMove: "f7d8",
          opponentMove: null,
          explanation: "Отлично! Вражеский ферзь отыгран, и белые остаются с лишней чистой ладьей."
        }
      ],
      prompt: "Отвлеки ферзя соперника жертвой и нанеси двойной удар конем.",
      hints: {
        soft: "Обрати внимание на то, что ладья соперника защищена только ферзем.\nПопробуй отвлечь защитника.",
        medium: "Жертва ферзя на последней горизонтали вынудит черного ферзя встать под удар.\nПосле этого твой конь готов нанести вилку.",
        strong: "Забери ладью ферзем на последней горизонтали, а затем\nобъяви шах конем с поля рядом со слоном."
      },
      successExplanation: "Великолепно! Отвлечение ферзя позволило поставить сокрушительную вилку конем и выиграть ладью.",
      failureExplanation: "Простые размены не дают преимущества. Ищи жертву ферзя для создания вилки.",
      learningPoint: "Комбинация на отвлечение заставляет защищающую фигуру уйти со своего поста, открывая дорогу для тактического удара.",
      tags: ["day6", "decoy", "sacrifice", "knight_fork", "multi_move", "mini_boss"],
      metadata: {
        isStatic: true,
        estimatedTimeSec: 60,
        moveCount: 3,
        engineChecked: false
      }
    }
  ],

  day7_review_mixed: [
    {
      id: "day7_review_mixed_p1",
      day: 7,
      topic: "day7_final_challenge",
      dayKey: "day7_review_mixed",
      skill: "Вскрытое нападение",
      goalType: "win_material",
      fen: "3r2k1/pp3ppp/2q1b3/8/3N4/2P5/PP1Q1PPP/2R3K1 w - - 0 1",
      sideToMove: "w",
      moves: ["d4e6"],
      solution: [
        {
          userMove: "d4e6",
          opponentMove: null,
          explanation: "Превосходно! Взятие слона конем открывает вертикаль c для твоей ладьи, которая нападает на ферзя соперника."
        }
      ],
      prompt: "Найди скрытую слабость позиции и выиграй фигуру соперника.",
      hints: {
        soft: "Один из слонов соперника защищен лишь косвенно.",
        medium: "У тебя есть фигура за конем, которая может атаковать ценные фигуры врага через вскрытие линии.",
        strong: "Забери конем слона на e6, открывая ладье путь к вражескому ферзю."
      },
      successExplanation: "Великолепно! Ты нашел двойную угрозу через вскрытое нападение.",
      failureExplanation: "Простые размены не приносят выгоды. Посмотри на рентген твоей ладьи по вертикали c.",
      learningPoint: "Вскрытое нападение позволяет выиграть темп, создавая неожиданную угрозу от стоящей позади фигуры.",
      tags: ["day7", "mixed", "discovered_attack", "win_material"],
      metadata: {
        isStatic: true,
        estimatedTimeSec: 45,
        moveCount: 1,
        engineChecked: true
      }
    },
    {
      id: "day7_review_mixed_p2",
      day: 7,
      topic: "day7_final_challenge",
      dayKey: "day7_review_mixed",
      skill: "Избавление от связки",
      goalType: "defense",
      fen: "r1bq1rk1/ppp2ppp/3p1n2/4p3/1b1PP3/2N5/PPP2PPP/R1BQK2R w KQ - 0 1",
      sideToMove: "w",
      moves: ["c1d2"],
      solution: [
        {
          userMove: "c1d2",
          opponentMove: null,
          explanation: "Прекрасная защита! Развивая слона на d2, ты убираешь связку с коня, который теперь надежно защищает пешку e4."
        }
      ],
      prompt: "Угроза нависла над пешкой. Ослабь давление соперника.",
      hints: {
        soft: "Одна из твоих фигур связана и не может выполнять защитную роль.",
        medium: "Найди способ избавиться от связки, чтобы восстановить защиту в центре.",
        strong: "Выведи чернопольного слона на d2, освобождая коня от связки."
      },
      successExplanation: "Отлично! Ты успешно защитил центральную пешку, избавившись от связки.",
      failureExplanation: "Попытка защитить пешку ходами вроде f3 ослабляет королевский фланг. Избавься от связки.",
      learningPoint: "Защита от связки позволяет вернуть фигурам их защитную функцию и активность.",
      tags: ["day7", "mixed", "defense", "unpin"],
      metadata: {
        isStatic: true,
        estimatedTimeSec: 45,
        moveCount: 1,
        engineChecked: true
      }
    },
    {
      id: "day7_review_mixed_p3",
      day: 7,
      topic: "day7_final_challenge",
      dayKey: "day7_review_mixed",
      skill: "Выигрыш связанной фигуры",
      goalType: "win_material",
      fen: "r1bqk2r/pp2bppp/2n5/1B6/3P4/2N5/PP3PPP/R1BQR1K1 w kq - 0 1",
      sideToMove: "w",
      moves: ["d4d5"],
      solution: [
        {
          userMove: "d4d5",
          opponentMove: null,
          explanation: "Отличный удар! Пользуясь абсолютной связкой, пешка нападает на коня и выигрывает фигуру."
        }
      ],
      prompt: "Используй связку, чтобы выиграть атакованную фигуру.",
      hints: {
        soft: "Черный конь находится под связкой и не может двигаться.",
        medium: "Используй пешку, чтобы оказать дополнительное давление на связанную фигуру.",
        strong: "Сделай ход пешкой d4 вперед, чтобы напасть на беззащитного коня."
      },
      successExplanation: "Прекрасно! Связанная фигура не может защитить себя, что привело к выигрышу коня.",
      failureExplanation: "Простые развивающие ходы упускают тактический шанс. Используй связку.",
      learningPoint: "Связанная фигура теряет подвижность, поэтому на нее следует нападать дополнительными силами.",
      tags: ["day7", "mixed", "pin", "win_material"],
      metadata: {
        isStatic: true,
        estimatedTimeSec: 45,
        moveCount: 1,
        engineChecked: true
      }
    },
    {
      id: "day7_review_mixed_p4",
      day: 7,
      topic: "day7_final_challenge",
      dayKey: "day7_review_mixed",
      skill: "Спёртый мат в один ход",
      goalType: "checkmate",
      fen: "6rk/ppp2ppp/3p4/6N1/4p3/3P4/PP3PPP/R1BQ1RK1 w - - 0 1",
      sideToMove: "w",
      moves: ["g5f7"],
      solution: [
        {
          userMove: "g5f7",
          opponentMove: null,
          explanation: "Шах и мат! Конь наносит красивейший спёртый мат королю, зажатому собственными фигурами."
        }
      ],
      prompt: "Защитники вражеского короля отвлечены и не могут прийти на помощь. Нанеси решающий удар конём!",
      hints: {
        soft: "Король соперника зажат собственными пешками и ладьей.",
        medium: "Конь может проникнуть в лагерь врага с неотразимым шахом.",
        strong: "Запрыгни конем на f7, объявляя шах королю, которому некуда бежать."
      },
      successExplanation: "Блестяще! Спёртый мат — один из самых редких и красивых финалов в шахматах.",
      failureExplanation: "Не отвлекайся на взятия пешек. Проверь возможность мата конем.",
      learningPoint: "Собственные фигуры могут мешать королю спастись, делая его уязвимым для мата конем.",
      tags: ["day7", "mixed", "smothered_checkmate", "mate_in_1"],
      metadata: {
        isStatic: true,
        estimatedTimeSec: 45,
        moveCount: 1,
        engineChecked: true
      }
    },
    {
      id: "day7_review_mixed_p5",
      day: 7,
      topic: "day7_final_challenge",
      dayKey: "day7_review_mixed",
      skill: "Отвлечение защитника",
      goalType: "checkmate",
      fen: "4Rrk1/ppp2ppp/8/7q/8/2P5/PP1Q1PPP/6K1 w - - 0 1",
      sideToMove: "w",
      moves: ["e8f8", "g8f8", "d2d8"],
      solution: [
        {
          userMove: "e8f8",
          opponentMove: "g8f8",
          explanation: "Потрясающая жертва ладьи! Ты завлекаешь короля соперника на f8, отвлекая его от защиты последней горизонтали."
        },
        {
          userMove: "d2d8",
          opponentMove: null,
          explanation: "Мат! Король отрезан на последней горизонтали, и черным некому защитить поле d8."
        }
      ],
      prompt: "Защита короля ослаблена. Проведи форсированную матовую атаку.",
      hints: {
        soft: "Защитник короля перегружен — он занят сразу двумя важными задачами.",
        medium: "Жертва ладьи заставит короля выйти на уязвимое поле.",
        strong: "Забери ладью соперника на f8 своей ладьей, а затем дай мат ферзем на d8."
      },
      successExplanation: "Блестяще! Жертва ладьи отвлекла защиту черных и позволила объявить мат.",
      failureExplanation: "Не спеши с тихими ходами. Шах на f8 заставляет соперника реагировать форсированно.",
      learningPoint: "Отвлечение защищающих фигур открывает линии для атаки на вражеского короля.",
      tags: ["day7", "mixed", "deflection", "checkmate"],
      metadata: {
        isStatic: true,
        estimatedTimeSec: 60,
        moveCount: 2,
        engineChecked: true
      }
    },
    {
      id: "day7_review_mixed_p6",
      day: 7,
      topic: "day7_final_challenge",
      dayKey: "day7_review_mixed",
      skill: "Анастазиев мат",
      goalType: "checkmate",
      fen: "r4rk1/pp4pp/1q1p4/5N1Q/8/3R4/PP3PPP/2B3K1 w - - 0 1",
      sideToMove: "w",
      moves: ["f5e7", "g8h8", "h5h7", "h8h7", "d3h3"],
      solution: [
        {
          userMove: "f5e7",
          opponentMove: "g8h8",
          explanation: "Отличный шах конем! Король черных вынужден уйти на крайнюю вертикаль."
        },
        {
          userMove: "h5h7",
          opponentMove: "h8h7",
          explanation: "Грандиозная жертва ферзя! Черный король завлекается под смертельную атаку ладьи."
        },
        {
          userMove: "d3h3",
          opponentMove: null,
          explanation: "Мат! Ладья наносит финальный удар по вертикали h при поддержке коня."
        }
      ],
      prompt: "Фигуры соперника перегружены. Начни форсированную атаку.",
      hints: {
        soft: "Первым делом найди самый форсированный шах в позиции.",
        medium: "Жертва ферзя поможет вскрыть вертикаль для твоей ладьи.",
        strong: "Дай шах конем с e7, а затем пожертвуй ферзя на поле h7."
      },
      successExplanation: "Потрясающе! Ты исполнил классический Анастазиев мат с жертвой ферзя.",
      failureExplanation: "Простые маневры позволяют сопернику защититься или поставить мат тебе. Ищи форсированную линию.",
      learningPoint: "Жертва материала — частая плата за разрушение королевского прикрытия и достижение мата.",
      tags: ["day7", "mixed", "mate_in_3", "anastasia_mate", "sacrifice"],
      metadata: {
        isStatic: true,
        estimatedTimeSec: 90,
        moveCount: 3,
        engineChecked: true
      }
    },
    {
      id: "day7_review_mixed_p7",
      day: 7,
      topic: "day7_final_challenge",
      dayKey: "day7_review_mixed",
      skill: "Точность против жадности",
      goalType: "best_move",
      fen: "2r3k1/pp3ppp/3b4/8/6q1/2Q5/PP3PPP/5RK1 w - - 0 1",
      sideToMove: "w",
      moves: ["g2g3", "g4h3", "c3c8", "h3c8"],
      solution: [
        {
          userMove: "g2g3",
          opponentMove: "g4h3",
          explanation: "Точнейший ход! Предотвращая немедленный мат на h2, ты перекрываешь линию атаки вражеского слона."
        },
        {
          userMove: "c3c8",
          opponentMove: null,
          explanation: "Отлично! Теперь матовые угрозы устранены, и ты можешь забрать ладью соперника на c8."
        }
      ],
      prompt: "Кажется, можно выиграть сразу, но точность важнее жадности.",
      hints: {
        soft: "Немедленное взятие ладьи соперника ведет к катастрофе.",
        medium: "Сначала устрани смертельную угрозу мата на королевском фланге.",
        strong: "Сыграй пешкой на g3, чтобы перекрыть дорогу слону, а затем забери ладью."
      },
      successExplanation: "Прекрасно! Безопасность короля важнее жадности. Ты защитился от мата и выиграл ладью.",
      failureExplanation: "Поспешное взятие ладьи на c8 ведет к мгновенному мату на h2. Сначала перекрой атаку.",
      learningPoint: "Профилактика и защита от угроз соперника всегда должны предшествовать активным наступательным действиям.",
      tags: ["day7", "mixed", "king_safety", "prophylaxis"],
      metadata: {
        isStatic: true,
        estimatedTimeSec: 60,
        moveCount: 2,
        engineChecked: true
      }
    },
    {
      id: "day7_review_mixed_p8",
      day: 7,
      topic: "day7_final_challenge",
      dayKey: "day7_review_mixed",
      skill: "Финальный спёртый мат",
      goalType: "checkmate",
      fen: "5r1k/pp4pp/7N/8/2Q5/8/PP3PPP/3R2K1 w - - 0 1",
      sideToMove: "w",
      moves: ["c4g8", "f8g8", "h6f7"],
      solution: [
        {
          userMove: "c4g8",
          opponentMove: "f8g8",
          explanation: "Гениальный отвлекающий ход! Белые жертвуют ферзя, заставляя ладью заблокировать собственного короля."
        },
        {
          userMove: "h6f7",
          opponentMove: null,
          explanation: "Мат! Спёртый мат конем завершает финальный недельный челлендж!"
        }
      ],
      prompt: "Один ход меняет оценку позиции. Найди путь к победе.",
      hints: {
        soft: "Ищи способ завлечь ладью соперника на неудачное поле.",
        medium: "Пожертвуй самого сильного, чтобы заманить ладью на неудобное поле перед королем.",
        strong: "Поставь ферзя под удар ладьи на g8, освобождая поле f7 для коня."
      },
      successExplanation: "Блестяще! Ты нашел классическую матовую комбинацию с отвлечением и спёртым матом.",
      failureExplanation: "Обычные шахи конем или ферзем не форсируют победу. Ищи жертву ферзя.",
      learningPoint: "Жертва фигуры для привлечения или отвлечения сил соперника — ключевой элемент сложной тактики.",
      tags: ["day7", "mixed", "mini_boss", "smothered_mate", "sacrifice", "deflection"],
      metadata: {
        isStatic: true,
        estimatedTimeSec: 90,
        moveCount: 2,
        engineChecked: true
      }
    }
  ]
};

export const getThematicPuzzles = (day: number): ChessPuzzleTask[] => {
  const keys = [
    'day1_board_geometry',
    'day2_piece_value',
    'day3_opening_initiative',
    'day4_king_safety',
    'day5_check_mate_stalemate',
    'day6_fork_double_attack',
    'day7_review_mixed'
  ];
  const key = keys[day - 1] || keys[(day - 1) % 7];
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
    dayKey: p.dayKey,
  }));
};

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
