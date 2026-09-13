/**
 * Real-DB integration tests: attempt-lifecycle hardening (migration 035).
 *
 * - One active trusted attempt per (user, program, version, skill):
 *   reopening resumes instead of enumerating the bank.
 * - `superseded` lifecycle: rotation retires in-flight attempts; stale
 *   submits record zero proof and report content_stale (never raise).
 * - Stale component passes never block fresh attempts; best-wins holds
 *   only among authoritative results.
 * - Missing banks and direct helper calls fail closed.
 *
 * Isolated slugs per test (one shared DB per invocation). Run with
 * `npm run test:e2e`.
 */

import { Client } from 'pg';
import { adminClient, asRole, createUser, expectDbDenied, newUid } from '../../db-test/helpers';

let db: Client;

const SKILLS = '[{"key":"alpha","name":"Alpha Skill","weight":1.0,"minimumScore":65,"dayRange":[1,7]}]';

async function makeProgram(slug: string): Promise<void> {
    await db.query(
        `INSERT INTO credential_programs
            (slug, code, title, level, version, required_score, requires_assessment,
             requires_project, identity_verification_required, issuance_enabled, skills, skill_gates, status)
         VALUES ('${slug}', 'LC', 'Lifecycle Harness', 'verified-skill', '1.0',
                 80, TRUE, FALSE, FALSE, FALSE, '${SKILLS}', '[]', 'active')
         ON CONFLICT (slug) DO NOTHING`,
    );
    await db.query(
        `INSERT INTO skill_evidence_policy (program_slug, program_version, skill_key, min_items, min_pass_rate, rationale)
         VALUES ('${slug}', '1.0', 'alpha', 1, 0.65, 'lifecycle probe')
         ON CONFLICT (program_slug, program_version, skill_key) DO NOTHING`,
    );
}

async function addRelease(slug: string, version: string, status: string): Promise<void> {
    await db.query(
        `INSERT INTO credential_content_releases
            (program_slug, program_version, content_version, artifact_sha256,
             machine_qa_status, human_review_status, reviewer, reviewed_at, status)
         VALUES ('${slug}', '1.0', '${version}', 'synthetic-fixture', 'passed', 'approved',
                 'synthetic-fixture', NOW(), '${status}')
         ON CONFLICT (program_slug, program_version, content_version)
         DO UPDATE SET status = EXCLUDED.status`,
    );
}

async function addTrustedItem(slug: string, version: string, lesson: string, day: number): Promise<void> {
    await db.query(
        `INSERT INTO trusted_validation_items
            (program_slug, program_version, hobby_id, curriculum_day, skill_key, lesson_id,
             content_version, status, payload, answer_key)
         VALUES ('${slug}', '1.0', 'chess', ${day}, 'alpha', '${lesson}', '${version}', 'active',
                 '{"prompt":"Q?"}', '{"answer":"ok"}')
         ON CONFLICT DO NOTHING`,
    );
}

async function addKnowledgeItem(slug: string, version: string, key: string): Promise<void> {
    await db.query(
        `INSERT INTO knowledge_items (program_slug, program_version, skill_key, item_key, content_version, status, payload, answer_key)
         VALUES ('${slug}', '1.0', 'alpha', '${key}', '${version}', 'active', '{"prompt":"K?"}', '{"answer":"ok"}')
         ON CONFLICT (program_slug, program_version, content_version, item_key) DO NOTHING`,
    );
}

async function addPracticalItem(slug: string, version: string, key: string): Promise<void> {
    await db.query(
        `INSERT INTO practical_items (program_slug, program_version, skill_key, item_key, content_version, status, payload, answer_key)
         VALUES ('${slug}', '1.0', 'alpha', '${key}', '${version}', 'active', '{"task":"P"}', '{"answer":"ok"}')
         ON CONFLICT (program_slug, program_version, content_version, item_key) DO NOTHING`,
    );
}

