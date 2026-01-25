// Hobby Matching Algorithm
// Matches user quiz profile to hobby profiles

import { HobbyProfile, Hobby, HOBBIES_DATABASE } from '../data/hobbies';

// User profile derived from quiz answers
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

// Match result with score and reasons
export interface HobbyMatch {
    hobby: Hobby;
    matchScore: number; // 0-100
    matchReasons: string[];
}

// Calculate similarity between user profile and hobby profile
function calculateMatchScore(userProfile: UserProfile, hobbyProfile: HobbyProfile): number {
    const dimensions: (keyof HobbyProfile)[] = [
        'mental', 'creative', 'physical',
        'structure', 'freedom',
        'individual', 'social',
        'quick', 'long'
    ];

    let totalScore = 0;
    let maxPossibleScore = 0;

    for (const dim of dimensions) {
        const userValue = userProfile[dim];
        const hobbyValue = hobbyProfile[dim];

        // Calculate weighted match (higher hobby scores matter more)
        const weight = hobbyValue / 10; // Hobby importance for this dimension
        const match = 10 - Math.abs(userValue - hobbyValue); // How close the match is

        totalScore += match * weight;
        maxPossibleScore += 10 * weight;
    }

    // Convert to percentage
    return Math.round((totalScore / maxPossibleScore) * 100);
}

// Generate match reasons based on profile overlap
function generateMatchReasons(userProfile: UserProfile, hobby: Hobby): string[] {
    const reasons: string[] = [];
    const profile = hobby.profile;

    // Check dominant user traits and how hobby matches
    if (userProfile.mental >= 6 && profile.mental >= 7) {
        reasons.push('Подходит для аналитического склада ума');
    }
    if (userProfile.creative >= 6 && profile.creative >= 7) {
        reasons.push('Раскроет твой творческий потенциал');
    }
    if (userProfile.physical >= 6 && profile.physical >= 7) {
        reasons.push('Даёт физическую активность');
    }
    if (userProfile.structure >= 6 && profile.structure >= 6) {
        reasons.push('Есть чёткая структура обучения');
    }
    if (userProfile.freedom >= 6 && profile.freedom >= 6) {
        reasons.push('Свобода для экспериментов');
    }
    if (userProfile.individual >= 7 && profile.individual >= 7) {
        reasons.push('Можно заниматься в одиночку');
    }
    if (userProfile.quick >= 6 && profile.quick >= 6) {
        reasons.push('Быстрый видимый результат');
    }
    if (userProfile.long >= 6 && profile.long >= 6) {
        reasons.push('Глубокое развитие навыка');
    }

    // Always include at least the hobby's own reasons
    if (reasons.length < 2) {
        return hobby.whyFitsYou.slice(0, 3);
    }

    return reasons.slice(0, 3);
}

// Main matching function - returns top 3 hobbies
export function matchHobbies(userProfile: UserProfile, count: number = 3): HobbyMatch[] {
    const matches: HobbyMatch[] = HOBBIES_DATABASE.map(hobby => ({
        hobby,
        matchScore: calculateMatchScore(userProfile, hobby.profile),
        matchReasons: generateMatchReasons(userProfile, hobby),
    }));

    // Sort by match score descending
    matches.sort((a, b) => b.matchScore - a.matchScore);

    // Return top matches
    return matches.slice(0, count);
}

// Convert quiz answers to user profile
// Each question maps to specific axes
export function quizAnswersToProfile(answers: Record<number, number>): UserProfile {
    // Initialize profile with base scores
    const profile: UserProfile = {
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

    // Question 1: How do you feel at end of day?
    // 0: Tired, overloaded → low energy, needs calm
    // 1: Okay but wasted → needs structure
    // 2: Have energy, don't know where → needs direction
    if (answers[1] === 0) { profile.mental += 2; profile.quick += 1; }
    if (answers[1] === 1) { profile.structure += 2; profile.long += 1; }
    if (answers[1] === 2) { profile.freedom += 2; profile.creative += 1; }

    // Question 2: When free time appears...
    // 0: Grab phone → needs easy start
    // 1: Want useful but procrastinate → needs structure
    // 2: Know what I want → self-directed
    if (answers[2] === 0) { profile.quick += 2; profile.freedom += 1; }
    if (answers[2] === 1) { profile.structure += 2; profile.individual += 1; }
    if (answers[2] === 2) { profile.long += 2; profile.mental += 1; }

    // Question 3: What comes easiest?
    // 0: Thinking, analyzing → mental
    // 1: Creating, visualizing → creative
    // 2: Doing physically → physical
    if (answers[3] === 0) { profile.mental += 3; }
    if (answers[3] === 1) { profile.creative += 3; }
    if (answers[3] === 2) { profile.physical += 3; }

    // Question 4: Introvert / Extrovert
    // 0: Introvert → individual
    // 1: Ambivert → balanced
    // 2: Extrovert → social
    if (answers[4] === 0) { profile.individual += 3; }
    if (answers[4] === 1) { profile.individual += 1; profile.social += 1; }
    if (answers[4] === 2) { profile.social += 3; }

    // Question 5: Complex tasks
    // 0: Avoid → quick results
    // 1: Endure if meaningful → balanced
    // 2: Love challenges → long path
    if (answers[5] === 0) { profile.quick += 2; profile.freedom += 1; }
    if (answers[5] === 1) { profile.structure += 1; profile.long += 1; }
    if (answers[5] === 2) { profile.long += 3; }

    // Question 6: What motivates you?
    // 0: Visible progress → quick
    // 1: Sense of meaning → long
    // 2: Result to show → social, quick
    if (answers[6] === 0) { profile.quick += 2; profile.structure += 1; }
    if (answers[6] === 1) { profile.long += 2; profile.mental += 1; }
    if (answers[6] === 2) { profile.social += 2; profile.quick += 1; }

    // Question 7: Format preference
    // 0: Clear plan → structure
    // 1: Freedom + recommendations → freedom
    // 2: Mini-tasks → quick, freedom
    if (answers[7] === 0) { profile.structure += 3; }
    if (answers[7] === 1) { profile.freedom += 2; profile.structure += 1; }
    if (answers[7] === 2) { profile.freedom += 2; profile.quick += 1; }

    // Question 8: When to see result?
    // 0: In a week → quick
    // 1: In a month → balanced
    // 2: Process matters → long
    if (answers[8] === 0) { profile.quick += 3; }
    if (answers[8] === 1) { profile.quick += 1; profile.long += 1; }
    if (answers[8] === 2) { profile.long += 3; }

    // Question 9: What to upgrade?
    // 0: Concentration → mental
    // 1: Skill/profession → mental, long
    // 2: Self-confidence → physical, social
    if (answers[9] === 0) { profile.mental += 2; profile.individual += 1; }
    if (answers[9] === 1) { profile.mental += 1; profile.long += 2; }
    if (answers[9] === 2) { profile.physical += 1; profile.social += 2; }

    // Question 10: Time per day?
    // 0: 30-45 min → quick
    // 1: 1-2 hours → balanced
    // 2: More when into it → long
    if (answers[10] === 0) { profile.quick += 2; }
    if (answers[10] === 1) { profile.quick += 1; profile.long += 1; }
    if (answers[10] === 2) { profile.long += 2; }

    // Normalize all values to 1-10 range
    Object.keys(profile).forEach(key => {
        const k = key as keyof UserProfile;
        profile[k] = Math.max(1, Math.min(10, profile[k]));
    });

    return profile;
}

export default matchHobbies;
