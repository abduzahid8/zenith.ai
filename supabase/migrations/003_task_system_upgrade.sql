-- Migration: Task System Upgrade (Phase 1 & 2)

-- 1. Add Timezone Support
ALTER TABLE user_state_snapshot 
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC';

-- 2. Add Rebuild Day Atomic Function (RPC) for safe task replacement
-- This ensures that marking old tasks as replaced and inserting new ones happens in a single transaction
CREATE OR REPLACE FUNCTION rebuild_day_atomic(
  p_user_id uuid,
  p_scheduled_date date,
  p_new_tasks jsonb
) RETURNS jsonb AS $$
DECLARE
  v_replaced_count int;
  v_result jsonb;
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

-- 3. Prepare for Data Quality Phase (Creating metrics table early)
CREATE TABLE IF NOT EXISTS user_metrics_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  metric_date date NOT NULL,
  timezone text,
  completion_rate decimal,
  avg_session_minutes int,
  tasks_completed jsonb, -- Array of {task_id, duration, difficulty_rating}
  context jsonb, -- {day_of_week, time_of_day, prior_activity}
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_metrics_user_date ON user_metrics_history(user_id, metric_date DESC);

-- 4. Phase 2: Feedback Loop
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS difficulty_rating SMALLINT CHECK (difficulty_rating BETWEEN 1 AND 5),
ADD COLUMN IF NOT EXISTS engagement_rating SMALLINT CHECK (engagement_rating BETWEEN 1 AND 5),
ADD COLUMN IF NOT EXISTS user_notes TEXT;
