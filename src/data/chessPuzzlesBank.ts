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
      prompt: "Соперник допустил грубую ошибку. Используй уязвимость в его позиции.",
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
      prompt: "Твой конь оказался под прямой атакой вражеской ладьи. Найди единственное безопасное поле для отступления.",
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
      prompt: "Позиция выглядит заманчиво, но таит скрытые риски. Прими верное решение.",
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
      prompt: "Оборона противника растянута по всей доске. Найди слабое звено.",
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
      prompt: "Попытка немедленного взятия ни к чему не приведет. Найди обходной путь.",
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
      prompt: "Король соперника лишился своего прикрытия. Пользуйся моментом, пока он уязвим.",
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
      fen: "4k3/8/8/3q4/4P3/8/8/4K3 w - - 0 1",
      moves: ["e4d5"],
      prompt: "Пешка стоит 1 очко, а ферзь — целых 9! Найди невероятно выгодное взятие для белых.",
      hints: [
        "Твоя пешка на e4 может побить черную фигуру по диагонали.",
        "Черный ферзь неосторожно встал под бой пешки.",
        "Побей ферзя пешкой: e4-d5."
      ]
    },
    {
      fen: "4k3/8/8/6r1/8/5N2/8/4K3 w - - 0 1",
      moves: ["f3g5"],
      prompt: "Конь стоит 3 очка, а ладья — 5. Выиграй более дорогую фигуру соперника.",
      hints: [
        "Твой конь на f3 присматривается к королевскому флангу.",
        "Черная ладья на g5 осталась без защиты.",
        "Забери ладью конем: f3-g5."
      ]
    },
    {
      fen: "4k3/5r2/8/8/2B5/8/8/4K3 w - - 0 1",
      moves: ["c4f7"],
      prompt: "Слон (3 очка) и ладья (5 очков) — неравные по силе фигуры. Выменяй своего слона на более ценную ладью черных.",
      hints: [
        "Твой слон на c4 целится прямо в ладью f7.",
        "Взятие ладьи принесет белым материальный перевес.",
        "Сыграй слоном c4 на f7."
      ]
    },
    {
      fen: "3n4/8/8/8/8/8/8/3QK2k w - - 0 1",
      moves: ["d1d8"],
      prompt: "Ферзь (9 очков) легко справляется с одинокими фигурами. Забери черного коня (3 очка), пока он не убежал.",
      hints: [
        "Ферзь на d1 может атаковать по всей вертикали 'd'.",
        "Черный конь на d8 никем не защищен.",
        "Сделай ход ферзем с d1 на d8."
      ]
    },
    {
      fen: "q3k3/8/8/8/8/8/8/R3K3 w - - 0 1",
      moves: ["a1a8"],
      prompt: "Черный ферзь (9 очков) грозит твоему королю. Но твоя ладья (5 очков) может сама забрать его. Сделай выгодный размен!",
      hints: [
        "Ладья на a1 видит черного ферзя на противоположном конце доски.",
        "Обменять ладью на ферзя — отличная сделка.",
        "Забери ферзя ладьей: a1-a8."
      ]
    },
    {
      fen: "4k3/8/8/3p4/4p3/2N5/8/4K3 w - - 0 1",
      moves: ["c3d5"],
      prompt: "Твой конь может забрать черную пешку на d5 или на e4. Но будь осторожен: одна из пешек защищена другой! Выбери безопасное взятие.",
      hints: [
        "Помни, что черные пешки ходят сверху вниз и бьют по диагонали.",
        "Пешка d5 защищает пешку e4. Если взять на e4, твоего коня съедят.",
        "Забери незащищенную пешку на d5 ходом c3-d5."
      ]
    },
    {
      fen: "4k3/7b/8/8/8/8/8/4K2R w - - 0 1",
      moves: ["h1h7"],
      prompt: "Ладья (5 очков) сильнее слона (3 очка). Твоя ладья готова забрать слона соперника на противоположном конце доски. Сделай этот ход.",
      hints: [
        "Ладья на h1 может передвигаться вертикально вверх.",
        "Черный слон на h7 беззащитен.",
        "Сыграй ладьей на h7, выигрывая фигуру."
      ]
    },
    {
      fen: "3r2k1/8/8/8/3Q4/8/8/4K3 w - - 0 1",
      moves: ["d4d8"],
      prompt: "Твой ферзь может съесть черную ладью. Ладья защищена только королем, но ферзь настолько силен, что это все равно выгодно! Сделай лучший ход.",
      hints: [
        "Ферзь на d4 видит ладью на d8.",
        "Ферзь стоит 9 очков, а ладья — 5. После размена у белых останется огромный перевес.",
        "Забери ладью ферзем: d4-d8."
      ]
    }
  ],

  day3_opening_principles: [
    {
      id: "chess_puzzle_day3_test_v2",
      fen: "5r1k/5ppp/8/8/8/8/3Q4/3R2K1 w - - 0 1",
      moves: ["d2d8", "f8d8", "d1d8"],
      solution: [
        {
          userMove: "d2d8",
          opponentMove: "f8d8",
          explanation: "Отличная жертва ферзя! Теперь ладья черных вынуждена совершить взятие."
        },
        {
          userMove: "d1d8",
          opponentMove: null,
          explanation: "Шах и мат! Линейный мат успешно поставлен."
        }
      ],
      prompt: "[ТЕСТ V2] Поставь мат в 2 хода (линейный мат на последней горизонтали). Начни с жертвы ферзя на d8!",
      hints: [
        "Первый ход — жертва самой сильной фигуры на d8.",
        "Сделай ход ферзем d2-d8.",
        "После взятия ладьей, нанеси решающий удар ладьей с d1 на d8."
      ],
      successExplanation: "Великолепно! Ты успешно поставил линейный мат, пожертвовав ферзя.",
      failureExplanation: "Неверный ход. Попробуй отыскать идею линейного мата с жертвой ферзя."
    },
    {
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      moves: ["e2e4"],
      prompt: "Принцип дебюта №1: борись за центр! Займи центральное поле e4 своей королевской пешкой.",
      hints: [
        "Ход e2-e4 открывает дорогу твоему слону и ферзю.",
        "Сделай широкий шаг этой пешкой на два поля вперед.",
        "Сыграй e2e4."
      ]
    },
    {
      fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
      moves: ["e7e5"],
      prompt: "Играешь за черных. Белые захватили центр пешкой e4. Ответь им тем же и заяви свои права на центр!",
      hints: [
        "Черная королевская пешка тоже может прыгнуть на две клетки вперед.",
        "Сделай симметричный ход пешкой перед черным королем.",
        "Сыграй e7-e5."
      ]
    },
    {
      fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
      moves: ["g1f3"],
      prompt: "Принцип дебюта №2: развивай легкие фигуры (коней и слонов). Выведи коня на активную позицию, нападая на пешку соперника.",
      hints: [
        "Королевский конь на g1 хочет пойти в бой.",
        "Поле f3 идеально: конь оттуда контролирует центр и атакует пешку e5.",
        "Сыграй конем на f3."
      ]
    },
    {
      fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2",
      moves: ["b8c6"],
      prompt: "Играешь за черных. Твоя пешка e5 под боем белого коня. Развей коня на c6, чтобы одновременно защитить пешку.",
      hints: [
        "Развивай ферзевого коня с b8.",
        "С поля c6 конь будет надежно охранять пешку e5.",
        "Сделай ход конем на c6."
      ]
    },
    {
      fen: "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3",
      moves: ["f1c4"],
      prompt: "Выведи белопольного слона f1 на активную диагональ, целясь в слабое поле f7 около черного короля.",
      hints: [
        "Слон на f1 готов выйти на простор.",
        "Поле c4 — отличная стоянка для слона, откуда он грозит сопернику.",
        "Сделай ход слоном на c4."
      ]
    },
    {
      fen: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3",
      moves: ["g8f6"],
      prompt: "Играешь за черных. Пора развивать королевского коня. Выведи его на f6, чтобы контратаковать белую пешку e4.",
      hints: [
        "Конь на g8 ждет твоего приказа.",
        "Поле f6 — самое естественное и сильное для этого коня.",
        "Сыграй конем на f6."
      ]
    },
    {
      fen: "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",
      moves: ["e1g1"],
      prompt: "Принцип дебюта №3: безопасность короля! Сделай рокировку, чтобы спрятать короля в угол и ввести ладью в игру.",
      hints: [
        "Все фигуры между королем e1 и ладьей h1 уже вышли.",
        "Сделай рокировку в короткую сторону: передвинь короля на два поля вправо.",
        "Сыграй королем с e1 на g1 (рокировка произойдет автоматически)."
      ]
    },
    {
      fen: "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQ1RK1 b kq - 5 4",
      moves: ["f8c5"],
      prompt: "Играешь за черных. Твой слон на f8 пока заперт. Выведи его на активное поле c5, чтобы тоже подготовить рокировку.",
      hints: [
        "Черный слон f8 может пойти по открывшейся диагонали.",
        "Поле c5 зеркально копирует позицию белого слона.",
        "Сделай ход слоном на c5."
      ]
    }
  ],

  day4_castling: [
    {
      fen: "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1",
      moves: ["e1g1"],
      prompt: "Рокировка защищает твоего короля. Сделай короткую рокировку (в сторону королевского фланга) за белых.",
      hints: [
        "Король должен сдвинуться на две клетки вправо.",
        "Перемести короля e1 на g1, ладья сама встанет на f1.",
        "Сделай ход e1g1."
      ]
    },
    {
      fen: "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1",
      moves: ["e1c1"],
      prompt: "А теперь попробуй сделать длинную рокировку (в сторону ферзевого фланга) за белых. Она уводит короля еще дальше.",
      hints: [
        "Король делает два шага влево.",
        "Перемести короля e1 на c1, ладья a1 встанет на d1.",
        "Сделай ход e1c1."
      ]
    },
    {
      fen: "r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1",
      moves: ["e8g8"],
      prompt: "Сделай короткую рокировку за черных, чтобы обезопасить их короля.",
      hints: [
        "Играешь черными. Черный король должен сделать два шага вправо.",
        "Перемести короля e8 на g8.",
        "Сделай ход e8g8."
      ]
    },
    {
      fen: "r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1",
      moves: ["e8c8"],
      prompt: "Сделай длинную рокировку за черных, уводя короля на ферзевый фланг.",
      hints: [
        "Играешь черными. Король должен сместиться на две клетки влево.",
        "Перемести короля e8 на c8.",
        "Сделай ход e8c8."
      ]
    },
    {
      fen: "r3k2r/8/8/8/8/8/8/R3K1NR w Qkq - 0 1",
      moves: ["g1f3"],
      prompt: "Короткая рокировка невозможна, так как конь g1 преграждает путь. Освободи дорогу королю и ладье!",
      hints: [
        "Королю нужен свободный путь на g1.",
        "Сделай развивающий ход конем с g1 на f3.",
        "Сыграй g1-f3."
      ]
    },
    {
      fen: "r3k2r/8/8/8/8/8/8/RN2K2R w Kkq - 0 1",
      moves: ["b1c3"],
      prompt: "Длинная рокировка заблокирована конем на b1. Развей коня в центр доски, освобождая путь для рокировки.",
      hints: [
        "Конь мешает королю пройти на c1.",
        "Выведи коня b1 на активное поле c3.",
        "Сыграй b1-c3."
      ]
    },
    {
      fen: "r3k2r/8/8/8/8/8/4r3/R3K2R w KQkq - 0 1",
      moves: ["e1f1"],
      prompt: "Твой король находится под шахом черной ладьи e2. Запомни: рокироваться из-под шаха строго запрещено! Уйди королем в безопасное место.",
      hints: [
        "Король должен просто отступить, так как рокировка заблокирована шахом.",
        "Поле f1 — безопасная клетка для короля.",
        "Сделай ход e1-f1."
      ]
    },
    {
      fen: "r3k2r/8/8/8/b7/8/8/R3K2R w KQkq - 0 1",
      moves: ["e1g1"],
      prompt: "Черный слон на a4 простреливает поле d1. Рокироваться через битое поле нельзя! Выбери безопасную короткую рокировку.",
      hints: [
        "При длинной рокировке король должен пересечь поле d1, которое атакует слон.",
        "Короткая рокировка полностью безопасна, так как поля f1 и g1 никто не атакует.",
        "Сделай короткую рокировку: e1-g1."
      ]
    }
  ],

  day5_check_mate_stalemate: [
    {
      fen: "4r1k1/8/8/8/8/8/8/4K1B1 w - - 0 1",
      moves: ["g1e3"],
      prompt: "Твоему королю объявили шах ладьей по линии 'e'. Закрой короля от шаха своим слоном g1.",
      hints: [
        "Не обязательно ходить королем. Можно поставить фигуру на пути ладьи.",
        "Слон на g1 может встать на поле e3 и заблокировать шах.",
        "Сделай ход g1-e3."
      ]
    },
    {
      fen: "4r1k1/8/8/8/8/8/8/4K3 w - - 0 1",
      moves: ["e1f1"],
      prompt: "Король под шахом ладьи, а защитников нет. Уведи короля в безопасное место на королевском фланге.",
      hints: [
        "Король должен сделать шаг в сторону от линии 'e'.",
        "Поле f1 — безопасный приют для короля.",
        "Сыграй e1-f1."
      ]
    },
    {
      fen: "7k/5Q2/6K1/8/8/8/8/8 w - - 0 1",
      moves: ["f7f8"],
      prompt: "Поставь мат в один ход! Черный король заперт в углу, ферзю нужно лишь нанести решающий удар на последней горизонтали.",
      hints: [
        "Ферзь должен напасть на короля так, чтобы у того не было спасительных ходов.",
        "Перемести ферзя на самую верхнюю линию — поле f8.",
        "Сыграй f7-f8."
      ]
    },
    {
      fen: "6k1/6pp/8/8/8/8/8/5RK1 w - - 0 1",
      moves: ["f1f8"],
      prompt: "Потренируйся объявлять шах. Отправь свою ладью на последнюю горизонталь.",
      hints: [
        "Ладья на f1 может пойти прямо вверх.",
        "Напади на черного короля на поле f8.",
        "Сыграй f1-f8."
      ]
    },
    {
      fen: "7k/8/5K2/8/8/8/8/6Q1 w - - 0 1",
      moves: ["g1g7"],
      prompt: "Король и ферзь вместе — грозное оружие. Поставь мат в один ход, подведя ферзя вплотную к черному королю под защиту твоего короля.",
      hints: [
        "Белый король на f6 контролирует поле g7.",
        "Ферзь может безопасно встать на g7, объявляя мат.",
        "Сыграй g1-g7."
      ]
    },
    {
      fen: "7k/8/5K2/8/8/8/8/6Q1 w - - 0 1",
      moves: ["g1g6"],
      prompt: "Будь осторожен с патом! Сделай ход g1-g6 и посмотри, как черному королю некуда ходить, хотя шаха нет. Это ничья (пат).",
      hints: [
        "При пате у слабейшей стороны нет ни одного легального хода, и король не атакован.",
        "Ход g1-g6 полностью запирает короля черных без шаха.",
        "Сыграй g1-g6, чтобы зафиксировать пат."
      ]
    },
    {
      fen: "7k/8/6K1/8/8/8/8/5Q2 w - - 0 1",
      moves: ["f1f8"],
      prompt: "Исправь ошибку из предыдущей задачи! Поставь чистый мат черному королю на f8, не допуская пата.",
      hints: [
        "Ферзь на f1 должен атаковать по вертикали 'f'.",
        "Ход на f8 объявляет шах и мат одновременно.",
        "Сыграй f1-f8."
      ]
    },
    {
      fen: "7k/8/6K1/8/8/8/8/5Q2 w - - 0 1",
      moves: ["f1f7"],
      prompt: "Еще одна типичная ошибка новичка — сыграть f1-f7. Сделай этот ход, чтобы увидеть, как игра снова завершается патом.",
      hints: [
        "Черный король не находится под шахом, но все клетки вокруг него перекрыты.",
        "Ход f1-f7 не оставляет черным ходов.",
        "Сделай патовый ход f1-f7."
      ]
    }
  ],

  day6_fork_double_attack: [
    {
      fen: "3q3k/8/8/6N1/8/8/8/4K3 w - - 0 1",
      moves: ["g5f7"],
      prompt: "Вилка конем — один из самых коварных приемов! Объяви шах черному королю и одновременно напади на черного ферзя.",
      hints: [
        "Ищи поле для коня, откуда он дотянется и до короля h8, и до ферзя d8.",
        "Поле f7 идеально подходит для прыжка.",
        "Сделай ход конем: g5-f7."
      ]
    },
    {
      fen: "r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1",
      moves: ["b5c7"],
      prompt: "Снова вилка конем! На этот раз найди прыжок, который атакует черного короля и ладью на угловом поле a8.",
      hints: [
        "Конь на b5 может пойти на поле c7.",
        "Оттуда он объявит шах королю e8 и нападет на ладью a8.",
        "Сыграй конем на c7."
      ]
    },
    {
      fen: "4k3/8/8/1r3q2/8/5N2/8/4K3 w - - 0 1",
      moves: ["f3d4"],
      prompt: "Конь может атаковать две тяжелые фигуры даже без шаха. Найди двойной удар на черного ферзя и ладью.",
      hints: [
        "Ищи центральное поле, с которого конь дотянется до f5 и b5.",
        "Поле d4 находится как раз на нужном расстоянии от обеих фигур.",
        "Перемести коня на d4."
      ]
    },
    {
      fen: "4k3/2q1r3/3b4/4P3/8/8/8/K7 w - - 0 1",
      moves: ["e5d6"],
      prompt: "Даже скромная пешка может сделать вилку! Забери черного слона и одновременно атакуй ферзя c7 и ладью e7.",
      hints: [
        "Твоя пешка на e5 может совершить взятие по диагонали.",
        "Побей слона на d6. После этого пешка раздвоит атаку на ферзя и ладью.",
        "Забери слона пешкой: e5-d6."
      ]
    },
    {
      fen: "r5k1/8/8/8/8/8/8/3QK3 w - - 0 1",
      moves: ["d1d5"],
      prompt: "Ферзь превосходно делает двойные удары по диагонали и прямой. Объяви шах королю и выиграй ладью на a8.",
      hints: [
        "Ферзь на d1 должен встать на большую диагональ.",
        "Ход на d5 дает шах королю g8 и одновременно нападает на ладью a8.",
        "Сыграй ферзем на d5."
      ]
    },
    {
      fen: "8/b6k/8/8/8/8/8/3R1K2 w - - 0 1",
      moves: ["d1d7"],
      prompt: "Ладья тоже умеет наносить двойные удары! Объяви шах черному королю по горизонтали и выиграй беззащитного слона на a7.",
      hints: [
        "Перемести ладью на 7-ю горизонталь, где стоят обе черные фигуры.",
        "Поле d7 позволяет атаковать короля на h7 и слона на a7.",
        "Сыграй ладьей на d7."
      ]
    },
    {
      fen: "4k3/8/8/8/5q2/8/1r6/2N1K3 w - - 0 1",
      moves: ["c1d3"],
      prompt: "Твой конь на c1 зажат, но у него есть спасительный двойной удар. Напади на черного ферзя и ладью одновременно.",
      hints: [
        "Конь должен выпрыгнуть в центр.",
        "Поле d3 находится под боем коня c1 и связывает фигуры f4 и b2.",
        "Сыграй конем на d3."
      ]
    },
    {
      fen: "r3k3/8/8/8/8/8/6B1/4K3 w - - 0 1",
      moves: ["g2c6"],
      prompt: "Слон атакует по диагоналям в разные стороны. Сделай вилку: объяви шах королю e8 и атакуй ладью a8.",
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
      prompt: "Повторение: черная ферзь связана твоей ладьей и не может уйти из-под боя. Просто забери ее!",
      hints: [
        "Черный ферзь не может отступить, так как за ним стоит король.",
        "Ладья на e1 может бесплатно забрать ферзя на e7.",
        "Сделай взятие: e1-e7."
      ]
    },
    {
      fen: "7k/5Q2/6K1/8/8/8/8/8 w - - 0 1",
      moves: ["f7f8"],
      prompt: "Повторение: найди быструю победу! Поставь мат черному королю в один ход с помощью ферзя.",
      hints: [
        "Черный король полностью зажат на краю доски.",
        "Сделай ход ферзем на последнюю горизонталь — поле f8.",
        "Сыграй f7-f8."
      ]
    },
    {
      fen: "3q3k/8/8/6N1/8/8/8/4K3 w - - 0 1",
      moves: ["g5f7"],
      prompt: "Повторение: найди знаменитую вилку конем, чтобы забрать сильнейшую фигуру соперника.",
      hints: [
        "Конь на g5 может прыгнуть с шахом.",
        "Поле f7 позволяет атаковать короля и ферзя одновременно.",
        "Сыграй конем на f7."
      ]
    },
    {
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      moves: ["e2e4"],
      prompt: "Повторение дебюта: сделай лучший первый ход по первому принципу дебюта.",
      hints: [
        "Захвати центр пешкой и открой дорогу легким фигурам.",
        "Сыграй пешкой перед королем на две клетки вперед.",
        "Сделай ход e2-e4."
      ]
    },
    {
      fen: "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",
      moves: ["e1g1"],
      prompt: "Повторение: твой король все еще в центре. Обезопась его с помощью короткой рокировки.",
      hints: [
        "Король и ладья готовы поменяться местами.",
        "Перемести короля e1 на g1.",
        "Сыграй e1g1."
      ]
    },
    {
      fen: "4r1k1/8/8/8/8/8/8/4K1B1 w - - 0 1",
      moves: ["g1e3"],
      prompt: "Повторение: защити своего короля от шаха черной ладьи с помощью блокировки.",
      hints: [
        "Не уводи короля, а закрой его другой фигурой.",
        "Слон на g1 может перекрыть линию атаки на поле e3.",
        "Сыграй слоном на e3."
      ]
    },
    {
      fen: "4k3/8/8/3q4/4P3/8/8/4K3 w - - 0 1",
      moves: ["e4d5"],
      prompt: "Повторение ценности фигур: пешка (1 очко) может забрать ферзя (9 очков). Выиграй партию материально.",
      hints: [
        "Твоя пешка стоит на e4, а ферзь — на d5.",
        "Сделай выгодное диагональное взятие.",
        "Побей ферзя пешкой: e4-d5."
      ]
    },
    {
      fen: "r5k1/8/8/8/8/8/8/3QK3 w - - 0 1",
      moves: ["d1d5"],
      prompt: "Повторение: используй ферзя для мощной вилки на короля g8 и ладью a8.",
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
    'day3_opening_principles',
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
