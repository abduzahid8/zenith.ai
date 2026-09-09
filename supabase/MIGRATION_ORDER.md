# Database Migration Order

Run these SQL files in your Supabase Dashboard > SQL Editor in this exact order:

## 1. First: Complete Schema Fix
**File:** `migrations/000_complete_schema_fix.sql`

This creates:
- `update_updated_at_column()` function
- `user_state_snapshot` table
- `tasks` table (with all feedback columns)
- `ai_jobs` table
- `user_metrics_history` table
- All RLS policies, indexes, and triggers

## 2. Second: Base Schema
**File:** `migrations/001_life_switch_schema.sql`

This creates:
- `user_profiles`
- `quiz_answers`
- `user_hobbies`
- `screen_time_logs` ← **This fixes the screen time error**
- `screen_time_limits`
- `content_items`
- `user_content_history`
- `earning_methods`
- `user_earnings`
- `weekly_plans`
- `sessions`
- `substitute_notifications`
- `daily_stats`

**Note:** Some policies may already exist from 000, that's OK - the script uses `CREATE POLICY` which will skip if exists.

## 3. Skip These (Already Applied)
- ~~`002_daily_task_engine.sql`~~ - Already included in 000
- ~~`003_task_system_upgrade.sql`~~ - Already included in 000

## 3. Third: Verified Credentials
**File:** `migrations/009_credential_system.sql`

This creates:
- `credential_programs` (catalog + seed of the first 5 credentials)
- `user_credential_progress`
- `credential_attempts`
- `credential_evidence`
- `issued_credentials` + `public_credential_verification` view
- All RLS policies (user tables filtered by `user_id = auth.uid()`, catalog readable by all)

## 4. Fourth: Hobby-anchored credential programs
**File:** `migrations/010_credential_hobby_programs.sql`

Replaces the seed catalog with one program per real hobby (bank weeks =
skills). User tables untouched.

## Verification Query

After running both migrations, verify all tables exist:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

You should see:
- ai_jobs
- content_items
- daily_stats
- earning_methods
- quiz_answers
- screen_time_limits
- screen_time_logs
- sessions
- substitute_notifications
- tasks ✓
- user_content_history
- user_earnings
- user_hobbies
- user_metrics_history
- user_profiles
- user_state_snapshot ✓
- weekly_plans
