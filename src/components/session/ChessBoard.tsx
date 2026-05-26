import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
} from 'react-native';
import { scale, SCREEN_WIDTH } from '../../constants';
import { fonts } from '../../theme';
import { useAppTheme } from '../../theme/useAppTheme';
import { useT } from '../../store/languageStore';
import lichessService from '../../services/lichessService';

interface ChessBoardProps {
    fen: string;
    puzzleMoves: string[]; // e.g. ["h1h7"]
    question?: string;
    maxHints: number;
    onComplete: () => void;
}

const PIECE_UNICODE: Record<string, string> = {
    'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
    'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟',
};

// Convert square coords (row, col) to UCI name (e.g. 0,0 is a8, 7,7 is h1)
function getSquareName(row: number, col: number): string {
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
    return files[col] + ranks[row];
}

// Parse UCI name to square coords
function parseSquareName(name: string): [number, number] {
    const file = name.charCodeAt(0) - 97; // 'a' is 97
    const rank = 8 - parseInt(name[1], 10);
    return [rank, file];
}

// Parse FEN into 8x8 string grid
function parseFen(fen: string): string[][] {
    const grid: string[][] = Array(8).fill(null).map(() => Array(8).fill(''));
    const parts = fen.trim().split(/\s+/);
    const rows = parts[0].split('/');

    for (let r = 0; r < 8; r++) {
        const rowStr = rows[r];
        let c = 0;
        for (let i = 0; i < rowStr.length; i++) {
            const char = rowStr[i];
            if (/[1-8]/.test(char)) {
                c += parseInt(char, 10);
            } else {
                grid[r][c] = char;
                c++;
            }
        }
    }
    return grid;
}

