-- Migration: Update delete_user_account RPC function to include new tables
-- Run this in Supabase Dashboard -> SQL Editor

CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Get the calling user's ID from the JWT
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Delete all user data (cascades handle most tables, but we delete manually to be safe)
  DELETE FROM public.tasks              WHERE user_id = v_user_id;
  DELETE FROM public.sessions           WHERE user_id = v_user_id;
  DELETE FROM public.user_hobbies       WHERE user_id = v_user_id;
  DELETE FROM public.user_profiles      WHERE user_id = v_user_id;
  DELETE FROM public.user_state_snapshot WHERE user_id = v_user_id;
  DELETE FROM public.weekly_plans       WHERE user_id = v_user_id;
  DELETE FROM public.quiz_answers       WHERE user_id = v_user_id;
  DELETE FROM public.screen_time_logs   WHERE user_id = v_user_id;
  DELETE FROM public.screen_time_limits WHERE user_id = v_user_id;
  DELETE FROM public.user_content_history WHERE user_id = v_user_id;
  DELETE FROM public.user_earnings      WHERE user_id = v_user_id;
  DELETE FROM public.substitute_notifications WHERE user_id = v_user_id;
  DELETE FROM public.daily_stats        WHERE user_id = v_user_id;
  DELETE FROM public.ai_jobs            WHERE user_id = v_user_id;
  DELETE FROM public.user_metrics_history WHERE user_id = v_user_id;

  -- Delete the auth user — this must be last
  DELETE FROM auth.users WHERE id = v_user_id;
END;
$$;

-- Allow authenticated users to call this function on themselves only
REVOKE ALL ON FUNCTION public.delete_user_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;
