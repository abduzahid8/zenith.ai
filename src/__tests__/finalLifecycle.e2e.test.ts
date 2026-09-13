/**
 * Real-DB integration tests: Final lifecycle hardening (migration 036).
 *
 * - Same-live expiry finalizes exactly once as a real failed assessment
 *   (submitted / 0 / false / submitted_at pinned to deadline / zeroed
 *   breakdown / failed component / remediation) via both start and late
 *   submit, without ever raising after the write.
 * - Expiry counts: cooldown runs from the expiry timestamp; no free timer.
 * - Rotation precedence: stale-bank attempts supersede even past their old
 *   deadline (no failure, no component, no cooldown).
 * - Server readiness gate for NEW attempts: verified skills + live-backed
 *   Knowledge/Practical passes; stale passes never unlock; live Final pass
 *   refuses another attempt. Valid in-flight attempts always resume.
 * - Exam privacy unchanged.
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
         VALUES ('${slug}', 'LC', 'Final Harness', 'verified-skill', '1.0',
                 80, TRUE, FALSE, FALSE, FALSE, '${SKILLS}', '[]', 'active')
         ON CONFLICT (slug) DO NOTHING`,
    );
    await db.query(
        `INSERT INTO skill_evidence_policy (program_slug, program_version, skill_key, min_items, min_pass_rate, rationale)
         VALUES ('${slug}', '1.0', 'alpha', 1, 0.65, 'final probe')
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

async function addQuestionSet(slug: string, id: string, version: string, minutes = 30): Promise<void> {
    await db.query(
        `INSERT INTO assessment_question_sets
            (id, program_slug, version, question_count, time_limit_minutes, pass_score, questions, content_version, status)
         VALUES ('${id}', '${slug}', '1.0', 1, ${minutes}, 80,
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

function startFinal(uid: string, slug: string, dbc: Client = db) {
    return asRole(dbc, 'authenticated', uid, () =>
        dbc.query('SELECT * FROM start_assessment($1)', [slug]).then(r => r.rows[0]),
    );
}

function submitFinal(uid: string, attemptId: string, answers: Record<string, string>, dbc: Client = db) {
    return asRole(dbc, 'authenticated', uid, () =>
        dbc.query('SELECT * FROM submit_assessment($1, $2)', [attemptId, answers]).then(r => r.rows[0]),
    );
}

async function trustedPass(uid: string, slug: string): Promise<void> {
    const started = await asRole(db, 'authenticated', uid, () =>
        db.query('SELECT * FROM start_trusted_validation($1, $2)', [slug, 'alpha']).then(r => r.rows[0]),
    );
    await asRole(db, 'authenticated', uid, () =>
        db.query('SELECT * FROM submit_trusted_validation($1, $2)', [started.attempt_id, { answer: 'ok' }]),
    );
}

async function knowledgePass(uid: string, slug: string, key: string): Promise<string> {
    const started = await asRole(db, 'authenticated', uid, () =>
        db.query('SELECT * FROM start_knowledge_attempt($1)', [slug]).then(r => r.rows[0]),
    );
    await asRole(db, 'authenticated', uid, () =>
        db.query('SELECT * FROM submit_knowledge_attempt($1, $2)', [started.attempt_id, { [key]: 'ok' }]),
    );
    return started.attempt_id as string;
}

async function practicalPass(uid: string, slug: string, key: string): Promise<string> {
    const started = await asRole(db, 'authenticated', uid, () =>
        db.query('SELECT * FROM start_practical_attempt($1)', [slug]).then(r => r.rows[0]),
    );
    await asRole(db, 'authenticated', uid, () =>
        db.query('SELECT * FROM submit_practical_attempt($1, $2)', [started.attempt_id, { [key]: 'ok' }]),
    );
    return started.attempt_id as string;
}

/** Full live readiness on one release: verified skill + live K/P passes. */
async function makeReady(uid: string, slug: string, version: string): Promise<void> {
    await trustedPass(uid, slug);
    await knowledgePass(uid, slug, `k-${version}`);
    await practicalPass(uid, slug, `p-${version}`);
}

