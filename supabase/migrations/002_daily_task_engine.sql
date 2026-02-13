-- Zenyth Hybrid Daily Task Engine - Database Schema
-- Run this in Supabase Dashboard > SQL Editor

-- =====================================================
-- User State Snapshot (generalized performance data)
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
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- Tasks (daily task engine)
-- =====================================================
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('learning', 'practice', 'action', 'wellbeing')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped', 'replaced')),
    hobby_id TEXT,
    content_id UUID,
    earning_step_id UUID,
    scheduled_date DATE NOT NULL,
    duration_minutes INTEGER DEFAULT 15,
    is_ai_generated BOOLEAN DEFAULT false,
    ai_rationale TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- AI Jobs (async AI processing queue)
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
-- Enable Row Level Security
-- =====================================================
ALTER TABLE user_state_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_jobs ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS Policies
-- =====================================================

-- User State Snapshot
CREATE POLICY "Users can view own snapshot" ON user_state_snapshot FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own snapshot" ON user_state_snapshot FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own snapshot" ON user_state_snapshot FOR UPDATE USING (auth.uid() = user_id);

-- Tasks
CREATE POLICY "Users can view own tasks" ON tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tasks" ON tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tasks" ON tasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tasks" ON tasks FOR DELETE USING (auth.uid() = user_id);

-- AI Jobs
CREATE POLICY "Users can view own ai_jobs" ON ai_jobs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own ai_jobs" ON ai_jobs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own ai_jobs" ON ai_jobs FOR UPDATE USING (auth.uid() = user_id);

-- =====================================================
-- Indexes for Performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_tasks_user_date ON tasks(user_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(user_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_user_status ON ai_jobs(user_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_priority ON ai_jobs(status, priority DESC);

-- =====================================================
-- Updated At Triggers
-- =====================================================
CREATE TRIGGER update_user_state_snapshot_updated_at
    BEFORE UPDATE ON user_state_snapshot
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
