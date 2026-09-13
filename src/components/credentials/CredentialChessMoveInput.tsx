import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Chess } from 'chess.js';
import { scale } from '../../constants';
import { fonts } from '../../theme';
import { useAppTheme } from '../../theme/useAppTheme';

/**
 * Slice 3 — credential-only move capture.
 *
 * Displays the server FEN, enforces chess legality via chess.js, captures
 * user moves as canonical UCI, and supports undo/reset of local input.
 * The server alone judges the submitted line after submit. This input
 * holds no hidden move data and performs no local grading of any kind.
 */

export type ChessInputMode = 'single' | 'line';

export interface CredentialChessMoveInputProps {
    fen: string;
    mode: ChessInputMode;
    value: string;
    onChange: (next: string) => void;
}

export function parseUciInput(text: string): { from: string; to: string; promotion?: string } | null {
    const m = /^([a-h][1-8])([a-h][1-8])([qrbnQRBN])?$/.exec(text.trim());
    if (!m) return null;
    const promotion = m[3] ? m[3].toLowerCase() : undefined;
    return { from: m[1], to: m[2], promotion };
}

export function toCanonicalUci(from: string, to: string, promotion?: string): string {
    return `${from}${to}${promotion ? promotion.toLowerCase() : ''}`;
}

/**
 * Try the raw text as UCI first, then as SAN, against the given FEN.
 * Returns canonical UCI (from+to+promotion) when the move is legal here,
 * else null. Legality only — never a judgement about the server task.
 */
export function uciFromEntry(fen: string, text: string): string | null {
    const trimmed = text.trim();
    if (!trimmed) return null;
    const parsed = parseUciInput(trimmed);
    if (parsed) {
        try {
            const game = new Chess(fen);
            const move = game.move({ from: parsed.from, to: parsed.to, promotion: parsed.promotion });
            if (!move) return null;
            return toCanonicalUci(move.from, move.to, (move as unknown as { promotion?: string }).promotion);
        } catch {
            return null;
        }
    }
    try {
        const game = new Chess(fen);
        const move = game.move(trimmed);
        if (!move) return null;
        return toCanonicalUci(move.from, move.to, (move as unknown as { promotion?: string }).promotion);
    } catch {
        return null;
    }
}

export function isLegalUci(fen: string, uci: string): boolean {
    return uciFromEntry(fen, uci) != null && parseUciInput(uci) != null
        ? uciFromEntry(fen, uci) === uci.trim().toLowerCase()
        : uciFromEntry(fen, uci) != null;
}

/**
 * Apply a token list from the start FEN, returning the resulting FEN when
 * every token is legal in sequence, else null. Used for multi-move lines.
 */
export function applyUciLine(startFen: string, tokens: string[]): string | null {
    try {
        const game = new Chess(startFen);
        for (const token of tokens) {
            const uci = uciFromEntry(game.fen(), token);
            if (!uci) return null;
            const parsed = parseUciInput(uci);
            if (!parsed) return null;
            const move = game.move({ from: parsed.from, to: parsed.to, promotion: parsed.promotion });
            if (!move) return null;
        }
        return game.fen();
    } catch {
        return null;
    }
}

export function tokensOf(value: string): string[] {
    const trimmed = value.trim();
    if (!trimmed) return [];
    return trimmed.split(/\s+/).filter(t => t.length > 0);
}

