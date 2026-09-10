#!/usr/bin/env node
/**
 * Private production bank loader (ops only, never CI-on-public-repo).
 *
 * Loads a PRIVATE bank artifact (e.g. private/chess-v2-bank.json) into
 * Supabase WITHOUT any key material entering public Git history:
 *
 *   PRIVATE_BANK_PATH=./private/chess-v2-bank.json \
 *   SUPABASE_DB_URL=postgres://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres \
 *   node scripts/load-production-bank.mjs [--dry-run]
 *
 * What it does:
 * 1. Machine-validates every item (FEN parses, UCI legal, mates checkmate,
 *    MC shape, per-skill counts) using chess.js. ABORTS on any failure.
 * 2. Upserts evidence policy, validation/knowledge/practical items
 *    (content_version from the artifact, status active), the final
 *    question set + hidden answer keys.
 * 3. Verifies counts per skill and prints a coverage report.
 *
 * Human review record lives OUTSIDE this script: production banks ship
 * only with a signed-off review (correctness, single defensible answer,
 * wording, skill mapping, difficulty). This loader enforces the machine
 * half; the review checklist is in the phase delivery report.
 *
 * Requires direct DB access (service role / superuser). Uses the `pg`
 * devDependency. `--dry-run` validates without writing.
 */

import { readFileSync } from 'fs';
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

const bank = JSON.parse(readFileSync(bankPath, 'utf8'));
const errors = [];

function mcWhere(list, label) {
    for (const q of list) {
        const label_ = `${label}:${q.id ?? q.key ?? q.prompt}`;
        if (!Array.isArray(q.options) || q.options.length < 2) errors.push(`${label_} needs >=2 options`);
        else if (new Set(q.options).size !== q.options.length) errors.push(`${label_} duplicate options`);
        else if (!q.options.includes(q.answer)) errors.push(`${label_} answer not among options`);
    }
}

function uci(fen, u) {
    const m = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/.exec(String(u).trim());
    if (!m) return null;
    return { from: m[1], to: m[2], promotion: m[3] };
}

for (const t of bank.practical ?? []) {
    const label = `practical:${t.key}`;
    try {
        if (t.kind === 'mate_in_1') {
            const g = new Chess(t.fen);
            const p = uci(t.fen, t.answer);
            if (!p) errors.push(`${label} bad UCI`);
            else {
                g.move({ from: p.from, to: p.to, promotion: p.promotion });
                if (!g.isCheckmate()) errors.push(`${label} is not mate`);
            }
        } else if (t.kind === 'opening_line' || t.kind === 'tactic_line') {
            const g = new Chess(t.fen);
            const toks = t.kind === 'opening_line' ? String(t.answer).split(/\s+/) : [t.answer];
            for (const tok of toks) {
                const p = uci(t.fen, tok);
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

mcWhere(bank.validation ?? [], 'validation');
mcWhere(bank.knowledge ?? [], 'knowledge');
mcWhere(bank.final ?? [], 'final');

for (const [list, need, skills] of [
    [bank.validation, 4, ['rules', 'openings', 'endgames', 'tactics']],
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

if (errors.length > 0) {
    console.error(`BANK QA FAILED (${errors.length}):`);
    for (const e of errors) console.error(` - ${e}`);
    process.exit(1);
}
console.log('bank QA passed: machine half green (human review still required separately).');

if (DRY) {
    console.log('--dry-run: no writes performed.');
    process.exit(0);
}

const db = new Client({ connectionString: dbUrl });
await db.connect();
try {
    await db.query('BEGIN');
    for (const p of bank.evidence_policy ?? []) {
        await db.query(
            `INSERT INTO skill_evidence_policy (program_slug, program_version, skill_key, min_items, min_pass_rate, rationale)
             VALUES ($1,$2,$3,$4,$5,$6)
             ON CONFLICT (program_slug, program_version, skill_key) DO UPDATE SET
               min_items=EXCLUDED.min_items, min_pass_rate=EXCLUDED.min_pass_rate, rationale=EXCLUDED.rationale`,
            [bank.program_slug, bank.program_version, p.skill, p.min_items, p.min_pass_rate, p.rationale],
        );
    }
    for (const v of bank.validation ?? []) {
        await db.query(
            `INSERT INTO trusted_validation_items
               (program_slug, program_version, hobby_id, curriculum_day, skill_key, lesson_id, content_version, status, payload, answer_key)
             VALUES ($1,$2,$3,$4,$5,$6,$7,'active',$8,$9)
             ON CONFLICT (program_slug, program_version, curriculum_day) DO UPDATE SET
               skill_key=EXCLUDED.skill_key, lesson_id=EXCLUDED.lesson_id, content_version=EXCLUDED.content_version,
               status='active', payload=EXCLUDED.payload, answer_key=EXCLUDED.answer_key`,
            [bank.program_slug, bank.program_version, 'chess', v.day, v.skill, v.lesson, bank.content_version,
             { kind: 'mc', prompt: v.prompt, options: v.options }, { answer: v.answer }],
        );
    }
    for (const [table, list] of [['knowledge_items', bank.knowledge ?? []], ['practical_items', bank.practical ?? []]]) {
        for (const q of list) {
            await db.query(
                `INSERT INTO ${table}
                   (program_slug, program_version, skill_key, item_key, content_version, status, payload, answer_key)
                 VALUES ($1,$2,$3,$4,$5,'active',$6,$7)
                 ON CONFLICT (program_slug, program_version, item_key) DO UPDATE SET
                   content_version=EXCLUDED.content_version, status='active',
                   payload=EXCLUDED.payload, answer_key=EXCLUDED.answer_key`,
                [bank.program_slug, bank.program_version, q.skill, q.key, bank.content_version,
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
         ON CONFLICT (id) DO UPDATE SET questions=EXCLUDED.questions, content_version=EXCLUDED.content_version, status='active'`,
        [bank.final_bank_id, bank.program_slug, bank.program_version, JSON.stringify(questions), bank.content_version],
    );
    await db.query(
        `INSERT INTO assessment_answer_keys (question_set_id, answers, question_ids)
         VALUES ($1,$2,$3)
         ON CONFLICT (question_set_id) DO UPDATE SET answers=EXCLUDED.answers, question_ids=EXCLUDED.question_ids`,
        [bank.final_bank_id, answers, ids],
    );
    await db.query('COMMIT');
    console.log(`loaded ${bank.content_version}: validation=${(bank.validation ?? []).length} knowledge=${(bank.knowledge ?? []).length} practical=${(bank.practical ?? []).length} final=${(bank.final ?? []).length}`);
} catch (e) {
    await db.query('ROLLBACK');
    throw e;
} finally {
    await db.end();
}
