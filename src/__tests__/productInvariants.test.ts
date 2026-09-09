import {
    findNextIncompleteTask,
    shouldShowAllDone,
    resolveCompletionPlan,
    isEngineTask,
} from '../domain/sessions/sessionCompletion';
import { buildSessionBlueprint, normalizeKind, parseSessionParams } from '../domain/sessions/sessionBlueprint';
import { artifactToAnswer, taskSkillKey } from '../services/credentialService';
import { getProgramForHobby } from '../domain/credentials/catalog';
import type { Task } from '../services/supabase/types';

jest.mock('../services/ai', () => ({
    aiService: { sendMessage: jest.fn(), gradeAnswer: jest.fn() },
}));

function task(overrides: Partial<Task> & { type: Task['type'] }): Task {
    return {
        user_id: 'u',
        title: 't',
        status: 'pending',
        scheduled_date: '2026-09-09',
        hobby_id: 'python',
        duration_minutes: 15,
        ...overrides,
    } as Task;
}

const micro = (title = 'Loops') =>
    buildSessionBlueprint({ minutes: 5, taskTitle: title, lessonTitle: title });
const standard = (title = 'Loops') =>
    buildSessionBlueprint({ minutes: 15, taskTitle: title, lessonTitle: title });

describe('INVARIANT 1 — one task object for Home and Your Day', () => {
    it('both entries resolve the same next task by id', () => {
        const plan = [
            task({ id: 'a', type: 'theory', status: 'completed' }),
            task({ id: 'b', type: 'practice', status: 'pending' }),
        ];
        const fromHome = findNextIncompleteTask(plan);
        const fromYourDay = plan.find((t) => t.id === 'b') ?? null;
        expect(fromHome?.id).toBe('b');
        expect(fromYourDay?.id).toBe(fromHome?.id);
    });

    it('skips completed and skipped tasks', () => {
        const plan = [
            task({ id: 'a', type: 'theory', status: 'completed' }),
            task({ id: 'b', type: 'practice', status: 'skipped' }),
            task({ id: 'c', type: 'puzzles', status: 'pending' }),
        ];
        expect(findNextIncompleteTask(plan)?.id).toBe('c');
    });

    it('returns null when nothing is open', () => {
        expect(findNextIncompleteTask([task({ type: 'theory', status: 'completed' })])).toBeNull();
        expect(findNextIncompleteTask([])).toBeNull();
    });
});

describe('INVARIANT 2 — discovery never completes daily tasks', () => {
    it('a completed discovery session still completes nothing', () => {
        const plan = [task({ id: 'a', type: 'theory', status: 'pending' })];
        const result = resolveCompletionPlan({
            blueprint: micro(),
            outcome: 'pass',
            tasks: plan,
            targetTaskId: null,
        });
        expect(result.completeTask).toBe(false);
        expect(result.advance).toBe(false);
        expect(result.nextTask?.id).toBe('a');
    });
});

describe('INVARIANT 3 — discovery never increases certification', () => {
    it('discovery artifacts map to no skill', () => {
        const program = getProgramForHobby('python')!;
        expect(
            artifactToAnswer(program, {
                hobbyId: 'python',
                lessonId: 'discovery-plane-trails',
                taskType: 'do',
                verdict: 'pass',
            }),
        ).toBeNull();
    });
});

describe('INVARIANT 5 — Start continues the DailyPlan', () => {
    it('structured completion advances + credits + points at the next task', () => {
        const plan = [
            task({ id: 'a', type: 'theory', status: 'completed' }),
            task({ id: 'b', type: 'practice', status: 'pending' }),
            task({ id: 'c', type: 'puzzles', status: 'pending' }),
        ];
        const result = resolveCompletionPlan({
            blueprint: standard(),
            outcome: 'pass',
            tasks: plan,
            targetTaskId: 'b',
        });
        expect(result.advance).toBe(true);
        expect(result.completeTask).toBe(true);
        expect(result.showAllDone).toBe(false);
        expect(result.nextTask?.id).toBe('c');
    });

    it('failed work earns nothing and keeps the task open', () => {
        const plan = [task({ id: 'b', type: 'practice', status: 'pending' })];
        const result = resolveCompletionPlan({
            blueprint: standard(),
            outcome: 'fail',
            tasks: plan,
            targetTaskId: 'b',
        });
        expect(result.advance).toBe(false);
        expect(result.completeTask).toBe(false);
        expect(result.nextTask?.id).toBe('b');
    });
});

describe('INVARIANT 6 — all-done only when the plan is complete', () => {
    it('does not celebrate a partially done plan', () => {
        const plan = [
            task({ id: 'a', type: 'theory', status: 'completed' }),
            task({ id: 'b', type: 'practice', status: 'pending' }),
        ];
        expect(shouldShowAllDone(plan)).toBe(false);
        const result = resolveCompletionPlan({
            blueprint: standard(),
            outcome: 'pass',
            tasks: plan,
            targetTaskId: 'b',
        });
        expect(result.showAllDone).toBe(true);
        expect(result.nextTask).toBeNull();
    });

    it('empty plan is not "all done"', () => {
        expect(shouldShowAllDone([])).toBe(false);
    });
});

describe('INVARIANT 7 — program tasks resolve program skills', () => {
    it('python tasks map into the python program', () => {
        const program = getProgramForHobby('python')!;
        const tagged = taskSkillKey(
            { hobby_id: 'python', scheduled_date: '2026-09-09' },
            '2026-09-01',
        );
        expect(tagged).not.toBeNull();
        expect(tagged!.programSlug).toBe(program.slug);
        expect(program.skills.some((s) => s.key === tagged!.skillKey)).toBe(true);
    });

    it('unmapped tasks resolve to null, never to a foreign skill', () => {
        expect(taskSkillKey({ hobby_id: 'klingon', scheduled_date: '2026-09-09' }, '2026-09-01')).toBeNull();
        expect(taskSkillKey({ hobby_id: null, scheduled_date: '2026-09-09' }, null)).toBeNull();
    });
});

describe('INVARIANT 8 — progress derives from data, and session context parses safely', () => {
    it('isEngineTask only admits the four core types', () => {
        expect(isEngineTask({ type: 'practice' })).toBe(true);
        expect(isEngineTask({ type: 'freetime' })).toBe(false);
    });

    it('parseSessionParams validates kinds, origins, ids', () => {
        const ok = parseSessionParams({
            minutes: '15',
            taskId: 'demo-1',
            origin: 'your_day',
            kind: 'structured',
        });
        expect(ok.context).toMatchObject({ kind: 'structured', origin: 'your_day', taskId: 'demo-1' });
        expect(ok.minutes).toBe(15);

        const evil = parseSessionParams({
            minutes: '-5',
            taskId: '../../etc',
            origin: 'hacker',
            kind: 'godmode',
        });
        expect(evil.minutes).toBeUndefined();
        expect(evil.taskId).toBeNull();
        expect(evil.context.origin).toBe('home_start');
        expect(evil.context.kind).toBe('structured');
        expect(normalizeKind('discovery')).toBe('discovery');
    });
});