export const ChessBoard: React.FC<ChessBoardProps> = ({
    fen,
    puzzleMoves,
    question,
    maxHints,
    onComplete,
}) => {
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const t = useT();

    // Game state
    const [board, setBoard] = useState<string[][]>(() => parseFen(fen));
    const [selectedSquare, setSelectedSquare] = useState<[number, number] | null>(null);
    const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
    const [incorrectSquare, setIncorrectSquare] = useState<string | null>(null);
    
    // Hints state
    const [hintsUsed, setHintsUsed] = useState(0);
    const [hintSquare, setHintSquare] = useState<string | null>(null);

    // Sync state if FEN changes
    useEffect(() => {
        setBoard(parseFen(fen));
        setSelectedSquare(null);
        setCurrentMoveIndex(0);
        setIncorrectSquare(null);
        setHintSquare(null);
    }, [fen]);

    const handleHint = async () => {
        if (hintsUsed >= maxHints) {
            Alert.alert(t('Подсказки закончились'), t('Ты исчерпал лимит подсказок для этой сессии.'));
            return;
        }

        const expectedMove = puzzleMoves[currentMoveIndex];
        if (!expectedMove) return;

        // Показывать откуда ходить (первые 2 символа)
        const fromSquare = expectedMove.substring(0, 2);
        setHintSquare(fromSquare);
        setHintsUsed(prev => prev + 1);
        
        // Track hint usage silently
        lichessService.useHint();
    };

    const handleSquarePress = (row: number, col: number) => {
        const squareName = getSquareName(row, col);

        // Сбросить подсказку если она показана для этой клетки
        if (hintSquare === squareName) {
            setHintSquare(null);
        }

        // If no square is selected, select the tapped square if it has a piece
        if (!selectedSquare) {
            if (board[row][col] !== '') {
                setSelectedSquare([row, col]);
                setIncorrectSquare(null);
            }
            return;
        }

        // If same square tapped, deselect
        if (selectedSquare[0] === row && selectedSquare[1] === col) {
            setSelectedSquare(null);
            return;
        }

        // Make move
        const fromSquare = selectedSquare;
        const fromName = getSquareName(fromSquare[0], fromSquare[1]);
        const toName = squareName;
        let uciMove = fromName + toName;
        
        // Auto-promote to Queen for simplicity if it reaches the end
        const piece = board[fromSquare[0]][fromSquare[1]];
        if (piece === 'P' && row === 0) uciMove += 'q';
        if (piece === 'p' && row === 7) uciMove += 'q';

        const expectedMove = puzzleMoves[currentMoveIndex];

        if (uciMove === expectedMove || uciMove === expectedMove.substring(0, 4)) {
            // Correct move! Update board
            const newBoard = board.map(r => [...r]);
            newBoard[fromSquare[0]][fromSquare[1]] = '';
            
            // Handle promotion visual
            if (uciMove.length === 5) {
                const isWhite = piece === piece.toUpperCase();
                newBoard[row][col] = isWhite ? 'Q' : 'q';
            } else {
                newBoard[row][col] = piece;
            }

            setBoard(newBoard);
            setSelectedSquare(null);
            setIncorrectSquare(null);
            setHintSquare(null);

            const nextIndex = currentMoveIndex + 1;
            if (nextIndex >= puzzleMoves.length) {
                // Puzzle fully complete!
                setTimeout(() => {
                    onComplete();
                }, 800);
            } else {
                setCurrentMoveIndex(nextIndex);
                
                // If it's opponent's turn in puzzle, auto-play it after a delay
                if (nextIndex % 2 !== 0 && puzzleMoves[nextIndex]) {
                    setTimeout(() => {
                        const oppMove = puzzleMoves[nextIndex];
                        const oppFrom = parseSquareName(oppMove.substring(0, 2));
                        const oppTo = parseSquareName(oppMove.substring(2, 4));
                        
                        setBoard(prevBoard => {
                            const b = prevBoard.map(r => [...r]);
                            const oppPiece = b[oppFrom[0]][oppFrom[1]];
                            b[oppFrom[0]][oppFrom[1]] = '';
                            b[oppTo[0]][oppTo[1]] = oppMove.length === 5 ? 
                                (oppPiece === oppPiece.toUpperCase() ? 'Q' : 'q') : oppPiece;
                            return b;
                        });
                        
                        setCurrentMoveIndex(nextIndex + 1);
                        if (nextIndex + 1 >= puzzleMoves.length) {
                            setTimeout(() => onComplete(), 800);
                        }
                    }, 500);
                }
            }
        } else {
            // Incorrect move!
            console.log('[ChessBoard] Incorrect move:', uciMove, 'Expected:', expectedMove);
            setIncorrectSquare(toName);
            setSelectedSquare(null);
        }
    };

    const boardSize = SCREEN_WIDTH - scale(40);
    const cellSize = boardSize / 8;
    const remainingHints = Math.max(0, maxHints - hintsUsed);

    return (
        <View style={styles.container}>
            {/* Header: Hints */}
            <View style={styles.header}>
                <Text style={styles.promptText}>
                    {t('Ход за тобой!')}
                </Text>
                <TouchableOpacity 
                    style={[styles.hintBtn, remainingHints === 0 && styles.hintBtnDisabled]} 
                    onPress={handleHint}
                    activeOpacity={0.7}
                    disabled={remainingHints === 0}
                >
                    <Text style={styles.hintIcon}>💡</Text>
                    <Text style={styles.hintText}>{remainingHints}</Text>
                </TouchableOpacity>
            </View>

            <View style={[styles.board, { width: boardSize, height: boardSize }]}>
                {board.map((row, rIdx) => (
                    <View key={rIdx} style={styles.row}>
                        {row.map((piece, cIdx) => {
                            const isDark = (rIdx + cIdx) % 2 === 1;
                            const isSelected = selectedSquare && selectedSquare[0] === rIdx && selectedSquare[1] === cIdx;
                            const squareName = getSquareName(rIdx, cIdx);
                            const isIncorrect = incorrectSquare === squareName;
                            const isHinted = hintSquare === squareName;

                            let bg = isDark ? colors.gamification?.boardDark || '#5BA3E6' : colors.gamification?.boardLight || '#D6EEFF';
                            if (isSelected) {
                                bg = colors.gamification?.boardSelected || '#FFE082'; // Gold
                            } else if (isHinted) {
                                bg = colors.gamification?.boardHint || '#FFF9C4'; // Light yellow
                            } else if (isIncorrect) {
                                bg = colors.gamification?.boardIncorrect || '#FFCDD2'; // Red flash
                            }

                            return (
                                <TouchableOpacity
                                    key={cIdx}
                                    style={[styles.cell, { width: cellSize, height: cellSize, backgroundColor: bg }]}
                                    onPress={() => handleSquarePress(rIdx, cIdx)}
                                    activeOpacity={0.9}
                                >
                                    {piece !== '' && (
                                        <Text style={[
                                            styles.piece,
                                            {
                                                fontSize: scale(36),
                                                color: piece === piece.toUpperCase() ? '#1A1A1A' : '#000000', 
                                            }
                                        ]}>
                                            {PIECE_UNICODE[piece] || piece}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                ))}
            </View>

            {/* AI Bubble Question */}
            {question && (
                <View style={styles.aiBubbleContainer}>
                    <View style={styles.aiAvatar}>
                        <Text style={styles.aiAvatarIcon}>✦</Text>
                    </View>
                    <View style={styles.aiBubble}>
                        <Text style={styles.aiBubbleText}>{question}</Text>
                    </View>
                </View>
            )}

            {incorrectSquare && (
                <Text style={styles.errorText}>
                    ❌ {t('Неверный ход. Попробуй ещё раз!')}
                </Text>
            )}
        </View>
    );
};

const createStyles = (colors: any) => {
    const g = colors.gamification || {};
    return StyleSheet.create({
        container: {
            alignItems: 'center',
            marginVertical: scale(16),
            width: '100%',
        },
        header: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: SCREEN_WIDTH - scale(40),
            marginBottom: scale(16),
        },
        promptText: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(16),
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
            fontSize: scale(14),
            marginRight: scale(4),
        },
        hintText: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(14),
            color: colors.text || '#08132A',
        },
        board: {
            borderRadius: scale(12),
            overflow: 'hidden',
            backgroundColor: g.boardLight || '#D6EEFF',
            elevation: 4,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.15,
            shadowRadius: 6,
            borderWidth: 1,
            borderColor: 'rgba(0,0,0,0.05)',
        },
        row: {
            flexDirection: 'row',
        },
        cell: {
            justifyContent: 'center',
            alignItems: 'center',
        },
        piece: {
            textAlign: 'center',
            lineHeight: scale(42),
            textShadowColor: 'rgba(255,255,255,0.3)',
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 1,
        },
        aiBubbleContainer: {
            flexDirection: 'row',
            marginTop: scale(24),
            paddingHorizontal: scale(20),
            width: '100%',
            alignItems: 'flex-start',
        },
        aiAvatar: {
            width: scale(36),
            height: scale(36),
            borderRadius: scale(18),
            backgroundColor: g.zenythIcon || '#5BA3E6',
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: scale(12),
        },
        aiAvatarIcon: {
            color: '#FFFFFF',
            fontSize: scale(18),
            fontWeight: 'bold',
        },
        aiBubble: {
            flex: 1,
            backgroundColor: g.theoryCard || '#D6EEFF',
            borderRadius: scale(16),
            borderTopLeftRadius: scale(4),
            padding: scale(14),
        },
        aiBubbleText: {
            fontFamily: fonts.body.regular,
            fontSize: scale(14),
            lineHeight: scale(20),
            color: colors.text || '#08132A',
        },
        errorText: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(14),
            color: g.optionIncorrect || '#F87171',
            marginTop: scale(16),
        },
    });
};

export default ChessBoard;
