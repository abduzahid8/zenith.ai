import {
  computeNextMode,
  stepSizeForGoal,
  rollingVelocity,
  skillHandler,
  executionHandler,
  daysBetween,
  MIN_DIFFICULTY,
  MAX_DIFFICULTY,
} from '../services/goalHandlers';
import { GoalDefinition, GoalProgressEntry, HelpMode } from '../types/goals';
import { guessCategory, extractCount } from '../services/goalSetupHeuristics';

// ── Helpers ──────────────────────────────────────────────────

const BASE_GOAL: GoalDefinition = {
  id: 'test_1',
  hobby: 'goal' as any,
  type: 'execution_count',
  category: 'execution',
  target: 100,
  deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  startDate: new Date().toISOString().split('T')[0],
  startingValue: 0,
  description: 'Test goal',
  status: 'active',
  unitLabel: 'units',
};

const SKILL_GOAL: GoalDefinition = {
  ...BASE_GOAL,
  id: 'test_skill',
  category: 'skill',
  type: 'skill_rating',
  target: 1200,
  difficultyScore: 400,
  targetDifficulty: 1200,
  unitLabel: 'pts',
};

// ── daysBetween ─────────────────────────────────────────────

describe('daysBetween', () => {
  it('returns positive for future date', () => {
    const d = daysBetween('2024-01-01', '2024-01-10');
    expect(d).toBe(9);
  });

  it('returns 0 for same date', () => {
    const d = daysBetween('2024-01-01', '2024-01-01');
    expect(d).toBe(0);
  });
});

// ── rollingVelocity ─────────────────────────────────────────

describe('rollingVelocity', () => {
  it('returns lifetime rate when less than 7 days elapsed', () => {
    const history: GoalProgressEntry[] = [
      { date: '2024-01-02', value: 10, description: 'test' },
      { date: '2024-01-03', value: 15, description: 'test' },
    ];
    const v = rollingVelocity(history, 20, 5);
    expect(v).toBe(4); // 20 / 5
  });

  it('scales by recent active ratio when >= 7 days elapsed', () => {
    // 10 days elapsed, with 3 active days in last 7
    const today = new Date();
    const history: GoalProgressEntry[] = [
      { date: new Date(today.getTime() - 1 * 86400000).toISOString().split('T')[0], value: 5, description: 'test' },
      { date: new Date(today.getTime() - 3 * 86400000).toISOString().split('T')[0], value: 10, description: 'test' },
      { date: new Date(today.getTime() - 5 * 86400000).toISOString().split('T')[0], value: 15, description: 'test' },
    ];
    const v = rollingVelocity(history, 30, 10);
    // lifetime = 30/10 = 3, recent = 3 days/7 = 0.4285... => 3 * 0.4285... ≈ 1.28
    expect(v).toBeCloseTo(1.2857, 1);
  });

  it('returns small velocity when little progress over many days', () => {
    const history: GoalProgressEntry[] = [
      { date: '2024-01-10', value: 1, description: 'test' },
    ];
    const v = rollingVelocity(history, 5, 30);
    // lifetime = 5/30 = 0.166, recent = 1/7 ≈ 0.14 => 0.166 * 0.14 ≈ 0.023
    expect(v).toBeLessThan(1);
  });
});

// ── stepSizeForGoal ──────────────────────────────────────────

