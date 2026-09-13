/**
 * Pre-Slice-6 credential claim hardening E2E (real local Postgres).
 *
 * Covers migration 038: single-authority get_credential_status,
 * K/P NULL-reference backstop, approved-release preservation,
 * retired/compromised rejection, expiry re-issuance, explicit revoked
 * guard, and double/concurrent issuance safety. All flows run against
 * SYNTHETIC programs/banks with known answers.
 */

import { Client } from 'pg';
import { adminClient, asRole, createUser, expectDbDenied, newUid } from '../../db-test/helpers';
import { buildCredentialId } from '../domain/credentials/scoring';

let db: Client;
let db2: Client;

const MAIN = 'e2e-claim';
const ROT_OK = 'e2e-claim-rot-ok';
const ROT_DEAD = 'e2e-claim-rot-dead';
const ALL = [MAIN, ROT_OK, ROT_DEAD];

async function makeProgram(slug: string, code: string, setId: string, day: number): Promise<void> {
    await db.query(
        `INSERT INTO credential_programs
            (slug, code, title, level, version, required_score, requires_assessment,
             requires_project, identity_verification_required, issuance_enabled, skills, skill_gates, status)
          VALUES ('${slug}', '${code}', 'E2E ${code}', 'verified-skill', '1.0',
                  80, TRUE, TRUE, FALSE, TRUE,
                  '[{"key":"alpha","name":"Alpha","weight":1.0,"minimumScore":65,"dayRange":[1,7]}]',
                  '[]', 'active')
          ON CONFLICT (slug) DO UPDATE SET issuance_enabled = TRUE`,
    );
    await db.query(
        `INSERT INTO skill_evidence_policy (program_slug, program_version, skill_key, min_items, min_pass_rate, rationale)
          VALUES ('${slug}', '1.0', 'alpha', 1, 0.65, 'claim hardening: single-item depth')
          ON CONFLICT (program_slug, program_version, skill_key) DO NOTHING`,
    );
    await db.query(
        `INSERT INTO credential_content_releases
            (program_slug, program_version, content_version, artifact_sha256,
             machine_qa_status, human_review_status, reviewer, reviewed_at, status)
          VALUES ('${slug}', '1.0', 'claim-v1', 'synthetic-fixture', 'passed', 'approved',
                  'synthetic-fixture', NOW(), 'active')
          ON CONFLICT (program_slug, program_version, content_version) DO NOTHING`,
    );
    await db.query(
        `INSERT INTO trusted_validation_items
            (program_slug, program_version, hobby_id, curriculum_day, skill_key, lesson_id,
             content_version, status, payload, answer_key)
          VALUES ('${slug}', '1.0', 'chess', ${day}, 'alpha', 'e2e-lesson', 'claim-v1', 'active', '{}', '{"answer":"ok"}')
          ON CONFLICT DO NOTHING`,
    );
    for (const i of [1, 2]) {
        await db.query(
            `INSERT INTO knowledge_items (program_slug, program_version, skill_key, item_key, content_version, status, payload, answer_key)
              VALUES ('${slug}', '1.0', 'alpha', 'ck-${slug}-${i}', 'claim-v1', 'active',
                      '{"kind":"mc"}', '{"answer":"yes"}')
              ON CONFLICT DO NOTHING`,
        );
        await db.query(
            `INSERT INTO practical_items (program_slug, program_version, skill_key, item_key, content_version, status, payload, answer_key)
              VALUES ('${slug}', '1.0', 'alpha', 'cp-${slug}-${i}', 'claim-v1', 'active',
                      '{"kind":"task"}', '{"answer":"done"}')
              ON CONFLICT DO NOTHING`,
        );
    }
    await db.query(
        `INSERT INTO assessment_question_sets (id, program_slug, version, question_count, time_limit_minutes, pass_score, questions, content_version, status)
          VALUES ('${setId}', '${slug}', '1.0', 2, 30, 80,
                  '[{"id":"q1","prompt":"a"},{"id":"q2","prompt":"b"}]', 'claim-v1', 'active')
          ON CONFLICT (id) DO NOTHING`,
    );
    await db.query(
        `INSERT INTO assessment_answer_keys (question_set_id, answers, question_ids)
          VALUES ('${setId}', '{"q1":"2","q2":"4"}', '["q1","q2"]')
          ON CONFLICT DO NOTHING`,
    );
}