async function attemptCounts(uid: string) {
    const rows = await db.query(
        `SELECT status, COUNT(*)::int c FROM assessment_attempts WHERE user_id = $1 GROUP BY status`,
        [uid],
    );
    const out: Record<string, number> = {};
    for (const r of rows.rows) out[r.status as string] = r.c as number;
    return out;
}

beforeAll(async () => {
    db = adminClient();
    await db.connect();
});

afterAll(async () => {
    await db.end();
});

describe('real DB: expiry finalizes exactly once (start path)', () => {
    test('1. repeated start before deadline returns same attempt', async () => {
        const slug = 'e2e-fin-resume';
        await makeProgram(slug);
        await addRelease(slug, 'live-v1', 'active');
        await addTrustedItem(slug, 'live-v1', 'les-a', 80);
        await addKnowledgeItem(slug, 'live-v1', 'k-live-v1');
        await addPracticalItem(slug, 'live-v1', 'p-live-v1');
        await addQuestionSet(slug, newUid(), 'live-v1', 30);
        const uid = newUid();
        await createUser(db, uid);
        try {
            await makeReady(uid, slug, 'live-v1');
            const first = await startFinal(uid, slug);
            const second = await startFinal(uid, slug);
            expect(second.attempt_id).toBe(first.attempt_id);
            expect(second.retake_reason).toBe('active_attempt');
            expect(Array.isArray(second.questions) && second.questions.length).toBeGreaterThan(0);
            expect(await attemptCounts(uid)).toMatchObject({ started: 1 });
        } finally {
            await wipeProgram(slug);
        }
    });

    test('2/3/4. same-live expired attempt becomes submitted with 0/false, pinned to deadline', async () => {
        const slug = 'e2e-fin-expire';
        await makeProgram(slug);
        await addRelease(slug, 'live-v1', 'active');
        await addTrustedItem(slug, 'live-v1', 'les-a', 80);
        await addKnowledgeItem(slug, 'live-v1', 'k-live-v1');
        await addPracticalItem(slug, 'live-v1', 'p-live-v1');
        await addQuestionSet(slug, newUid(), 'live-v1', 0);
        const uid = newUid();
        await createUser(db, uid);
        try {
            await makeReady(uid, slug, 'live-v1');
            const first = await startFinal(uid, slug);
            const deadline = new Date(first.deadline as string);
            // Zero-minute timer is already spent: reopening finalizes.
            const expired = await startFinal(uid, slug);
            expect(expired.attempt_id).toBe(first.attempt_id);
            expect(expired.retake_reason).toBe('expired_finalized');
            expect(expired.questions).toEqual([]);
            const row = await db.query(
                `SELECT status, score, passed, submitted_at, skill_breakdown FROM assessment_attempts WHERE id = $1`,
                [first.attempt_id],
            );
            expect(row.rows[0].status).toBe('submitted');
            expect(Number(row.rows[0].score)).toBe(0);
            expect(row.rows[0].passed).toBe(false);
            // Pinned to expiry semantics, not to reopen time.
            expect(new Date(row.rows[0].submitted_at as string).getTime()).toBe(deadline.getTime());
            expect(row.rows[0].skill_breakdown).toEqual({ alpha: { correct: 0, total: 1 } });
        } finally {
            await wipeProgram(slug);
        }
    });

    test('5/6. expired attempt creates failed final component + remediation progress', async () => {
        const slug = 'e2e-fin-exp-comp';
        await makeProgram(slug);
        await addRelease(slug, 'live-v1', 'active');
        await addTrustedItem(slug, 'live-v1', 'les-a', 80);
        await addKnowledgeItem(slug, 'live-v1', 'k-live-v1');
        await addPracticalItem(slug, 'live-v1', 'p-live-v1');
        await addQuestionSet(slug, newUid(), 'live-v1', 0);
        const uid = newUid();
        await createUser(db, uid);
        try {
            await makeReady(uid, slug, 'live-v1');
            const first = await startFinal(uid, slug);
            await startFinal(uid, slug);
            const comp = await db.query(
                `SELECT score, passed, authority_source, reference_id FROM credential_component_results
                 WHERE user_id = $1 AND program_slug = $2 AND program_version = '1.0' AND component = 'final_assessment'`,
                [uid, slug],
            );
            expect(comp.rows).toHaveLength(1);
            expect(Number(comp.rows[0].score)).toBe(0);
            expect(comp.rows[0].passed).toBe(false);
            expect(comp.rows[0].authority_source).toBe('server_scored_assessment');
            expect(comp.rows[0].reference_id).toBe(first.attempt_id);
            const prog = await db.query(
                `SELECT status FROM user_credential_progress
                 WHERE user_id = $1 AND program_slug = $2 AND program_version = '1.0'`,
                [uid, slug],
            );
            expect(prog.rows[0].status).toBe('remediation');
        } finally {
            await wipeProgram(slug);
        }
    });

    test('7. repeated expiry resolution is idempotent', async () => {
        const slug = 'e2e-fin-exp-idem';
        await makeProgram(slug);
        await addRelease(slug, 'live-v1', 'active');
        await addTrustedItem(slug, 'live-v1', 'les-a', 80);
        await addKnowledgeItem(slug, 'live-v1', 'k-live-v1');
        await addPracticalItem(slug, 'live-v1', 'p-live-v1');
        await addQuestionSet(slug, newUid(), 'live-v1', 0);
        const uid = newUid();
        await createUser(db, uid);
        try {
            await makeReady(uid, slug, 'live-v1');
            const first = await startFinal(uid, slug);
            await startFinal(uid, slug);
            // Late submit of the already-expired row replays stored failure.
            const again = await submitFinal(uid, first.attempt_id as string, { q1: '2' });
            expect(Number(again.score)).toBe(0);
            expect(again.passed).toBe(false);
            expect(again.submitted).toBe(false);
            expect(again.content_stale).toBe(false);
            expect(await attemptCounts(uid)).toMatchObject({ submitted: 1 });
            const comps = await db.query(
                `SELECT COUNT(*)::int c FROM credential_component_results
                 WHERE user_id = $1 AND component = 'final_assessment'`,
                [uid],
            );
            expect(comps.rows[0].c).toBe(1);
        } finally {
            await wipeProgram(slug);
        }
    });

    test('8. no second active attempt exists during expiry handling', async () => {
        const slug = 'e2e-fin-exp-once';
        await makeProgram(slug);
        await addRelease(slug, 'live-v1', 'active');
        await addTrustedItem(slug, 'live-v1', 'les-a', 80);
        await addKnowledgeItem(slug, 'live-v1', 'k-live-v1');
        await addPracticalItem(slug, 'live-v1', 'p-live-v1');
        await addQuestionSet(slug, newUid(), 'live-v1', 0);
        const uid = newUid();
        await createUser(db, uid);
        try {
            await makeReady(uid, slug, 'live-v1');
            await startFinal(uid, slug);
            await startFinal(uid, slug);
            const counts = await attemptCounts(uid);
            expect(counts.started ?? 0).toBe(0);
            expect(counts.submitted).toBe(1);
        } finally {
            await wipeProgram(slug);
        }
    });
});

