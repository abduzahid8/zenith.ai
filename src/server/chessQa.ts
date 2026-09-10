/**
 * Chess content QA — machine validation for objective chess claims.
 *
 * Uses chess.js (already a dependency) to prove, never assume:
 * - FEN parses and side-to-move is as claimed
 * - a UCI move is legal in the position (promotion included)
 * - a claimed mate_in_1 actually checkmates
 * - an opening line is a legal move sequence
 * - an MC item has its answer among unique options
 *
 * What chess.js CANNOT prove: engine-best-move quality, conceptual
 * correctness of prose questions, difficulty, or skill mapping. Those
 * stay human-review items (see the review checklist in the pilot docs).
 * Practical banks therefore use ONLY objectively checkable task types:
 * mate_in_1, legal opening lines, and pinned decisive moves — never
 * subjective "best move" keys.
 */

import { Chess } from 'chess.js';

export interface QaResult {
    ok: boolean;
    errors: string[];
}

const fail = (...errors: string[]): QaResult => ({ ok: false, errors });
const pass = (): QaResult => ({ ok: true, errors: [] });

function parseUci(uci: string): { from: string; to: string; promotion?: string } | null {
    const m = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/.exec(uci.trim());
    if (!m) return null;
    return { from: m[1], to: m[2], promotion: m[3] };
}

/** FEN parses and side-to-move matches expectation. */
export function qaFen(fen: string, expectTurn?: 'w' | 'b'): QaResult {
    let game: Chess;
    try {
        game = new Chess(fen);
    } catch (err) {
        return fail(`FEN does not parse: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (expectTurn && game.turn() !== expectTurn) {
        return fail(`side to move is ${game.turn()}, expected ${expectTurn}`);
    }
    return pass();
}

/** UCI move is legal in the FEN position (promotion-aware). */
export function qaUciLegal(fen: string, uci: string): QaResult {
    const parsed = parseUci(uci);
    if (!parsed) return fail(`not valid UCI: ${uci}`);
    let game: Chess;
    try {
        game = new Chess(fen);
    } catch (err) {
        return fail(`FEN does not parse: ${err instanceof Error ? err.message : String(err)}`);
    }
    let move;
    try {
        move = game.move({ from: parsed.from, to: parsed.to, promotion: parsed.promotion });
    } catch {
        return fail(`illegal move ${uci} in position ${fen}`);
    }
    if (!move) return fail(`illegal move ${uci} in position ${fen}`);
    return pass();
}

/** mate_in_1 claim: legal AND delivers checkmate. */
export function qaMateIn1(fen: string, uci: string): QaResult {
    const errors: string[] = [];
    const legal = qaUciLegal(fen, uci);
    if (!legal.ok) return legal;
    const parsed = parseUci(uci)!;
    const game = new Chess(fen);
    game.move({ from: parsed.from, to: parsed.to, promotion: parsed.promotion });
    if (!game.isCheckmate()) {
        errors.push(`move ${uci} does not checkmate (inCheck=${game.inCheck()})`);
        // Name an escape to make failures actionable.
        errors.push(`resulting FEN: ${game.fen()}`);
    }
    return errors.length > 0 ? fail(...errors) : pass();
}

/** Opening line: every UCI token legal in sequence from the given FEN. */
export function qaOpeningLine(startFen: string, uciSequence: string): QaResult {
    const tokens = uciSequence.trim().split(/\s+/);
    if (tokens.length === 0) return fail('empty move sequence');
    let game: Chess;
    try {
        game = new Chess(startFen);
    } catch (err) {
        return fail(`FEN does not parse: ${err instanceof Error ? err.message : String(err)}`);
    }
    for (const token of tokens) {
        const parsed = parseUci(token);
        if (!parsed) return fail(`not valid UCI token: ${token}`);
        try {
            game.move({ from: parsed.from, to: parsed.to, promotion: parsed.promotion });
        } catch {
            return fail(`illegal move ${token} in sequence ${uciSequence}`);
        }
    }
    return pass();
}

/** MC item: answer among >=2 unique options. */
export function qaMultipleChoice(options: unknown, answer: unknown): QaResult {
    if (!Array.isArray(options) || options.length < 2) return fail('need >= 2 options');
    if (new Set(options).size !== options.length) return fail('duplicate options');
    if (typeof answer !== 'string' || !options.includes(answer)) {
        return fail('answer is not one of the options');
    }
    return pass();
}

export type PracticalKind = 'mate_in_1' | 'opening_line' | 'tactic_line' | 'winning_move' | 'best_move';

export interface PracticalItemInput {
    kind: PracticalKind;
    fen?: string;
    prompt?: string;
    answer: string;
}

/**
 * Practical item gate: only objectively checkable kinds are issuable.
 * - mate_in_1: machine-proven checkmate.
 * - opening_line: machine-proven legal sequence.
 * - tactic_line: machine-proven LEGAL move; the tactical motif claim in
 *   the prompt (fork, tempo, ...) is human-review-gated, never
 *   machine-proven. Human review record is mandatory for these.
 * - winning_move/best_move are REJECTED unless replaced by a checkable
 *   task: chess.js proves legality/mate, never engine-best quality.
 */
export function qaPracticalItem(item: PracticalItemInput): QaResult {
    if (item.kind === 'mate_in_1') {
        if (!item.fen) return fail('mate_in_1 needs a FEN');
        return qaMateIn1(item.fen, item.answer);
    }
    if (item.kind === 'opening_line') {
        if (!item.fen) return fail('opening_line needs a start FEN');
        return qaOpeningLine(item.fen, item.answer);
    }
    if (item.kind === 'tactic_line') {
        if (!item.fen) return fail('tactic_line needs a FEN');
        const legal = qaUciLegal(item.fen, item.answer);
        if (!legal.ok) return legal;
        return pass();
    }
    return fail(
        `task kind ${item.kind} is not objectively checkable: ` +
            'replace with mate_in_1 or a pinned legal line, or validate with a real engine/tablebase',
    );
}
