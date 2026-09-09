import { getSupabase } from './client';
import {
    normalizeGoals,
    normalizeExperiencePreference,
    UserGoalId,
    ExperiencePreference,
} from '../../domain/onboarding/goals';
import { normalizePreferredMinutes } from '../../domain/sessions/sessionDurations';

export interface UserGoalsRow {
    user_id: string;
    goals: UserGoalId[];
    preferred_session_minutes: number | null;
    experience_preference: ExperiencePreference | null;
    updated_at?: string;
}

export interface UserGoalsInput {
    goals?: unknown;
    preferredSessionMinutes?: unknown;
    experiencePreference?: unknown;
}

/**
 * Persistence for Onboarding 2.0 preferences (`user_goals` table).
 * All writes go through normalize* validators — arbitrary values
 * (including AI-generated ones) never reach the database.
 * Every method degrades gracefully when the table is missing so
 * older backends / offline mode never break onboarding.
 */
export const userGoalsService = {
    getUserGoals: async (userId: string): Promise<UserGoalsRow | null> => {
        try {
            const supabase = getSupabase();
            const { data, error } = await supabase
                .from('user_goals')
                .select('*')
                .eq('user_id', userId)
                .single();
            if (error) {
                if (error.code === 'PGRST116') return null; // no row yet
                throw error;
            }
            if (!data) return null;
            return {
                user_id: data.user_id,
                goals: normalizeGoals(data.goals),
                preferred_session_minutes: normalizePreferredMinutes(
                    data.preferred_session_minutes,
                ),
                experience_preference: normalizeExperiencePreference(
                    data.experience_preference,
                ),
                updated_at: data.updated_at,
            };
        } catch (e) {
            console.log('[userGoalsService] getUserGoals fallback (table missing/offline):', e);
            return null;
        }
    },

    upsertUserGoals: async (userId: string, input: UserGoalsInput): Promise<UserGoalsRow | null> => {
        const goals = normalizeGoals(input.goals ?? []);
        const preferred_session_minutes = normalizePreferredMinutes(
            (input.preferredSessionMinutes as number | null | undefined) ?? null,
        );
        const experience_preference = normalizeExperiencePreference(
            input.experiencePreference ?? null,
        );
        try {
            const supabase = getSupabase();
            const { data, error } = await supabase
                .from('user_goals')
                .upsert(
                    {
                        user_id: userId,
                        goals,
                        preferred_session_minutes,
                        experience_preference,
                        updated_at: new Date().toISOString(),
                    },
                    { onConflict: 'user_id' },
                )
                .select()
                .single();
            if (error) throw error;
            return data as UserGoalsRow;
        } catch (e) {
            // Offline or table not migrated yet — local Zustand store
            // remains the source of truth; sync will retry later.
            console.log('[userGoalsService] upsertUserGoals fallback (local-only):', e);
            return { user_id: userId, goals, preferred_session_minutes, experience_preference };
        }
    },
};
