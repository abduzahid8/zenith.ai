import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Square, Move } from 'chess.js';
import Chessboard from 'react-native-chessboard';
import type { ChessboardRef } from 'react-native-chessboard';
import { scale, SCREEN_WIDTH } from '../../constants';
import { fonts } from '../../theme';
import { useAppTheme } from '../../theme/useAppTheme';
import { useT } from '../../store/languageStore';
import lichessService from '../../services/lichessService';
import EncouragementBanner from './chess/EncouragementBanner';

interface ChessBoardProps {
    fen: string;
    puzzleMoves: string[]; // e.g. ["h1h7"]
    puzzles?: {
        fen: string;
        moves: string[];
        prompt: string;
        hints?: string[];
    }[];
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

    const activePuzzle = useMemo(() => {
        if (puzzles && puzzles.length > 0) {
            return puzzles[currentPuzzleIndex];
        }
        return { fen, moves: puzzleMoves, prompt: question, hints: [] };
    }, [puzzles, currentPuzzleIndex, fen, puzzleMoves, question]);

    // Game state
    const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
    const [incorrectMove, setIncorrectMove] = useState(false);
    const [solved, setSolved] = useState(false);
    const [puzzleResults, setPuzzleResults] = useState<('completed'|'skipped')[]>([]);
    const [skipCounts, setSkipCounts] = useState<Record<number, number>>({});
    const [banner, setBanner] = useState<{ visible: boolean; isCorrect: boolean }>({
        visible: false,
        isCorrect: true,
    });

    // Hints state
    const [hintsUsed, setHintsUsed] = useState(0);

    // Gesture enabled state
    const [gestureEnabled, setGestureEnabled] = useState(true);

    // Track the current FEN for our own chess.js instance
    const currentFenRef = useRef(activePuzzle.fen);
    const currentMoveIndexRef = useRef(0);
    const solvedRef = useRef(false);
    const lastProcessedTriggerRef = useRef(0);

    // Sync state if FEN changes from outside
    useEffect(() => {
        setCurrentPuzzleIndex(0);
        setPuzzleResults([]);
        setSkipCounts({});
    }, [fen]);

    // Sync state when active puzzle changes
    useEffect(() => {
        const activeFen = activePuzzle.fen;
        currentFenRef.current = activeFen;
        currentMoveIndexRef.current = 0;
        solvedRef.current = false;
        setCurrentMoveIndex(0);
        setIncorrectMove(false);
        setSolved(false);
        setHintsUsed(0);
        setGestureEnabled(true);
        setBanner({ visible: false, isCorrect: true });

        // Reset chessboard via ref
        if (chessboardRef.current) {
            chessboardRef.current.resetBoard(activeFen);
        }
    }, [activePuzzle]);

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

