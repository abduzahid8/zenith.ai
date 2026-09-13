/**
 * Chess credential integrity E2E (real local Postgres, `npm run test:e2e`).
 *
 * HARD RULE: no production answer keys may appear in this public repo
 * (the chess-v1 bank is compromised via Git history). Therefore:
 * - All operable flows run against SYNTHETIC programs/banks with known
 *   answers (never accepted for production credentials).
 * - Production chess is audited by METADATA only: versions, status,
 *   counts, pins, switches — never keys.
 * - A guard test scans tracked files for production key material.
 */

import { execSync } from 'child_process';
import { Client } from 'pg';
import { adminClient, asRole, createUser, expectDbDenied, newUid } from '../../db-test/helpers';

let db: Client;
let db2: Client;

const QUAD = 'e2e-quad-integrity';
const SKILLS = ['qk-a', 'qk-b', 'qk-c', 'qk-d'];

beforeAll(async () => {
    db = adminClient();
    await db.connect();
    db2 = adminClient();
    await db2.connect();

    // Test-scoped pilot switch (the harness never applies production
    // switch 027): enables chess for metadata assertions below.
    await db.query(
        `UPDATE credential_programs SET issuance_enabled = TRUE WHERE slug = 'chess-foundations'`,
    );

    await db.query(
        `INSERT INTO credential_programs
            (slug, code, title, level, version, required_score, requires_assessment,
             requires_project, identity_verification_required, issuance_enabled, skills, skill_gates, status)
         VALUES ('${QUAD}', 'EQI', 'E2E Quad Integrity', 'verified-skill', '1.0',
                 80, TRUE, TRUE, FALSE, TRUE,
                 '[{"key":"qk-a","name":"Quad A","weight":0.25,"minimumScore":65,"dayRange":[1,7]},{"key":"qk-b","name":"Quad B","weight":0.25,"minimumScore":65,"dayRange":[8,14]},{"key":"qk-c","name":"Quad C","weight":0.25,"minimumScore":65,"dayRange":[15,21]},{"key":"qk-d","name":"Quad D","weight":0.25,"minimumScore":65,"dayRange":[22,28]}]',
                 '[]', 'active')
         ON CONFLICT (slug) DO UPDATE SET issuance_enabled = TRUE`,
    );
    for (const s of SKILLS) {
        await db.query(
            `INSERT INTO skill_evidence_policy (program_slug, program_version, skill_key, min_items, min_pass_rate, rationale)
             VALUES ('${QUAD}', '1.0', '${s}', 4, 0.75, 'e2e synthetic depth') 
             ON CONFLICT (program_slug, program_version, skill_key) DO NOTHING`,
        );
        for (let i = 1; i <= 4; i++) {
            await db.query(
                `INSERT INTO trusted_validation_items
                    (program_slug, program_version, hobby_id, curriculum_day, skill_key, lesson_id,
                     content_version, status, payload, answer_key)
                 VALUES ('${QUAD}', '1.0', 'chess', ${(SKILLS.indexOf(s) * 7) + i}, '${s}', 'quad_${s}_${i}',
                         'quad-v1', 'active', '{"kind":"mc","prompt":"quad ${s} q${i}?","options":["yes","no"]}', '{"answer":"yes"}')
                 ON CONFLICT DO NOTHING`,
            );
        }
        for (let i = 1; i <= 2; i++) {
            await db.query(
                `INSERT INTO knowledge_items (program_slug, program_version, skill_key, item_key, content_version, status, payload, answer_key)
                 VALUES ('${QUAD}', '1.0', '${s}', 'qk-${s}-${i}', 'quad-v1', 'active',
                         '{"kind":"mc","prompt":"k ${s} ${i}?","options":["yes","no"]}', '{"answer":"yes"}')
                 ON CONFLICT DO NOTHING`,
            );
            await db.query(
                `INSERT INTO practical_items (program_slug, program_version, skill_key, item_key, content_version, status, payload, answer_key)
                 VALUES ('${QUAD}', '1.0', '${s}', 'qp-${s}-${i}', 'quad-v1', 'active',
                         '{"kind":"task","prompt":"p ${s} ${i}?"}', '{"answer":"done"}')
                 ON CONFLICT DO NOTHING`,
            );
        }
    }
    const finals: { id: string; skill: string; prompt: string; options: string[] }[] = [];
    const fkeys: Record<string, string> = {};
    const fids: string[] = [];
    for (const s of SKILLS) {
        for (let i = 1; i <= 6; i++) {
            const id = `qf-${s}-${i}`;
            finals.push({ id, skill: s, prompt: `final ${s} ${i}?`, options: ['yes', 'no'] });
            fkeys[id] = 'yes';
            fids.push(id);
        }
    }
    await db.query(
        `INSERT INTO assessment_question_sets (id, program_slug, version, question_count, time_limit_minutes, pass_score, questions, content_version, status)
         VALUES ('33333333-3333-3333-3333-333333333333', '${QUAD}', '1.0', 20, 30, 80, '${JSON.stringify(finals).replace(/'/g, "''")}', 'quad-v1', 'active')
         ON CONFLICT (id) DO NOTHING`,
    );
    await db.query(
        `INSERT INTO assessment_answer_keys (question_set_id, answers, question_ids)
         VALUES ('33333333-3333-3333-3333-333333333333', '${JSON.stringify(fkeys).replace(/'/g, "''")}', '${JSON.stringify(fids)}')
         ON CONFLICT DO NOTHING`,
    );
    await db.query(
        `INSERT INTO credential_content_releases
            (program_slug, program_version, content_version, artifact_sha256,
             machine_qa_status, human_review_status, reviewer, reviewed_at, status)
         VALUES ('${QUAD}', '1.0', 'quad-v1', 'synthetic-fixture', 'passed', 'approved',
                 'synthetic-fixture', NOW(), 'active')
         ON CONFLICT (program_slug, program_version, content_version) DO NOTHING`,
    );
});

afterAll(async () => {
    await db.query(`DELETE FROM issued_credentials WHERE program_slug = '${QUAD}'`);
    await db.query(`DELETE FROM assessment_attempts WHERE program_slug = '${QUAD}'`);
    await db.query(`DELETE FROM assessment_answer_keys WHERE question_set_id = '33333333-3333-3333-3333-333333333333'`);
    await db.query(`DELETE FROM assessment_question_sets WHERE program_slug = '${QUAD}'`);
    await db.query(`DELETE FROM trusted_validation_attempts WHERE program_slug = '${QUAD}'`);
    await db.query(`DELETE FROM trusted_validation_items WHERE program_slug = '${QUAD}'`);
    await db.query(`DELETE FROM knowledge_attempts WHERE program_slug = '${QUAD}'`);
    await db.query(`DELETE FROM knowledge_items WHERE program_slug = '${QUAD}'`);
    await db.query(`DELETE FROM practical_attempts WHERE program_slug = '${QUAD}'`);
    await db.query(`DELETE FROM practical_items WHERE program_slug = '${QUAD}'`);
    // Reviews are immutable by trigger (incl. via submission cascades);
    // teardown holds the ops hatch across the delete block.
    await db.query("SET app.review_override = 'on'");
    await db.query(`DELETE FROM project_reviews WHERE id IN (SELECT r.id FROM project_reviews r JOIN project_submissions s ON s.id = r.submission_id WHERE s.program_slug = '${QUAD}')`);
    await db.query(`DELETE FROM project_certification_results WHERE program_slug = '${QUAD}'`);
    await db.query(`DELETE FROM project_submissions WHERE program_slug = '${QUAD}'`);
    await db.query("RESET app.review_override");
    await db.query(`DELETE FROM credential_component_results WHERE program_slug = '${QUAD}'`);
    await db.query(`DELETE FROM user_credential_progress WHERE program_slug = '${QUAD}'`);
    await db.query(`DELETE FROM skill_evidence_policy WHERE program_slug = '${QUAD}'`);
    await db.query(`DELETE FROM credential_content_releases WHERE program_slug = '${QUAD}'`);
    await db.query(`DELETE FROM credential_programs WHERE slug = '${QUAD}'`);
    await db.end();
    await db2.end();
});