describe('real DB: expiry counts (cooldown from expiry, no free timer)', () => {
    test('9/10. next start after expiry hits cooldown; timer never resets free', async () => {
        const slug = 'e2e-fin-cool';
        await makeProgram(slug);
        await addRelease(slug, 'live-v1', 'active');
        await addTrustedItem(slug, 'live-v1', 'les-a', 80);
        await addKnowledgeItem(slug, 'live-v1', 'k-live-v1');
        await addPracticalItem(slug, 'live-v1', 'p-live-v1');
        await addQuestionSet(slug, newUid(), 'live-v1', 0);
        const uid = newUid();
        await createUser(db, uid);
        try {
            await makeReady(uid, slug, 'live-v1');
            const first = await startFinal(uid, slug);
            await startFinal(uid, slug);
            // Cooldown runs from the expiry timestamp, not reopen time:
            // the detail must equal submitted_at (= deadline) + 24h.
            const ts = await db.query(
                `SELECT TO_CHAR(submitted_at + INTERVAL '24 hours', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') t
                 FROM assessment_attempts WHERE id = $1`,
                [first.attempt_id],
            );
            const msg = await expectDbDenied(startFinal(uid, slug), /retake_blocked:cooldown:/);
            expect(msg).toContain(ts.rows[0].t as string);
            // The denied call minted nothing.
            expect(await attemptCounts(uid)).toMatchObject({ submitted: 1 });
        } finally {
            await wipeProgram(slug);
        }
    });
});

