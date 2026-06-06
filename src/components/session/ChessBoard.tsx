import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
    Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Chess } from 'chess.js';
import type { Square, Move } from 'chess.js';
import Chessboard from 'react-native-chessboard';
import type { ChessboardRef } from 'react-native-chessboard';
import { scale, SCREEN_WIDTH } from '../../constants';
import { fonts } from '../../theme';
import { useAppTheme } from '../../theme/useAppTheme';
import { useT } from '../../store/languageStore';
import lichessService from '../../services/lichessService';
import EncouragementBanner from './chess/EncouragementBanner';
import type { ChessPuzzle } from '../../data/chessPuzzlesBank';

// --- ChessPuzzle V2 Helper Functions ---
const getExpectedUserMove = (activePuzzle: any, stepIndex: number): string | null => {
    if (activePuzzle.solution && activePuzzle.solution.length > 0) {
        return activePuzzle.solution[stepIndex]?.userMove || null;
    }
    return activePuzzle.moves ? activePuzzle.moves[stepIndex] || null : null;
};

const getOpponentMove = (activePuzzle: any, stepIndex: number): string | null => {
    if (activePuzzle.solution && activePuzzle.solution.length > 0) {
        return activePuzzle.solution[stepIndex]?.opponentMove || null;
    }
    if (activePuzzle.moves) {
        const nextIndex = stepIndex + 1;
        if (nextIndex < activePuzzle.moves.length && nextIndex % 2 !== 0) {
            return activePuzzle.moves[nextIndex];
        }
    }
    return null;
};

const getMoveExplanation = (activePuzzle: any, stepIndex: number): string | null => {
    if (activePuzzle.solution && activePuzzle.solution.length > 0) {
        return activePuzzle.solution[stepIndex]?.explanation || null;
    }
    return null;
};

const getTotalUserSteps = (activePuzzle: any): number => {
    if (activePuzzle.solution && activePuzzle.solution.length > 0) {
        return activePuzzle.solution.length;
    }
    return activePuzzle.moves ? activePuzzle.moves.length : 0;
};

interface ChessBoardProps {
    fen: string;
    puzzleMoves: string[]; // e.g. ["h1h7"]
    puzzles?: ChessPuzzle[];
    question?: string;
    maxHints: number;
    onComplete: () => void;
    isLastStep?: boolean;
    skipTrigger?: number;
}