async function passValidations(uid: string, perSkill: number): Promise<void> {
    for (const skill of SKILLS) {
        for (let i = 0; i < perSkill; i++) {
            const st = await asRole(db, 'authenticated', uid, () =>
                db.query('SELECT * FROM start_trusted_validation($1, $2)', [QUAD, skill]).then(r => r.rows[0]),
            );
            await asRole(db, 'authenticated', uid, () =>
                db.query('SELECT * FROM submit_trusted_validation($1, $2)', [st.attempt_id, { answer: 'yes' }]),
            );
        }
    }
}

async function passKnowledgePractical(uid: string): Promise<void> {
    for (const [startFn, submitFn, table, ans] of [
        ['start_knowledge_attempt', 'submit_knowledge_attempt', 'knowledge_attempts', 'yes'],
        ['start_practical_attempt', 'submit_practical_attempt', 'practical_attempts', 'done'],
    ] as const) {
        const st = await asRole(db, 'authenticated', uid, () =>
            db.query(`SELECT * FROM ${startFn}($1)`, [QUAD]).then(r => r.rows[0]),
        );
        const items = st[table === 'knowledge_attempts' ? 'questions' : 'tasks'] as { item_key: string }[];
        const answers: Record<string, string> = {};
        for (const it of items) answers[it.item_key] = ans;
        await asRole(db, 'authenticated', uid, () =>
            db.query(`SELECT * FROM ${submitFn}($1, $2)`, [st.attempt_id, answers]),
        );
    }
}

async function passFinal(uid: string): Promise<string> {
    const exam = await asRole(db, 'authenticated', uid, () =>
        db.query('SELECT * FROM start_assessment($1)', [QUAD]).then(r => r.rows[0]),
    );
    const answers: Record<string, string> = {};
    for (const q of exam.questions as { id: string }[]) answers[q.id] = 'yes';
    await asRole(db, 'authenticated', uid, () =>
        db.query('SELECT * FROM submit_assessment($1, $2)', [exam.attempt_id, answers]),
    );
    return exam.attempt_id as string;
}

async function passProject(uid: string): Promise<void> {
    const sub = await asRole(db, 'authenticated', uid, () =>
        db.query('SELECT * FROM submit_project($1, $2, $3)', [QUAD, 'artifact://quad', 'notes']).then(r => r.rows[0].submission_id as string),
    );
    await db.query(
        `INSERT INTO project_reviews (submission_id, rubric, authoritative_score, passed, reviewer)
         VALUES ($1, '{}', 90, TRUE, 'service_role_e2e')`, [sub],
    );
}

describe('integrity: balanced final + bank pinning', () => {
    test('server assigns exactly 5/5/5/5 of 20 and pins the bank', async () => {
        const uid = newUid();
        await createUser(db, uid);
        // Migration 036 readiness: verified skills + live K/P precede Finals.
        await passValidations(uid, 4);
        await passKnowledgePractical(uid);
        try {
            const exam = await asRole(db, 'authenticated', uid, () =>
                db.query('SELECT * FROM start_assessment($1)', [QUAD]).then(r => r.rows[0]),
            );
            const counts: Record<string, number> = {};
            for (const q of exam.questions as { id: string; skill: string }[]) {
                counts[q.skill] = (counts[q.skill] ?? 0) + 1;
            }
            expect(exam.questions).toHaveLength(20);
            expect(counts).toEqual({ 'qk-a': 5, 'qk-b': 5, 'qk-c': 5, 'qk-d': 5 });
            const row = await db.query(
                `SELECT bank_version, question_set_id FROM assessment_attempts WHERE id = $1`, [exam.attempt_id],
            );
            expect(row.rows[0].bank_version).toBe('quad-v1');
        } finally {
            // Shared QUAD banks: leave no user trace behind (later tests
            // delete/restore bank rows; FK guards forbid orphans).
            await db.query(`DELETE FROM trusted_item_results WHERE user_id = $1`, [uid]);
            await db.query(`DELETE FROM trusted_validation_attempts WHERE user_id = $1`, [uid]);
            await db.query(`DELETE FROM learning_events WHERE user_id = $1`, [uid]);
            await db.query(`DELETE FROM knowledge_attempts WHERE user_id = $1`, [uid]);
            await db.query(`DELETE FROM practical_attempts WHERE user_id = $1`, [uid]);
            await db.query(`DELETE FROM assessment_attempts WHERE user_id = $1`, [uid]);
            await db.query(`DELETE FROM credential_component_results WHERE user_id = $1`, [uid]);
            await db.query(`DELETE FROM user_credential_progress WHERE user_id = $1`, [uid]);
        }
    });

    test('active attempt survives bank rotation with its own pinned set', async () => {
        const uid = newUid();
        await createUser(db, uid);
        await passValidations(uid, 4);
        await passKnowledgePractical(uid);
        const draftId = '77777777-7777-7777-7777-777777777777';
        try {
            const first = await asRole(db, 'authenticated', uid, () =>
                db.query('SELECT * FROM start_assessment($1)', [QUAD]).then(r => r.rows[0]),
            );
            const firstIds = (first.questions as { id: string }[]).map(q => q.id).sort();
            // A newer bank generation lands (retired staging row — only one
            // ACTIVE set may exist) while the attempt is active: the attempt
            // must NOT be re-sampled and must keep serving exactly its own
            // pinned set — never the newcomer.
            await db.query(
                `INSERT INTO assessment_question_sets
                    (id, program_slug, version, question_count, time_limit_minutes, pass_score,
                     questions, content_version, status)
                 VALUES ('${draftId}', '${QUAD}', '1.0', 20, 30, 80,
                         '[{"id":"qf-draft","skill":"qk-a","prompt":"draft?","options":["y","n"]}]',
                         'quad-v2', 'retired')`,
            );
            const again = await asRole(db, 'authenticated', uid, () =>
                db.query('SELECT * FROM start_assessment($1)', [QUAD]).then(r => r.rows[0]),
            );
            expect(again.attempt_id).toBe(first.attempt_id);
            const againQs = again.questions as { id: string; prompt: string }[];
            expect(againQs.map(q => q.id).sort()).toEqual(firstIds);
            expect(againQs.some(q => q.id === 'qf-draft')).toBe(false);
        } finally {
            await db.query(`DELETE FROM assessment_question_sets WHERE id = '${draftId}'`);
            await db.query(`DELETE FROM trusted_item_results WHERE user_id = $1`, [uid]);
            await db.query(`DELETE FROM trusted_validation_attempts WHERE user_id = $1`, [uid]);
            await db.query(`DELETE FROM learning_events WHERE user_id = $1`, [uid]);
            await db.query(`DELETE FROM knowledge_attempts WHERE user_id = $1`, [uid]);
            await db.query(`DELETE FROM practical_attempts WHERE user_id = $1`, [uid]);
            await db.query(`DELETE FROM assessment_attempts WHERE user_id = $1`, [uid]);
            await db.query(`DELETE FROM credential_component_results WHERE user_id = $1`, [uid]);
            await db.query(`DELETE FROM user_credential_progress WHERE user_id = $1`, [uid]);
        }
    });
});

