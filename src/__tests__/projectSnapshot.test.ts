/**
 * Slice 5 — project journey snapshot read authority (node suite).
 *
 * Latest own submission for the exact program/version (created_at DESC,
 * id DESC), then the certification result stamped for THAT exact
 * submission id. Older revisions never carry forward. Safe projection
 * only; project_reviews is never read; rubric/reviewer never leave.
 */
import { getSupabase } from '../services/supabase/client';
import { getProjectJourneySnapshot } from '../services/trustApi';

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

function projectSetup(overrides: {
    submissions?: unknown[];
    certifications?: unknown[];
} = {}): TableCall[] {
    return setup({
        project_submissions: { data: overrides.submissions ?? [], error: null },
        project_certification_results: { data: overrides.certifications ?? [], error: null },
    });
}

const SUB1 = {
    id: 'sub-1', artifact_ref: 'artifact://v1', notes: 'v1 notes', created_at: '2026-03-01T10:00:00Z',
};
const SUB2 = {
    id: 'sub-2', artifact_ref: 'artifact://v2', notes: 'v2 notes', created_at: '2026-03-05T10:00:00Z',
};

beforeEach(() => {
    jest.clearAllMocks();
});

describe('project journey snapshot', () => {
    test('latest submission wins by created_at DESC, id DESC', async () => {
        const calls = projectSetup({ submissions: [SUB2, SUB1] });
        const snap = await getProjectJourneySnapshot('chess-foundations', 'v2');
        // Adapter takes the first row of the server-ordered read.
        expect(snap.submission?.id).toBe('sub-2');
        expect(snap.review).toBeNull();
        const sub = calls.find(c => c.table === 'project_submissions');
        expect(sub).toBeDefined();
        const eqs = sub!.ops.filter(o => o.method === 'eq').map(o => o.args);
        expect(eqs).toEqual(
            expect.arrayContaining([
                ['program_slug', 'chess-foundations'],
                ['version', 'v2'],
            ]),
        );
        const orders = sub!.ops.filter(o => o.method === 'order').map(o => o.args);
        expect(orders).toEqual([
            ['created_at', { ascending: false }],
            ['id', { ascending: false }],
        ]);
    });

    test('safe projection only; project_reviews never read', async () => {
        const calls = projectSetup({ submissions: [SUB1] });
        await getProjectJourneySnapshot('chess-foundations', 'v2');
        expect(calls.map(c => c.table).sort()).toEqual(
            ['project_certification_results', 'project_submissions'].sort(),
        );
        const sub = calls.find(c => c.table === 'project_submissions')!;
        const selects = sub.ops.filter(o => o.method === 'select').map(o => o.args);
        expect(JSON.stringify(selects)).not.toMatch(/rubric|reviewer|user_id|program_slug/i);
        const cert = calls.find(c => c.table === 'project_certification_results')!;
        const certSelects = cert.ops.filter(o => o.method === 'select').map(o => o.args);
        expect(JSON.stringify(certSelects)).not.toMatch(/rubric|reviewer|evaluator/i);
        const certEqs = cert.ops.filter(o => o.method === 'eq').map(o => o.args);
        expect(certEqs).toEqual(expect.arrayContaining([['submission_id', 'sub-1']]));
    });

    test('review must match the latest submission id', async () => {
        projectSetup({
            submissions: [SUB2, SUB1],
            certifications: [
                {
                    submission_id: 'sub-2', authoritative_score: 90, passed: true,
                    evaluated_at: '2026-03-06T10:00:00Z',
                },
            ],
        });
        const snap = await getProjectJourneySnapshot('chess-foundations', 'v2');
        expect(snap.submission?.id).toBe('sub-2');
        expect(snap.review).toEqual({
            submissionId: 'sub-2',
            score: 90,
            passed: true,
            reviewedAt: '2026-03-06T10:00:00Z',
        });
    });

    test('older result never carries to a newer pending submission', async () => {
        projectSetup({
            submissions: [SUB2, SUB1],
            certifications: [
                {
                    submission_id: 'sub-1', authoritative_score: 40, passed: false,
                    evaluated_at: '2026-03-02T10:00:00Z',
                },
            ],
        });
        const snap = await getProjectJourneySnapshot('chess-foundations', 'v2');
        expect(snap.submission?.id).toBe('sub-2');
        expect(snap.review).toBeNull();
    });

    test('no submission => null snapshot', async () => {
        projectSetup({ submissions: [] });
        expect(await getProjectJourneySnapshot('chess-foundations', 'v2')).toEqual({
            submission: null,
            review: null,
        });
    });

    test('read errors propagate for journey isolation', async () => {
        setup({
            project_submissions: { data: [], error: { message: 'boom-sub' } },
        });
        await expect(getProjectJourneySnapshot('chess-foundations', 'v2')).rejects.toThrow('boom-sub');
        setup({
            project_submissions: { data: [SUB1], error: null },
            project_certification_results: { data: [], error: { message: 'boom-cert' } },
        });
        await expect(getProjectJourneySnapshot('chess-foundations', 'v2')).rejects.toThrow('boom-cert');
    });
});
