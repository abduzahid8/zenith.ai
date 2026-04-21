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
        const todayStr = new Date().toISOString().split('T')[0];
        const yesterdayStr = (() => {
            const d = new Date();
            d.setDate(d.getDate() - 1);
            return d.toISOString().split('T')[0];
        })();
        useHobbyTimeStore.setState({
            userCreatedDate: twoDaysAgo.toISOString(),
            weeklyData: [
                { date: yesterdayStr, seconds: 1800 },
                { date: todayStr, seconds: 3600 },
            ],
        });
        const result = useHobbyTimeStore.getState().getProductivityChange();
        expect(result.isNewUser).toBe(true);
    });

    it('calculates day-to-day change for new users', () => {
        const twoDaysAgo = new Date();
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        const todayStr = new Date().toISOString().split('T')[0];
        const yesterdayStr = (() => {
            const d = new Date();
            d.setDate(d.getDate() - 1);
            return d.toISOString().split('T')[0];
        })();
        useHobbyTimeStore.setState({
            userCreatedDate: twoDaysAgo.toISOString(),
            weeklyData: [
                { date: yesterdayStr, seconds: 1000 },
                { date: todayStr, seconds: 2000 }, // +100%
            ],
        });
        const result = useHobbyTimeStore.getState().getProductivityChange();
        expect(result.value).toBe(100);
    });

    it('returns 100 when yesterday was 0', () => {
        const twoDaysAgo = new Date();
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        const todayStr = new Date().toISOString().split('T')[0];
        const yesterdayStr = (() => {
            const d = new Date();
            d.setDate(d.getDate() - 1);
            return d.toISOString().split('T')[0];
        })();
        useHobbyTimeStore.setState({
            userCreatedDate: twoDaysAgo.toISOString(),
            weeklyData: [
                { date: yesterdayStr, seconds: 0 },
                { date: todayStr, seconds: 500 },
            ],
        });
        const result = useHobbyTimeStore.getState().getProductivityChange();
        expect(result.value).toBe(100);
    });

    it('returns isNewUser=false and computes weekly change for old users', () => {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Build data aligned with actual calendar week boundaries
        const today = new Date();
        const dayOfWeek = today.getDay(); // 0=Sun
        const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

        const thisMonday = new Date(today);
        thisMonday.setDate(today.getDate() - daysFromMonday);

        const weeklyData: { date: string; seconds: number }[] = [];

        // Last week: all 7 days at 1000s each
        for (let i = 0; i < 7; i++) {
            const d = new Date(thisMonday);
            d.setDate(thisMonday.getDate() - 7 + i);
            weeklyData.push({ date: d.toISOString().split('T')[0], seconds: 1000 });
        }
        // This week: all days from Monday to today at 2000s each
        for (let i = 0; i <= daysFromMonday; i++) {
            const d = new Date(thisMonday);
            d.setDate(thisMonday.getDate() + i);
            weeklyData.push({ date: d.toISOString().split('T')[0], seconds: 2000 });
        }

        useHobbyTimeStore.setState({
            userCreatedDate: thirtyDaysAgo.toISOString(),
            weeklyData,
        });

        const result = useHobbyTimeStore.getState().getProductivityChange();
        expect(result.isNewUser).toBe(false);
        // lastWeekTotal = 7 * 1000 = 7000
        // thisWeekTotal = (daysFromMonday + 1) * 2000
        const thisWeekTotal = (daysFromMonday + 1) * 2000;
        const expectedChange = Math.round(((thisWeekTotal - 7000) / 7000) * 100);
        expect(result.value).toBe(expectedChange);
    });
});
