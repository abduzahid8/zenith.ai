/**
 * Real-DB integration tests: migrations 011-017 executed against a local
 * Postgres (docker, harness in db-test/). Exercises ACTUAL auth.uid(),
 * RLS, SECURITY DEFINER functions, GRANT/REVOKE, triggers, unique
 * constraints, and concurrent finalization. Run with `npm run test:e2e`
 * (never in the unit suite).
 *
 * Units use unique user ids per test; one shared admin connection plus a
 * second connection for the concurrency test.
 */

import { Client } from 'pg';
import { adminClient, asRole, createUser, expectDbDenied, newUid } from '../../db-test/helpers';
import { CREDENTIAL_PROGRAMS } from '../domain/credentials/catalog';

let db: Client;
let db2: Client;

const TEST_PROGRAM = 'e2e-harness-program';

beforeAll(async () => {
    db = adminClient();
    await db.connect();
    db2 = adminClient();
    await db2.connect();
    // Test-only program (prod catalog rows stay untouched).
    await db.query(
        `INSERT INTO credential_programs
            (slug, code, title, level, version, required_score, requires_assessment,
             requires_project, identity_verification_required, issuance_enabled, skills, skill_gates, status)
         VALUES ('${TEST_PROGRAM}', 'E2E', 'E2E Harness Program', 'verified-skill', '1.0',
                 80, TRUE, TRUE, FALSE, TRUE,
                 '[{"key":"alpha","name":"Alpha Skill","weight":1.0,"minimumScore":65,"dayRange":[1,7]}]',
                 '[]', 'active')
         ON CONFLICT (slug) DO UPDATE SET issuance_enabled = TRUE`,
    );
    // Question set + hidden key for the harness program (service role = server).
    await db.query(
        `INSERT INTO assessment_question_sets
            (id, program_slug, version, question_count, time_limit_minutes, pass_score, questions, content_version, status)
         VALUES ('11111111-1111-1111-1111-111111111111', '${TEST_PROGRAM}', '1.0', 2, 30, 80,
                 '[{"id":"q1","prompt":"1+1?"},{"id":"q2","prompt":"2+2?"}]', 'test-v1', 'active')
         ON CONFLICT DO NOTHING`,
    );
    await db.query(
        `INSERT INTO assessment_answer_keys (question_set_id, answers, question_ids)
         VALUES ('11111111-1111-1111-1111-111111111111', '{"q1":"2","q2":"4"}', '["q1","q2"]')
         ON CONFLICT DO NOTHING`,
    );
    await db.query(
        `INSERT INTO credential_content_releases
            (program_slug, program_version, content_version, artifact_sha256,
             machine_qa_status, human_review_status, reviewer, reviewed_at, status)
         VALUES ('${TEST_PROGRAM}', '1.0', 'test-v1', 'synthetic-fixture', 'passed', 'approved',
                 'synthetic-fixture', NOW(), 'active')
         ON CONFLICT (program_slug, program_version, content_version) DO NOTHING`,
    );
    await db.query(
        `INSERT INTO skill_evidence_policy (program_slug, program_version, skill_key, min_items, min_pass_rate, rationale)
         VALUES ('${TEST_PROGRAM}', '1.0', 'alpha', 1, 0.65, 'harness: single-item depth for infra speed')
         ON CONFLICT (program_slug, program_version, skill_key) DO NOTHING`,
    );
    await db.query(
        `INSERT INTO trusted_validation_items
            (program_slug, program_version, hobby_id, curriculum_day, skill_key, lesson_id,
             content_version, status, payload, answer_key)
         VALUES ('${TEST_PROGRAM}', '1.0', 'chess', 90, 'alpha', 'e2e-lesson', 'test-v1', 'active', '{}', '{"answer":"ok"}')
         ON CONFLICT DO NOTHING`,
    );
});

afterAll(async () => {
    // Dependents first (RESTRICT guards), then the harness program row.
    await db.query(`DELETE FROM issued_credentials WHERE program_slug = '${TEST_PROGRAM}'`);
    await db.query(`DELETE FROM assessment_attempts WHERE program_slug = '${TEST_PROGRAM}'`);
    await db.query(`DELETE FROM assessment_answer_keys WHERE question_set_id = '11111111-1111-1111-1111-111111111111'`);
    await db.query(`DELETE FROM assessment_question_sets WHERE program_slug = '${TEST_PROGRAM}'`);
    await db.query(
        `DELETE FROM trusted_validation_attempts WHERE item_id IN
         (SELECT id FROM trusted_validation_items WHERE program_slug = '${TEST_PROGRAM}')`,
    );
    await db.query(`DELETE FROM trusted_validation_items WHERE program_slug = '${TEST_PROGRAM}'`);
    await db.query(`DELETE FROM project_certification_results WHERE program_slug = '${TEST_PROGRAM}'`);
    await db.query(`DELETE FROM credential_component_results WHERE program_slug = '${TEST_PROGRAM}'`);
    await db.query(`DELETE FROM user_credential_progress WHERE program_slug = '${TEST_PROGRAM}'`);
    await db.query(`DELETE FROM skill_evidence_policy WHERE program_slug = '${TEST_PROGRAM}'`);
    await db.query(`DELETE FROM credential_content_releases WHERE program_slug = '${TEST_PROGRAM}'`);
    await db.query(`DELETE FROM credential_programs WHERE slug = '${TEST_PROGRAM}'`);
    await db.end();
    await db2.end();
});