async function addQuestionSet(slug: string, id: string, version: string): Promise<void> {
    await db.query(
        `INSERT INTO assessment_question_sets
            (id, program_slug, version, question_count, time_limit_minutes, pass_score, questions, content_version, status)
         VALUES ('${id}', '${slug}', '1.0', 1, 30, 80,
                 '[{"id":"q1","skill":"alpha","prompt":"1+1?"}]', '${version}', 'active')
         ON CONFLICT DO NOTHING`,
    );
    await db.query(
        `INSERT INTO assessment_answer_keys (question_set_id, answers, question_ids)
         VALUES ('${id}', '{"q1":"2"}', '["q1"]')
         ON CONFLICT DO NOTHING`,
    );
}

async function retireVersion(slug: string, version: string): Promise<void> {
    await db.query(
        `UPDATE credential_content_releases SET status = 'retired'
         WHERE program_slug = '${slug}' AND content_version = '${version}'`,
    );
    await db.query(
        `UPDATE trusted_validation_items SET status = 'retired'
         WHERE program_slug = '${slug}' AND content_version = '${version}'`,
    );
    await db.query(
        `UPDATE knowledge_items SET status = 'retired'
         WHERE program_slug = '${slug}' AND content_version = '${version}'`,
    );
    await db.query(
        `UPDATE practical_items SET status = 'retired'
         WHERE program_slug = '${slug}' AND content_version = '${version}'`,
    );
    await db.query(
        `UPDATE assessment_question_sets SET status = 'retired'
         WHERE program_slug = '${slug}' AND content_version = '${version}'`,
    );
}

async function wipeProgram(slug: string): Promise<void> {
    await db.query(`DELETE FROM trusted_item_results WHERE program_slug = '${slug}'`);
    await db.query(`DELETE FROM trusted_validation_attempts WHERE program_slug = '${slug}'`);
    await db.query(`DELETE FROM knowledge_attempts WHERE program_slug = '${slug}'`);
    await db.query(`DELETE FROM practical_attempts WHERE program_slug = '${slug}'`);
    await db.query(`DELETE FROM assessment_attempts WHERE program_slug = '${slug}'`);
    await db.query(`DELETE FROM learning_events WHERE program_slug = '${slug}'`);
    await db.query(
        `DELETE FROM assessment_answer_keys WHERE question_set_id IN
         (SELECT id FROM assessment_question_sets WHERE program_slug = '${slug}')`,
    );
    await db.query(`DELETE FROM assessment_question_sets WHERE program_slug = '${slug}'`);
    await db.query(`DELETE FROM trusted_validation_items WHERE program_slug = '${slug}'`);
    await db.query(`DELETE FROM knowledge_items WHERE program_slug = '${slug}'`);
    await db.query(`DELETE FROM practical_items WHERE program_slug = '${slug}'`);
    await db.query(`DELETE FROM credential_component_results WHERE program_slug = '${slug}'`);
    await db.query(`DELETE FROM user_credential_progress WHERE program_slug = '${slug}'`);
    await db.query(`DELETE FROM skill_evidence_policy WHERE program_slug = '${slug}'`);
    await db.query(`DELETE FROM credential_content_releases WHERE program_slug = '${slug}'`);
    await db.query(`DELETE FROM credential_programs WHERE slug = '${slug}'`);
}

function startTrusted(uid: string, slug: string, dbc: Client = db) {
    return asRole(dbc, 'authenticated', uid, () =>
        dbc.query('SELECT * FROM start_trusted_validation($1, $2)', [slug, 'alpha']).then(r => r.rows[0]),
    );
}

/**
 * Migration 036 readiness: new Finals require a verified skill plus live
 * Knowledge/Practical passes. Real passes over live bank rows.
 */