describe('stepSizeForGoal', () => {
  it('scales step to goal range (large range = larger step)', () => {
    const chessGoal: GoalDefinition = {
      ...SKILL_GOAL,
      difficultyScore: 400,
      targetDifficulty: 1200,
      target: 1200,
    };
    // range = 800, /40 = 20, clamped to [5,200]
    const step = stepSizeForGoal(chessGoal);
    expect(step).toBe(20);
  });

  it('clamps to MIN_STEP for very small ranges', () => {
    const smallGoal: GoalDefinition = {
      ...SKILL_GOAL,
      difficultyScore: 100,
      targetDifficulty: 110,
      target: 110,
    };
    // range = 10, /40 = 0.25, rounded = 0, clamped to MIN_STEP=5
    const step = stepSizeForGoal(smallGoal);
    expect(step).toBe(5);
  });

  it('clamps to MAX_STEP for huge ranges', () => {
    const hugeGoal: GoalDefinition = {
      ...SKILL_GOAL,
      difficultyScore: 100,
      targetDifficulty: 3000,
      target: 3000,
    };
    // range = 2900, /40 = 72.5, rounded = 73, clamped to [5,200] -> 73 (not reaching max)
    // Let's use a range that would produce >200
    const hugeGoal2: GoalDefinition = {
      ...SKILL_GOAL,
      difficultyScore: 100,
      targetDifficulty: 10000,
      target: 10000,
    };
    // range = 9900, /40 = 247.5, rounded = 248, clamped to MAX_STEP=200
    const step = stepSizeForGoal(hugeGoal2);
    expect(step).toBe(200);
  });

  it('handles skill goal without difficultyScore by using default 500', () => {
    const goal = { ...SKILL_GOAL, difficultyScore: undefined };
    const step = stepSizeForGoal(goal);
    // start = 500, target = 1200, range = 700, /40 = 17.5, round = 18
    expect(step).toBe(18);
  });
});

// ── adjustDifficulty ─────────────────────────────────────────

describe('skillHandler.adjustDifficulty', () => {
  it('increases difficulty on completed_easy', () => {
    const result = skillHandler.adjustDifficulty(SKILL_GOAL, 500, 'completed_easy');
    expect(result).toBeGreaterThan(500);
    expect(result).toBeLessThanOrEqual(MAX_DIFFICULTY);
  });

  it('decreases difficulty on completed_struggled (half step)', () => {
    const result = skillHandler.adjustDifficulty(SKILL_GOAL, 500, 'completed_struggled');
    expect(result).toBeLessThan(500);
    expect(result).toBeGreaterThanOrEqual(MIN_DIFFICULTY);
  });

  it('decreases difficulty on abandoned (full step)', () => {
    const result500 = skillHandler.adjustDifficulty(SKILL_GOAL, 500, 'abandoned');
    expect(result500).toBeLessThan(500);
    // step is 20, so 500 - 20 = 480
    expect(result500).toBe(480);
  });

  it('decreases difficulty on skipped (small adjustment)', () => {
    const result = skillHandler.adjustDifficulty(SKILL_GOAL, 500, 'skipped');
    expect(result).toBeLessThan(500);
    // step is 20, /5 = 4, so 500 - 4 = 496
    expect(result).toBe(496);
  });

  it('clamps to MIN_DIFFICULTY', () => {
    const result = skillHandler.adjustDifficulty(SKILL_GOAL, MIN_DIFFICULTY, 'abandoned');
    expect(result).toBeGreaterThanOrEqual(MIN_DIFFICULTY);
  });

  it('clamps to MAX_DIFFICULTY', () => {
    const result = skillHandler.adjustDifficulty(SKILL_GOAL, MAX_DIFFICULTY, 'completed_easy');
    expect(result).toBeLessThanOrEqual(MAX_DIFFICULTY);
  });
});

describe('executionHandler.adjustDifficulty', () => {
  it('always returns current difficulty unchanged', () => {
    expect(executionHandler.adjustDifficulty(BASE_GOAL, 100, 'completed_easy')).toBe(100);
    expect(executionHandler.adjustDifficulty(BASE_GOAL, 100, 'abandoned')).toBe(100);
  });
});

// ── computeNextMode (characterization) ──────────────────────

