import { useTaskStore } from '../store/taskStore';
import { TaskType } from '../services/supabase/types';

// ─── Mock services ───────────────────────────────────
const mockGetDailyPlan = jest.fn();
const mockCompleteTask = jest.fn();
const mockSkipTask = jest.fn();

jest.mock('../services/taskService', () => ({
    taskService: {
        getDailyPlan: (...args: unknown[]) => mockGetDailyPlan(...args),
        completeTask: (...args: unknown[]) => mockCompleteTask(...args),
        skipTask: (...args: unknown[]) => mockSkipTask(...args),
    },
}));

// ─── Helpers ─────────────────────────────────────────

const TASK_TYPES: TaskType[] = ['learning', 'practice', 'action', 'wellbeing'];

const makeTasks = (count: number) =>
    Array.from({ length: count }, (_, i) => ({
        id: `task-${i}`,
        user_id: 'user-123',
        date: '2023-10-27',
        scheduled_date: '2023-10-27',
        type: TASK_TYPES[i % 4],
        title: `Task ${i}`,
        description: `Description ${i}`,
        duration_minutes: 30,
        status: 'pending' as const,
        hobby_id: 'chess',
    }));

// ─── Reset ───────────────────────────────────────────

beforeEach(() => {
    jest.clearAllMocks();

    useTaskStore.setState({
        dailyTasks: [],
        snapshot: null,
        loading: false,
        error: null,
        lastFetchDate: null,
    });
});

// ─── fetchDailyPlan ──────────────────────────────────

describe('useTaskStore — fetchDailyPlan', () => {
    it('fetches and stores tasks', async () => {
        const tasks = makeTasks(4);
        mockGetDailyPlan.mockResolvedValue(tasks);

        await useTaskStore.getState().fetchDailyPlan('user-123');

        const state = useTaskStore.getState();
        expect(state.dailyTasks).toHaveLength(4);
        expect(state.loading).toBe(false);
        expect(state.error).toBeNull();
        expect(state.lastFetchDate).toBe(new Date().toISOString().split('T')[0]);
    });

    it('uses cache when tasks already fetched today', async () => {
        const today = new Date().toISOString().split('T')[0];
        useTaskStore.setState({
            dailyTasks: makeTasks(4),
            lastFetchDate: today,
        });

        await useTaskStore.getState().fetchDailyPlan('user-123');

        expect(mockGetDailyPlan).not.toHaveBeenCalled();
    });

    it('refetches when last fetch was a different day', async () => {
        useTaskStore.setState({
            dailyTasks: makeTasks(4),
            lastFetchDate: '2020-01-01',
        });

        mockGetDailyPlan.mockResolvedValue(makeTasks(4));
        await useTaskStore.getState().fetchDailyPlan('user-123');

        expect(mockGetDailyPlan).toHaveBeenCalled();
    });

    it('sets error on failure', async () => {
        mockGetDailyPlan.mockRejectedValue(new Error('DB unreachable'));

        await useTaskStore.getState().fetchDailyPlan('user-123');

        const state = useTaskStore.getState();
        expect(state.error).toBe('DB unreachable');
        expect(state.loading).toBe(false);
    });

    it('handles non-Error throw', async () => {
        mockGetDailyPlan.mockRejectedValue('string error');

        await useTaskStore.getState().fetchDailyPlan('user-123');

        expect(useTaskStore.getState().error).toBe('Unknown error');
    });
});

// ─── completeTask ────────────────────────────────────

describe('useTaskStore — completeTask', () => {
    it('optimistically marks task completed', async () => {
        useTaskStore.setState({ dailyTasks: makeTasks(4) });
        mockCompleteTask.mockResolvedValue({ ...makeTasks(1)[0], id: 'task-0', status: 'completed' });

        const promise = useTaskStore.getState().completeTask('user-123', 'task-0');

        // Immediately after calling, task should be optimistically completed
        const optimistic = useTaskStore.getState().dailyTasks.find(t => t.id === 'task-0');
        expect(optimistic?.status).toBe('completed');

        await promise;
    });

    it('rolls back on failure', async () => {
        useTaskStore.setState({ dailyTasks: makeTasks(4) });
        mockCompleteTask.mockRejectedValue(new Error('Server error'));

        await useTaskStore.getState().completeTask('user-123', 'task-0');

        const task = useTaskStore.getState().dailyTasks.find(t => t.id === 'task-0');
        expect(task?.status).toBe('pending');
        expect(useTaskStore.getState().error).toBe('Failed to update task status');
    });

    it('replaces task with server response', async () => {
        useTaskStore.setState({ dailyTasks: makeTasks(4) });
        const serverTask = { ...makeTasks(1)[0], id: 'task-0', status: 'completed', xp_earned: 50 };
        mockCompleteTask.mockResolvedValue(serverTask);

        await useTaskStore.getState().completeTask('user-123', 'task-0');

        const task = useTaskStore.getState().dailyTasks.find(t => t.id === 'task-0');
        expect(task?.status).toBe('completed');
    });
});

// ─── skipTask ────────────────────────────────────────

describe('useTaskStore — skipTask', () => {
    it('optimistically marks task skipped', async () => {
        useTaskStore.setState({ dailyTasks: makeTasks(4) });
        mockSkipTask.mockResolvedValue({ ...makeTasks(1)[0], id: 'task-1', status: 'skipped' });

        const promise = useTaskStore.getState().skipTask('user-123', 'task-1');

        const optimistic = useTaskStore.getState().dailyTasks.find(t => t.id === 'task-1');
        expect(optimistic?.status).toBe('skipped');

        await promise;
    });

    it('rolls back on failure', async () => {
        useTaskStore.setState({ dailyTasks: makeTasks(4) });
        mockSkipTask.mockRejectedValue(new Error('Network error'));

        await useTaskStore.getState().skipTask('user-123', 'task-1');

        const task = useTaskStore.getState().dailyTasks.find(t => t.id === 'task-1');
        expect(task?.status).toBe('pending');
    });
});

// ─── resetTasks ──────────────────────────────────────

describe('useTaskStore — resetTasks', () => {
    it('clears tasks and fetch date', () => {
        useTaskStore.setState({
            dailyTasks: makeTasks(4),
            lastFetchDate: '2023-10-27',
            error: 'some error',
        });

        useTaskStore.getState().resetTasks();

        const state = useTaskStore.getState();
        expect(state.dailyTasks).toEqual([]);
        expect(state.lastFetchDate).toBeNull();
        expect(state.error).toBeNull();
    });
});