        const expectedMove = activePuzzle.moves[currentMoveIndexRef.current];
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
    }, [hintsUsed, maxHints, activePuzzle.moves, t]);

    const playOpponentMove = useCallback((nextIndex: number) => {
        // Check if there's an opponent move to auto-play
        if (nextIndex < activePuzzle.moves.length && nextIndex % 2 !== 0) {
            setGestureEnabled(false);
            const oppMove = activePuzzle.moves[nextIndex];
            const from = oppMove.substring(0, 2) as Square;
            const to = oppMove.substring(2, 4) as Square;

            setTimeout(async () => {
                // Animate the move on the board
                if (chessboardRef.current) {
                    await chessboardRef.current.move({ from, to });
                }

                const nextNext = nextIndex + 1;
                currentMoveIndexRef.current = nextNext;
                setCurrentMoveIndex(nextNext);

                if (nextNext >= activePuzzle.moves.length) {
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
                    setGestureEnabled(true);
                }
            }, 500);
        }
    }, [activePuzzle.moves, puzzles, currentPuzzleIndex, onComplete]);

    const handleMove = useCallback(({ move, state }: { move: Move; state: any }) => {
        if (solvedRef.current) return;

        // Build the UCI move string from the move object
        const uciMove = move.from + move.to + (move.promotion || '');

        const expectedMove = activePuzzle.moves[currentMoveIndexRef.current];
        if (!expectedMove) return;

        // Check if the move matches the expected puzzle move
        const isCorrect =
            uciMove === expectedMove ||
            uciMove === expectedMove.substring(0, 4); // Without promotion suffix

        if (isCorrect) {
            // Correct move!
            setIncorrectMove(false);
            currentFenRef.current = state.fen;

            if (chessboardRef.current) {
                chessboardRef.current.resetAllHighlightedSquares();
            }

            const nextIndex = currentMoveIndexRef.current + 1;
            currentMoveIndexRef.current = nextIndex;
            setCurrentMoveIndex(nextIndex);

            if (nextIndex >= activePuzzle.moves.length) {
                // Puzzle fully complete!
                solvedRef.current = true;
                setSolved(true);
                setPuzzleResults(prev => {
                    const next = [...prev];
                    next[currentPuzzleIndex] = 'completed';
                    return next;
                });
                setGestureEnabled(false);
                setBanner({ visible: true, isCorrect: true });
            } else {
                // Auto-play opponent's move if needed
                playOpponentMove(nextIndex);
            }
        } else {
            // Incorrect move — undo it
            setIncorrectMove(true);
            setGestureEnabled(false);
            setBanner({ visible: true, isCorrect: false });
            
            setTimeout(() => {
                if (chessboardRef.current) {
                    chessboardRef.current.resetBoard(currentFenRef.current);
                }
                setGestureEnabled(true);
                setTimeout(() => {
                    setBanner(prev => prev.isCorrect ? prev : { ...prev, visible: false });
                }, 1600);
            }, 400);
        }
    }, [activePuzzle.moves, playOpponentMove]);

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

                        if (isSkipped) {
                            return (
                                <TouchableOpacity
                                    key={idx}
                                    style={{ flex: 1 }}
                                    onPress={() => {
                                        setCurrentPuzzleIndex(idx);
                                    }}
                                    activeOpacity={0.7}
                                >
                                    {pillElement}
                                </TouchableOpacity>
                            );
                        }

                        return pillElement;
                    })}
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
                            ref={chessboardRef}
                            fen={activePuzzle.fen}
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

            {/* AI Bubble Question */}
            {activePuzzle.prompt && (
                <View style={styles.aiBubbleContainer}>
                    <View style={styles.aiBubble}>
                        <Ionicons
                            name="information-circle"
                            size={scale(22)}
                            color="#5BA3E6"
                            style={styles.aiBubbleIcon}
                        />
                        <Text style={styles.aiBubbleText}>{activePuzzle.prompt}</Text>
                    </View>
                </View>
            )}

            {/* Error / Success feedback */}
            {incorrectMove && !solved && (
                <Text style={styles.errorText}>
                    {t('Неверный ход. Попробуй ещё раз!')}
                </Text>
            )}



            <EncouragementBanner
                visible={banner.visible}
                isCorrect={banner.isCorrect}
                onNext={handleNextPuzzle}
                hideButton={!banner.isCorrect}
                buttonText={puzzles && currentPuzzleIndex < puzzles.length - 1 ? t('Следующая задача') : (isLastStep ? t('Завершить') : t('Далее'))}
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
            marginBottom: scale(24),
        },
        pillsContainer: {
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            gap: scale(6),
            marginBottom: scale(24),
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
            backgroundColor: '#8E8E93',
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
            flexDirection: 'row',
            marginTop: scale(24),
            paddingHorizontal: scale(20),
            width: '100%',
            alignItems: 'flex-start',
        },
        aiBubble: {
            flex: 1,
            backgroundColor: '#F0F7FF',
            borderRadius: scale(16),
            padding: scale(14),
            flexDirection: 'row',
            alignItems: 'center',
            borderLeftWidth: 4,
            borderLeftColor: '#5BA3E6',
            shadowColor: '#5BA3E6',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 4,
            elevation: 1,
        },
        aiBubbleIcon: {
            marginRight: scale(18),
        },
        aiBubbleText: {
            fontFamily: fonts.body.regular,
            fontSize: scale(14),
            lineHeight: scale(20),
            color: colors.text || '#08132A',
            flex: 1,
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