describe('computeNextMode', () => {
  // ── Troubleshoot exit logic ──────────────────────────────
  // CURRENT (buggy) behavior: reversedIdx > 0 means something
  // newer than the blocker exists. Since history is passed BEFORE
  // appending the new entry, the current check-in is never seen.
  // These tests document what the code *actually* does today.

  it('stays in troubleshoot when blocker is the latest entry (no follow-up yet)', () => {
    const history: GoalProgressEntry[] = [
      { date: '2024-01-01', value: 5, description: 'checkin' },
      { date: '2024-01-02', value: 0, description: 'blocker: stuck', type: 'bottleneck' },
    ];
    const mode = computeNextMode({
      currentMode: 'troubleshoot',
      isBehind: false,
      dailyActions: 3,
      history,
    });
    // reversedIdx = 0 (blocker is newest) => hasFollowedUpSinceBlocker = false
    expect(mode).toBe('troubleshoot');
  });

  it('[STORE FIX] exits troubleshoot when history includes the follow-up entry', () => {
    // This documents the FIXED behavior: when the store passes history
    // *including* today's new entry, the blocker is no longer the newest
    // entry and the mode transitions to 'tactical'.
    const history: GoalProgressEntry[] = [
      { date: '2024-01-01', value: 5, description: 'checkin' },
      { date: '2024-01-02', value: 0, description: 'blocker: stuck', type: 'bottleneck' },
      { date: '2024-01-03', value: 8, description: 'checkin after blocker', type: 'checkin' },
    ];
    const mode = computeNextMode({
      currentMode: 'troubleshoot',
      isBehind: false,
      dailyActions: 3,
      history,
    });
    // reversedIdx = 1 (checkin at index 2, bottleneck at index 1 from end)
    // hasFollowedUpSinceBlocker = true
    expect(mode).toBe('tactical');
  });

  it('[BUG DOC] stays troubleshoot when pre-append history is passed (pure function level)', () => {
    // At the pure-function level, if the caller passes history WITHOUT the
    // new entry, the blocker appears as the latest entry. The store fix in
    // goalStore.ts.recordCheckin addresses this by building updatedHistory
    // first. This test documents what happens at the function level when
    // given incomplete data.
    const history: GoalProgressEntry[] = [
      { date: '2024-01-01', value: 5, description: 'checkin' },
      { date: '2024-01-02', value: 0, description: 'blocker: stuck', type: 'bottleneck' },
    ];
    const mode = computeNextMode({
      currentMode: 'troubleshoot',
      isBehind: false,
      dailyActions: 3,
      history,
    });
    expect(mode).toBe('troubleshoot');
  });

  it('exits troubleshoot when follow-up entry exists in history', () => {
    // Proper flow when the new check-in IS included in history
    const history: GoalProgressEntry[] = [
      { date: '2024-01-01', value: 5, description: 'checkin' },
      { date: '2024-01-02', value: 0, description: 'blocker: stuck', type: 'bottleneck' },
      { date: '2024-01-03', value: 8, description: 'checkin after blocker', type: 'checkin' },
    ];
    const mode = computeNextMode({
      currentMode: 'troubleshoot',
      isBehind: false,
      dailyActions: 3,
      history,
    });
    // reversedIdx = 2 (checkin is at index 2 from end = newer than blocker)
    // hasFollowedUpSinceBlocker = true
    expect(mode).toBe('tactical');
  });

  // ── Tools mode escalation ───────────────────────────────

  it('stays in tactical when not behind', () => {
    const history: GoalProgressEntry[] = [
      { date: '2024-01-01', value: 5, description: 'checkin' },
      { date: '2024-01-02', value: 8, description: 'checkin' },
    ];
    const mode = computeNextMode({
      currentMode: 'tactical',
      isBehind: false,
      dailyActions: 3,
      history,
    });
    expect(mode).toBe('tactical');
  });

  it('stays in tactical when behind but too few dailyActions', () => {
    const mode = computeNextMode({
      currentMode: 'tactical',
      isBehind: true,
      dailyActions: 2,
      history: [{ date: '2024-01-01', value: 5, description: 'checkin' }],
    });
    expect(mode).toBe('tactical');
  });

  it('escalates to tools when behind and enough dailyActions', () => {
    const mode = computeNextMode({
      currentMode: 'tactical',
      isBehind: true,
      dailyActions: 5,
      history: [
        { date: '2024-01-01', value: 5, description: 'checkin' },
        { date: '2024-01-02', value: 8, description: 'checkin' },
        { date: '2024-01-03', value: 9, description: 'checkin' },
      ],
    });
    expect(mode).toBe('tools');
  });

  // ── Milestone mode passthrough ──────────────────────────

  it('returns milestone when current mode is milestone (unchanged)', () => {
    const mode = computeNextMode({
      currentMode: 'milestone',
      isBehind: false,
      dailyActions: 0,
      history: [],
    });
    // computeNextMode only handles troubleshoot/tactical/tools;
    // milestone is not in its if-chain, falls through to default 'tactical'
    expect(mode).toBe('tactical');
  });

  // ── First check-in ───────────────────────────────────────

  it('returns tactical for a first-time checkin', () => {
    const mode = computeNextMode({
      currentMode: 'tactical',
      isBehind: false,
      dailyActions: 0,
      history: [],
    });
    expect(mode).toBe('tactical');
  });

  // ── Troubleshoot with multiple blockers ──────────────────

  it('stays in troubleshoot if most recent bottleneck has no follow-up', () => {
    const history: GoalProgressEntry[] = [
      { date: '2024-01-01', value: 5, description: 'checkin' },
      { date: '2024-01-02', value: 0, description: 'blocker: stuck v1', type: 'bottleneck' },
      { date: '2024-01-03', value: 8, description: 'checkin', type: 'checkin' },
      { date: '2024-01-04', value: 0, description: 'blocker: stuck v2', type: 'bottleneck' },
    ];
    const mode = computeNextMode({
      currentMode: 'troubleshoot',
      isBehind: false,
      dailyActions: 3,
      history,
    });
    // reversed findIndex finds the LAST bottleneck (index 0 from end = v2)
    expect(mode).toBe('troubleshoot');
  });
});

