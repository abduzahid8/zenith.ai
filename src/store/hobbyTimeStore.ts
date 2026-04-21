import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface DayData {
    date: string;
    seconds: number;
}

interface HobbyTimeState {
    // Data
    weeklyData: DayData[];
    userCreatedDate: string | null; // ISO date string when user started

    // Actions
    setWeeklyData: (data: DayData[]) => void;
    addHobbyTime: (seconds: number) => void;
    setUserCreatedDate: (date: string) => void;
    reset: () => void;

    // Computed helpers
    getTotalSeconds: () => number;
    getThisWeekSeconds: () => number;
    getDaysSinceCreation: () => number;
    getProductivityChange: () => { value: number; isNewUser: boolean };
}


export const useHobbyTimeStore = create<HobbyTimeState>()(
    persist(
        (set, get) => ({
            weeklyData: [],
            userCreatedDate: null,

            setWeeklyData: (weeklyData) => set({ weeklyData }),

            addHobbyTime: (seconds) => {
                const today = new Date().toISOString().split('T')[0];
                const { weeklyData } = get();
                console.log('[hobbyTimeStore] addHobbyTime called - seconds:', seconds, 'today:', today, 'weeklyData before:', JSON.stringify(weeklyData));

                const existingIndex = weeklyData.findIndex(d => d.date === today);

                if (existingIndex >= 0) {
                    const newData = [...weeklyData];
                    newData[existingIndex].seconds += seconds;
                    set({ weeklyData: newData });
                } else {
                    set({ weeklyData: [...weeklyData, { date: today, seconds }] });
                }
                console.log('[hobbyTimeStore] addHobbyTime done - weeklyData after:', JSON.stringify(get().weeklyData));
            },

            setUserCreatedDate: (userCreatedDate) => set({ userCreatedDate }),

            reset: () => set({ weeklyData: [], userCreatedDate: null }),

            getTotalSeconds: () => {
                return get().weeklyData.reduce((acc, curr) => acc + curr.seconds, 0);
            },

            getThisWeekSeconds: () => {
                const today = new Date();
                const weekAgo = new Date(today);
                weekAgo.setDate(today.getDate() - 6);
                weekAgo.setHours(0, 0, 0, 0);
                return get().weeklyData
                    .filter(d => new Date(d.date) >= weekAgo)
                    .reduce((acc, curr) => acc + curr.seconds, 0);
            },

            getDaysSinceCreation: () => {
                const { userCreatedDate } = get();
                if (!userCreatedDate) return 0;

                const created = new Date(userCreatedDate);
                const now = new Date();
                const diffTime = Math.abs(now.getTime() - created.getTime());
                return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            },

            getProductivityChange: () => {
                const { weeklyData } = get();
                const daysSinceCreation = get().getDaysSinceCreation();
                const isNewUser = daysSinceCreation < 7;

                if (weeklyData.length === 0) {
                    return { value: 0, isNewUser };
                }

                const now = new Date();
                const todayStr = now.toISOString().split('T')[0];
                const yesterdayDate = new Date(now);
                yesterdayDate.setDate(now.getDate() - 1);
                const yesterdayStr = yesterdayDate.toISOString().split('T')[0];

                if (isNewUser) {
                    // Day-to-day comparison using actual today / yesterday dates
                    const todaySeconds = weeklyData.find(d => d.date === todayStr)?.seconds ?? 0;
                    const yesterdaySeconds = weeklyData.find(d => d.date === yesterdayStr)?.seconds ?? 0;

                    if (yesterdaySeconds === 0) return { value: todaySeconds > 0 ? 100 : 0, isNewUser };

                    const change = ((todaySeconds - yesterdaySeconds) / yesterdaySeconds) * 100;
                    return { value: Math.round(change), isNewUser };
                } else {
                    // Week-to-week comparison using actual calendar week boundaries (string-based to avoid TZ issues)
                    const dayOfWeek = now.getDay(); // 0 = Sun
                    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

                    const thisMonday = new Date(now);
                    thisMonday.setDate(now.getDate() - daysFromMonday);
                    const thisMondayStr = thisMonday.toISOString().split('T')[0];

                    const lastMonday = new Date(thisMonday);
                    lastMonday.setDate(thisMonday.getDate() - 7);
                    const lastMondayStr = lastMonday.toISOString().split('T')[0];

                    const lastSunday = new Date(thisMonday);
                    lastSunday.setDate(thisMonday.getDate() - 1);
                    const lastSundayStr = lastSunday.toISOString().split('T')[0];

                    const thisWeekTotal = weeklyData
                        .filter(d => d.date >= thisMondayStr && d.date <= todayStr)
                        .reduce((acc, d) => acc + d.seconds, 0);

                    const lastWeekTotal = weeklyData
                        .filter(d => d.date >= lastMondayStr && d.date <= lastSundayStr)
                        .reduce((acc, d) => acc + d.seconds, 0);

                    if (lastWeekTotal === 0) return { value: thisWeekTotal > 0 ? 100 : 0, isNewUser };

                    const change = ((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100;
                    return { value: Math.round(change), isNewUser };
                }
            },
        }),
        {
            name: 'hobby-time-storage',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({
                weeklyData: state.weeklyData,
                userCreatedDate: state.userCreatedDate,
            }),
        }
    )
);

// Helper to format seconds as HH:MM:SS
export const formatHobbyTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

export default useHobbyTimeStore;
