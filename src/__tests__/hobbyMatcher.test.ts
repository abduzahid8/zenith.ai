import { quizAnswersToProfile, matchHobbies, UserProfile, HobbyMatch } from '../services/hobbyMatcher';

describe('quizAnswersToProfile', () => {
    it('should return base scores (all 5) when no answers provided', () => {
        const profile = quizAnswersToProfile({});
        expect(profile).toEqual({
            mental: 5, creative: 5, physical: 5,
            structure: 5, freedom: 5,
            individual: 5, social: 5,
            quick: 5, long: 5,
        });
    });

    it('should boost mental for analytical user (Q3 = 0)', () => {
        const profile = quizAnswersToProfile({ 3: 0 });
        expect(profile.mental).toBe(8); // 5 base + 3
    });

    it('should boost creative for creative user (Q3 = 1)', () => {
        const profile = quizAnswersToProfile({ 3: 1 });
        expect(profile.creative).toBe(8); // 5 base + 3
    });

    it('should boost physical for physical user (Q3 = 2)', () => {
        const profile = quizAnswersToProfile({ 3: 2 });
        expect(profile.physical).toBe(8); // 5 base + 3
    });

    it('should boost individual for introverts (Q4 = 0)', () => {
        const profile = quizAnswersToProfile({ 4: 0 });
        expect(profile.individual).toBe(8); // 5 base + 3
    });

    it('should boost social for extroverts (Q4 = 2)', () => {
        const profile = quizAnswersToProfile({ 4: 2 });
        expect(profile.social).toBe(8); // 5 base + 3
    });

    it('should cap values at 10', () => {
        // Stack multiple boosts to mental: Q1=2(+0), Q3=0(+3), Q6=1(+1), Q9=0(+2), Q2=2(+1)
        const profile = quizAnswersToProfile({
            1: 2, 2: 2, 3: 0, 5: 2, 6: 1, 9: 0,
        });
        // mental: 5 + 0 + 1 + 3 + 0 + 1 + 2 = 12 → capped to 10
        expect(profile.mental).toBeLessThanOrEqual(10);
        expect(profile.mental).toBeGreaterThanOrEqual(1);
    });

    it('should not go below 1', () => {
        const profile = quizAnswersToProfile({});
        // All axes should remain at base (5), all ≥ 1
        Object.values(profile).forEach(v => {
            expect(v).toBeGreaterThanOrEqual(1);
        });
    });

    it('should produce a complete profile for a full quiz (10 answers)', () => {
        const profile = quizAnswersToProfile({
            1: 0, 2: 1, 3: 0, 4: 0, 5: 2,
            6: 0, 7: 0, 8: 2, 9: 1, 10: 1,
        });

        // All keys present
        const keys = Object.keys(profile);
        expect(keys).toEqual(expect.arrayContaining([
            'mental', 'creative', 'physical',
            'structure', 'freedom',
            'individual', 'social',
            'quick', 'long',
        ]));

        // All values in [1, 10]
        Object.values(profile).forEach(v => {
            expect(v).toBeGreaterThanOrEqual(1);
            expect(v).toBeLessThanOrEqual(10);
        });
    });
});

describe('matchHobbies', () => {
    const mentalProfile: UserProfile = {
        mental: 10, creative: 2, physical: 1,
        structure: 8, freedom: 3,
        individual: 9, social: 2,
        quick: 4, long: 8,
    };

    const creativeProfile: UserProfile = {
        mental: 3, creative: 10, physical: 2,
        structure: 3, freedom: 9,
        individual: 7, social: 4,
        quick: 7, long: 4,
    };

    const physicalProfile: UserProfile = {
        mental: 2, creative: 2, physical: 10,
        structure: 6, freedom: 5,
        individual: 7, social: 4,
        quick: 7, long: 4,
    };

    it('should return the requested number of matches', () => {
        const matches = matchHobbies(mentalProfile, 3);
        expect(matches).toHaveLength(3);

        const matches5 = matchHobbies(mentalProfile, 5);
        expect(matches5).toHaveLength(5);
    });

    it('should return matches sorted by score descending', () => {
        const matches = matchHobbies(mentalProfile, 5);
        for (let i = 0; i < matches.length - 1; i++) {
            expect(matches[i].matchScore).toBeGreaterThanOrEqual(matches[i + 1].matchScore);
        }
    });

    it('should rank chess highly for a mental/analytical profile', () => {
        const matches = matchHobbies(mentalProfile, 5);
        const chessMatch = matches.find((m: HobbyMatch) => m.hobby.id === 'chess');
        expect(chessMatch).toBeDefined();
        // Chess should be in top 3 for a mental profile
        const top3Ids = matches.slice(0, 3).map((m: HobbyMatch) => m.hobby.id);
        expect(top3Ids).toContain('chess');
    });

    it('should rank drawing/design highly for a creative profile', () => {
        const matches = matchHobbies(creativeProfile, 5);
        const top5Ids = matches.map((m: HobbyMatch) => m.hobby.id);
        // Should contain at least one creative hobby
        const creativeHobbies = ['drawing', 'video_editing', 'web_design', 'photography', 'content_creation'];
        const hasCreative = top5Ids.some((id: string) => creativeHobbies.includes(id));
        expect(hasCreative).toBe(true);
    });

    it('should rank physical hobbies highly for a physical profile', () => {
        const matches = matchHobbies(physicalProfile, 5);
        const top5Ids = matches.map((m: HobbyMatch) => m.hobby.id);
        const physicalHobbies = ['home_workout', 'running', 'yoga', 'dancing', 'martial_arts'];
        const hasPhysical = top5Ids.some((id: string) => physicalHobbies.includes(id));
        expect(hasPhysical).toBe(true);
    });

    it('should include matchReasons in each result', () => {
        const matches = matchHobbies(mentalProfile, 3);
        matches.forEach((match: HobbyMatch) => {
            expect(match.matchReasons).toBeDefined();
            expect(Array.isArray(match.matchReasons)).toBe(true);
            expect(match.matchReasons.length).toBeGreaterThan(0);
            expect(match.matchReasons.length).toBeLessThanOrEqual(3);
        });
    });

    it('should produce scores in valid range (0-100)', () => {
        const matches = matchHobbies(mentalProfile, 25);
        matches.forEach((m: HobbyMatch) => {
            expect(m.matchScore).toBeGreaterThanOrEqual(0);
            expect(m.matchScore).toBeLessThanOrEqual(100);
        });
    });
});