async function readyFinalLive(uid: string, slug: string): Promise<void> {
    const t = await asRole(db, 'authenticated', uid, () =>
        db.query('SELECT * FROM start_trusted_validation($1, $2)', [slug, 'alpha']).then(r => r.rows[0]),
    );
    await asRole(db, 'authenticated', uid, () =>
        db.query('SELECT * FROM submit_trusted_validation($1, $2)', [t.attempt_id, { answer: 'ok' }]),
    );
    for (const [fn, sub, field] of [
        ['start_knowledge_attempt', 'submit_knowledge_attempt', 'questions'],
        ['start_practical_attempt', 'submit_practical_attempt', 'tasks'],
    ] as const) {
        const st = await asRole(db, 'authenticated', uid, () =>
            db.query(`SELECT * FROM ${fn}($1)`, [slug]).then(r => r.rows[0]),
        );
        const items = st[field] as { item_key: string }[];
        const answers: Record<string, string> = {};
        for (const it of items) answers[it.item_key] = 'ok';
        await asRole(db, 'authenticated', uid, () =>
            db.query(`SELECT * FROM ${sub}($1, $2)`, [st.attempt_id, answers]),
        );
    }
}

beforeAll(async () => {
    db = adminClient();
    await db.connect();
});

afterAll(async () => {
    await db.end();
});

describe('real DB: trusted attempt reuse', () => {
    test('1/2. repeated starts return the same attempt; reopening cannot enumerate', async () => {
        const slug = 'e2e-life-reuse';
        await makeProgram(slug);
        await addRelease(slug, 'live-v1', 'active');
        await addTrustedItem(slug, 'live-v1', 'lesson-a', 90);
        await addTrustedItem(slug, 'live-v1', 'lesson-b', 91);
        const uid = newUid();
        await createUser(db, uid);
        try {
            const first = await startTrusted(uid, slug);
            const second = await startTrusted(uid, slug);
            const third = await startTrusted(uid, slug);
            expect(second.attempt_id).toBe(first.attempt_id);
            expect(third.attempt_id).toBe(first.attempt_id);
            expect(second.payload).toEqual(first.payload);
            const rows = await db.query(
                `SELECT COUNT(*)::int c FROM trusted_validation_attempts
                 WHERE user_id = $1 AND status = 'started'`,
                [uid],
            );
            expect(rows.rows[0].c).toBe(1);
        } finally {
            await wipeProgram(slug);
        }
    });

    test('3. concurrent trusted starts create exactly one active attempt', async () => {
        const slug = 'e2e-life-race';
        await makeProgram(slug);
        await addRelease(slug, 'live-v1', 'active');
        await addTrustedItem(slug, 'live-v1', 'lesson-a', 90);
        const uid = newUid();
        await createUser(db, uid);
        const conns = [adminClient(), adminClient(), adminClient()];
        try {
            await Promise.all(conns.map(c => c.connect()));
            const results = await Promise.all(conns.map(c => startTrusted(uid, slug, c)));
            const ids = new Set(results.map(r => r.attempt_id));
            expect(ids.size).toBe(1);
            const rows = await db.query(
                `SELECT COUNT(*)::int c FROM trusted_validation_attempts
                 WHERE user_id = $1 AND status = 'started'`,
                [uid],
            );
            expect(rows.rows[0].c).toBe(1);
        } finally {
            await Promise.all(conns.map(c => c.end().catch(() => undefined)));
            await wipeProgram(slug);
        }
    });

    test('4. a submitted attempt allows the next independent item', async () => {
        const slug = 'e2e-life-next';
        await makeProgram(slug);
        await addRelease(slug, 'live-v1', 'active');
        await addTrustedItem(slug, 'live-v1', 'lesson-a', 90);
        await addTrustedItem(slug, 'live-v1', 'lesson-b', 91);
        const uid = newUid();
        await createUser(db, uid);
        try {
            const first = await startTrusted(uid, slug);
            await asRole(db, 'authenticated', uid, () =>
                db.query('SELECT * FROM submit_trusted_validation($1, $2)', [first.attempt_id, { answer: 'ok' }]),
            );
            const second = await startTrusted(uid, slug);
            expect(second.attempt_id).not.toBe(first.attempt_id);
            const items = await db.query(
                `SELECT item_id FROM trusted_validation_attempts WHERE id IN ($1, $2)`,
                [first.attempt_id, second.attempt_id],
            );
            expect(items.rows[0].item_id).not.toBe(items.rows[1].item_id);
        } finally {
            await wipeProgram(slug);
        }
    });
});