// ── guessCategory ────────────────────────────────────────────

describe('guessCategory', () => {
  it('identifies skill for chess hobby', () => {
    expect(guessCategory('get better at chess', 'chess')).toBe('skill');
  });

  it('identifies skill for reading hobby', () => {
    expect(guessCategory('read more books', 'reading')).toBe('skill');
  });

  it('identifies skill via keyword "reach 1200 rating"', () => {
    expect(guessCategory('reach 1200 rating in chess', null)).toBe('skill');
  });

  it('identifies execution via keyword "find"', () => {
    expect(guessCategory('find 200 influencers', null)).toBe('execution');
  });

  it('identifies execution via keyword "get clients"', () => {
    expect(guessCategory('get 100 clients this quarter', null)).toBe('execution');
  });

  it('identifies execution via keyword "build"', () => {
    expect(guessCategory('build a landing page', null)).toBe('execution');
  });

  it('identifies execution via keyword "sales"', () => {
    expect(guessCategory('generate more sales', null)).toBe('execution');
  });

  it('defaults to execution when description has a concrete count at the end', () => {
    expect(guessCategory('grow my newsletter subscribers to 5000', null)).toBe('execution');
  });

  it('defaults to skill when description has a count but is skill-hobby', () => {
    // Hobby check takes priority
    expect(guessCategory('play 100 rated games', 'chess')).toBe('skill');
  });

  it('defaults to skill for ambiguous descriptions without count', () => {
    expect(guessCategory('just get better at life', null)).toBe('skill');
  });

  // Table-driven tests
  const table: [string, string | null, string][] = [
    ['Reach 1200 chess rating', null, 'skill'],
    ['Improve my guitar playing', null, 'skill'],
    ['Learn Python in 30 days', null, 'skill'],
    ['Master the piano', null, 'skill'],
    ['Run a 5K', null, 'skill'],
    ['Complete course on React', null, 'skill'],
    ['Get AWS certification', null, 'skill'],
    ['Find 200 influencers on Instagram', null, 'execution'],
    ['Get 50 leads per month', null, 'execution'],
    ['Launch a SaaS product', null, 'execution'],
    ['Build a mobile app', null, 'execution'],
    ['Create 10 YouTube videos', null, 'execution'],
    ['Write 100 blog posts', null, 'execution'],
    ['Collect 1000 email signups', null, 'execution'],
    ['Get 30 clients', null, 'execution'],
    ['grow my newsletter subscribers to 5000', null, 'execution'],
    ['sell 200 products', null, 'execution'],
    ['Read 12 books', 'reading', 'skill'],
    ['Reach 1800 rating', 'chess', 'skill'],
  ];

  it.each(table)('guessCategory("%s", %s) -> %s', (desc, hobby, expected) => {
    expect(guessCategory(desc, hobby)).toBe(expected as any);
  });
});