describe('real DB: late submit finalizes failure instead of throwing', () => {
    test('11. late submit returns 0/false/true/false with zeroed breakdown', async () => {
        const slug = 'e2e-fin-late';
        await makeProgram(slug);
        await addRelease(slug, 'live-v1', 'active');
        await addTrustedItem(slug, 'live-v1', 'les-a', 80);
        await addKnowledgeItem(slug, 'live-v1', 'k-live-v1');
        await addPracticalItem(slug, 'live-v1', 'p-live-v1');
        await addQuestionSet(slug, newUid(), 'live-v1', 0);
        const uid = newUid();
        await createUser(db, uid);
        try {
            await makeReady(uid, slug, 'live-v1');
            const first = await startFinal(uid, slug);
            // Even the right answers cannot score after expiry.
            const res = await submitFinal(uid, first.attempt_id as string, { q1: '2' });
            expect(Number(res.score)).toBe(0);
            expect(res.passed).toBe(false);
            expect(res.submitted).toBe(true);
            expect(res.content_stale).toBe(false);
            const row = await db.query(
                `SELECT status, submitted_at, skill_breakdown FROM assessment_attempts WHERE id = $1`,
                [first.attempt_id],
            );
            expect(row.rows[0].status).toBe('submitted');
            expect(new Date(row.rows[0].submitted_at as string).getTime()).toBe(
                new Date(first.deadline as string).getTime(),
            );
            expect(row.rows[0].skill_breakdown).toEqual({ alpha: { correct: 0, total: 1 } });
        } finally {
            await wipeProgram(slug);
        }
    });

    test('12. repeated late submit is idempotent', async () => {
        const slug = 'e2e-fin-late-idem';
        await makeProgram(slug);
        await addRelease(slug, 'live-v1', 'active');
        await addTrustedItem(slug, 'live-v1', 'les-a', 80);
        await addKnowledgeItem(slug, 'live-v1', 'k-live-v1');
        await addPracticalItem(slug, 'live-v1', 'p-live-v1');
        await addQuestionSet(slug, newUid(), 'live-v1', 0);
        const uid = newUid();
        await createUser(db, uid);
        try {
            await makeReady(uid, slug, 'live-v1');
            const first = await startFinal(uid, slug);
            const once = await submitFinal(uid, first.attempt_id as string, { q1: 'wrong' });
            expect(once.submitted).toBe(true);
            const twice = await submitFinal(uid, first.attempt_id as string, { q1: '2' });
            expect(Number(twice.score)).toBe(0);
            expect(twice.passed).toBe(false);
            expect(twice.submitted).toBe(false);
            expect(twice.content_stale).toBe(false);
            expect(await attemptCounts(uid)).toMatchObject({ submitted: 1 });
        } finally {
            await wipeProgram(slug);
        }
    });
});