describe('real DB: rotation supersedes in-flight attempts', () => {
    test('5. rotation supersedes an old started trusted attempt', async () => {
        const slug = 'e2e-life-sup-t';
        await makeProgram(slug);
        await addRelease(slug, 'live-v1', 'active');
        await addTrustedItem(slug, 'live-v1', 'lesson-a', 90);
        const uid = newUid();
        await createUser(db, uid);
        try {
            const old = await startTrusted(uid, slug);
            await retireVersion(slug, 'live-v1');
            await addRelease(slug, 'live-v2', 'active');
            await addTrustedItem(slug, 'live-v2', 'lesson-b', 90);
            const fresh = await startTrusted(uid, slug);
            expect(fresh.attempt_id).not.toBe(old.attempt_id);
            const statuses = await db.query(
                `SELECT id, status, content_version FROM trusted_validation_attempts WHERE user_id = $1 ORDER BY started_at`,
                [uid],
            );
            expect(statuses.rows).toHaveLength(2);
            expect(statuses.rows[0]).toMatchObject({ status: 'superseded', content_version: 'live-v1' });
            expect(statuses.rows[1]).toMatchObject({ status: 'started', content_version: 'live-v2' });
        } finally {
            await wipeProgram(slug);
        }
    });

    test('6/7. rotation supersedes old knowledge and practical attempts', async () => {
        const slug = 'e2e-life-sup-kp';
        await makeProgram(slug);
        await addRelease(slug, 'live-v1', 'active');
        await addKnowledgeItem(slug, 'live-v1', 'k1');
        await addPracticalItem(slug, 'live-v1', 'p1');
        const uid = newUid();
        await createUser(db, uid);
        try {
            const kOld = await asRole(db, 'authenticated', uid, () =>
                db.query('SELECT * FROM start_knowledge_attempt($1)', [slug]).then(r => r.rows[0]),
            );
            const pOld = await asRole(db, 'authenticated', uid, () =>
                db.query('SELECT * FROM start_practical_attempt($1)', [slug]).then(r => r.rows[0]),
            );
            await retireVersion(slug, 'live-v1');
            await addRelease(slug, 'live-v2', 'active');
            await addKnowledgeItem(slug, 'live-v2', 'k1');
            await addPracticalItem(slug, 'live-v2', 'p1');
            const kNew = await asRole(db, 'authenticated', uid, () =>
                db.query('SELECT * FROM start_knowledge_attempt($1)', [slug]).then(r => r.rows[0]),
            );
            const pNew = await asRole(db, 'authenticated', uid, () =>
                db.query('SELECT * FROM start_practical_attempt($1)', [slug]).then(r => r.rows[0]),
            );
            expect(kNew.attempt_id).not.toBe(kOld.attempt_id);
            expect(pNew.attempt_id).not.toBe(pOld.attempt_id);
            const kRows = await db.query(
                `SELECT status FROM knowledge_attempts WHERE user_id = $1 ORDER BY started_at`,
                [uid],
            );
            expect(kRows.rows.map(r => r.status)).toEqual(['superseded', 'started']);
            const pRows = await db.query(
                `SELECT status FROM practical_attempts WHERE user_id = $1 ORDER BY started_at`,
                [uid],
            );
            expect(pRows.rows.map(r => r.status)).toEqual(['superseded', 'started']);
        } finally {
            await wipeProgram(slug);
        }
    });

    test('8. rotation supersedes an old started final attempt', async () => {
        const slug = 'e2e-life-sup-f';
        await makeProgram(slug);
        await addRelease(slug, 'live-v1', 'active');
        await addTrustedItem(slug, 'live-v1', 'lesson-a', 90);
        await addKnowledgeItem(slug, 'live-v1', 'k1');
        await addPracticalItem(slug, 'live-v1', 'p1');
        await addQuestionSet(slug, '11111111-2222-4333-8444-555555555555', 'live-v1');
        const uid = newUid();
        await createUser(db, uid);
        try {
            await readyFinalLive(uid, slug);
            const old = await asRole(db, 'authenticated', uid, () =>
                db.query('SELECT * FROM start_assessment($1)', [slug]).then(r => r.rows[0]),
            );
            await retireVersion(slug, 'live-v1');
            await addRelease(slug, 'live-v2', 'active');
            await addTrustedItem(slug, 'live-v2', 'lesson-b', 90);
            await addKnowledgeItem(slug, 'live-v2', 'k1');
            await addPracticalItem(slug, 'live-v2', 'p1');
            await addQuestionSet(slug, '22222222-3333-4444-8555-666666666666', 'live-v2');
            await readyFinalLive(uid, slug);
            const fresh = await asRole(db, 'authenticated', uid, () =>
                db.query('SELECT * FROM start_assessment($1)', [slug]).then(r => r.rows[0]),
            );
            expect(fresh.attempt_id).not.toBe(old.attempt_id);
            expect(fresh.retake_reason).not.toBe('active_attempt');
            const rows = await db.query(
                `SELECT status, bank_version FROM assessment_attempts WHERE user_id = $1 ORDER BY started_at`,
                [uid],
            );
            expect(rows.rows).toHaveLength(2);
            expect(rows.rows[0]).toMatchObject({ status: 'superseded', bank_version: 'live-v1' });
            expect(rows.rows[1]).toMatchObject({ status: 'started', bank_version: 'live-v2' });
        } finally {
            await wipeProgram(slug);
        }
    });
});

