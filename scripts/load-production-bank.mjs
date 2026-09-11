#!/usr/bin/env node
/**
 * Private production bank loader (ops only, never CI-on-public-repo).
 *
 * Loads a PRIVATE bank artifact (e.g. private/chess-v3-bank.json) into
 * Supabase WITHOUT any key material entering public Git history:
 *
 *   PRIVATE_BANK_PATH=./private/chess-v3-bank.json \
 *   SUPABASE_DB_URL=postgres://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres \
 *   node scripts/load-production-bank.mjs [--dry-run]
 *
 * Rotation semantics (immutable identity):
 * 1. Machine-validates every item (FEN, UCI legality, mates, MC shape,
 *    per-skill counts). ABORTS on any failure.
 * 2. HARD FAILS before writing anything when:
 *    - a release already exists for the same program/version/content
 *      with a DIFFERENT artifact hash (history is append-only; a changed
 *      artifact must ship as a NEW content_version),
 *    - any artifact item UUID already exists under a DIFFERENT content
 *      version (identity can never be rebound across versions),
 *    - the artifact final_bank_id already exists with a DIFFERENT
 *      content version (one bank id = one frozen release, forever).
 * 3. INSERTS the new content_version rows with the artifact's immutable
 *    item UUIDs. ON CONFLICT applies ONLY within the SAME content_version
 *    (idempotent re-load of the identical artifact).
 * 4. Retires the previously ACTIVE rows of the same program (status
 *    retired; compromised rows are never touched). Historical attempt
 *    foreign keys keep working; old evidence simply stops counting.
 * 5. Records credential_content_releases as draft (machine QA passed).
 *    Activation is a SEPARATE guarded step
 *    (scripts/activate-content-release.mjs): approval + atomic switch.
 *    This loader NEVER activates and NEVER touches issuance_enabled.
 *
 * Deployment order: public schema migrations -> this loader (private
 * artifact) -> human review recorded -> guarded activation.
 * Fresh public bootstraps intentionally contain NO production keys; the
 * e2e harness uses synthetic fixtures instead.
 */

import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { Chess } = require('chess.js');
const { Client } = require('pg');

const DRY = process.argv.includes('--dry-run');
const bankPath = process.env.PRIVATE_BANK_PATH;
const dbUrl = process.env.SUPABASE_DB_URL;

if (!bankPath) {
    console.error('PRIVATE_BANK_PATH is required (path to the private bank JSON).');
    process.exit(1);
}
if (!DRY && !dbUrl) {
    console.error('SUPABASE_DB_URL is required (service-role/direct connection).');
    process.exit(1);
}

const raw = readFileSync(bankPath, 'utf8');
const bank = JSON.parse(raw);

// Canonical hash: stable key order, no whitespace variance.
function canonicalize(v) {
    if (Array.isArray(v)) return `[${v.map(canonicalize).join(',')}]`;
    if (v && typeof v === 'object') {
        return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonicalize(v[k])}`).join(',')}}`;
    }
    return JSON.stringify(v);
}
const sha256 = createHash('sha256').update(canonicalize(bank)).digest('hex');
console.log(`artifact sha256: ${sha256}`);

const errors = [];

function mcWhere(list, label, keyOf) {
    for (const q of list) {
        const label_ = `${label}:${keyOf(q)}`;
        if (!Array.isArray(q.options) || q.options.length < 2) errors.push(`${label_} needs >=2 options`);
        else if (new Set(q.options).size !== q.options.length) errors.push(`${label_} duplicate options`);
        else if (!q.options.includes(q.answer)) errors.push(`${label_} answer not among options`);
    }
}

function uci(u) {
    const m = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/.exec(String(u).trim());
    if (!m) return null;
    return { from: m[1], to: m[2], promotion: m[3] };
}

for (const t of bank.practical ?? []) {
    const label = `practical:${t.key}`;
    try {
        if (t.kind === 'mate_in_1') {
            const g = new Chess(t.fen);
            const p = uci(t.answer);
            if (!p) errors.push(`${label} bad UCI`);
            else {
                g.move({ from: p.from, to: p.to, promotion: p.promotion });
                if (!g.isCheckmate()) errors.push(`${label} is not mate`);
            }
        } else if (t.kind === 'opening_line' || t.kind === 'tactic_line') {
            const g = new Chess(t.fen);
            const toks = t.kind === 'opening_line' ? String(t.answer).split(/\s+/) : [t.answer];
            for (const tok of toks) {
                const p = uci(tok);
                if (!p) { errors.push(`${label} bad UCI token ${tok}`); break; }
                try { g.move({ from: p.from, to: p.to, promotion: p.promotion }); }
                catch { errors.push(`${label} illegal move ${tok}`); break; }
            }
        } else {
            errors.push(`${label} unverifiable kind ${t.kind}`);
        }
    } catch (e) {
        errors.push(`${label} FEN/move error: ${e.message}`);
    }
}