function eventRow(id: string, overrides: Record<string, unknown> = {}) {
    return {
        id,
        schema_version: 1,
        client_owner: null as string | null,
        session_id: 'sess-1',
        hobby_id: 'chess',
        program_slug: 'chess-foundations',
        program_version: '1.0',
        lesson_id: 'chess_d1',
        curriculum_day: 1,
        skill_key: 'rules',
        task_id: null,
        card_id: 'v-1',
        attempt_no: 1,
        phase: 'validate',
        session_kind: 'structured',
        origin: null,
        scope: null,
        strategy: null,
        reason_code: null,
        lesson_source: null,
        source: 'structured_session',
        event_type: 'attempt',
        outcome: 'pass',
        outcome_value: 1,
        evidence_strength: 'strong',
        provenance: 'static_bank',
        artifact_ref: null,
        occurred_at: '2026-09-10T00:00:00.000Z',
        ...overrides,
    };
}

describe('real DB: malicious client ingest (§25)', () => {
    test('forged pass/structured/validate/static_bank stays trusted=false', async () => {
        const uid = newUid();
        await createUser(db, uid);
        const id = `evt-${uid}-forged`;
        await asRole(db, 'authenticated', uid, async () => {
            const r = await db.query('SELECT * FROM upsert_learning_event($1)', [
                { ...eventRow(id), client_owner: uid },
            ]);
            expect(r.rows[0].inserted).toBe(true);
        });
        const stored = await db.query('SELECT user_id, trusted, provenance FROM learning_events WHERE id = $1', [id]);
        expect(stored.rows[0].user_id).toBe(uid);
        expect(stored.rows[0].trusted).toBe(false);
        // Retry is idempotent, still untrusted.
        await asRole(db, 'authenticated', uid, async () => {
            const r = await db.query('SELECT * FROM upsert_learning_event($1)', [
                { ...eventRow(id), client_owner: uid },
            ]);
            expect(r.rows[0].inserted).toBe(false);
        });
        expect((await db.query('SELECT COUNT(*)::int c FROM learning_events WHERE id=$1', [id])).rows[0].c).toBe(1);
    });

    test("claiming another user's ownership never attributes", async () => {
        const a = newUid();
        const b = newUid();
        await createUser(db, a);
        await createUser(db, b);
        const id = `evt-${a}-spoof`;
        await asRole(db, 'authenticated', a, async () => {
            await db.query('SELECT * FROM upsert_learning_event($1)', [
                { ...eventRow(id), client_owner: b },
            ]);
        });
        const stored = await db.query('SELECT user_id, trusted FROM learning_events WHERE id=$1', [id]);
        expect(stored.rows[0].user_id).toBeNull();
        expect(stored.rows[0].trusted).toBe(false);
        expect(await asRole(db, 'authenticated', b, () => db.query('SELECT * FROM learning_events WHERE id=$1', [id]).then(r => r.rowCount))).toBe(0);
    });

    test('legacy unattributed event stays unattributed and untrusted', async () => {
        const uid = newUid();
        await createUser(db, uid);
        const id = `evt-${uid}-legacy`;
        await asRole(db, 'authenticated', uid, async () => {
            await db.query('SELECT * FROM upsert_learning_event($1)', [
                { ...eventRow(id), client_owner: null },
            ]);
        });
        const stored = await db.query('SELECT user_id, trusted FROM learning_events WHERE id=$1', [id]);
        expect(stored.rows[0].user_id).toBeNull();
        expect(stored.rows[0].trusted).toBe(false);
    });

    test('relabeling program/skill on a registry day never yields trust', async () => {
        const uid = newUid();
        await createUser(db, uid);
        const id = `evt-${uid}-relabel`;
        await asRole(db, 'authenticated', uid, async () => {
            await db.query('SELECT * FROM upsert_learning_event($1)', [
                {
                    ...eventRow(id),
                    client_owner: uid,
                    program_slug: 'python-foundations',
                    skill_key: 'functions',
                    hobby_id: 'python',
                    lesson_id: 'python_d15',
                    curriculum_day: 15,
                },
            ]);
        });
        const stored = await db.query('SELECT trusted, program_slug, skill_key FROM learning_events WHERE id=$1', [id]);
        expect(stored.rows[0].trusted).toBe(false);
        expect(stored.rows[0].program_slug).toBe('python-foundations');
    });

    test('client cannot mint server_scored provenance', async () => {
        const uid = newUid();
        await createUser(db, uid);
        const id = `evt-${uid}-prov`;
        await asRole(db, 'authenticated', uid, async () => {
            await db.query('SELECT * FROM upsert_learning_event($1)', [
                { ...eventRow(id), client_owner: uid, provenance: 'server_scored' },
            ]);
        });
        const stored = await db.query('SELECT trusted, provenance FROM learning_events WHERE id=$1', [id]);
        expect(stored.rows[0].provenance).not.toBe('server_scored');
        expect(stored.rows[0].trusted).toBe(false);
    });
});