describe('real DB: rotation precedence over expiry', () => {
    test('13/14/15. stale-bank attempt supersedes (even past old deadline): no failure, no component, no cooldown', async () => {
        const slug = 'e2e-fin-rot';
        await makeProgram(slug);
        await addRelease(slug, 'live-v1', 'active');
        await addTrustedItem(slug, 'live-v1', 'les-a', 80);
        await addKnowledgeItem(slug, 'live-v1', 'k-live-v1');
        await addPracticalItem(slug, 'live-v1', 'p-live-v1');
        // Zero-minute timer: the old deadline passes before rotation lands.
        await addQuestionSet(slug, newUid(), 'live-v1', 0);
        const uid = newUid();
        await createUser(db, uid);
        try {
            await makeReady(uid, slug, 'live-v1');
            const old = await startFinal(uid, slug);
            await retireVersion(slug, 'live-v1');
            await addRelease(slug, 'live-v2', 'active');
            await addTrustedItem(slug, 'live-v2', 'les-b', 81);
            await addKnowledgeItem(slug, 'live-v2', 'k-live-v2');
            await addPracticalItem(slug, 'live-v2', 'p-live-v2');
            await addQuestionSet(slug, newUid(), 'live-v2', 30);
            await trustedPass(uid, slug);
            await knowledgePass(uid, slug, 'k-live-v2');
            await practicalPass(uid, slug, 'p-live-v2');
            const fresh = await startFinal(uid, slug);
            expect(fresh.attempt_id).not.toBe(old.attempt_id);
            expect(fresh.retake_reason).not.toBe('expired_finalized');
            const rows = await db.query(
                `SELECT id, status, bank_version FROM assessment_attempts WHERE user_id = $1 ORDER BY started_at`,
                [uid],
            );
            expect(rows.rows).toHaveLength(2);
            expect(rows.rows[0]).toMatchObject({ status: 'superseded', bank_version: 'live-v1' });
            expect(rows.rows[1]).toMatchObject({ status: 'started', bank_version: 'live-v2' });
            // Zero failed component from the rotated attempt.
            const comps = await db.query(
                `SELECT COUNT(*)::int c FROM credential_component_results
                 WHERE user_id = $1 AND component = 'final_assessment'`,
                [uid],
            );
            expect(comps.rows[0].c).toBe(0);
            // No cooldown penalty: the fresh exam still resumes.
            const again = await startFinal(uid, slug);
            expect(again.attempt_id).toBe(fresh.attempt_id);
            expect(again.retake_reason).toBe('active_attempt');
        } finally {
            await wipeProgram(slug);
        }
    });
});

