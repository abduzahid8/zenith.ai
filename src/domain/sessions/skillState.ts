import type { CredentialProgram } from '../credentials/types';
import type { LearningEvent } from './learningEvents';
import type { MasteryOutcome } from './outcomePolicy';
import { evidenceValueOf } from './outcomePolicy';

/**
 * Skill State projector — pure derivation over canonical LearningEvents.
 * No React, Zustand, routing or UI. No legacy skillGraph math.
 *
 * Core rules:
 * - UNSEEN (no evidence) is null/unknown, never 0/failed.
 * - Exposure uses the canonical dayRange denominator, never event counts.
 * - Mastery comes from interactive ATTEMPT finals only (grouped by
 *   sessionId+cardId); task_completed/session_completed never double-count.
 * - Discovery (strength none) and concept exposure never create mastery.
 * - Retries collapse to one final mastery sample; struggle stays visible.
 * - Confidence is explicit and separate from the estimate.
 * - History never disappears (no rolling windows); recency only shapes
 *   recentTrend fields and recommendation priority (Phase 3B engine).
 */

export interface SkillDimension {
    /** Independent (session,card) final samples. */
    samples: number;
    /** Strength-weighted mean outcome value, null when unmeasured. */
    score: number | null;
    /** Distinct sessions contributing samples. */
    sessions: number;
}

export type ConfidenceLevel = 'none' | 'low' | 'medium' | 'high';
export type SkillStage = 'unseen' | 'learning' | 'recalling' | 'applying' | 'proving' | 'strong';

export interface DayDatum {
    day: number;
    recall: MasteryOutcome[];
    application: MasteryOutcome[];
    validation: MasteryOutcome[];
    /** A non-final attempt failed here before recovery (struggle memory). */
    struggled: boolean;
    lastAt: string | null;
}

export interface SkillState {
    skillKey: string;
    name: string;
    dayRange: [number, number];
    exposure: { daysCovered: number; daysTotal: number; coverage: number };
    recall: SkillDimension;
    application: SkillDimension;
    validation: SkillDimension;
    /** 0..100 internal estimate, null when nothing interactive measured. */
    masteryEstimate: number | null;
    /** 0..1 evidence depth, separate from the estimate. */
    confidence: number;
    confidenceLevel: ConfidenceLevel;
    independentSessions: number;
    uniqueCurriculumDays: number;
    recentFailures: number;
    recentPartials: number;
    /** Recovered failures: non-final failed attempts (struggle memory). */
    recoveredStruggles: number;
    lastPracticedAt: string | null;
    stage: SkillStage;
    /** Encountered days only (never future/unseen days). */
    days: DayDatum[];
}

export interface SkillProjection {
    programSlug: string;
    programVersion: string;
    skills: SkillState[];
}

const CHANNEL_WEIGHT: Record<string, number> = { weak: 1, medium: 2, strong: 3, summative: 4 };

interface FinalSample {
    sessionId: string;
    outcome: MasteryOutcome;
    value: number;
    weight: number;
    day: number | null;
    occurredAt: string;
    failedAttemptsBefore: number;
}

function channelOf(event: LearningEvent): 'recall' | 'application' | 'validation' | null {
    if (event.eventType !== 'attempt') return null;
    if (event.phase === 'recall') return 'recall';
    if (event.phase === 'apply') return 'application';
    if (event.phase === 'validate') return 'validation';
    return null;
}

function dimensionOf(samples: FinalSample[]): SkillDimension {
    if (samples.length === 0) return { samples: 0, score: null, sessions: 0 };
    let weighted = 0;
    let weights = 0;
    const sessions = new Set<string>();
    for (const s of samples) {
        weighted += s.value * s.weight;
        weights += s.weight;
        sessions.add(s.sessionId);
    }
    return {
        samples: samples.length,
        score: weights > 0 ? Math.round(((weighted / weights) * 100) * 10) / 10 : null,
        sessions: sessions.size,
    };
}