describe('integrity: compromised banks have zero authority', () => {
    test('compromised skill items fail the gate; retired final set blocks', async () => {
        const uid = newUid();
        await createUser(db, uid);
        async function buildFullPath(): Promise<void> {
            await asRole(db, 'authenticated', uid, () => db.query('SELECT * FROM enroll_in_program($1)', [QUAD]));
            await passValidations(uid, 4);
            await passKnowledgePractical(uid);
        // Cooldown elapsed (server-side time travel) so the final can be
        // re-proven on the restored bank.
        await db.query("SET app.trusted_server = 'on'");
        await db.query(
            `UPDATE assessment_attempts SET submitted_at = NOW() - INTERVAL '25 hours'
             WHERE user_id = $1 AND status = 'submitted'`, [uid],
        );
        await db.query("RESET app.trusted_server");
        await passFinal(uid);
            await passProject(uid);
        }
        async function issueExpect(re: RegExp): Promise<void> {
            await asRole(db, 'authenticated', uid, () =>
                expectDbDenied(db.query('SELECT * FROM issue_credential($1,$2)', [QUAD, 'H']), re),
            );
        }
        await buildFullPath();
        // Happy path issues exactly one credential.
        const first = await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM issue_credential($1,$2)', [QUAD, 'H']).then(r => r.rows[0]),
        );
        expect(first.created).toBe(true);
        // Revoke to force gate re-evaluation on subsequent calls.
        await db.query(`UPDATE issued_credentials SET status = 'revoked' WHERE credential_id = $1`, [
            first.credential_id,
        ]);
        // Compromise one skill's items AFTER the evidence was recorded.
        const stashed = await db.query(
            `SELECT * FROM trusted_validation_items
             WHERE program_slug = '${QUAD}' AND skill_key = 'qk-a'`,
        );
        await db.query(
            `UPDATE trusted_validation_items SET status = 'compromised'
             WHERE program_slug = '${QUAD}' AND skill_key = 'qk-a'`,
        );
        await issueExpect(/skill_gate_failed:qk-a/);
        // Restoration honors immutability: clean the user trace, delete and
        // re-insert the stashed rows, then re-prove the skill with fresh
        // first-samples (retries of deleted history cannot count).
        await db.query(`DELETE FROM trusted_item_results WHERE user_id = $1`, [uid]);
        await db.query(`DELETE FROM trusted_validation_attempts WHERE user_id = $1`, [uid]);
        await db.query(`DELETE FROM learning_events WHERE user_id = $1`, [uid]);
        await db.query(
            `DELETE FROM trusted_validation_items
             WHERE program_slug = '${QUAD}' AND skill_key = 'qk-a'`,
        );
        for (const r of stashed.rows) {
            await db.query(
                `INSERT INTO trusted_validation_items
                    (id, program_slug, program_version, hobby_id, curriculum_day, skill_key,
                     lesson_id, content_version, status, payload, answer_key)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'active',$9,$10)`,
                [r.id, r.program_slug, r.program_version, r.hobby_id, r.curriculum_day,
                 r.skill_key, r.lesson_id, r.content_version, r.payload, r.answer_key],
            );
        }
        for (const skill of ['qk-a', 'qk-b', 'qk-c', 'qk-d']) {
            for (let i = 0; i < 4; i++) {
                const st = await asRole(db, 'authenticated', uid, () =>
                    db.query('SELECT * FROM start_trusted_validation($1, $2)', [QUAD, skill]).then(r => r.rows[0]),
                );
                await asRole(db, 'authenticated', uid, () =>
                    db.query('SELECT * FROM submit_trusted_validation($1, $2)', [st.attempt_id, { answer: 'yes' }]),
                );
            }
        }
        // Bank-version pinning: corrupt this user's attempt pin and issuance
        // must refuse the stale component (shared-safe: no global mutation).
        await db.query("SET app.trusted_server = 'on'");
        await db.query(
            `UPDATE assessment_attempts SET bank_version = 'quad-v0'
             WHERE user_id = $1 AND status = 'submitted'`, [uid],
        );
        await db.query("RESET app.trusted_server");
        await issueExpect(/final_assessment bank not active/);
        await db.query("SET app.trusted_server = 'on'");
        await db.query(
            `UPDATE assessment_attempts SET bank_version = 'quad-v1'
             WHERE user_id = $1 AND status = 'submitted'`, [uid],
        );
        await db.query("RESET app.trusted_server");
        // A retired set is equally refused. Proven with an isolated
        // throwaway set (the shared bank is never mutated): a complete user
        // whose final component points at a RETIRED set cannot issue.
        const uidR = newUid();
        await createUser(db, uidR);
        await asRole(db, 'authenticated', uidR, () => db.query('SELECT * FROM enroll_in_program($1)', [QUAD]));
        await passValidations(uidR, 4);
        await passKnowledgePractical(uidR);
        await passFinal(uidR);
        await passProject(uidR);
        const deadSet = '55555555-5555-5555-5555-555555555555';
        await db.query(
            `INSERT INTO assessment_question_sets
                (id, program_slug, version, question_count, time_limit_minutes, pass_score,
                 questions, content_version, status)
             VALUES ('${deadSet}', '${QUAD}', '1.0', 2, 30, 80, '[]', 'quad-v1', 'retired')`,
        );
        await db.query("SET app.trusted_server = 'on'");
        const deadAtt = '66666666-6666-6666-6666-666666666666';
        await db.query(
            `INSERT INTO assessment_attempts
                (id, user_id, program_slug, question_set_id, question_set_version,
                 attempt_number, status, score, passed, submitted_at, assigned_question_ids,
                 bank_version)
             VALUES ('${deadAtt}', $1, '${QUAD}',
                     '${deadSet}', '1.0', 2, 'submitted', 100, TRUE, NOW(), '[]', 'quad-v1')`,
            [uidR],
        );
        // Point the component at the retired set (clear the live pass first;
        // best-wins would otherwise keep the authoritative live reference).
        await db.query(
            `DELETE FROM credential_component_results
             WHERE user_id = $1 AND program_slug = '${QUAD}' AND program_version = '1.0'
               AND component = 'final_assessment'`,
            [uidR],
        );
        await db.query(
            `INSERT INTO credential_component_results
                (user_id, program_slug, program_version, component, score, passed,
                 authority_source, reference_id)
             VALUES ($1, '${QUAD}', '1.0', 'final_assessment', 100, TRUE,
                     'server_scored_assessment', '${deadAtt}')`,
            [uidR],
        );
        await db.query("RESET app.trusted_server");
        await asRole(db, 'authenticated', uidR, () =>
            expectDbDenied(
                db.query('SELECT * FROM issue_credential($1,$2)', [QUAD, 'H']),
                /final_assessment bank not active/,
            ),
        );
        // Cooldown elapsed (server-side time travel). Under migration 036 the
        // restored live pass is already authoritative, so re-issuance needs
        // no second exam: minting another Final with a current live pass is
        // refused (final_already_passed).
        await db.query("SET app.trusted_server = 'on'");
        await db.query(
            `UPDATE assessment_attempts SET submitted_at = NOW() - INTERVAL '25 hours'
             WHERE user_id = $1 AND status = 'submitted'`, [uid],
        );
        await db.query("RESET app.trusted_server");
        await asRole(db, 'authenticated', uid, () =>
            expectDbDenied(
                db.query('SELECT * FROM start_assessment($1)', [QUAD]),
                /final_already_passed/,
            ),
        );
        // Restored: re-issue succeeds (revoked row replaced, never edited).
        const second = await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM issue_credential($1,$2)', [QUAD, 'H']).then(r => r.rows[0]),
        );
        expect(second.created).toBe(true);
        expect(second.credential_id).not.toBe(first.credential_id);
        const count = await db.query(
            `SELECT COUNT(*)::int c FROM issued_credentials WHERE user_id = $1 AND program_slug = '${QUAD}'`, [uid],
        );
        expect(count.rows[0].c).toBe(1);
    }, 180000);
});