export const ChessBoard: React.FC<ChessBoardProps> = ({
    fen,
    puzzleMoves,
    puzzles,
    question,
    maxHints,
    onComplete,
    isLastStep = true,
    skipTrigger = 0,
}) => {
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const t = useT();

    const chessboardRef = useRef<ChessboardRef>(null);



    // Multi-puzzle and Active puzzle states
    const [currentPuzzleIndex, setCurrentPuzzleIndex] = useState(0);
    const [prevPuzzleIndex, setPrevPuzzleIndex] = useState(0);

    const activePuzzle = useMemo((): ChessPuzzle => {
        if (puzzles && puzzles.length > 0) {
            return puzzles[currentPuzzleIndex];
        }
        return { fen, moves: puzzleMoves, prompt: question || '', hints: [] };
    }, [puzzles, currentPuzzleIndex, fen, puzzleMoves, question]);

    // Game state
    const [currentFen, setCurrentFen] = useState(activePuzzle.fen);
    const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
    const [incorrectMove, setIncorrectMove] = useState(false);
    const [solved, setSolved] = useState(false);
    const [puzzleResults, setPuzzleResults] = useState<('completed'|'skipped')[]>([]);
    const [skipCounts, setSkipCounts] = useState<Record<number, number>>({});
    const [banner, setBanner] = useState<{ visible: boolean; isCorrect: boolean; feedback?: string }>({
        visible: false,
        isCorrect: true,
        feedback: undefined,
    });

    // Tracking attempts for each puzzle (max 2)
    const [puzzleAttempts, setPuzzleAttempts] = useState<Record<number, number>>({});

    // Hints state
    const [hintsUsed, setHintsUsed] = useState(0);

    // Gesture enabled state
    const [gestureEnabled, setGestureEnabled] = useState(true);

    // Track the current FEN and chess.js state
    const [resetCounter, setResetCounter] = useState(0);
    const chessRef = useRef<Chess | null>(null);
    if (!chessRef.current) {
        chessRef.current = new Chess(activePuzzle.fen);
    }
    const currentFenRef = useRef(activePuzzle.fen);
    const currentMoveIndexRef = useRef(0);
    const solvedRef = useRef(false);
    const lastProcessedTriggerRef = useRef(0);
    const isOpponentMovingRef = useRef(false);

    // Sync state during render when puzzle index changes (official React pattern)
    if (currentPuzzleIndex !== prevPuzzleIndex) {
        setPrevPuzzleIndex(currentPuzzleIndex);
        const activeFen = activePuzzle.fen;
        chessRef.current = new Chess(activeFen);
        currentFenRef.current = activeFen;
        setCurrentFen(activeFen);
        currentMoveIndexRef.current = 0;
        solvedRef.current = false;
        setCurrentMoveIndex(0);
        setIncorrectMove(false);
        setSolved(false);
        setGestureEnabled(true);
        setBanner({ visible: false, isCorrect: true });
    }

    // Sync state if FEN changes from outside (completely new lesson)
    useEffect(() => {
        setCurrentPuzzleIndex(0);
        setPrevPuzzleIndex(0);
        setPuzzleResults([]);
        setSkipCounts({});
        setHintsUsed(0);
        setPuzzleAttempts({});
    }, [fen]);

    const handleSkipPuzzle = useCallback(() => {
        setBanner({ visible: false, isCorrect: true });
        setPuzzleResults(prev => {
            const next = [...prev];
            next[currentPuzzleIndex] = 'skipped';
            return next;
        });

        const newSkipCounts = {
            ...skipCounts,
            [currentPuzzleIndex]: (skipCounts[currentPuzzleIndex] || 0) + 1
        };
        setSkipCounts(newSkipCounts);

        let nextIndex = currentPuzzleIndex + 1;
        while (puzzles && nextIndex < puzzles.length && (puzzleResults[nextIndex] === 'completed' || puzzleResults[nextIndex] === 'skipped')) {
            nextIndex++;
        }

        if (puzzles && nextIndex < puzzles.length) {
            setCurrentPuzzleIndex(nextIndex);
        } else {
            const firstSkipped = puzzles ? puzzles.findIndex((_, idx) => {
                const isCurrentlySkipped = idx === currentPuzzleIndex ? true : (puzzleResults[idx] === 'skipped');
                const count = newSkipCounts[idx] || 0;
                return isCurrentlySkipped && count < 2;
            }) : -1;

            if (firstSkipped !== -1) {
                setCurrentPuzzleIndex(firstSkipped);
            } else {
                onComplete();
            }
        }
    }, [puzzles, currentPuzzleIndex, puzzleResults, skipCounts, onComplete]);

    // Handle external skip trigger
    useEffect(() => {
        if (skipTrigger > 0 && skipTrigger > lastProcessedTriggerRef.current) {
            lastProcessedTriggerRef.current = skipTrigger;
            handleSkipPuzzle();
        }
    }, [skipTrigger, handleSkipPuzzle]);

    const handleHint = useCallback(async () => {
        if (hintsUsed >= maxHints) {
            Alert.alert(t('Подсказки закончились'), t('Ты исчерпал лимит подсказок для этой сессии.'));
            return;
        }

        const expectedMove = getExpectedUserMove(activePuzzle, currentMoveIndexRef.current);
        if (!expectedMove) return;

        // Show where to move from (first 2 characters)
        const fromSquare = expectedMove.substring(0, 2) as Square;
        setHintsUsed(prev => prev + 1);

        // Highlight the hint square on the board
        if (chessboardRef.current) {
            chessboardRef.current.resetAllHighlightedSquares();
            chessboardRef.current.highlight({
                square: fromSquare,
                color: 'rgba(255, 249, 196, 0.8)',
            });
        }

        // Track hint usage
        lichessService.useHint();
    }, [hintsUsed, maxHints, activePuzzle, t]);

    const playOpponentMove = useCallback((currentStepIndex: number) => {
        const oppMove = getOpponentMove(activePuzzle, currentStepIndex);
        if (oppMove) {
            isOpponentMovingRef.current = true;
            setGestureEnabled(false);
            const from = oppMove.substring(0, 2) as Square;
            const to = oppMove.substring(2, 4) as Square;

            setTimeout(async () => {
                const localChess = chessRef.current;
                if (localChess) {
                    try {
                        localChess.move({ from, to });
                    } catch (e) {
                        console.warn('[ChessBoard] Opponent move illegal in chess.js:', oppMove);
                    }
                    const newFen = localChess.fen();
                    currentFenRef.current = newFen;
                    setCurrentFen(newFen);
                }

                // Animate the move on the board
                if (chessboardRef.current) {
                    await chessboardRef.current.move({ from, to });
                }

                const hasSolution = activePuzzle.solution && activePuzzle.solution.length > 0;
                const nextStepIndex = hasSolution ? currentStepIndex + 1 : currentStepIndex + 2;

                currentMoveIndexRef.current = nextStepIndex;
                setCurrentMoveIndex(nextStepIndex);

                const totalSteps = getTotalUserSteps(activePuzzle);
                if (nextStepIndex >= totalSteps) {
                    solvedRef.current = true;
                    setSolved(true);
                    setPuzzleResults(prev => {
                        const next = [...prev];
                        next[currentPuzzleIndex] = 'completed';
                        return next;
                    });
                    setGestureEnabled(false);
                    setTimeout(() => {
                        let nextIndex = currentPuzzleIndex + 1;
                        while (puzzles && nextIndex < puzzles.length && (puzzleResults[nextIndex] === 'completed' || puzzleResults[nextIndex] === 'skipped')) {
                            nextIndex++;
                        }
                        if (puzzles && nextIndex < puzzles.length) {
                            setCurrentPuzzleIndex(nextIndex);
                        } else {
                            const firstSkipped = puzzles ? puzzles.findIndex((_, idx) => {
                                const result = puzzleResults[idx];
                                const count = skipCounts[idx] || 0;
                                return result === 'skipped' && count < 2;
                            }) : -1;

                            if (firstSkipped !== -1) {
                                setCurrentPuzzleIndex(firstSkipped);
                            } else {
                                onComplete();
                            }
                        }
                    }, 800);
                } else {
                    setTimeout(() => {
                        isOpponentMovingRef.current = false;
                        setGestureEnabled(true);
                    }, 100);
                }
            }, 500);
        }
    }, [activePuzzle, puzzles, currentPuzzleIndex, onComplete]);

    const handleMove = useCallback(({ move, state }: { move: Move; state: any }) => {
        if (solvedRef.current || !gestureEnabled || isOpponentMovingRef.current) return;

        // Build the UCI move string from the move object
        const uciMove = move.from + move.to + (move.promotion || '');

        const localChess = chessRef.current;
        if (!localChess) return;

        const currentStepIndex = currentMoveIndexRef.current;
        const expectedMoveTemp = getExpectedUserMove(activePuzzle, currentStepIndex);

        // 1. Проверяем ход через наш chess.js на легальность в шахматах
        let isMoveLegal = false;
        let playedMove: any = null;
        try {
            playedMove = localChess.move({
                from: move.from,
                to: move.to,
                promotion: move.promotion || undefined
            });
            if (playedMove) {
                isMoveLegal = true;
            }
        } catch (e) {
            isMoveLegal = false;
        }

        // 3. Если ход нелегален:
        if (!isMoveLegal) {
            setIncorrectMove(true);
            setGestureEnabled(false);
            
            setTimeout(() => {
                // Принудительно возвращаем доску на исходный FEN
                setResetCounter(prev => prev + 1);
                setGestureEnabled(true);
            }, 200);
            return;
        }

        // 4. Если ход легален, проверяем правильность для задачи
        const expectedMove = expectedMoveTemp;
        if (!expectedMove) {
            localChess.undo();
            return;
        }

        // Check if the move matches the expected puzzle move
        const isCorrect =
            uciMove === expectedMove ||
            uciMove === expectedMove.substring(0, 4); // Without promotion suffix

        const isCastling = move.flags.includes('k') || move.flags.includes('q');
        console.log('[ChessBoard Castling Debug Log]', {
            expectedMove,
            actualMove: uciMove,
            currentStep: currentStepIndex,
            isCastling,
            san: move.san,
            from: move.from,
            to: move.to
        });

        const isUsingSolution = !!(activePuzzle.solution && activePuzzle.solution.length > 0);
        console.log('[ChessBoard handleMove Debug]', {
            isUsingSolution,
            userMove: uciMove,
            expectedMove,
            isCorrect,
            feedbackBefore: incorrectMove ? 'failure' : 'success/none',
            activeCodePath: isUsingSolution ? 'V2 solution' : 'V1 moves',
            currentStep: currentStepIndex
        });

        const hasSolution = activePuzzle.solution && activePuzzle.solution.length > 0;
        const oppMove = getOpponentMove(activePuzzle, currentStepIndex);

        if (isCorrect) {
            // Correct move!
            setIncorrectMove(false);
            const newFen = localChess.fen();
            currentFenRef.current = newFen;
            setCurrentFen(newFen);

            if (chessboardRef.current) {
                chessboardRef.current.resetAllHighlightedSquares();
            }

            const explanation = getMoveExplanation(activePuzzle, currentStepIndex) || activePuzzle.successExplanation;

            if (oppMove) {
                // Auto-play opponent's move if needed (plays and handles transition/solved internally)
                playOpponentMove(currentStepIndex);
            } else {
                const nextStepIndex = currentStepIndex + 1;
                currentMoveIndexRef.current = nextStepIndex;
                setCurrentMoveIndex(nextStepIndex);

                const totalSteps = getTotalUserSteps(activePuzzle);
                if (nextStepIndex >= totalSteps) {
                    // Puzzle fully complete!
                    solvedRef.current = true;
                    setSolved(true);
                    setPuzzleResults(prev => {
                        const next = [...prev];
                        next[currentPuzzleIndex] = 'completed';
                        return next;
                    });
                    setGestureEnabled(false);
                    setBanner({ visible: true, isCorrect: true, feedback: undefined });
                } else {
                    setGestureEnabled(true);
                }
            }
        } else {
            const stepBefore = currentMoveIndexRef.current;
            const expectedBefore = getExpectedUserMove(activePuzzle, stepBefore);
            const fenBefore = localChess.fen();

            // Incorrect move (legal but incorrect) — undo in chess.js
            localChess.undo();
            
            const revertedFen = localChess.fen();
            currentFenRef.current = revertedFen;
            setCurrentFen(revertedFen);

            console.log('[ChessBoard Rollback Debug]', {
                currentStepBefore: stepBefore,
                expectedMove: expectedBefore,
                userMove: uciMove,
                fenBeforeAttempt: fenBefore,
                fenAfterRollback: revertedFen,
                currentStepAfter: currentMoveIndexRef.current,
                nextExpectedMove: getExpectedUserMove(activePuzzle, currentMoveIndexRef.current)
            });
            setIncorrectMove(true);
            setGestureEnabled(false);
            
            const currentAttempts = (puzzleAttempts[currentPuzzleIndex] || 0) + 1;
            setPuzzleAttempts(prev => ({
                ...prev,
                [currentPuzzleIndex]: currentAttempts
            }));

            const explanation = activePuzzle.failureExplanation;

            if (currentAttempts >= 2) {
                // Вторая попытка неверная -> задача считается пропущенной/неверной
                const newResults = [...puzzleResults];
                newResults[currentPuzzleIndex] = 'skipped';
                setPuzzleResults(newResults);
                
                // Переходим к следующей задаче мгновенно
                setBanner(prev => ({ ...prev, visible: false }));
                setResetCounter(prev => prev + 1);
                setGestureEnabled(true);
                
                let nextIndex = currentPuzzleIndex + 1;
                while (puzzles && nextIndex < puzzles.length && (newResults[nextIndex] === 'completed' || newResults[nextIndex] === 'skipped')) {
                    nextIndex++;
                }

                if (puzzles && nextIndex < puzzles.length) {
                    setCurrentPuzzleIndex(nextIndex);
                } else {
                    const firstSkipped = puzzles ? puzzles.findIndex((_, idx) => {
                        const result = newResults[idx];
                        const count = skipCounts[idx] || 0;
                        return result === 'skipped' && count < 2;
                    }) : -1;

                    if (firstSkipped !== -1) {
                        setCurrentPuzzleIndex(firstSkipped);
                    } else {
                        onComplete();
                    }
                }
            } else {
                setBanner({ visible: true, isCorrect: false, feedback: explanation || undefined });
                
                setTimeout(() => {
                    // Восстанавливаем визуальную доску с актуальным FEN из chess.js
                    setResetCounter(prev => prev + 1);
                    setGestureEnabled(true);
                    setTimeout(() => {
                        setBanner(prev => prev.isCorrect ? prev : { ...prev, visible: false, feedback: undefined });
                    }, 1600);
                }, 400);
            }
        }
    }, [activePuzzle, playOpponentMove, currentPuzzleIndex, puzzleAttempts, t, puzzles, puzzleResults, skipCounts, onComplete]);

    const handleNextPuzzle = useCallback(() => {
        setBanner(prev => ({ ...prev, visible: false }));
        
        let nextIndex = currentPuzzleIndex + 1;
        while (puzzles && nextIndex < puzzles.length && (puzzleResults[nextIndex] === 'completed' || puzzleResults[nextIndex] === 'skipped')) {
            nextIndex++;
        }

        if (puzzles && nextIndex < puzzles.length) {
            setCurrentPuzzleIndex(nextIndex);
        } else {
            const firstSkipped = puzzles ? puzzles.findIndex((_, idx) => {
                const result = puzzleResults[idx];
                const count = skipCounts[idx] || 0;
                return result === 'skipped' && count < 2;
            }) : -1;

            if (firstSkipped !== -1) {
                setCurrentPuzzleIndex(firstSkipped);
            } else {
                onComplete();
            }
        }
    }, [puzzles, currentPuzzleIndex, puzzleResults, skipCounts, onComplete]);

    // Calculate dimensions dynamically
    const boardSize = Math.floor((SCREEN_WIDTH - scale(40)) / 8) * 8;
    const remainingHints = Math.max(0, maxHints - hintsUsed);

    // Determine board colors based on theme
    const g = colors.gamification || {};
    const boardColors = useMemo(() => ({
        black: g.boardDark || '#87BFEA',
        white: g.boardLight || '#E8F4FD',
        lastMoveHighlight: 'rgba(91, 163, 230, 0.4)',
        checkmateHighlight: '#FF6B6B',
        promotionPieceButton: '#5BA3E6',
    }), [g.boardDark, g.boardLight]);

    const isBlackActive = useMemo(() => {
        if (!activePuzzle?.fen) return false;
        const parts = activePuzzle.fen.split(' ');
        return parts[1] === 'b';
    }, [activePuzzle?.fen]);

    const letters = isBlackActive
        ? ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a']
        : ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const numbers = isBlackActive
        ? ['1', '2', '3', '4', '5', '6', '7', '8']
        : ['8', '7', '6', '5', '4', '3', '2', '1'];

    return (
        <View style={styles.container}>
            {/* Header: Hints */}
            <View style={styles.header}>
                <Text style={styles.promptText}>
                    {solved ? t('Верно!') : t('Ход за тобой!')}
                </Text>
                <TouchableOpacity
                    style={[styles.hintBtn, (remainingHints === 0 || solved) && styles.hintBtnDisabled]}
                    onPress={handleHint}
                    activeOpacity={0.7}
                    disabled={remainingHints === 0 || solved}
                >
                    <Ionicons name="bulb" style={styles.hintIcon as any} />
                    <Text style={styles.hintText}>{remainingHints}</Text>
                </TouchableOpacity>
            </View>

            {/* Segmented Progress Bar */}
            {puzzles && puzzles.length > 1 && (
                <View style={styles.pillsContainer}>
                    {puzzles.map((_, idx) => {
                        const result = puzzleResults[idx];
                        const isCompleted = result === 'completed';
                        const isSkipped = result === 'skipped';
                        const isActive = idx === currentPuzzleIndex;
                        const pillElement = (
                            <View
                                key={idx}
                                style={[
                                    styles.pill,
                                    isCompleted && styles.pillCompleted,
                                    isSkipped && styles.pillSkipped,
                                    isActive && styles.pillActive,
                                ]}
                            />
                        );



                        return pillElement;
                    })}
                </View>
            )}

            {/* AI Bubble Question */}
            {activePuzzle.prompt && (
                <View style={styles.aiBubbleContainer}>
                    {/* Speech Bubble */}
                    <View style={styles.aiBubble}>
                        <View style={styles.aiBubbleHeader}>
                            <Ionicons name="sparkles" size={scale(16)} color="#389FFF" style={styles.aiBubbleHeaderIcon} />
                            <Text style={styles.aiBubbleHeaderLabel}>Совет от ИИ</Text>
                        </View>
                        <Text style={styles.aiBubbleText} numberOfLines={2} ellipsizeMode="tail">{activePuzzle.prompt}</Text>
                    </View>
                </View>
            )}

            {/* Chess Board */}
            <View style={styles.boardWithCoords}>
                <View style={[styles.numbersColumn, { height: boardSize }]}>
                    {numbers.map(n => <Text key={n} style={styles.coordText}>{n}</Text>)}
                </View>
                <View>
                    <View style={[styles.boardWrapper, { width: boardSize, height: boardSize }]}>
                        <Chessboard
                            key={`${currentPuzzleIndex}-${resetCounter}`}
                            ref={chessboardRef}
                            fen={currentFen}
                            boardSize={boardSize}
                            gestureEnabled={gestureEnabled && !solved}
                            onMove={handleMove}
                            colors={boardColors}
                            withLetters={false}
                            withNumbers={false}
                            boardOrientation={isBlackActive ? 'black' : 'white'}
                        />
                    </View>
                    <View style={[styles.lettersRow, { width: boardSize }]}>
                        {letters.map(l => <Text key={l} style={styles.coordText}>{l}</Text>)}
                    </View>
                </View>
            </View>





            <EncouragementBanner
                visible={banner.visible}
                isCorrect={banner.isCorrect}
                feedback={banner.feedback}
                onNext={handleNextPuzzle}
                hideButton={!banner.isCorrect}
                buttonText={puzzles && currentPuzzleIndex < puzzles.length - 1 ? t('Дальше') : (isLastStep ? t('Завершить') : t('Далее'))}
            />
        </View>
    );
};

