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
    /** Final outcomes per channel, chronological (one per session+card). */
    recall: MasteryOutcome[];
    application: MasteryOutcome[];
    validation: MasteryOutcome[];
    /** Latest final outcome per channel (null when unmeasured). */
    latestRecall: MasteryOutcome | null;
    latestApplication: MasteryOutcome | null;
    latestValidation: MasteryOutcome | null;
    /** Distinct contributing sessions, chronological. */
    sessions: string[];
    /**
     * Unresolved weakness after strength-aware resolution: a failed final
     * clears only on a later independent PASS of equal-or-stronger tier;
     * partials clear the same way. Sessions-ago uses the global order.
     */
    unresolved: {
        recallFails: number;
        applicationFails: number;
        applicationPartials: number;
        validationFails: number;
        lastWeakSessionsAgo: number | null;
    };
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
    /**
     * True while a recovered struggle still wants one light revisit: struggle
     * history exists AND no later independent session happened after the
     * latest struggle. A successful revisit clears it; history remains.
     */
    needsLightReview: boolean;
    lastPracticedAt: string | null;
    stage: SkillStage;
    /** Encountered days only (never future/unseen days). */
    days: DayDatum[];
}

export interface SkillProjection {
    programSlug: string;
    programVersion: string;
    /** Distinct sessions across projected events, chronological. */
    sessionOrder: string[];
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
    /**
     * Versionless legacy events (stored before programVersion pinning) are
     * EXCLUDED by default — they must not silently feed current state.
     * Pass true only for explicit compat analysis, never product intelligence.
     */
    includeLegacyUnversioned?: boolean;
}): SkillProjection {
    const { program, events } = input;
    const includeLegacy = input.includeLegacyUnversioned === true;
    const versionOk = (e: LearningEvent): boolean =>
        e.programSlug === program.slug &&
        (e.programVersion === program.version || (includeLegacy && e.programVersion === undefined));
    // Mastery inputs: attempt finals with real (non-none) strength.
    const attempts = events.filter(
        e =>
            e.eventType === 'attempt' &&
            versionOk(e) &&
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
    // Same strict version rule: versionless exposure never feeds state.
    const exposureEvents = events.filter(
        e =>
            (e.eventType === 'concept_exposed' || e.eventType === 'attempt') &&
            versionOk(e) &&
            e.sessionKind !== 'discovery' &&
            typeof e.curriculumDay === 'number',
    );

    // Global session order (chronological) for deterministic recency.
    const sessionOrder: string[] = [];
    {
        const byFirst = new Map<string, string>();
        for (const e of events) {
            if (!versionOk(e) || typeof e.occurredAt !== 'string') continue;
            const prev = byFirst.get(e.sessionId);
            if (!prev || e.occurredAt < prev) byFirst.set(e.sessionId, e.occurredAt);
        }
        sessionOrder.push(
            ...[...byFirst.entries()].sort((a, b) => (a[1] < b[1] ? -1 : 1)).map(([id]) => id),
        );
    }
    const sessionsAgo = (sessionId: string): number | null => {
        const i = sessionOrder.indexOf(sessionId);
        return i < 0 ? null : sessionOrder.length - 1 - i;
    };

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
        const struggleSessions = new Set<string>();
        const weakFinals: Array<{
            day: number;
            channel: 'recall' | 'application' | 'validation';
            outcome: MasteryOutcome;
            tier: number;
            session: string;
            at: string;
        }> = [];

        for (const { event, failedBefore } of finals) {
            if (event.skillKey !== skill.key) continue;
            const channel = channelOf(event);
            if (!channel) continue;
            recoveredStruggles += failedBefore;
            if (failedBefore > 0) struggleSessions.add(event.sessionId);
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
                    datum = {
                        day: event.curriculumDay,
                        recall: [],
                        application: [],
                        validation: [],
                        latestRecall: null,
                        latestApplication: null,
                        latestValidation: null,
                        sessions: [],
                        unresolved: {
                            recallFails: 0,
                            applicationFails: 0,
                            applicationPartials: 0,
                            validationFails: 0,
                            lastWeakSessionsAgo: null,
                        },
                        struggled: false,
                        lastAt: null,
                    };
                    dayMap.set(event.curriculumDay, datum);
                }
                datum[channel].push(sample.outcome);
                if (channel === 'recall') datum.latestRecall = sample.outcome;
                else if (channel === 'application') datum.latestApplication = sample.outcome;
                else datum.latestValidation = sample.outcome;
                if (!datum.sessions.includes(event.sessionId)) datum.sessions.push(event.sessionId);
                weakFinals.push({
                    day: event.curriculumDay,
                    channel,
                    outcome: sample.outcome,
                    tier: sample.weight >= 3 ? 3 : sample.weight === 2 ? 2 : 1,
                    session: event.sessionId,
                    at: event.occurredAt,
                });
                if (failedBefore > 0) datum.struggled = true;
                if (!datum.lastAt || event.occurredAt > datum.lastAt) datum.lastAt = event.occurredAt;
            }
            if (!lastPracticedAt || event.occurredAt > lastPracticedAt) lastPracticedAt = event.occurredAt;
        }

        // Strength-aware resolution sweep: a failed/partial final clears only
        // on a LATER independent PASS of equal-or-stronger tier. A weak PASS
        // never erases a stronger failure; history itself is untouched.
        const openByDayChannel = new Map<string, Array<{ kind: 'fail' | 'partial'; tier: number; session: string }>>();
        for (const wf of weakFinals.sort((a, b) => (a.at < b.at ? -1 : 1))) {
            const key = `${wf.day}:${wf.channel}`;
            const open = openByDayChannel.get(key) ?? [];
            if (wf.outcome === 'pass') {
                openByDayChannel.set(
                    key,
                    open.filter(o => o.tier > wf.tier),
                );
            } else if (wf.outcome === 'fail' || wf.outcome === 'partial') {
                open.push({ kind: wf.outcome, tier: wf.tier, session: wf.session });
                openByDayChannel.set(key, open);
            }
        }
        for (const [key, open] of openByDayChannel) {
            const [dayStr, channel] = key.split(':');
            const day = Number(dayStr);
            const datum = dayMap.get(day);
            if (!datum) continue;
            const fails = open.filter(o => o.kind === 'fail').length;
            const partials = open.filter(o => o.kind === 'partial').length;
            const agos = open
                .map(o => sessionsAgo(o.session))
                .filter((a): a is number => a !== null);
            const unresolved = datum.unresolved;
            if (channel === 'recall') unresolved.recallFails = fails;
            else if (channel === 'application') {
                unresolved.applicationFails = fails;
                unresolved.applicationPartials = partials;
            } else unresolved.validationFails = fails;
            const minAgo = agos.length > 0 ? Math.min(...agos) : null;
            if (minAgo !== null && (unresolved.lastWeakSessionsAgo === null || minAgo < unresolved.lastWeakSessionsAgo)) {
                unresolved.lastWeakSessionsAgo = minAgo;
            }
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

        // Pending light review: struggle history exists AND no later
        // independent session happened after the latest struggle. A revisit
        // clears the need; the history itself is never deleted.
        const allSkillSessions = new Set<string>(sessionSet);
        for (const e of exposureEvents) {
            if (
                typeof e.curriculumDay === 'number' &&
                e.curriculumDay >= skill.dayRange[0] &&
                e.curriculumDay <= skill.dayRange[1]
            ) {
                allSkillSessions.add(e.sessionId);
            }
        }
        const rankOfSession = (id: string): number => sessionOrder.indexOf(id);
        const latestStruggleRank = Math.max(
            -1,
            ...[...struggleSessions].map(id => rankOfSession(id)),
        );
        const latestSessionRank = Math.max(-1, ...[...allSkillSessions].map(id => rankOfSession(id)));
        const needsLightReview = struggleSessions.size > 0 && latestStruggleRank >= latestSessionRank;

        let stage: SkillStage = 'unseen';
        if (masteryEstimate === null) {
            stage = exposedDays.size > 0 ? 'learning' : 'unseen';
        } else if (recall.samples === 0) {
            stage = 'learning';
        } else if (application.samples === 0) {
            stage = 'recalling';
        } else if (validation.samples === 0) {
            stage = 'applying';
        } else if (
            (validation.score ?? 0) >= 75 &&
            sessionSet.size >= 3 &&
            confidence >= 0.6 &&
            ![...dayMap.values()].some(d => d.unresolved.validationFails > 0)
        ) {
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
            needsLightReview,
            lastPracticedAt,
            stage,
            days,
        };
    });

    return { programSlug: program.slug, programVersion: program.version, sessionOrder, skills };
}
