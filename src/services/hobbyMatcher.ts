import { Hobby, HOBBIES_DATABASE } from '../data/hobbies';
import { goalAffinityBonus, UserGoalId } from '../domain/onboarding/goals';

export interface HobbyMatch {
    hobby: Hobby;
    matchScore: number;
    matchReasons: string[];
}

// Legacy type kept for test compatibility
export interface UserProfile {
    mental: number;
    creative: number;
    physical: number;
    structure: number;
    freedom: number;
    individual: number;
    social: number;
    quick: number;
    long: number;
}

// Scoring table from algorithm file.
// Outer key = hobby id, inner array = 10 questions × [scoreA, scoreB, scoreC]
// A=index 0, B=index 1, C=index 2
const HOBBY_SCORE_TABLE: Record<string, [number, number, number][]> = {
    python: [
        [3, 0, 2], // Q1
        [3, 0, 2], // Q2
        [3, 0, 2], // Q3
        [1, 0, 3], // Q4
        [3, 0, 2], // Q5
        [2, 0, 3], // Q6
        [3, 1, 1], // Q7
        [3, 0, 1], // Q8
        [3, 0, 2], // Q9
        [3, 0, 2], // Q10
    ],
    english: [
        [0, 3, 1], // Q1
        [1, 3, 1], // Q2
        [0, 3, 1], // Q3
        [0, 3, 1], // Q4
        [0, 3, 1], // Q5
        [1, 3, 0], // Q6
        [2, 1, 2], // Q7
        [0, 3, 0], // Q8
        [0, 3, 1], // Q9
        [0, 3, 1], // Q10
    ],
    reading: [
        [0, 3, 0], // Q1
        [0, 3, 1], // Q2
        [0, 3, 0], // Q3
        [0, 3, 0], // Q4
        [0, 3, 0], // Q5
        [0, 3, 0], // Q6
        [1, 2, 2], // Q7
        [0, 1, 2], // Q8
        [0, 3, 0], // Q9
        [0, 3, 0], // Q10
    ],
    chess: [
        [3, 0, 1], // Q1
        [3, 0, 1], // Q2
        [3, 0, 1], // Q3
        [3, 0, 1], // Q4
        [3, 0, 1], // Q5
        [3, 1, 0], // Q6
        [1, 3, 1], // Q7
        [1, 0, 3], // Q8
        [3, 0, 1], // Q9
        [3, 0, 1], // Q10
    ],
    chinese: [
        [0, 3, 1], // Q1
        [1, 3, 1], // Q2
        [0, 3, 1], // Q3
        [0, 3, 1], // Q4
        [0, 3, 1], // Q5
        [1, 3, 0], // Q6
        [2, 1, 2], // Q7
        [0, 3, 0], // Q8
        [0, 3, 1], // Q9
        [0, 3, 1], // Q10
    ],
};

const MAX_SCORE_PER_HOBBY = 30; // 10 questions × max 3 pts each

function getRawScore(hobbyId: string, answers: Record<number, number>): number {
    const table = HOBBY_SCORE_TABLE[hobbyId];
    if (!table) return 0;

    let total = 0;
    for (let q = 1; q <= 10; q++) {
        const option = answers[q];
        if (option !== undefined && option >= 0 && option <= 2) {
            total += table[q - 1][option];
        }
    }
    return total;
}

function toPercent(raw: number): number {
    return Math.round((raw / MAX_SCORE_PER_HOBBY) * 100);
}

export function matchHobbies(
    answers: Record<number, number>,
    count: number = 3,
    goals: readonly UserGoalId[] = [],
): HobbyMatch[] {
    const scoredHobbies = HOBBIES_DATABASE
        .filter((hobby) => HOBBY_SCORE_TABLE[hobby.id] !== undefined)
        .map((hobby) => {
            const raw = getRawScore(hobby.id, answers);
            // Goals only bias the recommendation; quiz answers stay primary.
            const bonus = goals.length > 0 ? goalAffinityBonus(goals, hobby.id) : 0;
            return {
                hobby,
                matchScore: Math.min(100, toPercent(raw) + bonus),
                matchReasons: hobby.whyFitsYou.slice(0, 3),
            };
        })
        .sort((a, b) => b.matchScore - a.matchScore);

    const safeCount = Math.max(1, Math.min(count, scoredHobbies.length));
    return scoredHobbies.slice(0, safeCount);
}

