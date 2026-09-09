import {
    normalizeGoals,
    normalizeExperiencePreference,
    goalAffinityBonus,
    MAX_GOALS,
} from '../domain/onboarding/goals';

describe('onboarding goals validation', () => {
    it('accepts valid goal ids and drops unknown values', () => {
        expect(normalizeGoals(['learn_skills', 'bogus', 42, null])).toEqual(['learn_skills']);
    });

    it('dedupes and caps at MAX_GOALS', () => {
        const input = [
            'learn_skills', 'grow_professionally', 'discover_hobbies',
            'become_creative', 'improve_focus', 'build_habits',
            'prepare_career', 'learn_skills',
        ];
        const normalized = normalizeGoals(input);
        expect(normalized).toHaveLength(MAX_GOALS);
        expect(new Set(normalized).size).toBe(MAX_GOALS);
    });

    it('returns [] for non-array input', () => {
        expect(normalizeGoals(undefined)).toEqual([]);
        expect(normalizeGoals('learn_skills')).toEqual([]);
    });

    it('validates experience preference', () => {
        expect(normalizeExperiencePreference('from_zero')).toBe('from_zero');
        expect(normalizeExperiencePreference('expert')).toBeNull();
        expect(normalizeExperiencePreference(null)).toBeNull();
    });

    it('caps affinity bonus so quiz answers stay primary', () => {
        const bonus = goalAffinityBonus(
            ['learn_skills', 'grow_professionally', 'prepare_career'],
            'python',
        );
        expect(bonus).toBeLessThanOrEqual(8);
        expect(goalAffinityBonus([], 'python')).toBe(0);
        expect(goalAffinityBonus(['improve_focus'], 'unknown_hobby')).toBe(0);
    });
});
