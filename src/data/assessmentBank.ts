/**
 * Assessment question bank (§7, §15) — built FROM the hobby task banks.
 *
 * Every question tests something the program's own 28-day bank teaches
 * (same topics, same examples) and is tagged with the bank-week skill it
 * belongs to. The final exam therefore re-tests the user's OWN daily
 * learning — never a foreign curriculum.
 *
 * The final assessment samples N questions per program (randomized order +
 * shuffled options) so different users get different combinations (§15).
 */

import { AssessmentKind, QuestionKind } from '../domain/credentials/types';

export interface AssessmentQuestion {
    id: string;
    programSlug: string;
    skillKey: string;
    kind: AssessmentKind;
    questionKind: QuestionKind;
    prompt: string;
    /** For choice kinds. Shuffled at attempt time; correct indices remapped. */
    options?: string[];
    correctIndices?: number[];
    correctBoolean?: boolean;
    /** For ordering: the correct sequence of `options`. */
    explanation: string;
}

const q = (
    id: string,
    programSlug: string,
    skillKey: string,
    kind: AssessmentKind,
    questionKind: QuestionKind,
    prompt: string,
    extra: Partial<Pick<AssessmentQuestion, 'options' | 'correctIndices' | 'correctBoolean' | 'explanation'>> = {},
): AssessmentQuestion => ({
    id,
    programSlug,
    skillKey,
    kind,
    questionKind,
    prompt,
    explanation: '',
    ...extra,
});

