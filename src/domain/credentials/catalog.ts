/**
 * Credential catalog — ONE program per existing hobby.
 *
 * This is deliberate: Zenyth must not invent a parallel school. Each program
 * mirrors the hobby's real 28-day task bank (4 weekly themes → 4 skills) and
 * reads evidence from the systems the app already has:
 * daily tasks (taskEngine 28-day rotation), session artifacts with AI
 * verdicts (gamificationStore), units/days, and the final assessment built
 * from bank topics (assessmentBank).
 *
 * Skills carry dayRange so every daily task visibly grows exactly one skill.
 * Weights per program MUST sum to 1.
 */

import { CredentialProgram } from './types';

const WEEK_1: [number, number] = [1, 7];
const WEEK_2: [number, number] = [8, 14];
const WEEK_3: [number, number] = [15, 21];
const WEEK_4: [number, number] = [22, 28];

export const CREDENTIAL_PROGRAMS: CredentialProgram[] = [
    {
        slug: 'python-foundations',
        code: 'PYF',
        title: 'Zenyth Verified Skill — Python Foundations',
        subtitle: 'The same 28-day Python path you already train daily',
        level: 'verified-skill',
        version: '1.0',
        estimatedHours: 15,
        requiredScore: 80,
        readinessThreshold: 75,
        evidenceHobbyIds: ['python', 'coding'],
        skills: [
            { key: 'syntax', name: 'Syntax & Basics', description: 'Bank days 1–7: setup, variables, types, input, strings', weight: 0.2, minimumScore: 65, evidenceTaskTypes: ['theory', 'practice'], dayRange: WEEK_1 },
            { key: 'logic', name: 'Control Flow & Logic', description: 'Bank days 8–14: if/elif, boolean logic, loops', weight: 0.25, minimumScore: 65, evidenceTaskTypes: ['practice', 'puzzles'], dayRange: WEEK_2 },
            { key: 'functions', name: 'Functions & Data', description: 'Bank days 15–21: def, lists, dicts, comprehension', weight: 0.25, minimumScore: 65, evidenceTaskTypes: ['practice', 'analysis'], dayRange: WEEK_3 },
            { key: 'basic_programming', name: 'Projects & OOP', description: 'Bank days 22–28: files, errors, modules, classes, final project', weight: 0.3, minimumScore: 65, evidenceTaskTypes: ['practice', 'puzzles', 'analysis'], dayRange: WEEK_4 },
        ],
        requirements: [
            { key: 'curriculum', label: 'Daily path', description: 'Train your normal Python daily plan — it counts automatically' },
            { key: 'sessions', label: 'Sessions', description: 'Finish focus sessions with passing AI verdicts' },
            { key: 'knowledge', label: 'Knowledge checks', description: 'Score at least 80% in checks built from bank topics' },
            { key: 'project', label: 'Mini project', description: 'Build one small working program (bank day 28)' },
            { key: 'final', label: 'Final assessment', description: 'Pass the timed final assessment' },
        ],
        assessment: { questionCount: 20, timeLimitMinutes: 30, bankSize: 40 },
        requiresProject: true,
        requiresIdentityVerification: false,
    },
    {
        slug: 'chess-foundations',
        code: 'CHF',
        title: 'Zenyth Verified Skill — Chess Foundations',
        subtitle: 'The same 28-day chess path you already train daily',
        level: 'verified-skill',
        version: '1.0',
        estimatedHours: 15,
        requiredScore: 80,
        readinessThreshold: 75,
        evidenceHobbyIds: ['chess'],
        skills: [
            { key: 'rules', name: 'Rules & Basics', description: 'Bank days 1–7: moves, piece values, castling, mates', weight: 0.2, minimumScore: 65, evidenceTaskTypes: ['theory', 'practice'], dayRange: WEEK_1 },
            { key: 'openings', name: 'Openings', description: 'Bank days 8–14: Italian, Spanish, Sicilian, French, Gambit, Caro-Kann', weight: 0.25, minimumScore: 65, evidenceTaskTypes: ['theory', 'analysis'], dayRange: WEEK_2 },
            { key: 'endgames', name: 'Endgames', description: 'Bank days 15–21: opposition, rook, bishop/knight, queen endings', weight: 0.25, minimumScore: 65, evidenceTaskTypes: ['practice', 'puzzles'], dayRange: WEEK_3 },
            { key: 'tactics', name: 'Tactics & Strategy', description: 'Bank days 22–28: forks, pins, open checks, outposts, attacks', weight: 0.3, minimumScore: 65, evidenceTaskTypes: ['puzzles', 'analysis'], dayRange: WEEK_4 },
        ],
        requirements: [
            { key: 'curriculum', label: 'Daily path', description: 'Train your normal chess daily plan — it counts automatically' },
            { key: 'sessions', label: 'Sessions', description: 'Solve puzzles and analyses with passing AI verdicts' },
            { key: 'knowledge', label: 'Knowledge checks', description: 'Score at least 80% in checks built from bank topics' },
            { key: 'project', label: 'Game analysis', description: 'Submit an annotated game (your best of the month, bank day 28)' },
            { key: 'final', label: 'Final assessment', description: 'Pass the timed final assessment' },
        ],
        assessment: { questionCount: 20, timeLimitMinutes: 30, bankSize: 40 },
        requiresProject: true,
        requiresIdentityVerification: false,
    },
    {
        slug: 'reading-mastery',
        code: 'RDG',
        title: 'Zenyth Verified Skill — Reading Mastery',
        subtitle: 'The same 28-day reading path you already train daily',
        level: 'verified-skill',
        version: '1.0',
        estimatedHours: 12,
        requiredScore: 80,
        readinessThreshold: 75,
        evidenceHobbyIds: ['reading'],
        skills: [
            { key: 'techniques', name: 'Reading Techniques', description: 'Bank days 1–7: SQ3R, thesis, annotations, skimming, Feynman', weight: 0.25, minimumScore: 65, evidenceTaskTypes: ['theory', 'practice'], dayRange: WEEK_1 },
            { key: 'analysis', name: 'Critical Analysis', description: 'Bank days 8–14: arguments, fallacies, fact vs opinion, Cornell, source checking', weight: 0.3, minimumScore: 65, evidenceTaskTypes: ['analysis', 'puzzles'], dayRange: WEEK_2 },
            { key: 'nonfiction', name: 'Non-fiction System', description: 'Bank days 15–21: genres, 3 ideas, one-page notes, repetition, reviews', weight: 0.25, minimumScore: 65, evidenceTaskTypes: ['practice', 'analysis'], dayRange: WEEK_3 },
            { key: 'system', name: "Reader's System", description: 'Bank days 22–28: library, tracker, journal, book connections, month review', weight: 0.2, minimumScore: 65, evidenceTaskTypes: ['practice', 'puzzles'], dayRange: WEEK_4 },
        ],
        requirements: [
            { key: 'curriculum', label: 'Daily path', description: 'Train your normal reading daily plan — it counts automatically' },
            { key: 'sessions', label: 'Sessions', description: 'Finish focus sessions with passing AI verdicts' },
            { key: 'knowledge', label: 'Knowledge checks', description: 'Score at least 80% in checks built from bank topics' },
            { key: 'project', label: 'Month review', description: 'Submit your month review (bank day 28)' },
            { key: 'final', label: 'Final assessment', description: 'Pass the timed final assessment' },
        ],
        assessment: { questionCount: 20, timeLimitMinutes: 30, bankSize: 40 },
        requiresProject: true,
        requiresIdentityVerification: false,
    },
    {
        slug: 'english-foundations',
        code: 'ENF',
        title: 'Zenyth Verified Skill — English Foundations',
        subtitle: 'The same 28-day English path you already train daily',
        level: 'verified-skill',
        version: '1.0',
        estimatedHours: 14,
        requiredScore: 80,
        readinessThreshold: 75,
        evidenceHobbyIds: ['english'],
        skills: [
            { key: 'grammar', name: 'Grammar Basics', description: 'Bank days 1–7: Present/Past/Future tenses, Perfect', weight: 0.3, minimumScore: 65, evidenceTaskTypes: ['theory', 'practice'], dayRange: WEEK_1 },
            { key: 'vocabulary', name: 'Vocabulary', description: 'Bank days 8–14: flashcards, topics, phrasal verbs, idioms', weight: 0.25, minimumScore: 65, evidenceTaskTypes: ['practice', 'puzzles'], dayRange: WEEK_2 },
            { key: 'speaking', name: 'Speaking', description: 'Bank days 15–21: small talk, clichés, questions, opinions, linking words', weight: 0.25, minimumScore: 65, evidenceTaskTypes: ['practice', 'analysis'], dayRange: WEEK_3 },
            { key: 'writing', name: 'Writing & Reading', description: 'Bank days 22–28: paragraphs, emails, essays, passive, conditionals', weight: 0.2, minimumScore: 65, evidenceTaskTypes: ['practice', 'puzzles', 'analysis'], dayRange: WEEK_4 },
        ],
        requirements: [
            { key: 'curriculum', label: 'Daily path', description: 'Train your normal English daily plan — it counts automatically' },
            { key: 'sessions', label: 'Sessions', description: 'Finish focus sessions with passing AI verdicts' },
            { key: 'knowledge', label: 'Knowledge checks', description: 'Score at least 80% in checks built from bank topics' },
            { key: 'project', label: 'Final essay', description: 'Submit your final essay (bank day 28)' },
            { key: 'final', label: 'Final assessment', description: 'Pass the timed final assessment' },
        ],
        assessment: { questionCount: 20, timeLimitMinutes: 30, bankSize: 40 },
        requiresProject: true,
        requiresIdentityVerification: false,
    },
    {
        slug: 'chinese-hsk1-start',
        code: 'CHN',
        title: 'Zenyth Verified Skill — Chinese HSK 1 Start',
        subtitle: 'The same 28-day Chinese path you already train daily',
        level: 'verified-skill',
        version: '1.0',
        estimatedHours: 14,
        requiredScore: 80,
        readinessThreshold: 75,
        evidenceHobbyIds: ['chinese'],
        skills: [
            { key: 'pinyin', name: 'Pinyin & Tones', description: 'Bank days 1–7: initials, finals, 4 tones, first words', weight: 0.3, minimumScore: 65, evidenceTaskTypes: ['theory', 'practice'], dayRange: WEEK_1 },
            { key: 'characters', name: 'Characters', description: 'Bank days 8–14: stroke order, nature/body, numbers, dates', weight: 0.25, minimumScore: 65, evidenceTaskTypes: ['practice', 'puzzles'], dayRange: WEEK_2 },
            { key: 'phrases', name: 'Everyday Phrases', description: 'Bank days 15–21: greetings, politeness, shopping, restaurant, directions', weight: 0.25, minimumScore: 65, evidenceTaskTypes: ['practice', 'analysis'], dayRange: WEEK_3 },
            { key: 'grammar', name: 'Basic Grammar', description: 'Bank days 22–28: word order, 是, 有, questions, measure words, adjectives', weight: 0.2, minimumScore: 65, evidenceTaskTypes: ['theory', 'puzzles', 'analysis'], dayRange: WEEK_4 },
        ],
        requirements: [
            { key: 'curriculum', label: 'Daily path', description: 'Train your normal Chinese daily plan — it counts automatically' },
            { key: 'sessions', label: 'Sessions', description: 'Finish focus sessions with passing AI verdicts' },
            { key: 'knowledge', label: 'Knowledge checks', description: 'Score at least 80% in checks built from bank topics' },
            { key: 'project', label: 'Self intro', description: 'Submit your self-introduction text (bank day 28)' },
            { key: 'final', label: 'Final assessment', description: 'Pass the timed final assessment' },
        ],
        assessment: { questionCount: 20, timeLimitMinutes: 30, bankSize: 40 },
        requiresProject: true,
        requiresIdentityVerification: false,
    },
];

export const getProgram = (slug: string) =>
    CREDENTIAL_PROGRAMS.find(p => p.slug === slug);

/** Program whose evidence comes from this hobby's daily tasks, if any. */
export const getProgramForHobby = (hobbyId: string) =>
    CREDENTIAL_PROGRAMS.find(p => p.evidenceHobbyIds.includes(hobbyId));

/** Short display title, e.g. "Python Foundations". */
export const programShortTitle = (title: string) =>
    title.replace(/^Zenyth (Verified Skill|Certificate|Certified) — /, '');

export const LEVEL_LABEL: Record<string, string> = {
    completion: 'Certificate of Completion',
    'verified-skill': 'Verified Skill Certificate',
    professional: 'Professional Credential',
};
