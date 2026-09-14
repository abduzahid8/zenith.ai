/**
 * P2 regression: agentOrchestrator no-content fallback must honor startingValue.
 *
 * Exercises the ACTUAL fallback path (orchestrateDailyPlan with null content)
 * rather than a copied formula in isolation.
 *
 * Fixture: startingValue = 20, target = 100, currentValue = 60
 *   canonical => (60-20)/(100-20) = 50%
 *   naive     => 60/100 = 60% (bug)
 */
import { orchestrateDailyPlan } from '../services/agentOrchestrator';
import { getHandler } from '../services/goalHandlers';
import type { GoalDefinition, GoalProgress } from '../types/goals';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('../services/ai', () => ({
    __esModule: true,
    default: { sendMessage: jest.fn().mockResolvedValue('fallback research summary') },
}));

const EXEC_GOAL = {
    id: 'goal-fallback-exec',
    hobby: 'chess',
    type: 'execution_count',
    category: 'execution',
    description: 'Become better at Chess',
    target: 100,
    startingValue: 20,
    deadline: '2026-12-31',
    startDate: '2026-09-01',
    status: 'active',
    unitLabel: 'games',
} as GoalDefinition;

const EXEC_PROGRESS = {
    goalId: EXEC_GOAL.id,
    currentValue: 60,
    lastUpdated: '2026-09-01',
    dailyActions: 1,
    streak: 1,
    history: [{ date: '2026-09-01', value: 60, description: 'seed', type: 'checkin' }],
    currentMode: 'milestone',
    milestones: [],
    currentMilestoneIndex: 0,
} as unknown as GoalProgress;

const SKILL_GOAL = {
    id: 'goal-fallback-skill',
    hobby: 'chess',
    type: 'skill_rating',
    category: 'skill',
    description: 'Chess mastery',
    target: 1200,
    difficultyScore: 400,
    targetDifficulty: 1200,
    deadline: '2026-12-31',
    startDate: '2026-09-01',
    status: 'active',
    unitLabel: 'pts',
} as GoalDefinition;

const SKILL_PROGRESS = {
    goalId: SKILL_GOAL.id,
    currentValue: 0,
    currentDifficulty: 800,
    lastUpdated: '2026-09-01',
    dailyActions: 1,
    streak: 1,
    history: [{ date: '2026-09-01', value: 0, description: 'seed', type: 'checkin' }],
    currentMode: 'milestone',
    milestones: [],
    currentMilestoneIndex: 0,
} as unknown as GoalProgress;

describe('agentOrchestrator no-content fallback percentage', () => {
    it('execution fallback honors startingValue: 50%, NOT naive 60%', async () => {
        const canonical = getHandler(EXEC_GOAL.category).computeProgress(EXEC_GOAL, EXEC_PROGRESS)
            .percentComplete;
        expect(canonical).toBe(50);

        const plan = await orchestrateDailyPlan(EXEC_GOAL, EXEC_PROGRESS, null);
        const practice = plan.steps.find(s => s.type === 'practice');
        expect(practice).toBeDefined();
        expect(practice!.title).toContain('50%');
        expect(practice!.title).not.toContain('60%');
    });

    it('each goal category delegates to its canonical handler', async () => {
        for (const [goal, progress] of [
            [EXEC_GOAL, EXEC_PROGRESS],
            [SKILL_GOAL, SKILL_PROGRESS],
        ] as Array<[GoalDefinition, GoalProgress]>) {
            const canonical = getHandler(goal.category).computeProgress(goal, progress).percentComplete;
            const plan = await orchestrateDailyPlan(goal, progress, null);
            const practice = plan.steps.find(s => s.type === 'practice');
            expect(practice).toBeDefined();
            expect(practice!.title).toContain(`${canonical}%`);
        }
        // Skill fixture: (800-400)/(1200-400) = 50% via skill handler offsets.
        expect(
            getHandler(SKILL_GOAL.category).computeProgress(SKILL_GOAL, SKILL_PROGRESS).percentComplete,
        ).toBe(50);
    });

    it('fallback contains no local duplicate progress formula', () => {
        const src = fs.readFileSync(path.join(__dirname, '..', 'services', 'agentOrchestrator.ts'), 'utf8');
        expect(src).toMatch(/getHandler\(goal\.category\)\.computeProgress/);
        expect(src).not.toMatch(/currentValue \/ Math\.max\(1, goal\.target\)/);
    });
});