export function projectSkillState(input: {
    program: CredentialProgram;
    events: LearningEvent[];
}): SkillProjection {
    const { program, events } = input;
    // Mastery inputs: attempt finals with real (non-none) strength, matching
    // current program slug + version. Versionless legacy events are included
    // under an explicit compat rule (documented, removable at serverization);
    // explicitly mismatched versions are excluded, never reinterpreted.
    const attempts = events.filter(
        e =>
            e.eventType === 'attempt' &&
            e.programSlug === program.slug &&
            (e.programVersion === undefined || e.programVersion === program.version) &&
            e.evidenceStrength !== 'none' &&
            e.skillKey != null,
    );

    // Group by session+card: final attempt decides mastery; all attempts feed struggle.
    const byCard = new Map<string, LearningEvent[]>();
    for (const e of attempts) {
        const key = `${e.sessionId}:${e.cardId ?? '-'}`;
        const list = byCard.get(key) ?? [];
        list.push(e);
        byCard.set(key, list);
    }
    const finals: Array<{ event: LearningEvent; failedBefore: number }> = [];
    for (const list of byCard.values()) {
        const ordered = [...list].sort((a, b) => (a.attemptNo ?? 0) - (b.attemptNo ?? 0));
        const last = ordered[ordered.length - 1];
        const failedBefore = ordered.slice(0, -1).filter(e => e.outcome === 'fail').length;
        finals.push({ event: last, failedBefore });
    }
    finals.sort((a, b) => (a.event.occurredAt < b.event.occurredAt ? -1 : 1));
    // Exposure: canonical dayRange denominator; non-discovery exposure only.
    const exposureEvents = events.filter(
        e =>
            (e.eventType === 'concept_exposed' || e.eventType === 'attempt') &&
            e.programSlug === program.slug &&
            (e.programVersion === undefined || e.programVersion === program.version) &&
            e.sessionKind !== 'discovery' &&
            typeof e.curriculumDay === 'number',
    );

    const skills: SkillState[] = program.skills.map(skill => {
        const daysTotal = Math.max(1, skill.dayRange[1] - skill.dayRange[0] + 1);
        const exposedDays = new Set<number>();
        for (const e of exposureEvents) {
            if (
                typeof e.curriculumDay === 'number' &&
                e.curriculumDay >= skill.dayRange[0] &&
                e.curriculumDay <= skill.dayRange[1]
            ) {
                exposedDays.add(e.curriculumDay);
            }
        }
        const coverage = Math.round((exposedDays.size / daysTotal) * 1000) / 10;

        const recallSamples: FinalSample[] = [];
        const applicationSamples: FinalSample[] = [];
        const validationSamples: FinalSample[] = [];
        const dayMap = new Map<number, DayDatum>();
        const sessionSet = new Set<string>();
        const daySet = new Set<number>();
        let lastPracticedAt: string | null = null;
        let recoveredStruggles = 0;

        for (const { event, failedBefore } of finals) {
            if (event.skillKey !== skill.key) continue;
            const channel = channelOf(event);
            if (!channel) continue;
            recoveredStruggles += failedBefore;
            const sample: FinalSample = {
                sessionId: event.sessionId,
                outcome: (event.outcome ?? 'unknown') as MasteryOutcome,
                value: evidenceValueOf(event.outcome),
                weight: CHANNEL_WEIGHT[event.evidenceStrength] ?? 1,
                day: event.curriculumDay ?? null,
                occurredAt: event.occurredAt,
                failedAttemptsBefore: 0,
            };
            if (channel === 'recall') recallSamples.push(sample);
            else if (channel === 'application') applicationSamples.push(sample);
            else validationSamples.push(sample);
            sessionSet.add(event.sessionId);
            if (typeof event.curriculumDay === 'number') {
                daySet.add(event.curriculumDay);
                let datum = dayMap.get(event.curriculumDay);
                if (!datum) {
                    datum = { day: event.curriculumDay, recall: [], application: [], validation: [], struggled: false, lastAt: null };
                    dayMap.set(event.curriculumDay, datum);
                }
                datum[channel].push(sample.outcome);
                if (failedBefore > 0) datum.struggled = true;
                if (!datum.lastAt || event.occurredAt > datum.lastAt) datum.lastAt = event.occurredAt;
            }
            if (!lastPracticedAt || event.occurredAt > lastPracticedAt) lastPracticedAt = event.occurredAt;
        }

        const recall = dimensionOf(recallSamples);
        const application = dimensionOf(applicationSamples);
        const validation = dimensionOf(validationSamples);

        // Mastery estimate: validation 45 / application 35 / recall 20 over
        // PRESENT channels (renormalized). Missing channels cap confidence.
        const present: Array<{ score: number; weight: number }> = [];
        if (recall.score !== null) present.push({ score: recall.score, weight: 20 });
        if (application.score !== null) present.push({ score: application.score, weight: 35 });
        if (validation.score !== null) present.push({ score: validation.score, weight: 45 });
        const masteryEstimate =
            present.length === 0
                ? null
                : Math.round(
                      ((present.reduce((s, p) => s + p.score * p.weight, 0) /
                          present.reduce((s, p) => s + p.weight, 0)) *
                          10) / 10,
                  );

        const channelsMeasured = present.length;
        const strongSamples = validationSamples.length;
        let confidence =
            Math.min(1, sessionSet.size / 4) * 0.4 +
            (channelsMeasured / 3) * 0.3 +
            Math.min(1, strongSamples / 3) * 0.2 +
            Math.min(1, daySet.size / 5) * 0.1;
        if (validation.samples === 0) confidence = Math.min(confidence, 0.5);
        if (application.samples === 0 && validation.samples === 0) confidence = Math.min(confidence, 0.3);
        if (sessionSet.size < 2) confidence = Math.min(confidence, 0.4);
        // Failed proof caps confidence: passing practice cannot outweigh it.
        if (validation.samples > 0 && (validation.score ?? 100) < 50) confidence = Math.min(confidence, 0.6);
        confidence = Math.round(confidence * 100) / 100;
        const confidenceLevel: ConfidenceLevel =
            confidence <= 0 ? 'none' : confidence < 0.35 ? 'low' : confidence < 0.7 ? 'medium' : 'high';

        // Recent trend over the last 5 independent final samples.
        const recent = [...recallSamples, ...applicationSamples, ...validationSamples]
            .sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1))
            .slice(0, 5);
        const recentFailures = recent.filter(s => s.outcome === 'fail').length;
        const recentPartials = recent.filter(s => s.outcome === 'partial').length;

        const days = [...dayMap.values()].sort((a, b) => a.day - b.day);

        let stage: SkillStage = 'unseen';
        if (masteryEstimate === null) {
            stage = exposedDays.size > 0 ? 'learning' : 'unseen';
        } else if (recall.samples === 0) {
            stage = 'learning';
        } else if (application.samples === 0) {
            stage = 'recalling';
        } else if (validation.samples === 0) {
            stage = 'applying';
        } else if ((validation.score ?? 0) >= 75 && sessionSet.size >= 3 && confidence >= 0.6) {
            stage = 'strong';
        } else {
            stage = 'proving';
        }

        return {
            skillKey: skill.key,
            name: skill.name,
            dayRange: skill.dayRange,
            exposure: { daysCovered: exposedDays.size, daysTotal, coverage },
            recall,
            application,
            validation,
            masteryEstimate,
            confidence,
            confidenceLevel,
            independentSessions: sessionSet.size,
            uniqueCurriculumDays: daySet.size,
            recentFailures,
            recentPartials,
            recoveredStruggles,
            lastPracticedAt,
            stage,
            days,
        };
    });

    return { programSlug: program.slug, programVersion: program.version, skills };
}