describe('real DB: stale submits record zero proof', () => {
    test('9. stale trusted submit creates zero authoritative proof', async () => {
        const slug = 'e2e-life-stale-t';
        await makeProgram(slug);
        await addRelease(slug, 'live-v1', 'active');
        await addTrustedItem(slug, 'live-v1', 'lesson-a', 90);
        const uid = newUid();
        await createUser(db, uid);
        try {
            const old = await startTrusted(uid, slug);
            await retireVersion(slug, 'live-v1');
            await addRelease(slug, 'live-v2', 'active');
            await addTrustedItem(slug, 'live-v2', 'lesson-b', 90);
            const res = await asRole(db, 'authenticated', uid, () =>
                db.query('SELECT * FROM submit_trusted_validation($1, $2)', [old.attempt_id, { answer: 'ok' }]).then(
                    r => r.rows[0],
                ),
            );
            expect(res.content_stale).toBe(true);
            expect(res.passed).toBe(false);
            expect(res.submitted).toBe(false);
            expect(res.trusted_event_id).toBeNull();
            const attempt = await db.query(`SELECT status FROM trusted_validation_attempts WHERE id = $1`, [
                old.attempt_id,
            ]);
            expect(attempt.rows[0].status).toBe('superseded');
            const proof = await db.query(`SELECT COUNT(*)::int c FROM trusted_item_results WHERE user_id = $1`, [uid]);
            expect(proof.rows[0].c).toBe(0);
            const events = await db.query(
                `SELECT COUNT(*)::int c FROM learning_events WHERE id = $1`,
                [`srv:trusted:${old.attempt_id}:0`],
            );
            expect(events.rows[0].c).toBe(0);
            const gate = await asRole(db, 'authenticated', uid, () =>
                db.query('SELECT * FROM get_skill_verification($1)', [slug]).then(r => r.rows),
            );
            expect(gate[0].samples_completed).toBe(0);
            // Re-submitting the same attempt stays stale-structured, never throws.
            const again = await asRole(db, 'authenticated', uid, () =>
                db.query('SELECT * FROM submit_trusted_validation($1, $2)', [old.attempt_id, { answer: 'ok' }]).then(
                    r => r.rows[0],
                ),
            );
            expect(again.content_stale).toBe(true);
        } finally {
            await wipeProgram(slug);
        }
    });

    test('10/11. stale knowledge and practical submits write no component', async () => {
        const slug = 'e2e-life-stale-kp';
        await makeProgram(slug);
        await addRelease(slug, 'live-v1', 'active');
        await addKnowledgeItem(slug, 'live-v1', 'k1');
        await addPracticalItem(slug, 'live-v1', 'p1');
        const uid = newUid();
        await createUser(db, uid);
        try {
            const kOld = await asRole(db, 'authenticated', uid, () =>
                db.query('SELECT * FROM start_knowledge_attempt($1)', [slug]).then(r => r.rows[0]),
            );
            const pOld = await asRole(db, 'authenticated', uid, () =>
                db.query('SELECT * FROM start_practical_attempt($1)', [slug]).then(r => r.rows[0]),
            );
            await retireVersion(slug, 'live-v1');
            await addRelease(slug, 'live-v2', 'active');
            await addKnowledgeItem(slug, 'live-v2', 'k1');
            await addPracticalItem(slug, 'live-v2', 'p1');
            const kRes = await asRole(db, 'authenticated', uid, () =>
                db.query('SELECT * FROM submit_knowledge_attempt($1, $2)', [kOld.attempt_id, { k1: 'ok' }]).then(
                    r => r.rows[0],
                ),
            );
            expect(kRes.content_stale).toBe(true);
            expect(kRes.score).toBeNull();
            const pRes = await asRole(db, 'authenticated', uid, () =>
                db.query('SELECT * FROM submit_practical_attempt($1, $2)', [pOld.attempt_id, { p1: 'ok' }]).then(
                    r => r.rows[0],
                ),
            );
            expect(pRes.content_stale).toBe(true);
            const comps = await db.query(
                `SELECT COUNT(*)::int c FROM credential_component_results WHERE user_id = $1`,
                [uid],
            );
            expect(comps.rows[0].c).toBe(0);
            const kStatus = await db.query(`SELECT status FROM knowledge_attempts WHERE id = $1`, [kOld.attempt_id]);
            expect(kStatus.rows[0].status).toBe('superseded');
            const pStatus = await db.query(`SELECT status FROM practical_attempts WHERE id = $1`, [pOld.attempt_id]);
            expect(pStatus.rows[0].status).toBe('superseded');
        } finally {
            await wipeProgram(slug);
        }
    });

    test('12. stale final submit writes no component', async () => {
        const slug = 'e2e-life-stale-f';
        await makeProgram(slug);
        await addRelease(slug, 'live-v1', 'active');
        await addTrustedItem(slug, 'live-v1', 'lesson-a', 90);
        await addKnowledgeItem(slug, 'live-v1', 'k1');
        await addPracticalItem(slug, 'live-v1', 'p1');
        await addQuestionSet(slug, '33333333-4444-4555-8666-777777777777', 'live-v1');
        const uid = newUid();
        await createUser(db, uid);
        try {
            await readyFinalLive(uid, slug);
            const old = await asRole(db, 'authenticated', uid, () =>
                db.query('SELECT * FROM start_assessment($1)', [slug]).then(r => r.rows[0]),
            );
            await retireVersion(slug, 'live-v1');
            await addRelease(slug, 'live-v2', 'active');
            await addQuestionSet(slug, '44444444-5555-4666-8777-888888888888', 'live-v2');
            const res = await asRole(db, 'authenticated', uid, () =>
                db.query('SELECT * FROM submit_assessment($1, $2)', [old.attempt_id, { q1: '2' }]).then(r => r.rows[0]),
            );
            expect(res.content_stale).toBe(true);
            expect(res.score).toBeNull();
            expect(res.passed).toBe(false);
            // The stale Final writes no final component (readiness K/P
            // passes from setup remain untouched).
            const comps = await db.query(
                `SELECT COUNT(*)::int c FROM credential_component_results
                 WHERE user_id = $1 AND component = 'final_assessment'`,
                [uid],
            );
            expect(comps.rows[0].c).toBe(0);
            const status = await db.query(`SELECT status FROM assessment_attempts WHERE id = $1`, [old.attempt_id]);
            expect(status.rows[0].status).toBe('superseded');
        } finally {
            await wipeProgram(slug);
        }
    });
});

