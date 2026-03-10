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

type ProfileAxis = keyof UserProfile;

const BASE_PROFILE: UserProfile = {
    mental: 5,
    creative: 5,
    physical: 5,
    structure: 5,
    freedom: 5,
    individual: 5,
    social: 5,
    quick: 5,
    long: 5,
};

const AXIS_WEIGHTS: Record<ProfileAxis, number> = {
    mental: 1.4,
    creative: 1.4,
    physical: 1.4,
    structure: 1.0,
    freedom: 1.0,
    individual: 1.0,
    social: 1.0,
    quick: 0.8,
    long: 0.8,
};

const AXIS_REASON: Record<ProfileAxis, string> = {
    mental: 'Подходит под ваш аналитический стиль',
    creative: 'Соответствует вашему творческому вектору',
    physical: 'Совпадает с вашей потребностью в активности',
    structure: 'Дает понятную и структурированную практику',
    freedom: 'Оставляет пространство для экспериментов',
    individual: 'Комфортно для самостоятельного формата',
    social: 'Хорошо раскрывается в общении с людьми',
    quick: 'Дает быстрые и заметные результаты',
    long: 'Подходит для долгосрочного развития навыка',
};

function clampScore(value: number): number {
    return Math.max(1, Math.min(10, value));
}

function add(profile: UserProfile, axis: ProfileAxis, delta: number): void {
    profile[axis] = clampScore(profile[axis] + delta);
}

// Converts quiz answers into profile axes used by the matcher.
export function quizAnswersToProfile(answers: Record<number, number>): UserProfile {
    const profile: UserProfile = { ...BASE_PROFILE };

    const applyQuestion = (question: number, option: number | undefined) => {
        if (option === undefined) return;

        switch (question) {
            case 1:
                if (option === 0) {
                    add(profile, 'mental', 2);
                    add(profile, 'structure', 1);
                    add(profile, 'long', 1);
                } else if (option === 1) {
                    add(profile, 'mental', 1);
                    add(profile, 'creative', 1);
                    add(profile, 'structure', 1);
                } else {
                    add(profile, 'physical', 1);
                    add(profile, 'freedom', 1);
                    add(profile, 'quick', 1);
                }
                break;
            case 2:
                if (option === 0) {
                    add(profile, 'mental', 1);
                    add(profile, 'structure', 1);
                } else if (option === 1) {
                    add(profile, 'mental', 1);
                    add(profile, 'creative', 1);
                } else {
                    add(profile, 'physical', 1);
                    add(profile, 'quick', 1);
                }
                break;
            case 3:
                if (option === 0) {
                    add(profile, 'mental', 3);
                } else if (option === 1) {
                    add(profile, 'creative', 3);
                } else {
                    add(profile, 'physical', 3);
                }
                break;
            case 4:
                if (option === 0) {
                    add(profile, 'individual', 3);
                } else if (option === 2) {
                    add(profile, 'social', 3);
                }
                break;
            case 5:
                if (option === 0) {
                    add(profile, 'structure', 2);
                    add(profile, 'mental', 1);
                } else if (option === 1) {
                    add(profile, 'mental', 1);
                    add(profile, 'long', 1);
                } else {
                    add(profile, 'freedom', 1);
                    add(profile, 'physical', 1);
                    add(profile, 'quick', 1);
                }
                break;
            case 6:
                if (option === 0) {
                    add(profile, 'mental', 2);
                    add(profile, 'structure', 1);
                } else if (option === 1) {
                    add(profile, 'mental', 1);
                    add(profile, 'long', 1);
                } else {
                    add(profile, 'physical', 1);
                    add(profile, 'quick', 1);
                    add(profile, 'freedom', 1);
                }
                break;
            case 7:
                if (option === 0) {
                    add(profile, 'mental', 1);
                    add(profile, 'structure', 1);
                    add(profile, 'long', 1);
                } else if (option === 1) {
                    add(profile, 'mental', 1);
                    add(profile, 'individual', 1);
                } else {
                    add(profile, 'quick', 1);
                    add(profile, 'physical', 1);
                }
                break;
            case 8:
                if (option === 0) {
                    add(profile, 'mental', 2);
                    add(profile, 'structure', 1);
                } else if (option === 1) {
                    add(profile, 'creative', 1);
                    add(profile, 'social', 1);
                } else {
                    add(profile, 'quick', 1);
                    add(profile, 'individual', 1);
                }
                break;
            case 9:
                if (option === 0) {
                    add(profile, 'mental', 1);
                    add(profile, 'structure', 2);
                } else if (option === 1) {
                    add(profile, 'mental', 1);
                    add(profile, 'long', 1);
                } else {
                    add(profile, 'freedom', 2);
                    add(profile, 'quick', 1);
                    add(profile, 'creative', 1);
                }
                break;
            case 10:
                if (option === 0) {
                    add(profile, 'mental', 1);
                    add(profile, 'structure', 1);
                } else if (option === 1) {
                    add(profile, 'creative', 1);
                    add(profile, 'social', 1);
                } else {
                    add(profile, 'physical', 1);
                    add(profile, 'quick', 1);
                }
                break;
        }
    };

    for (let question = 1; question <= 10; question += 1) {
        applyQuestion(question, answers[question]);
    }

    return profile;
}

