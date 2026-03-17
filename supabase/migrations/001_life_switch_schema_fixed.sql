-- Life Switch Backend Database Schema (Fixed for idempotency)
-- Run this in Supabase Dashboard > SQL Editor

-- =====================================================
-- Extended User Profiles with AI Analysis Data
-- =====================================================
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    is_premium BOOLEAN DEFAULT false,
    subscription_level TEXT DEFAULT 'free',
    
    -- AI Profile Data
    personality_type TEXT,
    temperament TEXT,
    motivation_style TEXT, -- 'soft' or 'strong'
    energy_level INTEGER DEFAULT 5,
    time_preference TEXT,
    
    -- Quiz-derived profile scores (1-10)
    mental_score INTEGER DEFAULT 5,
    creative_score INTEGER DEFAULT 5,
    physical_score INTEGER DEFAULT 5,
    structure_score INTEGER DEFAULT 5,
    freedom_score INTEGER DEFAULT 5,
    individual_score INTEGER DEFAULT 5,
    social_score INTEGER DEFAULT 5,
    quick_score INTEGER DEFAULT 5,
    long_score INTEGER DEFAULT 5,
    
    -- Streak and progress
    streak_days INTEGER DEFAULT 0,
    last_session_date DATE,
    total_sessions INTEGER DEFAULT 0,
    total_practice_minutes INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Quiz Answers Storage
-- =====================================================
CREATE TABLE IF NOT EXISTS quiz_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    answers JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- User Hobbies Selection
-- =====================================================
CREATE TABLE IF NOT EXISTS user_hobbies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    hobby_id TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT false,
    skill_level TEXT DEFAULT 'beginner', -- 'beginner', 'intermediate', 'advanced'
    total_practice_minutes INTEGER DEFAULT 0,
    selected_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Screen Time Tracking
-- =====================================================
CREATE TABLE IF NOT EXISTS screen_time_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    app_name TEXT NOT NULL,
    app_package TEXT, -- e.g., 'com.instagram.android'
    category TEXT, -- 'social_media', 'entertainment', 'productivity', 'gaming', 'other'
    duration_seconds INTEGER NOT NULL,
    logged_at TIMESTAMPTZ DEFAULT NOW(),
    date DATE DEFAULT CURRENT_DATE
);

-- =====================================================
-- Smart Limits Configuration
-- =====================================================
CREATE TABLE IF NOT EXISTS screen_time_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    app_name TEXT,
    app_package TEXT,
    category TEXT,
    daily_limit_seconds INTEGER,
    limit_type TEXT DEFAULT 'soft', -- 'soft', 'medium', 'strict'
    notification_message TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Content Recommendations (Literary Flow)
-- =====================================================
CREATE TABLE IF NOT EXISTS content_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    title_ru TEXT,
    content_type TEXT NOT NULL, -- 'book', 'article', 'podcast', 'video', 'exercise', 'course'
    category TEXT, -- 'motivation', 'skill', 'health', 'finance', 'mindfulness', 'productivity'
    description TEXT,
    description_ru TEXT,
    url TEXT,
    image_url TEXT,
    author TEXT,
    difficulty_level TEXT, -- 'beginner', 'intermediate', 'advanced'
    time_to_consume TEXT, -- '5 min', '30 min', '2 hours'
    tags TEXT[],
    hobby_ids TEXT[], -- Related hobbies
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- User Content History
-- =====================================================
CREATE TABLE IF NOT EXISTS user_content_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    content_id UUID REFERENCES content_items(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'recommended', -- 'recommended', 'saved', 'started', 'completed', 'skipped'
    progress_percent INTEGER DEFAULT 0,
    rating INTEGER, -- 1-5 stars
    notes TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Earning Methods Catalog
-- =====================================================
CREATE TABLE IF NOT EXISTS earning_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    title_ru TEXT,
    category TEXT NOT NULL, -- 'freelance', 'creative', 'technical', 'service', 'passive', 'micro_jobs'
    description TEXT,
    description_ru TEXT,
    required_skills TEXT[],
    related_hobbies TEXT[],
    difficulty_level TEXT, -- 'easy', 'medium', 'hard'
    income_range_min INTEGER, -- in USD
    income_range_max INTEGER,
    time_to_first_income TEXT, -- '1 week', '1 month', '3 months'
    time_investment TEXT, -- 'part-time', 'full-time', 'few hours/week'
    steps JSONB, -- Array of steps to get started
    resources JSONB, -- Links, tools, platforms
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- User Earning Path
-- =====================================================
CREATE TABLE IF NOT EXISTS user_earnings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    earning_method_id UUID REFERENCES earning_methods(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'interested', -- 'interested', 'learning', 'practicing', 'earning'
    current_step INTEGER DEFAULT 0,
    progress_notes TEXT,
    first_earning_date DATE,
    total_earned DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Weekly Plans (server-synced)
-- =====================================================
CREATE TABLE IF NOT EXISTS weekly_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    week_start DATE NOT NULL,
    hobby_id TEXT,
    tasks JSONB DEFAULT '[]', -- Array of {text, completed, day}
    goals JSONB DEFAULT '[]', -- Weekly goals
    ai_generated BOOLEAN DEFAULT false,
    completed_tasks INTEGER DEFAULT 0,
    total_tasks INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, week_start, hobby_id)
);

