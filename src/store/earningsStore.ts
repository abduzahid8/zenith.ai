// Earnings Store
// Zustand store for earning methods and income tracking

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { earningsService, EarningMatch, PersonalizedMoneyPath } from '../services/earningsService';
import { EarningMethod, UserEarning, UserProfile } from '../services/supabase';

interface EarningsState {
    // Data
    recommendations: EarningMatch[];
    activePaths: UserEarning[];
    successfulEarnings: UserEarning[];
    currentPath: PersonalizedMoneyPath | null;
    allMethods: EarningMethod[];

    // Summary
    summary: {
        total_earned: number;
        active_paths: number;
        successful_paths: number;
        first_earning_date: string | null;
    } | null;

    // Loading states
    isLoading: boolean;
    isRecommendationsLoading: boolean;
    error: string | null;

    // Actions
    initialize: (userId: string, userProfile?: Partial<UserProfile>) => Promise<void>;
    loadRecommendations: (userId: string, userProfile: Partial<UserProfile>) => Promise<void>;
    loadAIRecommendations: (userProfile: Partial<UserProfile>, hobbies: string[]) => Promise<void>;
    loadActivePaths: (userId: string) => Promise<void>;

    // Path actions
    startPath: (userId: string, earningMethodId: string) => Promise<void>;
    generateMoneyPath: (userProfile: Partial<UserProfile>, method: EarningMethod) => Promise<void>;
    updateProgress: (userId: string, methodId: string, updates: {
        status?: UserEarning['status'];
        current_step?: number;
        progress_notes?: string;
    }) => Promise<void>;
    recordEarning: (userId: string, methodId: string, amount: number) => Promise<void>;

    // View management
    setCurrentPath: (path: PersonalizedMoneyPath | null) => void;

    clearError: () => void;
    reset: () => void;
}

const initialState = {
    recommendations: [],
    activePaths: [],
    successfulEarnings: [],
    currentPath: null,
    allMethods: [],
    summary: null,
    isLoading: false,
    isRecommendationsLoading: false,
    error: null,
};

export const useEarningsStore = create<EarningsState>()(
    persist(
        (set, get) => ({
            ...initialState,

            initialize: async (userId: string, userProfile?: Partial<UserProfile>) => {
                try {
                    set({ isLoading: true, error: null });

                    // Load all earnings data
                    const [activePaths, successfulEarnings, summary, allMethods] = await Promise.all([
                        earningsService.getActivePaths(userId),
                        earningsService.getSuccessfulEarnings(userId),
                        earningsService.getEarningsSummary(userId),
                        earningsService.getAllMethods(),
                    ]);

                    set({
                        activePaths,
                        successfulEarnings,
                        summary,
                        allMethods,
                        isLoading: false,
                    });

                    // Load recommendations if profile available
                    if (userProfile) {
                        await get().loadRecommendations(userId, userProfile);
                    }

                } catch (error) {
                    console.error('Earnings store init error:', error);
                    set({ error: 'Не удалось загрузить данные о заработке', isLoading: false });
                }
            },

            loadRecommendations: async (userId: string, userProfile: Partial<UserProfile>) => {
                try {
                    set({ isRecommendationsLoading: true });
                    const recommendations = await earningsService.getPersonalizedRecommendations(
                        userId,
                        userProfile
                    );
                    set({ recommendations, isRecommendationsLoading: false });
                } catch (error) {
                    console.error('Load recommendations error:', error);
                    set({ isRecommendationsLoading: false });
                }
            },

            loadAIRecommendations: async (userProfile: Partial<UserProfile>, hobbies: string[]) => {
                try {
                    set({ isRecommendationsLoading: true });
                    const aiRecommendations = await earningsService.getAIEarningIdeas(
                        userProfile,
                        hobbies
                    );

                    // Merge with existing recommendations
                    const { recommendations } = get();
                    const merged = [...recommendations, ...aiRecommendations]
                        .sort((a, b) => b.match_score - a.match_score)
                        .slice(0, 10);

                    set({ recommendations: merged, isRecommendationsLoading: false });
                } catch (error) {
                    console.error('Load AI recommendations error:', error);
                    set({ isRecommendationsLoading: false });
                }
            },

            loadActivePaths: async (userId: string) => {
                try {
                    const [activePaths, successfulEarnings] = await Promise.all([
                        earningsService.getActivePaths(userId),
                        earningsService.getSuccessfulEarnings(userId),
                    ]);
                    set({ activePaths, successfulEarnings });
                } catch (error) {
                    console.error('Load active paths error:', error);
                }
            },

            startPath: async (userId: string, earningMethodId: string) => {
                try {
                    const newPath = await earningsService.startPath(userId, earningMethodId);
                    set(state => ({
                        activePaths: [...state.activePaths, newPath],
                    }));
                } catch (error) {
                    console.error('Start path error:', error);
                    set({ error: 'Не удалось начать путь' });
                }
            },

            generateMoneyPath: async (userProfile: Partial<UserProfile>, method: EarningMethod) => {
                try {
                    const path = await earningsService.generateMoneyPath(userProfile, method);
                    set({ currentPath: path });
                } catch (error) {
                    console.error('Generate money path error:', error);
                }
            },

            updateProgress: async (userId: string, methodId: string, updates) => {
                try {
                    await earningsService.updateProgress(userId, methodId, updates);
                    // Refresh active paths
                    await get().loadActivePaths(userId);
                } catch (error) {
                    console.error('Update progress error:', error);
                    set({ error: 'Не удалось обновить прогресс' });
                }
            },

            recordEarning: async (userId: string, methodId: string, amount: number) => {
                try {
                    await earningsService.recordEarning(userId, methodId, amount);

                    // Update summary
                    const summary = await earningsService.getEarningsSummary(userId);
                    set({ summary });

                    // Move to successful if first earning
                    await get().loadActivePaths(userId);
                } catch (error) {
                    console.error('Record earning error:', error);
                    set({ error: 'Не удалось записать заработок' });
                }
            },

            setCurrentPath: (path) => set({ currentPath: path }),

            clearError: () => set({ error: null }),

            reset: () => set(initialState),
        }),
        {
            name: 'earnings-storage',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({
                summary: state.summary,
            }),
        }
    )
);

export default useEarningsStore;