export const CredentialChessMoveInput: React.FC<CredentialChessMoveInputProps> = ({
    fen,
    mode,
    value,
    onChange,
}) => {
    const { colors } = useAppTheme();
    const [draft, setDraft] = useState('');
    const [invalid, setInvalid] = useState(false);

    useEffect(() => {
        setDraft('');
        setInvalid(false);
    }, [fen]);

    const tokens = useMemo(() => tokensOf(value), [value]);

    const liveFen = useMemo(() => {
        if (mode !== 'line' || tokens.length === 0) return fen;
        return applyUciLine(fen, tokens) ?? fen;
    }, [fen, mode, tokens]);

    const legalCount = useMemo(() => {
        try {
            const game = new Chess(liveFen);
            return game.moves().length;
        } catch {
            return 0;
        }
    }, [liveFen]);

    const commitDraft = (text: string) => {
        const uci = uciFromEntry(liveFen, text);
        if (!uci) {
            setInvalid(true);
            return;
        }
        setInvalid(false);
        setDraft('');
        if (mode === 'single') {
            onChange(uci);
        } else {
            const next = [...tokens, uci].join(' ');
            onChange(next);
        }
    };

    const undo = () => {
        if (mode === 'single') {
            onChange('');
            setDraft('');
            setInvalid(false);
            return;
        }
        const next = tokens.slice(0, -1).join(' ');
        onChange(next);
        setDraft('');
        setInvalid(false);
    };

    const reset = () => {
        onChange('');
        setDraft('');
        setInvalid(false);
    };

    return (
        <View style={styles.wrap}>
            <Text style={[styles.fen, { color: colors.textSecondary }]}>{fen}</Text>
            {mode === 'single' ? (
                <View>
                    {value !== '' && (
                        <Text style={[styles.selected, { color: colors.text }]}>
                            Selected move:{'\n'}
                            {value}
                        </Text>
                    )}
                    <TextInput
                        style={[styles.input, { color: colors.text, borderColor: colors.textSecondary }]}
                        value={draft}
                        onChangeText={text => {
                            setDraft(text);
                            setInvalid(false);
                        }}
                        onSubmitEditing={e => commitDraft((e.nativeEvent as unknown as { text: string }).text ?? draft)}
                        placeholder="Enter move in UCI (e.g. g1g7)"
                        placeholderTextColor="#999"
                        autoCapitalize="none"
                    />
                    {invalid && (
                        <Text style={[styles.invalid, { color: colors.textSecondary }]}>
                            Not a legal move here.
                        </Text>
                    )}
                    <View style={styles.row}>
                        <TouchableOpacity
                            style={[styles.secondary, { backgroundColor: colors.background }]}
                            onPress={() => commitDraft(draft)}
                            activeOpacity={0.7}
                        >
                            <Text style={[styles.secondaryText, { color: colors.text }]}>Set move</Text>
                        </TouchableOpacity>
                        {(value !== '' || draft !== '') && (
                            <TouchableOpacity
                                style={[styles.secondary, { backgroundColor: colors.background }]}
                                onPress={reset}
                                activeOpacity={0.7}
                            >
                                <Text style={[styles.secondaryText, { color: colors.text }]}>Reset</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                    <Text style={[styles.meta, { color: colors.textSecondary }]}>
                        Legal moves here: {legalCount}
                    </Text>
                </View>
            ) : (
                <View>
                    <Text style={[styles.selected, { color: colors.text }]}>
                        Moves:{'\n'}
                        {value === '' ? '—' : value}
                    </Text>
                    <TextInput
                        style={[styles.input, { color: colors.text, borderColor: colors.textSecondary }]}
                        value={draft}
                        onChangeText={text => {
                            setDraft(text);
                            setInvalid(false);
                        }}
                        onSubmitEditing={e => commitDraft((e.nativeEvent as unknown as { text: string }).text ?? draft)}
                        placeholder="Enter next move in UCI"
                        placeholderTextColor="#999"
                        autoCapitalize="none"
                    />
                    {invalid && (
                        <Text style={[styles.invalid, { color: colors.textSecondary }]}>
                            Not a legal move here.
                        </Text>
                    )}
                    <View style={styles.row}>
                        <TouchableOpacity
                            style={[styles.secondary, { backgroundColor: colors.background }]}
                            onPress={() => commitDraft(draft)}
                            activeOpacity={0.7}
                        >
                            <Text style={[styles.secondaryText, { color: colors.text }]}>Play move</Text>
                        </TouchableOpacity>
                        {tokens.length > 0 && (
                            <TouchableOpacity
                                style={[styles.secondary, { backgroundColor: colors.background }]}
                                onPress={undo}
                                activeOpacity={0.7}
                            >
                                <Text style={[styles.secondaryText, { color: colors.text }]}>Undo</Text>
                            </TouchableOpacity>
                        )}
                        {(value !== '' || draft !== '') && (
                            <TouchableOpacity
                                style={[styles.secondary, { backgroundColor: colors.background }]}
                                onPress={reset}
                                activeOpacity={0.7}
                            >
                                <Text style={[styles.secondaryText, { color: colors.text }]}>Reset</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                    <Text style={[styles.meta, { color: colors.textSecondary }]}>
                        Legal moves here: {legalCount}
                    </Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    wrap: {
        marginBottom: scale(8),
    },
    fen: {
        fontFamily: fonts.heading.regular,
        fontSize: scale(11),
        marginBottom: scale(8),
    },
    selected: {
        fontFamily: fonts.heading.medium,
        fontSize: scale(14),
        marginBottom: scale(8),
    },
    input: {
        borderWidth: 1,
        borderRadius: scale(12),
        paddingVertical: scale(12),
        paddingHorizontal: scale(16),
        fontSize: scale(15),
        marginBottom: scale(8),
    },
    invalid: {
        fontFamily: fonts.heading.regular,
        fontSize: scale(13),
        marginBottom: scale(8),
    },
    row: {
        flexDirection: 'row',
        gap: scale(12),
        marginTop: scale(4),
    },
    secondary: {
        flex: 1,
        borderRadius: scale(12),
        paddingVertical: scale(12),
        alignItems: 'center',
    },
    secondaryText: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(15),
    },
    meta: {
        fontFamily: fonts.heading.regular,
        fontSize: scale(12),
        marginTop: scale(8),
    },
});

export default CredentialChessMoveInput;