describe('real DB: stale components never strand retakes', () => {
    test('13/14. stale PASS cannot block; fresh live PASS writes normally', async () => {
        const slug = 'e2e-life-recovery';
        await makeProgram(slug);
        await addRelease(slug, 'live-v1', 'active');
        await addKnowledgeItem(slug, 'live-v1', 'k1');
        const uid = newUid();
        await createUser(db, uid);
        try {
            // A passed attempt from the old world (submitted while live).
            const old = await asRole(db, 'authenticated', uid, () =>
                db.query('SELECT * FROM start_knowledge_attempt($1)', [slug]).then(r => r.rows[0]),
            );
            await asRole(db, 'authenticated', uid, () =>
                db.query('SELECT * FROM submit_knowledge_attempt($1, $2)', [old.attempt_id, { k1: 'ok' }]),
            );
            // Rotation strands that reference: the stored PASS is stale now.
            await retireVersion(slug, 'live-v1');
            await addRelease(slug, 'live-v2', 'active');
            await addKnowledgeItem(slug, 'live-v2', 'k1');
            // A fresh attempt must NOT be refused.
            const fresh = await asRole(db, 'authenticated', uid, () =>
                db.query('SELECT * FROM start_knowledge_attempt($1)', [slug]).then(r => r.rows[0]),
            );
            expect(fresh.attempt_id).not.toBe(old.attempt_id);
            // And its live PASS overwrites the stale reference (best-wins yields).
            const sub = await asRole(db, 'authenticated', uid, () =>
                db.query('SELECT * FROM submit_knowledge_attempt($1, $2)', [fresh.attempt_id, { k1: 'ok' }]).then(
                    r => r.rows[0],
                ),
            );
            expect(sub.content_stale).toBe(false);
            expect(sub.passed).toBe(true);
            const comp = await db.query(
                `SELECT passed, score, reference_id FROM credential_component_results
                 WHERE user_id = $1 AND component = 'knowledge'`,
                [uid],
            );
            expect(comp.rows[0].passed).toBe(true);
            expect(comp.rows[0].reference_id).toBe(fresh.attempt_id);
        } finally {
            await wipeProgram(slug);
        }
    });

    test('15. best-wins still holds between two authoritative results', async () => {
        const slug = 'e2e-life-bestwins';
        await makeProgram(slug);
        await addRelease(slug, 'live-v1', 'active');
        await addKnowledgeItem(slug, 'live-v1', 'k1');
        const uid = newUid();
        await createUser(db, uid);
        try {
            const att = await asRole(db, 'authenticated', uid, () =>
                db.query('SELECT * FROM start_knowledge_attempt($1)', [slug]).then(r => r.rows[0]),
            );
            // Seed an authoritative pass directly (trigger semantics under test).
            await db.query(
                `INSERT INTO credential_component_results
                    (user_id, program_slug, program_version, component, score, passed,
                     authority_source, reference_id)
                 VALUES ($1, '${slug}', '1.0', 'knowledge', 60, TRUE, 'seed', $2)
                 ON CONFLICT (user_id, program_slug, program_version, component) DO NOTHING`,
                [uid, att.attempt_id],
            );
            // A lower authoritative score must NOT overwrite the pass.
            await db.query(
                `INSERT INTO credential_component_results
                    (user_id, program_slug, program_version, component, score, passed,
                     authority_source, reference_id)
                 VALUES ($1, '${slug}', '1.0', 'knowledge', 50, TRUE, 'seed', $2)
                 ON CONFLICT (user_id, program_slug, program_version, component)
                 DO UPDATE SET score = EXCLUDED.score, passed = EXCLUDED.passed,
                               authority_source = EXCLUDED.authority_source,
                               reference_id = EXCLUDED.reference_id, created_at = NOW()`,
                [uid, att.attempt_id],
            );
            const kept = await db.query(
                `SELECT score FROM credential_component_results
                 WHERE user_id = $1 AND component = 'knowledge'`,
                [uid],
            );
            expect(Number(kept.rows[0].score)).toBe(60);
            // A higher authoritative score overwrites.
            await db.query(
                `INSERT INTO credential_component_results
                    (user_id, program_slug, program_version, component, score, passed,
                     authority_source, reference_id)
                 VALUES ($1, '${slug}', '1.0', 'knowledge', 90, TRUE, 'seed', $2)
                 ON CONFLICT (user_id, program_slug, program_version, component)
                 DO UPDATE SET score = EXCLUDED.score, passed = EXCLUDED.passed,
                               authority_source = EXCLUDED.authority_source,
                               reference_id = EXCLUDED.reference_id, created_at = NOW()`,
                [uid, att.attempt_id],
            );
            const raised = await db.query(
                `SELECT score FROM credential_component_results WHERE user_id = $1 AND component = 'knowledge'`,
                [uid],
            );
            expect(Number(raised.rows[0].score)).toBe(90);
        } finally {
            await wipeProgram(slug);
        }
    });

    test('16. compromised content behaves exactly like retired content', async () => {
        const slug = 'e2e-life-compromised';
        await makeProgram(slug);
        await addRelease(slug, 'live-v1', 'active');
        await addTrustedItem(slug, 'live-v1', 'lesson-a', 90);
        const uid = newUid();
        await createUser(db, uid);
        try {
            const old = await startTrusted(uid, slug);
            // Compromise behaves like retirement: rows stand down, the
            // release can never be live again.
            await retireVersion(slug, 'live-v1');
            await db.query(
                `UPDATE credential_content_releases SET status = 'compromised'
                 WHERE program_slug = '${slug}' AND content_version = 'live-v1'`,
            );
            await addRelease(slug, 'live-v2', 'active');
            await addTrustedItem(slug, 'live-v2', 'lesson-b', 90);
            // New starts skip the compromised version…
            const fresh = await startTrusted(uid, slug);
            expect(fresh.attempt_id).not.toBe(old.attempt_id);
            const oldRow = await db.query(`SELECT status FROM trusted_validation_attempts WHERE id = $1`, [
                old.attempt_id,
            ]);
            expect(oldRow.rows[0].status).toBe('superseded');
            // …and submits against it record zero proof.
            // (Re-create a started attempt on the compromised version is
            // impossible via starts; submit the pre-compromise attempt.)
            const res = await asRole(db, 'authenticated', uid, () =>
                db.query('SELECT * FROM submit_trusted_validation($1, $2)', [old.attempt_id, { answer: 'ok' }]).then(
                    r => r.rows[0],
                ),
            );
            expect(res.content_stale).toBe(true);
            const proof = await db.query(`SELECT COUNT(*)::int c FROM trusted_item_results WHERE user_id = $1`, [uid]);
            expect(proof.rows[0].c).toBe(0);
        } finally {
            await wipeProgram(slug);
        }
    });
});

