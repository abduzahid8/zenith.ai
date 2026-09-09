/**
 * Canonical enrollment anchor (A+B).
 *
 * Single source of truth for curriculum-day attribution:
 * 1. credential enrollment flag + enrolledAt
 * 2. normalized to YYYY-MM-DD
 * 3. not enrolled -> null (no anchor, no fabricated progress)
 * 4. NEVER fall back to the task date (no silent day-1 mapping)
 * 5. NEVER fall back to today in downstream functions
 *
 * Scoring, weights, gates and completion rules are untouched — this only
 * decides WHICH anchor date attribution uses (or none).
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function canonicalAnchorForEnrollment(
    enrolled: boolean,
    enrolledAt: string | null | undefined,
): string | null {
    if (!enrolled) return null;
    if (!enrolledAt) return null;
    const day = enrolledAt.slice(0, 10);
    if (!DATE_RE.test(day)) return null;
    return day;
}

/** Back-compat alias — same canonical rule, explicit name. */
export const anchorFor = canonicalAnchorForEnrollment;

export default canonicalAnchorForEnrollment;
