// =====================================================
// Database Types
// =====================================================

export interface QuizAnswer {
    id?: string;
    user_id: string;
    answers: Record<number, number>;
    created_at?: string;
}

export interface UserHobby {
    id?: string;
    user_id: string;
    hobby_id: string;
    is_primary?: boolean;
    skill_level?: 'beginner' | 'intermediate' | 'advanced';
    total_practice_minutes?: number;
    selected_at?: string;
}

export interface Session {
    id?: string;
    user_id: string;
    hobby_id: string;
    duration_seconds: number;
    quality_rating?: number;
    focus_score?: number;
    notes?: string;
    tasks_completed?: string[];
    completed_at?: string;
}

export interface UserProfile {
    id?: string;
    user_id: string;
    is_premium: boolean;
    subscription_level?: 'free' | 'trial' | 'premium';
    // AI Profile Data
    personality_type?: string;
    temperament?: string;
    motivation_style?: 'soft' | 'strong';
    energy_level?: number;
    time_preference?: string;
    // Quiz-derived scores
    mental_score?: number;
    creative_score?: number;
    physical_score?: number;
    structure_score?: number;
    freedom_score?: number;
    individual_score?: number;
    social_score?: number;
    quick_score?: number;
    long_score?: number;
    // Progress
    streak_days?: number;
    last_session_date?: string;
    total_sessions?: number;
    total_practice_minutes?: number;
    created_at?: string;
    updated_at?: string;
}

export interface ScreenTimeLog {
    id?: string;
    user_id: string;
    app_name: string;
    app_package?: string;
    category?: 'social_media' | 'entertainment' | 'productivity' | 'gaming' | 'other';
    duration_seconds: number;
    logged_at?: string;
    date?: string;
}

export interface ScreenTimeLimit {
    id?: string;
    user_id: string;
    app_name?: string;
    app_package?: string;
    category?: string;
    daily_limit_seconds?: number;
    limit_type?: 'soft' | 'medium' | 'strict';
    notification_message?: string;
    is_active?: boolean;
    created_at?: string;
}

export interface ContentItem {
    id?: string;
    title: string;
    title_ru?: string;
    content_type: 'book' | 'article' | 'podcast' | 'video' | 'exercise' | 'course';
    category?: string;
    description?: string;
    description_ru?: string;
    url?: string;
    image_url?: string;
    author?: string;
    difficulty_level?: 'beginner' | 'intermediate' | 'advanced';
    time_to_consume?: string;
    tags?: string[];
    hobby_ids?: string[];
    is_active?: boolean;
    created_at?: string;
}

export interface UserContentHistory {
    id?: string;
    user_id: string;
    content_id: string;
    status?: 'recommended' | 'saved' | 'started' | 'completed' | 'skipped';
    progress_percent?: number;
    rating?: number;
    notes?: string;
    started_at?: string;
    completed_at?: string;
    created_at?: string;
}

export interface EarningMethod {
    id?: string;
    title: string;
    title_ru?: string;
    category: 'freelance' | 'creative' | 'technical' | 'service' | 'passive' | 'micro_jobs';
    description?: string;
    description_ru?: string;
    required_skills?: string[];
    related_hobbies?: string[];
    difficulty_level?: 'easy' | 'medium' | 'hard';
    income_range_min?: number;
    income_range_max?: number;
    time_to_first_income?: string;
    time_investment?: string;
    steps?: object[];
    resources?: object[];
    is_active?: boolean;
    created_at?: string;
}

export interface UserEarning {
    id?: string;
    user_id: string;
    earning_method_id: string;
    status?: 'interested' | 'learning' | 'practicing' | 'earning';
    current_step?: number;
    progress_notes?: string;
    first_earning_date?: string;
    total_earned?: number;
    created_at?: string;
    updated_at?: string;
}

export interface WeeklyPlan {
    id?: string;
    user_id: string;
    week_start: string;
    hobby_id?: string;
    tasks?: Array<{ text: string; completed: boolean; day?: number }>;
    goals?: string[];
    ai_generated?: boolean;
    completed_tasks?: number;
    total_tasks?: number;
    created_at?: string;
    updated_at?: string;
}

export interface DailyStats {
    id?: string;
    user_id: string;
    date: string;
    practice_minutes?: number;
    screen_time_minutes?: number;
    social_media_minutes?: number;
    tasks_completed?: number;
    sessions_count?: number;
    focus_score_avg?: number;
    created_at?: string;
}

export interface SubstituteNotification {
    id?: string;
    user_id: string;
    triggered_by_app?: string;
    notification_type?: 'reminder' | 'challenge' | 'insight' | 'motivation';
    notification_content?: string;
    suggested_action?: string;
    action_taken?: 'accepted' | 'dismissed' | 'snoozed';
    response_time_seconds?: number;
    created_at?: string;
}

export type TaskType = 'learning' | 'practice' | 'action' | 'wellbeing';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'skipped' | 'replaced';
export type AiJobType = 'PROFILE_UPDATE' | 'REBUILD_DAY' | 'BEHAVIOR_RECALIBRATION';
export type AiJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface UserStateSnapshot {
    user_id: string;
    skill_level?: number;
    weakness_tags?: string[];
    avg_completion_7d?: number;
    missed_days_7d?: number;
    current_streak?: number;
    avg_session_time?: number;
    last_activity_at?: string;
    error_rate_last_session?: number;
    loss_streak?: number;
    sessions_last_24h?: number;
    last_ai_update_at?: string;
    ai_focus_area?: string;
    ai_confidence_score?: number;
    created_at?: string;
    updated_at?: string;
}

export interface Task {
    id?: string;
    user_id: string;
    title: string;
    type: TaskType;
    status: TaskStatus;
    hobby_id?: string;
    content_id?: string;
    earning_step_id?: string;
    scheduled_date: string;
    duration_minutes?: number;
    is_ai_generated?: boolean;
    ai_rationale?: string;
    created_at?: string;
    updated_at?: string;
}

export interface AiJob {
    id?: string;
    user_id: string;
    type: AiJobType;
    status: AiJobStatus;
    priority?: number;
    retry_count?: number;
    result_json?: Record<string, unknown>;
    created_at?: string;
    started_at?: string;
    finished_at?: string;
}
