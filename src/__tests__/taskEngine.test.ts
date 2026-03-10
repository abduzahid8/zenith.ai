import { taskEngine } from '../services/taskEngine';
import { TaskType, UserHobby } from '../services/supabase/types';

describe('taskEngine', () => {
    const userId = 'user-123';
    const date = '2023-10-27';

    const primaryHobby: UserHobby = {
        id: 'hobby-1',
        user_id: userId,
        hobby_id: 'chess',
        is_primary: true,
    };

    it('generates a valid daily plan with 2 tasks', () => {
        const tasks = taskEngine.generateDailyPlan(userId, date, null, [primaryHobby]);

        expect(tasks).toHaveLength(2);
        tasks.forEach((task) => {
            expect(task.user_id).toBe(userId);
            expect(task.scheduled_date).toBe(date);
            expect(task.status).toBe('pending');
            expect(task.type).toMatch(/^(theory|practice|analysis|puzzles)$/);
            expect(typeof task.title).toBe('string');
            expect((task.title || '').length).toBeGreaterThan(0);
        });
    });

    it('includes primary hobby in generated tasks', () => {
        const tasks = taskEngine.generateDailyPlan(userId, date, null, [primaryHobby]);
        tasks.forEach((task) => {
            expect(task.hobby_id).toBe('chess');
        });
    });

    it('falls back safely when hobby list is empty', () => {
        const tasks = taskEngine.generateDailyPlan(userId, date, null, []);
        expect(tasks).toHaveLength(2);
        tasks.forEach((task) => {
            expect(task.hobby_id).toBeUndefined();
        });
    });

    it('creates manual task from template with exact title/duration', () => {
        const template = { title: 'Custom template task', duration: 42 };
        const task = taskEngine.generateTaskByType(
            userId,
            'practice',
            date,
            null,
            [primaryHobby],
            template,
        );

        expect(task.type).toBe('practice');
        expect(task.title).toBe(template.title);
        expect(task.duration_minutes).toBe(template.duration);
        expect(task.is_manual).toBe(true);
    });

    it('returns templates for known hobby and default fallback for unknown hobby', () => {
        const known = taskEngine.getAvailableTaskTemplates('chess', 'theory');
        const unknown = taskEngine.getAvailableTaskTemplates('unknown-hobby', 'theory');

        expect(Array.isArray(known)).toBe(true);
        expect(Array.isArray(unknown)).toBe(true);
        expect(known.length).toBeGreaterThan(0);
        expect(unknown.length).toBeGreaterThan(0);
    });

    it('supports all task types in getAvailableTaskTemplates', () => {
        const types: TaskType[] = ['theory', 'practice', 'analysis', 'puzzles'];

        types.forEach((type) => {
            const templates = taskEngine.getAvailableTaskTemplates('chess', type);
            expect(Array.isArray(templates)).toBe(true);
            expect(templates.length).toBeGreaterThan(0);
        });
    });
});
