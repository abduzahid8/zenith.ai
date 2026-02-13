// Content Service - Literary Flow
// Handles content recommendations (books, articles, podcasts, videos)

import { dbService, ContentItem, UserContentHistory, UserProfile } from './supabase';
import { aiService } from './ai';

// Content types
export type ContentType = 'book' | 'article' | 'podcast' | 'video' | 'exercise' | 'course';
export type ContentCategory = 'motivation' | 'skill' | 'health' | 'finance' | 'mindfulness' | 'productivity';

// Recommendation filters based on user state
export interface RecommendationContext {
    hobby?: string;
    mood?: 'energetic' | 'tired' | 'neutral';
    timeAvailable?: 'short' | 'medium' | 'long'; // 5min, 30min, 1hr+
    goal?: 'motivation' | 'learning' | 'relaxation';
}

// Map time availability to duration
const TIME_FILTERS = {
    short: ['5 min', '10 min', '15 min'],
    medium: ['20 min', '30 min', '45 min'],
    long: ['1 hour', '1 час', '2 hours', '2 часа']
};

// Content service for Literary Flow feature
export const contentService = {
    // Get personalized feed for user
    getPersonalizedFeed: async (
        userId: string,
        context?: RecommendationContext,
        limit: number = 10
    ): Promise<ContentItem[]> => {
        // Get user's hobbies for filtering
        const userHobbies = await dbService.getUserHobbies(userId);
        const hobbyIds = userHobbies.map(h => h.hobby_id);

        // Build filters
        const filters: Parameters<typeof dbService.getRecommendedContent>[0] = {
            hobby_ids: context?.hobby ? [context.hobby] : hobbyIds.length > 0 ? hobbyIds : undefined,
            limit
        };

        // Get content
        const content = await dbService.getRecommendedContent(filters);

        // Get user's history to filter out completed/skipped
        const history = await dbService.getUserContentHistory(userId);
        const completedIds = new Set(
            history
                .filter(h => h.status === 'completed' || h.status === 'skipped')
                .map(h => h.content_id)
        );

        // Filter and sort
        let filtered = content.filter(c => !completedIds.has(c.id!));

        // Apply time filter if specified
        if (context?.timeAvailable && TIME_FILTERS[context.timeAvailable]) {
            const validTimes = TIME_FILTERS[context.timeAvailable];
            filtered = filtered.filter(c =>
                validTimes.some(t => c.time_to_consume?.toLowerCase().includes(t.toLowerCase()))
            );
        }

        // Sort by relevance (in-progress first, then by difficulty matching user level)
        const inProgressIds = new Set(
            history.filter(h => h.status === 'started').map(h => h.content_id)
        );

        filtered.sort((a, b) => {
            // In-progress items first
            const aInProgress = inProgressIds.has(a.id!);
            const bInProgress = inProgressIds.has(b.id!);
            if (aInProgress && !bInProgress) return -1;
            if (!aInProgress && bInProgress) return 1;
            return 0;
        });

        return filtered.slice(0, limit);
    },

    // Get content for specific hobby
    getContentForHobby: async (hobbyId: string, limit: number = 10): Promise<ContentItem[]> => {
        return dbService.getRecommendedContent({
            hobby_ids: [hobbyId],
            limit
        });
    },

    // Get content by type
    getContentByType: async (
        contentType: ContentType,
        limit: number = 10
    ): Promise<ContentItem[]> => {
        return dbService.getRecommendedContent({
            content_type: contentType,
            limit
        });
    },

    // Get content by category
    getContentByCategory: async (
        category: ContentCategory,
        limit: number = 10
    ): Promise<ContentItem[]> => {
        return dbService.getRecommendedContent({
            category,
            limit
        });
    },

    // Save content to user's list
    saveContent: async (userId: string, contentId: string) => {
        return dbService.updateContentStatus(userId, contentId, 'saved');
    },

    // Start consuming content
    startContent: async (userId: string, contentId: string) => {
        return dbService.updateContentStatus(userId, contentId, 'started');
    },

    // Complete content
    completeContent: async (userId: string, contentId: string, rating?: number) => {
        return dbService.updateContentStatus(userId, contentId, 'completed', { rating });
    },

    // Skip content
    skipContent: async (userId: string, contentId: string) => {
        return dbService.updateContentStatus(userId, contentId, 'skipped');
    },

    // Update progress
    updateProgress: async (userId: string, contentId: string, progressPercent: number) => {
        const status = progressPercent >= 100 ? 'completed' : 'started';
        return dbService.updateContentStatus(userId, contentId, status, {
            progress_percent: progressPercent
        });
    },

    // Get user's reading/watching history
    getUserHistory: async (userId: string): Promise<UserContentHistory[]> => {
        return dbService.getUserContentHistory(userId);
    },

    // Get user's saved content
    getSavedContent: async (userId: string): Promise<ContentItem[]> => {
        const history = await dbService.getUserContentHistory(userId);
        const savedIds = history
            .filter(h => h.status === 'saved' || h.status === 'started')
            .map(h => h.content_id);

        if (savedIds.length === 0) return [];

        // Get full content items
        const allContent = await dbService.getRecommendedContent({ limit: 100 });
        return allContent.filter(c => savedIds.includes(c.id!));
    },

    // Get in-progress content
    getInProgressContent: async (userId: string): Promise<ContentItem[]> => {
        const history = await dbService.getUserContentHistory(userId);
        const inProgressIds = history
            .filter(h => h.status === 'started')
            .map(h => h.content_id);

        if (inProgressIds.length === 0) return [];

        const allContent = await dbService.getRecommendedContent({ limit: 100 });
        return allContent.filter(c => inProgressIds.includes(c.id!));
    },

    // Get completed content count
    getCompletedCount: async (userId: string): Promise<number> => {
        const history = await dbService.getUserContentHistory(userId);
        return history.filter(h => h.status === 'completed').length;
    },

    // Get AI-powered content recommendations
    getAIRecommendations: async (
        userId: string,
        userProfile: Partial<UserProfile>,
        goals?: string[]
    ): Promise<ContentItem[]> => {
        try {
            // Get AI suggestions
            const suggestions = await aiService.getContentRecommendations(
                userProfile,
                goals || []
            );

            // Match suggestions to available content
            const allContent = await dbService.getRecommendedContent({ limit: 50 });

            // Simple matching by category/type from AI suggestions
            const matched = allContent.filter(content =>
                suggestions.some(s =>
                    content.category?.toLowerCase().includes(s.category?.toLowerCase() || '') ||
                    content.title_ru?.toLowerCase().includes(s.title?.toLowerCase() || '') ||
                    content.title?.toLowerCase().includes(s.title?.toLowerCase() || '')
                )
            );

            return matched.length > 0 ? matched.slice(0, 5) : allContent.slice(0, 5);
        } catch (error) {
            console.error('AI recommendations failed:', error);
            // Fallback to standard recommendations
            return dbService.getRecommendedContent({ limit: 5 });
        }
    },

    // Generate quick insight for substitute notification
    getQuickInsight: async (hobbyId?: string): Promise<{ title: string; content: string; duration: string }> => {
        try {
            // Try to get relevant content
            const content = hobbyId
                ? await dbService.getRecommendedContent({ hobby_ids: [hobbyId], limit: 1 })
                : await dbService.getRecommendedContent({ content_type: 'article', limit: 1 });

            if (content.length > 0) {
                return {
                    title: content[0].title_ru || content[0].title,
                    content: content[0].description_ru || content[0].description || '',
                    duration: content[0].time_to_consume || '5 min'
                };
            }
        } catch (e) {
            console.error('Failed to get quick insight:', e);
        }

        // Fallback
        return {
            title: 'Совет дня',
            content: 'Регулярная практика даже по 15 минут эффективнее редких длинных сессий.',
            duration: '1 min'
        };
    }
};

export default contentService;
