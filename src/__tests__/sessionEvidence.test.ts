/**
 * Session evidence deltas: snapshot the credential skill graph before a
 * session, diff it after. Pure derivation over existing engine data —
 * no new tables.
 */
import { useTaskStore } from '../store/taskStore';
import { useGamificationStore } from '../store/gamificationStore';
import { useCredentialStore } from '../store/credentialStore';
import { getProgramForHobby } from '../domain/credentials/catalog';
import { captureSkillSnapshot, diffSkillSnapshot, toEngineTaskInputs, weakestOpenSkill } from '../services/sessionEvidence';

jest.mock('../services/taskService', () => ({
    taskService: {
        getDailyPlan: () => Promise.reject(new Error('offline')),
        createManualTask: () => Promise.reject(new Error('offline')),
        completeTask: () => Promise.reject(new Error('offline')),
        uncompleteTask: () => Promise.reject(new Error('offline')),
        skipTask: () => Promise.reject(new Error('offline')),
    },
}));
jest.mock('../services/ai', () => ({
    aiService: { sendMessage: jest.fn(), gradeAnswer: jest.fn() },
}));
jest.mock('../store/hobbyTimeStore', () => ({
    useHobbyTimeStore: { getState: () => ({ reset: jest.fn() }) },
}));
jest.mock('../store/screenTimeStore', () => ({
    useScreenTimeStore: { getState: () => ({ reset: jest.fn() }) },
}));
jest.mock('../store/earningsStore', () => ({
    useEarningsStore: { getState: () => ({ reset: jest.fn() }) },
}));
jest.mock('../store/contentStore', () => ({
    useContentStore: { getState: () => ({ reset: jest.fn() }) },
}));
jest.mock('../store/deviceScreenTimeStore', () => ({
    useDeviceScreenTimeStore: { getState: () => ({ reset: jest.fn() }) },
}));
jest.mock('../store/subscriptionStore', () => ({
    useSubscriptionStore: { getState: () => ({ reset: jest.fn() }) },
}));
jest.mock('expo-auth-session', () => ({ makeRedirectUri: jest.fn(() => 'e2e://redirect') }));
jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: jest.fn() }));
jest.mock('expo-apple-authentication', () => ({}));
jest.mock('expo-crypto', () => ({ digestStringAsync: jest.fn() }));

const TODAY = new Date().toISOString().split('T')[0];

function seedTasks(status: 'pending' | 'completed') {
    useTaskStore.setState({
        dailyTasks: [
            {
                id: 'ev-theory',
                user_id: 'u',
                title: 'Theory',
                type: 'theory',
                status,
                hobby_id: 'python',
                scheduled_date: TODAY,
                duration_minutes: 15,
            },
            {
                id: 'ev-practice',
                user_id: 'u',
                title: 'Practice',
                type: 'practice',
                status,
                hobby_id: 'python',
                scheduled_date: TODAY,
                duration_minutes: 30,
            },
        ],
        lastFetchDate: TODAY,
        loading: false,
        error: null,
    });
}

describe('sessionEvidence deltas', () => {
    beforeEach(() => {
        const program = getProgramForHobby('python');
        expect(program).toBeDefined();
        useCredentialStore.getState().enroll(program!.slug);
        useGamificationStore.setState({ artifacts: [] });
    });

    it('captures a skill snapshot for a program hobby', () => {
        seedTasks('pending');
        const snap = captureSkillSnapshot('python');
        expect(snap).not.toBeNull();
        expect(snap!.slug).toBe(getProgramForHobby('python')!.slug);
        expect(typeof snap!.overall).toBe('number');
        expect(Object.keys(snap!.skills).length).toBeGreaterThan(0);
    });

    it('returns null without a program hobby', () => {
        expect(captureSkillSnapshot(null)).toBeNull();
        expect(captureSkillSnapshot('klingon')).toBeNull();
    });

    it('diffs an unchanged state to zero moves', () => {
        seedTasks('pending');
        const before = captureSkillSnapshot('python');
        const delta = diffSkillSnapshot(before, 'python', {
            minutes: 5,
            rewarded: false,
            verifiedCount: 0,
            taskCompletedTitle: null,
        });
        expect(delta.minutes).toBe(5);
        expect(delta.moves).toEqual([]);
        expect(delta.overallFrom).toBe(delta.overallTo);
    });

    it('reflects completed work and verdict artifacts in the delta', () => {        seedTasks('pending');
        const before = captureSkillSnapshot('python');

        // Session completes a task + stores a passing artifact.
        seedTasks('completed');
        useGamificationStore.setState({
            artifacts: [
                {
                    id: 'a1',
                    date: TODAY,
                    hobbyId: 'python',
                    lessonId: 'python_d1',
                    taskType: 'do',
                    userInput: 'x = 5',
                    aiFeedback: '👍 Отлично!',
                },
            ],
        });

        const delta = diffSkillSnapshot(before, 'python', {
            minutes: 12,
            rewarded: true,
            verifiedCount: 1,
            taskCompletedTitle: 'Practice',
        });
        expect(delta.programTitle).toBeTruthy();
        expect(delta.verifiedCount).toBe(1);
        expect(Array.isArray(delta.moves)).toBe(true);
        // Evidence can only move scores up, never down.
        for (const m of delta.moves) {
            expect(m.to).toBeGreaterThan(m.from);
        }
    });
});

describe('bite helpers', () => {
    it('maps daily tasks to engine inputs', () => {
        const inputs = toEngineTaskInputs([
            { type: 'practice', status: 'completed', hobby_id: 'python', duration_minutes: 30, scheduled_date: '2026-09-09' },
        ]);
        expect(inputs).toEqual([
            { type: 'practice', status: 'completed', hobby_id: 'python', duration_minutes: 30, scheduled_date: '2026-09-09' },
        ]);
    });

    it('picks the weakest unpassed skill, falling back to the first', () => {
        const program = getProgramForHobby('python')!;
        const empty: any = { skillGraph: { weakestSkills: [] } };
        expect(weakestOpenSkill(program, empty)?.skillKey).toBe(program.skills[0].key);
        expect(weakestOpenSkill(program, null)?.skillKey).toBe(program.skills[0].key);

        const partial: any = {
            skillGraph: {
                weakestSkills: [
                    { skillKey: 'a', name: 'A', score: 80, passed: true },
                    { skillKey: 'b', name: 'B', score: 20, passed: false },
                ],
            },
        };
        expect(weakestOpenSkill(program, partial)).toEqual({ skillKey: 'b', name: 'B', score: 20 });
    });
});
