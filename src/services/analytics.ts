/**
 * Lightweight product analytics shim.
 *
 * No third-party analytics SDK is integrated yet, so this module provides
 * the single logging surface all new features must use. When a real
 * provider (Amplitude/Mixpanel/PostHog/…) is added, only this file changes.
 */

export type AnalyticsEventName =
    | 'onboarding_goal_selected'
    | 'preferred_session_minutes_selected'
    | 'experience_level_selected'
    | 'onboarding_extended_completed'
    | 'quick_session_duration_selected'
    | 'quick_session_recommended'
    | 'quick_session_started'
    | 'quick_session_skipped'
    | 'learning_path_started'
    | 'learning_path_continued'
    | 'module_started'
    | 'module_completed'
    | 'session_started'
    | 'session_completed'
    | 'project_submitted'
    | 'project_passed'
    | 'assessment_started'
    | 'assessment_completed'
    | 'assessment_passed'
    | 'assessment_failed'
    | 'credential_earned'
    | 'credential_shared';

type EventProps = Record<string, string | number | boolean | string[] | null | undefined>;

const listeners = new Set<(event: AnalyticsEventName, props?: EventProps) => void>();

/** Subscribe a real provider later without touching call sites. */
export function addAnalyticsListener(
    listener: (event: AnalyticsEventName, props?: EventProps) => void,
): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function logEvent(event: AnalyticsEventName, props?: EventProps): void {
    try {
        console.log(`[analytics] ${event}`, props ?? '');
    } catch {
        // logging must never break product flows
    }
    listeners.forEach((listener) => {
        try {
            listener(event, props);
        } catch {
            // one bad listener must not affect others
        }
    });
}

export const analytics = { logEvent, addAnalyticsListener };
export default analytics;