describe('real DB: server readiness gate for new attempts', () => {
    test('16. new Final blocked when skills are not fully verified', async () => {
        const slug = 'e2e-fin-g-skill';
        await makeProgram(slug);
        await addRelease(slug, 'live-v1', 'active');
        await addTrustedItem(slug, 'live-v1', 'les-a', 80);
        await addKnowledgeItem(slug, 'live-v1', 'k-live-v1');
        await addPracticalItem(slug, 'live-v1', 'p-live-v1');
        await addQuestionSet(slug, newUid(), 'live-v1', 30);
        const uid = newUid();
        await createUser(db, uid);
        try {
            // Knowledge + Practical pass, but zero skill verification.
            await knowledgePass(uid, slug, 'k-live-v1');
            await practicalPass(uid, slug, 'p-live-v1');
            await expectDbDenied(startFinal(uid, slug), /final_not_ready:skills/);
            expect(await attemptCounts(uid)).toEqual({});
        } finally {
            await wipeProgram(slug);
        }
    });

    test('17. new Final blocked when current-live Knowledge is missing', async () => {
        const slug = 'e2e-fin-g-know';
        await makeProgram(slug);
        await addRelease(slug, 'live-v1', 'active');
        await addTrustedItem(slug, 'live-v1', 'les-a', 80);
        await addKnowledgeItem(slug, 'live-v1', 'k-live-v1');
        await addPracticalItem(slug, 'live-v1', 'p-live-v1');
        await addQuestionSet(slug, newUid(), 'live-v1', 30);
        const uid = newUid();
        await createUser(db, uid);
        try {
            await trustedPass(uid, slug);
            await practicalPass(uid, slug, 'p-live-v1');
            await expectDbDenied(startFinal(uid, slug), /final_not_ready:knowledge/);
            expect(await attemptCounts(uid)).toEqual({});
        } finally {
            await wipeProgram(slug);
        }
    });

    test('18. stale Knowledge PASS cannot unlock Final', async () => {
        const slug = 'e2e-fin-g-sk';
        await makeProgram(slug);
        await addRelease(slug, 'live-v1', 'active');
        await addTrustedItem(slug, 'live-v1', 'les-a', 80);
        await addKnowledgeItem(slug, 'live-v1', 'k-live-v1');
        await addPracticalItem(slug, 'live-v1', 'p-live-v1');
        await addQuestionSet(slug, newUid(), 'live-v1', 30);
        const uid = newUid();
        await createUser(db, uid);
        try {
            await makeReady(uid, slug, 'live-v1');
            await retireVersion(slug, 'live-v1');
            await addRelease(slug, 'live-v2', 'active');
            await addTrustedItem(slug, 'live-v2', 'les-b', 81);
            await addKnowledgeItem(slug, 'live-v2', 'k-live-v2');
            await addPracticalItem(slug, 'live-v2', 'p-live-v2');
            await addQuestionSet(slug, newUid(), 'live-v2', 30);
            // Re-verify skills + practical on the new release; knowledge stays stale.
            await trustedPass(uid, slug);
            await practicalPass(uid, slug, 'p-live-v2');
            await expectDbDenied(startFinal(uid, slug), /final_not_ready:knowledge/);
        } finally {
            await wipeProgram(slug);
        }
    });

    test('19. new Final blocked when current-live Practical is missing', async () => {
        const slug = 'e2e-fin-g-prac';
        await makeProgram(slug);
        await addRelease(slug, 'live-v1', 'active');
        await addTrustedItem(slug, 'live-v1', 'les-a', 80);
        await addKnowledgeItem(slug, 'live-v1', 'k-live-v1');
        await addPracticalItem(slug, 'live-v1', 'p-live-v1');
        await addQuestionSet(slug, newUid(), 'live-v1', 30);
        const uid = newUid();
        await createUser(db, uid);
        try {
            await trustedPass(uid, slug);
            await knowledgePass(uid, slug, 'k-live-v1');
            await expectDbDenied(startFinal(uid, slug), /final_not_ready:practical/);
            expect(await attemptCounts(uid)).toEqual({});
        } finally {
            await wipeProgram(slug);
        }
    });

    test('20. stale Practical PASS cannot unlock Final', async () => {
        const slug = 'e2e-fin-g-sp';
        await makeProgram(slug);
        await addRelease(slug, 'live-v1', 'active');
        await addTrustedItem(slug, 'live-v1', 'les-a', 80);
        await addKnowledgeItem(slug, 'live-v1', 'k-live-v1');
        await addPracticalItem(slug, 'live-v1', 'p-live-v1');
        await addQuestionSet(slug, newUid(), 'live-v1', 30);
        const uid = newUid();
        await createUser(db, uid);
        try {
            await makeReady(uid, slug, 'live-v1');
            await retireVersion(slug, 'live-v1');
            await addRelease(slug, 'live-v2', 'active');
            await addTrustedItem(slug, 'live-v2', 'les-b', 81);
            await addKnowledgeItem(slug, 'live-v2', 'k-live-v2');
            await addPracticalItem(slug, 'live-v2', 'p-live-v2');
            await addQuestionSet(slug, newUid(), 'live-v2', 30);
            // Re-verify skills + knowledge on the new release; practical stays stale.
            await trustedPass(uid, slug);
            await knowledgePass(uid, slug, 'k-live-v2');
            await expectDbDenied(startFinal(uid, slug), /final_not_ready:practical/);
        } finally {
            await wipeProgram(slug);
        }
    });

    test('21. all current authoritative prerequisites allow Final start', async () => {
        const slug = 'e2e-fin-g-ok';
        await makeProgram(slug);
        await addRelease(slug, 'live-v1', 'active');
        await addTrustedItem(slug, 'live-v1', 'les-a', 80);
        await addKnowledgeItem(slug, 'live-v1', 'k-live-v1');
        await addPracticalItem(slug, 'live-v1', 'p-live-v1');
        await addQuestionSet(slug, newUid(), 'live-v1', 30);
        const uid = newUid();
        await createUser(db, uid);
        try {
            await makeReady(uid, slug, 'live-v1');
            const first = await startFinal(uid, slug);
            expect(first.attempt_id).toBeDefined();
            expect(first.retake_reason).toBe('first_attempt');
            expect(Array.isArray(first.questions) && first.questions.length).toBeGreaterThan(0);
            expect(first.deadline).toBeDefined();
        } finally {
            await wipeProgram(slug);
        }
    });

    test('22. existing valid started Final still resumes after journey reads change', async () => {
        const slug = 'e2e-fin-g-resume';
        await makeProgram(slug);
        await addRelease(slug, 'live-v1', 'active');
        await addTrustedItem(slug, 'live-v1', 'les-a', 80);
        await addTrustedItem(slug, 'live-v1', 'les-b', 81);
        await addKnowledgeItem(slug, 'live-v1', 'k-live-v1');
        await addPracticalItem(slug, 'live-v1', 'p-live-v1');
        await addQuestionSet(slug, newUid(), 'live-v1', 30);
        const uid = newUid();
        await createUser(db, uid);
        try {
            await makeReady(uid, slug, 'live-v1');
            const first = await startFinal(uid, slug);
            // Unrelated journey reads change mid-exam: extra verification.
            await trustedPass(uid, slug);
            const second = await startFinal(uid, slug);
            expect(second.attempt_id).toBe(first.attempt_id);
            expect(second.retake_reason).toBe('active_attempt');
        } finally {
            await wipeProgram(slug);
        }
    });

    test('23. current authoritative Final PASS prevents a new attempt', async () => {
        const slug = 'e2e-fin-g-pass';
        await makeProgram(slug);
        await addRelease(slug, 'live-v1', 'active');
        await addTrustedItem(slug, 'live-v1', 'les-a', 80);
        await addKnowledgeItem(slug, 'live-v1', 'k-live-v1');
        await addPracticalItem(slug, 'live-v1', 'p-live-v1');
        await addQuestionSet(slug, newUid(), 'live-v1', 30);
        const uid = newUid();
        await createUser(db, uid);
        try {
            await makeReady(uid, slug, 'live-v1');
            const first = await startFinal(uid, slug);
            const sub = await submitFinal(uid, first.attempt_id as string, { q1: '2' });
            expect(sub.passed).toBe(true);
            await expectDbDenied(startFinal(uid, slug), /final_already_passed/);
            const counts = await attemptCounts(uid);
            expect(counts.started ?? 0).toBe(0);
            expect(counts.submitted).toBe(1);
        } finally {
            await wipeProgram(slug);
        }
    });
});