export const ASSESSMENT_BANK: AssessmentQuestion[] = [
    // ---------------- Python (bank days 1–28) ----------------
    q('pyf-01', 'python-foundations', 'syntax', 'knowledge', 'single_choice',
        'What does print() do in Python?',
        { options: ['Reads user input', 'Outputs text to the screen', 'Creates a variable', 'Deletes a file'], correctIndices: [1], explanation: 'print() outputs text — your very first program (bank day 1).' }),
    q('pyf-02', 'python-foundations', 'syntax', 'applied', 'single_choice',
        'Which converts user input to a whole number?',
        { options: ['str(input())', 'int(input())', 'float(input())', 'bool(input())'], correctIndices: [1], explanation: 'int() converts to integer (bank day 4).' }),
    q('pyf-03', 'python-foundations', 'logic', 'knowledge', 'single_choice',
        'What does `for i in range(3)` iterate over?',
        { options: ['1, 2, 3', '0, 1, 2', '3, 2, 1', 'Nothing'], correctIndices: [1], explanation: 'range(3) = 0, 1, 2 (bank day 12).' }),
    q('pyf-04', 'python-foundations', 'logic', 'applied', 'single_choice',
        'FizzBuzz for multiples of 3 and 5 should print…',
        { options: ['"Fizz" for 3, "Buzz" for 5, "FizzBuzz" for both', '"Buzz" for everything', 'Nothing ever', 'Random words'], correctIndices: [0], explanation: 'Classic FizzBuzz mapping (bank day 14).' }),
    q('pyf-05', 'python-foundations', 'functions', 'knowledge', 'single_choice',
        'What does `return` do in a function?',
        { options: ['Prints to screen', 'Sends a value back to the caller and exits', 'Deletes the function', 'Imports a module'], correctIndices: [1], explanation: 'return passes a value back (bank day 15).' }),
    q('pyf-06', 'python-foundations', 'functions', 'applied', 'single_choice',
        'You need an ordered, changeable collection. Use…',
        { options: ['A list', 'An int', 'A boolean', 'None'], correctIndices: [0], explanation: 'Lists are ordered and mutable (bank day 17).' }),
    q('pyf-07', 'python-foundations', 'basic_programming', 'scenario', 'true_false',
        '`while True` without break/return will loop forever.',
        { correctBoolean: true, explanation: 'No exit path = infinite loop (bank day 11).' }),
    q('pyf-08', 'python-foundations', 'basic_programming', 'applied', 'single_choice',
        'Your file-writing program crashes on bad input. The right fix is…',
        { options: ['Delete the file', 'Wrap input handling in try/except', 'Use more print() calls', 'Rename the variables'], correctIndices: [1], explanation: 'try/except handles bad input (bank day 24).' }),

    // ---------------- Chess (bank days 1–28) ----------------
    q('chf-01', 'chess-foundations', 'rules', 'knowledge', 'single_choice',
        'Standard piece values: pawn=1, knight/bishop=3, rook=5, queen=…',
        { options: ['6', '7', '9', '10'], correctIndices: [2], explanation: 'Queen = 9 (bank day 2).' }),
    q('chf-02', 'chess-foundations', 'rules', 'applied', 'single_choice',
        'The three opening principles are…',
        { options: ['Center, development, king safety', 'Attack, attack, attack', 'Trade everything fast', 'Never castle'], correctIndices: [0], explanation: 'Center, development, king safety (bank day 3).' }),
    q('chf-03', 'chess-foundations', 'openings', 'knowledge', 'single_choice',
        'The Italian Game starts with…',
        { options: ['1.e4 e5 2.Nf3 Nc6 3.Bc4', '1.e4 c5', '1.e4 e6', '1.d4 d5 2.c4'], correctIndices: [0], explanation: '1.e4 e5 2.Nf3 Nc6 3.Bc4 (bank day 8).' }),
    q('chf-04', 'chess-foundations', 'openings', 'applied', 'single_choice',
        'You play the Caro-Kann (1.e4 c6) because you want…',
        { options: ['A solid pawn structure as Black', 'To lose fast', 'To avoid all theory', 'A quick stalemate'], correctIndices: [0], explanation: 'Caro-Kann = solid structure (bank day 13).' }),
    q('chf-05', 'chess-foundations', 'endgames', 'knowledge', 'single_choice',
        'Why are opposite-colored bishop endings often drawn?',
        { options: ['Bishops cannot move', 'Each bishop controls squares the other never attacks', 'Kings are removed', 'Pawns disappear'], correctIndices: [1], explanation: 'Bishops miss each other’s color complex (bank day 18).' }),
    q('chf-06', 'chess-foundations', 'endgames', 'applied', 'single_choice',
        'In a rook ending your rook is passive behind pawns. You should…',
        { options: ['Keep it passive', 'Activate it — activity beats material', 'Offer a draw instantly', 'Push only the h-pawn'], correctIndices: [1], explanation: 'Active rooks win endings (bank day 17).' }),
    q('chf-07', 'chess-foundations', 'tactics', 'knowledge', 'single_choice',
        'A fork (double attack) is…',
        { options: ['Two pieces moving at once', 'One piece attacking two targets', 'Castling queenside', 'A draw offer'], correctIndices: [1], explanation: 'One piece, two targets (bank day 22).' }),
    q('chf-08', 'chess-foundations', 'tactics', 'scenario', 'single_choice',
        'Your knight eyes an enemy queen and rook on the same move pattern. First candidate to check…',
        { options: ['Resign', 'The fork — can both be attacked at once', 'Close the app', 'Move the king randomly'], correctIndices: [1], explanation: 'Always scan for tactics first (bank day 22–28).' }),

    // ---------------- Reading (bank days 1–28) ----------------
    q('rdg-01', 'reading-mastery', 'techniques', 'knowledge', 'single_choice',
        'SQ3R stands for…',
        { options: ['Survey, Question, Read, Recite, Review', 'Skim, Quit, Rest, Repeat', 'Search, Quote, Rank', 'Speed, Quiet, Retention'], correctIndices: [0], explanation: 'Survey, Question, Read, Recite, Review (bank day 1).' }),
    q('rdg-02', 'reading-mastery', 'techniques', 'applied', 'single_choice',
        'To explain an article simply to a friend you would use…',
        { options: ['The Feynman method', 'Skimming only', 'Speed reading', 'Copying the text'], correctIndices: [0], explanation: 'Feynman: explain simply (bank day 5).' }),
    q('rdg-03', 'reading-mastery', 'analysis', 'knowledge', 'single_choice',
        'A full argument has the structure…',
        { options: ['Thesis → evidence → conclusion', 'Joke → story → moral', 'Title → picture → ad', 'Intro → intro → intro'], correctIndices: [0], explanation: 'Thesis, evidence, conclusion (bank day 8).' }),
    q('rdg-04', 'reading-mastery', 'analysis', 'scenario', 'true_false',
        'Correlation between ice-cream sales and drownings proves ice cream causes drowning.',
        { correctBoolean: false, explanation: 'Correlation ≠ causation — season confounds both (bank day 9–10).' }),
    q('rdg-05', 'reading-mastery', 'nonfiction', 'applied', 'single_choice',
        'Reading a business book effectively means looking for…',
        { options: ['3 main ideas you will apply', 'The prettiest cover', 'The longest chapter', 'Typos'], correctIndices: [0], explanation: '3 applicable ideas (bank day 17).' }),
    q('rdg-06', 'reading-mastery', 'nonfiction', 'knowledge', 'single_choice',
        'The Cornell Notes method splits the page into…',
        { options: ['Cues, notes, summary', 'Red, green, blue', 'Ads and text', 'One big box'], correctIndices: [0], explanation: 'Cues, notes, summary (bank day 11).' }),
    q('rdg-07', 'reading-mastery', 'system', 'applied', 'single_choice',
        'A useful reading tracker records at least…',
        { options: ['Title, author, dates, rating, main idea', 'Only the page count', 'Only the price', 'Nothing'], correctIndices: [0], explanation: 'Title, author, dates, rating, main idea (bank day 26).' }),
    q('rdg-08', 'reading-mastery', 'system', 'scenario', 'single_choice',
        'A book doesn’t click after 50 honest pages. The reading-system answer is…',
        { options: ['Suffer through 400 pages', 'Drop it guilt-free — the 50-page rule', 'Read it twice', 'Blame the author publicly'], correctIndices: [1], explanation: 'The 50-page rule (bank day 24).' }),

    // ---------------- English (bank days 1–28) ----------------
    q('enf-01', 'english-foundations', 'grammar', 'knowledge', 'single_choice',
        'Present Simple third person: She ___ to school every day.',
        { options: ['go', 'goes', 'going', 'gone'], correctIndices: [1], explanation: '3rd person singular adds -s/-es (bank day 1).' }),
    q('enf-02', 'english-foundations', 'grammar', 'applied', 'single_choice',
        'Have you ever been to London? — the tense is…',
        { options: ['Past Simple', 'Present Perfect', 'Future Simple', 'Present Continuous'], correctIndices: [1], explanation: 'Have + V3 = Present Perfect, life experience (bank day 5).' }),
    q('enf-03', 'english-foundations', 'vocabulary', 'knowledge', 'single_choice',
        '"Give up" is…',
        { options: ['A phrasal verb meaning to quit', 'An idiom about presents', 'A tense', 'A punctuation mark'], correctIndices: [0], explanation: 'Phrasal verb: give up = quit (bank day 11).' }),
    q('enf-04', 'english-foundations', 'vocabulary', 'applied', 'single_choice',
        'To sound natural you add…',
        { options: ['Actually, to be honest, by the way', 'More commas everywhere', 'Latin quotes', 'Silence'], correctIndices: [0], explanation: 'Conversation clichés (bank day 16).' }),
    q('enf-05', 'english-foundations', 'speaking', 'knowledge', 'single_choice',
        'Good small talk follows…',
        { options: ['Greeting → neutral topic → question → answer', 'Salary → politics → goodbye', 'Silence → stare → leave', 'Shouting'], correctIndices: [0], explanation: 'Small-talk structure (bank day 15).' }),
    q('enf-06', 'english-foundations', 'speaking', 'applied', 'multiple_choice',
        'Polite disagreement uses… (select all that apply)',
        { options: ['I see your point, but…', 'That’s interesting, however…', 'You are an idiot', 'With all due respect…'], correctIndices: [0, 1, 3], explanation: 'Soften before opposing (bank day 19).' }),
    q('enf-07', 'english-foundations', 'writing', 'knowledge', 'single_choice',
        'A paragraph needs…',
        { options: ['Topic sentence → details → conclusion', 'Five emojis', 'No verbs', 'One long word'], correctIndices: [0], explanation: 'Paragraph structure (bank day 22).' }),
    q('enf-08', 'english-foundations', 'writing', 'applied', 'single_choice',
        'The letter was written by the manager. The voice is…',
        { options: ['Active', 'Passive', 'Subjunctive', 'Silent'], correctIndices: [1], explanation: 'be + V3 = Passive Voice (bank day 26).' }),

    // ---------------- Chinese (bank days 1–28) ----------------
    q('chn-01', 'chinese-hsk1-start', 'pinyin', 'knowledge', 'single_choice',
        'mā, má, mǎ, mà differ by…',
        { options: ['Font', 'Tone', 'Volume', 'Speed'], correctIndices: [1], explanation: 'The four tones change meaning (bank day 1).' }),
    q('chn-02', 'chinese-hsk1-start', 'pinyin', 'applied', 'single_choice',
        'Which pair is hardest to distinguish for beginners?',
        { options: ['b/p', 'm/f', 'a/o', 'n/l'], correctIndices: [0], explanation: 'Unaspirated vs aspirated b/p (bank day 2).' }),
    q('chn-03', 'chinese-hsk1-start', 'characters', 'knowledge', 'single_choice',
        '人 means…',
        { options: ['Fire', 'Person', 'Mountain', 'Water'], correctIndices: [1], explanation: '人 = person (bank day 9).' }),
    q('chn-04', 'chinese-hsk1-start', 'characters', 'applied', 'single_choice',
        '二十三 means…',
        { options: ['12', '23', '32', '203'], correctIndices: [1], explanation: '2-10-3 = 23 (bank day 11).' }),
    q('chn-05', 'chinese-hsk1-start', 'phrases', 'knowledge', 'single_choice',
        'Use 您好 instead of 你好 when speaking to…',
        { options: ['Close friends', 'An elder or superior', 'Pets', 'Nobody'], correctIndices: [1], explanation: '您 = polite you (bank day 15).' }),
    q('chn-06', 'chinese-hsk1-start', 'phrases', 'applied', 'single_choice',
        'Bargaining at a market: the key phrase is…',
        { options: ['多少钱? (how much?)', '再见 (goodbye)', '谢谢 (thanks)', '对不起 (sorry)'], correctIndices: [0], explanation: '多少钱 = how much (bank day 18).' }),
    q('chn-07', 'chinese-hsk1-start', 'grammar', 'knowledge', 'single_choice',
        '我是学生 uses 是 to mean…',
        { options: ['To be (identity)', 'To have', 'To go', 'To eat'], correctIndices: [0], explanation: '是 = to be (bank day 23).' }),
    q('chn-08', 'chinese-hsk1-start', 'grammar', 'applied', 'single_choice',
        'Chinese basic word order is…',
        { options: ['Subject + Verb + Object', 'Object + Object + Object', 'Verb first always', 'Random'], correctIndices: [0], explanation: 'SVO order (bank day 22).' }),
];

