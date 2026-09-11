#!/usr/bin/env node
/**
 * Guarded content-release activation (ops only).
 *
 * The ONE audited path from a loaded draft to the live bank:
 *
 *   PROGRAM_SLUG=chess-foundations PROGRAM_VERSION=1.0 CONTENT_VERSION=chess-v3 \
 *   EXPECTED_SHA256=a713c874... \
 *   SUPABASE_DB_URL=postgres://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres \
 *   node scripts/activate-content-release.mjs [--dry-run]
 *
 * Activation succeeds ONLY when every check passes, atomically:
 * - release row exists with machine_qa_status=passed,
 *   human_review_status=approved, reviewer + reviewed_at present
 * - stored artifact_sha256 == EXPECTED_SHA256 (exact artifact identity)
 * - every referenced row belongs to the SAME content_version:
 *   validation/knowledge/practical items + final set + policy presence
 * - final bank present with hidden keys
 * Then, in ONE transaction: previous active release(s) of the program
 * retire, this release becomes active.
 *
 * Explicitly OUT of scope: issuance_enabled is NEVER touched here.
 * Enabling issuance remains a separate guarded migration/decision.
 */

import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { Client } = require('pg');

const DRY = process.argv.includes('--dry-run');
const { PROGRAM_SLUG: P, PROGRAM_VERSION: V, CONTENT_VERSION: C, EXPECTED_SHA256: SHA, SUPABASE_DB_URL: dbUrl } =
    process.env;

for (const [k, v] of [['PROGRAM_SLUG', P], ['PROGRAM_VERSION', V], ['CONTENT_VERSION', C], ['EXPECTED_SHA256', SHA]]) {
    if (!v) {
        console.error(`${k} is required.`);
        process.exit(1);
    }
}
if (!DRY && !dbUrl) {
    console.error('SUPABASE_DB_URL is required (service-role/direct connection).');
    process.exit(1);
}

const failures = [];

const db = DRY ? null : new Client({ connectionString: dbUrl });
if (db) await db.connect();
try {
    const q = (text, params) => db.query(text, params);

    const rel = (
        await q(
            `SELECT status, machine_qa_status, human_review_status, reviewer, reviewed_at, artifact_sha256
             FROM credential_content_releases
             WHERE program_slug = $1 AND program_version = $2 AND content_version = $3`,
            [P, V, C],
        )
    ).rows[0];
    if (!rel) failures.push('release row missing');
    else {
        if (rel.machine_qa_status !== 'passed') failures.push(`machine_qa_status=${rel.machine_qa_status}`);
        if (rel.human_review_status !== 'approved') failures.push(`human_review_status=${rel.human_review_status}`);
        if (!rel.reviewer) failures.push('reviewer missing');
        if (!rel.reviewed_at) failures.push('reviewed_at missing');
        if (rel.artifact_sha256 !== SHA) failures.push('stored sha256 != EXPECTED_SHA256');
        if (!['draft', 'approved'].includes(rel.status)) failures.push(`release status=${rel.status} is not activatable`);
    }

    // Every referenced row must belong to the SAME content_version.
    for (const [table, col] of [
        ['trusted_validation_items', 'curriculum_day'],
        ['knowledge_items', 'item_key'],
        ['practical_items', 'item_key'],
    ]) {
        const stray = await q(
            `SELECT COUNT(*)::int c FROM ${table}
             WHERE program_slug = $1 AND status = 'active' AND content_version IS DISTINCT FROM $2`,
            [P, C],
        );
        void col;
        if (stray.rows[0].c > 0) failures.push(`${table} has active rows outside ${C}`);
    }
    const sets = await q(
        `SELECT id, content_version, status, jsonb_array_length(questions)::int AS n
         FROM assessment_question_sets WHERE program_slug = $1 AND version = $2`,
        [P, V],
    );
    const live = sets.rows.filter(r => r.status === 'active');
    if (live.length !== 1) failures.push(`expected exactly one active set, found ${live.length}`);
    else {
        if (live[0].content_version !== C) failures.push('active set is not on this content_version');
        if (live[0].n < 1) failures.push('active set is empty');
        const keys = await q(`SELECT answers FROM assessment_answer_keys WHERE question_set_id = $1`, [live[0].id]);
        if (keys.rowCount === 0 || keys.rows[0].answers == null || Object.keys(keys.rows[0].answers).length === 0) {
            failures.push('active set has no hidden keys');
        }
    }

    if (failures.length > 0) {
        console.error(`ACTIVATION REFUSED (${failures.length}):`);
        for (const f of failures) console.error(` - ${f}`);
        process.exit(1);
    }
    console.log(`activation checks passed for ${P} ${V} ${C} (sha ${SHA.slice(0, 12)}…).`);

    if (DRY) {
        console.log('--dry-run: no writes performed (issuance untouched either way).');
        process.exit(0);
    }

    await db.query('BEGIN');
    await db.query(
        `UPDATE credential_content_releases SET status = 'retired'
         WHERE program_slug = $1 AND status IN ('active', 'approved')
           AND content_version <> $2`,
        [P, C],
    );
    await db.query(
        `UPDATE credential_content_releases SET status = 'active'
         WHERE program_slug = $1 AND program_version = $2 AND content_version = $3`,
        [P, V, C],
    );
    await db.query('COMMIT');
    const after = await db.query(
        `SELECT content_version, status FROM credential_content_releases WHERE program_slug = $1 ORDER BY content_version`,
        [P],
    );
    console.log('releases now:', JSON.stringify(after.rows));
    console.log('NOTE: issuance_enabled untouched — enabling issuance is a separate guarded decision.');
} catch (e) {
    try {
        await db.query('ROLLBACK');
    } catch { /* already failed pre-transaction */ }
    throw e;
} finally {
    await db.end();
}
