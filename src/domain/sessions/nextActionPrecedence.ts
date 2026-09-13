import type { LearningRecommendation } from './nextBestAction';
import type { SessionOrigin } from './sessionBlueprint';
import { findNextIncompleteTask } from './sessionCompletion';
import { routeForRecommendation, sessionRouteForTask } from './sessionRouting';

/**
 * ONE canonical next-action precedence (Phase 1).
 *
 * WHAT the user should do next comes from exactly one place:
 *   1. the server-authoritative credential journey action
 *      (verification / stage actions — never local scoring), else
 *   2. the frozen adaptive engine (`getNextBestLearningAction`), else
 *   3. the current DailyPlan frontier task, else
 *   4. continue curriculum.
 *
 * Discovery / optional activity is NEVER a primary action.
 *
 * WHY it matters today stays separate: `dailyFocusEngine` / focusReason
 * (and `reasonCopy` for recommendation reasons). This module never merges
 * the two — it only resolves WHAT.
 *
 * No new engine: every session route is built by the existing
 * `sessionRouting` adapters over the existing recommendation output.
 */

export type CoachPrimarySource =
    | 'credential_verify'
    | 'remediation'
    | 'frontier_task'
    | 'continue_curriculum';

export interface JourneyActionRef {
    kind: string;
    skillKey?: string | null;
    skillName?: string | null;
}

export interface SessionPrimary {
    kind: 'session';
    source: CoachPrimarySource;
    /** Button label (short, names the activity). */
    label: string;
    /** Canonical route — always via sessionRouting, never hand-built. */
    route: string;
    reasonCode: string | null;
}

export interface VerifyPrimary {
    kind: 'verify_skill';
    source: 'credential_verify';
    skillKey: string;
    skillName: string;
    label: string;
}

export interface JourneyOwnedPrimary {
    /** The journey section owns the CTA (stage/claim runner) — Coach
     * renders NO competing primary so the screen has exactly one. */
    kind: 'journey_owned';
    actionKind: string;
}

export type CoachPrimary = SessionPrimary | VerifyPrimary | JourneyOwnedPrimary | null;

export interface DailyTaskRef {
    id?: string | null;
    title: string;
    type: string;
    status: string;
    duration_minutes?: number | null;
}

/** Journey actions that own their CTA inside the journey section. */
const JOURNEY_OWNED_KINDS = new Set([
    'start_knowledge',
    'continue_knowledge',
    'start_practical',
    'continue_practical',
    'start_final',
    'continue_final',
    'submit_project',
    'revise_project',
]);

function truncateTitle(title: string, max = 26): string {
    const t = (title || '').trim();
    return t.length > max ? `${t.substring(0, max - 1)}…` : t;
}

export interface ResolveCoachPrimaryInput {
    /** Server-authoritative journey action (from useCredentialJourney). */
    journeyAction: JourneyActionRef | null;
    /** False when the journey section is hidden (unavailable program). */
    journeyVisible: boolean;
    /** Canonical engine output (WHAT). */
    recommendation: LearningRecommendation | null;
    dailyTasks: DailyTaskRef[];
    origin?: SessionOrigin;
}

/**
 * Resolve the single primary action for the Coach surface.
 * Pure and total: same inputs always yield the same primary.
 * The LLM explanation layer receives this result — it can never
 * replace it (the resolver takes no LLM input by construction).
 */
export function resolveCoachPrimary(input: ResolveCoachPrimaryInput): CoachPrimary {
    const { journeyAction, journeyVisible, recommendation, dailyTasks } = input;
    const origin: SessionOrigin = input.origin ?? 'home_start';

    // 1. Credential-critical actions win — and stay inside the journey
    //    section (runner/sheet/claim), so Coach cedes its primary slot.
    if (journeyVisible && journeyAction) {
        if (journeyAction.kind === 'verify_skill') {
            if (journeyAction.skillKey && journeyAction.skillName) {
                // The journey section renders the same Verify CTA; Coach
                // cedes to keep exactly one primary on screen.
                return { kind: 'journey_owned', actionKind: journeyAction.kind };
            }
            // Malformed verify action — fall through to the engine, never
            // invent a skill target.
        } else if (JOURNEY_OWNED_KINDS.has(journeyAction.kind)) {
            return { kind: 'journey_owned', actionKind: journeyAction.kind };
        }
        // 'continue_learning' (or unknown kinds): the engine decides below.
    }

    // 2+3+4. Canonical engine output decides.
    if (recommendation) {
        switch (recommendation.type) {
            case 'prove_skill': {
                // Engine-gated proof: open the server-gated Verify sheet.
                // (When the journey agrees it shows the same CTA there;
                // the sheet itself re-checks server authority on open.)
                if (recommendation.skillKey && recommendation.skillName) {
                    return {
                        kind: 'verify_skill',
                        source: 'credential_verify',
                        skillKey: recommendation.skillKey,
                        skillName: recommendation.skillName,
                        label: `Verify ${truncateTitle(recommendation.skillName, 22)}`,
                    };
                }
                break;
            }
            case 'repair_recall':
            case 'practice_application':
            case 'review_skill': {
                const name = recommendation.skillName
                    ? ` ${truncateTitle(recommendation.skillName, 22)}`
                    : '';
                return {
                    kind: 'session',
                    source: 'remediation',
                    label: `Practice${name}`,
                    route: routeForRecommendation(recommendation, origin),
                    reasonCode: recommendation.reasonCode ?? null,
                };
            }
            case 'continue_curriculum':
            default: {
                if (recommendation.taskId) {
                    return {
                        kind: 'session',
                        source: 'frontier_task',
                        label: 'Start session',
                        route: routeForRecommendation(recommendation, origin),
                        reasonCode: recommendation.reasonCode ?? null,
                    };
                }
                // Engine says continue but names no task: fall to frontier.
                break;
            }
        }
    }

    // 3. Frontier task — the same object Home/Your Day resolve.
    const next = findNextIncompleteTask(
        dailyTasks.map(t => ({ id: t.id ?? null, type: t.type, status: t.status })),
    );
    if (next?.id) {
        const full = dailyTasks.find(t => (t.id ?? null) === next.id);
        return {
            kind: 'session',
            source: 'frontier_task',
            label: 'Start session',
            route: sessionRouteForTask(
                { id: next.id, duration_minutes: full?.duration_minutes ?? null },
                origin,
            ),
            reasonCode: null,
        };
    }

    // 4. Nothing concrete: no primary (info-only secondaries remain).
    return null;
}

/**
 * One-line canonical-action statement embedded into the Coach LLM context.
 * The app has ALREADY decided; the model only explains/encourages it.
 */
export function buildCanonicalActionLine(primary: CoachPrimary): string | null {
    if (!primary) return null;
    if (primary.kind === 'verify_skill') {
        return `Canonical next action (already decided — explain and encourage THIS, do not invent a different activity): verify the skill "${primary.skillName}".`;
    }
    if (primary.kind === 'session') {
        return `Canonical next action (already decided — explain and encourage THIS, do not invent a different activity): ${primary.label} (${primary.source}).`;
    }
    return 'Canonical next action (already decided): continue inside the credential journey section below. Explain and encourage that step; do not invent a different activity.';
}

export default resolveCoachPrimary;