export function questionsForProgram(programSlug: string): AssessmentQuestion[] {
    return ASSESSMENT_BANK.filter(question => question.programSlug === programSlug);
}

/** Fisher–Yates with injectable RNG (default Math.random; tests pass seeded). */
export function shuffle<T>(items: T[], rng: () => number = Math.random): T[] {
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

export interface PreparedQuestion extends AssessmentQuestion {
    /** Shuffled display options (choice kinds only). */
    displayOptions?: string[];
    /** Remapped correct indices into displayOptions. */
    displayCorrectIndices?: number[];
}

/**
 * Build one attempt: sample N questions (coverage across skills when
 * possible), shuffle question order and option order (§15).
 */
export function buildAttemptQuestions(
    programSlug: string,
    count: number,
    rng: () => number = Math.random,
): PreparedQuestion[] {
    const pool = questionsForProgram(programSlug);
    if (pool.length === 0) return [];

    // Round-robin across skills for breadth, then fill randomly.
    const bySkill = new Map<string, AssessmentQuestion[]>();
    for (const question of shuffle(pool, rng)) {
        const list = bySkill.get(question.skillKey) ?? [];
        list.push(question);
        bySkill.set(question.skillKey, list);
    }
    const picked: AssessmentQuestion[] = [];
    const queues = [...bySkill.values()];
    let round = 0;
    while (picked.length < Math.min(count, pool.length) && queues.some(queue => queue.length > round)) {
        for (const queue of shuffle(queues, rng)) {
            if (picked.length >= Math.min(count, pool.length)) break;
            if (queue.length > round) picked.push(queue[round]);
        }
        round++;
    }

    return shuffle(picked, rng).map(question => {
        if (!question.options || question.questionKind === 'ordering') return { ...question };
        const order = shuffle(question.options.map((_, i) => i), rng);
        return {
            ...question,
            displayOptions: order.map(i => question.options![i]),
            displayCorrectIndices: (question.correctIndices ?? []).map(ci => order.indexOf(ci)),
        };
    });
}

/** Score one prepared question against selected display indices / boolean. */
export function scoreAnswer(
    question: PreparedQuestion,
    selectedIndices: number[] = [],
    booleanAnswer: boolean | null = null,
): boolean {
    if (question.questionKind === 'true_false') {
        return booleanAnswer === question.correctBoolean;
    }
    const correct = new Set(question.displayCorrectIndices ?? question.correctIndices ?? []);
    const selected = new Set(selectedIndices);
    if (correct.size !== selected.size) return false;
    for (const i of selected) if (!correct.has(i)) return false;
    return true;
}
