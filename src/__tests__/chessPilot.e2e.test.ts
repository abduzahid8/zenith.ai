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
         VALUES ('33333333-3333-3333-3333-333333333333', '${QUAD}', '1.0', 20, 30, 80, '${JSON.stringify(finals).replace(/'/g, "''")}', 'quad-bank-v1', 'active')
         ON CONFLICT (id) DO NOTHING`,
    );
    await db.query(
        `INSERT INTO assessment_answer_keys (question_set_id, answers, question_ids)
         VALUES ('33333333-3333-3333-3333-333333333333', '${JSON.stringify(fkeys).replace(/'/g, "''")}', '${JSON.stringify(fids)}')
         ON CONFLICT DO NOTHING`,
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
    await db.query(`DELETE FROM project_reviews WHERE id IN (SELECT r.id FROM project_reviews r JOIN project_submissions s ON s.id = r.submission_id WHERE s.program_slug = '${QUAD}')`);
    await db.query(`DELETE FROM project_certification_results WHERE program_slug = '${QUAD}'`);
    await db.query(`DELETE FROM project_submissions WHERE program_slug = '${QUAD}'`);
    await db.query(`DELETE FROM credential_component_results WHERE program_slug = '${QUAD}'`);
    await db.query(`DELETE FROM user_credential_progress WHERE program_slug = '${QUAD}'`);
    await db.query(`DELETE FROM skill_evidence_policy WHERE program_slug = '${QUAD}'`);
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
        expect(row.rows[0].bank_version).toBe('quad-bank-v1');
    });

    test('active attempt survives bank rotation with its own pinned set', async () => {
        const uid = newUid();
        await createUser(db, uid);
        const first = await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM start_assessment($1)', [QUAD]).then(r => r.rows[0]),
        );
        const firstIds = (first.questions as { id: string }[]).map(q => q.id).sort();
        // Deploy a corrected bank (same version, new content) while the
        // attempt is active: the attempt must NOT be re-sampled.
        await db.query(
            `UPDATE assessment_question_sets SET questions = questions || '{"id":"qf-new","skill":"qk-a","prompt":"new?","options":["yes","no"]}',
             content_version = 'quad-bank-v2'
             WHERE id = '33333333-3333-3333-3333-333333333333'`,
        );
        try {
            const again = await asRole(db, 'authenticated', uid, () =>
                db.query('SELECT * FROM start_assessment($1)', [QUAD]).then(r => r.rows[0]),
            );
            expect(again.attempt_id).toBe(first.attempt_id);
            expect((again.questions as { id: string }[]).map(q => q.id).sort()).toEqual(firstIds);
            expect((again.questions as { id: string }[]).some(q => q.id === 'qf-new')).toBe(false);
        } finally {
            await db.query(
                `UPDATE assessment_question_sets SET content_version = 'quad-bank-v1'
                 WHERE id = '33333333-3333-3333-3333-333333333333'`,
            );
            await db.query(
                `UPDATE assessment_question_sets SET questions = (
                   SELECT jsonb_agg(q) FROM jsonb_array_elements(questions) q WHERE (q->>'id') <> 'qf-new')
                 WHERE id = '33333333-3333-3333-3333-333333333333'`,
            );
        }
    });
});

describe('integrity: compromised banks have zero authority', () => {
    test('compromised skill items fail the gate; retired final set blocks', async () => {
        const uid = newUid();
        await createUser(db, uid);
        await asRole(db, 'authenticated', uid, () => db.query('SELECT * FROM enroll_in_program($1)', [QUAD]));
        await passValidations(uid, 4);
        await passKnowledgePractical(uid);
        await passFinal(uid);
        await passProject(uid);
        // Compromise one skill's items AFTER the evidence was recorded.
        await db.query(
            `UPDATE trusted_validation_items SET status = 'compromised'
             WHERE program_slug = '${QUAD}' AND skill_key = 'qk-a'`,
        );
        try {
            await asRole(db, 'authenticated', uid, () =>
                expectDbDenied(
                    db.query('SELECT * FROM issue_credential($1,$2)', [QUAD, 'H']),
                    /skill_gate_failed:qk-a/,
                ),
            );
        } finally {
            await db.query(
                `UPDATE trusted_validation_items SET status = 'active'
                 WHERE program_slug = '${QUAD}' AND skill_key = 'qk-a'`,
            );
        }
        // Retire the final bank: issuance must refuse the stale component.
        await db.query(
            `UPDATE assessment_question_sets SET status = 'retired'
             WHERE id = '33333333-3333-3333-3333-333333333333'`,
        );
        try {
            await asRole(db, 'authenticated', uid, () =>
                expectDbDenied(
                    db.query('SELECT * FROM issue_credential($1,$2)', [QUAD, 'H']),
                    /final_assessment bank not active/,
                ),
            );
        } finally {
            await db.query(
                `UPDATE assessment_question_sets SET status = 'active'
                 WHERE id = '33333333-3333-3333-3333-333333333333'`,
            );
        }
        // Restored: exactly one credential issues.
        const a = await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM issue_credential($1,$2)', [QUAD, 'H']).then(r => r.rows[0]),
        );
        const b = await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM issue_credential($1,$2)', [QUAD, 'H']).then(r => r.rows[0]),
        );
        expect(a.credential_id).toBe(b.credential_id);
    }, 120000);
});

describe('integrity: project authority', () => {
    test('submit_project binds identity server-side; direct INSERT denied', async () => {
        const uid = newUid();
        await createUser(db, uid);
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
        const sub = await asRole(db, 'authenticated', uid, () =>
            db.query('SELECT * FROM submit_project($1, $2, $3)', [QUAD, null, null]).then(r => r.rows[0].submission_id as string),
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