describe('real DB: server-scored validation flow', () => {
    // Harness seed on a synthetic day/lesson (never collides with the
    // production bank from 021). Selection is skill-scoped: tests answer
    // from the received safe payload, like a real user would.
    const ITEM = {
        program: 'chess-foundations', version: '1.0', day: 99, skill: 'rules',
        lesson: 'e2e-harness-knight',
        payload: { question: 'How does the knight move?', options: ['L-shape', 'Diagonal'] },
        key: { answer: 'L-shape' },
    };
    const ANSWERS: [string, string][] = [
        ['How does the knight move?', 'L-shape'],
        ['knight on g1', 'f3'],
        ['bishop (3) + knight (3)', '6 pawns'],
        ['Castling is ILLEGAL', 'the king is in check'],
        ['stalemated side', 'a draw'],
    ];
    const answerFor = (prompt: string): string => {
        const hit = ANSWERS.find(([frag]) => prompt.includes(frag));
        if (!hit) throw new Error(`unmapped prompt: ${prompt}`);
        return hit[1];
    };

    beforeAll(async () => {
        // Live release for the harness version (034 gate: new starts
        // require exactly one active + QA-passed + human-approved release).
        await db.query(
            `INSERT INTO credential_content_releases
                (program_slug, program_version, content_version, artifact_sha256,
                 machine_qa_status, human_review_status, reviewer, reviewed_at, status)
              VALUES ('${ITEM.program}', '${ITEM.version}', 'static-1', 'synthetic-fixture', 'passed', 'approved',
                      'synthetic-fixture', NOW(), 'active')
              ON CONFLICT (program_slug, program_version, content_version) DO NOTHING`,
        );
        await db.query(
            `INSERT INTO trusted_validation_items
                (program_slug, program_version, hobby_id, curriculum_day, skill_key, lesson_id, content_version, payload, answer_key)
              VALUES ('${ITEM.program}', '${ITEM.version}', 'chess', ${ITEM.day}, '${ITEM.skill}', '${ITEM.lesson}', 'static-1',
                      '${JSON.stringify(ITEM.payload)}', '${JSON.stringify(ITEM.key)}')
              ON CONFLICT DO NOTHING`,
        );
    });

    afterAll(async () => {
        // Remove ONLY the harness seed (production bank stays intact).
        await db.query(
            `DELETE FROM trusted_validation_attempts
              WHERE item_id IN (SELECT id FROM trusted_validation_items WHERE lesson_id = '${ITEM.lesson}')`,
        );
        await db.query(`DELETE FROM trusted_validation_items WHERE lesson_id = '${ITEM.lesson}'`);
        await db.query(
            `DELETE FROM credential_content_releases
              WHERE program_slug = '${ITEM.program}' AND program_version = '${ITEM.version}'
                AND content_version = 'static-1'`,
        );
    });

    test('start returns safe payload; keys unreadable; pass creates server proof', async () => {
        const uid = newUid();
        await createUser(db, uid);
        const started = await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM start_trusted_validation($1, $2)', [ITEM.program, ITEM.skill]).then(r => r.rows[0]),
        );
        expect(started.skill_key).toBe('rules');
        expect(started.program_version).toBe('1.0');
        // The safe payload carries options but no answer field: the client
        // cannot tell which option is correct without the hidden key.
        expect(started.payload).not.toHaveProperty('answer');
        expect(started.payload).not.toHaveProperty('answer_key');
        // Hidden keys: RLS with no client policy leaks zero rows on SELECT.
        const itemsLeak = await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM trusted_validation_items').then(r => r.rowCount),
        );
        expect(itemsLeak).toBe(0);
        const keysLeak = await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM assessment_answer_keys').then(r => r.rowCount),
        );
        expect(keysLeak).toBe(0);
        const prompt = (started.payload as { prompt?: string; question?: string }).prompt
            ?? (started.payload as { question?: string }).question!;
        const sub = await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM submit_trusted_validation($1, $2)', [started.attempt_id, { answer: answerFor(prompt) }]).then(r => r.rows[0]),
        );
        expect(sub.passed).toBe(true);
        expect(sub.submitted).toBe(true);
        expect(sub.trusted_event_id).toMatch(/^srv:trusted:/);
        const proof = await db.query('SELECT * FROM learning_events WHERE id=$1', [sub.trusted_event_id]);
        expect(proof.rows[0].trusted).toBe(true);
        expect(proof.rows[0].provenance).toBe('server_scored');
        expect(proof.rows[0].outcome).toBe('pass');
        expect(proof.rows[0].user_id).toBe(uid);
        expect(proof.rows[0].program_slug).toBe('chess-foundations');
        expect(proof.rows[0].skill_key).toBe('rules');
    });

    test('failed validation is authoritative evidence; replay is idempotent', async () => {
        const uid = newUid();
        await createUser(db, uid);
        const started = await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM start_trusted_validation($1, $2)', [ITEM.program, ITEM.skill]).then(r => r.rows[0]),
        );
        const sub = await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM submit_trusted_validation($1, $2)', [started.attempt_id, { answer: 'nope-wrong' }]).then(r => r.rows[0]),
        );
        expect(sub.passed).toBe(false);
        // Fail rows are server-vouched evidence too (trusted = verified).
        expect(sub.trusted_event_id).toMatch(/^srv:trusted:/);
        const proof = await db.query('SELECT trusted, outcome FROM learning_events WHERE id=$1', [sub.trusted_event_id]);
        expect(proof.rows[0].trusted).toBe(true);
        expect(proof.rows[0].outcome).toBe('fail');
        const replay = await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM submit_trusted_validation($1, $2)', [started.attempt_id, { answer: 'L-shape' }]).then(r => r.rows[0]),
        );
        expect(replay.submitted).toBe(false);
        expect(replay.passed).toBe(false);
    });

    test('concurrent submits: exactly one winner, no last-write-wins', async () => {
        const uid = newUid();
        await createUser(db, uid);
        const started = await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM start_trusted_validation($1, $2)', [ITEM.program, ITEM.skill]).then(r => r.rows[0]),
        );
        const prompt = (started.payload as { prompt?: string; question?: string }).prompt
            ?? (started.payload as { question?: string }).question!;
        const correct = answerFor(prompt);
        const run = (answer: string) =>
            asRole(db2, 'authenticated', uid, () =>
                db2.query('SELECT * FROM submit_trusted_validation($1, $2)', [started.attempt_id, { answer }]).then(r => r.rows[0]),
            );
        const [a, b] = await Promise.all([run(correct), run('nope-wrong')]);
        const first = a.submitted ? a : b;
        const second = a.submitted ? b : a;
        expect(first.submitted).toBe(true);
        expect(second.submitted).toBe(false);
        expect(second.passed).toBe(first.passed); // replay returns the winner's result
        const fin = await db.query('SELECT status, passed FROM trusted_validation_attempts WHERE id=$1', [started.attempt_id]);
        expect(fin.rows[0].status).toBe('submitted');
        expect(String(fin.rows[0].passed)).toBe(String(first.passed));
    });

    test('start with no trusted content is rejected', async () => {
        const uid = newUid();
        await createUser(db, uid);
        // Unknown skill on a live program: content gate passes, item lookup fails.
        await asRole(db, 'authenticated', uid, () =>
            expectDbDenied(
                db.query('SELECT * FROM start_trusted_validation($1, $2)', ['chess-foundations', 'no-such-skill']),
                /no trusted content/,
            ),
        );
        // Program with no live release: fail closed, never "no content".
        await asRole(db, 'authenticated', uid, () =>
            expectDbDenied(
                db.query('SELECT * FROM start_trusted_validation($1, $2)', ['python-foundations', 'functions']),
                /credential_content_unavailable/,
            ),
        );
    });
});