-- =====================================================
-- Practice Sessions (enhanced)
-- =====================================================
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    hobby_id TEXT NOT NULL,
    duration_seconds INTEGER NOT NULL,
    quality_rating INTEGER, -- 1-5
    focus_score INTEGER, -- 1-10, how focused was the session
    notes TEXT,
    tasks_completed TEXT[], -- Which tasks were completed
    completed_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Substitute Notifications Log
-- =====================================================
CREATE TABLE IF NOT EXISTS substitute_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    triggered_by_app TEXT,
    notification_type TEXT, -- 'reminder', 'challenge', 'insight', 'motivation'
    notification_content TEXT,
    suggested_action TEXT, -- What action was suggested
    action_taken TEXT, -- 'accepted', 'dismissed', 'snoozed'
    response_time_seconds INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Daily Statistics Cache
-- =====================================================
CREATE TABLE IF NOT EXISTS daily_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    practice_minutes INTEGER DEFAULT 0,
    screen_time_minutes INTEGER DEFAULT 0,
    social_media_minutes INTEGER DEFAULT 0,
    tasks_completed INTEGER DEFAULT 0,
    sessions_count INTEGER DEFAULT 0,
    focus_score_avg DECIMAL(3,1),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- =====================================================
-- Enable Row Level Security
-- =====================================================
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_hobbies ENABLE ROW LEVEL SECURITY;
ALTER TABLE screen_time_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE screen_time_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_content_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE substitute_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_stats ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS Policies - Users can only access their own data
-- (Using DROP IF EXISTS to avoid conflicts)
-- =====================================================

-- User Profiles
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
CREATE POLICY "Users can view own profile" ON user_profiles FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
CREATE POLICY "Users can insert own profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Quiz Answers
DROP POLICY IF EXISTS "Users can view own quiz answers" ON quiz_answers;
CREATE POLICY "Users can view own quiz answers" ON quiz_answers FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own quiz answers" ON quiz_answers;
CREATE POLICY "Users can insert own quiz answers" ON quiz_answers FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User Hobbies
DROP POLICY IF EXISTS "Users can view own hobbies" ON user_hobbies;
CREATE POLICY "Users can view own hobbies" ON user_hobbies FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own hobbies" ON user_hobbies;
CREATE POLICY "Users can insert own hobbies" ON user_hobbies FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own hobbies" ON user_hobbies;
CREATE POLICY "Users can update own hobbies" ON user_hobbies FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own hobbies" ON user_hobbies;
CREATE POLICY "Users can delete own hobbies" ON user_hobbies FOR DELETE USING (auth.uid() = user_id);

-- Screen Time Logs
DROP POLICY IF EXISTS "Users can view own screen time" ON screen_time_logs;
CREATE POLICY "Users can view own screen time" ON screen_time_logs FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own screen time" ON screen_time_logs;
CREATE POLICY "Users can insert own screen time" ON screen_time_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Screen Time Limits
DROP POLICY IF EXISTS "Users can view own limits" ON screen_time_limits;
CREATE POLICY "Users can view own limits" ON screen_time_limits FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own limits" ON screen_time_limits;
CREATE POLICY "Users can insert own limits" ON screen_time_limits FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own limits" ON screen_time_limits;
CREATE POLICY "Users can update own limits" ON screen_time_limits FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own limits" ON screen_time_limits;
CREATE POLICY "Users can delete own limits" ON screen_time_limits FOR DELETE USING (auth.uid() = user_id);