mcWhere(bank.validation ?? [], 'validation', q => `${q.skill}/day${q.day}`);
mcWhere(bank.knowledge ?? [], 'knowledge', q => q.key);
mcWhere(bank.final ?? [], 'final', q => q.id);

// Coverage floors: artifact-declared min_counts, else pilot defaults.
// Required skills derive from the artifact evidence_policy (never hardcoded).
const floors = bank.min_counts ?? { validation: 8, knowledge: 4, practical: 2, final: 40, finalPerSkill: 10 };
const policySkills = (bank.evidence_policy ?? []).map(p => p.skill);
if (policySkills.length === 0) errors.push('evidence_policy must declare skills');
for (const [list, need, label] of [
    [bank.validation, floors.validation ?? 8, 'validation'],
    [bank.knowledge, floors.knowledge ?? 4, 'knowledge'],
    [bank.practical, floors.practical ?? 2, 'practical'],
]) {
    for (const s of policySkills) {
        const n = (list ?? []).filter(q => q.skill === s).length;
        if (n < need) errors.push(`need >=${need} ${s} ${label} items, have ${n}`);
    }
}

const perSkill = {};
for (const q of bank.final ?? []) perSkill[q.skill] = (perSkill[q.skill] ?? 0) + 1;
if ((bank.final ?? []).length < (floors.final ?? 40)) errors.push('final bank too small');
for (const s of policySkills) {
    if ((perSkill[s] ?? 0) < (floors.finalPerSkill ?? 10)) errors.push(`final needs >= ${floors.finalPerSkill ?? 10} ${s}`);
}

// Immutable-identity audit: every row carries a fresh UUID.
const uuids = new Set();
for (const v of bank.validation ?? []) {
    if (!v.id || uuids.has(v.id)) errors.push(`validation missing/duplicate id: ${v.prompt}`);
    uuids.add(v.id);
}
for (const q of [...(bank.knowledge ?? []), ...(bank.practical ?? [])]) {
    if (!q.id || uuids.has(q.id)) errors.push(`duplicate id: ${q.key}`);
    uuids.add(q.id);
}
if (!bank.final_bank_id) errors.push('final_bank_id is required');

if (errors.length > 0) {
    console.error(`BANK QA FAILED (${errors.length}):`);
    for (const e of errors) console.error(` - ${e}`);
    process.exit(1);
}
console.log('bank QA passed: machine half green (human review recorded separately).');

const humanApproval = process.env.HUMAN_APPROVAL === 'approved';
const reviewer = process.env.REVIEWER ?? null;
const reviewedAt = process.env.REVIEWED_AT ?? null;
if (!DRY && humanApproval && (!reviewer || !reviewedAt)) {
    console.error('HUMAN_APPROVAL=approved requires REVIEWER and REVIEWED_AT.');
    process.exit(1);
}

if (DRY) {
    console.log('--dry-run: no writes performed.');
    process.exit(0);
}