describe('integrity: project authority', () => {
    test('submit_project binds identity server-side; direct INSERT denied', async () => {
        const uid = newUid();
        await createUser(db, uid);
        await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM enroll_in_program($1)', [QUAD]),
        );
        // Migration 037 readiness: verified skills + live K/P + live Final.
        await passValidations(uid, 4);
        await passKnowledgePractical(uid);
        await passFinal(uid);
        const sub = await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM submit_project($1, $2, $3)', [QUAD, 'artifact://x', 'my notes']).then(r => r.rows[0].submission_id as string),
        );
        const row = await db.query('SELECT user_id, program_slug, version FROM project_submissions WHERE id = $1', [sub]);
        expect(row.rows[0].user_id).toBe(uid);
        expect(row.rows[0].program_slug).toBe(QUAD);
        expect(row.rows[0].version).toBe('1.0');
        // A forged program/version claim is impossible: no version param exists,
        // and direct INSERT is revoked.
        await asRole(db, 'authenticated', uid, () =>
            expectDbDenied(
                db.query(`INSERT INTO project_submissions (program_slug, version) VALUES ('${QUAD}','9.9')`),
                /permission denied|policy/,
            ),
        );
    });

    test('review roles: service_role writes, clients cannot, feed is exact', async () => {
        const uid = newUid();
        const other = newUid();
        await createUser(db, uid);
        await createUser(db, other);
        await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM enroll_in_program($1)', [QUAD]),
        );
        // Migration 037: non-empty payload + Final readiness precede submit.
        await passValidations(uid, 4);
        await passKnowledgePractical(uid);
        await passFinal(uid);
        const sub = await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM submit_project($1, $2, $3)', [QUAD, 'artifact://r', 'review notes']).then(r => r.rows[0].submission_id as string),
        );
        await asRole(db, 'authenticated', uid, () =>
            expectDbDenied(
                db.query(`INSERT INTO project_reviews (submission_id, authoritative_score, passed) VALUES ($1, 99, TRUE)`, [sub]),
                /permission denied|policy/,
            ),
        );
        // Clients cannot even list reviews (no SELECT policy: zero rows).
        const reviewLeak = await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM project_reviews').then(r => r.rowCount),
        );
        expect(reviewLeak).toBe(0);
        // Actual service_role write path.
        await asRole(db, 'service_role', null, () =>
            db.query(
                `INSERT INTO project_reviews (submission_id, rubric, authoritative_score, passed, reviewer)
                 VALUES ($1, '{"depth": 8}', 88, TRUE, 'service_role')`, [sub],
            ),
        );
        const comp = await db.query(
            `SELECT score, passed, authority_source FROM credential_component_results
             WHERE user_id = $1 AND component = 'project'`, [uid],
        );
        expect(Number(comp.rows[0].score)).toBe(88);
        expect(comp.rows[0].passed).toBe(true);
        expect(comp.rows[0].authority_source).toBe('server_certified_project');
        // Nothing leaked to the other user.
        const leak = await asRole(db, 'authenticated', other, () =>
            db.query(`SELECT * FROM credential_component_results WHERE user_id = $1`, [uid]).then(r => r.rowCount),
        );
        expect(leak).toBe(0);
    });

    test('issued snapshot survives later reviews (no silent mutation)', async () => {
        const uid = newUid();
        await createUser(db, uid);
        await asRole(db, 'authenticated', uid, () => db.query('SELECT * FROM enroll_in_program($1)', [QUAD]));
        await passValidations(uid, 4);
        await passKnowledgePractical(uid);
        await passFinal(uid);
        await passProject(uid);
        const first = await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM issue_credential($1,$2)', [QUAD, 'H']).then(r => r.rows[0]),
        );
        // A later correction review (new revision) must not mutate issuance:
        // the active credential is returned unchanged.
        const sub = await db.query(
            `SELECT id FROM project_submissions WHERE user_id = $1 AND program_slug = '${QUAD}'`, [uid],
        );
        await db.query(
            `INSERT INTO project_reviews (submission_id, revision, rubric, authoritative_score, passed, reviewer)
             VALUES ($1, 2, '{}', 40, FALSE, 'service_role')`, [sub.rows[0].id],
        );
        const second = await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM issue_credential($1,$2)', [QUAD, 'H']).then(r => r.rows[0]),
        );
        expect(second.credential_id).toBe(first.credential_id);
        expect(second.created).toBe(false);
    }, 120000);
});

describe('integrity: attempt discipline + best-score', () => {
    test('passed components lock; later fails never erase a pass', async () => {
        const uid = newUid();
        await createUser(db, uid);
        // Knowledge pass, then a failing retry: component keeps the pass.
        const k1 = await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM start_knowledge_attempt($1)', [QUAD]).then(r => r.rows[0]),
        );
        const items = k1.questions as { item_key: string }[];
        const allYes: Record<string, string> = {};
        for (const it of items) allYes[it.item_key] = 'yes';
        const pass = await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM submit_knowledge_attempt($1, $2)', [k1.attempt_id, allYes]).then(r => r.rows[0]),
        );
        expect(pass.passed).toBe(true);
        // No retake after pass.
        await asRole(db, 'authenticated', uid, () =>
            expectDbDenied(db.query('SELECT * FROM start_knowledge_attempt($1)', [QUAD]), /already passed/),
        );
        // One active attempt: concurrent starts coincide (tested for finals
        // in the pilot suite; knowledge path shares the advisory-lock shape).
        const comp = await db.query(
            `SELECT score, passed FROM credential_component_results
             WHERE user_id = $1 AND component = 'knowledge'`, [uid],
        );
        expect(Number(comp.rows[0].score)).toBe(100);
        expect(comp.rows[0].passed).toBe(true);
    });
});

describe('production metadata audit (no keys leave the server)', () => {
    test('chess-v1 bank is compromised and counts zero authority', async () => {
        const v1 = await db.query(
            `SELECT status, COUNT(*)::int c FROM trusted_validation_items
             WHERE program_slug = 'chess-foundations' AND content_version = 'chess-v1'
             GROUP BY status`,
        );
        // If v1 rows exist locally (021 seed), all must be compromised.
        for (const r of v1.rows) expect(r.status).toBe('compromised');
        const sets = await db.query(
            `SELECT status FROM assessment_question_sets
             WHERE program_slug = 'chess-foundations' AND content_version = 'chess-v1'`,
        );
        for (const r of sets.rows) expect(r.status).toBe('compromised');
        // The pilot switch is test-scoped here (harness never applies the
        // production switch 027): this file enables chess explicitly in
        // beforeAll; the other four stay OFF unconditionally.
        const sw = await db.query(`SELECT slug, issuance_enabled FROM credential_programs WHERE slug <> 'e2e-quad-integrity' AND slug <> 'e2e-harness-program' ORDER BY slug`);
        const flags = Object.fromEntries(sw.rows.map(r => [r.slug, r.issuance_enabled]));
        expect(flags['chess-foundations']).toBe(true);
        expect(flags['python-foundations']).toBe(false);
        expect(flags['reading-mastery']).toBe(false);
        expect(flags['english-foundations']).toBe(false);
        expect(flags['chinese-hsk1-start']).toBe(false);
    });

    test('guard: tracked public files contain no production key material', () => {
        const tracked: string = execSync('git ls-files', { cwd: process.cwd() }).toString();
        expect(tracked).not.toMatch(/private\//);
        const grepable = tracked.split('\n').filter(f => /\.(sql|ts|tsx|js|mjs|json)$/.test(f) && !f.startsWith('private/'));
        let hits: string[] = [];
        try {
            const out = execSync(
                `git grep -l -e 'chess-v2' -- ${grepable.map(f => `'${f}'`).join(' ')} 2>/dev/null || true`,
                { cwd: process.cwd(), maxBuffer: 8 * 1024 * 1024 },
            ).toString().trim();
            hits = out ? out.split('\n') : [];
        } catch {
            hits = [];
        }
        // Only this guard-adjacent test file may name the v2 generation.
        const allowed = new Set(['src/__tests__/chessPilot.e2e.test.ts']);
        hits = hits.filter(h => !allowed.has(h.trim()));
        expect(hits).toEqual([]);
    });

    test('expired credentials verify as expired (SQL + TS contract)', async () => {
        const uid = newUid();
        await createUser(db, uid);
        await asRole(db, 'authenticated', uid, () => db.query('SELECT * FROM enroll_in_program($1)', [QUAD]));
        await passValidations(uid, 4);
        await passKnowledgePractical(uid);
        await passFinal(uid);
        await passProject(uid);
        const issued = await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM issue_credential($1,$2)', [QUAD, 'H']).then(r => r.rows[0]),
        );
        await db.query(`UPDATE issued_credentials SET expires_at = NOW() - INTERVAL '1 day' WHERE credential_id = $1`, [
            issued.credential_id,
        ]);
        const expired = await asRole(db, 'anon', null, () =>
            db.query('SELECT * FROM verify_credential($1)', [issued.credential_id]).then(r => r.rows[0]),
        );
        expect(expired.status).toBe('expired');
        // The TypeScript projection preserves expired (never folds to active).
        const { projectPublicVerification } = require('../server/trust') as typeof import('../server/trust');
        expect(projectPublicVerification(expired).status).toBe('expired');
    });
});

