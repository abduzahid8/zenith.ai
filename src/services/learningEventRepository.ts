import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LearningEvent } from '../domain/sessions/learningEvents';

/**
 * Learning event repository — append-only canonical history.
 *
 * Storage stays local/persisted in this phase (serverization is a later
 * credential-trust phase); the API is shaped for a future Supabase adapter.
 * Screens must use these functions, never the underlying array directly.
 * Events are deduplicated by id; history is never mutated or rewritten.
 */

const MAX_EVENTS = 5000;

interface LearningEventState {
    events: LearningEvent[];
}

const useLearningEventStore = create<LearningEventState>()(
    persist<LearningEventState>(
        () => ({ events: [] }),
        {
            name: 'learning-events-v1',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: state => ({ events: state.events.slice(-MAX_EVENTS) }) as LearningEventState,
        },
    ),
);

function setEvents(events: LearningEvent[]): void {
    useLearningEventStore.setState({ events: events.slice(-MAX_EVENTS) });
}

/** Append one event; duplicate ids are ignored (idempotent). */
export function appendLearningEvent(event: LearningEvent): boolean {
    const { events } = useLearningEventStore.getState();
    if (events.some(e => e.id === event.id)) return false;
    setEvents([...events, event]);
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
    setEvents([...events, ...fresh]);
    return fresh.length;
}

export function eventsBySession(sessionId: string): LearningEvent[] {
    return useLearningEventStore.getState().events.filter(e => e.sessionId === sessionId);
}

export function eventsByHobby(hobbyId: string): LearningEvent[] {
    return useLearningEventStore.getState().events.filter(e => e.hobbyId === hobbyId);
}

export function eventsByProgram(programSlug: string): LearningEvent[] {
    return useLearningEventStore.getState().events.filter(e => e.programSlug === programSlug);
}

export function recentLearningEvents(limit: number): LearningEvent[] {
    const { events } = useLearningEventStore.getState();
    return events.slice(-Math.max(0, limit));
}

export function learningEventCount(): number {
    return useLearningEventStore.getState().events.length;
}

/** Test/dev only: clear the local log. Never called from product UI. */
export function __resetLearningEventsForTests(): void {
    useLearningEventStore.setState({ events: [] });
}
