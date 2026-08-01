-- Gym App schema
-- Run this in the Supabase SQL Editor (Project -> SQL Editor -> New query)

-- ============================================================
-- profiles (extends built-in auth.users)
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

-- auto-create a profile row whenever a new auth user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- exercises (shared library; user_id is null for global/seeded
-- exercises, set when a user adds their own custom exercise)
-- ============================================================
create type public.equipment_type as enum ('bodyweight', 'home', 'full_gym');

create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade,
  name text not null,
  muscle_group text not null,
  equipment public.equipment_type not null,
  created_at timestamptz not null default now()
);

-- global (seeded) exercises must have unique names so seed.sql can be
-- re-run safely to add more exercises later without creating duplicates;
-- users' own custom exercises (user_id not null) are unrestricted
create unique index if not exists exercises_global_name_unique
  on public.exercises (name) where user_id is null;

-- ============================================================
-- splits (a user's workout program, e.g. "Push Pull Legs")
-- ============================================================
create table if not exists public.splits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- split_days (a day within a split, e.g. "Day 1 - Push")
-- ============================================================
create table if not exists public.split_days (
  id uuid primary key default gen_random_uuid(),
  split_id uuid not null references public.splits (id) on delete cascade,
  name text not null,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

-- ============================================================
-- template_exercises (planned exercises for a split day)
-- ============================================================
create table if not exists public.template_exercises (
  id uuid primary key default gen_random_uuid(),
  split_day_id uuid not null references public.split_days (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  order_index integer not null default 0,
  target_sets integer,
  target_reps text, -- e.g. "8-12", free text to allow ranges/AMRAP
  created_at timestamptz not null default now()
);

-- ============================================================
-- workout_logs (an actual completed/in-progress workout session)
-- ============================================================
create table if not exists public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  split_day_id uuid references public.split_days (id) on delete set null,
  performed_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- logged_sets (individual sets performed within a workout log)
-- ============================================================
create table if not exists public.logged_sets (
  id uuid primary key default gen_random_uuid(),
  workout_log_id uuid not null references public.workout_logs (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  set_number integer not null,
  reps integer,
  weight numeric(6, 2),
  created_at timestamptz not null default now()
);

-- ============================================================
-- indexes
-- ============================================================
create index if not exists idx_splits_user_id on public.splits (user_id);
create index if not exists idx_split_days_split_id on public.split_days (split_id);
create index if not exists idx_template_exercises_split_day_id on public.template_exercises (split_day_id);
create index if not exists idx_template_exercises_exercise_id on public.template_exercises (exercise_id);
create index if not exists idx_workout_logs_user_id on public.workout_logs (user_id);
create index if not exists idx_logged_sets_workout_log_id on public.logged_sets (workout_log_id);
create index if not exists idx_logged_sets_exercise_id on public.logged_sets (exercise_id);
create index if not exists idx_exercises_user_id on public.exercises (user_id);

-- ============================================================
-- row level security
-- ============================================================
alter table public.profiles enable row level security;
alter table public.exercises enable row level security;
alter table public.splits enable row level security;
alter table public.split_days enable row level security;
alter table public.template_exercises enable row level security;
alter table public.workout_logs enable row level security;
alter table public.logged_sets enable row level security;

-- profiles: a user can read/update only their own profile
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- exercises: everyone can read the global library + their own custom
-- exercises; users can only insert/update/delete their own custom ones
create policy "exercises_select_all" on public.exercises
  for select using (user_id is null or auth.uid() = user_id);
create policy "exercises_insert_own" on public.exercises
  for insert with check (auth.uid() = user_id);
create policy "exercises_update_own" on public.exercises
  for update using (auth.uid() = user_id);
create policy "exercises_delete_own" on public.exercises
  for delete using (auth.uid() = user_id);

-- splits: fully scoped to owner
create policy "splits_all_own" on public.splits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- split_days: scoped via parent split's owner
create policy "split_days_all_own" on public.split_days
  for all using (
    exists (
      select 1 from public.splits
      where splits.id = split_days.split_id and splits.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.splits
      where splits.id = split_days.split_id and splits.user_id = auth.uid()
    )
  );

-- template_exercises: scoped via split_day -> split owner
create policy "template_exercises_all_own" on public.template_exercises
  for all using (
    exists (
      select 1 from public.split_days
      join public.splits on splits.id = split_days.split_id
      where split_days.id = template_exercises.split_day_id
        and splits.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.split_days
      join public.splits on splits.id = split_days.split_id
      where split_days.id = template_exercises.split_day_id
        and splits.user_id = auth.uid()
    )
  );

-- workout_logs: fully scoped to owner
create policy "workout_logs_all_own" on public.workout_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- logged_sets: scoped via parent workout_log's owner
create policy "logged_sets_all_own" on public.logged_sets
  for all using (
    exists (
      select 1 from public.workout_logs
      where workout_logs.id = logged_sets.workout_log_id
        and workout_logs.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.workout_logs
      where workout_logs.id = logged_sets.workout_log_id
        and workout_logs.user_id = auth.uid()
    )
  );
