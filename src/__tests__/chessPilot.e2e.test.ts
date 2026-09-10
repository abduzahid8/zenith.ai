/**
 * Chess Foundations pilot E2E (real local Postgres, `npm run test:e2e`).
 *
 * Proves the ONE issuable credential end-to-end through public flows only:
 * authenticated RPCs for every step + service-role project review (the V1
 * authority model). No dev bypass, no test-score RPC, no forced passes.
 *
 * Answer maps below encode what a competent user knows (the curated bank
 * answers from migration 021). Keys are never read through client roles.
 */

import { Client } from 'pg';
import { adminClient, asRole, createUser, expectDbDenied, newUid } from '../../db-test/helpers';

let db: Client;
let db2: Client;

const PROGRAM = 'chess-foundations';
const VERSION = '1.0';

// Competent-user knowledge: prompt/keys from the curated bank (021).
const VALIDATION_ANSWERS: [string, string][] = [
    ['knight on g1', 'f3'],
    ['bishop (3) + knight (3)', '6 pawns'],
    ['Castling is ILLEGAL', 'the king is in check'],
    ['stalemated side', 'a draw'],
    ['3.Bc4 is the opening', 'Italian Game'],
    ['3.Bb5 is the opening', 'Ruy Lopez'],
    ['1.e4 c5 starts', 'Sicilian Defense'],
    ['1.e4 e6 starts', 'French Defense'],
    ['Direct opposition means', 'two squares apart on one file with the other side to move'],
    ['bishop + knight versus a bare king', 'cannot force checkmate'],
    ['queen versus a bare king', 'a forced win'],
    ['Bare king versus bare king', 'an immediate draw'],
    ['A fork is best described', 'one piece attacking two or more enemy pieces at once'],
    ['ABSOLUTE pin means', 'cannot move because it would expose its king'],
    ['A skewer attacks', 'a valuable piece in front with a lesser piece behind it'],
    ['double check, the king must', 'move'],
];

const KNOWLEDGE_ANSWERS: Record<string, string> = {
    'kn-rules-1': 'one or two squares forward',
    'kn-rules-2': 'one square',
    'kn-rules-3': 'color-bound to one square color',
    'kn-rules-4': 'one square diagonally forward',
    'kn-open-1': 'b5',
    'kn-open-2': 'c4',
    'kn-open-3': '1...c6',
    'kn-open-4': 'Queens Gambit',
    'kn-end-1': 'the third rank',
    'kn-end-2': 'a bridge for the king',
    'kn-end-3': 'behind the pawn',
    'kn-end-4': 'lawnmower mate',
    'kn-tac-1': 'a piece moves and reveals an attack from a piece behind it',
    'kn-tac-2': 'a knight',
    'kn-tac-3': 'back-rank mate',
    'kn-tac-4': 'luring a defender away from its duty',
};

const PRACTICAL_ANSWERS: Record<string, string> = {
    'pr-rules-1': 'g1g7',
    'pr-rules-2': 'g7g8q',
    'pr-open-1': 'e2e4 e7e5 g1f3 b8c6 f1b5',
    'pr-open-2': 'e2e4 e7e5 g1f3 b8c6 f1c4',
    'pr-end-1': 'f1f8',
    'pr-end-2': 'c4c5',
    'pr-tac-1': 'd7d5',
    'pr-tac-2': 'a7a6',
};

const FINAL_ANSWERS: Record<string, string> = {
    'fq-rules-1': 'any distance along ranks or files', 'fq-rules-2': 'rook and bishop',
    'fq-rules-3': 'they jump over pieces', 'fq-rules-4': 'the farthest rank',
    'fq-rules-5': 'two', 'fq-rules-6': 'the king is attacked',
    'fq-rules-7': 'a decisive win', 'fq-rules-8': 'its starting square color',
    'fq-rules-9': 'the e-file', 'fq-rules-10': 'stalemate',
    'fq-open-1': '3.Bc4', 'fq-open-2': '3.Bb5', 'fq-open-3': '1...c5',
    'fq-open-4': '1...e6', 'fq-open-5': '1...c6', 'fq-open-6': '3.d4',
    'fq-open-7': '2.Nc3', 'fq-open-8': '2...Nf6', 'fq-open-9': '4.b4',
    'fq-open-10': 'Queens Gambit',
    'fq-end-1': 'the side NOT to move', 'fq-end-2': 'not a forced win',
    'fq-end-3': 'driving the king to the edge rank by rank',
    'fq-end-4': 'lose a move and pass the turn to the opponent',
    'fq-end-5': 'a dead draw', 'fq-end-6': 'shelter its king from checks while promoting',
    'fq-end-7': 'on the third rank', 'fq-end-8': 'behind it', 'fq-end-9': 'a win',
    'fq-end-10': 'whether a king can catch a passed pawn',
    'fq-tac-1': 'a fork', 'fq-tac-2': 'absolute', 'fq-tac-3': 'a skewer',
    'fq-tac-4': 'a discovered check', 'fq-tac-5': 'move the king',
    'fq-tac-6': 'smothered mate', 'fq-tac-7': 'luft', 'fq-tac-8': 'deflection',
    'fq-tac-9': 'overloaded', 'fq-tac-10': 'a windmill',
};

