-- 005: Fix sessions.hobby_id type (UUID → TEXT) and add missing updated_at to user_metrics_history

-- 1. Fix sessions.hobby_id column type from UUID to TEXT
--    The hobby IDs are text slugs like 'chinese', 'python', 'english' — not UUIDs.
--    First drop the spurious FK constraint that was added outside migrations.
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_hobby_id_fkey;
ALTER TABLE sessions ALTER COLUMN hobby_id TYPE TEXT USING hobby_id::TEXT;

-- 2. Add missing updated_at column to user_metrics_history
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_metrics_history' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE user_metrics_history ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- 3. Add upsert-friendly unique constraint if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'user_metrics_history_user_id_metric_date_key'
    ) THEN
        ALTER TABLE user_metrics_history ADD CONSTRAINT user_metrics_history_user_id_metric_date_key UNIQUE (user_id, metric_date);
    END IF;
END $$;
