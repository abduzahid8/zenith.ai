-- Complete Schema Fix - Handles partial migrations and missing tables
-- Run this in Supabase Dashboard > SQL Editor

-- =====================================================
-- 1. Create update_updated_at_column function if missing
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- =====================================================
-- 2. Create user_state_snapshot table (from 002)
-- =====================================================
CREATE TABLE IF NOT EXISTS user_state_snapshot (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    skill_level INTEGER DEFAULT 1,
    weakness_tags TEXT[] DEFAULT '{}',
    avg_completion_7d INTEGER DEFAULT 0,
    missed_days_7d INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    avg_session_time INTEGER DEFAULT 0,
    last_activity_at TIMESTAMPTZ,
    error_rate_last_session FLOAT DEFAULT 0,
    loss_streak INTEGER DEFAULT 0,
    sessions_last_24h INTEGER DEFAULT 0,
    last_ai_update_at TIMESTAMPTZ,
    ai_focus_area TEXT,
    ai_confidence_score FLOAT DEFAULT 0,
    timezone TEXT DEFAULT 'UTC',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 3. Create tasks table with all columns (from 002 + 003)
-- =====================================================
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('theory', 'practice', 'analysis', 'puzzles', 'learning', 'action', 'wellbeing')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped', 'replaced')),
    hobby_id TEXT,
    content_id UUID,
    earning_step_id UUID,
    scheduled_date DATE NOT NULL,
    duration_minutes INTEGER DEFAULT 15,
    is_ai_generated BOOLEAN DEFAULT false,
    ai_rationale TEXT,
    difficulty_rating SMALLINT CHECK (difficulty_rating BETWEEN 1 AND 5),
    engagement_rating SMALLINT CHECK (engagement_rating BETWEEN 1 AND 5),
    user_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 4. Create ai_jobs table (from 002)
-- =====================================================
CREATE TABLE IF NOT EXISTS ai_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('PROFILE_UPDATE', 'REBUILD_DAY', 'BEHAVIOR_RECALIBRATION')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    priority INTEGER DEFAULT 0,
    retry_count INTEGER DEFAULT 0,
    result_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ
);

-- =====================================================
-- 5. Create user_metrics_history table (from 003)
-- =====================================================
CREATE TABLE IF NOT EXISTS user_metrics_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    metric_date DATE NOT NULL,
    timezone TEXT,
    completion_rate DECIMAL,
    avg_session_minutes INTEGER,
    tasks_completed JSONB,
    context JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 6. Enable RLS on new tables
-- =====================================================
ALTER TABLE user_state_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_metrics_history ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 7. Create RLS Policies (with DROP IF EXISTS to avoid conflicts)
-- =====================================================

-- User State Snapshot
DROP POLICY IF EXISTS "Users can view own snapshot" ON user_state_snapshot;
CREATE POLICY "Users can view own snapshot" ON user_state_snapshot FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own snapshot" ON user_state_snapshot;
CREATE POLICY "Users can insert own snapshot" ON user_state_snapshot FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own snapshot" ON user_state_snapshot;
CREATE POLICY "Users can update own snapshot" ON user_state_snapshot FOR UPDATE USING (auth.uid() = user_id);

-- Tasks
DROP POLICY IF EXISTS "Users can view own tasks" ON tasks;
CREATE POLICY "Users can view own tasks" ON tasks FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own tasks" ON tasks;
CREATE POLICY "Users can insert own tasks" ON tasks FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own tasks" ON tasks;
CREATE POLICY "Users can update own tasks" ON tasks FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own tasks" ON tasks;
CREATE POLICY "Users can delete own tasks" ON tasks FOR DELETE USING (auth.uid() = user_id);

-- AI Jobs
DROP POLICY IF EXISTS "Users can view own ai_jobs" ON ai_jobs;
CREATE POLICY "Users can view own ai_jobs" ON ai_jobs FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own ai_jobs" ON ai_jobs;
CREATE POLICY "Users can insert own ai_jobs" ON ai_jobs FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own ai_jobs" ON ai_jobs;
CREATE POLICY "Users can update own ai_jobs" ON ai_jobs FOR UPDATE USING (auth.uid() = user_id);

-- User Metrics History
DROP POLICY IF EXISTS "Users can view own metrics" ON user_metrics_history;
CREATE POLICY "Users can view own metrics" ON user_metrics_history FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own metrics" ON user_metrics_history;
CREATE POLICY "Users can insert own metrics" ON user_metrics_history FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- 8. Create Indexes
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_tasks_user_date ON tasks(user_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(user_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_user_status ON ai_jobs(user_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_priority ON ai_jobs(status, priority DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_user_date ON user_metrics_history(user_id, metric_date DESC);

-- =====================================================
-- 9. Create Triggers
-- =====================================================
DROP TRIGGER IF EXISTS update_user_state_snapshot_updated_at ON user_state_snapshot;
CREATE TRIGGER update_user_state_snapshot_updated_at
    BEFORE UPDATE ON user_state_snapshot
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
CREATE TRIGGER update_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 10. Create rebuild_day_atomic function (from 003)
-- =====================================================
CREATE OR REPLACE FUNCTION rebuild_day_atomic(
    p_user_id UUID,
    p_scheduled_date DATE,
    p_new_tasks JSONB
) RETURNS JSONB AS $$
DECLARE
    v_replaced_count INT;
    v_result JSONB;
BEGIN
    -- Mark old tasks as replaced
    UPDATE tasks 
    SET status = 'replaced', updated_at = NOW()
    WHERE user_id = p_user_id 
        AND scheduled_date = p_scheduled_date
        AND status = 'pending';
    
    GET DIAGNOSTICS v_replaced_count = ROW_COUNT;
    
    -- Insert new tasks
    INSERT INTO tasks (user_id, title, type, status, scheduled_date, duration_minutes, is_ai_generated, ai_rationale)
    SELECT 
        p_user_id,
        t->>'title',
        COALESCE(t->>'type', 'practice'),
        'pending',
        p_scheduled_date,
        COALESCE((t->>'duration_minutes')::int, 10),
        true,
        t->>'ai_rationale'
    FROM jsonb_array_elements(p_new_tasks) AS t;
    
    -- Return result
    v_result := jsonb_build_object(
        'replaced_count', v_replaced_count,
        'new_count', jsonb_array_length(p_new_tasks)
    );
    
    RETURN v_result;
EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'rebuild_day_atomic failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;
