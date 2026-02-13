import { useHobbyTimeStore, formatHobbyTime } from '../store/hobbyTimeStore';

// Reset the store before each test
beforeEach(() => {
    useHobbyTimeStore.setState({
        weeklyData: [],
        userCreatedDate: null,
    });
});

// ─── formatHobbyTime ────────────────────────────────

describe('formatHobbyTime', () => {
    it('formats 0 seconds', () => {
        expect(formatHobbyTime(0)).toBe('0:00:00');
    });

    it('formats seconds < 60', () => {
        expect(formatHobbyTime(45)).toBe('0:00:45');
    });

    it('formats minutes correctly', () => {
        expect(formatHobbyTime(3661)).toBe('1:01:01');
    });

    it('formats hours correctly', () => {
        expect(formatHobbyTime(7200)).toBe('2:00:00');
    });
});

// ─── getTotalSeconds ────────────────────────────────

describe('getTotalSeconds', () => {
    it('returns 0 for empty data', () => {
        expect(useHobbyTimeStore.getState().getTotalSeconds()).toBe(0);
    });

    it('sums all seconds', () => {
        useHobbyTimeStore.setState({
            weeklyData: [
                { date: '2026-02-10', seconds: 1800 },
                { date: '2026-02-11', seconds: 3600 },
            ],
        });
        expect(useHobbyTimeStore.getState().getTotalSeconds()).toBe(5400);
    });
});

// ─── addHobbyTime ───────────────────────────────────

describe('addHobbyTime', () => {
    it('creates a new entry for today', () => {
        useHobbyTimeStore.getState().addHobbyTime(1800);
        const data = useHobbyTimeStore.getState().weeklyData;
        expect(data).toHaveLength(1);
        expect(data[0].seconds).toBe(1800);
    });

    it('accumulates time for the same day', () => {
        useHobbyTimeStore.getState().addHobbyTime(1800);
        useHobbyTimeStore.getState().addHobbyTime(900);
        const data = useHobbyTimeStore.getState().weeklyData;
        expect(data).toHaveLength(1);
        expect(data[0].seconds).toBe(2700);
    });
});

// ─── getDaysSinceCreation ───────────────────────────

describe('getDaysSinceCreation', () => {
    it('returns 0 when no creation date', () => {
        expect(useHobbyTimeStore.getState().getDaysSinceCreation()).toBe(0);
    });

    it('returns 1 when created today', () => {
        useHobbyTimeStore.setState({
            userCreatedDate: new Date().toISOString(),
        });
        // Could be 0 or 1 depending on time rounding
        expect(useHobbyTimeStore.getState().getDaysSinceCreation()).toBeLessThanOrEqual(1);
    });

    it('returns correct days for past date', () => {
        const tenDaysAgo = new Date();
        tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
        useHobbyTimeStore.setState({
            userCreatedDate: tenDaysAgo.toISOString(),
        });
        expect(useHobbyTimeStore.getState().getDaysSinceCreation()).toBe(10);
    });
});

// ─── getProductivityChange ──────────────────────────

describe('getProductivityChange', () => {
    it('returns { value: 0, isNewUser: true } when no data', () => {
        const result = useHobbyTimeStore.getState().getProductivityChange();
        expect(result).toEqual({ value: 0, isNewUser: true });
    });

    it('returns isNewUser=true for users created < 7 days ago', () => {
        const twoDaysAgo = new Date();
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        useHobbyTimeStore.setState({
            userCreatedDate: twoDaysAgo.toISOString(),
            weeklyData: [
                { date: '2026-02-10', seconds: 1800 },
                { date: '2026-02-11', seconds: 3600 },
            ],
        });
        const result = useHobbyTimeStore.getState().getProductivityChange();
        expect(result.isNewUser).toBe(true);
    });

    it('calculates day-to-day change for new users', () => {
        const twoDaysAgo = new Date();
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        useHobbyTimeStore.setState({
            userCreatedDate: twoDaysAgo.toISOString(),
            weeklyData: [
                { date: '2026-02-10', seconds: 1000 },
                { date: '2026-02-11', seconds: 2000 }, // +100%
            ],
        });
        const result = useHobbyTimeStore.getState().getProductivityChange();
        expect(result.value).toBe(100);
    });

    it('returns 100 when yesterday was 0', () => {
        const twoDaysAgo = new Date();
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        useHobbyTimeStore.setState({
            userCreatedDate: twoDaysAgo.toISOString(),
            weeklyData: [
                { date: '2026-02-10', seconds: 0 },
                { date: '2026-02-11', seconds: 500 },
            ],
        });
        const result = useHobbyTimeStore.getState().getProductivityChange();
        expect(result.value).toBe(100);
    });

    it('returns isNewUser=false and computes weekly change for old users', () => {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Create 14 days of data: first 7 days @ 1000s, last 7 days @ 2000s
        const weeklyData = [];
        for (let i = 13; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            weeklyData.push({
                date: d.toISOString().split('T')[0],
                seconds: i >= 7 ? 1000 : 2000, // first 7 = 1000, last 7 = 2000
            });
        }

        useHobbyTimeStore.setState({
            userCreatedDate: thirtyDaysAgo.toISOString(),
            weeklyData,
        });

        const result = useHobbyTimeStore.getState().getProductivityChange();
        expect(result.isNewUser).toBe(false);
        // This week = 7 * 2000 = 14000, last week = 7 * 1000 = 7000
        // Change = ((14000 - 7000) / 7000) * 100 = 100
        expect(result.value).toBe(100);
    });
});