describe('real DB: assessment authority', () => {
    test('direct client INSERT of attempts is denied', async () => {
        const uid = newUid();
        await createUser(db, uid);
        await asRole(db, 'authenticated', uid, () =>
            expectDbDenied(
                db.query(
                    `INSERT INTO assessment_attempts
                        (user_id, program_slug, question_set_id, question_set_version, attempt_number)
                     VALUES ($1, '${TEST_PROGRAM}', '11111111-1111-1111-1111-111111111111', '1.0', 1)`,
                    [uid],
                ),
                /permission denied|policy/,
            ),
        );
    });

    test('start_assessment assigns set/version/number; submit scores server-side', async () => {
        const uid = newUid();
        await createUser(db, uid);
        const started = await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM start_assessment($1)', [TEST_PROGRAM]).then(r => r.rows[0]),
        );
        expect(started.attempt_number).toBe(1);
        expect(started.question_set_version).toBe('1.0');
        expect(started.questions).toHaveLength(2);
        expect(JSON.stringify(started)).not.toContain('"2"');
        // Client score write is stripped by the guard trigger.
        await asRole(db, 'authenticated', uid, () =>
            db.query('UPDATE assessment_attempts SET score=100, passed=true WHERE id=$1', [started.attempt_id]),
        );
        const after = await db.query('SELECT score, passed, status FROM assessment_attempts WHERE id=$1', [started.attempt_id]);
        expect(after.rows[0].score).toBeNull();
        expect(after.rows[0].passed).toBeNull();
        expect(after.rows[0].status).toBe('started');
        const sub = await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM submit_assessment($1, $2)', [started.attempt_id, { q1: '2', q2: 'WRONG' }]).then(r => r.rows[0]),
        );
        expect(Number(sub.score)).toBe(50);
        expect(sub.passed).toBe(false);
        // Authoritative component row exists; client did not write it.
        const comp = await db.query(
            `SELECT score, authority_source FROM credential_component_results
             WHERE user_id=$1 AND component='final_assessment'`, [uid],
        );
        expect(Number(comp.rows[0].score)).toBe(50);
        expect(comp.rows[0].authority_source).toBe('server_scored_assessment');
        // Progress moved server-side.
        const prog = await db.query('SELECT status FROM user_credential_progress WHERE user_id=$1', [uid]);
        expect(prog.rows[0].status).toBe('remediation');
    });

    test('cross-program question-set substitution is rejected', async () => {
        const uid = newUid();
        await createUser(db, uid);
        // Server-created chess attempt, then a foreign set is spliced in (service role simulates a compromised row).
        await db.query(
            `INSERT INTO assessment_question_sets (id, program_slug, version, question_count, questions)
             VALUES ('22222222-2222-2222-2222-222222222222', 'python-foundations', '1.0', 1, '[]')
             ON CONFLICT DO NOTHING`,
        );
        await db.query(
            `INSERT INTO assessment_answer_keys (question_set_id, answers, question_ids)
             VALUES ('22222222-2222-2222-2222-222222222222', '{}', '[]') ON CONFLICT DO NOTHING`,
        );
        const started = await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM start_assessment($1)', [TEST_PROGRAM]).then(r => r.rows[0]),
        );
        // Splice in a foreign set via the server path (trusted flag), simulating
        // a compromised row: submission must still reject the mismatch.
        await db.query("SET app.trusted_server = 'on'");
        await db.query('UPDATE assessment_attempts SET question_set_id=$1 WHERE id=$2', [
            '22222222-2222-2222-2222-222222222222',
            started.attempt_id,
        ]);
        await db.query("RESET app.trusted_server");
        await asRole(db, 'authenticated', uid, () =>
            expectDbDenied(
                db.query('SELECT * FROM submit_assessment($1, $2)', [started.attempt_id, {}]),
                /does not match attempt program\/version/,
            ),
        );
        await db.query('DELETE FROM assessment_answer_keys WHERE question_set_id=$1', [
            '22222222-2222-2222-2222-222222222222',
        ]);
        // The spliced attempt references the foreign set: point it back before
        // deleting, then remove the harness set (keeps the audit honest).
        await db.query("SET app.trusted_server = 'on'");
        await db.query('DELETE FROM assessment_attempts WHERE id=$1', [started.attempt_id]);
        await db.query("RESET app.trusted_server");
        await db.query('DELETE FROM assessment_question_sets WHERE id=$1', [
            '22222222-2222-2222-2222-222222222222',
        ]);
    });

    test('submitted answers lock; replay returns original', async () => {
        const uid = newUid();
        await createUser(db, uid);
        const started = await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM start_assessment($1)', [TEST_PROGRAM]).then(r => r.rows[0]),
        );
        const first = await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM submit_assessment($1, $2)', [started.attempt_id, { q1: '2', q2: '4' }]).then(r => r.rows[0]),
        );
        expect(Number(first.score)).toBe(100);
        // Post-submit UPDATE matches no row under RLS (USING status='started'):
        // it cannot error, but it mutates nothing — answers stay locked.
        const locked = await asRole(db, 'authenticated', uid, () =>
            db.query('UPDATE assessment_attempts SET answers=$1 WHERE id=$2', [{ q1: 'x' }, started.attempt_id]),
        );
        expect(locked.rowCount).toBe(0);
        const intact = await db.query('SELECT answers FROM assessment_attempts WHERE id=$1', [started.attempt_id]);
        expect(intact.rows[0].answers).toEqual({ q1: '2', q2: '4' });
        const replay = await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM submit_assessment($1, $2)', [started.attempt_id, { q1: 'x', q2: 'y' }]).then(r => r.rows[0]),
        );
        expect(replay.submitted).toBe(false);
        expect(Number(replay.score)).toBe(100);
    });
});