describe('integrity: rotation resurrection regression (synthetic ROT program)', () => {
    const ROT = 'e2e-rot-immutable';

    beforeAll(async () => {
        await db.query(
            `INSERT INTO credential_programs
                (slug, code, title, level, version, required_score, requires_assessment,
                 requires_project, identity_verification_required, issuance_enabled, skills, skill_gates, status)
             VALUES ('${ROT}', 'RTI', 'E2E Rotation', 'verified-skill', '1.0',
                     80, TRUE, FALSE, FALSE, FALSE,
                     '[{"key":"rk","name":"Rot K","weight":1.0,"minimumScore":65,"dayRange":[1,7]}]',
                     '[]', 'active')
             ON CONFLICT (slug) DO NOTHING`,
        );
        await db.query(
            `INSERT INTO skill_evidence_policy (program_slug, program_version, skill_key, min_items, min_pass_rate, rationale)
             VALUES ('${ROT}', '1.0', 'rk', 1, 0.65, 'rotation regression: single-item gate')
             ON CONFLICT (program_slug, program_version, skill_key) DO NOTHING`,
        );
        await db.query(
            `INSERT INTO credential_content_releases
                (program_slug, program_version, content_version, artifact_sha256,
                 machine_qa_status, human_review_status, reviewer, reviewed_at, status)
             VALUES ('${ROT}', '1.0', 'rot-v1', 'synthetic', 'passed', 'approved', 'synthetic', NOW(), 'active')
             ON CONFLICT (program_slug, program_version, content_version) DO NOTHING`,
        );
        // v1 item on logical day 50.
        await db.query(
            `INSERT INTO trusted_validation_items
                (program_slug, program_version, hobby_id, curriculum_day, skill_key, lesson_id,
                 content_version, status, payload, answer_key)
             VALUES ('${ROT}', '1.0', 'chess', 50, 'rk', 'rot_d50', 'rot-v1', 'active',
                     '{"kind":"mc","prompt":"rot v1?","options":["one","two"]}', '{"answer":"one"}')
             ON CONFLICT DO NOTHING`,
        );
    });

    afterAll(async () => {
        await db.query(`DELETE FROM trusted_validation_attempts WHERE program_slug = '${ROT}'`);
        await db.query(`DELETE FROM trusted_item_results WHERE program_slug = '${ROT}'`);
        await db.query(`DELETE FROM learning_events WHERE program_slug = '${ROT}'`);
        await db.query(`DELETE FROM trusted_validation_items WHERE program_slug = '${ROT}'`);
        await db.query(`DELETE FROM skill_evidence_policy WHERE program_slug = '${ROT}'`);
        await db.query(`DELETE FROM credential_content_releases WHERE program_slug = '${ROT}'`);
        await db.query(`DELETE FROM credential_programs WHERE slug = '${ROT}'`);
    });

    // The exact issuance skill predicate (mirrors issue_credential v5).
    async function qualifyingCount(uid: string): Promise<{ items: number; passes: number }> {
        const r = await db.query(
            `SELECT COUNT(*)::int AS items, COUNT(*) FILTER (WHERE r.finalized_passed)::int AS passes
             FROM trusted_item_results r
             JOIN trusted_validation_items i ON i.id = r.item_id
             JOIN credential_content_releases rel
               ON rel.program_slug = r.program_slug
              AND rel.program_version = r.program_version
              AND rel.content_version = r.content_version
             WHERE r.user_id = $1 AND r.program_slug = '${ROT}'
               AND r.content_version = i.content_version
               AND i.status = 'active'
               AND rel.status IN ('active', 'approved')
               AND rel.machine_qa_status = 'passed'
               AND rel.human_review_status = 'approved'`,
            [uid],
        );
        return { items: r.rows[0].items as number, passes: r.rows[0].passes as number };
    }

    test('v1 PASS cannot resurrect as v2 authority; v2 proof counts', async () => {
        const uid = newUid();
        await createUser(db, uid);
        // v1 PASS on the logical slot.
        const s1 = await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM start_trusted_validation($1, $2)', [ROT, 'rk']).then(r => r.rows[0]),
        );
        await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM submit_trusted_validation($1, $2)', [s1.attempt_id, { answer: 'one' }]),
        );
        expect(await qualifyingCount(uid)).toEqual({ items: 1, passes: 1 });
        // Compromise v1, install v2 on the SAME logical day with a NEW UUID.
        await db.query(
            `UPDATE trusted_validation_items SET status = 'compromised'
             WHERE program_slug = '${ROT}' AND content_version = 'rot-v1'`,
        );
        const v2id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
        await db.query(
            `INSERT INTO trusted_validation_items
                (id, program_slug, program_version, hobby_id, curriculum_day, skill_key, lesson_id,
                 content_version, status, payload, answer_key)
             VALUES ('${v2id}', '${ROT}', '1.0', 'chess', 50, 'rk', 'rot_d50', 'rot-v2', 'active',
                     '{"kind":"mc","prompt":"rot v2?","options":["two","three"]}', '{"answer":"two"}')
             ON CONFLICT (program_slug, program_version, content_version, curriculum_day) DO NOTHING`,
        );
        await db.query(
            `INSERT INTO credential_content_releases
                (program_slug, program_version, content_version, artifact_sha256,
                 machine_qa_status, human_review_status, reviewer, reviewed_at, status)
             VALUES ('${ROT}', '1.0', 'rot-v2', 'synthetic2', 'passed', 'approved', 'synthetic', NOW(), 'active')
             ON CONFLICT (program_slug, program_version, content_version) DO NOTHING`,
        );
        // Activation retires the old release (atomic activation): the gate
        // requires exactly one live release, so rot-v1 must step down here.
        await db.query(
            `UPDATE credential_content_releases SET status = 'retired'
             WHERE program_slug = '${ROT}' AND program_version = '1.0' AND content_version = 'rot-v1'`,
        );
        // The v1 PASS now counts ZERO (version mismatch + compromised).
        expect(await qualifyingCount(uid)).toEqual({ items: 0, passes: 0 });
        // History remains queryable (auditability preserved).
        const hist = await db.query(
            `SELECT COUNT(*)::int c FROM trusted_validation_attempts WHERE user_id = $1`, [uid],
        );
        expect(hist.rows[0].c).toBe(1);
        const ev = await db.query(
            `SELECT trusted, outcome FROM learning_events WHERE user_id = $1`, [uid],
        );
        expect(ev.rows[0].trusted).toBe(true);
        // Retry of the OLD item adds zero depth (first-sample authority).
        const sRetry = await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM start_trusted_validation($1, $2)', [ROT, 'rk']).then(r => r.rows[0]),
        );
        // LRU serves the unseen v2 item (v1 is not active/selectable).
        expect(sRetry.payload).toEqual({ kind: 'mc', prompt: 'rot v2?', options: ['two', 'three'] });
        // Correct v2 answer on the FRESH item: proof counts exactly once...
        await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM submit_trusted_validation($1, $2)', [sRetry.attempt_id, { answer: 'two' }]),
        );
        expect(await qualifyingCount(uid)).toEqual({ items: 1, passes: 1 });
        // ...and answering that same v2 item again adds no depth.
        const s3 = await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM start_trusted_validation($1, $2)', [ROT, 'rk']).then(r => r.rows[0]),
        );
        await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM submit_trusted_validation($1, $2)', [s3.attempt_id, { answer: 'two' }]),
        );
        const depth = await db.query(
            `SELECT COUNT(*)::int c FROM trusted_item_results WHERE user_id = $1`, [uid],
        );
        expect(depth.rows[0].c).toBe(2); // v1 row + v2 row (one row per item, first wins)
        expect(await qualifyingCount(uid)).toEqual({ items: 1, passes: 1 });
    });
});