const SKILLS = ['rules', 'openings', 'endgames', 'tactics'];

function answerValidation(prompt: string): string {
    const hit = VALIDATION_ANSWERS.find(([frag]) => prompt.includes(frag));
    if (!hit) throw new Error(`no mapped answer for prompt: ${prompt}`);
    return hit[1];
}

beforeAll(async () => {
    db = adminClient();
    await db.connect();
    db2 = adminClient();
    await db2.connect();
    // The issuance switch for the pilot (mirrors 022_enable_chess.sql,
    // applied to production only at the very end of the phase).
    await db.query(
        `UPDATE credential_programs SET issuance_enabled = TRUE WHERE slug = '${PROGRAM}'`,
    );
});

afterAll(async () => {
    await db.end();
    await db2.end();
});

async function passValidations(uid: string, perSkill: number): Promise<number> {
    let passes = 0;
    for (const skill of SKILLS) {
        for (let i = 0; i < perSkill; i++) {
            const started = await asRole(db, 'authenticated', uid, () =>
                db.query('SELECT * FROM start_trusted_validation($1, $2)', [PROGRAM, skill]).then(r => r.rows[0]),
            );
            const prompt = (started.payload as { prompt: string }).prompt;
            const sub = await asRole(db, 'authenticated', uid, () =>
                db.query('SELECT * FROM submit_trusted_validation($1, $2)', [
                    started.attempt_id, { answer: answerValidation(prompt) },
                ]).then(r => r.rows[0]),
            );
            if (sub.passed) passes += 1;
        }
    }
    return passes;
}

async function answerBank(
    uid: string,
    startFn: string,
    submitFn: string,
    answerMap: Record<string, string>,
    keyField: 'questions' | 'tasks',
): Promise<{ score: number; passed: boolean }> {
    const started = await asRole(db, 'authenticated', uid, () =>
        db.query(`SELECT * FROM ${startFn}($1)`, [PROGRAM]).then(r => r.rows[0]),
    );
    const items = started[keyField] as { item_key: string }[];
    // Answers are keyed by public item_key (UUIDs never leave the server).
    const answers: Record<string, string> = {};
    for (const item of items) answers[item.item_key] = answerMap[item.item_key];
    return asRole(db, 'authenticated', uid, () =>
        db.query(`SELECT * FROM ${submitFn}($1, $2)`, [started.attempt_id, answers]).then(r => {
            const row = r.rows[0];
            return { score: Number(row.score), passed: row.passed };
        }),
    );
}

