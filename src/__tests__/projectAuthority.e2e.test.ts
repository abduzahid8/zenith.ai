/**
 * Real-DB integration tests: Project submission authority (migration 037).
 *
 * - Authenticated clients keep SELECT on their own project_submissions
 *   only: direct INSERT/UPDATE/DELETE are denied at RLS.
 * - submit_project(...) is the sole creation path, gated on: an active +
 *   issuance-enabled program, current-version enrollment, exactly one
 *   live release, a CURRENT live-backed Final PASS, and a non-empty
 *   payload. Pending submissions are idempotent per user+program+version;
 *   failed reviews open a revision, passed reviews refuse another.
 * - Reviews bind the LATEST submission revision only: delayed reviews of
 *   superseded revisions are rejected before feeding certification or
 *   component results. History is never rewritten.
 *
 * Isolated slugs per test (one shared DB per invocation). Run with
 * `npm run test:e2e`.
 */

import { Client } from 'pg';
import { adminClient, asRole, createUser, expectDbDenied, newUid } from '../../db-test/helpers';

let db: Client;

const SKILLS = '[{"key":"alpha","name":"Alpha Skill","weight":1.0,"minimumScore":65,"dayRange":[1,7]}]';

async function makeProgram(slug: string, issuance = true): Promise<void> {
    await db.query(
        `INSERT INTO credential_programs
            (slug, code, title, level, version, required_score, requires_assessment,
             requires_project, identity_verification_required, issuance_enabled, skills, skill_gates, status)
         VALUES ('${slug}', 'PJ', 'Project Harness', 'verified-skill', '1.0',
                 80, TRUE, FALSE, FALSE, ${issuance ? 'TRUE' : 'FALSE'}, '${SKILLS}', '[]', 'active')
         ON CONFLICT (slug) DO UPDATE SET issuance_enabled = ${issuance ? 'TRUE' : 'FALSE'}`,
    );
    await db.query(
        `INSERT INTO skill_evidence_policy (program_slug, program_version, skill_key, min_items, min_pass_rate, rationale)
         VALUES ('${slug}', '1.0', 'alpha', 1, 0.65, 'project probe')
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
    // Reviews are immutable by trigger; teardown holds the ops hatch.
    await db.query("SET app.review_override = 'on'");
    try {
        await db.query(`DELETE FROM project_reviews WHERE submission_id IN
            (SELECT id FROM project_submissions WHERE program_slug = '${slug}')`);
    } finally {
        await db.query('RESET app.review_override');
    }
    await db.query(`DELETE FROM project_certification_results WHERE program_slug = '${slug}'`);
    await db.query(`DELETE FROM project_submissions WHERE program_slug = '${slug}'`);
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

function submitProject(uid: string, slug: string, artifact: string | null, notes: string | null, dbc: Client = db) {
    return asRole(dbc, 'authenticated', uid, () =>
        dbc.query('SELECT * FROM submit_project($1, $2, $3)', [slug, artifact, notes]).then(r => r.rows[0]),
    );
}

async function enroll(uid: string, slug: string): Promise<void> {
    await asRole(db, 'authenticated', uid, () => db.query('SELECT * FROM enroll_in_program($1)', [slug]));
}

/** Full live readiness + live Final PASS on the single live release. */
async function readyFinalPass(uid: string, slug: string): Promise<void> {
    const t = await asRole(db, 'authenticated', uid, () =>
        db.query('SELECT * FROM start_trusted_validation($1, $2)', [slug, 'alpha']).then(r => r.rows[0]),
    );
    await asRole(db, 'authenticated', uid, () =>
        db.query('SELECT * FROM submit_trusted_validation($1, $2)', [t.attempt_id, { answer: 'ok' }]),
    );
    const k = await asRole(db, 'authenticated', uid, () =>
        db.query('SELECT * FROM start_knowledge_attempt($1)', [slug]).then(r => r.rows[0]),
    );
    const kItems = k.questions as { item_key: string }[];
    const kAnswers: Record<string, string> = {};
    for (const it of kItems) kAnswers[it.item_key] = 'ok';
    await asRole(db, 'authenticated', uid, () =>
        db.query('SELECT * FROM submit_knowledge_attempt($1, $2)', [k.attempt_id, kAnswers]),
    );
    const p = await asRole(db, 'authenticated', uid, () =>
        db.query('SELECT * FROM start_practical_attempt($1)', [slug]).then(r => r.rows[0]),
    );
    const pItems = p.tasks as { item_key: string }[];
    const pAnswers: Record<string, string> = {};
    for (const it of pItems) pAnswers[it.item_key] = 'ok';
    await asRole(db, 'authenticated', uid, () =>
        db.query('SELECT * FROM submit_practical_attempt($1, $2)', [p.attempt_id, pAnswers]),
    );
    const f = await asRole(db, 'authenticated', uid, () =>
        db.query('SELECT * FROM start_assessment($1)', [slug]).then(r => r.rows[0]),
    );
    const sub = await asRole(db, 'authenticated', uid, () =>
        db.query('SELECT * FROM submit_assessment($1, $2)', [f.attempt_id, { q1: '2' }]).then(r => r.rows[0]),
    );
    expect(sub.passed).toBe(true);
}

/**
 * Server-side row plant (superuser + trusted flag so the insert guard
 * keeps the explicit owner). Plain admin inserts would null the owner.
 */
async function plantSubmission(uid: string, slug: string, artifact: string, notes: string): Promise<string> {
    await db.query("SET app.trusted_server = 'on'");
    try {
        const rows = await db.query(
            `INSERT INTO project_submissions (user_id, program_slug, version, artifact_ref, notes)
             VALUES ($1, '${slug}', '1.0', $2, $3) RETURNING id`,
            [uid, artifact, notes],
        );
        return rows.rows[0].id as string;
    } finally {
        await db.query('RESET app.trusted_server');
    }
}

async function review(
    submissionId: string,
    passed: boolean,
    score: number,
    revision = 1,
): Promise<void> {
    await db.query(
        `INSERT INTO project_reviews (submission_id, revision, rubric, authoritative_score, passed, reviewer)
         VALUES ($1, $2, '{}', $3, $4, 'service_role_e2e')`,
        [submissionId, revision, score, passed],
    );
}

async function submissionCount(uid: string, slug: string): Promise<number> {
    const rows = await db.query(
        `SELECT COUNT(*)::int c FROM project_submissions WHERE user_id = $1 AND program_slug = $2`,
        [uid, slug],
    );
    return rows.rows[0].c as number;
}

beforeAll(async () => {
    db = adminClient();
    await db.connect();
});

afterAll(async () => {
    await db.end();
});

describe('real DB: direct project writes denied, reads scoped', () => {
    test('1/2/3. authenticated direct INSERT/UPDATE/DELETE denied', async () => {
        const slug = 'e2e-proj-rls';
        await makeProgram(slug);
        await addRelease(slug, 'live-v1', 'active');
        const uid = newUid();
        await createUser(db, uid);
        try {
            await asRole(db, 'authenticated', uid, () =>
                expectDbDenied(
                    db.query(`INSERT INTO project_submissions (program_slug, version) VALUES ('${slug}','1.0')`),
                    /permission denied|policy/,
                ),
            );
            // A row planted by server authority still cannot be touched:
            // UPDATE/DELETE match zero rows under RLS (no policy at all).
            const id = await plantSubmission(uid, slug, 'artifact://seed', 'seed');
            const upd = await asRole(db, 'authenticated', uid, () =>
                db.query(`UPDATE project_submissions SET notes = 'hijack' WHERE id = $1`, [id]),
            );
            expect(upd.rowCount).toBe(0);
            const del = await asRole(db, 'authenticated', uid, () =>
                db.query(`DELETE FROM project_submissions WHERE id = $1`, [id]),
            );
            expect(del.rowCount).toBe(0);
            const intact = await db.query(`SELECT notes FROM project_submissions WHERE id = $1`, [id]);
            expect(intact.rows[0].notes).toBe('seed');
        } finally {
            await wipeProgram(slug);
        }
    });

    test('4/5. SELECT own only; another user sees zero rows', async () => {
        const slug = 'e2e-proj-sel';
        await makeProgram(slug);
        await addRelease(slug, 'live-v1', 'active');
        const uidA = newUid();
        const uidB = newUid();
        await createUser(db, uidA);
        await createUser(db, uidB);
        try {
            await plantSubmission(uidA, slug, 'artifact://a', 'a');
            const mine = await asRole(db, 'authenticated', uidA, () =>
                db.query(`SELECT * FROM project_submissions WHERE program_slug = '${slug}'`).then(r => r.rowCount),
            );
            expect(mine).toBe(1);
            const theirs = await asRole(db, 'authenticated', uidB, () =>
                db.query(`SELECT * FROM project_submissions WHERE program_slug = '${slug}'`).then(r => r.rowCount),
            );
            expect(theirs).toBe(0);
        } finally {
            await wipeProgram(slug);
        }
    });
});

describe('real DB: submit_project gates', () => {
    test('6. submit without enrollment denied', async () => {
        const slug = 'e2e-proj-enroll';
        await makeProgram(slug);
        await addRelease(slug, 'live-v1', 'active');
        const uid = newUid();
        await createUser(db, uid);
        try {
            await asRole(db, 'authenticated', uid, () =>
                expectDbDenied(
                    db.query('SELECT * FROM submit_project($1, $2, $3)', [slug, 'artifact://x', 'n']),
                    /enrollment_required/,
                ),
            );
            expect(await submissionCount(uid, slug)).toBe(0);
        } finally {
            await wipeProgram(slug);
        }
    });

    test('7. issuance-disabled program denied', async () => {
        const slug = 'e2e-proj-official';
        await makeProgram(slug, false);
        await addRelease(slug, 'live-v1', 'active');
        const uid = newUid();
        await createUser(db, uid);
        try {
            await enroll(uid, slug);
            await asRole(db, 'authenticated', uid, () =>
                expectDbDenied(
                    db.query('SELECT * FROM submit_project($1, $2, $3)', [slug, 'artifact://x', 'n']),
                    /project_unavailable/,
                ),
            );
            expect(await submissionCount(uid, slug)).toBe(0);
        } finally {
            await wipeProgram(slug);
        }
    });

    test('8. missing Final PASS denied', async () => {
        const slug = 'e2e-proj-nofinal';
        await makeProgram(slug);
        await addRelease(slug, 'live-v1', 'active');
        await addTrustedItem(slug, 'live-v1', 'les-a', 80);
        await addKnowledgeItem(slug, 'live-v1', 'k1');
        await addPracticalItem(slug, 'live-v1', 'p1');
        await addQuestionSet(slug, newUid(), 'live-v1');
        const uid = newUid();
        await createUser(db, uid);
        try {
            await enroll(uid, slug);
            await asRole(db, 'authenticated', uid, () =>
                expectDbDenied(
                    db.query('SELECT * FROM submit_project($1, $2, $3)', [slug, 'artifact://x', 'n']),
                    /project_not_ready:final/,
                ),
            );
            expect(await submissionCount(uid, slug)).toBe(0);
        } finally {
            await wipeProgram(slug);
        }
    });

    test('9. stale Final PASS denied', async () => {
        const slug = 'e2e-proj-stale';
        await makeProgram(slug);
        await addRelease(slug, 'live-v1', 'active');
        await addTrustedItem(slug, 'live-v1', 'les-a', 80);
        await addKnowledgeItem(slug, 'live-v1', 'k-live-v1');
        await addPracticalItem(slug, 'live-v1', 'p-live-v1');
        await addQuestionSet(slug, newUid(), 'live-v1');
        const uid = newUid();
        await createUser(db, uid);
        try {
            await enroll(uid, slug);
            await readyFinalPass(uid, slug);
            await retireVersion(slug, 'live-v1');
            await addRelease(slug, 'live-v2', 'active');
            await addQuestionSet(slug, newUid(), 'live-v2');
            await asRole(db, 'authenticated', uid, () =>
                expectDbDenied(
                    db.query('SELECT * FROM submit_project($1, $2, $3)', [slug, 'artifact://x', 'n']),
                    /project_not_ready:final/,
                ),
            );
            expect(await submissionCount(uid, slug)).toBe(0);
        } finally {
            await wipeProgram(slug);
        }
    });

    test('10. unresolved / NULL Final reference denied', async () => {
        const slug = 'e2e-proj-nullref';
        await makeProgram(slug);
        await addRelease(slug, 'live-v1', 'active');
        await addQuestionSet(slug, newUid(), 'live-v1');
        const uid = newUid();
        await createUser(db, uid);
        try {
            await enroll(uid, slug);
            // Seeded PASS with a NULL reference (legacy shape).
            await db.query(
                `INSERT INTO credential_component_results
                    (user_id, program_slug, program_version, component, score, passed, authority_source, reference_id)
                 VALUES ($1, '${slug}', '1.0', 'final_assessment', 90, TRUE, 'seed', NULL)`,
                [uid],
            );
            await asRole(db, 'authenticated', uid, () =>
                expectDbDenied(
                    db.query('SELECT * FROM submit_project($1, $2, $3)', [slug, 'artifact://x', 'n']),
                    /project_not_ready:final/,
                ),
            );
            // And a ghost reference to no attempt at all.
            await db.query(
                `UPDATE credential_component_results SET reference_id = $2
                 WHERE user_id = $1 AND component = 'final_assessment'`,
                [uid, newUid()],
            );
            await asRole(db, 'authenticated', uid, () =>
                expectDbDenied(
                    db.query('SELECT * FROM submit_project($1, $2, $3)', [slug, 'artifact://x', 'n']),
                    /project_not_ready:final/,
                ),
            );
            expect(await submissionCount(uid, slug)).toBe(0);
        } finally {
            await wipeProgram(slug);
        }
    });

    test('11. current-live Final PASS allows project submit', async () => {
        const slug = 'e2e-proj-ok';
        await makeProgram(slug);
        await addRelease(slug, 'live-v1', 'active');
        await addTrustedItem(slug, 'live-v1', 'les-a', 80);
        await addKnowledgeItem(slug, 'live-v1', 'k-live-v1');
        await addPracticalItem(slug, 'live-v1', 'p-live-v1');
        await addQuestionSet(slug, newUid(), 'live-v1');
        const uid = newUid();
        await createUser(db, uid);
        try {
            await enroll(uid, slug);
            await readyFinalPass(uid, slug);
            const row = await submitProject(uid, slug, 'artifact://final', 'my notes');
            expect(row.submission_id).toBeDefined();
            const saved = await db.query(
                `SELECT user_id, program_slug, version, artifact_ref, notes
                 FROM project_submissions WHERE id = $1`,
                [row.submission_id],
            );
            expect(saved.rows[0]).toMatchObject({
                user_id: uid,
                program_slug: slug,
                version: '1.0',
                artifact_ref: 'artifact://final',
                notes: 'my notes',
            });
        } finally {
            await wipeProgram(slug);
        }
    });

    test('12. empty artifact+notes creates no submission', async () => {
        const slug = 'e2e-proj-empty';
        await makeProgram(slug);
        await addRelease(slug, 'live-v1', 'active');
        await addTrustedItem(slug, 'live-v1', 'les-a', 80);
        await addKnowledgeItem(slug, 'live-v1', 'k-live-v1');
        await addPracticalItem(slug, 'live-v1', 'p-live-v1');
        await addQuestionSet(slug, newUid(), 'live-v1');
        const uid = newUid();
        await createUser(db, uid);
        try {
            await enroll(uid, slug);
            await readyFinalPass(uid, slug);
            await asRole(db, 'authenticated', uid, () =>
                expectDbDenied(
                    db.query('SELECT * FROM submit_project($1, $2, $3)', [slug, '   ', '\n\t ']),
                    /project_submission_empty/,
                ),
            );
            await asRole(db, 'authenticated', uid, () =>
                expectDbDenied(
                    db.query('SELECT * FROM submit_project($1, $2, $3)', [slug, null, null]),
                    /project_submission_empty/,
                ),
            );
            expect(await submissionCount(uid, slug)).toBe(0);
        } finally {
            await wipeProgram(slug);
        }
    });
});

describe('real DB: pending idempotency + revisions', () => {
    async function readyEnrolled(slug: string, uid: string): Promise<void> {
        await enroll(uid, slug);
        await readyFinalPass(uid, slug);
    }

    async function liveProgram(slug: string): Promise<void> {
        await makeProgram(slug);
        await addRelease(slug, 'live-v1', 'active');
        await addTrustedItem(slug, 'live-v1', 'les-a', 80);
        await addKnowledgeItem(slug, 'live-v1', 'k-live-v1');
        await addPracticalItem(slug, 'live-v1', 'p-live-v1');
        await addQuestionSet(slug, newUid(), 'live-v1');
    }

    test('13. first valid submit creates one row', async () => {
        const slug = 'e2e-proj-first';
        await liveProgram(slug);
        const uid = newUid();
        await createUser(db, uid);
        try {
            await readyEnrolled(slug, uid);
            const row = await submitProject(uid, slug, 'artifact://one', 'notes one');
            expect(await submissionCount(uid, slug)).toBe(1);
            const saved = await db.query(`SELECT artifact_ref FROM project_submissions WHERE id = $1`, [
                row.submission_id,
            ]);
            expect(saved.rows[0].artifact_ref).toBe('artifact://one');
        } finally {
            await wipeProgram(slug);
        }
    });

    test('14. repeated pending submit returns same submission id', async () => {
        const slug = 'e2e-proj-idem';
        await liveProgram(slug);
        const uid = newUid();
        await createUser(db, uid);
        try {
            await readyEnrolled(slug, uid);
            const first = await submitProject(uid, slug, 'artifact://one', 'first');
            const second = await submitProject(uid, slug, 'artifact://two', 'second');
            expect(second.submission_id).toBe(first.submission_id);
            expect(await submissionCount(uid, slug)).toBe(1);
            // First payload wins: the pending row is never patched.
            const saved = await db.query(`SELECT artifact_ref, notes FROM project_submissions WHERE id = $1`, [
                first.submission_id,
            ]);
            expect(saved.rows[0]).toMatchObject({ artifact_ref: 'artifact://one', notes: 'first' });
        } finally {
            await wipeProgram(slug);
        }
    });

    test('15. concurrency creates only one pending submission', async () => {
        const slug = 'e2e-proj-race';
        await liveProgram(slug);
        const uid = newUid();
        await createUser(db, uid);
        const conns = [adminClient(), adminClient(), adminClient()];
        try {
            await readyEnrolled(slug, uid);
            await Promise.all(conns.map(c => c.connect()));
            const results = await Promise.all(
                conns.map(c => submitProject(uid, slug, 'artifact://r', 'race', c)),
            );
            const ids = new Set(results.map(r => r.submission_id));
            expect(ids.size).toBe(1);
            expect(await submissionCount(uid, slug)).toBe(1);
        } finally {
            await Promise.all(conns.map(c => c.end().catch(() => undefined)));
            await wipeProgram(slug);
        }
    });

    test('16/18. failed reviewed submission allows a new immutable revision', async () => {
        const slug = 'e2e-proj-rev';
        await liveProgram(slug);
        const uid = newUid();
        await createUser(db, uid);
        try {
            await readyEnrolled(slug, uid);
            const first = await submitProject(uid, slug, 'artifact://v1', 'v1');
            await review(first.submission_id as string, false, 40, 1);
            const second = await submitProject(uid, slug, 'artifact://v2', 'v2');
            expect(second.submission_id).not.toBe(first.submission_id);
            expect(await submissionCount(uid, slug)).toBe(2);
            // Submission 1 is untouched.
            const old = await db.query(`SELECT artifact_ref, notes FROM project_submissions WHERE id = $1`, [
                first.submission_id,
            ]);
            expect(old.rows[0]).toMatchObject({ artifact_ref: 'artifact://v1', notes: 'v1' });
        } finally {
            await wipeProgram(slug);
        }
    });

    test('17. passed reviewed submission blocks new revision', async () => {
        const slug = 'e2e-proj-passed';
        await liveProgram(slug);
        const uid = newUid();
        await createUser(db, uid);
        try {
            await readyEnrolled(slug, uid);
            const first = await submitProject(uid, slug, 'artifact://v1', 'v1');
            await review(first.submission_id as string, true, 92, 1);
            await asRole(db, 'authenticated', uid, () =>
                expectDbDenied(
                    db.query('SELECT * FROM submit_project($1, $2, $3)', [slug, 'artifact://v2', 'v2']),
                    /project_already_passed/,
                ),
            );
            expect(await submissionCount(uid, slug)).toBe(1);
        } finally {
            await wipeProgram(slug);
        }
    });

    test('19. client cannot mutate old artifact after review', async () => {
        const slug = 'e2e-proj-frozen';
        await liveProgram(slug);
        const uid = newUid();
        await createUser(db, uid);
        try {
            await readyEnrolled(slug, uid);
            const first = await submitProject(uid, slug, 'artifact://v1', 'v1');
            await review(first.submission_id as string, false, 40, 1);
            const upd = await asRole(db, 'authenticated', uid, () =>
                db.query(`UPDATE project_submissions SET artifact_ref = 'artifact://evil' WHERE id = $1`, [
                    first.submission_id,
                ]),
            );
            expect(upd.rowCount).toBe(0);
            const kept = await db.query(`SELECT artifact_ref FROM project_submissions WHERE id = $1`, [
                first.submission_id,
            ]);
            expect(kept.rows[0].artifact_ref).toBe('artifact://v1');
        } finally {
            await wipeProgram(slug);
        }
    });
});

describe('real DB: latest-submission review authority', () => {
    test('20/24. review of latest submission becomes authoritative (failed component)', async () => {
        const slug = 'e2e-proj-feed';
        await makeProgram(slug);
        await addRelease(slug, 'live-v1', 'active');
        await addTrustedItem(slug, 'live-v1', 'les-a', 80);
        await addKnowledgeItem(slug, 'live-v1', 'k-live-v1');
        await addPracticalItem(slug, 'live-v1', 'p-live-v1');
        await addQuestionSet(slug, newUid(), 'live-v1');
        const uid = newUid();
        await createUser(db, uid);
        try {
            await enroll(uid, slug);
            await readyFinalPass(uid, slug);
            const sub = await submitProject(uid, slug, 'artifact://w', 'w');
            await review(sub.submission_id as string, false, 40, 1);
            const cert = await db.query(
                `SELECT submission_id, authoritative_score, passed FROM project_certification_results
                 WHERE user_id = $1 AND program_slug = $2 AND version = '1.0'`,
                [uid, slug],
            );
            expect(cert.rows).toHaveLength(1);
            expect(cert.rows[0].submission_id).toBe(sub.submission_id);
            expect(Number(cert.rows[0].authoritative_score)).toBe(40);
            expect(cert.rows[0].passed).toBe(false);
            const comp = await db.query(
                `SELECT score, passed, authority_source FROM credential_component_results
                 WHERE user_id = $1 AND program_slug = $2 AND component = 'project'`,
                [uid, slug],
            );
            expect(comp.rows).toHaveLength(1);
            expect(Number(comp.rows[0].score)).toBe(40);
            expect(comp.rows[0].passed).toBe(false);
        } finally {
            await wipeProgram(slug);
        }
    });

    test('21/22/23. delayed review of superseded submission rejected; results untouched', async () => {
        const slug = 'e2e-proj-stale-rev';
        await makeProgram(slug);
        await addRelease(slug, 'live-v1', 'active');
        await addTrustedItem(slug, 'live-v1', 'les-a', 80);
        await addKnowledgeItem(slug, 'live-v1', 'k-live-v1');
        await addPracticalItem(slug, 'live-v1', 'p-live-v1');
        await addQuestionSet(slug, newUid(), 'live-v1');
        const uid = newUid();
        await createUser(db, uid);
        try {
            await enroll(uid, slug);
            await readyFinalPass(uid, slug);
            const first = await submitProject(uid, slug, 'artifact://v1', 'v1');
            await review(first.submission_id as string, false, 40, 1);
            const second = await submitProject(uid, slug, 'artifact://v2', 'v2');
            // Delayed review of the superseded revision is rejected.
            await expectDbDenied(
                db.query(
                    `INSERT INTO project_reviews (submission_id, revision, rubric, authoritative_score, passed, reviewer)
                     VALUES ($1, 2, '{}', 95, TRUE, 'service_role_e2e')`,
                    [first.submission_id],
                ),
                /project_review:submission_superseded/,
            );
            // Certification still reflects the latest-reviewed state (fail on v1).
            const cert = await db.query(
                `SELECT submission_id, passed FROM project_certification_results
                 WHERE user_id = $1 AND program_slug = $2 AND version = '1.0'`,
                [uid, slug],
            );
            expect(cert.rows).toHaveLength(1);
            expect(cert.rows[0].submission_id).toBe(first.submission_id);
            expect(cert.rows[0].passed).toBe(false);
            const comp = await db.query(
                `SELECT passed, reference_id FROM credential_component_results
                 WHERE user_id = $1 AND program_slug = $2 AND component = 'project'`,
                [uid, slug],
            );
            expect(comp.rows).toHaveLength(1);
            expect(comp.rows[0].passed).toBe(false);
            expect(comp.rows[0].reference_id).not.toBe(second.submission_id);
        } finally {
            await wipeProgram(slug);
        }
    });

    test('25. latest passing review yields passed project component', async () => {
        const slug = 'e2e-proj-passcomp';
        await makeProgram(slug);
        await addRelease(slug, 'live-v1', 'active');
        await addTrustedItem(slug, 'live-v1', 'les-a', 80);
        await addKnowledgeItem(slug, 'live-v1', 'k-live-v1');
        await addPracticalItem(slug, 'live-v1', 'p-live-v1');
        await addQuestionSet(slug, newUid(), 'live-v1');
        const uid = newUid();
        await createUser(db, uid);
        try {
            await enroll(uid, slug);
            await readyFinalPass(uid, slug);
            const sub = await submitProject(uid, slug, 'artifact://w', 'w');
            await review(sub.submission_id as string, true, 92, 1);
            const comp = await db.query(
                `SELECT score, passed, authority_source FROM credential_component_results
                 WHERE user_id = $1 AND program_slug = $2 AND component = 'project'`,
                [uid, slug],
            );
            expect(comp.rows).toHaveLength(1);
            expect(Number(comp.rows[0].score)).toBe(92);
            expect(comp.rows[0].passed).toBe(true);
            expect(comp.rows[0].authority_source).toBe('server_certified_project');
        } finally {
            await wipeProgram(slug);
        }
    });
});