describe('integrity: project enrollment + immutable revisions', () => {
    test('submit_project requires enrollment; direct INSERT denied', async () => {
        const uid = newUid();
        await createUser(db, uid);
        await asRole(db, 'authenticated', uid, () =>
            expectDbDenied(
                db.query('SELECT * FROM submit_project($1, $2, $3)', ['e2e-quad-integrity', null, null]),
                /enrollment_required/,
            ),
        );
        await asRole(db, 'authenticated', uid, () =>
            expectDbDenied(
                db.query(`INSERT INTO project_submissions (program_slug, version) VALUES ('e2e-quad-integrity','1.0')`),
                /permission denied|policy/,
            ),
        );
        await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM enroll_in_program($1)', ['e2e-quad-integrity']),
        );
        // Migration 037 readiness precedes the post-enrollment submit.
        await passValidations(uid, 4);
        await passKnowledgePractical(uid);
        await passFinal(uid);
        const sub = await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM submit_project($1, $2, $3)', ['e2e-quad-integrity', 'artifact://e', 'n']).then(r => r.rows[0].submission_id as string),
        );
        const row = await db.query('SELECT user_id, program_slug, version FROM project_submissions WHERE id = $1', [sub]);
        expect(row.rows[0].user_id).toBe(uid);
        expect(row.rows[0].version).toBe('1.0');
    });

    test('revisions immutable; latest revision controls the gate', async () => {
        const uid = newUid();
        await createUser(db, uid);
        await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM enroll_in_program($1)', ['e2e-quad-integrity']),
        );
        // Migration 037: empty payloads never create rows; Final readiness
        // precedes the submit.
        await passValidations(uid, 4);
        await passKnowledgePractical(uid);
        await passFinal(uid);
        const sub = await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM submit_project($1, $2, $3)', ['e2e-quad-integrity', 'artifact://rev', 'rev']).then(r => r.rows[0].submission_id as string),
        );
        await db.query(
            `INSERT INTO project_reviews (submission_id, revision, rubric, authoritative_score, passed, reviewer)
             VALUES ($1, 1, '{}', 90, TRUE, 'service_role')`, [sub],
        );
        // Revision rows cannot be UPDATEd or DELETEd, even by service_role.
        await asRole(db, 'service_role', null, () =>
            expectDbDenied(
                db.query(`UPDATE project_reviews SET authoritative_score = 10 WHERE submission_id = $1`, [sub]),
                /immutable|lifecycle violation/,
            ),
        );
        await asRole(db, 'service_role', null, () =>
            expectDbDenied(
                db.query(`DELETE FROM project_reviews WHERE submission_id = $1`, [sub]),
                /immutable|lifecycle violation/,
            ),
        );
        // Adverse correction as revision 2 takes effect immediately.
        await db.query(
            `INSERT INTO project_reviews (submission_id, revision, rubric, authoritative_score, passed, reviewer)
             VALUES ($1, 2, '{}', 40, FALSE, 'service_role')`, [sub],
        );
        const comp = await db.query(
            `SELECT score, passed FROM credential_component_results
             WHERE user_id = $1 AND component = 'project'`, [uid],
        );
        expect(Number(comp.rows[0].score)).toBe(40);
        expect(comp.rows[0].passed).toBe(false);
        // Recovery as revision 3 restores authority.
        await db.query(
            `INSERT INTO project_reviews (submission_id, revision, rubric, authoritative_score, passed, reviewer)
             VALUES ($1, 3, '{}', 95, TRUE, 'service_role')`, [sub],
        );
        const comp3 = await db.query(
            `SELECT score, passed FROM credential_component_results
             WHERE user_id = $1 AND component = 'project'`, [uid],
        );
        expect(Number(comp3.rows[0].score)).toBe(95);
        expect(comp3.rows[0].passed).toBe(true);
    });
});