describe('chess pilot: content audit', () => {
    test('bank counts and policy per skill', async () => {
        for (const skill of SKILLS) {
            const v = await db.query(
                `SELECT COUNT(*)::int c FROM trusted_validation_items
                 WHERE program_slug=$1 AND program_version=$2 AND skill_key=$3`, [PROGRAM, VERSION, skill],
            );
            expect(v.rows[0].c).toBeGreaterThanOrEqual(4);
            const k = await db.query(
                `SELECT COUNT(*)::int c FROM knowledge_items
                 WHERE program_slug=$1 AND program_version=$2 AND skill_key=$3`, [PROGRAM, VERSION, skill],
            );
            expect(k.rows[0].c).toBeGreaterThanOrEqual(4);
            const p = await db.query(
                `SELECT COUNT(*)::int c FROM practical_items
                 WHERE program_slug=$1 AND program_version=$2 AND skill_key=$3`, [PROGRAM, VERSION, skill],
            );
            expect(p.rows[0].c).toBeGreaterThanOrEqual(2);
            const pol = await db.query(
                `SELECT min_items, min_pass_rate FROM skill_evidence_policy
                 WHERE program_slug=$1 AND program_version=$2 AND skill_key=$3`, [PROGRAM, VERSION, skill],
            );
            expect(pol.rowCount).toBe(1);
            expect(pol.rows[0].min_items).toBeGreaterThanOrEqual(3);
        }
        const bank = await db.query(
            `SELECT question_count, jsonb_array_length(questions)::int AS bank FROM assessment_question_sets
             WHERE program_slug=$1 AND version=$2`, [PROGRAM, VERSION],
        );
        expect(bank.rows[0].question_count).toBe(20);
        expect(bank.rows[0].bank).toBeGreaterThanOrEqual(40);
        const perSkill = await db.query(
            `SELECT q->>'skill' AS skill, COUNT(*)::int c FROM assessment_question_sets,
             jsonb_array_elements(questions) q
             WHERE program_slug=$1 AND version=$2 GROUP BY 1 ORDER BY 1`, [PROGRAM, VERSION],
        );
        expect(perSkill.rows.map(r => r.skill).sort()).toEqual([...SKILLS].sort());
        for (const r of perSkill.rows) expect(r.c).toBeGreaterThanOrEqual(8);
    });

    test('final exam bank is not directly browsable', async () => {
        const uid = newUid();
        await createUser(db, uid);
        const leak = await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM assessment_question_sets').then(r => r.rowCount),
        );
        expect(leak).toBe(0);
    });
});

describe('chess pilot: full happy path', () => {
    test('enrollment to verified credential, then revocation', async () => {
        const uid = newUid();
        await createUser(db, uid);

        // Enrollment (authoritative row, pinned version).
        await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM enroll_in_program($1)', [PROGRAM]),
        );
        const enrolled = await db.query(
            `SELECT program_version, status FROM user_credential_progress
             WHERE user_id=$1 AND program_slug=$2 AND program_version=$3`, [uid, PROGRAM, VERSION],
        );
        expect(enrolled.rowCount).toBe(1);

        // Trusted validation: 3 distinct passes per skill (depth policy).
        const passes = await passValidations(uid, 3);
        expect(passes).toBe(12);

        // Knowledge: 8 assigned (2/skill), all correct.
        const knowledge = await answerBank(uid, 'start_knowledge_attempt', 'submit_knowledge_attempt', KNOWLEDGE_ANSWERS, 'questions');
        expect(knowledge).toEqual({ score: 100, passed: true });

        // Practical: 8 assigned (2/skill), all correct.
        const practical = await answerBank(uid, 'start_practical_attempt', 'submit_practical_attempt', PRACTICAL_ANSWERS, 'tasks');
        expect(practical).toEqual({ score: 100, passed: true });

        // Final: server assigns exactly 20 of the 40; answer all correctly.
        const exam = await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM start_assessment($1)', [PROGRAM]).then(r => r.rows[0]),
        );
        expect(exam.retake_reason).toBe('first_attempt');
        expect(exam.questions).toHaveLength(20);
        const bankIds = await db.query(
            `SELECT q->>'id' AS id FROM assessment_question_sets, jsonb_array_elements(questions) q
             WHERE program_slug=$1 AND version=$2`, [PROGRAM, VERSION],
        );
        const bank = new Set(bankIds.rows.map(r => r.id));
        expect(bank.size).toBeGreaterThanOrEqual(40);
        const assigned = (exam.questions as { id: string }[]).map(q => q.id);
        expect(new Set(assigned).size).toBe(20);
        for (const id of assigned) expect(bank.has(id)).toBe(true);
        const finalAnswers: Record<string, string> = {};
        for (const id of assigned) finalAnswers[id] = FINAL_ANSWERS[id];
        // Extra answers for non-assigned questions must be ignored.
        finalAnswers['fq-rules-1'] = FINAL_ANSWERS['fq-rules-1'];
        const final = await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM submit_assessment($1, $2)', [exam.attempt_id, finalAnswers]).then(r => r.rows[0]),
        );
        expect(Number(final.score)).toBe(100);
        expect(final.passed).toBe(true);

        // Project: user submits, service-role reviewer passes.
        const submission = await asRole(db, 'authenticated', uid, () =>
            db.query(`INSERT INTO project_submissions (program_slug, version, notes) VALUES ($1,$2,$3) RETURNING id`, [
                PROGRAM, VERSION, 'Annotated Evans Gambit game',
            ]).then(r => r.rows[0].id as string),
        );
        await db.query(
            `INSERT INTO project_reviews (submission_id, rubric, authoritative_score, passed, reviewer)
             VALUES ($1, '{"correctness": 9, "depth": 9}', 90, TRUE, 'manual-review')`, [submission],
        );

        // Issue: exactly one credential.
        const issued = await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM issue_credential($1, $2)', [PROGRAM, 'Pilot Holder']).then(r => r.rows[0]),
        );
        expect(issued.created).toBe(true);
        expect(issued.credential_id).toMatch(/^ZNX-[0-9a-f]{32}$/i);

        // Anonymous verification: exact shape and values.
        // overall = 100*.25 + 100*.30 + 100*.25 + 90*.20 = 98 -> distinction.
        const pub = await asRole(db, 'anon', null, () =>
            db.query('SELECT * FROM verify_credential($1)', [issued.credential_id]).then(r => r.rows[0]),
        );
        expect(pub.program_slug).toBe(PROGRAM);
        expect(pub.program_version).toBe(VERSION);
        expect(Number(pub.final_score)).toBe(98);
        expect(pub.grade).toBe('distinction');
        expect(pub.identity_verified).toBe(false);
        expect(pub.status).toBe('active');
        expect(pub.verified_skills).toEqual([
            { key: 'rules', name: 'Rules & Basics', score: 100 },
            { key: 'openings', name: 'Openings', score: 100 },
            { key: 'endgames', name: 'Endgames', score: 100 },
            { key: 'tactics', name: 'Tactics & Strategy', score: 100 },
        ]);

        // Progress reached passed; revoke -> revoked.
        const prog = await db.query(
            `SELECT status FROM user_credential_progress WHERE user_id=$1 AND program_slug=$2 AND program_version=$3`,
            [uid, PROGRAM, VERSION],
        );
        expect(prog.rows[0].status).toBe('passed');
        await db.query('UPDATE issued_credentials SET status=$1 WHERE credential_id=$2', ['revoked', issued.credential_id]);
        const rev = await asRole(db, 'anon', null, () =>
            db.query('SELECT * FROM verify_credential($1)', [issued.credential_id]).then(r => r.rows[0]),
        );
        expect(rev.status).toBe('revoked');
    }, 120000);
});

