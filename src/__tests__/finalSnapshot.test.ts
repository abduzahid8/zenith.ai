/**
 * Slice 4 — Final live snapshot read authority (node suite).
 *
 * The shared credential-stage snapshot resolves the live release ONCE and
 * uses that SAME internal identity for Knowledge, Practical, AND Final.
 * Final attempts count only when pinned to the current program version +
 * live bank; the Final component counts only when its reference resolves
 * to an own live submitted attempt. Safe fields only — bank_version, set
 * ids, assigned ids, breakdowns, and references never leave the adapter.
 */
import { getSupabase } from '../services/supabase/client';
import { getCredentialStageSnapshot } from '../services/trustApi';

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

const LIVE = 'content-C';

function stageSetup(overrides: {
    releases?: unknown[];
    finalAttempts?: unknown[];
    finalComponent?: unknown[];
} = {}): TableCall[] {
    return setup({
        credential_content_releases: {
            data: overrides.releases ?? [{ content_version: LIVE }],
            error: null,
        },
        knowledge_attempts: { data: [], error: null },
        practical_attempts: { data: [], error: null },
        assessment_attempts: { data: overrides.finalAttempts ?? [], error: null },
        credential_component_results: { data: overrides.finalComponent ?? [], error: null },
    });
}

beforeEach(() => {
    jest.clearAllMocks();
});

describe('final live snapshot read authority', () => {
    test('release is resolved once; final reads share the live identity', async () => {
        const calls = stageSetup({
            finalAttempts: [
                {
                    id: 'f-live', attempt_number: 1, status: 'started', score: null, passed: null,
                    deadline: '2026-03-01T10:30:00Z', submitted_at: null, bank_version: LIVE,
                },
                {
                    id: 'f-old', attempt_number: 1, status: 'started', score: null, passed: null,
                    deadline: '2026-01-01T10:30:00Z', submitted_at: null, bank_version: 'content-A',
                },
            ],
        });
        const snap = await getCredentialStageSnapshot('chess-foundations', 'v2');
        expect(calls.filter(c => c.table === 'credential_content_releases').length).toBe(1);
        expect(snap.contentAvailable).toBe(true);
        expect(snap.finalAssessment.attempts.map(a => a.id)).toEqual(['f-live']);
        expect(snap.finalAssessment.component).toBeNull();
    });

    test('final attempt query pins version + status server-side', async () => {
        const calls = stageSetup();
        await getCredentialStageSnapshot('chess-foundations', 'v2');
        const fin = calls.find(c => c.table === 'assessment_attempts');
        expect(fin).toBeDefined();
        const eqs = fin!.ops.filter(o => o.method === 'eq').map(o => o.args);
        expect(eqs).toEqual(
            expect.arrayContaining([
                ['program_slug', 'chess-foundations'],
                ['question_set_version', 'v2'],
            ]),
        );
        const ins = fin!.ops.filter(o => o.method === 'in').map(o => o.args);
        expect(ins).toEqual([['status', ['started', 'submitted']]]);
    });

    test('unknown statuses never surface', async () => {
        stageSetup({
            finalAttempts: [
                {
                    id: 'f-sup', attempt_number: 1, status: 'superseded', score: null, passed: null,
                    deadline: null, submitted_at: null, bank_version: LIVE,
                },
                {
                    id: 'f-weird', attempt_number: 1, status: 'archived', score: null, passed: null,
                    deadline: null, submitted_at: null, bank_version: LIVE,
                },
            ],
        });
        const snap = await getCredentialStageSnapshot('chess-foundations', 'v2');
        expect(snap.finalAssessment.attempts).toEqual([]);
        expect(snap.finalAssessment.component).toBeNull();
    });

    test('live started attempt exposes safe fields only', async () => {
        stageSetup({
            finalAttempts: [
                {
                    id: 'f-live', attempt_number: 2, status: 'started', score: null, passed: null,
                    deadline: '2026-03-01T10:30:00Z', submitted_at: null, bank_version: LIVE,
                    // Server-only internals that must never leak:
                    question_set_id: 'set-uuid',
                    assigned_question_ids: ['q1', 'q2'],
                    skill_breakdown: { alpha: { correct: 1, total: 2 } },
                    answers: { q1: '2' },
                },
            ],
        });
        const snap = await getCredentialStageSnapshot('chess-foundations', 'v2');
        expect(snap.finalAssessment.attempts).toEqual([
            {
                id: 'f-live',
                attemptNumber: 2,
                status: 'started',
                score: null,
                passed: null,
                deadline: '2026-03-01T10:30:00Z',
                submittedAt: null,
            },
        ]);
        expect(JSON.stringify(snap.finalAssessment)).not.toMatch(
            /bank_version|question_set_id|assigned|skill_breakdown|reference_id|content_version/i,
        );
    });

    test('live final PASS component resolves via own live submitted attempt', async () => {
        stageSetup({
            finalAttempts: [
                {
                    id: 'f1', attempt_number: 1, status: 'submitted', score: 92, passed: true,
                    deadline: '2026-03-01T10:30:00Z', submitted_at: '2026-03-01T10:20:00Z', bank_version: LIVE,
                },
            ],
            finalComponent: [{ score: 92, passed: true, reference_id: 'f1' }],
        });
        const snap = await getCredentialStageSnapshot('chess-foundations', 'v2');
        expect(snap.finalAssessment.component).toEqual({ score: 92, passed: true });
    });

    test('stale final PASS (retired bank reference) is ignored', async () => {
        stageSetup({
            finalAttempts: [
                {
                    id: 'f-old', attempt_number: 1, status: 'submitted', score: 95, passed: true,
                    deadline: '2026-01-01T10:30:00Z', submitted_at: '2026-01-01T10:20:00Z',
                    bank_version: 'content-A',
                },
            ],
            finalComponent: [{ score: 95, passed: true, reference_id: 'f-old' }],
        });
        const snap = await getCredentialStageSnapshot('chess-foundations', 'v2');
        expect(snap.finalAssessment.attempts).toEqual([]);
        expect(snap.finalAssessment.component).toBeNull();
    });

    test('component with unresolvable reference is ignored', async () => {
        stageSetup({
            finalAttempts: [],
            finalComponent: [{ score: 95, passed: true, reference_id: 'ghost' }],
        });
        expect((await getCredentialStageSnapshot('chess-foundations', 'v2')).finalAssessment.component).toBeNull();
        stageSetup({
            finalAttempts: [],
            finalComponent: [{ score: 95, passed: true, reference_id: null }],
        });
        expect((await getCredentialStageSnapshot('chess-foundations', 'v2')).finalAssessment.component).toBeNull();
    });

    test('no live release => final fails closed with no further reads', async () => {
        const calls = stageSetup({ releases: [] });
        const snap = await getCredentialStageSnapshot('chess-foundations', 'v2');
        expect(snap.contentAvailable).toBe(false);
        expect(snap.finalAssessment).toEqual({ attempts: [], component: null });
        expect(calls.map(c => c.table)).toEqual(['credential_content_releases']);
    });
});
