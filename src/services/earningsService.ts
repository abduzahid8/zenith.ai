// Earnings Service
// Handles earning methods matching, income path generation, and progress tracking

import { dbService, EarningMethod, UserEarning, UserProfile } from './supabase';
import { aiService } from './ai';

// Earning categories
export type EarningCategory = 'freelance' | 'creative' | 'technical' | 'service' | 'passive' | 'micro_jobs';

// Income level tiers
export type IncomeLevel = 'beginner' | 'intermediate' | 'professional';

// Money path stage
export interface MoneyPathStage {
    level: IncomeLevel;
    income_range: string;
    requirements: string[];
    estimated_time: string;
    skills: string[];
}

// Full money path for a user
export interface PersonalizedMoneyPath {
    earning_method: EarningMethod;
    stages: MoneyPathStage[];
    current_stage: number;
    total_stages: number;
    next_action: string;
}

// Match score for earning methods
export interface EarningMatch {
    method: EarningMethod;
    match_score: number;
    match_reasons: string[];
}

// Service for earning methods
export const earningsService = {
    // Get all earning methods
    getAllMethods: async (): Promise<EarningMethod[]> => {
        return dbService.getEarningMethods();
    },

    // Get methods by category
    getMethodsByCategory: async (category: EarningCategory): Promise<EarningMethod[]> => {
        return dbService.getEarningMethods({ category });
    },

    // Get methods matching user's hobbies
    getMethodsForHobbies: async (hobbyIds: string[]): Promise<EarningMethod[]> => {
        return dbService.getEarningMethods({ related_hobbies: hobbyIds });
    },

    // Calculate match score between user profile and earning method
    calculateMatchScore: (userProfile: Partial<UserProfile>, method: EarningMethod): EarningMatch => {
        let score = 0;
        const reasons: string[] = [];

        // Check if user's hobbies match
        if (method.related_hobbies && method.related_hobbies.length > 0) {
            // This would need user's hobbies passed in
            score += 20;
            reasons.push('Связано с твоими интересами');
        }

        // Check difficulty vs user's skill scores
        const avgScore = (
            (userProfile.mental_score || 5) +
            (userProfile.creative_score || 5) +
            (userProfile.structure_score || 5)
        ) / 3;

        if (method.difficulty_level === 'easy' && avgScore >= 4) {
            score += 30;
            reasons.push('Подходит для начинающих');
        } else if (method.difficulty_level === 'medium' && avgScore >= 6) {
            score += 25;
            reasons.push('Соответствует твоему уровню');
        } else if (method.difficulty_level === 'hard' && avgScore >= 8) {
            score += 20;
            reasons.push('Для продвинутых пользователей');
        }

        // Check time investment vs user's structure preference
        if (userProfile.freedom_score && userProfile.freedom_score > 6) {
            if (method.time_investment === 'few hours/week') {
                score += 15;
                reasons.push('Гибкий график');
            }
        }
        if (userProfile.structure_score && userProfile.structure_score > 6) {
            if (method.time_investment === 'full-time') {
                score += 15;
                reasons.push('Подходит для полной занятости');
            }
        }

        // Check quick result preference
        if (userProfile.quick_score && userProfile.quick_score > 6) {
            if (method.time_to_first_income === '1 week') {
                score += 10;
                reasons.push('Быстрый первый доход');
            }
        }

        // Normalize score to 0-100
        score = Math.min(100, Math.max(0, score));

        return {
            method,
            match_score: score,
            match_reasons: reasons.length > 0 ? reasons : ['Новое направление для изучения']
        };
    },

    // Get personalized earning recommendations
    getPersonalizedRecommendations: async (
        userId: string,
        userProfile: Partial<UserProfile>,
        limit: number = 5
    ): Promise<EarningMatch[]> => {
        // Get user's hobbies
        const userHobbies = await dbService.getUserHobbies(userId);
        const hobbyIds = userHobbies.map(h => h.hobby_id);

        // Get methods related to hobbies
        let methods = await dbService.getEarningMethods({ related_hobbies: hobbyIds });

        // If not enough, get all methods
        if (methods.length < limit) {
            const allMethods = await dbService.getEarningMethods();
            methods = [...methods, ...allMethods.filter(m => !methods.find(em => em.id === m.id))];
        }

        // Calculate match scores
        const matches = methods.map(method =>
            earningsService.calculateMatchScore(userProfile, method)
        );

        // Sort by score and return top matches
        matches.sort((a, b) => b.match_score - a.match_score);
        return matches.slice(0, limit);
    },

    // Get AI-generated earning ideas
    getAIEarningIdeas: async (
        userProfile: Partial<UserProfile>,
        userHobbies: string[]
    ): Promise<EarningMatch[]> => {
        try {
            // Get AI suggestions
            const suggestions = await aiService.getPersonalizedEarningIdeas(
                userProfile,
                userHobbies
            );

            // Match to available methods
            const allMethods = await dbService.getEarningMethods();

            return suggestions.map(suggestion => ({
                method: allMethods.find(m =>
                    m.title_ru?.toLowerCase().includes(suggestion.title?.toLowerCase() || '') ||
                    m.title?.toLowerCase().includes(suggestion.title?.toLowerCase() || '')
                ) || {
                    id: undefined,
                    title: suggestion.title || 'Новый способ заработка',
                    title_ru: suggestion.title,
                    category: suggestion.category || 'freelance',
                    description: suggestion.description,
                    description_ru: suggestion.description,
                    difficulty_level: suggestion.difficulty || 'medium',
                    income_range_min: suggestion.income_min || 100,
                    income_range_max: suggestion.income_max || 1000,
                    time_to_first_income: suggestion.time_to_start || '1 month'
                } as EarningMethod,
                match_score: suggestion.match_score || 70,
                match_reasons: suggestion.reasons || ['Рекомендовано ИИ']
            }));
        } catch (error) {
            console.error('AI earning ideas failed:', error);
            // Return empty on error - caller should fall back to regular recommendations
            return [];
        }
    },

    // Start an earning path for a user
    startPath: async (userId: string, earningMethodId: string): Promise<UserEarning> => {
        return dbService.startEarningPath(userId, earningMethodId);
    },

    // Get user's active earning paths
    getActivePaths: async (userId: string): Promise<UserEarning[]> => {
        const earnings = await dbService.getUserEarnings(userId);
        return earnings.filter(e => e.status !== 'earning'); // Not yet completed
    },

    // Get user's successful earnings
    getSuccessfulEarnings: async (userId: string): Promise<UserEarning[]> => {
        const earnings = await dbService.getUserEarnings(userId);
        return earnings.filter(e => e.status === 'earning');
    },

    // Update progress on earning path
    updateProgress: async (
        userId: string,
        earningMethodId: string,
        updates: {
            status?: UserEarning['status'];
            current_step?: number;
            progress_notes?: string;
        }
    ) => {
        return dbService.updateEarningProgress(userId, earningMethodId, updates);
    },

    // Record an earning
    recordEarning: async (
        userId: string,
        earningMethodId: string,
        amount: number
    ) => {
        // Get current total
        const userEarnings = await dbService.getUserEarnings(userId);
        const current = userEarnings.find(e => e.earning_method_id === earningMethodId);
        const newTotal = (current?.total_earned || 0) + amount;

        return dbService.updateEarningProgress(userId, earningMethodId, {
            status: 'earning',
            total_earned: newTotal
        });
    },

    // Generate personalized money path
    generateMoneyPath: async (
        userProfile: Partial<UserProfile>,
        earningMethod: EarningMethod
    ): Promise<PersonalizedMoneyPath> => {
        // Generate stages based on difficulty and income range
        const stages: MoneyPathStage[] = [
            {
                level: 'beginner',
                income_range: '$10-$100/месяц',
                requirements: ['Изучить основы', 'Завершить первый проект'],
                estimated_time: earningMethod.time_to_first_income || '2-4 недели',
                skills: earningMethod.required_skills?.slice(0, 2) || ['Базовые навыки']
            },
            {
                level: 'intermediate',
                income_range: '$100-$500/месяц',
                requirements: ['Создать портфолио', 'Найти первых клиентов'],
                estimated_time: '2-3 месяца',
                skills: earningMethod.required_skills?.slice(0, 4) || ['Средний уровень']
            },
            {
                level: 'professional',
                income_range: `$${earningMethod.income_range_min || 500}-$${earningMethod.income_range_max || 2000}/месяц`,
                requirements: ['Стабильный поток клиентов', 'Экспертный уровень'],
                estimated_time: '6-12 месяцев',
                skills: earningMethod.required_skills || ['Профессиональные навыки']
            }
        ];

        return {
            earning_method: earningMethod,
            stages,
            current_stage: 0,
            total_stages: stages.length,
            next_action: stages[0].requirements[0]
        };
    },

    // Get total earnings summary
    getEarningsSummary: async (userId: string) => {
        const earnings = await dbService.getUserEarnings(userId);

        const summary = {
            total_earned: 0,
            active_paths: 0,
            successful_paths: 0,
            first_earning_date: null as string | null,
            categories: {} as Record<string, number>
        };

        for (const earning of earnings) {
            summary.total_earned += earning.total_earned || 0;

            if (earning.status === 'earning') {
                summary.successful_paths++;
            } else {
                summary.active_paths++;
            }

            if (earning.first_earning_date && !summary.first_earning_date) {
                summary.first_earning_date = earning.first_earning_date;
            }
        }

        return summary;
    }
};

export default earningsService;
