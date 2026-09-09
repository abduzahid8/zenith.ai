/**
 * Skill XP — the gamified progression behind Verified Credentials.
 *
 * Same philosophy as the session's gamification (streaks + checklist +
 * badges, no grindy numbers on every screen): XP is DERIVED from credential
 * state, never stored. Everything the learner does in the normal chain
 * earns it automatically:
 *
 *   enroll +20 · correct assessment answer +10 · final pass +150
 *   project submitted +100 · credential issued +300
 */

export const XP_ENROLL = 20;
export const XP_CORRECT_ANSWER = 10;
export const XP_FINAL_PASS = 150;
export const XP_PROJECT = 100;
export const XP_ISSUED = 300;

export const LEVEL_THRESHOLDS = [0, 100, 250, 500, 1000, 1750, 2750, 4500];

export const LEVEL_TITLES = [
    'Novice',
    'Apprentice',
    'Challenger',
    'Skilled',
    'Expert',
    'Master',
    'Legend',
    'Grandmaster',
];

export interface XpInput {
    enrolled: boolean;
    correctAnswers: number;
    finalPassed: boolean;
    projectSubmitted: boolean;
    issued: boolean;
}

export function computeSkillXp(input: XpInput): number {
    let xp = 0;
    if (input.enrolled) xp += XP_ENROLL;
    xp += Math.max(0, input.correctAnswers) * XP_CORRECT_ANSWER;
    if (input.finalPassed) xp += XP_FINAL_PASS;
    if (input.projectSubmitted) xp += XP_PROJECT;
    if (input.issued) xp += XP_ISSUED;
    return xp;
}

export interface SkillLevel {
    level: number;
    title: string;
    /** XP at the start of this level */
    levelMin: number;
    /** XP needed for the next level, null at max */
    nextLevelMin: number | null;
    /** 0..1 progress toward the next level (1 at max) */
    progressToNext: number;
    /** XP remaining to level up, 0 at max */
    xpToNext: number;
}

export function levelForXp(xp: number): SkillLevel {
    const clamped = Math.max(0, Math.floor(xp));
    let level = 1;
    for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
        if (clamped >= LEVEL_THRESHOLDS[i]) level = i + 1;
    }
    const levelMin = LEVEL_THRESHOLDS[level - 1];
    const nextLevelMin = level < LEVEL_THRESHOLDS.length ? LEVEL_THRESHOLDS[level] : null;
    const progressToNext =
        nextLevelMin === null ? 1 : Math.min(1, Math.max(0, (clamped - levelMin) / (nextLevelMin - levelMin)));
    return {
        level,
        title: LEVEL_TITLES[level - 1],
        levelMin,
        nextLevelMin,
        progressToNext: Math.round(progressToNext * 1000) / 1000,
        xpToNext: nextLevelMin === null ? 0 : nextLevelMin - clamped,
    };
}
