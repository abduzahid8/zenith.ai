import { computeDailyFocus } from '../services/dailyFocusEngine';
import { GoalDefinition, GoalProgress } from '../types/goals';

const GOAL: GoalDefinition = {
  id: 'g1',
  hobby: 'goal' as any,
  type: 'execution_count',
  category: 'execution',
  target: 100,
  deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  startDate: new Date().toISOString().split('T')[0],
  startingValue: 0,
  description: 'Find 100 clients',
  status: 'active',
  unitLabel: 'clients',
};

const SKILL_GOAL: GoalDefinition = {
  ...GOAL,
  category: 'skill',
  type: 'skill_rating',
  target: 1200,
  unitLabel: 'pts',
  difficultyScore: 500,
  targetDifficulty: 1200,
};

function baseProgress(overrides?: Partial<GoalProgress>): GoalProgress {
  const today = new Date().toISOString().split('T')[0];
  return {
    goalId: 'g1',
    currentValue: 0,
    lastUpdated: today,
    dailyActions: 1,
    streak: 0,
    history: [],
    currentMode: 'tactical',
    milestones: [],
    currentMilestoneIndex: 0,
    ...overrides,
  };
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

describe('computeDailyFocus', () => {
  it('returns onboard when no check-ins exist', () => {
    const r = computeDailyFocus({
      goal: GOAL,
      progress: baseProgress({ dailyActions: 0, history: [] }),
      todayStr: new Date().toISOString().split('T')[0],
    });
    expect(r.focus).toBe('onboard');
    expect(r.reason.length).toBeGreaterThan(0);
  });

  it('returns recover_streak when last check-in was 3+ days ago', () => {
    const r = computeDailyFocus({
      goal: GOAL,
      progress: baseProgress({
        dailyActions: 2,
        history: [{ date: daysAgo(4), value: 5, description: 'checkin' }],
      }),
      todayStr: new Date().toISOString().split('T')[0],
    });
    expect(r.focus).toBe('recover_streak');
  });

  it('returns steady when last check-in was yesterday', () => {
    const r = computeDailyFocus({
      goal: GOAL,
      progress: baseProgress({
        history: [{ date: daysAgo(1), value: 5, description: 'checkin' }],
      }),
      todayStr: new Date().toISOString().split('T')[0],
    });
    expect(r.focus).toBe('steady');
  });

  it('returns unblock when mode is tools', () => {
    const r = computeDailyFocus({
      goal: GOAL,
      progress: baseProgress({ currentMode: 'tools' }),
      todayStr: new Date().toISOString().split('T')[0],
    });
    expect(r.focus).toBe('unblock');
  });

  it('returns unblock when mode is troubleshoot', () => {
    const r = computeDailyFocus({
      goal: GOAL,
      progress: baseProgress({ currentMode: 'troubleshoot' }),
      todayStr: new Date().toISOString().split('T')[0],
    });
    expect(r.focus).toBe('unblock');
  });

  it('returns celebrate_milestone when a milestone was just crossed', () => {
    const today = new Date().toISOString().split('T')[0];
    const r = computeDailyFocus({
      goal: GOAL,
      progress: baseProgress({
        currentMilestoneIndex: 1,
        milestones: [
          { label: 'First 10', target: 10, currentValue: 12, unit: 'clients' },
          { label: 'Halfway', target: 50, currentValue: 12, unit: 'clients' },
        ],
        history: [{ date: today, value: 12, description: 'hit 10!' }],
        dailyActions: 5,
      }),
      todayStr: today,
    });
    expect(r.focus).toBe('celebrate_milestone');
  });

  it('does NOT celebrate an old milestone (crossed >2 days ago)', () => {
    const r = computeDailyFocus({
      goal: GOAL,
      progress: baseProgress({
        currentMilestoneIndex: 1,
        milestones: [
          { label: 'First 10', target: 10, currentValue: 12, unit: 'clients' },
        ],
        history: [{ date: daysAgo(5), value: 12, description: 'hit 10!' }],
        dailyActions: 6,
      }),
      todayStr: new Date().toISOString().split('T')[0],
    });
    expect(r.focus).not.toBe('celebrate_milestone');
  });

  it('returns push when streak >= 5', () => {
    const r = computeDailyFocus({
      goal: GOAL,
      progress: baseProgress({
        streak: 6,
        dailyActions: 10,
        history: Array.from({ length: 6 }, (_, i) => ({
          date: daysAgo(5 - i),
          value: i * 5,
          description: 'checkin',
        })),
      }),
      todayStr: new Date().toISOString().split('T')[0],
    });
    expect(r.focus).toBe('push');
  });

  it('returns consolidate for skill goal with last struggle', () => {
    const r = computeDailyFocus({
      goal: SKILL_GOAL,
      progress: baseProgress({
        dailyActions: 3,
        history: [
          { date: daysAgo(1), value: 500, description: 'difficulty: completed_struggled', type: 'task' },
        ],
      }),
      todayStr: new Date().toISOString().split('T')[0],
    });
    expect(r.focus).toBe('consolidate');
  });

  it('returns consolidate when yesterday\'s commitment was missed', () => {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = daysAgo(1);
    const r = computeDailyFocus({
      goal: GOAL,
      progress: baseProgress({
        dailyActions: 3,
        yesterdayCommitment: { text: '', date: yesterday, action: 'Read', category: 'reflect' },
        yesterdayCommitmentHonored: false,
        history: [{ date: yesterday, value: 2, description: 'checkin' }],
      }),
      todayStr: today,
    });
    expect(r.focus).toBe('consolidate');
  });

  it('returns steady as the default', () => {
    const r = computeDailyFocus({
      goal: GOAL,
      progress: baseProgress({
        dailyActions: 5,
        history: [
          { date: daysAgo(3), value: 5, description: 'checkin' },
          { date: daysAgo(2), value: 8, description: 'checkin' },
          { date: daysAgo(1), value: 10, description: 'checkin' },
        ],
      }),
      todayStr: new Date().toISOString().split('T')[0],
    });
    expect(r.focus).toBe('steady');
    expect(r.reason).toContain('consistency');
  });
});
