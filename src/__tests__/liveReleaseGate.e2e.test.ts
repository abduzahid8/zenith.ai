/**
 * Real-DB integration tests: live-release start gate (migration 034).
 *
 * Gap under test: start RPCs chose bank rows by `status = 'active'`
 * only, so during the load → activation window a NEW attempt could be
 * built from DRAFT content. The read/issuance side correctly refuses
 * to count that release → solve-but-no-proof.
 *
 * Gate under test: every NEW attempt resolves the single LIVE release
 * (active + machine QA passed + human approved) and selects content
 * ONLY at that content_version; already-started attempts stay pinned;
 * no live release → `credential_content_unavailable` (fail closed).
 *
 * Each test gets an isolated program slug so release mutations never
 * leak across tests. Run with `npm run test:e2e` (never unit suite).
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
         VALUES ('${slug}', 'LR', 'Live Release Gate', 'verified-skill', '1.0',
                 80, TRUE, FALSE, FALSE, FALSE, '${SKILLS}', '[]', 'active')
         ON CONFLICT (slug) DO NOTHING`,
    );
    await db.query(
        `INSERT INTO skill_evidence_policy (program_slug, program_version, skill_key, min_items, min_pass_rate, rationale)
         VALUES ('${slug}', '1.0', 'alpha', 1, 0.65, 'live-gate probe')
         ON CONFLICT (program_slug, program_version, skill_key) DO NOTHING`,
    );
}

async function addRelease(
    slug: string,
    version: string,
    status: string,
    qa = 'passed',
    human = 'approved',
): Promise<void> {
    await db.query(
        `INSERT INTO credential_content_releases
            (program_slug, program_version, content_version, artifact_sha256,
             machine_qa_status, human_review_status, reviewer, reviewed_at, status)
         VALUES ('${slug}', '1.0', '${version}', 'synthetic-fixture', '${qa}', '${human}',
                 'synthetic-fixture', NOW(), '${status}')
         ON CONFLICT (program_slug, program_version, content_version)
         DO UPDATE SET status = EXCLUDED.status,
                       machine_qa_status = EXCLUDED.machine_qa_status,
                       human_review_status = EXCLUDED.human_review_status`,
    );
}

async function addTrustedItem(slug: string, version: string, lesson: string, day = 90): Promise<void> {
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

async function wipeProgram(slug: string): Promise<void> {
    await db.query(`DELETE FROM trusted_item_results WHERE program_slug = '${slug}'`);
    await db.query(`DELETE FROM trusted_validation_attempts WHERE program_slug = '${slug}'`);
    await db.query(`DELETE FROM knowledge_attempts WHERE program_slug = '${slug}'`);
    await db.query(`DELETE FROM practical_attempts WHERE program_slug = '${slug}'`);
    await db.query(`DELETE FROM assessment_attempts WHERE program_slug = '${slug}'`);
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

function startTrusted(uid: string, slug: string) {
    return asRole(db, 'authenticated', uid, () =>
        db.query('SELECT * FROM start_trusted_validation($1, $2)', [slug, 'alpha']).then(r => r.rows[0]),
    );
}

function startKnowledge(uid: string, slug: string) {
    return asRole(db, 'authenticated', uid, () =>
        db.query('SELECT * FROM start_knowledge_attempt($1)', [slug]).then(r => r.rows[0]),
    );
}

function startPractical(uid: string, slug: string) {
    return asRole(db, 'authenticated', uid, () =>
        db.query('SELECT * FROM start_practical_attempt($1)', [slug]).then(r => r.rows[0]),
    );
}

function startFinal(uid: string, slug: string) {
    return asRole(db, 'authenticated', uid, () =>
        db.query('SELECT * FROM start_assessment($1)', [slug]).then(r => r.rows[0]),
    );
}

beforeAll(async () => {
    db = adminClient();
    await db.connect();
});

afterAll(async () => {
    await db.end();
});

describe('real DB: new starts require the live release', () => {
    test('1/4/5. draft content is never selected; live item pinned on the attempt', async () => {
        const slug = 'e2e-live-draft-skip';
        await makeProgram(slug);
        await addRelease(slug, 'gate-v1', 'active');
        await addRelease(slug, 'gate-v2', 'draft');
        // Distinct slots: the one-active-per-slot index forbids two ACTIVE
        // rows on the same day; the gate must still pick by VERSION.
        await addTrustedItem(slug, 'gate-v1', 'live-lesson', 90);
        await addTrustedItem(slug, 'gate-v2', 'draft-lesson', 91);
        const uid = newUid();
        await createUser(db, uid);
        try {
            const row = await startTrusted(uid, slug);
            expect(row).toBeDefined();
            const attempt = await db.query(
                `SELECT item_id, content_version FROM trusted_validation_attempts WHERE id = $1`,
                [row.attempt_id],
            );
            expect(attempt.rows[0].content_version).toBe('gate-v1');
            const item = await db.query(`SELECT lesson_id FROM trusted_validation_items WHERE id = $1`, [
                attempt.rows[0].item_id,
            ]);
            expect(item.rows[0].lesson_id).toBe('live-lesson');
        } finally {
            await wipeProgram(slug);
        }
    });

    test('2/14. retired release is skipped; activating a release makes it selectable', async () => {
        const slug = 'e2e-live-retired';
        await makeProgram(slug);
        await addRelease(slug, 'gate-v1', 'active');
        await addRelease(slug, 'gate-v2', 'draft');
        await addTrustedItem(slug, 'gate-v1', 'v1-lesson', 90);
        await addTrustedItem(slug, 'gate-v2', 'v2-lesson', 91);
        const uid = newUid();
        await createUser(db, uid);
        try {
            // Retire v1 while v2 is still draft: nothing live → fail closed.
            await db.query(
                `UPDATE credential_content_releases SET status = 'retired'
                 WHERE program_slug = '${slug}' AND content_version = 'gate-v1'`,
            );
            await expectDbDenied(startTrusted(uid, slug), /credential_content_unavailable/);
            // Activate v2: the same release becomes selectable.
            await db.query(
                `UPDATE credential_content_releases SET status = 'active'
                 WHERE program_slug = '${slug}' AND content_version = 'gate-v2'`,
            );
            const row = await startTrusted(uid, slug);
            const attempt = await db.query(
                `SELECT content_version FROM trusted_validation_attempts WHERE id = $1`,
                [row.attempt_id],
            );
            expect(attempt.rows[0].content_version).toBe('gate-v2');
        } finally {
            await wipeProgram(slug);
        }
    });

    test('3/12. compromised or QA-failed live candidates fail closed on all four starts', async () => {
        const slug = 'e2e-live-compromised';
        await makeProgram(slug);
        await addRelease(slug, 'gate-v1', 'compromised');
        await addRelease(slug, 'gate-v2', 'draft');
        await addTrustedItem(slug, 'gate-v2', 'draft-lesson');
        await addKnowledgeItem(slug, 'gate-v2', 'k-draft');
        await addPracticalItem(slug, 'gate-v2', 'p-draft');
        await addQuestionSet(slug, 'e5e5e5e5-5555-4555-8555-555555555555', 'gate-v2');
        const uid = newUid();
        await createUser(db, uid);
        try {
            await expectDbDenied(startTrusted(uid, slug), /credential_content_unavailable/);
            await expectDbDenied(startKnowledge(uid, slug), /credential_content_unavailable/);
            await expectDbDenied(startPractical(uid, slug), /credential_content_unavailable/);
            await expectDbDenied(startFinal(uid, slug), /credential_content_unavailable/);
            // QA-failed active rows are equally unusable.
            await db.query(
                `UPDATE credential_content_releases
                 SET status = 'active', machine_qa_status = 'failed'
                 WHERE program_slug = '${slug}' AND content_version = 'gate-v1'`,
            );
            await expectDbDenied(startTrusted(uid, slug), /credential_content_unavailable/);
        } finally {
            await wipeProgram(slug);
        }
    });

    test('6/7. knowledge + practical attempts use one live version (never mixed)', async () => {
        const slug = 'e2e-live-mixed';
        await makeProgram(slug);
        await addRelease(slug, 'gate-v1', 'active');
        await addRelease(slug, 'gate-v2', 'draft');
        await addKnowledgeItem(slug, 'gate-v1', 'k-live');
        await addKnowledgeItem(slug, 'gate-v2', 'k-draft');
        await addPracticalItem(slug, 'gate-v1', 'p-live');
        await addPracticalItem(slug, 'gate-v2', 'p-draft');
        const uid = newUid();
        await createUser(db, uid);
        try {
            const k = await startKnowledge(uid, slug);
            const kRow = await db.query(
                `SELECT assigned_item_ids, content_version FROM knowledge_attempts WHERE id = $1`,
                [k.attempt_id],
            );
            expect(kRow.rows[0].content_version).toBe('gate-v1');
            const kIds = kRow.rows[0].assigned_item_ids;
            const kItems = await db.query(
                `SELECT DISTINCT content_version FROM knowledge_items WHERE id::text IN
                 (SELECT jsonb_array_elements_text($1::jsonb))`,
                [typeof kIds === 'string' ? kIds : JSON.stringify(kIds)],
            );
            expect(kItems.rows.map(r => r.content_version)).toEqual(['gate-v1']);

            const p = await startPractical(uid, slug);
            const pRow = await db.query(
                `SELECT assigned_item_ids, content_version FROM practical_attempts WHERE id = $1`,
                [p.attempt_id],
            );
            expect(pRow.rows[0].content_version).toBe('gate-v1');
            const pIds = pRow.rows[0].assigned_item_ids;
            const pItems = await db.query(
                `SELECT DISTINCT content_version FROM practical_items WHERE id::text IN
                 (SELECT jsonb_array_elements_text($1::jsonb))`,
                [typeof pIds === 'string' ? pIds : JSON.stringify(pIds)],
            );
            expect(pItems.rows.map(r => r.content_version)).toEqual(['gate-v1']);
        } finally {
            await wipeProgram(slug);
        }
    });

    test('8/12/14. final uses the live set only; draft-only world fails closed', async () => {
        // The schema allows exactly one ACTIVE set per program+version, so
        // the real rotation window looks like this: the only ACTIVE set
        // already points at DRAFT content (old set retired at load time).
        const slug = 'e2e-live-final';
        await makeProgram(slug);
        await addRelease(slug, 'gate-v1', 'retired');
        await addRelease(slug, 'gate-v2', 'draft');
        await addQuestionSet(slug, 'a1a1a1a1-1111-4111-8111-111111111111', 'gate-v2');
        const uid = newUid();
        await createUser(db, uid);
        try {
            await expectDbDenied(startFinal(uid, slug), /credential_content_unavailable/);
            await db.query(
                `UPDATE credential_content_releases SET status = 'active'
                 WHERE program_slug = '${slug}' AND content_version = 'gate-v2'`,
            );
            const row = await startFinal(uid, slug);
            const attempt = await db.query(
                `SELECT question_set_id, bank_version FROM assessment_attempts WHERE id = $1`,
                [row.attempt_id],
            );
            expect(attempt.rows[0].bank_version).toBe('gate-v2');
            expect(attempt.rows[0].question_set_id).toBe('a1a1a1a1-1111-4111-8111-111111111111');
        } finally {
            await wipeProgram(slug);
        }
    });

    test('9/10/11. rotation supersedes pinned attempts; new users get live content', async () => {
        const slug = 'e2e-live-pinned';
        await makeProgram(slug);
        await addRelease(slug, 'gate-v1', 'active');
        await addTrustedItem(slug, 'gate-v1', 'v1-lesson', 90);
        await addKnowledgeItem(slug, 'gate-v1', 'k1');
        await addPracticalItem(slug, 'gate-v1', 'p1');
        await addQuestionSet(slug, 'c3c3c3c3-3333-4333-8333-333333333333', 'gate-v1');
        const uid = newUid();
        await createUser(db, uid);
        try {
            const t1 = await startTrusted(uid, slug);
            const k1 = await startKnowledge(uid, slug);
            const p1 = await startPractical(uid, slug);
            const f1 = await startFinal(uid, slug);
            // Rotate the way the loader does: old rows retired, new ACTIVE
            // rows loaded, then the release activates.
            await db.query(
                `UPDATE trusted_validation_items SET status = 'retired'
                 WHERE program_slug = '${slug}' AND content_version = 'gate-v1'`,
            );
            await db.query(
                `UPDATE knowledge_items SET status = 'retired'
                 WHERE program_slug = '${slug}' AND content_version = 'gate-v1'`,
            );
            await db.query(
                `UPDATE practical_items SET status = 'retired'
                 WHERE program_slug = '${slug}' AND content_version = 'gate-v1'`,
            );
            await db.query(
                `UPDATE assessment_question_sets SET status = 'retired'
                 WHERE program_slug = '${slug}' AND content_version = 'gate-v1'`,
            );
            await db.query(
                `UPDATE credential_content_releases SET status = 'retired'
                 WHERE program_slug = '${slug}' AND content_version = 'gate-v1'`,
            );
            await addRelease(slug, 'gate-v2', 'active');
            await addTrustedItem(slug, 'gate-v2', 'v2-lesson', 90);
            await addKnowledgeItem(slug, 'gate-v2', 'k1');
            await addPracticalItem(slug, 'gate-v2', 'p1');
            await addQuestionSet(slug, 'd4d4d4d4-4444-4444-8444-444444444444', 'gate-v2');
            // Trusted attempt row keeps its pinned version; the row is
            // superseded only when its owner starts again (035).
            const tRow = await db.query(
                `SELECT status, content_version FROM trusted_validation_attempts WHERE id = $1`,
                [t1.attempt_id],
            );
            expect(tRow.rows[0].content_version).toBe('gate-v1');
            // Knowledge / practical / final supersede the stale attempt and
            // mint a fresh live one (035 replaces resume-across-rotation).
            const k2 = await startKnowledge(uid, slug);
            expect(k2.attempt_id).not.toBe(k1.attempt_id);
            const p2 = await startPractical(uid, slug);
            expect(p2.attempt_id).not.toBe(p1.attempt_id);
            const f2 = await startFinal(uid, slug);
            expect(f2.attempt_id).not.toBe(f1.attempt_id);
            expect(f2.retake_reason).not.toBe('active_attempt');
            const oldRows = await db.query(
                `SELECT status FROM knowledge_attempts WHERE id = $1`,
                [k1.attempt_id],
            );
            expect(oldRows.rows[0].status).toBe('superseded');
            const fRow = await db.query(
                `SELECT status, bank_version FROM assessment_attempts WHERE id = $1`,
                [f1.attempt_id],
            );
            expect(fRow.rows[0]).toMatchObject({ status: 'superseded', bank_version: 'gate-v1' });
            // A NEW user after rotation lands on live content everywhere.
            const uid2 = newUid();
            await createUser(db, uid2);
            const tNew = await startTrusted(uid2, slug);
            const tNewRow = await db.query(
                `SELECT content_version FROM trusted_validation_attempts WHERE id = $1`,
                [tNew.attempt_id],
            );
            expect(tNewRow.rows[0].content_version).toBe('gate-v2');
            const kNew = await startKnowledge(uid2, slug);
            const kNewRow = await db.query(
                `SELECT content_version FROM knowledge_attempts WHERE id = $1`,
                [kNew.attempt_id],
            );
            expect(kNewRow.rows[0].content_version).toBe('gate-v2');
            const fNew = await startFinal(uid2, slug);
            const fNewRow = await db.query(
                `SELECT bank_version FROM assessment_attempts WHERE id = $1`,
                [fNew.attempt_id],
            );
            expect(fNewRow.rows[0].bank_version).toBe('gate-v2');
        } finally {
            await wipeProgram(slug);
        }
    });

    test('13/14. draft proof is uncountable until its release activates', async () => {
        const slug = 'e2e-live-proof';
        await makeProgram(slug);
        await addRelease(slug, 'gate-v1', 'draft');
        await addTrustedItem(slug, 'gate-v1', 'draft-lesson');
        const uid = newUid();
        await createUser(db, uid);
        try {
            // Draft-only world: no starts possible, so no proof can exist.
            await expectDbDenied(startTrusted(uid, slug), /credential_content_unavailable/);
            // Even a server-recorded pass on draft content counts for nothing.
            const item = await db.query(
                `SELECT id FROM trusted_validation_items
                 WHERE program_slug = '${slug}' AND content_version = 'gate-v1'`,
            );
            await db.query(
                `INSERT INTO trusted_item_results
                    (user_id, program_slug, program_version, skill_key, item_id,
                     content_version, finalized_passed, attempts, last_submitted_at)
                 VALUES ($1, '${slug}', '1.0', 'alpha', $2, 'gate-v1', TRUE, 1, NOW())`,
                [uid, item.rows[0].id],
            );
            const before = await asRole(db, 'authenticated', uid, () =>
                db.query('SELECT * FROM get_skill_verification($1)', [slug]).then(r => r.rows),
            );
            expect(before[0].samples_completed).toBe(0);
            expect(before[0].verified).toBe(false);
            // Activating the same release makes the identical proof count.
            await db.query(
                `UPDATE credential_content_releases SET status = 'active'
                 WHERE program_slug = '${slug}' AND content_version = 'gate-v1'`,
            );
            const after = await asRole(db, 'authenticated', uid, () =>
                db.query('SELECT * FROM get_skill_verification($1)', [slug]).then(r => r.rows),
            );
            expect(after[0].samples_completed).toBe(1);
            expect(after[0].verified).toBe(true);
        } finally {
            await wipeProgram(slug);
        }
    });
});
