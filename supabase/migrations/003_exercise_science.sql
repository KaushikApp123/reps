-- Migration 003 — muscle-head level exercise metadata.
-- Run AFTER 002_app_features.sql. Safe to re-run.
--
-- Why: a single `muscle_group` text column can't express "this trains the
-- side delt but not the front delt", so it can't power coverage checks
-- ("your push day has no side delt work") or substitutions ("the pec deck is
-- taken — what else trains mid chest through the same pattern?").

alter table public.exercises
  add column if not exists primary_muscles text[] not null default '{}',
  add column if not exists secondary_muscles text[] not null default '{}',
  add column if not exists movement_pattern text,
  add column if not exists is_compound boolean not null default false,
  add column if not exists is_unilateral boolean not null default false;

-- Split days now carry a muscle-head checklist rather than coarse groups.
alter table public.split_days
  add column if not exists required_muscles text[] not null default '{}',
  add column if not exists optional_muscles text[] not null default '{}';

-- Substitution and coverage queries filter on these.
create index if not exists idx_exercises_primary_muscles
  on public.exercises using gin (primary_muscles);
create index if not exists idx_exercises_pattern
  on public.exercises (movement_pattern);