describe('real DB: issuance gates + verification', () => {
    test('issuance without enrollment is rejected', async () => {
        const uid = newUid();
        await createUser(db, uid);
        await asRole(db, 'authenticated', uid, () =>
            expectDbDenied(db.query('SELECT * FROM issue_credential($1, $2)', [TEST_PROGRAM, 'Holder']), /enrollment required/),
        );
    });

    test('concurrent issuance yields exactly one credential', async () => {
        const uid = newUid();
        await createUser(db, uid);
        // Enroll + full components + one server proof per required skill (alpha).
        const started = await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM start_assessment($1)', [TEST_PROGRAM]).then(r => r.rows[0]),
        );
        await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM submit_assessment($1, $2)', [started.attempt_id, { q1: '2', q2: '4' }]),
        );
        await db.query(
            `INSERT INTO project_certification_results (user_id, program_slug, version, authoritative_score, passed)
             VALUES ($1, '${TEST_PROGRAM}', '1.0', 92, TRUE) ON CONFLICT DO NOTHING`, [uid],
        );
        await db.query(
            `INSERT INTO credential_component_results (user_id, program_slug, program_version, component, score, passed, authority_source)
             VALUES ($1, '${TEST_PROGRAM}', '1.0', 'knowledge', 85, TRUE, 'server_e2e'),
                    ($1, '${TEST_PROGRAM}', '1.0', 'practical', 88, TRUE, 'server_e2e')
             ON CONFLICT DO NOTHING`, [uid],
        );
        await db.query(
            `INSERT INTO trusted_validation_items
                (program_slug, program_version, hobby_id, curriculum_day, skill_key, lesson_id,
                 content_version, status, payload, answer_key)
             VALUES ('${TEST_PROGRAM}', '1.0', 'chess', 90, 'alpha', 'e2e-lesson', 'test-v1', 'active', '{}', '{"answer":"ok"}')
             ON CONFLICT DO NOTHING`,
        );
        const v = await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM start_trusted_validation($1, $2)', [TEST_PROGRAM, 'alpha']).then(r => r.rows[0]),
        );
        await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM submit_trusted_validation($1, $2)', [v.attempt_id, { answer: 'ok' }]),
        );
        const run = () =>
            asRole(db2, 'authenticated', uid, () =>
                db2.query('SELECT * FROM issue_credential($1, $2)', [TEST_PROGRAM, 'E2E Holder']).then(r => r.rows[0]),
            );
        const [a, b] = await Promise.all([run(), run()]);
        expect(a.credential_id).toBe(b.credential_id);
        expect(a.credential_id).toMatch(/^ZNX-[0-9a-f]{32}$/i);
        expect(a.credential_id).toHaveLength(36); // ZNX- + 128-bit hex
        const count = await db.query(
            `SELECT COUNT(*)::int c FROM issued_credentials WHERE user_id=$1 AND program_slug=$2`, [uid, TEST_PROGRAM],
        );
        expect(count.rows[0].c).toBe(1);
    });

    test('verification shape is safe; revoked stays revoked', async () => {
        const uid = newUid();
        await createUser(db, uid);
        const started = await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM start_assessment($1)', [TEST_PROGRAM]).then(r => r.rows[0]),
        );
        await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM submit_assessment($1, $2)', [started.attempt_id, { q1: '2', q2: '4' }]),
        );
        await db.query(
            `INSERT INTO project_certification_results (user_id, program_slug, version, authoritative_score, passed)
             VALUES ($1, '${TEST_PROGRAM}', '1.0', 92, TRUE) ON CONFLICT DO NOTHING`, [uid],
        );
        await db.query(
            `INSERT INTO credential_component_results (user_id, program_slug, program_version, component, score, passed, authority_source)
             VALUES ($1, '${TEST_PROGRAM}', '1.0', 'knowledge', 85, TRUE, 'server_e2e'),
                    ($1, '${TEST_PROGRAM}', '1.0', 'practical', 88, TRUE, 'server_e2e')
             ON CONFLICT DO NOTHING`, [uid],
        );
        const v = await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM start_trusted_validation($1, $2)', [TEST_PROGRAM, 'alpha']).then(r => r.rows[0]),
        );
        await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM submit_trusted_validation($1, $2)', [v.attempt_id, { answer: 'ok' }]),
        );
        const issued = await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM issue_credential($1, $2)', [TEST_PROGRAM, 'E2E Holder']).then(r => r.rows[0]),
        );
        // Anonymous verification: exact public shape, nothing private.
        const pub = await asRole(db, 'anon', null, () =>
            db.query('SELECT * FROM verify_credential($1)', [issued.credential_id]).then(r => r.rows[0]),
        );
        expect(Object.keys(pub).sort()).toEqual(
            ['credential_id', 'expires_at', 'final_score', 'grade', 'holder_display_name',
             'identity_verified', 'issued_at', 'program_slug', 'program_title',
             'program_version', 'status', 'verified_skills'].sort(),
        );
        expect(pub.identity_verified).toBe(false);
        expect(pub.status).toBe('active');
        expect(pub.verified_skills).toEqual([{ key: 'alpha', name: 'Alpha Skill', score: 100 }]);
        // Revoke via service role: still verifies, as revoked.
        await db.query('UPDATE issued_credentials SET status=$1 WHERE credential_id=$2', ['revoked', issued.credential_id]);
        const rev = await asRole(db, 'anon', null, () =>
            db.query('SELECT * FROM verify_credential($1)', [issued.credential_id]).then(r => r.rows[0]),
        );
        expect(rev.status).toBe('revoked');
        // Unknown id verifies as not-found.
        const missing = await asRole(db, 'anon', null, () =>
            db.query('SELECT * FROM verify_credential($1)', ['ZNX-00000000000000000000000000000000']).then(r => r.rows),
        );
        expect(missing).toHaveLength(0);
    });

    test('anon cannot touch authority functions; trigger fns not callable', async () => {
        await expectDbDenied(
            asRole(db, 'anon', null, () => db.query('SELECT * FROM upsert_learning_event($1)', [eventRow('x')])),
            /permission denied|policy/,
        );
        await expectDbDenied(
            asRole(db, 'anon', null, () => db.query('SELECT * FROM issue_credential($1,$2)', [TEST_PROGRAM, 'H'])),
            /permission denied|policy/,
        );
        const uid = newUid();
        await createUser(db, uid);
        // Trigger helpers carry no EXECUTE for any client role (verified via
        // privilege probe: direct invocation cannot even be parsed as a call).
        const privs = await db.query(
            `SELECT has_function_privilege('authenticated', 'learning_events_derive_ownership()', 'EXECUTE') AS exec_auth,
                    has_function_privilege('anon', 'verify_credential(text)', 'EXECUTE') AS verify_anon,
                    has_function_privilege('anon', 'issue_credential(text,text)', 'EXECUTE') AS issue_anon`,
        );
        expect(privs.rows[0].exec_auth).toBe(false);
        expect(privs.rows[0].verify_anon).toBe(true); // public verification by design
        expect(privs.rows[0].issue_anon).toBe(false);
    });
});

