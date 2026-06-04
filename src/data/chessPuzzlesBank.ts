import { Chess } from 'chess.js';

export interface ChessPuzzleMove {
  userMove: string;
  opponentMove?: string | null;
  explanation?: string;
}

export interface ChessPuzzle {
  fen: string;
  moves?: string[];
  prompt: string;
  hints?: string[];
  // V2 fields (optional for gradual migration)
  solution?: ChessPuzzleMove[];
  successExplanation?: string;
  failureExplanation?: string;
  learningPoint?: string;
  id?: string;
  day?: number;
  topic?: string;
  skill?: string;
  goalType?:
    | 'best_move'
    | 'mate'
    | 'win_material'
    | 'save_piece'
    | 'castle_safety'
    | 'avoid_stalemate'
    | 'opening_principle'
    | 'tactical_sequence';
  sideToMove?: 'white' | 'black';
  tags?: string[];
  metadata?: {
    isStatic?: boolean;
    estimatedTimeSec?: number;
    moveCount?: number;
    engineChecked?: boolean;
  };
  engine?: {
    checked?: boolean;
    bestMove?: string;
    secondBestMove?: string;
    evalCp?: number;
    mateIn?: number;
  };
}

export interface ChessPuzzleTask {
  id: string;
  fen: string;
  puzzleMoves: string[];
  rating: number;
  themes: string[];
  prompt: string;
  hints: string[];
  // V2 fields
  solution?: ChessPuzzleMove[];
  successExplanation?: string;
  failureExplanation?: string;
  learningPoint?: string;
  goalType?: ChessPuzzle['goalType'];
  tags?: string[];
  metadata?: ChessPuzzle['metadata'];
}