describe('real DB: exam privacy unchanged', () => {
    test('24. question keys remain inaccessible; payloads carry no answers', async () => {
        const slug = 'e2e-fin-priv';
        const setId = newUid();
        await makeProgram(slug);
        await addRelease(slug, 'live-v1', 'active');
        await addTrustedItem(slug, 'live-v1', 'les-a', 80);
        await addKnowledgeItem(slug, 'live-v1', 'k-live-v1');
        await addPracticalItem(slug, 'live-v1', 'p-live-v1');
        await addQuestionSet(slug, setId, 'live-v1', 30);
        const uid = newUid();
        await createUser(db, uid);
        try {
            // Hidden keys: RLS with no client policy leaks zero rows on SELECT.
            const keysLeak = await asRole(db, 'authenticated', uid, () =>
                db.query('SELECT * FROM assessment_answer_keys WHERE question_set_id = $1', [setId]).then(
                    r => r.rowCount,
                ),
            );
            expect(keysLeak).toBe(0);
            await makeReady(uid, slug, 'live-v1');
            const first = await startFinal(uid, slug);
            const payload = JSON.stringify(first.questions);
            expect(payload).not.toMatch(/"answer"/i);
            expect(payload).toMatch(/q1/);
        } finally {
            await wipeProgram(slug);
        }
    });
});
