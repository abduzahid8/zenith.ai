import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LearningEvent } from '../domain/sessions/learningEvents';

/**
 * Learning event repository — append-only canonical history.
 *
 * Owner scoping: every scoped query REQUIRES an ownerId (the authenticated
 * user id, or 'local' for explicitly anonymous events). Events stored before
 * owner scoping carry NO ownerId and are never auto-attributed — they are
 * returned only when includeLegacy is passed explicitly.
 *
 * No truncation: valid historical evidence must not silently disappear, so
 * the full local history is preserved. Compaction (if ever needed) must be
 * a lossless snapshot architecture, not slice(-N).
 *
 * Storage stays local/persisted in this phase (serverization is a later
 * credential-trust phase); the API is shaped for a future Supabase adapter.
 * Screens must use these functions, never the underlying array directly.
 */

interface LearningEventState {
    events: LearningEvent[];
}

const useLearningEventStore = create<LearningEventState>()(
    persist<LearningEventState>(
        () => ({ events: [] }),
        {
            name: 'learning-events-v1',
            storage: createJSONStorage(() => AsyncStorage),
        },
    ),
);

function allEvents(): LearningEvent[] {
    return useLearningEventStore.getState().events;
}

function inScope(e: LearningEvent, ownerId: string, includeLegacy: boolean): boolean {
    if (e.ownerId === ownerId) return true;
    if (includeLegacy && !e.ownerId) return true;
    return false;
}

/** Append one event; duplicate ids are ignored (idempotent). */
export function appendLearningEvent(event: LearningEvent): boolean {
    const { events } = useLearningEventStore.getState();
    if (events.some(e => e.id === event.id)) return false;
    useLearningEventStore.setState({ events: [...events, event] });
    return true;
}

/** Append many; returns count of actually added (deduplicated) events. */
export function appendLearningEvents(batch: LearningEvent[]): number {
    if (batch.length === 0) return 0;
    const { events } = useLearningEventStore.getState();
    const known = new Set(events.map(e => e.id));
    const fresh = batch.filter(e => {
        if (known.has(e.id)) return false;
        known.add(e.id);
        return true;
    });
    if (fresh.length === 0) return 0;
    useLearningEventStore.setState({ events: [...events, ...fresh] });
    return fresh.length;
}

export interface ScopeOptions {
    /** Include pre-scoping events that carry no owner (default false). */
    includeLegacy?: boolean;
}

export function eventsBySession(sessionId: string, ownerId: string, opts: ScopeOptions = {}): LearningEvent[] {
    const includeLegacy = opts.includeLegacy === true;
    return allEvents().filter(e => e.sessionId === sessionId && inScope(e, ownerId, includeLegacy));
}

export function eventsByHobby(hobbyId: string, ownerId: string, opts: ScopeOptions = {}): LearningEvent[] {
    const includeLegacy = opts.includeLegacy === true;
    return allEvents().filter(e => e.hobbyId === hobbyId && inScope(e, ownerId, includeLegacy));
}

export function eventsByProgram(programSlug: string, ownerId: string, opts: ScopeOptions = {}): LearningEvent[] {
    const includeLegacy = opts.includeLegacy === true;
    return allEvents().filter(e => e.programSlug === programSlug && inScope(e, ownerId, includeLegacy));
}

export function recentLearningEvents(ownerId: string, limit: number, opts: ScopeOptions = {}): LearningEvent[] {
    const includeLegacy = opts.includeLegacy === true;
    return allEvents()
        .filter(e => inScope(e, ownerId, includeLegacy))
        .slice(-Math.max(0, limit));
}

export function learningEventCount(ownerId?: string): number {
    if (ownerId === undefined) return allEvents().length;
    return allEvents().filter(e => e.ownerId === ownerId).length;
}

/** Test/dev only: clear the local log. Never called from product UI. */
export function __resetLearningEventsForTests(): void {
    useLearningEventStore.setState({ events: [] });
}