export const chessLessonPuzzles: Record<string, ChessPuzzle[]> = {
  day1_piece_movement: [
    {
      fen: "4k3/8/8/8/8/8/8/4K3 w - - 0 1",
      moves: ["e1e2"],
      prompt: "Король — самая важная фигура, но ходит медленно, всего на одну клетку в любую сторону. Сделай шаг королем вперед.",
      hints: [
        "Король может переместиться на любую соседнюю клетку.",
        "Посмотри на клетку прямо перед белым королем.",
        "Сделай ход с e1 на e2."
      ]
    },
    {
      fen: "4k3/r7/8/8/8/8/8/R3K3 w - - 0 1",
      moves: ["a1a7"],
      prompt: "Ладья передвигается по прямой — по горизонтали и вертикали. Черная ладья подставилась под удар. Забери ее!",
      hints: [
        "Ладья на a1 может пойти вверх по всей вертикали 'a'.",
        "Найди черную фигуру на этой вертикали.",
        "Сыграй ладьей с a1 на a7, чтобы совершить взятие."
      ]
    },
    {
      fen: "4k3/8/8/6n1/8/8/8/2B1K3 w - - 0 1",
      moves: ["c1g5"],
      prompt: "Слон ходит только по диагоналям своего цвета. Твой слон — белопольный. Найди и забери незащищенного черного коня.",
      hints: [
        "Посмотри, какая черная фигура стоит на одной диагонали со слоном c1.",
        "Диагональ тянется от c1 до самого королевского фланга.",
        "Сделай ход слоном с c1 на g5."
      ]
    },
    {
      fen: "4k3/8/8/7p/8/8/8/3QK3 w - - 0 1",
      moves: ["d1h5"],
      prompt: "Ферзь — самая мощная фигура. Он сочетает силу ладьи и слона. Забери черную пешку на краю доски.",
      hints: [
        "Ферзь на d1 может пойти по диагонали вправо и вверх.",
        "В конце этой диагонали стоит одинокая черная пешка.",
        "Сделай ход ферзем с d1 на h5."
      ]
    },
    {
      fen: "4k3/8/8/8/8/8/8/4K1N1 w - - 0 1",
      moves: ["g1f3"],
      prompt: "Конь передвигается необычно — буквой «Г» (две клетки в одну сторону и одна в бок). Сделай развивающий ход конем в центр.",
      hints: [
        "Из угла конь на g1 может прыгнуть на f3 или h3.",
        "Ход ближе к центру (на f3) считается более активным.",
        "Прыгни конем на f3."
      ]
    },
    {
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      moves: ["e2e4"],
      prompt: "Пешка ходит только вперед. Но со стартовой позиции она может прыгнуть сразу на две клетки. Захвати центр королевской пешкой!",
      hints: [
        "Ход e2-e4 открывает дорогу твоему слону и ферзю.",
        "Сделай широкий шаг этой пешкой на два поля вперед.",
        "Сыграй e2-e4."
      ]
    },
    {
      fen: "4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1",
      moves: ["e4d5"],
      prompt: "Пешка ходит прямо, но бьет по диагонали на одну клетку. Забери черную пешку, которая преграждает путь.",
      hints: [
        "Твоя пешка стоит на e4, а черная на d5.",
        "Диагональный шаг вправо-вверх позволяет совершить взятие.",
        "Побей пешку: e4-d5."
      ]
    },
    {
      fen: "4k3/8/8/8/8/8/3p4/1N2K3 w - - 0 1",
      moves: ["b1d2"],
      prompt: "Конь — единственная фигура, которая умеет перепрыгивать через другие. Черная пешка объявила шах королю. Забери ее конем!",
      hints: [
        "Твой король в опасности из-за пешки на d2.",
        "Конь на b1 может перепрыгнуть на d2 и спасти короля.",
        "Забери пешку ходом коня: b1-d2."
      ]
    }
  ],

  day2_piece_value: [
    {
      fen: "4k3/8/8/3n4/8/8/8/3QK3 w - - 0 1",
      moves: ["d1d5"],
      prompt: "Your opponent left a piece unguarded in the center. Spot the free material and take it.",
      hints: [
        "Look at the black pieces — one of them has no defenders.",
        "The black knight in the center is completely unprotected.",
        "Your queen can capture the undefended knight with a single move."
      ],
      solution: [{ userMove: 'd1d5', opponentMove: null, explanation: 'The knight was undefended. You won 3 points of material.' }],
      successExplanation: 'You spotted the hanging piece. Free material is the easiest way to win.',
      failureExplanation: 'That doesn\'t win material. Look for pieces that have no defenders.',
      learningPoint: 'Always scan for undefended opponent pieces before committing to a plan.',
      goalType: 'win_material',
      sideToMove: 'white',
      tags: ['hanging-piece', 'one-move'],
      metadata: { isStatic: true, estimatedTimeSec: 15, moveCount: 1 }
    },
    {
      fen: "r3k3/8/8/8/8/5B2/8/4K3 w - - 0 1",
      moves: ["f3a8"],
      prompt: "Your opponent forgot about the rook in the corner. Your bishop can claim it at no cost.",
      hints: [
        "Your bishop controls the long diagonal from f3 to a8.",
        "The rook in the corner has zero defenders nearby.",
        "Take the rook — it's worth 5 points to your bishop's 3."
      ],
      solution: [{ userMove: 'f3a8', opponentMove: null, explanation: 'You traded bishop for rook — a 2-point profit.' }],
      successExplanation: 'You traded up. Minor piece for a rook is always a good deal.',
      failureExplanation: 'You didn\'t capture the rook. Look along the long diagonal.',
      learningPoint: 'Trading a minor piece for a rook is a profitable exchange.',
      goalType: 'win_material',
      sideToMove: 'white',
      tags: ['trade-up', 'one-move'],
      metadata: { isStatic: true, estimatedTimeSec: 15, moveCount: 1 }
    },
    {
      fen: "4k3/8/3b4/8/8/8/8/3R1K2 w - - 0 1",
      moves: ["d1d6"],
      prompt: "A lone bishop wandered into your rook's line of fire. Don't let it escape.",
      hints: [
        "Look at the d-file — the bishop is on it.",
        "Nothing blocks your rook from reaching the bishop.",
        "Your rook can slide up the d-file and capture it."
      ],
      solution: [{ userMove: 'd1d6', opponentMove: null, explanation: 'The bishop was undefended. Your rook takes it for free.' }],
      successExplanation: 'Clean capture. The bishop had no way to defend itself.',
      failureExplanation: 'The bishop is still there. Move your rook up the d-file.',
      learningPoint: 'Rooks control entire files — use them to attack undefended pieces.',
      goalType: 'win_material',
      sideToMove: 'white',
      tags: ['hanging-piece', 'one-move'],
      metadata: { isStatic: true, estimatedTimeSec: 15, moveCount: 1 }
    },
    {
      fen: "4k3/5q2/8/4N3/8/8/8/4K3 w - - 0 1",
      moves: ["e5f7"],
      prompt: "Your opponent's queen drifted too close. A knight can punish such carelessness.",
      hints: [
        "Knights attack in an L-shape. The queen is within range.",
        "From e5, your knight can reach f7 in one jump.",
        "Capture the queen with your knight."
      ],
      solution: [{ userMove: 'e5f7', opponentMove: null, explanation: 'Knight captures queen — a 9-point swing in your favor!' }],
      successExplanation: 'A knight for a queen is a massive win. Well spotted!',
      failureExplanation: 'The queen is still there. Check which squares your knight can reach.',
      learningPoint: 'Knights are dangerous in the center — they can suddenly attack high-value pieces.',
      goalType: 'win_material',
      sideToMove: 'white',
      tags: ['knight-fork', 'one-move'],
      metadata: { isStatic: true, estimatedTimeSec: 20, moveCount: 1 }
    },
    {
      fen: "r3k3/8/8/8/8/8/2R5/4K3 w - - 0 1",
      moves: ["c2c8", "e8e7", "c8a8"],
      prompt: "The black rook is undefended in the corner. Use a check to drive the king away, then take it.",
      hints: [
        "Your rook can reach the 8th rank in one move.",
        "A check forces the king to move and abandons the rook.",
        "Deliver a rook check on c8, then capture the hanging rook."
      ],
      solution: [
        { userMove: 'c2c8', opponentMove: 'e8e7', explanation: 'Check! The king must move.' },
        { userMove: 'c8a8', opponentMove: null, explanation: 'With the king gone, the rook falls.' }
      ],
      successExplanation: 'You used a check to create a free capture. Beautiful!',
      failureExplanation: 'You didn\'t win the rook. Try checking the king first.',
      learningPoint: 'A check can buy time to capture an undefended piece.',
      goalType: 'win_material',
      sideToMove: 'white',
      tags: ['check-and-capture', 'multi-move'],
      metadata: { isStatic: true, estimatedTimeSec: 30, moveCount: 2 }
    },
    {
      fen: "r3k3/8/8/8/8/3B4/8/R3K3 w - - 0 1",
      moves: ["d3b5", "e8d7", "a1a8"],
      prompt: "Your bishop is blocking your rook's attack. Move the bishop to reveal the line and win material.",
      hints: [
        "The a-file is blocked by your own bishop.",
        "Move the bishop to a safe square that uncovers the rook.",
        "Your bishop can go to b5, then the rook attacks the rook."
      ],
      solution: [
        { userMove: 'd3b5', opponentMove: 'e8d7', explanation: 'The bishop moves, revealing the rook\'s line to a8.' },
        { userMove: 'a1a8', opponentMove: null, explanation: 'The black rook is undefended. Take it!' }
      ],
      successExplanation: 'You cleared the line and the rook was helpless. Discovered attacks are powerful.',
      failureExplanation: 'The rook is still there. Move something off the a-file first.',
      learningPoint: 'Moving a piece can reveal a hidden attack from the piece behind it.',
      goalType: 'win_material',
      sideToMove: 'white',
      tags: ['discovered-attack', 'multi-move'],
      metadata: { isStatic: true, estimatedTimeSec: 35, moveCount: 2 }
    },
    {
      fen: "r3k3/5q2/8/8/8/8/5Q2/R3K3 w - - 0 1",
      moves: ["f2f7", "e8f7", "a1a8"],
      prompt: "Trading queens can leave the opponent's pieces undefended. Calculate the sequence.",
      hints: [
        "Your queen can capture the black queen, but the king will recapture.",
        "After the queen trade, notice what happens to the rook on a8.",
        "Capture the queen first, then take the hanging rook."
      ],
      solution: [
        { userMove: 'f2f7', opponentMove: 'e8f7', explanation: 'Queens are traded. The king recaptures.' },
        { userMove: 'a1a8', opponentMove: null, explanation: 'The rook lost its defender. Take it!' }
      ],
      successExplanation: 'You won a rook through a queen trade. Material advantage secured!',
      failureExplanation: 'You didn\'t win material. Try trading queens first.',
      learningPoint: 'Sometimes you must give up your queen to win more material overall.',
      goalType: 'win_material',
      sideToMove: 'white',
      tags: ['queen-trade', 'multi-move'],
      metadata: { isStatic: true, estimatedTimeSec: 40, moveCount: 2 }
    },
    {
      fen: "r3k3/8/8/8/8/8/8/R3K3 w - - 0 1",
      moves: ["a1a8"],
      prompt: "The black rook is on the same file as yours. Whoever moves first wins the trade — and it's your turn.",
      hints: [
        "Both rooks see each other on the a-file.",
        "The black rook is undefended — your king can't reach it but your rook can.",
        "Simply capture the rook."
      ],
      solution: [{ userMove: 'a1a8', opponentMove: null, explanation: 'Your rook takes black\'s rook for free.' }],
      successExplanation: 'You saw the hanging rook on the same file. Simple and effective.',
      failureExplanation: 'The rook is still there. Move your rook to a8.',
      learningPoint: 'Opponent rooks on open files can become easy targets if undefended.',
      goalType: 'win_material',
      sideToMove: 'white',
      tags: ['hanging-piece', 'one-move'],
      metadata: { isStatic: true, estimatedTimeSec: 10, moveCount: 1 }
    }
  ],

  day3_opening_principles: [
    {
      fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
      moves: ["g1f3"],
      prompt: "You opened with e4. Now bring out a piece that attacks the center and threatens the enemy pawn.",
      hints: [
        "Knights before bishops is a solid opening rule.",
        "The e5 pawn is undefended — a knight can attack it.",
        "Develop your king's knight to f3."
      ],
      solution: [{ userMove: 'g1f3', opponentMove: null, explanation: 'Knight to f3 develops and attacks the e5 pawn.' }],
      successExplanation: 'You developed with a threat. That\'s how openings should be played.',
      failureExplanation: 'That doesn\'t develop a piece or create a threat. Bring a knight out.',
      learningPoint: 'In the opening, develop a new piece each move while creating threats.',
      goalType: 'opening_principle',
      sideToMove: 'white',
      tags: ['development', 'center'],
      metadata: { isStatic: true, estimatedTimeSec: 15, moveCount: 1 }
    },
    {
      fen: "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3",
      moves: ["f1c4"],
      prompt: "Your knight is developed. Now bring out a bishop to an active diagonal that eyes the opponent's weakest square.",
      hints: [
        "Bishops are powerful on long diagonals.",
        "The f7 square near the black king is a common target.",
        "Deploy your bishop to c4."
      ],
      solution: [{ userMove: 'f1c4', opponentMove: null, explanation: 'Bishop to c4 aims at f7 — the weakest square near the black king.' }],
      successExplanation: 'Your bishop is active and targets a weakness. Great development.',
      failureExplanation: 'Develop your bishop to a square where it controls the center.',
      learningPoint: 'Develop bishops to diagonals that target opponent weaknesses.',
      goalType: 'opening_principle',
      sideToMove: 'white',
      tags: ['development', 'bishop'],
      metadata: { isStatic: true, estimatedTimeSec: 15, moveCount: 1 }
    },
    {
      fen: "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",
      moves: ["e1g1"],
      prompt: "Your minor pieces are developed. Before launching an attack, take care of your king's safety.",
      hints: [
        "The king is still in the center where it can be attacked.",
        "Castling moves the king to safety and activates a rook.",
        "Castle kingside."
      ],
      solution: [{ userMove: 'e1g1', opponentMove: null, explanation: 'Castling secures the king and brings the rook into play.' }],
      successExplanation: 'King safe, rook active. Always castle before attacking.',
      failureExplanation: 'Your king is exposed. Castle to safety.',
      learningPoint: 'Castle early to protect your king and connect your rooks.',
      goalType: 'castle_safety',
      sideToMove: 'white',
      tags: ['castling', 'king-safety'],
      metadata: { isStatic: true, estimatedTimeSec: 15, moveCount: 1 }
    },
    {
      fen: "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQK2R b KQkq - 0 1",
      moves: ["e8g8"],
      prompt: "The center is stable and most pieces are out. Now match your opponent's king safety.",
      hints: [
        "Your king is still in the center while white has already castled.",
        "Don't fall behind in safety.",
        "Castle kingside to even the score."
      ],
      solution: [{ userMove: 'e8g8', opponentMove: null, explanation: 'Black castles, evening the safety score.' }],
      successExplanation: 'You caught up on king safety. Now the game is balanced.',
      failureExplanation: 'Your king is exposed while white\'s is safe. Castle!',
      learningPoint: 'If your opponent castles, you should castle soon after.',
      goalType: 'castle_safety',
      sideToMove: 'black',
      tags: ['castling', 'king-safety'],
      metadata: { isStatic: true, estimatedTimeSec: 15, moveCount: 1 }
    },
    {
      fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
      moves: ["g1f3", "b8c6", "f1c4"],
      prompt: "Build a strong opening by developing two pieces with purpose. First a knight, then a bishop.",
      hints: [
        "Start by developing a knight to attack the center.",
        "After black responds, bring a bishop to an active diagonal.",
        "First Nf3, then follow up with Bc4."
      ],
      solution: [
        { userMove: 'g1f3', opponentMove: 'b8c6', explanation: 'Knight develops and attacks the e5 pawn.' },
        { userMove: 'f1c4', opponentMove: null, explanation: 'Bishop develops to target f7. Two pieces developed!' }
      ],
      successExplanation: 'You developed two pieces while maintaining pressure. Perfect opening play.',
      failureExplanation: 'Focus on developing your knights and bishops to active squares.',
      learningPoint: 'In the first four moves, develop knights and bishops to active squares.',
      goalType: 'opening_principle',
      sideToMove: 'white',
      tags: ['development', 'multi-move'],
      metadata: { isStatic: true, estimatedTimeSec: 25, moveCount: 2 }
    },
    {
      fen: "rnb1kbnr/pppp1ppp/8/4p3/4P2q/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1",
      moves: ["b1c3", "h4h5", "f1c4"],
      prompt: "Your opponent brought the queen out early. Punish this by developing a piece that defends your pawn and threatens to trap the queen.",
      hints: [
        "The black queen is eyeing your e4 pawn.",
        "Develop a knight to defend e4 and prepare to chase the queen.",
        "First Nc3 defends e4, then use your bishop to continue development."
      ],
      solution: [
        { userMove: 'b1c3', opponentMove: 'h4h5', explanation: 'You develop and defend e4. The queen\'s threat is neutralized.' },
        { userMove: 'f1c4', opponentMove: null, explanation: 'Continue developing your bishop to an active square.' }
      ],
      successExplanation: 'You punished the early queen by developing with purpose. She wasted time while you improved your position.',
      failureExplanation: 'An early queen can be punished by out-developing the opponent.',
      learningPoint: 'When the opponent brings out their queen early, develop your pieces with tempo.',
      goalType: 'opening_principle',
      sideToMove: 'white',
      tags: ['punish-queen', 'multi-move'],
      metadata: { isStatic: true, estimatedTimeSec: 30, moveCount: 2 }
    },
    {
      fen: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3",
      moves: ["g8f6", "d2d3", "f8c5"],
      prompt: "Your opponent has two pieces developed. Catch up by bringing out your knight with an attack on the center.",
      hints: [
        "Develop your knight to a square that attacks the center.",
        "After white responds, develop your bishop to an active diagonal.",
        "First Nf6, then bring the bishop to c5."
      ],
      solution: [
        { userMove: 'g8f6', opponentMove: 'd2d3', explanation: 'Knight develops and attacks the e4 pawn.' },
        { userMove: 'f8c5', opponentMove: null, explanation: 'Bishop develops to the most natural square.' }
      ],
      successExplanation: 'You caught up in development and both pieces are active. Well played.',
      failureExplanation: 'Don\'t fall behind in development. Bring pieces out each turn.',
      learningPoint: 'Each move should develop a piece or address a threat. Never waste a tempo.',
      goalType: 'opening_principle',
      sideToMove: 'black',
      tags: ['development', 'multi-move'],
      metadata: { isStatic: true, estimatedTimeSec: 30, moveCount: 2 }
    },
    {
      fen: "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQK2R w KQkq - 0 1",
      moves: ["e1g1", "e8g8"],
      prompt: "Everything is developed except your king. Finish your opening by castling — then match black's response.",
      hints: [
        "Only one important move remains before the middlegame.",
        "King safety is the top priority once pieces are developed.",
        "Castle kingside to complete your development."
      ],
      solution: [
        { userMove: 'e1g1', opponentMove: 'e8g8', explanation: 'Both sides castle. The opening is complete.' },
      ],
      successExplanation: 'Perfect opening: two knights, two bishops developed, king safe. Ready for the middlegame.',
      failureExplanation: 'You missed the most important opening move. Castle your king!',
      learningPoint: 'The opening is complete when: pieces are developed, king is castled, rooks are connected.',
      goalType: 'opening_principle',
      sideToMove: 'white',
      tags: ['castling', 'multi-move'],
      metadata: { isStatic: true, estimatedTimeSec: 20, moveCount: 1 }
    }
  ],

  day4_castling: [
    {
      fen: "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1",
      moves: ["e1g1"],
      prompt: "Your king is in the center and pieces are cleared on the kingside. Time to get him to safety.",
      hints: [
        "The path between your king and rook is clear.",
        "Castling moves the king two squares toward the rook.",
        "Castle kingside."
      ],
      solution: [{ userMove: 'e1g1', opponentMove: null, explanation: 'Short castling — the king is safe and the rook is active.' }],
      successExplanation: 'King safe, rook connected. Always a priority.',
      failureExplanation: 'Your king is exposed. Castle to safety.',
      learningPoint: 'Short castling is the most common way to secure the king.',
      goalType: 'castle_safety',
      sideToMove: 'white',
      tags: ['castling', 'king-safety'],
      metadata: { isStatic: true, estimatedTimeSec: 10, moveCount: 1 }
    },
    {
      fen: "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1",
      moves: ["e1c1"],
      prompt: "Sometimes the king is safer on the queenside. Try the long version of this special move.",
      hints: [
        "The king moves two squares left instead of right.",
        "The queenside rook will end up on d1.",
        "Castle queenside."
      ],
      solution: [{ userMove: 'e1c1', opponentMove: null, explanation: 'Long castling — the king moves to c1, rook to d1.' }],
      successExplanation: 'Queenside castling is less common but sometimes better.',
      failureExplanation: 'The king can castle queenside too. Move him left.',
      learningPoint: 'Long castling puts the king on c1 and rook on d1.',
      goalType: 'castle_safety',
      sideToMove: 'white',
      tags: ['castling', 'queenside'],
      metadata: { isStatic: true, estimatedTimeSec: 10, moveCount: 1 }
    },
    {
      fen: "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R b KQkq - 0 1",
      moves: ["e8g8"],
      prompt: "Black's king is also exposed. Mirror white's safety and castle on the kingside.",
      hints: [
        "The same rules apply for black — king moves two squares right.",
        "Move the black king from e8 to g8.",
        "Castle kingside as black."
      ],
      solution: [{ userMove: 'e8g8', opponentMove: null, explanation: 'Black castles kingside. Now both kings are safe.' }],
      successExplanation: 'King safety applies to both sides. Well done.',
      failureExplanation: 'Castle your king just like white did.',
      learningPoint: 'Black castles the same way as white — king moves two squares toward the rook.',
      goalType: 'castle_safety',
      sideToMove: 'black',
      tags: ['castling', 'king-safety'],
      metadata: { isStatic: true, estimatedTimeSec: 10, moveCount: 1 }
    },
    {
      fen: "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R b KQkq - 0 1",
      moves: ["e8c8"],
      prompt: "Short castling isn't always available. Try the queenside version for black.",
      hints: [
        "Move the king two squares to the left.",
        "The queenside rook will go to d8.",
        "Castle queenside as black."
      ],
      solution: [{ userMove: 'e8c8', opponentMove: null, explanation: 'Long castling for black — king to c8, rook to d8.' }],
      successExplanation: 'Queenside castling for black. The king is secure.',
      failureExplanation: 'Move the king left toward the queenside rook.',
      learningPoint: 'Long castling is the same for both sides: king moves two squares toward the queenside rook.',
      goalType: 'castle_safety',
      sideToMove: 'black',
      tags: ['castling', 'queenside'],
      metadata: { isStatic: true, estimatedTimeSec: 10, moveCount: 1 }
    },
    {
      fen: "r3kbnr/pppppppp/8/8/8/5N2/PPPPPPPP/R3K2R w KQkq - 0 1",
      moves: ["f3g1"],
      prompt: "You want to castle, but a piece is in the way. Move it somewhere useful first.",
      hints: [
        "The knight on f3 is blocking the king's path to g1.",
        "Move it back or to another square.",
        "The knight can return to g1."
      ],
      solution: [
        { userMove: 'f3g1', opponentMove: null, explanation: 'Knight retreats, clearing the path for castling.' }
      ],
      successExplanation: 'Sometimes you need to unblock before you can castle.',
      failureExplanation: 'The knight is blocking. Move it out of the way.',
      learningPoint: 'All squares between the king and rook must be empty for castling.',
      goalType: 'castle_safety',
      sideToMove: 'white',
      tags: ['castling', 'blocked'],
      metadata: { isStatic: true, estimatedTimeSec: 20, moveCount: 1 }
    },
    {
      fen: "r3kb1r/pppppppp/8/8/8/2N5/PPPPPPPP/R3K2R w KQkq - 0 1",
      moves: ["c3b1"],
      prompt: "Queenside castling is blocked by your own knight on c3. Move it aside first.",
      hints: [
        "The knight on c3 blocks the king's path to c1.",
        "Move the knight to a useful square that clears the path.",
        "The knight can return to b1."
      ],
      solution: [
        { userMove: 'c3b1', opponentMove: null, explanation: 'Knight moves, clearing the queenside castling path.' }
      ],
      successExplanation: 'The path is clear. You can now castle queenside on your next turn.',
      failureExplanation: 'The knight is in the way. Move it somewhere.',
      learningPoint: 'For queenside castling, squares b1, c1, d1 must be empty (for white).',
      goalType: 'castle_safety',
      sideToMove: 'white',
      tags: ['castling', 'blocked'],
      metadata: { isStatic: true, estimatedTimeSec: 20, moveCount: 1 }
    },
    {
      fen: "r3k2r/pppppppp/8/8/8/8/4r3/R3K2R w KQkq - 0 1",
      moves: ["e1f1", "e2e1", "e1d2"],
      prompt: "Castling is illegal when the king is in check. Deal with the threat first, then think about safety.",
      hints: [
        "Your king is under attack from the black rook.",
        "You cannot castle out of check.",
        "Move the king to a safe square."
      ],
      solution: [
        { userMove: 'e1f1', opponentMove: 'e2d2', explanation: 'King moves out of check.' },
        { userMove: 'f1e1', opponentMove: 'd2d1', explanation: 'You moved back but the rook follows. The king is unsafe.' }
      ],
      successExplanation: 'You cannot castle when in check. Always deal with the immediate threat first.',
      failureExplanation: 'Castling is not possible here. Move the king to safety.',
      learningPoint: 'Castling is illegal when the king is in check.',
      goalType: 'castle_safety',
      sideToMove: 'white',
      tags: ['castling', 'in-check'],
      metadata: { isStatic: true, estimatedTimeSec: 20, moveCount: 1 }
    },
    {
      fen: "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/2KR4 w kq - 0 1",
      moves: ["c1d2", "a1c1"],
      prompt: "You need to activate your rook after castling. Bring it to the center where it belongs.",
      hints: [
        "After castling, the rook on d1 is ready for action.",
        "But first, your king might need to step aside for the rook.",
        "Move the king toward safety and bring the rook to the open file."
      ],
      solution: [
        { userMove: 'c1d2', opponentMove: null, explanation: 'King moves, opening the way for the rook to dominate.' }
      ],
      successExplanation: 'The rook is centralized. This is the power of castling.',
      failureExplanation: 'Use the rook that was activated by castling.',
      learningPoint: 'Castling serves two purposes: king safety and rook activation.',
      goalType: 'castle_safety',
      sideToMove: 'white',
      tags: ['castling', 'rook-activation'],
      metadata: { isStatic: true, estimatedTimeSec: 20, moveCount: 1 }
    }
  ],

  day5_check_mate_stalemate: [
    {
      fen: "6k1/5ppp/8/8/8/8/8/5RK1 w - - 0 1",
      moves: ["f1f8"],
      prompt: "The black king is trapped by its own pawns. Deliver the final blow with your rook.",
      hints: [
        "The rook can slide forward along the f-file.",
        "The black pawns block all escape squares around the king.",
        "Move the rook to f8 for checkmate."
      ],
      solution: [{ userMove: 'f1f8', opponentMove: null, explanation: 'Rook to f8 is checkmate — the pawns trap the king!' }],
      successExplanation: 'Back rank mate! The pawns became a cage for their own king.',
      failureExplanation: 'Your rook can reach f8 in one move. Deliver checkmate.',
      learningPoint: 'Pawns in front of the king can become a trap if the back rank is undefended.',
      goalType: 'mate',
      sideToMove: 'white',
      tags: ['back-rank-mate', 'rook'],
      metadata: { isStatic: true, estimatedTimeSec: 10, moveCount: 1 }
    },
    {
      fen: "7k/8/6K1/8/8/8/8/6Q1 w - - 0 1",
      moves: ["g1g7"],
      prompt: "Your king and queen must work together. Move the queen close to deliver the final check.",
      hints: [
        "The queen needs to stand next to the black king with support.",
        "Your king controls the dark squares around the corner.",
        "Settle the queen on g7."
      ],
      solution: [{ userMove: 'g1g7', opponentMove: null, explanation: 'Qg7# — the king supports the queen and covers escapes.' }],
      successExplanation: 'King and queen working together. Beautiful checkmate.',
      failureExplanation: 'The queen must move close to the king with support.',
      learningPoint: 'The queen needs the king\'s support to deliver checkmate against a lone king.',
      goalType: 'mate',
      sideToMove: 'white',
      tags: ['queen-mate', 'king-support'],
      metadata: { isStatic: true, estimatedTimeSec: 15, moveCount: 1 }
    },
    {
      fen: "7k/2K5/8/8/8/8/8/5Q2 w - - 0 1",
      moves: ["f1f8"],
      prompt: "The black king is cornered. Bring your queen to the back rank to finish the game.",
      hints: [
        "The queen can move vertically along the f-file.",
        "The black king has nowhere to run on the 8th rank.",
        "Deliver check on f8."
      ],
      solution: [{ userMove: 'f1f8', opponentMove: null, explanation: 'Qf8# — queen checks on the back rank with the king covering escapes.' }],
      successExplanation: 'The queen on the back rank with the king nearby is checkmate.',
      failureExplanation: 'Move your queen to the same rank as the enemy king.',
      learningPoint: 'A queen on the back rank supported by the king is a common mating pattern.',
      goalType: 'mate',
      sideToMove: 'white',
      tags: ['queen-mate', 'back-rank'],
      metadata: { isStatic: true, estimatedTimeSec: 10, moveCount: 1 }
    },
    {
      fen: "5rk1/8/8/8/8/8/8/5RK1 w - - 0 1",
      moves: ["f1f8"],
      prompt: "Black's rook on f8 is the only thing protecting the king. Find a way to break through.",
      hints: [
        "Your rook can capture the black rook with check.",
        "The black rook is undefended.",
        "Take the rook on f8."
      ],
      solution: [{ userMove: 'f1f8', opponentMove: null, explanation: 'Rxf8# — captures the defender with checkmate!' }],
      successExplanation: 'You captured the only defender. The king is helpless.',
      failureExplanation: 'The rook on f8 can be captured by your rook.',
      learningPoint: 'A piece that blocks a checkmate can often be captured.',
      goalType: 'mate',
      sideToMove: 'white',
      tags: ['capture-defender', 'rook'],
      metadata: { isStatic: true, estimatedTimeSec: 10, moveCount: 1 }
    },
    {
      fen: "6k1/8/6K1/8/8/8/8/7R w - - 0 1",
      moves: ["h1h8", "g8g7", "h8g8"],
      prompt: "Your king is close but the rook is far. Use two moves to drive the king into a mate.",
      hints: [
        "First give a check on the back rank to force the king out.",
        "Then slide the rook to the next file for mate.",
        "Start with Rh8+."
      ],
      solution: [
        { userMove: 'h1h8', opponentMove: 'g8g7', explanation: 'Check on the back rank! The king must move forward.' },
        { userMove: 'h8g8', opponentMove: null, explanation: 'Rg8# — the king covers h7 and f7, the rook covers the rest.' }
      ],
      successExplanation: 'The classic ladder mate! Two moves, perfect execution.',
      failureExplanation: 'You need to force the king into a smaller box. Check from the back rank.',
      learningPoint: 'A rook and king can deliver a ladder mate in just two moves.',
      goalType: 'mate',
      sideToMove: 'white',
      tags: ['ladder-mate', 'rook', 'multi-move'],
      metadata: { isStatic: true, estimatedTimeSec: 25, moveCount: 2 }
    },
    {
      fen: "7k/8/6K1/8/8/8/8/6Q1 w - - 0 1",
      moves: ["g1g6"],
      prompt: "Be careful not to stalemate! Try moving the queen to g6 and see what happens.",
      hints: [
        "The black king has no legal moves — every square is covered.",
        "But the queen isn't giving check.",
        "This is a stalemate — a draw instead of a win."
      ],
      solution: [
        { userMove: 'g1g6', opponentMove: null, explanation: 'Qg6 — not checkmate. This is a stalemate!' }
      ],
      successExplanation: 'You created a stalemate — the king has no moves but isn\'t in check.',
      failureExplanation: 'The queen should go to a square that doesn\'t trap the king without check.',
      learningPoint: 'Always check that the enemy king has a legal move before delivering mate.',
      goalType: 'avoid_stalemate',
      sideToMove: 'white',
      tags: ['stalemate', 'warning'],
      metadata: { isStatic: true, estimatedTimeSec: 10, moveCount: 1 }
    },
    {
      fen: "7k/8/6K1/8/8/8/8/5Q2 w - - 0 1",
      moves: ["f1f8"],
      prompt: "In the last puzzle you stalemated. Now fix it — deliver checkmate without trapping the king.",
      hints: [
        "Move the queen to a square that gives CHECK.",
        "The back rank is the right idea, but make sure it's check.",
        "Deliver check on f8."
      ],
      solution: [{ userMove: 'f1f8', opponentMove: null, explanation: 'Qf8# — checkmate! The king has no escape.' }],
      successExplanation: 'You recognized the danger and delivered mate instead of stalemate.',
      failureExplanation: 'You must give check, not just restrict the king.',
      learningPoint: 'Checkmate = check + no escape. Stalemate = no escape but no check.',
      goalType: 'mate',
      sideToMove: 'white',
      tags: ['avoid-stalemate', 'queen-mate'],
      metadata: { isStatic: true, estimatedTimeSec: 15, moveCount: 1 }
    },
    {
      fen: "7k/8/6K1/8/8/8/8/5Q2 w - - 0 1",
      moves: ["f1f7"],
      prompt: "What happens if the queen gives no check but still traps the king? Try f7.",
      hints: [
        "After Qf7, does the king have any legal moves?",
        "Is the king in check?",
        "This is another stalemate — a draw."
      ],
      solution: [
        { userMove: 'f1f7', opponentMove: null, explanation: 'Qf7 — the king has no moves but isn\'t in check. Stalemate again.' }
      ],
      successExplanation: 'Correct — this is a stalemate. Now you can recognize the difference.',
      failureExplanation: 'The king is trapped but not in check. That\'s a stalemate.',
      learningPoint: 'Always ask: "Does my move give check? If not, can the opponent move?"',
      goalType: 'avoid_stalemate',
      sideToMove: 'white',
      tags: ['stalemate', 'warning'],
      metadata: { isStatic: true, estimatedTimeSec: 10, moveCount: 1 }
    }
  ],

  day6_fork_double_attack: [
    {
      fen: "3q3k/8/8/6N1/8/8/8/4K3 w - - 0 1",
      moves: ["g5f7"],
      prompt: "Your knight is perfectly positioned. Find the square where it attacks both the king and the queen at once.",
      hints: [
        "The king is in the corner and the queen is on the d-file.",
        "There's a square where the knight gives check and attacks the queen.",
        "Jump to f7."
      ],
      solution: [{ userMove: 'g5f7', opponentMove: null, explanation: 'Nf7+ forks the king and queen! The queen is lost.' }],
      successExplanation: 'A royal fork! Knight attacks both king and queen. The queen must fall.',
      failureExplanation: 'Find the square where the knight attacks both enemy pieces.',
      learningPoint: 'A knight fork on the king and queen is the most devastating tactical motif.',
      goalType: 'tactical_sequence',
      sideToMove: 'white',
      tags: ['knight-fork', 'royal-fork'],
      metadata: { isStatic: true, estimatedTimeSec: 20, moveCount: 1 }
    },
    {
      fen: "2r1k3/8/8/5N2/8/8/8/4K3 w - - 0 1",
      moves: ["f5d6"],
      prompt: "The black king and rook are vulnerable. Find the square where the knight attacks both.",
      hints: [
        "The knight is on f5. It needs to jump to a square near both enemies.",
        "There's a square that attacks the king on e8 and the rook on c8.",
        "Jump to d6."
      ],
      solution: [{ userMove: 'f5d6', opponentMove: null, explanation: 'Nd6+ forks king and rook!' }],
      successExplanation: 'The king must deal with the check, and the rook will be captured.',
      failureExplanation: 'The knight can fork the king and rook from d6.',
      learningPoint: 'Knights are most dangerous when they can attack two undefended pieces at once.',
      goalType: 'tactical_sequence',
      sideToMove: 'white',
      tags: ['knight-fork'],
      metadata: { isStatic: true, estimatedTimeSec: 20, moveCount: 1 }
    },
    {
      fen: "r5k1/8/8/8/8/8/8/3QK3 w - - 0 1",
      moves: ["d1d5"],
      prompt: "Your queen is powerful enough to create a double attack. Find the square that checks the king and threatens a rook.",
      hints: [
        "The queen can move along diagonals and straight lines.",
        "From d5, the queen attacks the king on g8 (diagonal) and the rook on a8 (rank).",
        "Move the queen to d5."
      ],
      solution: [{ userMove: 'd1d5', opponentMove: null, explanation: 'Qd5+ checks the king and attacks the rook! Double attack.' }],
      successExplanation: 'The queen is so powerful, even a single queen can create a winning fork.',
      failureExplanation: 'Your queen can give check and threaten the rook from d5.',
      learningPoint: 'A queen fork combines a check with an attack on another piece.',
      goalType: 'tactical_sequence',
      sideToMove: 'white',
      tags: ['queen-fork', 'double-attack'],
      metadata: { isStatic: true, estimatedTimeSec: 15, moveCount: 1 }
    },
    {
      fen: "4k3/2q1r3/3b4/4P3/8/8/8/K7 w - - 0 1",
      moves: ["e5d6"],
      prompt: "Even a pawn can create a devastating fork. Capture the bishop and see what else becomes threatened.",
      hints: [
        "The pawn on e5 can capture diagonally.",
        "After capturing on d6, the pawn attacks two other pieces.",
        "Play exd6."
      ],
      solution: [{ userMove: 'e5d6', opponentMove: null, explanation: 'exd6! The pawn forks the queen on c7 and the rook on e7!' }],
      successExplanation: 'A pawn fork! The humble pawn attacks two major pieces at once.',
      failureExplanation: 'The pawn can create a double attack by capturing on d6.',
      learningPoint: 'Pawns can create forks too, often against higher-value pieces.',
      goalType: 'tactical_sequence',
      sideToMove: 'white',
      tags: ['pawn-fork'],
      metadata: { isStatic: true, estimatedTimeSec: 20, moveCount: 1 }
    },
    {
      fen: "4k3/5q2/8/5N2/8/8/8/4K3 w - - 0 1",
      moves: ["f5d6"],
      prompt: "Your knight is perfectly placed near the enemy king. Find the square where it attacks both king and queen.",
      hints: [
        "The knight needs to reach a square near the king.",
        "From d6, the knight attacks both the king on e8 and the queen on f7.",
        "Play Nd6."
      ],
      solution: [{ userMove: 'f5d6', opponentMove: null, explanation: 'Nd6+ forks the king and queen! A royal fork!' }],
      successExplanation: 'The knight forks king and queen. The queen is lost after the king moves.',
      failureExplanation: 'Your knight can reach d6 and attack both enemy pieces from there.',
      learningPoint: 'The knight fork on king and queen is the most powerful tactical pattern.',
      goalType: 'tactical_sequence',
      sideToMove: 'white',
      tags: ['knight-fork', 'royal-fork'],
      metadata: { isStatic: true, estimatedTimeSec: 20, moveCount: 1 }
    },
    {
      fen: "3r2k1/8/8/3r4/8/8/8/R3K3 w - - 0 1",
      moves: ["a1d1", "d5e5", "d1d8"],
      prompt: "Two black rooks are on the same file. Attack one with your rook — when it moves, capture the other with check.",
      hints: [
        "Your rook on a1 can move to the d-file and attack both rooks.",
        "The rook on d5 will move, leaving the rook on d8 vulnerable.",
        "Play Rd1, then Rxd8+."
      ],
      solution: [
        { userMove: 'a1d1', opponentMove: 'd5e5', explanation: 'Rd1 attacks d5 and d8. Black saves the first rook.' },
        { userMove: 'd1d8', opponentMove: null, explanation: 'Rxd8+ captures the second rook with check!' }
      ],
      successExplanation: 'Both rooks were on the same file. After one escaped, the other fell.',
      failureExplanation: 'Move your rook to the d-file first, then capture the undefended rook.',
      learningPoint: 'Pieces on the same file can be vulnerable if they cannot both escape.',
      goalType: 'tactical_sequence',
      sideToMove: 'white',
      tags: ['double-attack', 'multi-move'],
      metadata: { isStatic: true, estimatedTimeSec: 25, moveCount: 2 }
    },
    {
      fen: "r3k3/8/8/8/8/8/6B1/4K3 w - - 0 1",
      moves: ["g2c6"],
      prompt: "Your bishop controls the long diagonal. Find the square that attacks both the king and the rook.",
      hints: [
        "The king on e8 and the rook on a8 are on the same diagonal.",
        "Your bishop needs to reach a square on that diagonal.",
        "Move the bishop to c6."
      ],
      solution: [{ userMove: 'g2c6', opponentMove: null, explanation: 'Bc6 attacks both the king on e8 and the rook on a8!' }],
      successExplanation: 'A bishop fork! Both king and rook are attacked on the same diagonal.',
      failureExplanation: 'The bishop can reach c6 and attack both pieces from there.',
      learningPoint: 'Bishops can fork pieces that are on the same diagonal.',
      goalType: 'tactical_sequence',
      sideToMove: 'white',
      tags: ['bishop-fork'],
      metadata: { isStatic: true, estimatedTimeSec: 20, moveCount: 1 }
    },
    {
      fen: "r1b1k3/8/8/8/8/8/3R4/4K3 w - - 0 1",
      moves: ["d2d7"],
      prompt: "Your rook can penetrate deep into enemy territory. Find a square where it attacks the king and another piece.",
      hints: [
        "The rook can move vertically or horizontally.",
        "On the 7th rank, the rook attacks both the king and a piece.",
        "Move the rook to d7."
      ],
      solution: [
        { userMove: 'd2d7', opponentMove: 'e8d7', explanation: 'Rd7+ checks the king and attacks the bishop on b7?' },
        { userMove: 'd7b7', opponentMove: null, explanation: 'Rxb7! The bishop is captured.' }
      ],
      successExplanation: 'The rook check forced the king to move, exposing the bishop.',
      failureExplanation: 'The rook can give check on d7 and threaten the bishop.',
      learningPoint: 'A rook fork on the 7th rank can win material.',
      goalType: 'tactical_sequence',
      sideToMove: 'white',
      tags: ['rook-fork', 'multi-move'],
      metadata: { isStatic: true, estimatedTimeSec: 25, moveCount: 2 }
    }
  ],

  day7_review_mixed: [
    {
      fen: "7k/5Q2/6K1/8/8/8/8/8 w - - 0 1",
      moves: ["f7f8"],
      prompt: "This position looks familiar. Every piece on the board has a job. Finish the game in one move.",
      hints: [
        "The black king is in the corner with his own pawns blocking escapes.",
        "No, wait — there are no pawns. Only your queen and king can end this.",
        "Deliver checkmate on the back rank."
      ],
      solution: [{ userMove: 'f7f8', opponentMove: null, explanation: 'Qf8#! The king and queen cooperate for checkmate.' }],
      successExplanation: 'You spotted the mate. Clean finish.',
      failureExplanation: 'The queen can deliver mate on f8 with the king covering escapes.',
      learningPoint: 'The queen and king cooperate to deliver mate in simple endgames.',
      goalType: 'mate',
      sideToMove: 'white',
      tags: ['queen-mate', 'review'],
      metadata: { isStatic: true, estimatedTimeSec: 10, moveCount: 1 }
    },
    {
      fen: "4k3/4q3/8/8/8/8/8/4R1K1 w - - 0 1",
      moves: ["e1e7"],
      prompt: "The board is almost empty, but your opponent made a critical mistake. One capture wins the game instantly.",
      hints: [
        "Look at the queen and king — are they on the same line?",
        "The black queen can\'t move because her own king is behind her.",
        "Your rook can capture the pinned queen."
      ],
      solution: [{ userMove: 'e1e7', opponentMove: null, explanation: 'Rxe7! The queen is pinned to the king and cannot escape.' }],
      successExplanation: 'You spotted the pin. Pins win games.',
      failureExplanation: 'The queen is pinned — your rook can take it for free.',
      learningPoint: 'A pin occurs when a piece cannot move without exposing a more valuable piece behind it.',
      goalType: 'win_material',
      sideToMove: 'white',
      tags: ['pin', 'review'],
      metadata: { isStatic: true, estimatedTimeSec: 15, moveCount: 1 }
    },
    {
      fen: "2r1k3/8/8/5N2/8/8/8/4K3 w - - 0 1",
      moves: ["f5d6"],
      prompt: "The enemy king and rook are close together. There\'s a move that takes advantage of this. Can you find it?",
      hints: [
        "This is a familiar pattern from Day 6.",
        "A knight can often attack two pieces at once.",
        "Jump to d6."
      ],
      solution: [{ userMove: 'f5d6', opponentMove: null, explanation: 'Nd6+ forks king and rook!' }],
      successExplanation: 'You remembered the knight fork from earlier lessons.',
      failureExplanation: 'The knight can fork king and rook from d6.',
      learningPoint: 'Knight forks are powerful because knights attack in patterns other pieces don\'t.',
      goalType: 'tactical_sequence',
      sideToMove: 'white',
      tags: ['knight-fork', 'review'],
      metadata: { isStatic: true, estimatedTimeSec: 15, moveCount: 1 }
    },
    {
      fen: "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",
      moves: ["e1g1"],
      prompt: "Development is nearly complete. There\'s one essential move before any attack can begin. Find it.",
      hints: [
        "The king is still in the center.",
        "There\'s one move that achieves two goals at once.",
        "Castle to safety."
      ],
      solution: [{ userMove: 'e1g1', opponentMove: null, explanation: 'O-O! King safety and rook activation in one move.' }],
      successExplanation: 'You never forget to castle. This habit will save you countless games.',
      failureExplanation: 'Castle your king to safety before attacking.',
      learningPoint: 'Castling is the only move that moves two pieces — always prioritize it.',
      goalType: 'castle_safety',
      sideToMove: 'white',
      tags: ['castling', 'review'],
      metadata: { isStatic: true, estimatedTimeSec: 10, moveCount: 1 }
    },
    {
      fen: "6k1/8/6K1/8/8/8/8/7R w - - 0 1",
      moves: ["h1h8", "g8g7", "h8g8"],
      prompt: "The king is out of position and your rook has all the space it needs. Drive the enemy king into a trap.",
      hints: [
        "Your rook can control the entire board from the back rank.",
        "First a check on the back rank, then a decisive follow-up.",
        "Start with Rh8+."
      ],
      solution: [
        { userMove: 'h1h8', opponentMove: 'g8g7', explanation: 'Rh8+ forces the king onto the 7th rank.' },
        { userMove: 'h8g8', opponentMove: null, explanation: 'Rg8#! A textbook ladder mate.' }
      ],
      successExplanation: 'You remembered the ladder mate from Day 5. Perfect execution.',
      failureExplanation: 'Two-move mate: check on the back rank, then slide the rook.',
      learningPoint: 'The ladder mate is one of the most important endgame patterns to know.',
      goalType: 'mate',
      sideToMove: 'white',
      tags: ['ladder-mate', 'multi-move', 'review'],
      metadata: { isStatic: true, estimatedTimeSec: 20, moveCount: 2 }
    },
    {
      fen: "r3k3/8/8/8/8/3B4/8/R3K3 w - - 0 1",
      moves: ["d3b5", "e8d7", "a1a8"],
      prompt: "You have more pieces than your opponent. There\'s a way to win material by moving a piece that\'s in the way.",
      hints: [
        "Your bishop is blocking your rook\'s vision.",
        "Move the bishop to an active square and watch what becomes threatened.",
        "Play Bb5, then capture the rook."
      ],
      solution: [
        { userMove: 'd3b5', opponentMove: 'e8d7', explanation: 'Bb5 — the rook now controls the a-file.' },
        { userMove: 'a1a8', opponentMove: null, explanation: 'Rxa8! The rook was undefended.' }
      ],
      successExplanation: 'Discovered attack: move one piece to reveal a threat from another.',
      failureExplanation: 'Move the bishop off the a-file to uncover the rook\'s attack.',
      learningPoint: 'Discovered attacks are a powerful way to win material.',
      goalType: 'tactical_sequence',
      sideToMove: 'white',
      tags: ['discovered-attack', 'multi-move', 'review'],
      metadata: { isStatic: true, estimatedTimeSec: 25, moveCount: 2 }
    },
    {
      fen: "r3k3/5q2/8/8/8/8/5Q2/R3K3 w - - 0 1",
      moves: ["f2f7", "e8f7", "a1a8"],
      prompt: "Sometimes you must give up your most powerful piece to win the game. Calculate this exchange carefully.",
      hints: [
        "Trading queens could leave a rook undefended.",
        "Capture the queen even though the king will recapture.",
        "Then take the hanging rook."
      ],
      solution: [
        { userMove: 'f2f7', opponentMove: 'e8f7', explanation: 'Queens are traded.' },
        { userMove: 'a1a8', opponentMove: null, explanation: 'Rxa8! The rook loses its defender and is captured.' }
      ],
      successExplanation: 'You calculated the queen trade and came out ahead. Brave and correct.',
      failureExplanation: 'Sacrifice the queen first, then capture the hanging rook.',
      learningPoint: 'Sometimes sacrificing a queen is the right move if you win more material.',
      goalType: 'win_material',
      sideToMove: 'white',
      tags: ['queen-trade', 'multi-move', 'review'],
      metadata: { isStatic: true, estimatedTimeSec: 30, moveCount: 2 }
    },
    {
      fen: "r3k3/5b2/8/8/8/8/3R4/4K3 w - - 0 1",
      moves: ["d2d8", "e8e7", "d8a8"],
      prompt: "The enemy pieces are scattered. Find a way to attack two things at once with one powerful move.",
      hints: [
        "Your rook can slide up the d-file with deadly effect.",
        "The king must respond to the check, leaving a piece undefended.",
        "Play Rd8+, then take the rook."
      ],
      solution: [
        { userMove: 'd2d8', opponentMove: 'e8e7', explanation: 'Rd8+! Checking the king and attacking the rook.' },
        { userMove: 'd8a8', opponentMove: null, explanation: 'Rxa8! The rook falls while the king watches.' }
      ],
      successExplanation: 'Double attack on the back rank. The king couldn\'t defend everything.',
      failureExplanation: 'Use the rook to check and threaten at the same time.',
      learningPoint: 'A rook on the back rank can create devastating double attacks.',
      goalType: 'tactical_sequence',
      sideToMove: 'white',
      tags: ['double-attack', 'multi-move', 'review'],
      metadata: { isStatic: true, estimatedTimeSec: 25, moveCount: 2 }
    }
  ],

  day4_king_safety: [
    {
      id: "day4_kingsafety_p5",
      day: 4,
      topic: "day4_king_safety",
      skill: "Защита короля после рокировки",
      goalType: "king_safety",
      fen: "r1bqk2r/pppp1ppp/2n5/2b1p3/2B1P1n1/3P1N2/PPP2PPP/RNBQ1RK1 w kq - 0 1",
      sideToMove: "w",
      moves: ["h2h3"],
      solution: [
        {
          userMove: "h2h3",
          opponentMove: null,
          explanation: "Отлично! Ход h3 выгоняет коня и предотвращает угрозы."
        }
      ],
      prompt: "Твой король уже в укрытии, но соперник наращивает давление. Найди защитный ход.",
      hints: {
        soft: "Обрати внимание на активность фигур соперника рядом с твоим королём.",
        medium: "Конь противника проник на королевский фланг и угрожает опасной вилкой.",
        strong: "Прогони коня ходом крайней пешки, чтобы снять угрозу."
      },
      successExplanation: "Прекрасно! Ход h3 выгнал коня и предотвратил опасную атаку на f2.",
      failureExplanation: "Ты не заметил, что конь на g4 угрожал вилкой на f2 с последующим вскрытием позиции короля.",
      learningPoint: "После рокировки следи за полями f2 и h2 — они становятся уязвимы для атак лёгких фигур.",
      tags: ["king_safety", "defense", "prophylaxis"],
      metadata: { moveCount: 1 }
    },
    {
      id: "day4_kingsafety_p6",
      day: 4,
      topic: "day4_king_safety",
      skill: "Рокировка из центра",
      goalType: "king_safety",
      fen: "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2NP4/PPP2PPP/R1BQK1NR w KQkq - 0 1",
      sideToMove: "w",
      moves: ["g1f3", "e1g1"],
      solution: [
        {
          userMove: "g1f3",
          opponentMove: "d7d6",
          explanation: "Отлично! Конь развит в центр, и путь для рокировки свободен."
        },
        {
          userMove: "e1g1",
          opponentMove: null,
          explanation: "Великолепно! Король в безопасности после рокировки."
        }
      ],
      prompt: "Король застрял в центре. Найди последовательность ходов, которая сделает позицию безопаснее.",
      hints: {
        soft: "Королю мешает собственная фигура — убери её с пути.",
        medium: "Путь для рокировки преграждает собственный конь.",
        strong: "Сначала развей коня в центр, чтобы освободить дорогу для укрытия короля."
      },
      successExplanation: "Отлично! После Nf3 король спрятался в укрытие через рокировку.",
      failureExplanation: "Король остался в центре — при вскрытии центральных линий он попадёт под атаку.",
      learningPoint: "Старайся делать рокировку как можно раньше, чтобы король оказался в безопасности.",
      tags: ["king_safety", "castling", "development"],
      metadata: { moveCount: 2 }
    },
    {
      id: "day4_kingsafety_p7",
      day: 4,
      topic: "day4_king_safety",
      skill: "Рокировка перед вскрытием центра",
      goalType: "king_safety",
      fen: "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2BPP3/5N2/PPP2PPP/RNBQK2R w KQkq - 0 1",
      sideToMove: "w",
      moves: ["e1g1"],
      solution: [
        {
          userMove: "e1g1",
          opponentMove: null,
          explanation: "Прекрасно! Король вовремя покинул центр до его вскрытия."
        }
      ],
      prompt: "Соперник готов вскрыть центр. Найди упреждающий ход, который обезопасит короля.",
      hints: {
        soft: "Центр может вскрыться, и король окажется под атакой.",
        medium: "Соперник готов вскрыть центр пешечным ударом, открывая линии.",
        strong: "Прежде чем соперник вскроет центр, спрячь короля с помощью рокировки."
      },
      successExplanation: "Отлично! Рокировка вовремя уводит короля в безопасное место.",
      failureExplanation: "Король остался в центре и теперь уязвим для атаки по открытым линиям.",
      learningPoint: "Если соперник угрожает вскрыть центр — рокируйся немедленно, не откладывая.",
      tags: ["king_safety", "castling", "center"],
      metadata: { moveCount: 1 }
    },
    {
      id: "day4_kingsafety_p8",
      day: 4,
      topic: "day4_king_safety",
      skill: "Скрытая угроза королю",
      goalType: "king_safety",
      fen: "r1b2rk1/ppp2qpp/2n1p3/2bp4/3P4/2P1P3/PP3PPP/R1BQ1RK1 w - - 0 1",
      sideToMove: "w",
      moves: ["h2h3"],
      solution: [
        {
          userMove: "h2h3",
          opponentMove: null,
          explanation: "Великолепно! Ход h3 создал форточку — король получил путь к отступлению."
        }
      ],
      prompt: "Позиция выглядит спокойно, но король в скрытой опасности. Найди угрозу и предотврати её, пока атака не стала решающей.",
      hints: {
        soft: "Позиция кажется безопасной, но королю может некуда отступить.",
        medium: "Вражеский ферзь и ладья построились по линии «f», угрожая матом на первой горизонтали.",
        strong: "Сделай ход крайней пешкой, чтобы король получил поле для отступления."
      },
      successExplanation: "Отлично! Ход h3 создал форточку для короля и предотвратил матовую атаку.",
      failureExplanation: "Чёрные сыграли Qxf2+ Kh1 Qxf1# — ты не заметил, что королю некуда отступать.",
      learningPoint: "Всегда создавай форточку для короля после рокировки, если соперник может атаковать по первой горизонтали.",
      tags: ["king_safety", "back_rank_mate", "luft"],
      metadata: { moveCount: 1 }
    }
  ]
};

