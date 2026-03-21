import { quizAnswersToProfile, matchHobbies, HobbyMatch } from '../services/hobbyMatcher';

// All-A answers → strong Python/Chess signal
const allAAnswers: Record<number, number> = {
    1: 0, 2: 0, 3: 0, 4: 0, 5: 0,
    6: 0, 7: 0, 8: 0, 9: 0, 10: 0,
};

// All-B answers → strong English/Chinese/Reading signal
const allBAnswers: Record<number, number> = {
    1: 1, 2: 1, 3: 1, 4: 1, 5: 1,
    6: 1, 7: 1, 8: 1, 9: 1, 10: 1,
};

describe('quizAnswersToProfile (legacy)', () => {
    it('should return base scores (all 5) when no answers provided', () => {
        const profile = quizAnswersToProfile({});
        expect(profile).toEqual({
            mental: 5, creative: 5, physical: 5,
            structure: 5, freedom: 5,
            individual: 5, social: 5,
            quick: 5, long: 5,
        });
    });

    it('should produce a complete profile with all required keys', () => {
        const profile = quizAnswersToProfile({
            1: 0, 2: 1, 3: 0, 4: 0, 5: 2,
            6: 0, 7: 0, 8: 2, 9: 1, 10: 1,
        });

        expect(Object.keys(profile)).toEqual(expect.arrayContaining([
            'mental', 'creative', 'physical',
            'structure', 'freedom',
            'individual', 'social',
            'quick', 'long',
        ]));

        Object.values(profile).forEach(v => {
            expect(v).toBeGreaterThanOrEqual(1);
            expect(v).toBeLessThanOrEqual(10);
        });
    });
});

describe('matchHobbies', () => {
    it('should return the requested number of matches', () => {
        const matches = matchHobbies(allAAnswers, 3);
        expect(matches).toHaveLength(3);

        const matches5 = matchHobbies(allAAnswers, 5);
        expect(matches5).toHaveLength(5);
    });

    it('should return matches sorted by score descending', () => {
        const matches = matchHobbies(allAAnswers, 5);
        for (let i = 0; i < matches.length - 1; i++) {
            expect(matches[i].matchScore).toBeGreaterThanOrEqual(matches[i + 1].matchScore);
        }
    });

    it('should rank chess/python highly for all-A (logical/structured) answers', () => {
        const matches = matchHobbies(allAAnswers, 5);
        const top2Ids = matches.slice(0, 2).map((m: HobbyMatch) => m.hobby.id);
        const hasLogical = top2Ids.some((id: string) => ['chess', 'python'].includes(id));
        expect(hasLogical).toBe(true);
    });

    it('should rank english/chinese/reading highly for all-B (language/reading) answers', () => {
        const matches = matchHobbies(allBAnswers, 5);
        const top3Ids = matches.slice(0, 3).map((m: HobbyMatch) => m.hobby.id);
        const hasLanguage = top3Ids.some((id: string) => ['english', 'chinese', 'reading'].includes(id));
        expect(hasLanguage).toBe(true);
    });

    it('should include matchReasons in each result', () => {
        const matches = matchHobbies(allAAnswers, 3);
        matches.forEach((match: HobbyMatch) => {
            expect(match.matchReasons).toBeDefined();
            expect(Array.isArray(match.matchReasons)).toBe(true);
            expect(match.matchReasons.length).toBeGreaterThan(0);
            expect(match.matchReasons.length).toBeLessThanOrEqual(3);
        });
    });

    it('should produce scores in valid range (0-100)', () => {
        const matches = matchHobbies(allAAnswers, 5);
        matches.forEach((m: HobbyMatch) => {
            expect(m.matchScore).toBeGreaterThanOrEqual(0);
            expect(m.matchScore).toBeLessThanOrEqual(100);
        });
    });

    it('should handle empty answers and return results', () => {
        const matches = matchHobbies({}, 3);
        expect(matches).toHaveLength(3);
        matches.forEach((m: HobbyMatch) => {
            expect(m.matchScore).toBeGreaterThanOrEqual(0);
        });
    });
});
