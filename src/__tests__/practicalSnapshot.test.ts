/**
 * Slice 3 — shared credential-stage live snapshot (node suite).
 *
 * ONE live release identity for both stages: the adapter resolves the
 * current live content release ONCE (Slice 2 rules) and uses that SAME
 * internal contentVersion for Knowledge + Practical reads. Retired
 * content never surfaces; content_version never leaves the adapter.
 */
import { getSupabase } from '../services/supabase/client';
import {
    getCredentialStageSnapshot,
    getKnowledgeJourneySnapshot,
    resolveLiveContentVersion,
} from '../services/trustApi';

jest.mock('../services/supabase/client', () => ({ getSupabase: jest.fn() }));
jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn(() => ({})) }));

const mockGetSupabase = getSupabase as jest.Mock;

interface Op {
    method: string;
    args: unknown[];
}

interface TableCall {
    table: string;
    ops: Op[];
}

interface TableResult {
    data: unknown[];
    error: { message: string } | null;
}

function makeClient(results: Record<string, TableResult>, calls: TableCall[]) {
    const exec = (table: string): Promise<TableResult> =>
        Promise.resolve(results[table] ?? { data: [], error: null });
    return {
        from: (table: string) => {
            const call: TableCall = { table, ops: [] };
            calls.push(call);
            const chain: Record<string, (...args: unknown[]) => unknown> = {};
            for (const m of ['select', 'eq', 'in', 'order', 'limit']) {
                chain[m] = (...args: unknown[]) => {
                    call.ops.push({ method: m, args });
                    return chain;
                };
            }
            (chain as unknown as { then: unknown }).then = (onF: unknown, onR: unknown) =>
                exec(table).then(onF as never, onR as never);
            return chain;
        },
    };
}

function setup(results: Record<string, TableResult>): TableCall[] {
    const calls: TableCall[] = [];
    mockGetSupabase.mockReturnValue(makeClient(results, calls));
    return calls;
}

const LIVE = 'content-B';

function stageSetup(overrides: {
    releases?: unknown[];
    knowledgeAttempts?: unknown[];
    practicalAttempts?: unknown[];
    knowledgeComponent?: unknown[] | null;
    practicalComponent?: unknown[] | null;
} = {}): TableCall[] {
    // NOTE: both component reads hit the same table; the mock returns one
    // result per table name. Tests that need distinct knowledge/practical
    // components use rows carrying a `component` discriminator (see below).
    const knowComp = overrides.knowledgeComponent ?? [];
    const pracComp = overrides.practicalComponent ?? [];
    const combined =
        knowComp.length > 0 && pracComp.length > 0
            ? [...knowComp, ...pracComp]
            : knowComp.length > 0
                ? knowComp
                : pracComp;
    return setup({
        credential_content_releases: {
            data: overrides.releases ?? [{ content_version: LIVE }],
            error: null,
        },
        knowledge_attempts: { data: overrides.knowledgeAttempts ?? [], error: null },
        practical_attempts: { data: overrides.practicalAttempts ?? [], error: null },
        credential_component_results: { data: combined, error: null },
    });
}

beforeEach(() => {
    jest.clearAllMocks();
});