export const getThematicPuzzles = (day: number): ChessPuzzleTask[] => {
  const keys = [
    'day1_piece_movement',
    'day2_piece_value',
    'day3_opening_principles',
    'day4_castling',
    'day5_check_mate_stalemate',
    'day6_fork_double_attack',
    'day7_review_mixed'
  ];
  const key = keys[day - 1] || 'day1_piece_movement';
  const puzzles = chessLessonPuzzles[key] || [];
  return puzzles.map((p, idx) => ({
    id: `chess_puzzle_${day}_${idx + 1}`,
    fen: p.fen,
    puzzleMoves: p.moves || [],
    rating: 1000,
    themes: [],
    prompt: p.prompt,
    hints: p.hints || ['Подумай над лучшим ходом!'],
    ...(p.solution && { solution: p.solution }),
    ...(p.successExplanation && { successExplanation: p.successExplanation }),
    ...(p.failureExplanation && { failureExplanation: p.failureExplanation }),
    ...(p.learningPoint && { learningPoint: p.learningPoint }),
    ...(p.goalType && { goalType: p.goalType }),
    ...(p.tags && { tags: p.tags }),
    ...(p.metadata && { metadata: p.metadata }),
  }));
};

export const ACTIVE_CHESS_PUZZLES: ChessPuzzleTask[] = getThematicPuzzles(1);

