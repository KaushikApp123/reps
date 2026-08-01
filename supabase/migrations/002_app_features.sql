-- Migration 002 — fields needed for onboarding, active workout mode, and PRs.
-- Run this in the Supabase SQL Editor AFTER schema.sql and seed.sql.
-- Safe to re-run.

-- ============================================================
-- onboarding fields on profiles
-- ============================================================
do $$ begin
  create type public.goal_type as enum ('strength', 'hypertrophy', 'general');
exception when duplicate_object then null;
end $$;

alter table public.profiles
  add column if not exists goal public.goal_type,
  add column if not exists equipment_profile public.equipment_type,
  add column if not exists days_per_week integer,
  add column if not exists weight_unit text not null default 'lb',
  add column if not exists onboarding_complete boolean not null default false;

-- allow a user to create their own profile row (the signup trigger normally
-- does this, but this covers users created before the trigger existed)
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

-- ============================================================
-- splits: mark which program is the user's current one
-- ============================================================
alter table public.splits
  add column if not exists is_active boolean not null default true;

-- ============================================================
-- split_days: which muscle groups this day targets, so the swipe
-- builder knows what to show. Stored as text[] matching
-- exercises.muscle_group values.
-- ============================================================
alter table public.split_days
  add column if not exists muscle_groups text[] not null default '{}';

-- ============================================================
-- workout_logs: track in-progress vs finished sessions
-- ============================================================
alter table public.workout_logs
  add column if not exists completed_at timestamptz;

-- ============================================================
-- logged_sets: PR flag set at log time by the app
-- ============================================================
alter table public.logged_sets
  add column if not exists is_pr boolean not null default false;

-- reps/weight should always be present for a logged set
alter table public.logged_sets
  alter column reps set default 0,
  alter column weight set default 0;

-- ============================================================
-- helpful indexes for progress queries
-- ============================================================
create index if not exists idx_workout_logs_user_performed
  on public.workout_logs (user_id, performed_at desc);
create index if not exists idx_logged_sets_exercise_created
  on public.logged_sets (exercise_id, created_at desc);