-- Content Items - Public read access
DROP POLICY IF EXISTS "Anyone can view content" ON content_items;
CREATE POLICY "Anyone can view content" ON content_items FOR SELECT USING (is_active = true);

-- User Content History
DROP POLICY IF EXISTS "Users can view own content history" ON user_content_history;
CREATE POLICY "Users can view own content history" ON user_content_history FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own content history" ON user_content_history;
CREATE POLICY "Users can insert own content history" ON user_content_history FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own content history" ON user_content_history;
CREATE POLICY "Users can update own content history" ON user_content_history FOR UPDATE USING (auth.uid() = user_id);

-- Earning Methods - Public read access
DROP POLICY IF EXISTS "Anyone can view earning methods" ON earning_methods;
CREATE POLICY "Anyone can view earning methods" ON earning_methods FOR SELECT USING (is_active = true);

-- User Earnings
DROP POLICY IF EXISTS "Users can view own earnings" ON user_earnings;
CREATE POLICY "Users can view own earnings" ON user_earnings FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own earnings" ON user_earnings;
CREATE POLICY "Users can insert own earnings" ON user_earnings FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own earnings" ON user_earnings;
CREATE POLICY "Users can update own earnings" ON user_earnings FOR UPDATE USING (auth.uid() = user_id);

-- Weekly Plans
DROP POLICY IF EXISTS "Users can view own plans" ON weekly_plans;
CREATE POLICY "Users can view own plans" ON weekly_plans FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own plans" ON weekly_plans;
CREATE POLICY "Users can insert own plans" ON weekly_plans FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own plans" ON weekly_plans;
CREATE POLICY "Users can update own plans" ON weekly_plans FOR UPDATE USING (auth.uid() = user_id);

-- Sessions
DROP POLICY IF EXISTS "Users can view own sessions" ON sessions;
CREATE POLICY "Users can view own sessions" ON sessions FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own sessions" ON sessions;
CREATE POLICY "Users can insert own sessions" ON sessions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Substitute Notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON substitute_notifications;
CREATE POLICY "Users can view own notifications" ON substitute_notifications FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own notifications" ON substitute_notifications;
CREATE POLICY "Users can insert own notifications" ON substitute_notifications FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON substitute_notifications;
CREATE POLICY "Users can update own notifications" ON substitute_notifications FOR UPDATE USING (auth.uid() = user_id);

-- Daily Stats
DROP POLICY IF EXISTS "Users can view own stats" ON daily_stats;
CREATE POLICY "Users can view own stats" ON daily_stats FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own stats" ON daily_stats;
CREATE POLICY "Users can insert own stats" ON daily_stats FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own stats" ON daily_stats;
CREATE POLICY "Users can update own stats" ON daily_stats FOR UPDATE USING (auth.uid() = user_id);

-- =====================================================
-- Ensure sessions table has completed_at column
-- =====================================================
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sessions' AND column_name = 'completed_at'
    ) THEN
        ALTER TABLE sessions ADD COLUMN completed_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- =====================================================
-- Indexes for Performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_screen_time_user_date ON screen_time_logs(user_id, date);

-- Drop and recreate sessions index
DROP INDEX IF EXISTS idx_sessions_user_completed;
CREATE INDEX idx_sessions_user_completed ON sessions(user_id, completed_at);

CREATE INDEX IF NOT EXISTS idx_weekly_plans_user_week ON weekly_plans(user_id, week_start);
CREATE INDEX IF NOT EXISTS idx_daily_stats_user_date ON daily_stats(user_id, date);
CREATE INDEX IF NOT EXISTS idx_content_items_type ON content_items(content_type);
CREATE INDEX IF NOT EXISTS idx_earning_methods_category ON earning_methods(category);

-- =====================================================
-- Updated At Trigger Function (already created in 000)
-- =====================================================
-- Skipping function creation as it's in 000_complete_schema_fix.sql

-- Apply trigger to tables with updated_at
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_weekly_plans_updated_at ON weekly_plans;
CREATE TRIGGER update_weekly_plans_updated_at BEFORE UPDATE ON weekly_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_earnings_updated_at ON user_earnings;
CREATE TRIGGER update_user_earnings_updated_at BEFORE UPDATE ON user_earnings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