const COORDINATE_PATTERN = /\b[a-h][1-8]\b/;
const DIRECT_COMMAND_PATTERNS = [
  /\b(?:play|make a move|move to|capture on|with the move)\b/i,
  /\bs(?:ыграй|делай ход|сходи|побей|забери)\b/i,
];

export function validateChessPuzzles(puzzles: ChessPuzzleTask[]) {
  const fens = new Set<string>();
  puzzles.forEach((puzzle, index) => {
    const { fen, puzzleMoves, prompt, hints, solution, metadata } = puzzle;
    let chess: Chess;
    try {
      chess = new Chess(fen);
    } catch (e: any) {
      console.warn(`[Chess Validation Warning] Puzzle #${index} failed to load FEN: "${fen}". Error: ${e.message}`);
      return;
    }

    if (fens.has(fen)) {
      console.warn(`[Chess Validation Warning] Puzzle #${index} has duplicate FEN: "${fen}"`);
    }
    fens.add(fen);

    // Validate V2 solution[] if present
    if (solution && solution.length > 0) {
      if (solution.length === 0) {
        console.warn(`[Chess Validation Warning] Puzzle #${index} has empty solution array.`);
      }

      let tempChess = new Chess(fen);
      for (let i = 0; i < solution.length; i++) {
        const step = solution[i];

        // Validate userMove
        const userFrom = step.userMove.slice(0, 2);
        const userTo = step.userMove.slice(2, 4);
        const userPromotion = step.userMove.slice(4) || undefined;
        try {
          const result = tempChess.move({ from: userFrom, to: userTo, promotion: userPromotion });
          if (!result) {
            throw new Error('Move returned null');
          }
        } catch (e: any) {
          console.warn(
            `[Chess Validation Warning] Puzzle #${index + 1} ("${prompt.slice(0, 30)}..."): ` +
            `Solution step #${i + 1} userMove "${step.userMove}" is illegal. ` +
            `Current FEN: "${tempChess.fen()}". Error: ${e.message}`
          );
          break;
        }

        // Validate opponentMove if present
        if (step.opponentMove) {
          const oppFrom = step.opponentMove.slice(0, 2);
          const oppTo = step.opponentMove.slice(2, 4);
          const oppPromotion = step.opponentMove.slice(4) || undefined;
          try {
            const result = tempChess.move({ from: oppFrom, to: oppTo, promotion: oppPromotion });
            if (!result) {
              throw new Error('Move returned null');
            }
          } catch (e: any) {
            console.warn(
              `[Chess Validation Warning] Puzzle #${index + 1} ("${prompt.slice(0, 30)}..."): ` +
              `Solution step #${i + 1} opponentMove "${step.opponentMove}" is illegal. ` +
              `Current FEN: "${tempChess.fen()}". Error: ${e.message}`
            );
            break;
          }
        }
      }
    } else {
      // Validate legacy moves[]
      if (puzzleMoves.length === 0) {
        console.warn(`[Chess Validation Warning] Puzzle #${index} has no moves defined.`);
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
          console.warn(
            `[Chess Validation Warning] Puzzle #${index + 1} ("${prompt.slice(0, 30)}..."): ` +
            `Move #${i + 1} ("${moveUci}") is illegal. ` +
            `Current FEN: "${tempChess.fen()}". Error: ${e.message}`
          );
          break;
        }
      }
    }

    // UX: prompt must not contain coordinates
    if (COORDINATE_PATTERN.test(prompt)) {
      console.warn(`[Chess UX Warning] Puzzle #${index + 1}: prompt contains coordinates: "${prompt}"`);
    }

    // UX: prompt must not contain direct commands
    for (const pattern of DIRECT_COMMAND_PATTERNS) {
      if (pattern.test(prompt)) {
        console.warn(
          `[Chess UX Warning] Puzzle #${index + 1}: prompt contains direct command matching /${pattern.source}/: "${prompt.slice(0, 50)}..."`
        );
        break;
      }
    }

    // UX: hints must not contain coordinates (soft and medium only)
    if (hints && hints.length > 0) {
      const checkedHints = hints.slice(0, Math.min(2, hints.length));
      for (const hint of checkedHints) {
        if (COORDINATE_PATTERN.test(hint)) {
          console.warn(
            `[Chess UX Warning] Puzzle #${index + 1}: soft/medium hint contains coordinates: "${hint}"`
          );
          break;
        }
      }
    }

    // Validate metadata.moveCount matches solution.length if both provided
    if (metadata?.moveCount != null && solution?.length) {
      if (metadata.moveCount !== solution.length) {
        console.warn(
          `[Chess Validation Warning] Puzzle #${index + 1}: metadata.moveCount (${metadata.moveCount}) ` +
          `does not match solution.length (${solution.length})`
        );
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