describe('chess pilot: negative paths', () => {
    test('missing any one requirement blocks issuance', async () => {
        // No enrollment at all.
        const u0 = newUid();
        await createUser(db, u0);
        await asRole(db, 'authenticated', u0, () =>
            expectDbDenied(db.query('SELECT * FROM issue_credential($1,$2)', [PROGRAM, 'H']), /enrollment required/),
        );

        // Enrolled but nothing else.
        const u1 = newUid();
        await createUser(db, u1);
        await asRole(db, 'authenticated', u1, () => db.query('SELECT * FROM enroll_in_program($1)', [PROGRAM]));
        await asRole(db, 'authenticated', u1, () =>
            expectDbDenied(
                db.query('SELECT * FROM issue_credential($1,$2)', [PROGRAM, 'H']),
                /component_missing_or_failed:final_assessment/,
            ),
        );

        // Failed final blocks even with everything else complete.
        const u2 = newUid();
        await createUser(db, u2);
        await asRole(db, 'authenticated', u2, () => db.query('SELECT * FROM enroll_in_program($1)', [PROGRAM]));
        await passValidations(u2, 3);
        await answerBank(u2, 'start_knowledge_attempt', 'submit_knowledge_attempt', KNOWLEDGE_ANSWERS, 'questions');
        await answerBank(u2, 'start_practical_attempt', 'submit_practical_attempt', PRACTICAL_ANSWERS, 'tasks');
        const exam = await asRole(db, 'authenticated', u2, () =>
            db.query('SELECT * FROM start_assessment($1)', [PROGRAM]).then(r => r.rows[0]),
        );
        const wrong: Record<string, string> = {};
        for (const q of exam.questions as { id: string }[]) wrong[q.id] = 'definitely wrong';
        const failed = await asRole(db, 'authenticated', u2, () =>
            db.query('SELECT * FROM submit_assessment($1, $2)', [exam.attempt_id, wrong]).then(r => r.rows[0]),
        );
        expect(failed.passed).toBe(false);
        const sub2 = await asRole(db, 'authenticated', u2, () =>
            db.query(
                `INSERT INTO project_submissions (program_slug, version) VALUES ($1,$2) RETURNING id`, [PROGRAM, VERSION],
            ).then(r => r),
        );
        await db.query(
            `INSERT INTO project_reviews (submission_id, authoritative_score, passed, reviewer) VALUES ($1, 90, TRUE, 'manual-review')`,
            [sub2.rows[0].id],
        );
        await asRole(db, 'authenticated', u2, () =>
            expectDbDenied(
                db.query('SELECT * FROM issue_credential($1,$2)', [PROGRAM, 'H']),
                /component_missing_or_failed:final_assessment/,
            ),
        );

        // Failed project blocks.
        const u3 = newUid();
        await createUser(db, u3);
        await asRole(db, 'authenticated', u3, () => db.query('SELECT * FROM enroll_in_program($1)', [PROGRAM]));
        await passValidations(u3, 3);
        await answerBank(u3, 'start_knowledge_attempt', 'submit_knowledge_attempt', KNOWLEDGE_ANSWERS, 'questions');
        await answerBank(u3, 'start_practical_attempt', 'submit_practical_attempt', PRACTICAL_ANSWERS, 'tasks');
        const exam3 = await asRole(db, 'authenticated', u3, () =>
            db.query('SELECT * FROM start_assessment($1)', [PROGRAM]).then(r => r.rows[0]),
        );
        const right3: Record<string, string> = {};
        for (const q of exam3.questions as { id: string }[]) right3[q.id] = FINAL_ANSWERS[q.id];
        await asRole(db, 'authenticated', u3, () =>
            db.query('SELECT * FROM submit_assessment($1, $2)', [exam3.attempt_id, right3]),
        );
        const sub3 = await asRole(db, 'authenticated', u3, () =>
            db.query(
                `INSERT INTO project_submissions (program_slug, version) VALUES ($1,$2) RETURNING id`, [PROGRAM, VERSION],
            ).then(r => r),
        );
        await db.query(
            `INSERT INTO project_reviews (submission_id, authoritative_score, passed, reviewer) VALUES ($1, 40, FALSE, 'manual-review')`,
            [sub3.rows[0].id],
        );
        await asRole(db, 'authenticated', u3, () =>
            expectDbDenied(
                db.query('SELECT * FROM issue_credential($1,$2)', [PROGRAM, 'H']),
                /component_missing_or_failed:project/,
            ),
        );

        // Thin skill evidence blocks (only 1 of 3 items on tactics).
        const u4 = newUid();
        await createUser(db, u4);
        await asRole(db, 'authenticated', u4, () => db.query('SELECT * FROM enroll_in_program($1)', [PROGRAM]));
        await passValidations(u4, 0);
        for (const skill of ['rules', 'openings', 'endgames']) {
            for (let i = 0; i < 3; i++) {
                const st = await asRole(db, 'authenticated', u4, () =>
                    db.query('SELECT * FROM start_trusted_validation($1, $2)', [PROGRAM, skill]).then(r => r.rows[0]),
                );
                await asRole(db, 'authenticated', u4, () =>
                    db.query('SELECT * FROM submit_trusted_validation($1, $2)', [
                        st.attempt_id, { answer: answerValidation((st.payload as { prompt: string }).prompt) },
                    ]),
                );
            }
        }
        // One tactics item only.
        const st = await asRole(db, 'authenticated', u4, () =>
            db.query('SELECT * FROM start_trusted_validation($1, $2)', [PROGRAM, 'tactics']).then(r => r.rows[0]),
        );
        await asRole(db, 'authenticated', u4, () =>
            db.query('SELECT * FROM submit_trusted_validation($1, $2)', [
                st.attempt_id, { answer: answerValidation((st.payload as { prompt: string }).prompt) },
            ]),
        );
        await answerBank(u4, 'start_knowledge_attempt', 'submit_knowledge_attempt', KNOWLEDGE_ANSWERS, 'questions');
        await answerBank(u4, 'start_practical_attempt', 'submit_practical_attempt', PRACTICAL_ANSWERS, 'tasks');
        const exam4 = await asRole(db, 'authenticated', u4, () =>
            db.query('SELECT * FROM start_assessment($1)', [PROGRAM]).then(r => r.rows[0]),
        );
        const right4: Record<string, string> = {};
        for (const q of exam4.questions as { id: string }[]) right4[q.id] = FINAL_ANSWERS[q.id];
        await asRole(db, 'authenticated', u4, () =>
            db.query('SELECT * FROM submit_assessment($1, $2)', [exam4.attempt_id, right4]),
        );
        const sub4 = await asRole(db, 'authenticated', u4, () =>
            db.query(
                `INSERT INTO project_submissions (program_slug, version) VALUES ($1,$2) RETURNING id`, [PROGRAM, VERSION],
            ).then(r => r),
        );
        await db.query(
            `INSERT INTO project_reviews (submission_id, authoritative_score, passed, reviewer) VALUES ($1, 90, TRUE, 'manual-review')`,
            [sub4.rows[0].id],
        );
        await asRole(db, 'authenticated', u4, () =>
            expectDbDenied(
                db.query('SELECT * FROM issue_credential($1,$2)', [PROGRAM, 'H']),
                /skill_gate_failed:tactics/,
            ),
        );
    }, 180000);
});

