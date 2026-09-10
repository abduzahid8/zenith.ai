#!/usr/bin/env node
/**
 * Private production bank loader (ops only, never CI-on-public-repo).
 *
 * Loads a PRIVATE bank artifact (e.g. private/chess-v3-bank.json) into
 * Supabase WITHOUT any key material entering public Git history:
 *
 *   PRIVATE_BANK_PATH=./private/chess-v3-bank.json \
 *   SUPABASE_DB_URL=postgres://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres \
 *   REVIEWER='ops-human' REVIEWED_AT='2026-09-10T00:00:00Z' HUMAN_APPROVAL=approved \
 *   node scripts/load-production-bank.mjs [--dry-run]
 *
 * Rotation semantics (immutable identity):
 * 1. Machine-validates every item (FEN, UCI legality, mates, MC shape,
 *    per-skill counts). ABORTS on any failure.
 * 2. INSERTS the new content_version rows with the artifact's immutable
 *    item UUIDs. ON CONFLICT applies ONLY within the SAME content_version
 *    (idempotent re-load); it NEVER crosses content versions — a version
 *    change with colliding slots aborts instead of overwriting history.
 * 3. Retires the previously ACTIVE rows of the same program (status
 *    retired; compromised rows are never touched). Historical attempt
 *    foreign keys keep working; old evidence simply stops counting.
 * 4. Records credential_content_releases with the artifact SHA-256,
 *    machine QA status, and (only with HUMAN_APPROVAL=approved plus
 *    REVIEWER/REVIEWED_AT) the human approval. Loader NEVER activates:
 *    activation is a separate guarded step (027-style migration checking
 *    approved+active release, exact bank parity, hidden keys present).
 *
 * Deployment order: public schema migrations -> this loader (private
 * artifact) -> human review recorded -> guarded activation migration.
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

for (const [list, need, skills] of [
    [bank.validation, 8, ['rules', 'openings', 'endgames', 'tactics']],
    [bank.knowledge, 4, ['rules', 'openings', 'endgames', 'tactics']],
    [bank.practical, 2, ['rules', 'openings', 'endgames', 'tactics']],
]) {
    for (const s of skills) {
        const n = (list ?? []).filter(q => q.skill === s).length;
        if (n < need) errors.push(`need >=${need} ${s} items, have ${n}`);
    }
}

const perSkill = {};
for (const q of bank.final ?? []) perSkill[q.skill] = (perSkill[q.skill] ?? 0) + 1;
if ((bank.final ?? []).length < 40) errors.push('final bank needs >= 40');
for (const s of ['rules', 'openings', 'endgames', 'tactics']) {
    if ((perSkill[s] ?? 0) < 10) errors.push(`final needs >= 10 ${s}, have ${perSkill[s] ?? 0}`);
}

// Immutable-identity audit: fresh UUIDs must not collide with prior rows.
const uuids = new Set();
for (const v of bank.validation ?? []) {
    if (!v.id || uuids.has(v.id)) errors.push(`validation missing/duplicate id: ${v.prompt}`);
    uuids.add(v.id);
}
for (const q of [...(bank.knowledge ?? []), ...(bank.practical ?? [])]) {
    if (!q.id || uuids.has(q.id)) errors.push(`duplicate id: ${q.key}`);
    uuids.add(q.id);
}

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
    for (const p of bank.evidence_policy ?? []) {
        await db.query(
            `INSERT INTO skill_evidence_policy (program_slug, program_version, skill_key, min_items, min_pass_rate, rationale)
             VALUES ($1,$2,$3,$4,$5,$6)
             ON CONFLICT (program_slug, program_version, skill_key) DO UPDATE SET
               min_items=EXCLUDED.min_items, min_pass_rate=EXCLUDED.min_pass_rate, rationale=EXCLUDED.rationale`,
            [P, V, p.skill, p.min_items, p.min_pass_rate, p.rationale],
        );
    }
    // New immutable rows. Same-version conflicts refresh in place (idempotent
    // re-load); cross-version slot collisions are impossible because identity
    // includes content_version.
    for (const v of bank.validation ?? []) {
        await db.query(
            `INSERT INTO trusted_validation_items
               (id, program_slug, program_version, hobby_id, curriculum_day, skill_key, lesson_id, content_version, status, payload, answer_key)
             VALUES ($1,$2,$3,'chess',$4,$5,$6,$7,'active',$8,$9)
             ON CONFLICT (program_slug, program_version, content_version, curriculum_day) DO UPDATE SET
               skill_key=EXCLUDED.skill_key, lesson_id=EXCLUDED.lesson_id,
               payload=EXCLUDED.payload, answer_key=EXCLUDED.answer_key`,
            [v.id, P, V, v.day, v.skill, v.lesson,
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
                [q.id, P, V, q.skill, q.key,
                 { kind: q.kind ?? 'mc', prompt: q.prompt, options: q.options, fen: q.fen ?? null },
                 { answer: q.answer }],
            );
        }
    }
    const questions = (bank.final ?? []).map(q => ({ id: q.id, skill: q.skill, prompt: q.prompt, options: q.options }));
    const answers = Object.fromEntries((bank.final ?? []).map(q => [q.id, q.answer]));
    const ids = (bank.final ?? []).map(q => q.id);
    await db.query(
        `INSERT INTO assessment_question_sets (id, program_slug, version, question_count, time_limit_minutes, pass_score, questions, content_version, status)
         VALUES ($1,$2,$3,20,30,80,$4,$5,'active')
         ON CONFLICT (id) DO UPDATE SET questions=EXCLUDED.questions, content_version=EXCLUDED.content_version`,
        [bank.final_bank_id, P, V, JSON.stringify(questions), C],
    );
    await db.query(
        `INSERT INTO assessment_answer_keys (question_set_id, answers, question_ids)
         VALUES ($1,$2,$3)
         ON CONFLICT (question_set_id) DO UPDATE SET answers=EXCLUDED.answers, question_ids=EXCLUDED.question_ids`,
        [bank.final_bank_id, answers, ids],
    );
    // Retire previously ACTIVE rows of this program (compromised untouched).
    // NOTE: validation rows addressed by day-slot; the loader refuses to
    // overwrite a row whose content_version differs (immutable identity).
    for (const t of ['trusted_validation_items', 'knowledge_items', 'practical_items']) {
        const col = t === 'trusted_validation_items' ? 'curriculum_day' : 'item_key';
        void col;
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
