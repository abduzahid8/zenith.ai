import { Hobby, HOBBIES_DATABASE } from '../data/hobbies';

export interface HobbyMatch {
    hobby: Hobby;
    matchScore: number;
    matchReasons: string[];
}

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

export function quizAnswersToProfile(answers: Record<number, number>): UserProfile {
    return {
        mental: 5, creative: 5, physical: 5,
        structure: 5, freedom: 5, individual: 5,
        social: 5, quick: 5, long: 5,
    };
}

const HOBBY_MAPPINGS: Record<string, number[][]> = {
    programming: [ // Python
        [3, 0, 2], [3, 0, 2], [3, 0, 2], [1, 0, 3], [3, 0, 2],
        [2, 0, 3], [3, 1, 1], [3, 0, 1], [3, 0, 2], [3, 0, 2]
    ],
    english: [ // English
        [0, 3, 1], [1, 3, 1], [0, 3, 1], [0, 3, 1], [0, 3, 1],
        [1, 3, 0], [2, 1, 2], [0, 3, 0], [0, 3, 1], [0, 3, 1]
    ],
    speed_reading: [ // Reading
        [0, 3, 0], [0, 3, 1], [0, 3, 0], [0, 3, 0], [0, 3, 0],
        [0, 3, 0], [1, 2, 2], [0, 1, 2], [0, 3, 0], [0, 3, 0]
    ],
    chess: [ // Chess
        [3, 0, 1], [3, 0, 1], [3, 0, 1], [3, 0, 1], [3, 0, 1],
        [3, 1, 0], [1, 3, 1], [1, 0, 3], [3, 0, 1], [3, 0, 1]
    ],
    languages: [ // Chinese
        [0, 3, 1], [1, 3, 1], [0, 3, 1], [0, 3, 1], [0, 3, 1],
        [1, 3, 0], [2, 1, 2], [0, 3, 0], [0, 3, 1], [0, 3, 1]
    ]
};

export function matchHobbies(answersOrProfile: any, count: number = 3): HobbyMatch[] {
    let realAnswers: Record<number, number> = {};
    if (answersOrProfile && 'mental' in answersOrProfile) {
        return [];
    } else {
        realAnswers = answersOrProfile;
    }

    const matches: HobbyMatch[] = [];

    for (const hobbyId of Object.keys(HOBBY_MAPPINGS)) {
        const weights = HOBBY_MAPPINGS[hobbyId];
        let score = 0;

        for (let q = 1; q <= 10; q++) {
            const answerIndex = realAnswers[q];
            if (answerIndex !== undefined && weights[q - 1]) {
                score += weights[q - 1][answerIndex] || 0;
            }
        }

        const hobbyObj = HOBBIES_DATABASE.find(h => h.id === hobbyId);
        if (hobbyObj) {
            matches.push({
                hobby: hobbyObj,
                matchScore: score,
                matchReasons: hobbyObj.whyFitsYou.slice(0, 3)
            });
        }
    }

    matches.sort((a, b) => b.matchScore - a.matchScore);

    return matches.slice(0, count);
}

export default matchHobbies;