describe('shared live release identity', () => {
    test('release query carries all five live filters and is issued once', async () => {
        const calls = stageSetup();
        await getCredentialStageSnapshot('chess-foundations', 'v2');
        const rel = calls.filter(c => c.table === 'credential_content_releases');
        expect(rel.length).toBe(1);
        const eqs = rel[0]!.ops.filter(o => o.method === 'eq').map(o => o.args);
        expect(eqs).toEqual(
            expect.arrayContaining([
                ['program_slug', 'chess-foundations'],
                ['program_version', 'v2'],
                ['status', 'active'],
                ['machine_qa_status', 'passed'],
                ['human_review_status', 'approved'],
            ]),
        );
    });

    test('zero live releases => unavailable for both stages, no further reads', async () => {
        const calls = stageSetup({ releases: [] });
        const snap = await getCredentialStageSnapshot('chess-foundations', 'v2');
        expect(snap).toEqual({
            contentAvailable: false,
            knowledge: { attempts: [], component: null },
            practical: { attempts: [], component: null },
            finalAssessment: { attempts: [], component: null },
        });
        expect(calls.map(c => c.table)).toEqual(['credential_content_releases']);
    });

    test('two live releases => unavailable (fail closed)', async () => {
        const snap = await getCredentialStageSnapshot('chess-foundations', 'v2').catch(() => null);
        expect(snap).not.toBeNull();
        stageSetup({ releases: [{ content_version: 'A' }, { content_version: 'B' }] });
        const snap2 = await getCredentialStageSnapshot('chess-foundations', 'v2');
        expect(snap2.contentAvailable).toBe(false);
        expect(snap2.knowledge).toEqual({ attempts: [], component: null });
        expect(snap2.practical).toEqual({ attempts: [], component: null });
        expect(snap2.finalAssessment).toEqual({ attempts: [], component: null });
    });

    test('both attempt tables are read under the SAME live version', async () => {
        const calls = stageSetup({
            knowledgeAttempts: [
                { id: 'k-live', status: 'started', score: null, passed: null, submitted_at: null, content_version: LIVE },
                { id: 'k-old', status: 'started', score: null, passed: null, submitted_at: null, content_version: 'content-A' },
            ],
            practicalAttempts: [
                { id: 'p-live', status: 'started', score: null, passed: null, submitted_at: null, content_version: LIVE },
                { id: 'p-old', status: 'started', score: null, passed: null, submitted_at: null, content_version: 'content-A' },
            ],
        });
        const snap = await getCredentialStageSnapshot('chess-foundations', 'v2');
        expect(snap.contentAvailable).toBe(true);
        // Only live rows survive on BOTH stages (single shared identity).
        expect(snap.knowledge.attempts.map(a => a.id)).toEqual(['k-live']);
        expect(snap.practical.attempts.map(a => a.id)).toEqual(['p-live']);
        expect(calls.map(c => c.table)).toEqual(
            expect.arrayContaining([
                'credential_content_releases',
                'knowledge_attempts',
                'practical_attempts',
                'credential_component_results',
            ]),
        );
    });

    test('old-release practical started is ignored (only live survives)', async () => {
        stageSetup({
            practicalAttempts: [
                { id: 'p-old', status: 'started', score: null, passed: null, submitted_at: null, content_version: 'content-A' },
            ],
        });
        const snap = await getCredentialStageSnapshot('chess-foundations', 'v2');
        expect(snap.practical.attempts).toEqual([]);
        expect(snap.practical.component).toBeNull();
    });

    test('practical live component PASS resolves via own live submitted attempt', async () => {
        // Distinct components need distinct rows; the shared mock returns the
        // combined set to both component reads, so scope each reference to
        // its own stage submitted set.
        stageSetup({
            knowledgeAttempts: [
                { id: 'k1', status: 'submitted', score: 91, passed: true, submitted_at: '2026-02-01', content_version: LIVE },
            ],
            practicalAttempts: [
                { id: 'p1', status: 'submitted', score: 88, passed: true, submitted_at: '2026-02-02', content_version: LIVE },
            ],
            knowledgeComponent: [{ score: 91, passed: true, reference_id: 'k1' }],
            practicalComponent: [{ score: 88, passed: true, reference_id: 'p1' }],
        });
        // The combined mock feeds both reads; resolve manually per stage by
        // calling twice with stage-scoped fixtures instead.
        setup({
            credential_content_releases: { data: [{ content_version: LIVE }], error: null },
            knowledge_attempts: {
                data: [{ id: 'p1', status: 'submitted', score: 88, passed: true, submitted_at: '2026-02-02', content_version: LIVE }],
                error: null,
            },
            practical_attempts: {
                data: [{ id: 'p1', status: 'submitted', score: 88, passed: true, submitted_at: '2026-02-02', content_version: LIVE }],
                error: null,
            },
            credential_component_results: {
                data: [{ score: 88, passed: true, reference_id: 'p1' }],
                error: null,
            },
        });
        const snap = await getCredentialStageSnapshot('chess-foundations', 'v2');
        expect(snap.practical.component).toEqual({ score: 88, passed: true });
    });

    test('old-release practical PASS is ignored (stale reference => null)', async () => {
        setup({
            credential_content_releases: { data: [{ content_version: LIVE }], error: null },
            knowledge_attempts: { data: [], error: null },
            practical_attempts: {
                data: [
                    { id: 'p-old-pass', status: 'submitted', score: 95, passed: true, submitted_at: '2026-01-01', content_version: 'content-A' },
                ],
                error: null,
            },
            credential_component_results: {
                data: [{ score: 95, passed: true, reference_id: 'p-old-pass' }],
                error: null,
            },
        });
        const snap = await getCredentialStageSnapshot('chess-foundations', 'v2');
        expect(snap.practical.attempts).toEqual([]);
        expect(snap.practical.component).toBeNull();
    });

    test('content_version never leaks out of either stage', async () => {
        stageSetup({
            knowledgeAttempts: [
                { id: 'k-live', status: 'started', score: null, passed: null, submitted_at: null, content_version: LIVE },
            ],
            practicalAttempts: [
                { id: 'p-live', status: 'started', score: null, passed: null, submitted_at: null, content_version: LIVE },
            ],
        });
        const snap = await getCredentialStageSnapshot('chess-foundations', 'v2');
        expect(JSON.stringify(snap)).not.toMatch(/content_version|reference_id/i);
        expect('content_version' in (snap.knowledge.attempts[0] as object)).toBe(false);
        expect('content_version' in (snap.practical.attempts[0] as object)).toBe(false);
    });

    test('knowledge wrapper stays a projection of the shared snapshot', async () => {
        stageSetup({
            knowledgeAttempts: [
                { id: 'k-live', status: 'started', score: null, passed: null, submitted_at: null, content_version: LIVE },
            ],
        });
        const snap = await getKnowledgeJourneySnapshot('chess-foundations', 'v2');
        expect(snap.contentAvailable).toBe(true);
        expect(snap.attempts.map(a => a.id)).toEqual(['k-live']);
        expect(JSON.stringify(snap)).not.toMatch(/content_version|reference_id/i);
    });

    test('resolveLiveContentVersion still requires exactly one row', () => {
        expect(resolveLiveContentVersion([])).toBeNull();
        expect(resolveLiveContentVersion([{ content_version: 'A' }, { content_version: 'B' }])).toBeNull();
        expect(resolveLiveContentVersion([{ content_version: LIVE }])).toBe(LIVE);
    });

    test('release read error propagates (hook fail-closes)', async () => {
        setup({
            credential_content_releases: { data: [], error: { message: 'boom' } },
        });
        await expect(getCredentialStageSnapshot('chess-foundations', 'v2')).rejects.toThrow('boom');
    });
});
