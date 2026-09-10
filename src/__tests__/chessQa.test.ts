/** Machine QA for objective chess claims + regression on the compromised bank. */
import {
    qaFen,
    qaMateIn1,
    qaMultipleChoice,
    qaOpeningLine,
    qaPracticalItem,
    qaUciLegal,
} from '../server/chessQa';

describe('chess QA tool', () => {
    test('valid FEN parses with correct side to move', () => {
        expect(qaFen('7k/8/5K2/8/8/8/8/6Q1 w - - 0 1', 'w').ok).toBe(true);
        expect(qaFen('7k/8/5K2/8/8/8/8/6Q1 w - - 0 1', 'b').ok).toBe(false);
        expect(qaFen('not-a-fen').ok).toBe(false);
    });

    test('legal and illegal UCI moves', () => {
        expect(qaUciLegal('7k/8/5K2/8/8/8/8/6Q1 w - - 0 1', 'g1g7').ok).toBe(true);
        expect(qaUciLegal('7k/8/5K2/8/8/8/8/6Q1 w - - 0 1', 'e2e4').ok).toBe(false); // no pawn
        expect(qaUciLegal('7k/8/5K2/8/8/8/8/6Q1 w - - 0 1', 'zzz').ok).toBe(false);
    });

    test('mate_in_1 verdicts', () => {
        expect(qaMateIn1('7k/8/5K2/8/8/8/8/6Q1 w - - 0 1', 'g1g7').ok).toBe(true);
        expect(qaMateIn1('7k/8/5K2/8/8/8/8/6Q1 w - - 0 1', 'g1g6').ok).toBe(false);
    });

    test('opening lines validate move by move', () => {
        const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
        expect(qaOpeningLine(start, 'e2e4 e7e5 g1f3 b8c6 f1b5').ok).toBe(true);
        expect(qaOpeningLine(start, 'e2e4 e7e5 g1f3 b8c6 f1c4').ok).toBe(true);
        expect(qaOpeningLine(start, 'e2e5').ok).toBe(false);
    });

    test('multiple choice shape', () => {
        expect(qaMultipleChoice(['a', 'b'], 'a').ok).toBe(true);
        expect(qaMultipleChoice(['a', 'b'], 'c').ok).toBe(false);
        expect(qaMultipleChoice(['a', 'a'], 'a').ok).toBe(false);
    });

    test('subjective kinds are rejected without engine proof', () => {
        expect(qaPracticalItem({ kind: 'best_move', fen: '8/8/8/8/8/8/8/8 w - - 0 1', answer: 'e2e4' }).ok).toBe(false);
        expect(qaPracticalItem({ kind: 'winning_move', answer: 'c4c5' }).ok).toBe(false);
    });
});

describe('compromised bank regression: faulty items must FAIL machine QA', () => {
    test('B. pr-rules-2 g7g8q is NOT mate (Kxg8 escapes)', () => {
        const r = qaMateIn1('7k/6P1/6K1/8/8/8/8/8 w - - 0 1', 'g7g8q');
        expect(r.ok).toBe(false);
    });

    test('D. pr-tac-2 narrative is false (d7 pawn blocks the pin)', () => {
        // The move a7a6 itself is legal; the FALSE part is the "breaks the
        // pin" claim. Machine QA cannot check prose, so the regression is:
        // a pin-claim item must reference a position where the pin line is
        // actually open. Here b5-c6-d7-e8 is blocked by the d7 pawn.
        const { Chess } = require('chess.js');
        const game = new Chess('r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3');
        // d7 pawn sits between c6 and e8: no absolute pin exists.
        expect(game.get('d7').type).toBe('p');
        expect(qaUciLegal(game.fen(), 'a7a6').ok).toBe(true);
    });

    test('corrected replacements pass machine QA', () => {
        // Scholar's-mate finish: verified mate in 1.
        expect(
            qaMateIn1(
                'r1bqkbnr/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
                'h5f7',
            ).ok,
        ).toBe(true);
        // KRK back-rank finish: verified mate in 1.
        expect(qaMateIn1('7k/6pp/8/8/8/6K1/6PP/5R2 w - - 0 1', 'f1f8').ok).toBe(true);
        // KQK finish: verified mate in 1.
        expect(qaMateIn1('7k/8/5K2/8/8/8/8/6Q1 w - - 0 1', 'g1g7').ok).toBe(true);
        // Damiano-style fork: legal move played in a real game line.
        expect(
            qaUciLegal(
                'r1bqkb1r/pppp1ppp/2n5/4p3/2B1N3/2N5/PPPP1PPP/R1BQK2R b KQkq - 0 5',
                'd7d5',
            ).ok,
        ).toBe(true);
    });
});
