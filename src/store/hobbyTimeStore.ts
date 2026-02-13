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

    // Computed helpers
    getTotalSeconds: () => number;
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

                const existingIndex = weeklyData.findIndex(d => d.date === today);

                if (existingIndex >= 0) {
                    const newData = [...weeklyData];
                    newData[existingIndex].seconds += seconds;
                    set({ weeklyData: newData });
                } else {
                    set({ weeklyData: [...weeklyData, { date: today, seconds }] });
                }
            },

            setUserCreatedDate: (userCreatedDate) => set({ userCreatedDate }),

            getTotalSeconds: () => {
                return get().weeklyData.reduce((acc, curr) => acc + curr.seconds, 0);
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

                if (weeklyData.length < 2) {
                    return { value: 0, isNewUser };
                }

                if (isNewUser) {
                    // Day-to-day comparison for new users
                    const sortedData = [...weeklyData].sort((a, b) =>
                        new Date(b.date).getTime() - new Date(a.date).getTime()
                    );

                    if (sortedData.length < 2) return { value: 0, isNewUser };

                    const today = sortedData[0].seconds;
                    const yesterday = sortedData[1].seconds;

                    if (yesterday === 0) return { value: 100, isNewUser };

                    const change = ((today - yesterday) / yesterday) * 100;
                    return { value: Math.round(change), isNewUser };
                } else {
                    // Week-to-week comparison for existing users
                    const sortedData = [...weeklyData].sort((a, b) =>
                        new Date(a.date).getTime() - new Date(b.date).getTime()
                    );

                    // Split into this week and last week
                    const thisWeekStart = sortedData.length >= 7
                        ? sortedData.slice(-7)
                        : sortedData;
                    const lastWeekData = sortedData.length >= 14
                        ? sortedData.slice(-14, -7)
                        : [];

                    const thisWeekTotal = thisWeekStart.reduce((acc, d) => acc + d.seconds, 0);
                    const lastWeekTotal = lastWeekData.reduce((acc, d) => acc + d.seconds, 0);

                    if (lastWeekTotal === 0) return { value: 45, isNewUser }; // Mock positive for demo

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