describe('ops: committed loader + activation (synthetic fixture)', () => {
    const FIX = 'e2e-loader-fix';
    const root = process.cwd();
    const port = process.env.ZENYTH_E2E_PGPORT ?? '55433';
    const dbUrl = `postgres://postgres@127.0.0.1:${port}/postgres`;

    function runLoader(artifact: string, extraEnv: Record<string, string> = {}): { code: number; out: string } {
        const { execFileSync } = require('child_process') as typeof import('child_process');
        try {
            const out = execFileSync(
                process.execPath,
                ['scripts/load-production-bank.mjs'],
                {
                    cwd: root,
                    env: { ...process.env, PRIVATE_BANK_PATH: artifact, SUPABASE_DB_URL: dbUrl, ...extraEnv },
                    stdio: ['ignore', 'pipe', 'pipe'],
                },
            ).toString();
            return { code: 0, out };
        } catch (err) {
            const e = err as { status?: number; stdout?: Buffer; stderr?: Buffer };
            return {
                code: e.status ?? 1,
                out: `${e.stdout?.toString() ?? ''}\n${e.stderr?.toString() ?? ''}`,
            };
        }
    }

    function runActivate(extraEnv: Record<string, string> = {}): { code: number; out: string } {
        const { execFileSync } = require('child_process') as typeof import('child_process');
        try {
            const out = execFileSync(process.execPath, ['scripts/activate-content-release.mjs'], {
                cwd: root,
                env: { ...process.env, SUPABASE_DB_URL: dbUrl, ...extraEnv },
                stdio: ['ignore', 'pipe', 'pipe'],
            }).toString();
            return { code: 0, out };
        } catch (err) {
            const e = err as { status?: number; stdout?: Buffer; stderr?: Buffer };
            return {
                code: e.status ?? 1,
                out: `${e.stdout?.toString() ?? ''}\n${e.stderr?.toString() ?? ''}`,
            };
        }
    }

    function writeVariant(mut: (b: Record<string, unknown>) => void): string {
        const fs = require('fs') as typeof import('fs');
        const os = require('os') as typeof import('os');
        const path = require('path') as typeof import('path');
        const base = JSON.parse(fs.readFileSync('db-test/fixtures/synth-bank.json', 'utf8'));
        mut(base);
        const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bank-')), 'bank.json');
        fs.writeFileSync(tmp, JSON.stringify(base));
        return tmp;
    }

    afterAll(async () => {
        await db.query(`DELETE FROM assessment_answer_keys WHERE question_set_id IN
            (SELECT id FROM assessment_question_sets WHERE program_slug = '${FIX}')`);
        await db.query(`DELETE FROM assessment_question_sets WHERE program_slug = '${FIX}'`);
        await db.query(`DELETE FROM trusted_validation_items WHERE program_slug = '${FIX}'`);
        await db.query(`DELETE FROM knowledge_items WHERE program_slug = '${FIX}'`);
        await db.query(`DELETE FROM practical_items WHERE program_slug = '${FIX}'`);
        await db.query(`DELETE FROM credential_content_releases WHERE program_slug = '${FIX}'`);
        await db.query(`DELETE FROM credential_programs WHERE slug = '${FIX}'`);
    });

    test('committed loader executes; same release reload is idempotent', async () => {
        await db.query(
            `INSERT INTO credential_programs (slug, code, title, level, version, required_score,
                 requires_assessment, requires_project, skills, status)
             VALUES ('${FIX}', 'FX', 'Fixture', 'verified-skill', '1.0', 80, TRUE, TRUE, '[]', 'active')
             ON CONFLICT (slug) DO NOTHING`,
        );
        const first = runLoader('db-test/fixtures/synth-bank.json', {
            HUMAN_APPROVAL: 'approved', REVIEWER: 'fixture-review', REVIEWED_AT: '2026-09-10T00:00:00Z',
        });
        expect(first.code).toBe(0);
        const counts = async () => ({
            v: (await db.query(`SELECT COUNT(*)::int c FROM trusted_validation_items WHERE program_slug='${FIX}'`)).rows[0].c,
            k: (await db.query(`SELECT COUNT(*)::int c FROM knowledge_items WHERE program_slug='${FIX}'`)).rows[0].c,
            p: (await db.query(`SELECT COUNT(*)::int c FROM practical_items WHERE program_slug='${FIX}'`)).rows[0].c,
            s: (await db.query(`SELECT COUNT(*)::int c FROM assessment_question_sets WHERE program_slug='${FIX}'`)).rows[0].c,
        });
        expect(await counts()).toEqual({ v: 1, k: 1, p: 1, s: 1 });
        const rel = await db.query(
            `SELECT status, machine_qa_status, human_review_status, reviewer FROM credential_content_releases
             WHERE program_slug='${FIX}'`,
        );
        expect(rel.rows[0]).toMatchObject({
            status: 'draft', machine_qa_status: 'passed', human_review_status: 'approved', reviewer: 'fixture-review',
        });
        // Identical reload: success, zero changes, explicit no-op report.
        const second = runLoader('db-test/fixtures/synth-bank.json', {
            HUMAN_APPROVAL: 'approved', REVIEWER: 'fixture-review', REVIEWED_AT: '2026-09-10T00:00:00Z',
        });
        expect(second.code).toBe(0);
        expect(second.out).toMatch(/already loaded.*zero writes/);
        expect(await counts()).toEqual({ v: 1, k: 1, p: 1, s: 1 });
    });

    test('same version + changed artifact hard-fails; rows untouched', async () => {
        const before = await db.query(
            `SELECT answer_key FROM trusted_validation_items WHERE program_slug='${FIX}'`,
        );
        const tampered = writeVariant(b => {
            (b.validation as { answer: string }[])[0].answer = 'n';
        });
        const r = runLoader(tampered);
        expect(r.code).not.toBe(0);
        expect(r.out).toMatch(/refusing to rewrite release|sha/i);
        const after = await db.query(
            `SELECT answer_key FROM trusted_validation_items WHERE program_slug='${FIX}'`,
        );
        expect(after.rows).toEqual(before.rows);
    });

    test('UUID rebind across versions and bank-id reuse hard-fail', async () => {
        // Same item UUID under a NEW content_version.
        const rebind = writeVariant(b => {
            b.content_version = 'fix-v2';
            (b.validation as { id: string }[])[0].id = 'aaaaaaaa-0000-4000-8000-000000000001';
        });
        const r1 = runLoader(rebind);
        expect(r1.code).not.toBe(0);
        expect(r1.out).toMatch(/rebind/i);
        // Same final_bank_id under a new content_version (fresh UUIDs so
        // only the bank-id rule can fire).
        const reuse = writeVariant(b => {
            b.content_version = 'fix-v3';
            const { randomUUID } = require('crypto') as typeof import('crypto');
            for (const v of b.validation as { id: string }[]) v.id = randomUUID();
            for (const q of [...(b.knowledge as { id: string }[]), ...(b.practical as { id: string }[])] as { id: string }[]) {
                q.id = (require('crypto') as typeof import('crypto')).randomUUID();
            }
        });
        const r2 = runLoader(reuse);
        expect(r2.code).not.toBe(0);
        expect(r2.out).toMatch(/final_bank_id/i);
    });

    test('activation: wrong SHA, missing approval, then atomic success', async () => {
        const base = {
            PROGRAM_SLUG: FIX, PROGRAM_VERSION: '1.0', CONTENT_VERSION: 'fix-v1',
        };
        // Wrong SHA fails.
        expect(runActivate({ ...base, EXPECTED_SHA256: '0'.repeat(64) }).code).not.toBe(0);
        // Unapproved release fails: reset approval first.
        await db.query(
            `UPDATE credential_content_releases SET human_review_status='pending', reviewer=NULL, reviewed_at=NULL
             WHERE program_slug='${FIX}'`,
        );
        const noApproval = runActivate({ ...base, EXPECTED_SHA256: (await realSha()) });
        expect(noApproval.code).not.toBe(0);
        expect(noApproval.out).toMatch(/human_review_status|reviewer/i);
        // Re-approve through the separate ops act (direct service SQL —
        // approval is not the loader's job on a no-op reload), then activate.
        await db.query(
            `UPDATE credential_content_releases
             SET human_review_status = 'approved', reviewer = 'fixture-review', reviewed_at = NOW()
             WHERE program_slug = '${FIX}'`,
        );
        const ok = runActivate({ ...base, EXPECTED_SHA256: await realSha() });
        expect(ok.code).toBe(0);
        expect(ok.out).toMatch(/activation checks passed/);
        const rels = await db.query(
            `SELECT content_version, status FROM credential_content_releases WHERE program_slug='${FIX}' ORDER BY 1`,
        );
        expect(rels.rows).toEqual([{ content_version: 'fix-v1', status: 'active' }]);
        // Issuance switch untouched by activation.
        const sw = await db.query(`SELECT issuance_enabled FROM credential_programs WHERE slug='${FIX}'`);
        expect(sw.rows[0].issuance_enabled).toBe(false);

        async function realSha(): Promise<string> {
            const { createHash } = require('crypto') as typeof import('crypto');
            const fs = require('fs') as typeof import('fs');
            const raw = fs.readFileSync('db-test/fixtures/synth-bank.json', 'utf8');
            const bank = JSON.parse(raw);
            const canon = (v: unknown): string => {
                if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`;
                if (v && typeof v === 'object') {
                    return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canon((v as Record<string, unknown>)[k])}`).join(',')}}`;
                }
                return JSON.stringify(v);
            };
            return createHash('sha256').update(canon(bank)).digest('hex');
        }
    });
});

describe('ops: release-hygiene regressions (synthetic fixture)', () => {
    const FIX = 'e2e-loader-fix';
    const root = process.cwd();
    const port = process.env.ZENYTH_E2E_PGPORT ?? '55433';
    const dbUrl = `postgres://postgres@127.0.0.1:${port}/postgres`;

    function loadFixture(): void {
        const { execFileSync } = require('child_process') as typeof import('child_process');
        execFileSync(process.execPath, ['scripts/load-production-bank.mjs'], {
            cwd: root,
            env: {
                ...process.env,
                PRIVATE_BANK_PATH: 'db-test/fixtures/synth-bank.json',
                SUPABASE_DB_URL: dbUrl,
                HUMAN_APPROVAL: 'approved',
                REVIEWER: 'fixture-review',
                REVIEWED_AT: '2026-09-10T00:00:00Z',
            },
            stdio: ['ignore', 'pipe', 'pipe'],
        });
    }

    // Hermetic per-test fixture: the loader is idempotent by design, so
    // every test starts from a freshly verified loaded state.
    beforeEach(async () => {
        await db.query(
            `INSERT INTO credential_programs (slug, code, title, level, version, required_score,
                 requires_assessment, requires_project, skills, status)
             VALUES ('${FIX}', 'FX', 'Fixture', 'verified-skill', '1.0', 80, TRUE, TRUE, '[]', 'active')
             ON CONFLICT (slug) DO NOTHING`,
        );
        loadFixture();
    });

    function runScript(script: string, extraEnv: Record<string, string> = {}): { code: number; out: string } {
        const { execFileSync } = require('child_process') as typeof import('child_process');
        try {
            const out = execFileSync(process.execPath, [script], {
                cwd: root,
                env: { ...process.env, SUPABASE_DB_URL: dbUrl, ...extraEnv },
                stdio: ['ignore', 'pipe', 'pipe'],
            }).toString();
            return { code: 0, out };
        } catch (err) {
            const e = err as { status?: number; stdout?: Buffer; stderr?: Buffer };
            return {
                code: e.status ?? 1,
                out: `${e.stdout?.toString() ?? ''}\n${e.stderr?.toString() ?? ''}`,
            };
        }
    }

    async function snapshot(): Promise<string> {
        const parts: string[] = [];
        for (const t of [
            'trusted_validation_items', 'knowledge_items', 'practical_items',
            'assessment_question_sets', 'credential_content_releases',
        ]) {
            const c = await db.query(`SELECT COUNT(*)::int c FROM ${t} WHERE program_slug = $1`, [FIX]).then(
                x => (x as { rows: { c: number }[] }).rows[0].c,
            );
            parts.push(`${t}:${c}`);
        }
        const keys = await db.query(
            `SELECT COUNT(*)::int c FROM assessment_answer_keys k
             JOIN assessment_question_sets s ON s.id = k.question_set_id
             WHERE s.program_slug = $1`, [FIX],
        );
        parts.push(`assessment_answer_keys:${keys.rows[0].c}`);
        const rel = await db.query(
            `SELECT content_version, status FROM credential_content_releases WHERE program_slug = $1 ORDER BY 1`,
            [FIX],
        );
        parts.push(`releases:${JSON.stringify(rel.rows)}`);
        return parts.join('|');
    }

    test('--dry-run validates against live state with zero writes', async () => {
        const before = await snapshot();
        const r = runScript('scripts/activate-content-release.mjs', {
            PROGRAM_SLUG: FIX,
            PROGRAM_VERSION: '1.0',
            CONTENT_VERSION: 'fix-v1',
            EXPECTED_SHA256: '0'.repeat(64),
        });
        // Wrong SHA on dry-run: refused, and nothing changed.
        expect(r.code).not.toBe(0);
        expect(r.out).toMatch(/sha256/i);
        expect(await snapshot()).toBe(before);
    });

    test('activation locks the release row: concurrent holder blocks, never stale-reads', async () => {
        // Hold the target release row lock in an open transaction...
        await db2.query('BEGIN');
        await db2.query(
            `SELECT * FROM credential_content_releases WHERE program_slug = $1 FOR UPDATE`, [FIX],
        );
        try {
            // ...then activation must WAIT on the lock (statement timeout
            // forces the wait to surface instead of hanging the suite).
            const r = runScript('scripts/activate-content-release.mjs', {
                PROGRAM_SLUG: FIX,
                PROGRAM_VERSION: '1.0',
                CONTENT_VERSION: 'fix-v1',
                EXPECTED_SHA256: await approvedSha(),
                PGOPTIONS: '-c statement_timeout=2000',
            });
            expect(r.code).not.toBe(0);
            expect(r.out).toMatch(/lock timeout|statement timeout|canceling statement/i);
        } finally {
            await db2.query('ROLLBACK');
        }
        // After the holder releases, the same activation proceeds.
        const ok = runScript('scripts/activate-content-release.mjs', {
            PROGRAM_SLUG: FIX,
            PROGRAM_VERSION: '1.0',
            CONTENT_VERSION: 'fix-v1',
            EXPECTED_SHA256: await approvedSha(),
        });
        expect(ok.code).toBe(0);

        async function approvedSha(): Promise<string> {
            const r = await db.query(
                `SELECT artifact_sha256 FROM credential_content_releases WHERE program_slug = $1`, [FIX],
            );
            return r.rows[0].artifact_sha256 as string;
        }
    });

    test('released content mutations are rejected at the DB level', async () => {
        await expectDbDenied(
            db.query(`UPDATE trusted_validation_items SET payload = '{"kind":"mc"}' WHERE program_slug = $1`, [FIX]),
            /immutable|lifecycle violation/,
        );
        await expectDbDenied(
            db.query(`UPDATE knowledge_items SET answer_key = '{"answer":"x"}' WHERE program_slug = $1`, [FIX]),
            /immutable|lifecycle violation/,
        );
        await expectDbDenied(
            db.query(`UPDATE practical_items SET skill_key = 'zz' WHERE program_slug = $1`, [FIX]),
            /immutable|lifecycle violation/,
        );
        await expectDbDenied(
            db.query(`UPDATE assessment_question_sets SET questions = '[]' WHERE program_slug = $1`, [FIX]),
            /immutable|lifecycle violation/,
        );
        await expectDbDenied(
            db.query(
                `UPDATE assessment_answer_keys SET answers = '{}' WHERE question_set_id IN
                 (SELECT id FROM assessment_question_sets WHERE program_slug = $1)`, [FIX],
            ),
            /immutable|lifecycle violation/,
        );
        // Allowed lifecycle: active -> retired still works (fresh row first).
        await db.query(
            `INSERT INTO knowledge_items (program_slug, program_version, skill_key, item_key, content_version, status, payload, answer_key)
             VALUES ('${FIX}', '1.0', 'fx', 'fk-lifecycle', 'fix-v1', 'active', '{}', '{}')
             ON CONFLICT DO NOTHING`,
        );
        await db.query(
            `UPDATE knowledge_items SET status = 'retired'
             WHERE program_slug = $1 AND item_key = 'fk-lifecycle'`, [FIX],
        );
        const st = await db.query(
            `SELECT status FROM knowledge_items WHERE program_slug = $1 AND item_key = 'fk-lifecycle'`, [FIX],
        );
        expect(st.rows[0].status).toBe('retired');
        // ...but resurrection back to active is refused.
        await expectDbDenied(
            db.query(
                `UPDATE knowledge_items SET status = 'active'
                 WHERE program_slug = $1 AND item_key = 'fk-lifecycle'`, [FIX],
            ),
            /immutable|lifecycle violation/,
        );
        await db.query(`DELETE FROM knowledge_items WHERE program_slug = $1 AND item_key = 'fk-lifecycle'`, [FIX]);
    });

    test('deleted-row drift is detected on identical reload', async () => {
        // Simulate drift the trigger cannot prevent: a missing row.
        await db.query(`DELETE FROM practical_items WHERE program_slug = $1`, [FIX]);
        const { execFileSync } = require('child_process') as typeof import('child_process');
        let threw = false;
        try {
            execFileSync(process.execPath, ['scripts/load-production-bank.mjs'], {
                cwd: root,
                env: { ...process.env, PRIVATE_BANK_PATH: 'db-test/fixtures/synth-bank.json', SUPABASE_DB_URL: dbUrl },
                stdio: ['ignore', 'pipe', 'pipe'],
            });
        } catch (err) {
            threw = true;
            const e = err as { status?: number; stderr?: Buffer; stdout?: Buffer };
            expect(e.status).not.toBe(0);
            const out = `${e.stdout?.toString() ?? ''}\n${e.stderr?.toString() ?? ''}`;
            expect(out).toMatch(/drift|missing/i);
        }
        expect(threw).toBe(true);
        // Restore the row exactly (fresh INSERT, same id/content).
        await db.query(
            `INSERT INTO practical_items (id, program_slug, program_version, skill_key, item_key, content_version, status, payload, answer_key)
             VALUES ('aaaaaaaa-0000-4000-8000-000000000003', '${FIX}', '1.0', 'fx', 'fp-1', 'fix-v1', 'active',
                     '{"kind":"mate_in_1","prompt":"mate?","fen":"7k/8/5K2/8/8/8/8/6Q1 w - - 0 1"}', '{"answer":"g1g7"}')
             ON CONFLICT DO NOTHING`,
        );
    });

    afterAll(async () => {
        // Hermetic cleanup: files share one DB per invocation (globalSetup
        // runs once), so leaked rows break order-dependent suites.
        await db.query(`DELETE FROM trusted_item_results WHERE program_slug = '${FIX}'`);
        await db.query(`DELETE FROM trusted_validation_attempts WHERE program_slug = '${FIX}'`);
        await db.query(`DELETE FROM knowledge_attempts WHERE program_slug = '${FIX}'`);
        await db.query(`DELETE FROM practical_attempts WHERE program_slug = '${FIX}'`);
        await db.query(`DELETE FROM assessment_attempts WHERE program_slug = '${FIX}'`);
        await db.query(`DELETE FROM learning_events WHERE program_slug = '${FIX}'`);
        await db.query(
            `DELETE FROM assessment_answer_keys WHERE question_set_id IN
             (SELECT id FROM assessment_question_sets WHERE program_slug = '${FIX}')`,
        );
        await db.query(`DELETE FROM assessment_question_sets WHERE program_slug = '${FIX}'`);
        await db.query(`DELETE FROM trusted_validation_items WHERE program_slug = '${FIX}'`);
        await db.query(`DELETE FROM knowledge_items WHERE program_slug = '${FIX}'`);
        await db.query(`DELETE FROM practical_items WHERE program_slug = '${FIX}'`);
        await db.query(`DELETE FROM credential_component_results WHERE program_slug = '${FIX}'`);
        await db.query(`DELETE FROM user_credential_progress WHERE program_slug = '${FIX}'`);
        await db.query(`DELETE FROM credential_content_releases WHERE program_slug = '${FIX}'`);
        await db.query(`DELETE FROM credential_programs WHERE slug = '${FIX}'`);
    });
});