describe('real DB: catalog parity + readiness audit', () => {
    test('server catalog matches the frozen TS catalog exactly', async () => {
        const rows = await db.query(
            `SELECT slug, code, title, version, required_score, requires_assessment,
                    requires_project, identity_verification_required, issuance_enabled, skills
             FROM credential_programs WHERE slug NOT IN ('${TEST_PROGRAM}', 'e2e-quad-integrity') ORDER BY slug`,
        );
        expect(rows.rowCount).toBe(5);
        for (const row of rows.rows) {
            const frozen = CREDENTIAL_PROGRAMS.find(p => p.slug === row.slug);
            expect(frozen).toBeDefined();
            expect(row.code).toBe(frozen!.code);
            expect(row.title).toBe(frozen!.title);
            expect(row.version).toBe(frozen!.version);
            expect(Number(row.required_score)).toBe(frozen!.requiredScore);
            expect(row.requires_assessment).toBe(true);
            expect(row.requires_project).toBe(frozen!.requiresProject);
            expect(row.identity_verification_required).toBe(frozen!.requiresIdentityVerification);
            expect(row.skills).toEqual(
                frozen!.skills.map(sk => ({
                    key: sk.key,
                    name: sk.name,
                    weight: sk.weight,
                    minimumScore: sk.minimumScore,
                    dayRange: sk.dayRange,
                })),
            );
        }
    });

    test('non-pilot programs stay blocked and content-free', async () => {
        const progs = await db.query(
            `SELECT slug, issuance_enabled FROM credential_programs
             WHERE slug NOT IN ('${TEST_PROGRAM}', 'chess-foundations', 'e2e-quad-integrity')`,
        );
        expect(progs.rowCount).toBe(4);
        for (const p of progs.rows) {
            expect(p.issuance_enabled).toBe(false);
        }
        // No sets/items/knowledge/practical banks for the other four:
        // their knowledge/practical have no server source, so issuance for
        // them MUST stay blocked.
        const sets = await db.query(
            `SELECT COUNT(*)::int c FROM assessment_question_sets
             WHERE program_slug NOT IN ('${TEST_PROGRAM}', 'chess-foundations', 'e2e-quad-integrity')`,
        );
        expect(sets.rows[0].c).toBe(0);
        const items = await db.query(
            `SELECT program_slug FROM trusted_validation_items
             WHERE program_slug NOT IN ('${TEST_PROGRAM}', 'chess-foundations', 'e2e-quad-integrity')`,
        );
        expect(items.rows).toEqual([]);
        const uid = newUid();
        await createUser(db, uid);
        await asRole(db, 'authenticated', uid, () =>
            expectDbDenied(
                db.query('SELECT * FROM issue_credential($1,$2)', ['python-foundations', 'Holder']),
                /not issuance-ready/,
            ),
        );
    });
});


