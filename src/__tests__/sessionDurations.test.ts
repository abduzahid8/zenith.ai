import {
    SUPPORTED_SESSION_MINUTES,
    ONBOARDING_DURATION_OPTIONS,
    QUICK_SESSION_OPTIONS,
    TIMER_PICKER_PRESETS,
    normalizePreferredMinutes,
    closestDurationFit,
    isSupportedMinutes,
} from '../domain/sessions/sessionDurations';

describe('sessionDurations catalog (single source of truth)', () => {
    it('derives all option sets from supported minutes', () => {
        for (const m of [...ONBOARDING_DURATION_OPTIONS, ...QUICK_SESSION_OPTIONS, ...TIMER_PICKER_PRESETS]) {
            expect(SUPPORTED_SESSION_MINUTES).toContain(m);
        }
    });

    it('validates supported minutes', () => {
        expect(isSupportedMinutes(15)).toBe(true);
        expect(isSupportedMinutes(7)).toBe(false);
    });

    it('normalizes preferences, mapping unknown values to closest fit', () => {
        expect(normalizePreferredMinutes(null)).toBeNull();
        expect(normalizePreferredMinutes(undefined)).toBeNull();
        expect(normalizePreferredMinutes(30)).toBe(30);
        expect(normalizePreferredMinutes(7)).toBe(5);
    });

    it('picks the largest fitting duration, else the shortest', () => {
        expect(closestDurationFit(15, [5, 10, 15, 30])).toBe(15);
        expect(closestDurationFit(12, [5, 10, 15, 30])).toBe(10);
        expect(closestDurationFit(3, [5, 10, 15])).toBe(5);
    });
});
