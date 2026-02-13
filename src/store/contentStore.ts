// Content Store
// Zustand store for Literary Flow content recommendations

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { contentService, RecommendationContext } from '../services/contentService';
import { ContentItem, UserContentHistory } from '../services/supabase';

interface ContentState {
    // Data
    feed: ContentItem[];
    savedContent: ContentItem[];
    inProgressContent: ContentItem[];
    currentlyViewing: ContentItem | null;
    history: UserContentHistory[];

    // Stats
    completedCount: number;

    // Loading states
    isLoading: boolean;
    isFeedLoading: boolean;
    error: string | null;

    // Actions
    initialize: (userId: string) => Promise<void>;
    loadFeed: (userId: string, context?: RecommendationContext) => Promise<void>;
    loadSavedContent: (userId: string) => Promise<void>;
    loadInProgress: (userId: string) => Promise<void>;

    // Content actions
    saveContent: (userId: string, contentId: string) => Promise<void>;
    startContent: (userId: string, contentId: string) => Promise<void>;
    completeContent: (userId: string, contentId: string, rating?: number) => Promise<void>;
    skipContent: (userId: string, contentId: string) => Promise<void>;
    updateProgress: (userId: string, contentId: string, percent: number) => Promise<void>;

    // View management
    setCurrentlyViewing: (content: ContentItem | null) => void;

    clearError: () => void;
    reset: () => void;
}

const initialState = {
    feed: [],
    savedContent: [],
    inProgressContent: [],
    currentlyViewing: null,
    history: [],
    completedCount: 0,
    isLoading: false,
    isFeedLoading: false,
    error: null,
};

export const useContentStore = create<ContentState>()(
    persist(
        (set, get) => ({
            ...initialState,

            initialize: async (userId: string) => {
                try {
                    set({ isLoading: true, error: null });

                    // Load all content data in parallel
                    const [savedContent, inProgressContent, completedCount] = await Promise.all([
                        contentService.getSavedContent(userId),
                        contentService.getInProgressContent(userId),
                        contentService.getCompletedCount(userId),
                    ]);

                    set({
                        savedContent,
                        inProgressContent,
                        completedCount,
                        isLoading: false,
                    });

                    // Load history
                    const history = await contentService.getUserHistory(userId);
                    set({ history });

                } catch (error) {
                    console.error('Content store init error:', error);
                    set({ error: 'Не удалось загрузить контент', isLoading: false });
                }
            },

            loadFeed: async (userId: string, context?: RecommendationContext) => {
                try {
                    set({ isFeedLoading: true });
                    const feed = await contentService.getPersonalizedFeed(userId, context);
                    set({ feed, isFeedLoading: false });
                } catch (error) {
                    console.error('Load feed error:', error);
                    set({ error: 'Не удалось загрузить ленту', isFeedLoading: false });
                }
            },

            loadSavedContent: async (userId: string) => {
                try {
                    const savedContent = await contentService.getSavedContent(userId);
                    set({ savedContent });
                } catch (error) {
                    console.error('Load saved content error:', error);
                }
            },

            loadInProgress: async (userId: string) => {
                try {
                    const inProgressContent = await contentService.getInProgressContent(userId);
                    set({ inProgressContent });
                } catch (error) {
                    console.error('Load in-progress error:', error);
                }
            },

            saveContent: async (userId: string, contentId: string) => {
                try {
                    await contentService.saveContent(userId, contentId);
                    // Update local state
                    const { feed } = get();
                    const saved = feed.find(c => c.id === contentId);
                    if (saved) {
                        set(state => ({
                            savedContent: [...state.savedContent, saved],
                        }));
                    }
                } catch (error) {
                    console.error('Save content error:', error);
                    set({ error: 'Не удалось сохранить контент' });
                }
            },

            startContent: async (userId: string, contentId: string) => {
                try {
                    await contentService.startContent(userId, contentId);
                    // Move from saved to in-progress if needed
                    const { savedContent, feed } = get();
                    const content = savedContent.find(c => c.id === contentId)
                        || feed.find(c => c.id === contentId);

                    if (content) {
                        set(state => ({
                            savedContent: state.savedContent.filter(c => c.id !== contentId),
                            inProgressContent: [...state.inProgressContent, content],
                        }));
                    }
                } catch (error) {
                    console.error('Start content error:', error);
                    set({ error: 'Не удалось начать контент' });
                }
            },

            completeContent: async (userId: string, contentId: string, rating?: number) => {
                try {
                    await contentService.completeContent(userId, contentId, rating);
                    // Remove from in-progress
                    set(state => ({
                        inProgressContent: state.inProgressContent.filter(c => c.id !== contentId),
                        completedCount: state.completedCount + 1,
                    }));
                } catch (error) {
                    console.error('Complete content error:', error);
                    set({ error: 'Не удалось завершить контент' });
                }
            },

            skipContent: async (userId: string, contentId: string) => {
                try {
                    await contentService.skipContent(userId, contentId);
                    // Remove from feed
                    set(state => ({
                        feed: state.feed.filter(c => c.id !== contentId),
                    }));
                } catch (error) {
                    console.error('Skip content error:', error);
                }
            },

            updateProgress: async (userId: string, contentId: string, percent: number) => {
                try {
                    await contentService.updateProgress(userId, contentId, percent);
                } catch (error) {
                    console.error('Update progress error:', error);
                }
            },

            setCurrentlyViewing: (content) => set({ currentlyViewing: content }),

            clearError: () => set({ error: null }),

            reset: () => set(initialState),
        }),
        {
            name: 'content-storage',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({
                completedCount: state.completedCount,
            }),
        }
    )
);

export default useContentStore;