describe('chess pilot: exam policy enforcement', () => {
    test('retake cooldown, remediation, concurrent start, deadline', async () => {
        const uid = newUid();
        await createUser(db, uid);

        const first = await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM start_assessment($1)', [PROGRAM]).then(r => r.rows[0]),
        );
        expect(first.retake_reason).toBe('first_attempt');

        // Concurrent starts return the SAME active attempt.
        const run = () =>
            asRole(db2, 'authenticated', uid, () =>
                db2.query('SELECT * FROM start_assessment($1)', [PROGRAM]).then(r => r.rows[0]),
            );
        const [a, b] = await Promise.all([run(), run()]);
        expect(a.attempt_id).toBe(first.attempt_id);
        expect(b.attempt_id).toBe(first.attempt_id);
        expect(a.attempt_number).toBe(b.attempt_number);

        // Submit (fail), then immediate restart is a cooldown block.
        const wrong: Record<string, string> = {};
        for (const q of first.questions as { id: string }[]) wrong[q.id] = 'nope';
        await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM submit_assessment($1, $2)', [first.attempt_id, wrong]),
        );
        await asRole(db, 'authenticated', uid, () =>
            expectDbDenied(db.query('SELECT * FROM start_assessment($1)', [PROGRAM]), /retake_blocked:cooldown:/),
        );

        // Simulate 25h passing: second attempt allowed (server-side time travel).
        await db.query("SET app.trusted_server = 'on'");
        await db.query(
            `UPDATE assessment_attempts SET submitted_at = NOW() - INTERVAL '25 hours' WHERE id = $1`, [first.attempt_id],
        );
        await db.query("RESET app.trusted_server");
        const second = await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM start_assessment($1)', [PROGRAM]).then(r => r.rows[0]),
        );
        expect(second.attempt_number).toBe(2);
        await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM submit_assessment($1, $2)', [second.attempt_id, wrong]),
        );

        // Third attempt needs fresh server proof on failed skills.
        await db.query("SET app.trusted_server = 'on'");
        await db.query(
            `UPDATE assessment_attempts SET submitted_at = NOW() - INTERVAL '25 hours' WHERE id = $1`, [second.attempt_id],
        );
        await db.query("RESET app.trusted_server");
        await asRole(db, 'authenticated', uid, () =>
            expectDbDenied(
                db.query('SELECT * FROM start_assessment($1)', [PROGRAM]),
                /retake_blocked:remediation_required:/,
            ),
        );
        // Fresh passes on every skill unlock the retake.
        await passValidations(uid, 1);
        const third = await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM start_assessment($1)', [PROGRAM]).then(r => r.rows[0]),
        );
        expect(third.attempt_number).toBe(3);

        // Deadline: backdate past the limit, submit is rejected.
        await db.query("SET app.trusted_server = 'on'");
        await db.query(`UPDATE assessment_attempts SET deadline = NOW() - INTERVAL '1 minute' WHERE id = $1`, [
            third.attempt_id,
        ]);
        await db.query("RESET app.trusted_server");
        const right: Record<string, string> = {};
        for (const q of third.questions as { id: string }[]) right[q.id] = FINAL_ANSWERS[q.id];
        await asRole(db, 'authenticated', uid, () =>
            expectDbDenied(
                db.query('SELECT * FROM submit_assessment($1, $2)', [third.attempt_id, right]),
                /deadline_exceeded/,
            ),
        );
    }, 120000);
});
