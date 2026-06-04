/**
 * lichessService.ts
 * Сервис для получения шахматных задач через бесплатный Lichess API.
 * - 10 задач в день для Free пользователей
 * - Кэширование в AsyncStorage на текущий день
 * - Конвертация формата Lichess → наш TaskStep
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ─────────────────────────────────────────────
// Типы Lichess API
// ─────────────────────────────────────────────

export interface LichessPuzzle {
    id: string;
    fen: string;       // Позиция перед первым ходом задачи
    moves: string[];   // Все ходы в UCI: первый — ход соперника, остальные — решение
    rating: number;    // Сложность ~1000-2800
    themes: string[];  // Тактические темы: ['fork', 'mateIn1', ...]
}

export interface ChessPuzzleTask {
    id: string;
    fen: string;           // FEN после первого хода соперника (позиция для игрока)
    puzzleMoves: string[]; // Ходы решения (UCI), которые должен сделать пользователь
    rating: number;
    themes: string[];
    prompt: string;        // Текстовое задание
}

// ─────────────────────────────────────────────
// Кэш-ключи
// ─────────────────────────────────────────────

const CACHE_KEY_DATE = 'lichess_cache_date';
const CACHE_KEY_PUZZLES = 'lichess_cache_puzzles';
const CACHE_KEY_HINTS_USED = 'lichess_hints_used';

function getTodayString(): string {
    return new Date().toISOString().split('T')[0];
}

// ─────────────────────────────────────────────
// Генерация подсказки-промпта для задачи
// ─────────────────────────────────────────────

function generatePrompt(themes: string[], rating: number): string {
    const themeAdvice: Record<string, string> = {
        fork: 'Твоя фигура может атаковать две цели сразу. Найди этот двойной удар и выиграй материал.',
        pin: 'Одна из фигур соперника прикована к месту под угрозой потери более ценной. Используй это!',
        skewer: 'Линейный удар: атакуй ценную фигуру сквозь другую, чтобы выиграть стоящую позади цель.',
        discoveredAttack: 'Ход одной фигурой откроет линию атаки для другой. Найди этот мощный открытый удар.',
        doubleCheck: 'Двойной шах вынуждает короля бежать, ведь закрыться от двух угроз сразу невозможно.',
        mateIn1: 'Король соперника зажат и беззащитен. Найди единственный решающий ход для мата в один ход.',
        mateIn2: 'Начни форсированную матовую атаку: объяви шах и поставь неизбежный мат в два хода.',
        mateIn3: 'Просчитай точную форсированную комбинацию, которая приведёт к мату ровно в три хода.',
        endgame: 'В финальной стадии партии важна точность каждого шага. Найди сильнейшее продолжение.',
        middlegame: 'В сложной позиции миттельшпиля назревает тактический удар. Найди лучший ход для атаки.',
        opening: 'Борись за центр и активно развивай свои фигуры, создавая неприятные угрозы сопернику.',
        defensiveMove: 'Твой король или важная фигура под угрозой. Найди единственный верный способ спасения.',
        quietMove: 'Не все победы куются шахами. Найди тихий, но смертельно опасный ход, создающий угрозу.',
        sacrifice: 'Отдай малую фигуру сейчас, чтобы получить решающую атаку или выиграть гораздо больше.',
        backRankMate: 'Король зажат собственными пешками на последней линии. Найди способ поставить ему мат.',
        promotion: 'Твоя пешка близка к заветной цели. Проведи её вперед и выбери правильное превращение.',
        capturingDefender: 'Вражеская фигура охраняет важный пункт. Уничтожь этого защитника для развития атаки.',
        trappedPiece: 'Одна из фигур противника осталась без путей отступления. Найди способ поймать её.',
    };

    for (const t of themes) {
        if (themeAdvice[t]) {
            return themeAdvice[t];
        }
    }

    if (rating < 1200) {
        return 'Найди фигуру без защиты. Иногда лучший ход — просто забрать то, что соперник оставил.';
    }
    if (rating < 1600) {
        return 'Внимательно оцени позицию и найди скрытое тактическое решение для выигрыша материала.';
    }
    if (rating < 2000) {
        return 'В этой сложной позиции тебе нужно найти тонкий маневр, который перевернет ход игры.';
    }
    return 'Это серьезное испытание для опытных игроков. Найди самый глубокий и сильнейший ход.';
}

// ─────────────────────────────────────────────
// Преобразование FEN: применяем первый ход соперника
// ─────────────────────────────────────────────

function applyUciMove(fen: string, uciMove: string): string {
    // Упрощённое применение UCI-хода к FEN (только позиция фигур)
    // Для production лучше использовать chess.js, но для нашего use case хватит
    // Мы возвращаем исходный FEN + помечаем его как "после хода соперника"
    // ChessBoard компонент умеет работать с FEN
    try {
        const fromFile = uciMove.charCodeAt(0) - 97; // a=0, h=7
        const fromRank = 8 - parseInt(uciMove[1]);   // '1'→7, '8'→0
        const toFile = uciMove.charCodeAt(2) - 97;
        const toRank = 8 - parseInt(uciMove[3]);

        const parts = fen.trim().split(/\s+/);
        const rows = parts[0].split('/');

        // Convert FEN rows to 8x8 grid
        const grid: string[][] = [];
        for (const row of rows) {
            const gridRow: string[] = [];
            for (const char of row) {
                if (/[1-8]/.test(char)) {
                    for (let i = 0; i < parseInt(char); i++) gridRow.push('');
                } else {
                    gridRow.push(char);
                }
            }
            grid.push(gridRow);
        }

        // Apply move
        const piece = grid[fromRank][fromFile];
        // Handle promotion
        if (uciMove.length === 5) {
            const promoChar = uciMove[4];
            const isWhite = piece === piece.toUpperCase() && piece !== '';
            grid[toRank][toFile] = isWhite ? promoChar.toUpperCase() : promoChar.toLowerCase();
        } else {
            grid[toRank][toFile] = piece;
        }
        grid[fromRank][fromFile] = '';

        // Convert grid back to FEN rows
        const newRows = grid.map(row => {
            let fenRow = '';
            let emptyCount = 0;
            for (const cell of row) {
                if (cell === '') {
                    emptyCount++;
                } else {
                    if (emptyCount > 0) { fenRow += emptyCount; emptyCount = 0; }
                    fenRow += cell;
                }
            }
            if (emptyCount > 0) fenRow += emptyCount;
            return fenRow;
        });

        // Toggle active color
        const activeColor = parts[1] === 'w' ? 'b' : 'w';
        const newFenParts = [newRows.join('/'), activeColor, parts[2] || '-', parts[3] || '-', parts[4] || '0', parts[5] || '1'];
        return newFenParts.join(' ');
    } catch {
        return fen; // Fallback: return original FEN
    }
}

// ─────────────────────────────────────────────
// Конвертация Lichess puzzle → наш формат
// ─────────────────────────────────────────────

function lichessToPuzzleTask(puzzle: LichessPuzzle): ChessPuzzleTask {
    // В Lichess: moves[0] = ход соперника (нужно применить к FEN)
    // moves[1..N] = ходы решения, которые должен сделать игрок
    const opponentMove = puzzle.moves[0];
    const solutionMoves = puzzle.moves.slice(1);

    const startingFen = applyUciMove(puzzle.fen, opponentMove);

    return {
        id: puzzle.id,
        fen: startingFen,
        puzzleMoves: solutionMoves,
        rating: puzzle.rating,
        themes: puzzle.themes,
        prompt: generatePrompt(puzzle.themes, puzzle.rating),
    };
}

// ─────────────────────────────────────────────
// Fallback задачи (когда нет интернета)
// ─────────────────────────────────────────────

const FALLBACK_PUZZLES: ChessPuzzleTask[] = [
    {
        id: 'fallback_1',
        fen: '6k1/8/6K1/8/8/8/8/7Q w - - 0 1',
        puzzleMoves: ['h1h7'],
        rating: 800,
        themes: ['mateIn1'],
        prompt: 'Король соперника полностью зажат. Объяви решающий шах ферзем и заверши эту партию.',
    },
    {
        id: 'fallback_2',
        fen: '8/8/8/3r4/8/8/8/R3K1n1 b - - 0 1',
        puzzleMoves: ['g1f3'],
        rating: 1000,
        themes: ['fork'],
        prompt: 'Твой конь может нанести двойной удар. Объяви вилку на две вражеские фигуры сразу.',
    },
    {
        id: 'fallback_3',
        fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1',
        puzzleMoves: ['g1f3'],
        rating: 800,
        themes: ['opening'],
        prompt: 'Помни принципы дебюта и развивай легкие фигуры. Выведи коня на активную позицию.',
    },
    {
        id: 'fallback_4',
        fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
        puzzleMoves: ['e1g1'],
        rating: 900,
        themes: ['opening'],
        prompt: 'Король в центре подвергается опасности. Сделай короткую рокировку для его защиты.',
    },
    {
        id: 'fallback_5',
        fen: '8/8/8/8/8/2k5/2p5/2K5 b - - 0 1',
        puzzleMoves: ['c2c1q'],
        rating: 1100,
        themes: ['promotion'],
        prompt: 'Твоя проходная пешка дошла до конца. Преврати её в ферзя и сразу объяви шах и мат.',
    },
    {
        id: 'fallback_6',
        fen: '4k3/8/8/3q4/8/3R4/8/4K3 w - - 0 1',
        puzzleMoves: ['d3d5'],
        rating: 1200,
        themes: ['capturingDefender'],
        prompt: 'Сильнейшая фигура соперника осталась без защиты. Найди способ забрать вражеского ферзя.',
    },
    {
        id: 'fallback_7',
        fen: 'r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 0 4',
        puzzleMoves: ['f7f8'],
        rating: 1300,
        themes: ['mateIn1'],
        prompt: 'Король черных остался без прикрытия фигур. Поставь быстрый мат ферзем в один ход.',
    },
    {
        id: 'fallback_8',
        fen: '5rk1/pp3ppp/2p5/8/3nN3/8/PPP2PPP/R3K2R w KQ - 0 15',
        puzzleMoves: ['e4f6'],
        rating: 1400,
        themes: ['fork'],
        prompt: 'Используй прыжок коня для двойного нападения на короля и ладью твоего соперника.',
    },
    {
        id: 'fallback_9',
        fen: '8/8/8/8/8/7k/6pQ/6K1 b - - 0 1',
        puzzleMoves: ['h3h2'],
        rating: 1000,
        themes: ['zugzwang'],
        prompt: 'Положение кажется безнадежным, но у тебя есть спасительный пат. Найди этот ход.',
    },
    {
        id: 'fallback_10',
        fen: '2r3k1/5ppp/8/8/8/8/5PPP/4R1K1 b - - 0 1',
        puzzleMoves: ['c8c1'],
        rating: 1500,
        themes: ['backRankMate'],
        prompt: 'Вражеский король заперт за своими пешками. Поставь мат на последней горизонтали.',
    },
];

// ─────────────────────────────────────────────
// Основной сервис
// ─────────────────────────────────────────────

export const lichessService = {
    /**
     * Получить 10 шахматных задач на день.
     * Данные кэшируются в AsyncStorage на весь день.
     */
    fetchDailyPuzzles: async (count: number = 10): Promise<ChessPuzzleTask[]> => {
        const today = getTodayString();

        try {
            // Проверяем кэш
            const [cachedDate, cachedPuzzles] = await AsyncStorage.multiGet([
                CACHE_KEY_DATE,
                CACHE_KEY_PUZZLES,
            ]);

            if (cachedDate[1] === today && cachedPuzzles[1]) {
                const parsed: ChessPuzzleTask[] = JSON.parse(cachedPuzzles[1]);
                if (parsed.length >= count) {
                    console.log('[Lichess] Using cached puzzles for today');
                    return parsed.slice(0, count);
                }
            }

            // Загружаем из API
            console.log('[Lichess] Fetching fresh puzzles from API...');
            const puzzles: ChessPuzzleTask[] = [];

            for (let i = 0; i < count; i++) {
                try {
                    const response = await fetch('https://lichess.org/api/puzzle/next', {
                        headers: {
                            Accept: 'application/json',
                        },
                    });

                    if (!response.ok) {
                        console.warn('[Lichess] API error:', response.status);
                        break;
                    }

                    const data = await response.json();
                    // Lichess /api/puzzle/next returns { puzzle: { id, fen, moves, rating, ... } }
                    const rawPuzzle: LichessPuzzle = {
                        id: data.puzzle?.id || `p_${i}`,
                        fen: data.puzzle?.fen || data.fen || '',
                        moves: (data.puzzle?.moves || data.moves || '').split(' ').filter(Boolean),
                        rating: data.puzzle?.rating || data.rating || 1200,
                        themes: data.puzzle?.themes || data.themes || [],
                    };

                    if (rawPuzzle.fen && rawPuzzle.moves.length > 0) {
                        puzzles.push(lichessToPuzzleTask(rawPuzzle));
                    }

                    // Небольшая пауза между запросами чтобы не перегружать API
                    if (i < count - 1) {
                        await new Promise(resolve => setTimeout(resolve, 150));
                    }
                } catch (fetchErr) {
                    console.warn('[Lichess] Fetch error for puzzle', i, fetchErr);
                }
            }

            if (puzzles.length >= 5) {
                // Кэшируем если получили хотя бы половину
                await AsyncStorage.multiSet([
                    [CACHE_KEY_DATE, today],
                    [CACHE_KEY_PUZZLES, JSON.stringify(puzzles)],
                ]);
                return puzzles.slice(0, count);
            }

            // Fallback: возвращаем захардкоженные задачи
            console.log('[Lichess] Using fallback puzzles (API unavailable)');
            return FALLBACK_PUZZLES.slice(0, count);

        } catch (err) {
            console.error('[Lichess] Fatal error:', err);
            return FALLBACK_PUZZLES.slice(0, count);
        }
    },

    /**
     * Получить количество использованных подсказок сегодня.
     */
    getHintsUsedToday: async (): Promise<number> => {
        const today = getTodayString();
        try {
            const raw = await AsyncStorage.getItem(CACHE_KEY_HINTS_USED);
            if (!raw) return 0;
            const { date, count } = JSON.parse(raw);
            return date === today ? count : 0;
        } catch {
            return 0;
        }
    },

    /**
     * Зафиксировать использование подсказки.
     */
    useHint: async (): Promise<void> => {
        const today = getTodayString();
        try {
            const current = await lichessService.getHintsUsedToday();
            await AsyncStorage.setItem(
                CACHE_KEY_HINTS_USED,
                JSON.stringify({ date: today, count: current + 1 })
            );
        } catch (err) {
            console.warn('[Lichess] Error saving hint use:', err);
        }
    },

    /**
     * Очистить кэш (для тестирования).
     */
    clearCache: async (): Promise<void> => {
        await AsyncStorage.multiRemove([CACHE_KEY_DATE, CACHE_KEY_PUZZLES, CACHE_KEY_HINTS_USED]);
    },
};

export default lichessService;
