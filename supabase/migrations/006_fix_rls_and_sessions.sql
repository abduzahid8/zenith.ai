-- 006: Fix missing UPDATE policy on user_metrics_history and sessions table issues

-- =====================================================
-- 1. Add missing UPDATE policy for user_metrics_history
--    upsert() = INSERT + UPDATE; without an UPDATE policy
--    the USING check fails when the row already exists.
-- =====================================================
DROP POLICY IF EXISTS "Users can update own metrics" ON user_metrics_history;
CREATE POLICY "Users can update own metrics" ON user_metrics_history
    FOR UPDATE USING (auth.uid() = user_id);

-- =====================================================
-- 2. Add missing duration_minutes column to sessions
--    sessionService.saveSession inserts duration_minutes
--    but the column was never added to the schema.
-- =====================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'sessions' AND column_name = 'duration_minutes'
    ) THEN
        ALTER TABLE sessions ADD COLUMN duration_minutes INTEGER;
    END IF;
END $$;

-- =====================================================
-- 3. Recreate sessions.user_id FK to guarantee it points
--    to auth.users (not public.users), which is the cause
--    of the 23503 FK violation on session save.
-- =====================================================
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_user_id_fkey;
ALTER TABLE sessions
    ADD CONSTRAINT sessions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