// Legacy export kept for backward compatibility with existing tests
export function quizAnswersToProfile(answers: Record<number, number>): UserProfile {
    const base = 5;
    const get = (q: number) => answers[q];

    const mental =
        base +
        (get(1) === 0 ? 2 : get(1) === 1 ? 1 : 0) +
        (get(2) === 0 ? 1 : get(2) === 1 ? 1 : 0) +
        (get(3) === 0 ? 3 : 0) +
        (get(5) === 0 ? 1 : get(5) === 1 ? 1 : 0) +
        (get(6) === 0 ? 2 : get(6) === 1 ? 1 : 0) +
        (get(7) === 0 ? 1 : get(7) === 1 ? 1 : 0) +
        (get(8) === 0 ? 2 : 0) +
        (get(9) === 0 ? 1 : get(9) === 1 ? 1 : 0) +
        (get(10) === 0 ? 1 : 0);

    const creative =
        base +
        (get(1) === 1 ? 1 : 0) +
        (get(2) === 1 ? 1 : 0) +
        (get(3) === 1 ? 3 : 0) +
        (get(8) === 1 ? 1 : 0) +
        (get(9) === 2 ? 1 : 0) +
        (get(10) === 1 ? 1 : 0);

    const physical =
        base +
        (get(1) === 2 ? 1 : 0) +
        (get(2) === 2 ? 1 : 0) +
        (get(3) === 2 ? 3 : 0) +
        (get(5) === 2 ? 1 : 0) +
        (get(6) === 2 ? 1 : 0) +
        (get(7) === 2 ? 1 : 0) +
        (get(10) === 2 ? 1 : 0);

    const structure =
        base +
        (get(1) === 0 ? 1 : 0) +
        (get(1) === 1 ? 1 : 0) +
        (get(2) === 0 ? 1 : 0) +
        (get(5) === 0 ? 2 : 0) +
        (get(6) === 0 ? 1 : 0) +
        (get(7) === 0 ? 1 : 0) +
        (get(8) === 0 ? 1 : 0) +
        (get(9) === 0 ? 2 : 0) +
        (get(10) === 0 ? 1 : 0);

    const freedom =
        base +
        (get(1) === 2 ? 1 : 0) +
        (get(5) === 2 ? 1 : 0) +
        (get(6) === 2 ? 1 : 0) +
        (get(9) === 2 ? 2 : 0);

    const individual =
        base +
        (get(4) === 0 ? 3 : 0) +
        (get(7) === 1 ? 1 : 0) +
        (get(8) === 2 ? 1 : 0);

    const social =
        base +
        (get(4) === 2 ? 3 : 0) +
        (get(8) === 1 ? 1 : 0) +
        (get(10) === 1 ? 1 : 0);

    const quick =
        base +
        (get(1) === 2 ? 1 : 0) +
        (get(2) === 2 ? 1 : 0) +
        (get(5) === 2 ? 1 : 0) +
        (get(6) === 2 ? 1 : 0) +
        (get(7) === 2 ? 1 : 0) +
        (get(8) === 2 ? 1 : 0) +
        (get(9) === 2 ? 1 : 0) +
        (get(10) === 2 ? 1 : 0);

    const long =
        base +
        (get(1) === 0 ? 1 : 0) +
        (get(5) === 1 ? 1 : 0) +
        (get(6) === 1 ? 1 : 0) +
        (get(7) === 0 ? 1 : 0) +
        (get(9) === 1 ? 1 : 0);

    const clamp = (v: number) => Math.max(1, Math.min(10, v));

    return {
        mental: clamp(mental),
        creative: clamp(creative),
        physical: clamp(physical),
        structure: clamp(structure),
        freedom: clamp(freedom),
        individual: clamp(individual),
        social: clamp(social),
        quick: clamp(quick),
        long: clamp(long),
    };
}

export default matchHobbies;
