import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { appendLearningEvent } from './learningEventRepository';
import type { LearningEvent } from '../domain/sessions/learningEvents';

/**
 * Learning event sync — local-first upload queue.
 *
 * Architecture: local append -> pending sync -> Supabase -> confirmed.
 * Sessions keep working offline; sync state lives OUTSIDE LearningEvent
 * semantics (a separate persisted map keyed by deterministic event id),
 * so frozen event builders are untouched.
 *
 * Safety properties:
 * - no event loss: local append happens before queueing; failures stay
 *   pending with retry metadata (attempts, lastError).
 * - no duplicates: server upserts on the deterministic id (idempotency key).
 * - retry safe: same payload re-sent; server returns inserted=false.
 * - app restart safe: queue is persisted (learning-sync-v1).
 * - offline safe: transport errors -> pending, flushed on next opportunity.
 * - logout/login safe: flush takes the CURRENT auth uid and only uploads
 *   events whose ownerId matches it. Events owned by anyone else are
 *   skipped (left pending, never re-attributed).
 * - legacy ownerless events (no ownerId, or 'local') are NEVER uploaded as
 *   owned rows. They upload only with explicit includeLegacy, with
 *   client_owner NULL, so the server trigger stores them unattributed
 *   (user_id NULL, trusted FALSE). Clearing them server-side attribution
 *   is impossible by construction.
 */

export type SyncStatus = 'pending' | 'synced' | 'failed';

export interface SyncRecord {
    status: SyncStatus;
    attempts: number;
    lastError?: string;
    syncedAt?: string;
}

interface SyncState {
    records: Record<string, SyncRecord>;
}

/** Transport result per event: ok | retry (keep pending) | drop (poison). */
export type UploadVerdict = 'ok' | 'retry' | 'drop';

export interface SyncTransport {
    /**
     * Upload one event. Must be idempotent server-side (upsert on event id).
     * clientOwner: the uid string to assert, or null for legacy unattributed.
     */
    upload(event: LearningEvent, clientOwner: string | null): Promise<UploadVerdict>;
}

const useLearningSyncStore = create<SyncState>()(
    persist<SyncState>(
        () => ({ records: {} }),
        {
            name: 'learning-sync-v1',
            storage: createJSONStorage(() => AsyncStorage),
        },
    ),
);

function setRecord(eventId: string, record: SyncRecord): void {
    useLearningSyncStore.setState(s => ({ records: { ...s.records, [eventId]: record } }));
}

export function syncRecordFor(eventId: string): SyncRecord | undefined {
    return useLearningSyncStore.getState().records[eventId];
}

export function pendingSyncCount(): number {
    return Object.values(useLearningSyncStore.getState().records).filter(
        r => r.status === 'pending' || r.status === 'failed',
    ).length;
}

/** Append locally AND queue for upload. Returns false if duplicate id. */
export function appendAndQueue(event: LearningEvent): boolean {
    const added = appendLearningEvent(event);
    if (!added) return false;
    setRecord(event.id, { status: 'pending', attempts: 0 });
    return true;
}

export interface FlushOptions {
    /** Current authenticated uid, or null when logged out. */
    currentUid: string | null;
    /** Upload ownerless legacy events as unattributed rows (default false). */
    includeLegacy?: boolean;
    /** Max events per flush (default 100). */
    batchLimit?: number;
}

export interface FlushResult {
    uploaded: number;
    retried: number;
    skipped: number;
}

function uploadableOwner(event: LearningEvent, opts: FlushOptions): string | null | 'skip' {
    if (event.ownerId === opts.currentUid && opts.currentUid !== null) {
        return opts.currentUid;
    }
    if (!event.ownerId || event.ownerId === 'local') {
        // Legacy/anonymous: unattributed only, explicit opt-in only.
        return opts.includeLegacy === true ? null : 'skip';
    }
    // Owned by someone else (logout/login switch): never re-attribute.
    return 'skip';
}

/**
 * Flush pending events through the transport. Pure orchestration over the
 * persisted queue — safe to call on app start, reconnect, and after sessions.
 */
export async function flushLearningEventSync(
    transport: SyncTransport,
    events: LearningEvent[],
    opts: FlushOptions,
): Promise<FlushResult> {
    const result: FlushResult = { uploaded: 0, retried: 0, skipped: 0 };
    const limit = opts.batchLimit ?? 100;
    const queue = events
        .filter(e => {
            const rec = syncRecordFor(e.id);
            return !rec || rec.status === 'pending' || rec.status === 'failed';
        })
        .slice(0, limit);
    for (const event of queue) {
        const owner = uploadableOwner(event, opts);
        if (owner === 'skip') {
            result.skipped += 1;
            continue;
        }
        const prev = syncRecordFor(event.id);
        try {
            const verdict = await transport.upload(event, owner);
            if (verdict === 'ok') {
                setRecord(event.id, {
                    status: 'synced',
                    attempts: (prev?.attempts ?? 0) + 1,
                    syncedAt: new Date().toISOString(),
                });
                result.uploaded += 1;
            } else if (verdict === 'drop') {
                setRecord(event.id, {
                    status: 'failed',
                    attempts: (prev?.attempts ?? 0) + 1,
                    lastError: 'dropped by transport (poison payload)',
                });
                result.retried += 1;
            } else {
                setRecord(event.id, {
                    status: 'pending',
                    attempts: (prev?.attempts ?? 0) + 1,
                    lastError: 'transport asked for retry',
                });
                result.retried += 1;
            }
        } catch (err) {
            setRecord(event.id, {
                status: 'pending',
                attempts: (prev?.attempts ?? 0) + 1,
                lastError: err instanceof Error ? err.message : 'upload failed',
            });
            result.retried += 1;
        }
    }
    return result;
}

/** Test/dev only. Never called from product UI. */
export function __resetLearningSyncForTests(): void {
    useLearningSyncStore.setState({ records: {} });
}
