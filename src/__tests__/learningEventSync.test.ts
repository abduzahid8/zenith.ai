/**
 * Sync queue behavior: local-first upload with owner safety.
 * Uses the real persisted stores (mocked AsyncStorage in unit tests)
 * with a fake transport — no network.
 */

import {
    appendAndQueue,
    flushLearningEventSync,
    pendingSyncCount,
    syncRecordFor,
    __resetLearningSyncForTests,
} from '../services/learningEventSync';
import type { SyncTransport } from '../services/learningEventSync';
import {
    __resetLearningEventsForTests,
    learningEventCount,
} from '../services/learningEventRepository';
import { buildAttemptEvent } from '../domain/sessions/learningEvents';

function ev(session: string, userId?: string) {
    return buildAttemptEvent({
        sessionId: session,
        userId,
        hobbyId: 'chess',
        lessonId: 'chess_d4',
        lessonDay: 4,
        cardId: `apply-${session}`,
        attemptNo: 1,
        phase: 'apply',
        sessionKind: 'structured',
        outcome: 'pass',
        cardType: 'apply',
        occurredAt: '2026-09-01T10:00:00.000Z',
    });
}

const okTransport: SyncTransport = {
    upload: async () => 'ok',
};

describe('learning event sync queue', () => {
    beforeEach(() => {
        __resetLearningEventsForTests();
        __resetLearningSyncForTests();
    });

    test('append queues pending; flush confirms', async () => {
        const e = ev('s1', 'user-a');
        expect(appendAndQueue(e)).toBe(true);
        expect(syncRecordFor(e.id)?.status).toBe('pending');
        const seen: { owner: (string | null)[] } = { owner: [] };
        const r = await flushLearningEventSync(
            { upload: async (_e, owner) => { seen.owner.push(owner); return 'ok'; } },
            [e],
            { currentUid: 'user-a' },
        );
        expect(r).toEqual({ uploaded: 1, retried: 0, skipped: 0 });
        expect(seen.owner).toEqual(['user-a']);
        expect(syncRecordFor(e.id)?.status).toBe('synced');
        expect(pendingSyncCount()).toBe(0);
    });

    test('transport failure stays pending with retry metadata (offline safe)', async () => {
        const e = ev('s1', 'user-a');
        appendAndQueue(e);
        const failing: SyncTransport = { upload: async () => { throw new Error('offline'); } };
        const r = await flushLearningEventSync(failing, [e], { currentUid: 'user-a' });
        expect(r.uploaded).toBe(0);
        expect(r.retried).toBe(1);
        const rec = syncRecordFor(e.id)!;
        expect(rec.status).toBe('pending');
        expect(rec.attempts).toBe(1);
        expect(rec.lastError).toBe('offline');
        // Local evidence is never lost by a failed flush.
        expect(learningEventCount()).toBe(1);
    });

    test('events owned by another user are skipped, never re-attributed', async () => {
        const e = ev('s1', 'user-a');
        appendAndQueue(e);
        const r = await flushLearningEventSync(okTransport, [e], { currentUid: 'user-b' });
        expect(r).toEqual({ uploaded: 0, retried: 0, skipped: 1 });
        expect(syncRecordFor(e.id)?.status).toBe('pending');
    });

    test('legacy ownerless events need explicit opt-in and upload unattributed', async () => {
        const e = ev('s0'); // no userId -> ownerId 'local'
        appendAndQueue(e);
        const owners: (string | null)[] = [];
        const capture: SyncTransport = {
            upload: async (_e, owner) => { owners.push(owner); return 'ok'; },
        };
        const denied = await flushLearningEventSync(capture, [e], { currentUid: 'user-a' });
        expect(denied.skipped).toBe(1);
        expect(owners).toHaveLength(0);
        const allowed = await flushLearningEventSync(capture, [e], { currentUid: 'user-a', includeLegacy: true });
        expect(allowed.uploaded).toBe(1);
        expect(owners).toEqual([null]); // server stores unattributed
    });

    test('duplicate append is rejected (no double queue)', () => {
        const e = ev('s1', 'user-a');
        expect(appendAndQueue(e)).toBe(true);
        expect(appendAndQueue(e)).toBe(false);
        expect(learningEventCount()).toBe(1);
    });
});