beforeAll(async () => {
    db = adminClient();
    await db.connect();
    db2 = adminClient();
    await db2.connect();
    await makeProgram(MAIN, 'ECL', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01', 90);
    await makeProgram(ROT_OK, 'ECO', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa02', 91);
    await makeProgram(ROT_DEAD, 'ECD', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa03', 92);
});

afterAll(async () => {
    for (const slug of ALL) {
        await db.query(`DELETE FROM issued_credentials WHERE program_slug = '${slug}'`);
        await db.query(`DELETE FROM assessment_attempts WHERE program_slug = '${slug}'`);
        await db.query(`DELETE FROM knowledge_attempts WHERE program_slug = '${slug}'`);
        await db.query(`DELETE FROM practical_attempts WHERE program_slug = '${slug}'`);
        await db.query(`DELETE FROM trusted_validation_attempts WHERE program_slug = '${slug}'`);
        await db.query(`DELETE FROM trusted_item_results WHERE program_slug = '${slug}'`);
        await db.query(`DELETE FROM learning_events WHERE program_slug = '${slug}'`);
        await db.query(`DELETE FROM credential_component_results WHERE program_slug = '${slug}'`);
        await db.query(`DELETE FROM user_credential_progress WHERE program_slug = '${slug}'`);
        await db.query("SET app.review_override = 'on'");
        await db.query(
            `DELETE FROM project_reviews WHERE id IN (SELECT r.id FROM project_reviews r JOIN project_submissions s ON s.id = r.submission_id WHERE s.program_slug = '${slug}')`,
        );
        await db.query(`DELETE FROM project_certification_results WHERE program_slug = '${slug}'`);
        await db.query(`DELETE FROM project_submissions WHERE program_slug = '${slug}'`);
        await db.query("RESET app.review_override");
    }
    await db.query(`DELETE FROM assessment_answer_keys WHERE question_set_id IN ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa02','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa03')`);
    for (const slug of ALL) {
        await db.query(`DELETE FROM assessment_question_sets WHERE program_slug = '${slug}'`);
        await db.query(`DELETE FROM trusted_validation_items WHERE program_slug = '${slug}'`);
        await db.query(`DELETE FROM knowledge_items WHERE program_slug = '${slug}'`);
        await db.query(`DELETE FROM practical_items WHERE program_slug = '${slug}'`);
        await db.query(`DELETE FROM skill_evidence_policy WHERE program_slug = '${slug}'`);
        await db.query(`DELETE FROM credential_content_releases WHERE program_slug = '${slug}'`);
        await db.query(`DELETE FROM credential_programs WHERE slug = '${slug}'`);
    }
    await db.end();
    await db2.end();
});

/** Full authoritative journey: enroll → skills → K/P → Final → reviewed Project. */
async function completeJourney(uid: string, slug: string): Promise<void> {
    await asRole(db, 'authenticated', uid, () => db.query('SELECT * FROM enroll_in_program($1)', [slug]));
    const v = await asRole(db, 'authenticated', uid, () =>
        db.query('SELECT * FROM start_trusted_validation($1, $2)', [slug, 'alpha']).then(r => r.rows[0]),
    );
    await asRole(db, 'authenticated', uid, () =>
        db.query('SELECT * FROM submit_trusted_validation($1, $2)', [v.attempt_id, { answer: 'ok' }]),
    );
    const k = await asRole(db, 'authenticated', uid, () =>
        db.query('SELECT * FROM start_knowledge_attempt($1)', [slug]).then(r => r.rows[0]),
    );
    const kAns: Record<string, string> = {};
    for (const it of k.questions as { item_key: string }[]) kAns[it.item_key] = 'yes';
    await asRole(db, 'authenticated', uid, () =>
        db.query('SELECT * FROM submit_knowledge_attempt($1, $2)', [k.attempt_id, kAns]),
    );
    const p = await asRole(db, 'authenticated', uid, () =>
        db.query('SELECT * FROM start_practical_attempt($1)', [slug]).then(r => r.rows[0]),
    );
    const pAns: Record<string, string> = {};
    for (const it of p.tasks as { item_key: string }[]) pAns[it.item_key] = 'done';
    await asRole(db, 'authenticated', uid, () =>
        db.query('SELECT * FROM submit_practical_attempt($1, $2)', [p.attempt_id, pAns]),
    );
    const exam = await asRole(db, 'authenticated', uid, () =>
        db.query('SELECT * FROM start_assessment($1)', [slug]).then(r => r.rows[0]),
    );
    await asRole(db, 'authenticated', uid, () =>
        db.query('SELECT * FROM submit_assessment($1, $2)', [exam.attempt_id, { q1: '2', q2: '4' }]),
    );
    const sub = await asRole(db, 'authenticated', uid, () =>
        db.query('SELECT * FROM submit_project($1, $2, $3)', [slug, 'artifact://claim', 'notes']).then(r => r.rows[0].submission_id as string),
    );
    await db.query(
        `INSERT INTO project_reviews (submission_id, rubric, authoritative_score, passed, reviewer)
          VALUES ($1, '{}', 90, TRUE, 'service_role_e2e')`, [sub],
    );
}

async function issueAs(uid: string, slug: string, conn: Client = db) {
    return asRole(conn, 'authenticated', uid, () =>
        conn.query('SELECT * FROM issue_credential($1, $2)', [slug, 'Claim Holder']).then(r => r.rows[0]),
    );
}

async function statusAs(uid: string, slug: string) {
    return asRole(db, 'authenticated', uid, () =>
        db.query('SELECT * FROM get_credential_status($1)', [slug]).then(r => r.rows[0]),
    );
}

async function credCount(uid: string, slug: string): Promise<number> {
    const r = await db.query(
        `SELECT COUNT(*)::int c FROM issued_credentials WHERE user_id = $1 AND program_slug = $2`, [uid, slug],
    );
    return r.rows[0].c as number;
}

describe('claim hardening: double-submit + retry idempotency', () => {
    test('1. sequential double-submit returns the same credential, one row', async () => {
        const uid = newUid();
        await createUser(db, uid);
        await completeJourney(uid, MAIN);
        const first = await issueAs(uid, MAIN);
        expect(first.created).toBe(true);
        expect(first.credential_id).toMatch(/^ZNX-[0-9a-f]{32}$/i);
        const second = await issueAs(uid, MAIN);
        expect(second.created).toBe(false);
        expect(second.credential_id).toBe(first.credential_id);
        expect(await credCount(uid, MAIN)).toBe(1);
    });

    test('2. retry after successful issuance (lost response) returns same id, one row', async () => {
        const uid = newUid();
        await createUser(db, uid);
        await completeJourney(uid, MAIN);
        const issued = await issueAs(uid, MAIN);
        // Simulate a lost response: the client retries without server state.
        const retry = await issueAs(uid, MAIN);
        expect(retry.credential_id).toBe(issued.credential_id);
        expect(retry.created).toBe(false);
        expect(await credCount(uid, MAIN)).toBe(1);
        const st = await statusAs(uid, MAIN);
        expect(st.state).toBe('issued');
        expect(st.credential_id).toBe(issued.credential_id);
    });
});

describe('claim hardening: K/P reference backstop', () => {
    test('3. passed component with NULL or dangling reference_id is rejected', async () => {
        for (const [component, re] of [
            ['knowledge', /component_missing_or_failed:knowledge/],
            ['practical', /component_missing_or_failed:practical/],
        ] as const) {
            const uid = newUid();
            await createUser(db, uid);
            await completeJourney(uid, MAIN);
            // NULL reference: previously passed the bank EXISTS check vacuously.
            await db.query(`DELETE FROM credential_component_results WHERE user_id = $1 AND program_slug = $2 AND component = $3`, [uid, MAIN, component]);
            await db.query(
                `INSERT INTO credential_component_results (user_id, program_slug, program_version, component, score, passed, authority_source, reference_id)
                  VALUES ($1, $2, '1.0', $3, 100, TRUE, 'server_e2e', NULL)`, [uid, MAIN, component],
            );
            await asRole(db, 'authenticated', uid, () =>
                expectDbDenied(db.query('SELECT * FROM issue_credential($1, $2)', [MAIN, 'H']), re),
            );
            // Dangling reference (no such attempt) is rejected too.
            await db.query(`DELETE FROM credential_component_results WHERE user_id = $1 AND program_slug = $2 AND component = $3`, [uid, MAIN, component]);
            await db.query(
                `INSERT INTO credential_component_results (user_id, program_slug, program_version, component, score, passed, authority_source, reference_id)
                  VALUES ($1, $2, '1.0', $3, 100, TRUE, 'server_e2e', '00000000-0000-0000-0000-000000000000')`, [uid, MAIN, component],
            );
            await asRole(db, 'authenticated', uid, () =>
                expectDbDenied(db.query('SELECT * FROM issue_credential($1, $2)', [MAIN, 'H']), re),
            );
            expect(await credCount(uid, MAIN)).toBe(0);
        }
    });
});

describe('claim hardening: release rotation', () => {
    test('4. approved old release stays issuable when a new release goes live', async () => {
        const uid = newUid();
        await createUser(db, uid);
        await completeJourney(uid, ROT_OK);
        // Release B goes live; A steps back to approved (still authoritative).
        await db.query(`UPDATE credential_content_releases SET status = 'approved' WHERE program_slug = '${ROT_OK}' AND content_version = 'claim-v1'`);
        await db.query(
            `INSERT INTO credential_content_releases (program_slug, program_version, content_version, artifact_sha256, machine_qa_status, human_review_status, reviewer, reviewed_at, status)
              VALUES ('${ROT_OK}', '1.0', 'claim-v2', 'synthetic-fixture', 'passed', 'approved', 'synthetic-fixture', NOW(), 'active')`,
        );
        const issued = await issueAs(uid, ROT_OK);
        expect(issued.credential_id).toMatch(/^ZNX-/);
        expect(await credCount(uid, ROT_OK)).toBe(1);
        const st = await statusAs(uid, ROT_OK);
        expect(st.state).toBe('issued');
    });

    test('5. retired/compromised old release rejects issuance', async () => {
        const uidR = newUid();
        await createUser(db, uidR);
        await completeJourney(uidR, ROT_DEAD);
        await db.query(`UPDATE credential_content_releases SET status = 'retired' WHERE program_slug = '${ROT_DEAD}' AND content_version = 'claim-v1'`);
        await asRole(db, 'authenticated', uidR, () =>
            expectDbDenied(db.query('SELECT * FROM issue_credential($1, $2)', [ROT_DEAD, 'H']), /bank not active|skill_gate_failed/),
        );
        const stRetired = await statusAs(uidR, ROT_DEAD);
        expect(stRetired.state).toBe('temporarily_unavailable');
        expect(await credCount(uidR, ROT_DEAD)).toBe(0);
        // Compromised is equally refused (fresh user, same retired-content journey shape).
        const uidC = newUid();
        await createUser(db, uidC);
        await db.query(`UPDATE credential_content_releases SET status = 'compromised' WHERE program_slug = '${ROT_DEAD}' AND content_version = 'claim-v1'`);
        // Journey must be rebuilt against live content; with the only
        // release compromised, even starting is fail-closed.
        await asRole(db, 'authenticated', uidC, () => db.query('SELECT * FROM enroll_in_program($1)', [ROT_DEAD]));
        await asRole(db, 'authenticated', uidC, () =>
            expectDbDenied(db.query('SELECT * FROM start_trusted_validation($1, $2)', [ROT_DEAD, 'alpha']), /credential_content_unavailable|no trusted content/),
        );
        const stComp = await statusAs(uidC, ROT_DEAD);
        expect(stComp.state).toBe('locked');
    });
});

describe('claim hardening: expiry lifecycle', () => {
    test('6. expired verifies as expired, then re-issues deterministically without duplicates', async () => {
        const uid = newUid();
        await createUser(db, uid);
        await completeJourney(uid, MAIN);
        const first = await issueAs(uid, MAIN);
        await db.query(`UPDATE issued_credentials SET expires_at = NOW() - INTERVAL '1 day' WHERE credential_id = $1`, [first.credential_id]);
        const pub = await asRole(db, 'anon', null, () =>
            db.query('SELECT * FROM verify_credential($1)', [first.credential_id]).then(r => r.rows[0]),
        );
        expect(pub.status).toBe('expired');
        const stExpired = await statusAs(uid, MAIN);
        expect(stExpired.state).toBe('expired');
        expect(stExpired.credential_id).toBe(first.credential_id);
        // Expired never masquerades as active and never blocks re-issuance.
        const second = await issueAs(uid, MAIN);
        expect(second.created).toBe(true);
        expect(second.credential_id).not.toBe(first.credential_id);
        expect(await credCount(uid, MAIN)).toBe(1);
        const pub2 = await asRole(db, 'anon', null, () =>
            db.query('SELECT * FROM verify_credential($1)', [second.credential_id]).then(r => r.rows[0]),
        );
        expect(pub2.status).toBe('active');
        const stIssued = await statusAs(uid, MAIN);
        expect(stIssued.state).toBe('issued');
        expect(stIssued.credential_id).toBe(second.credential_id);
    });
});

describe('claim hardening: mutation + concurrency guards', () => {
    test('7. authenticated clients cannot write issued_credentials; internals are not callable', async () => {
        const uid = newUid();
        await createUser(db, uid);
        await completeJourney(uid, MAIN);
        const issued = await issueAs(uid, MAIN);
        // RLS default-deny is a silent row filter for UPDATE/DELETE (no
        // USING policy exists): the statements succeed but touch 0 rows.
        // INSERT raises 42501 (no WITH CHECK policy). Either way the
        // verification truth cannot change.
        const before = await db.query(`SELECT holder_display_name FROM issued_credentials WHERE credential_id = $1`, [issued.credential_id]);
        const upd = await asRole(db, 'authenticated', uid, () =>
            db.query(`UPDATE issued_credentials SET holder_display_name = 'Hax' WHERE credential_id = $1`, [issued.credential_id]),
        );
        expect(upd.rowCount).toBe(0);
        const afterUpd = await db.query(`SELECT holder_display_name FROM issued_credentials WHERE credential_id = $1`, [issued.credential_id]);
        expect(afterUpd.rows[0].holder_display_name).toBe(before.rows[0].holder_display_name);
        await asRole(db, 'authenticated', uid, () =>
            expectDbDenied(
                db.query(`INSERT INTO issued_credentials (credential_id, user_id, program_slug, program_title, program_version, holder_display_name, final_score, grade) VALUES ('ZNX-HAX', $1, '${MAIN}', 'Hax', '1.0', 'Hax', 100, 'pass')`, [uid]),
                /permission denied|policy|row-level security/,
            ),
        );
        const del = await asRole(db, 'authenticated', uid, () =>
            db.query(`DELETE FROM issued_credentials WHERE credential_id = $1`, [issued.credential_id]),
        );
        expect(del.rowCount).toBe(0);
        expect(await credCount(uid, MAIN)).toBe(1);
        // The shared eligibility helper is internal: no client EXECUTE.
        const privs = await db.query(
            `SELECT has_function_privilege('authenticated', 'assess_credential_eligibility(text)', 'EXECUTE') AS helper_auth,
                    has_function_privilege('anon', 'assess_credential_eligibility(text)', 'EXECUTE') AS helper_anon,
                    has_function_privilege('anon', 'get_credential_status(text)', 'EXECUTE') AS status_anon,
                    has_function_privilege('authenticated', 'get_credential_status(text)', 'EXECUTE') AS status_auth`,
        );
        expect(privs.rows[0].helper_auth).toBe(false);
        expect(privs.rows[0].helper_anon).toBe(false);
        expect(privs.rows[0].status_anon).toBe(false);
        expect(privs.rows[0].status_auth).toBe(true);
        await asRole(db, 'authenticated', uid, () =>
            expectDbDenied(db.query(`SELECT * FROM assess_credential_eligibility($1)`, [MAIN]), /permission denied|policy/),
        );
        // Anon cannot issue either; anon cannot read claim status.
        await asRole(db, 'anon', null, () =>
            expectDbDenied(db.query('SELECT * FROM issue_credential($1, $2)', [MAIN, 'H']), /permission denied|policy/),
        );
        await asRole(db, 'anon', null, () =>
            expectDbDenied(db.query('SELECT * FROM get_credential_status($1)', [MAIN]), /permission denied|policy/),
        );
    });

    test('8. concurrent revoked re-issuance yields exactly one active credential', async () => {
        const uid = newUid();
        await createUser(db, uid);
        await completeJourney(uid, MAIN);
        const first = await issueAs(uid, MAIN);
        await db.query(`UPDATE issued_credentials SET status = 'revoked' WHERE credential_id = $1`, [first.credential_id]);
        const run = () =>
            asRole(db2, 'authenticated', uid, () =>
                db2.query('SELECT * FROM issue_credential($1, $2)', [MAIN, 'H']).then(r => r.rows[0]),
            );
        const [a, b] = await Promise.all([run(), run()]);
        expect(a.credential_id).toBe(b.credential_id);
        expect(a.credential_id).not.toBe(first.credential_id);
        expect(await credCount(uid, MAIN)).toBe(1);
        const row = await db.query(`SELECT status FROM issued_credentials WHERE user_id = $1 AND program_slug = $2`, [uid, MAIN]);
        expect(row.rows[0].status).toBe('active');
    });
});

describe('claim hardening: canonical status contract', () => {
    test('9. get_credential_status walks locked → ready_to_issue → issued → revoked → expired', async () => {
        const uid = newUid();
        await createUser(db, uid);
        // Incomplete (no enrollment): locked, no fields leaked.
        const fresh = await statusAs(uid, MAIN);
        expect(fresh.state).toBe('locked');
        expect(fresh.credential_id).toBeNull();
        expect(fresh.score).toBeNull();
        // Enrolled but incomplete: still locked.
        await asRole(db, 'authenticated', uid, () => db.query('SELECT * FROM enroll_in_program($1)', [MAIN]));
        expect((await statusAs(uid, MAIN)).state).toBe('locked');
        // Complete journey, no credential: ready with score/grade preview.
        const v = await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM start_trusted_validation($1, $2)', [MAIN, 'alpha']).then(r => r.rows[0]),
        );
        await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM submit_trusted_validation($1, $2)', [v.attempt_id, { answer: 'ok' }]),
        );
        const k = await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM start_knowledge_attempt($1)', [MAIN]).then(r => r.rows[0]),
        );
        const kAns: Record<string, string> = {};
        for (const it of k.questions as { item_key: string }[]) kAns[it.item_key] = 'yes';
        await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM submit_knowledge_attempt($1, $2)', [k.attempt_id, kAns]),
        );
        const p = await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM start_practical_attempt($1)', [MAIN]).then(r => r.rows[0]),
        );
        const pAns: Record<string, string> = {};
        for (const it of p.tasks as { item_key: string }[]) pAns[it.item_key] = 'done';
        await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM submit_practical_attempt($1, $2)', [p.attempt_id, pAns]),
        );
        const exam = await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM start_assessment($1)', [MAIN]).then(r => r.rows[0]),
        );
        await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM submit_assessment($1, $2)', [exam.attempt_id, { q1: '2', q2: '4' }]),
        );
        const sub = await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM submit_project($1, $2, $3)', [MAIN, 'artifact://s', 'n']).then(r => r.rows[0].submission_id as string),
        );
        await db.query(`INSERT INTO project_reviews (submission_id, rubric, authoritative_score, passed, reviewer) VALUES ($1, '{}', 90, TRUE, 'service_role_e2e')`, [sub]);
        const ready = await statusAs(uid, MAIN);
        expect(ready.state).toBe('ready_to_issue');
        expect(ready.credential_id).toBeNull();
        expect(Number(ready.score)).toBeGreaterThanOrEqual(80);
        expect(ready.grade).toBeTruthy();
        // Issued → revoked → expired walk.
        const issued = await issueAs(uid, MAIN);
        const stIssued = await statusAs(uid, MAIN);
        expect(stIssued.state).toBe('issued');
        expect(stIssued.credential_id).toBe(issued.credential_id);
        expect(Number(stIssued.score)).toBe(Number(ready.score));
        await db.query(`UPDATE issued_credentials SET status = 'revoked' WHERE credential_id = $1`, [issued.credential_id]);
        const stRevoked = await statusAs(uid, MAIN);
        expect(stRevoked.state).toBe('revoked');
        expect(stRevoked.credential_id).toBe(issued.credential_id);
        // Revoked correction path re-issues; then expiry is reported.
        const reissued = await issueAs(uid, MAIN);
        await db.query(`UPDATE issued_credentials SET expires_at = NOW() - INTERVAL '1 day' WHERE credential_id = $1`, [reissued.credential_id]);
        const stExpired = await statusAs(uid, MAIN);
        expect(stExpired.state).toBe('expired');
        expect(stExpired.credential_id).toBe(reissued.credential_id);
    });
});

describe('claim hardening: local credentials never verify', () => {
    test('10. legacy ZNY local ids return not-found from server verification', async () => {
        const local = buildCredentialId('CHF', 'user-a', '2026-09-10T00:00:00.000Z');
        expect(local).toMatch(/^ZNY-/);
        const rows = await asRole(db, 'anon', null, () =>
            db.query('SELECT * FROM verify_credential($1)', [local]).then(r => r.rows),
        );
        expect(rows).toHaveLength(0);
    });
});