// ── extractCount ─────────────────────────────────────────────

describe('extractCount', () => {
  it('extracts count and unit from action pattern with unit', () => {
    const r = extractCount('find 200 influencers');
    expect(r).toEqual({ count: 200, unit: 'influencers' });
  });

  it('extracts count from action pattern without explicit unit (falls back to "units")', () => {
    const r = extractCount('find 200 people');
    expect(r).toEqual({ count: 200, unit: 'units' });
  });

  it('extracts count from count-pattern only', () => {
    const r = extractCount('I want 500 clients');
    expect(r).toEqual({ count: 500, unit: 'clients' });
  });

  it('extracts count from count-pattern with pages', () => {
    const r = extractCount('Read 300 pages');
    expect(r).toEqual({ count: 300, unit: 'pages' });
  });

  it('returns null for description without numbers', () => {
    expect(extractCount('get better at chess')).toBeNull();
  });

  it('returns null for empty description', () => {
    expect(extractCount('')).toBeNull();
  });

  it('extracts from "get 50 leads" pattern', () => {
    const r = extractCount('get 50 leads');
    expect(r).toEqual({ count: 50, unit: 'leads' });
  });

  it('extracts from build/launch pattern', () => {
    const r = extractCount('launch 3 products');
    expect(r).toEqual({ count: 3, unit: 'units' });
  });

  it('prefers real unit over fallback "units" when both patterns match', () => {
    const r = extractCount('write 200 posts for the blog');
    expect(r).toEqual({ count: 200, unit: 'posts' });
  });

  it('extracts count from "reach 5000 subscribers"', () => {
    const r = extractCount('reach 5000 subscribers');
    expect(r).toEqual({ count: 5000, unit: 'subscribers' });
  });

  const table: [string, { count: number; unit: string } | null][] = [
    ['find 200 influencers', { count: 200, unit: 'influencers' }],
    ['get 50 leads', { count: 50, unit: 'leads' }],
    ['collect 1000 signups', { count: 1000, unit: 'signups' }],
    // "launch" is in action pattern; "apps" is in COUNT_PATTERN so unit = 'apps'
    ['launch 3 apps', { count: 3, unit: 'apps' }],
    ['write 200 posts', { count: 200, unit: 'posts' }],
    // "build" is in action pattern; "features" is in COUNT_PATTERN so unit = 'features'
    ['build 10 features', { count: 10, unit: 'features' }],
    // "sell" is in action pattern; "products" not in COUNT_PATTERN so unit = 'units'
    ['sell 500 products', { count: 500, unit: 'units' }],
    // "books" not in unit list; "Read" not in action pattern → null
    ['Read 12 books', null],
    ['just improve', null],
    ['', null],
    // "subscribers" in COUNT_PATTERN
    ['grow my newsletter to 5000 subscribers', { count: 5000, unit: 'subscribers' }],
    ['grow my newsletter subscribers to 5000', { count: 5000, unit: 'subscribers' }],
  ];

  it.each(table)('extractCount("%s")', (desc, expected) => {
    expect(extractCount(desc)).toEqual(expected);
  });
});