describe('real DB: skill verification read model mirrors the gate', () => {
    // Each mutating test gets an isolated program (own item/release/policy)
    // so bank mutations never leak across tests and no restore is needed.
    const slugs: string[] = [];
    async function makeGateProgram(slug: string): Promise<void> {
        slugs.push(slug);
        await db.query(
            `INSERT INTO credential_programs
                (slug, code, title, level, version, required_score, requires_assessment,
                 requires_project, identity_verification_required, issuance_enabled, skills, skill_gates, status)
             VALUES ('${slug}', 'GX', 'Gate X', 'verified-skill', '1.0',
                     80, FALSE, FALSE, FALSE, FALSE,
                     '[{"key":"beta","name":"Beta Skill","weight":1.0,"minimumScore":65,"dayRange":[1,7]}]',
                     '[]', 'active')
             ON CONFLICT (slug) DO NOTHING`,
        );
        await db.query(
            `INSERT INTO skill_evidence_policy (program_slug, program_version, skill_key, min_items, min_pass_rate, rationale)
             VALUES ('${slug}', '1.0', 'beta', 1, 0.65, 'gate parity probe')
             ON CONFLICT (program_slug, program_version, skill_key) DO NOTHING`,
        );
        await db.query(
            `INSERT INTO credential_content_releases
                (program_slug, program_version, content_version, artifact_sha256,
                 machine_qa_status, human_review_status, reviewer, reviewed_at, status)
             VALUES ('${slug}', '1.0', 'gate-v1', 'synthetic', 'passed', 'approved',
                     'synthetic', NOW(), 'active')
             ON CONFLICT (program_slug, program_version, content_version) DO NOTHING`,
        );
        await db.query(
            `INSERT INTO trusted_validation_items
                (program_slug, program_version, hobby_id, curriculum_day, skill_key, lesson_id,
                 content_version, status, payload, answer_key)
             VALUES ('${slug}', '1.0', 'chess', 50, 'beta', 'gate_d50', 'gate-v1', 'active', '{}', '{"answer":"ok"}')
             ON CONFLICT DO NOTHING`,
        );
    }

    afterAll(async () => {
        for (const slug of slugs) {
            await db.query(`DELETE FROM trusted_item_results WHERE program_slug = '${slug}'`);
            await db.query(`DELETE FROM trusted_validation_attempts WHERE program_slug = '${slug}'`);
            await db.query(`DELETE FROM learning_events WHERE program_slug = '${slug}'`);
            await db.query(`DELETE FROM trusted_validation_items WHERE program_slug = '${slug}'`);
            await db.query(`DELETE FROM skill_evidence_policy WHERE program_slug = '${slug}'`);
            await db.query(`DELETE FROM credential_content_releases WHERE program_slug = '${slug}'`);
            await db.query(`DELETE FROM credential_programs WHERE slug = '${slug}'`);
        }
    });

    async function passGateValidation(uid: string, slug: string, answer = 'ok') {
        const started = await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM start_trusted_validation($1, $2)', [slug, 'beta']).then(r => r.rows[0]),
        );
        return asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM submit_trusted_validation($1, $2)', [started.attempt_id, { answer }]).then(r => r.rows[0]),
        );
    }

    async function rpcGate(uid: string, slug: string) {
        return asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM get_skill_verification($1)', [slug]).then(r => r.rows),
        );
    }

    test('passing the gate yields verified=true with the full row shape', async () => {
        const slug = 'e2e-gate-basic';
        await makeGateProgram(slug);
        const uid = newUid();
        await createUser(db, uid);
        await passGateValidation(uid, slug);
        const rows = await rpcGate(uid, slug);
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({
            skill_key: 'beta',
            skill_name: 'Beta Skill',
            samples_completed: 1,
            samples_required: 1,
            passes: 1,
            verified: true,
        });
        expect(Number(rows[0].score)).toBe(100);
    });

    test('a fail never verifies', async () => {
        const slug = 'e2e-gate-fail';
        await makeGateProgram(slug);
        const uid = newUid();
        await createUser(db, uid);
        await passGateValidation(uid, slug, 'wrong');
        const rows = await rpcGate(uid, slug);
        expect(rows[0].verified).toBe(false);
        expect(Number(rows[0].score)).toBe(0);
    });

    test('unknown program returns no rows; anon cannot call the RPC', async () => {
        const uid = newUid();
        await createUser(db, uid);
        const rows = await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM get_skill_verification($1)', ['nope']).then(r => r.rows),
        );
        expect(rows).toHaveLength(0);
        await expectDbDenied(
            asRole(db, 'anon', null, () =>
                db.query('SELECT * FROM get_skill_verification($1)', ['chess-foundations']),
            ),
            /permission denied/,
        );
    });

    test('compromised item loses authority (matches issuance exclusion)', async () => {
        const slug = 'e2e-gate-compromised';
        await makeGateProgram(slug);
        const uid = newUid();
        await createUser(db, uid);
        await passGateValidation(uid, slug);
        expect((await rpcGate(uid, slug))[0].verified).toBe(true);
        await db.query(
            `UPDATE trusted_validation_items SET status = 'compromised'
             WHERE program_slug = '${slug}'`,
        );
        expect((await rpcGate(uid, slug))[0].verified).toBe(false);
    });

    test('retired or unapproved release loses authority', async () => {
        const slug = 'e2e-gate-release';
        await makeGateProgram(slug);
        const uid = newUid();
        await createUser(db, uid);
        await passGateValidation(uid, slug);
        await db.query(
            `UPDATE credential_content_releases SET status = 'retired'
             WHERE program_slug = '${slug}'`,
        );
        expect((await rpcGate(uid, slug))[0].verified).toBe(false);
        await db.query(
            `UPDATE credential_content_releases SET status = 'active', human_review_status = 'pending'
             WHERE program_slug = '${slug}'`,
        );
        expect((await rpcGate(uid, slug))[0].verified).toBe(false);
    });

    test('policy depth is enforced, not just the rate', async () => {
        const slug = 'e2e-gate-policy';
        await makeGateProgram(slug);
        const uid = newUid();
        await createUser(db, uid);
        await passGateValidation(uid, slug);
        await db.query(
            `UPDATE skill_evidence_policy SET min_items = 2
             WHERE program_slug = '${slug}'`,
        );
        const rows = await rpcGate(uid, slug);
        expect(rows[0].verified).toBe(false);
        expect(rows[0].samples_required).toBe(2);
    });
});
