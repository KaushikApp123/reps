-- Migration 004 — weekly digests (written by the AWS Lambda) and progress
-- photos (stored in S3, with only the object key kept here).
-- Run AFTER 003_exercise_science.sql. Safe to re-run.

-- ============================================================
-- weekly_digests
-- ============================================================
create table if not exists public.weekly_digests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  /* Monday of the week being summarised. */
  week_start date not null,
  workouts integer not null default 0,
  total_volume numeric(12, 2) not null default 0,
  prs integer not null default 0,
  top_exercise text,
  headline text,
  created_at timestamptz not null default now(),
  unique (user_id, week_start)
);

create index if not exists idx_weekly_digests_user_week
  on public.weekly_digests (user_id, week_start desc);

alter table public.weekly_digests enable row level security;

-- Users read their own digests. Nothing writes through this policy — the
-- Lambda uses the service role, which bypasses RLS.
drop policy if exists "weekly_digests_select_own" on public.weekly_digests;
create policy "weekly_digests_select_own" on public.weekly_digests
  for select using (auth.uid() = user_id);

-- ============================================================
-- progress_photos
-- Only the S3 object key lives in Postgres; the bucket stays private and
-- the app hands out short-lived presigned URLs for both upload and view.
-- ============================================================
create table if not exists public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  s3_key text not null unique,
  content_type text not null,
  byte_size integer not null,
  note text,
  taken_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_progress_photos_user_taken
  on public.progress_photos (user_id, taken_at desc);

alter table public.progress_photos enable row level security;

drop policy if exists "progress_photos_all_own" on public.progress_photos;
create policy "progress_photos_all_own" on public.progress_photos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