function isUserProfile(value: unknown): value is UserProfile {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Record<string, unknown>;
    return (
        typeof candidate.mental === 'number' &&
        typeof candidate.creative === 'number' &&
        typeof candidate.physical === 'number' &&
        typeof candidate.structure === 'number' &&
        typeof candidate.freedom === 'number' &&
        typeof candidate.individual === 'number' &&
        typeof candidate.social === 'number' &&
        typeof candidate.quick === 'number' &&
        typeof candidate.long === 'number'
    );
}

function getMatchScore(userProfile: UserProfile, hobby: Hobby): number {
    const axes = Object.keys(AXIS_WEIGHTS) as ProfileAxis[];
    const maxDistance = axes.reduce((acc, axis) => acc + 9 * AXIS_WEIGHTS[axis], 0);
    const distance = axes.reduce(
        (acc, axis) => acc + Math.abs(userProfile[axis] - hobby.profile[axis]) * AXIS_WEIGHTS[axis],
        0,
    );

    return Math.max(0, Math.min(100, Math.round(((maxDistance - distance) / maxDistance) * 100)));
}

function getMatchReasons(userProfile: UserProfile, hobby: Hobby): string[] {
    const axes = (Object.keys(AXIS_WEIGHTS) as ProfileAxis[])
        .map((axis) => ({
            axis,
            diff: Math.abs(userProfile[axis] - hobby.profile[axis]),
        }))
        .sort((a, b) => a.diff - b.diff);

    const reasons: string[] = [];

    for (const { axis } of axes) {
        if (reasons.length >= 2) break;
        reasons.push(AXIS_REASON[axis]);
    }

    for (const baseReason of hobby.whyFitsYou) {
        if (reasons.length >= 3) break;
        reasons.push(baseReason);
    }

    return reasons.slice(0, 3);
}

export function matchHobbies(answersOrProfile: Record<number, number> | UserProfile, count: number = 3): HobbyMatch[] {
    const profile = isUserProfile(answersOrProfile)
        ? answersOrProfile
        : quizAnswersToProfile(answersOrProfile || {});

    const matches = HOBBIES_DATABASE.map((hobby) => ({
        hobby,
        matchScore: getMatchScore(profile, hobby),
        matchReasons: getMatchReasons(profile, hobby),
    })).sort((a, b) => b.matchScore - a.matchScore);

    const safeCount = Math.max(1, Math.min(count, matches.length));
    return matches.slice(0, safeCount);
}

export default matchHobbies;
