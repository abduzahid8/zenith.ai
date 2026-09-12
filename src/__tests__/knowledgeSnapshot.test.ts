/**
 * Slice 2 final patch — Knowledge live-release read authority (node suite).
 *
 * The snapshot adapter resolves the current live content release ONCE from
 * public release metadata (mirroring migration 035: active + QA passed +
 * human approved, exactly one row), then scopes attempts and the component
 * to that release. Retired content never surfaces; content_version never
 * leaves the adapter.
 */
import { getSupabase } from '../services/supabase/client';
import {
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

function liveSetup(overrides: {
    releases?: unknown[];
    attempts?: unknown[];
    component?: unknown[] | null;
} = {}): TableCall[] {
    return setup({
        credential_content_releases: {
            data: overrides.releases ?? [{ content_version: LIVE }],
            error: null,
        },
        knowledge_attempts: { data: overrides.attempts ?? [], error: null },
        credential_component_results: {
            data: overrides.component ?? [],
            error: null,
        },
    });
}

beforeEach(() => {
    jest.clearAllMocks();
});

describe('resolveLiveContentVersion (pure)', () => {
    test('zero rows => null', () => {
        expect(resolveLiveContentVersion([])).toBeNull();
    });

    test('two rows => null (fail closed)', () => {
        expect(
            resolveLiveContentVersion([{ content_version: 'A' }, { content_version: 'B' }]),
        ).toBeNull();
    });

    test('exactly one row => its version', () => {
        expect(resolveLiveContentVersion([{ content_version: 'B' }])).toBe('B');
    });

    test('missing or empty version => null', () => {
        expect(resolveLiveContentVersion([{ content_version: '' }])).toBeNull();
        expect(resolveLiveContentVersion([{ content_version: 42 }])).toBeNull();
        expect(resolveLiveContentVersion([{}])).toBeNull();
    });
});

describe('getKnowledgeJourneySnapshot', () => {
    test('release query carries all five live filters (QA/human/status/version)', async () => {
        const calls = liveSetup();
        await getKnowledgeJourneySnapshot('chess-foundations', 'v2');
        const rel = calls.find(c => c.table === 'credential_content_releases');
        expect(rel).toBeDefined();
        const eqs = rel!.ops.filter(o => o.method === 'eq').map(o => o.args);
        // QA-failed, human-unapproved, draft, or wrong-version rows can
        // never match: the server filters them before we ever see rows.
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

    test('zero live releases => unavailable, no further reads', async () => {
        const calls = liveSetup({ releases: [] });
        const snap = await getKnowledgeJourneySnapshot('chess-foundations', 'v2');
        expect(snap).toEqual({ contentAvailable: false, attempts: [], component: null });
        expect(calls.map(c => c.table)).toEqual(['credential_content_releases']);
    });

    test('two live releases => unavailable (fail closed)', async () => {
        const calls = liveSetup({
            releases: [{ content_version: 'A' }, { content_version: 'B' }],
        });
        const snap = await getKnowledgeJourneySnapshot('chess-foundations', 'v2');
        expect(snap).toEqual({ contentAvailable: false, attempts: [], component: null });
        expect(calls.map(c => c.table)).toEqual(['credential_content_releases']);
    });

    test('only live attempts survive (retired/superseded/unknown dropped)', async () => {
        liveSetup({
            attempts: [
                { id: 'live-started', status: 'started', score: null, passed: null, submitted_at: null, content_version: LIVE },
                { id: 'old-started', status: 'started', score: null, passed: null, submitted_at: null, content_version: 'content-A' },
                { id: 'old-failed', status: 'submitted', score: 40, passed: false, submitted_at: '2026-01-01', content_version: 'content-A' },
                { id: 'sup-live', status: 'superseded', score: null, passed: null, submitted_at: null, content_version: LIVE },
                { id: 'weird-live', status: 'archived', score: null, passed: null, submitted_at: null, content_version: LIVE },
            ],
        });
        const snap = await getKnowledgeJourneySnapshot('chess-foundations', 'v2');
        expect(snap.contentAvailable).toBe(true);
        expect(snap.attempts.map(a => a.id)).toEqual(['live-started']);
        expect(snap.component).toBeNull();
    });

    test('component PASS referencing live submitted attempt => passed', async () => {
        liveSetup({
            attempts: [
                { id: 's1', status: 'submitted', score: 91, passed: true, submitted_at: '2026-02-01', content_version: LIVE },
            ],
            component: [{ score: 91, passed: true, reference_id: 's1' }],
        });
        const snap = await getKnowledgeJourneySnapshot('chess-foundations', 'v2');
        expect(snap.component).toEqual({ score: 91, passed: true });
    });

    test('component PASS referencing retired attempt => null', async () => {
        liveSetup({
            attempts: [
                { id: 'old-pass', status: 'submitted', score: 95, passed: true, submitted_at: '2026-01-01', content_version: 'content-A' },
            ],
            component: [{ score: 95, passed: true, reference_id: 'old-pass' }],
        });
        const snap = await getKnowledgeJourneySnapshot('chess-foundations', 'v2');
        expect(snap.attempts).toEqual([]);
        expect(snap.component).toBeNull();
    });

    test('live failed submission surfaces failed score (not hidden, not passed)', async () => {
        liveSetup({
            attempts: [
                { id: 's2', status: 'submitted', score: 40, passed: false, submitted_at: '2026-02-02', content_version: LIVE },
            ],
            component: [{ score: 40, passed: false, reference_id: 's2' }],
        });
        const snap = await getKnowledgeJourneySnapshot('chess-foundations', 'v2');
        expect(snap.component).toEqual({ score: 40, passed: false });
    });

    test('component without a resolvable reference => null', async () => {
        liveSetup({
            attempts: [],
            component: [{ score: 95, passed: true, reference_id: null }],
        });
        expect((await getKnowledgeJourneySnapshot('chess-foundations', 'v2')).component).toBeNull();
        liveSetup({
            attempts: [
                { id: 's1', status: 'submitted', score: 91, passed: true, submitted_at: '2026-02-01', content_version: LIVE },
            ],
            component: [{ score: 91, passed: true, reference_id: 'someone-elses-attempt' }],
        });
        expect((await getKnowledgeJourneySnapshot('chess-foundations', 'v2')).component).toBeNull();
    });

    test('content_version never leaks out of the snapshot', async () => {
        liveSetup({
            attempts: [
                { id: 'live-started', status: 'started', score: null, passed: null, submitted_at: null, content_version: LIVE },
            ],
            component: [],
        });
        const snap = await getKnowledgeJourneySnapshot('chess-foundations', 'v2');
        expect(JSON.stringify(snap)).not.toMatch(/content_version|reference_id/i);
        expect('content_version' in (snap.attempts[0] as object)).toBe(false);
    });

    test('release read error propagates (hook fail-closes)', async () => {
        setup({
            credential_content_releases: { data: [], error: { message: 'boom' } },
        });
        await expect(getKnowledgeJourneySnapshot('chess-foundations', 'v2')).rejects.toThrow('boom');
    });
});