describe('real DB: gate errors and helper privileges', () => {
    test('17. missing banks under a live release report unavailable', async () => {
        const slug = 'e2e-life-empty';
        await makeProgram(slug);
        await addRelease(slug, 'live-v1', 'active');
        const uid = newUid();
        await createUser(db, uid);
        try {
            await expectDbDenied(startTrusted(uid, slug), /credential_content_unavailable/);
            await expectDbDenied(
                asRole(db, 'authenticated', uid, () =>
                    db.query('SELECT * FROM start_knowledge_attempt($1)', [slug]),
                ),
                /credential_content_unavailable/,
            );
            await expectDbDenied(
                asRole(db, 'authenticated', uid, () =>
                    db.query('SELECT * FROM start_practical_attempt($1)', [slug]),
                ),
                /credential_content_unavailable/,
            );
            await expectDbDenied(
                asRole(db, 'authenticated', uid, () =>
                    db.query('SELECT * FROM start_assessment($1)', [slug]).then(r => r.rows),
                ),
                /credential_content_unavailable/,
            );
        } finally {
            await wipeProgram(slug);
        }
    });

    test('18. live-release helpers reject direct authenticated calls', async () => {
        const uid = newUid();
        await createUser(db, uid);
        for (const fn of [
            `SELECT * FROM current_live_content_version('x', '1.0')`,
            `SELECT * FROM live_content_version_or_null('x', '1.0')`,
            `SELECT * FROM component_reference_version('knowledge', '${newUid()}')`,
        ]) {
            await expectDbDenied(
                asRole(db, 'authenticated', uid, () => db.query(fn)),
                /permission denied/,
            );
        }
    });
});