const db = new Client({ connectionString: dbUrl });
await db.connect();
try {
    await db.query('BEGIN');
    const P = bank.program_slug;
    const V = bank.program_version;
    const C = bank.content_version;

    // Immutability pre-checks (hard fail before any write).
    const rel = await db.query(
        `SELECT artifact_sha256 FROM credential_content_releases
         WHERE program_slug = $1 AND program_version = $2 AND content_version = $3`,
        [P, V, C],
    );
    if (rel.rowCount > 0 && rel.rows[0].artifact_sha256 !== sha256) {
        throw new Error(
            `refusing to rewrite release ${C}: stored sha differs; ship a NEW content_version instead`,
        );
    }
    if (rel.rowCount > 0 && rel.rows[0].artifact_sha256 === sha256) {
        // TRUE no-op path: the exact artifact is already loaded. Verify every
        // row matches byte-for-byte; any drift hard-fails (new version
        // required). Zero writes in this path.
        const diffs = [];
        const norm = v => JSON.parse(JSON.stringify(v));
        const sameJson = (a, b) => canonicalize(norm(a)) === canonicalize(norm(b));
        for (const v of bank.validation ?? []) {
            const r = await db.query(
                `SELECT payload, answer_key, skill_key, lesson_id, status FROM trusted_validation_items
                 WHERE program_slug = $1 AND program_version = $2 AND content_version = $3 AND curriculum_day = $4`,
                [P, V, C, v.day],
            );
            if (r.rowCount === 0) diffs.push(`validation day ${v.day} missing`);
            else {
                const row = r.rows[0];
                const wantPayload = { kind: 'mc', prompt: v.prompt, options: v.options };
                if (!sameJson(row.payload, wantPayload) || !sameJson(row.answer_key, { answer: v.answer })) {
                    diffs.push(`validation day ${v.day} content drift`);
                }
            }
        }
        for (const [table, list, keyOf] of [
            ['knowledge_items', bank.knowledge ?? [], q => q.key],
            ['practical_items', bank.practical ?? [], q => q.key],
        ]) {
            for (const qd of list) {
                const r = await db.query(
                    `SELECT payload, answer_key FROM ${table}
                     WHERE program_slug = $1 AND program_version = $2 AND content_version = $3 AND item_key = $4`,
                    [P, V, C, keyOf(qd)],
                );
                if (r.rowCount === 0) diffs.push(`${table} ${keyOf(qd)} missing`);
                else {
                    const wantPayload = { kind: qd.kind ?? 'mc', prompt: qd.prompt, options: qd.options, fen: qd.fen ?? null };
                    if (!sameJson(r.rows[0].payload, wantPayload) || !sameJson(r.rows[0].answer_key, { answer: qd.answer })) {
                        diffs.push(`${table} ${keyOf(qd)} content drift`);
                    }
                }
            }
        }
        const wantQuestions = (bank.final ?? []).map(q => ({ id: q.id, skill: q.skill, prompt: q.prompt, options: q.options }));
        const wantAnswers = Object.fromEntries((bank.final ?? []).map(q => [q.id, q.answer]));
        const setRow = await db.query(
            `SELECT questions FROM assessment_question_sets WHERE id = $1`, [bank.final_bank_id],
        );
        if (setRow.rowCount === 0) diffs.push('final bank missing');
        else if (!sameJson(setRow.rows[0].questions, wantQuestions)) diffs.push('final bank questions drift');
        const keyRow = await db.query(
            `SELECT answers, question_ids FROM assessment_answer_keys WHERE question_set_id = $1`,
            [bank.final_bank_id],
        );
        if (keyRow.rowCount === 0) diffs.push('final keys missing');
        else if (!sameJson(keyRow.rows[0].answers, wantAnswers)) diffs.push('final keys drift');
        if (diffs.length > 0) {
            throw new Error(
                `stored release ${C} matches sha but ${diffs.length} row(s) drift: ` +
                `${diffs.slice(0, 5).join('; ')}; ship a NEW content_version instead`,
            );
        }
        await db.query('ROLLBACK');
        console.log(`already loaded: verified ${sha256.slice(0, 12)}… row-for-row, zero writes performed.`);
        await db.end();
        process.exit(0);
    }
    const allIds = [
        ...(bank.validation ?? []).map(v => v.id),
        ...(bank.knowledge ?? []).map(q => q.id),
        ...(bank.practical ?? []).map(q => q.id),
    ];
    if (allIds.length > 0) {
        const clash = await db.query(
            `SELECT id, content_version FROM (
               SELECT id, content_version FROM trusted_validation_items WHERE id = ANY ($1::uuid[])
               UNION ALL SELECT id, content_version FROM knowledge_items WHERE id = ANY ($1::uuid[])
               UNION ALL SELECT id, content_version FROM practical_items WHERE id = ANY ($1::uuid[])
             ) u WHERE content_version IS DISTINCT FROM $2 LIMIT 5`,
            [allIds, C],
        );
        if (clash.rowCount > 0) {
            throw new Error(
                `refusing to rebind item UUIDs across content versions: ${JSON.stringify(clash.rows)}`,
            );
        }
    }
    const bankRow = await db.query(
        `SELECT content_version, status FROM assessment_question_sets WHERE id = $1`,
        [bank.final_bank_id],
    );
    if (bankRow.rowCount > 0) {
        const row = bankRow.rows[0];
        if (row.content_version !== C) {
            throw new Error(
                `refusing to reuse final_bank_id for a different content_version ` +
                `(${row.content_version} -> ${C}); mint a fresh bank id`,
            );
        }
        if (row.status === 'compromised') {
            throw new Error('refusing to touch a compromised final bank; mint a fresh bank id');
        }
    }

    for (const p of bank.evidence_policy ?? []) {
        await db.query(
            `INSERT INTO skill_evidence_policy (program_slug, program_version, skill_key, min_items, min_pass_rate, rationale)
             VALUES ($1,$2,$3,$4,$5,$6)
             ON CONFLICT (program_slug, program_version, skill_key) DO UPDATE SET
               min_items=EXCLUDED.min_items, min_pass_rate=EXCLUDED.min_pass_rate, rationale=EXCLUDED.rationale`,
            [P, V, p.skill, p.min_items, p.min_pass_rate, p.rationale],
        );
    }
    for (const v of bank.validation ?? []) {
        await db.query(
            `INSERT INTO trusted_validation_items
               (id, program_slug, program_version, hobby_id, curriculum_day, skill_key, lesson_id, content_version, status, payload, answer_key)
             VALUES ($1,$2,$3,'chess',$4,$5,$6,$7,'active',$8,$9)
             ON CONFLICT (program_slug, program_version, content_version, curriculum_day) DO UPDATE SET
               skill_key=EXCLUDED.skill_key, lesson_id=EXCLUDED.lesson_id,
               payload=EXCLUDED.payload, answer_key=EXCLUDED.answer_key`,
            [v.id, P, V, v.day, v.skill, v.lesson, C,
             { kind: 'mc', prompt: v.prompt, options: v.options }, { answer: v.answer }],
        );
    }
    for (const [table, list] of [['knowledge_items', bank.knowledge ?? []], ['practical_items', bank.practical ?? []]]) {
        for (const q of list) {
            await db.query(
                `INSERT INTO ${table}
                   (id, program_slug, program_version, skill_key, item_key, content_version, status, payload, answer_key)
                 VALUES ($1,$2,$3,$4,$5,$6,'active',$7,$8)
                 ON CONFLICT (program_slug, program_version, content_version, item_key) DO UPDATE SET
                   payload=EXCLUDED.payload, answer_key=EXCLUDED.answer_key`,
                [q.id, P, V, q.skill, q.key, C,
                 { kind: q.kind ?? 'mc', prompt: q.prompt, options: q.options, fen: q.fen ?? null },
                 { answer: q.answer }],
            );
        }
    }
    const questions = JSON.stringify((bank.final ?? []).map(q => ({ id: q.id, skill: q.skill, prompt: q.prompt, options: q.options })));
    const answers = Object.fromEntries((bank.final ?? []).map(q => [q.id, q.answer]));
    const ids = JSON.stringify((bank.final ?? []).map(q => q.id));
    await db.query(
        `INSERT INTO assessment_question_sets (id, program_slug, version, question_count, time_limit_minutes, pass_score, questions, content_version, status)
         VALUES ($1,$2,$3,20,30,80,$4,$5,'active')
         ON CONFLICT (id) DO UPDATE SET questions=EXCLUDED.questions, content_version=EXCLUDED.content_version`,
        [bank.final_bank_id, P, V, questions, C],  // pre-stringified above (pg would send a raw ARRAY literal otherwise)
    );
    await db.query(
        `INSERT INTO assessment_answer_keys (question_set_id, answers, question_ids)
         VALUES ($1,$2,$3)
         ON CONFLICT (question_set_id) DO UPDATE SET answers=EXCLUDED.answers, question_ids=EXCLUDED.question_ids`,
        [bank.final_bank_id, answers, ids],
    );
    for (const t of ['trusted_validation_items', 'knowledge_items', 'practical_items']) {
        await db.query(
            `UPDATE ${t} SET status = 'retired'
             WHERE program_slug = $1 AND status = 'active' AND content_version <> $2`, [P, C],
        );
    }
    await db.query(
        `UPDATE assessment_question_sets SET status = 'retired'
         WHERE program_slug = $1 AND version = $2 AND status = 'active' AND id <> $3`,
        [P, V, bank.final_bank_id],
    );
    await db.query(
        `INSERT INTO credential_content_releases
           (program_slug, program_version, content_version, artifact_sha256,
            machine_qa_status, human_review_status, reviewer, reviewed_at, status)
         VALUES ($1,$2,$3,$4,'passed',$5,$6,$7,'draft')
         ON CONFLICT (program_slug, program_version, content_version) DO UPDATE SET
           artifact_sha256=EXCLUDED.artifact_sha256, machine_qa_status='passed',
           human_review_status=EXCLUDED.human_review_status, reviewer=EXCLUDED.reviewer,
           reviewed_at=EXCLUDED.reviewed_at`,
        [P, V, C, sha256,
         humanApproval ? 'approved' : 'pending', reviewer, reviewedAt],
    );
    await db.query('COMMIT');
    console.log(`loaded ${C} (sha ${sha256.slice(0, 12)}…): previous active rows retired; release left as draft pending activation.`);
} catch (e) {
    await db.query('ROLLBACK');
    throw e;
} finally {
    await db.end();
}