const createStyles = (colors: any) => {
    const g = colors.gamification || {};
    return StyleSheet.create({
        container: {
            flex: 1,
            alignItems: 'center',
            paddingTop: scale(20),
            width: '100%',
        },
        header: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: SCREEN_WIDTH - scale(40),
            marginBottom: scale(16),
        },
        pillsContainer: {
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            gap: scale(6),
            marginBottom: scale(20),
            width: SCREEN_WIDTH - scale(40),
        },
        pill: {
            height: scale(6),
            flex: 1,
            borderRadius: scale(3),
            backgroundColor: 'rgba(100, 116, 139, 0.15)',
        },
        pillCompleted: {
            backgroundColor: '#34C759',
        },
        pillSkipped: {
            backgroundColor: '#FF3B30',
        },
        pillActive: {
            backgroundColor: '#5BA3E6',
        },
        promptText: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(24),
            color: colors.text || '#08132A',
        },
        hintBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: g.theoryCard || '#D6EEFF',
            paddingHorizontal: scale(12),
            paddingVertical: scale(6),
            borderRadius: scale(16),
            borderWidth: 1,
            borderColor: g.theoryCardBorder || '#B8D8F0',
        },
        hintBtnDisabled: {
            opacity: 0.5,
        },
        hintIcon: {
            fontSize: scale(16),
            color: colors.text || '#08132A',
            marginRight: scale(4),
        },
        hintText: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(14),
            color: colors.text || '#08132A',
        },
        boardWrapper: {
            borderRadius: scale(8),
            overflow: 'hidden',
            elevation: 4,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.15,
            shadowRadius: 6,
        },
        aiBubbleContainer: {
            marginTop: scale(14),
            marginBottom: scale(22),
            paddingHorizontal: scale(16),
            width: '100%',
        },
        aiBubble: {
            backgroundColor: '#FFFFFF',
            borderRadius: scale(20),
            paddingVertical: scale(14),
            paddingHorizontal: scale(12),
        },
        aiBubbleHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: scale(6),
            marginBottom: scale(3),
        },
        aiBubbleHeaderIcon: {
            // Gap takes care of spacing
        },
        aiBubbleHeaderLabel: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(14),
            color: '#389FFF',
        },
        aiBubbleText: {
            fontFamily: fonts.body.regular,
            fontSize: scale(13.5),
            lineHeight: scale(19),
            color: '#1A253C',
            height: scale(38), // Enforce exactly 2 lines height to prevent layout shifts
        },
        errorText: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(14),
            color: g.optionIncorrect || '#F87171',
            marginTop: scale(16),
        },
        successText: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(14),
            color: '#34C759',
            marginTop: scale(16),
        },
        boardWithCoords: {
            flexDirection: 'row',
            alignItems: 'flex-start',
        },
        numbersColumn: {
            justifyContent: 'space-around',
            alignItems: 'center',
            paddingRight: scale(6),
        },
        lettersRow: {
            flexDirection: 'row',
            justifyContent: 'space-around',
            alignItems: 'center',
            paddingTop: scale(6),
        },
        coordText: {
            fontFamily: fonts.body.regular,
            fontSize: scale(10),
            color: colors.text || '#08132A',
            opacity: 0.6,
        },
        solvedContainer: {
            width: SCREEN_WIDTH - scale(40),
            alignItems: 'center',
            marginTop: scale(80),
        },
    });
};

export default ChessBoard;
