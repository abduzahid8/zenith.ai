/**
 * Single source of truth for session durations across Zenyth.
 *
 * Previously durations were hardcoded in several places:
 * - TimePickerModal PRESETS [10,20,30,45,60,90]
 * - taskEngine task durations 15/30/20/20
 * - onboarding / quick-session specs reference `supportedMinutes`
 *
 * All duration UI must derive from this module — do not introduce
 * a second independent duration configuration.
 */

/** Every session length the product can schedule or adapt to (minutes). */
export const SUPPORTED_SESSION_MINUTES: readonly number[] = [5, 10, 15, 20, 30, 45, 60, 90];

/** Options shown during onboarding ("How much time do you usually have?"). */
export const ONBOARDING_DURATION_OPTIONS: readonly number[] = [5, 10, 15, 30, 45, 60];

/** Compact chips shown on Home Quick Session ("How much time do you have?"). */
export const QUICK_SESSION_OPTIONS: readonly number[] = [5, 15, 30, 45];

/** Presets for the in-session timer picker (full range incl. long sessions). */
export const TIMER_PICKER_PRESETS: readonly number[] = [10, 20, 30, 45, 60, 90];

/** Maximum minutes a recommendation may exceed the available time and still count as an adaptation. */
export const DURATION_OVERRUN_TOLERANCE_MIN = 5;

export function isSupportedMinutes(minutes: number): boolean {
    return SUPPORTED_SESSION_MINUTES.includes(minutes);
}

/**
 * Normalize a possibly-unknown preference to a supported value.
 * Returns null when input is missing so callers can apply their own default.
 */
export function normalizePreferredMinutes(minutes: number | null | undefined): number | null {
    if (minutes === null || minutes === undefined) return null;
    if (isSupportedMinutes(minutes)) return minutes;
    return closestDurationFit(minutes, [...SUPPORTED_SESSION_MINUTES]);
}

/**
 * Closest supported duration that does not exceed `availableMinutes`.
 * Falls back to the shortest supported duration when nothing fits.
 */
export function closestDurationFit(availableMinutes: number, durations: readonly number[]): number {
    const fitting = durations.filter((d) => d <= availableMinutes);
    if (fitting.length > 0) return Math.max(...fitting);
    return Math.min(...durations);
}

export function formatMinutes(minutes: number, plusForLast = false): string {
    return plusForLast ? `${minutes}+ min` : `${minutes} min`;
}
