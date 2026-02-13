import { taskEngine } from '../services/taskEngine';
import { UserStateSnapshot, UserHobby, UserEarning, EarningMethod, Task } from '../services/supabase/types';

describe('taskEngine', () => {
    const userId = 'user-123';
    const date = '2023-10-27';

    const mockHobby: UserHobby = {
        id: '1',
        user_id: userId,
        hobby_id: 'chess',
        is_primary: true
    };

    const mockSnapshot: UserStateSnapshot = {
        user_id: userId,
        skill_level: 5,
        avg_session_time: 30, // should result in ~35min tasks
        loss_streak: 0
    };

    const mockEarningMethods: EarningMethod[] = [
        {
            id: 'em-1',
            title: 'Freelance Chess Coach',
            category: 'freelance'
        }
    ];

    const mockUserEarning: UserEarning = {
        id: 'ue-1',
        user_id: userId,
        earning_method_id: 'em-1',
        status: 'learning'
    };

    it('generates exactly 4 tasks', () => {
        const tasks = taskEngine.generateDailyPlan(
            userId,
            date,
            mockSnapshot,
            [mockHobby],
            [],
            []
        );

        expect(tasks).toHaveLength(4);
        const types = tasks.map(t => t.type);
        expect(types).toContain('learning');
        expect(types).toContain('practice');
        expect(types).toContain('action');
        expect(types).toContain('wellbeing');
    });

    it('adjusts duration based on snapshot', () => {
        const tasks = taskEngine.generateDailyPlan(
            userId,
            date,
            mockSnapshot, // avg_session_time 30
            [mockHobby]
        );

        const practiceTask = tasks.find(t => t.type === 'practice');
        // Logic: min(60, max(5, 30 + 5)) = 35
        expect(practiceTask?.duration_minutes).toBe(35);
    });

    it('activates recovery mode on loss streak', () => {
        const recoverySnapshot = { ...mockSnapshot, loss_streak: 5 };
        const tasks = taskEngine.generateDailyPlan(
            userId,
            date,
            recoverySnapshot,
            [mockHobby]
        );

        const practiceTask = tasks.find(t => t.type === 'practice');
        // Logic: duration - 5
        // Base was 35, now 30. Diff checks
        // Also title should be different/easier potentially
        expect(practiceTask?.duration_minutes).toBeLessThan(35);
    });

    it('includes earning task if active path exists', () => {
        const tasks = taskEngine.generateDailyPlan(
            userId,
            date,
            mockSnapshot,
            [mockHobby],
            [mockUserEarning],
            mockEarningMethods
        );

        const actionTask = tasks.find(t => t.type === 'action');
        expect(actionTask?.title).toContain('Freelance Chess Coach');
        expect(actionTask?.earning_step_id).toBe('ue-1');
    });

    it('falls back if no earning path', () => {
        const tasks = taskEngine.generateDailyPlan(
            userId,
            date,
            mockSnapshot,
            [mockHobby],
            [],
            []
        );

        const actionTask = tasks.find(t => t.type === 'action');
        expect(actionTask?.title).toBe('Применить навык на практике');
        expect(actionTask?.earning_step_id).toBeUndefined();
    });
});
