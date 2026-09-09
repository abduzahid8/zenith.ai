-- Onboarding 2.0: user goals / session-length / experience preferences.
-- Progressive profiling: rows are created only when the user completes the
-- extended steps, so existing users are never blocked.

create table if not exists public.user_goals (
    user_id uuid primary key references auth.users (id) on delete cascade,
    goals text[] not null default '{}',
    preferred_session_minutes integer,
    experience_preference text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.user_goals enable row level security;

drop policy if exists "user_goals_select_own" on public.user_goals;
create policy "user_goals_select_own"
    on public.user_goals for select
    using (auth.uid() = user_id);

drop policy if exists "user_goals_insert_own" on public.user_goals;
create policy "user_goals_insert_own"
    on public.user_goals for insert
    with check (auth.uid() = user_id);

drop policy if exists "user_goals_update_own" on public.user_goals;
create policy "user_goals_update_own"
    on public.user_goals for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

drop policy if exists "user_goals_delete_own" on public.user_goals;
create policy "user_goals_delete_own"
    on public.user_goals for delete
    using (auth.uid() = user_id);
