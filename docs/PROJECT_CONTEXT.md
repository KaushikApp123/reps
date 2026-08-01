# Full App Context — Gym App ("gym-tinder")

## What it is
A workout app combining Tinder-style exercise discovery with serious workout tracking, built as a PWA (installable via "Add to Home Screen" on iOS/Android — no App Store needed).

## Stack
Next.js (App Router, TypeScript) + Supabase (Postgres + Auth, RLS enabled) + Tailwind + Vercel hosting. Built entirely on Windows.

## Core User Flow

### 1. Onboarding (once per user)
Collect: days per week available to train, goal (strength / hypertrophy / general fitness), equipment profile — one of bodyweight, home, or full_gym. Based on these, recommend a split (Upper/Lower, Push/Pull/Legs, Arnold, Full Body, etc.) via rule-based logic — no ML needed. Example: 3 days → Full Body or PPL; 4 days → Upper/Lower; 5-6 days → PPL or Arnold split.

### 2. Swipe-to-build routine
For each day in the recommended split (e.g. "Upper A," "Lower A"), show a stack of exercise cards filtered by the user's equipment profile and the muscle groups needed for that day. Swipe right = add to that day's routine, left = skip, (optionally up = "show a similar alternative"). Right-swiped exercises get default sets/reps seeded by goal (strength ≈ 4×5, hypertrophy ≈ 3×10–12, general ≈ 3×10).

### 3. Template
The result of swiping is a Template: Split → Days → Exercises → default sets/reps. This is the plan, editable anytime (re-swipe a single slot to replace an exercise).

### 4. Active Workout Mode (the core "guided" experience)
When the user starts a workout, load today's day from the template and step through exercises one at a time:

- Show target sets/reps, and a suggested weight computed from progressive overload logic (pull their last logged performance on that exercise, propose a small increase — e.g. "Last: 135×8 → Try 140×8")
- User logs each set (pre-filled from the suggestion, editable)
- Rest timer auto-starts the moment a set is logged, auto-advances to the next exercise when it ends
- PR detection: after each logged set, silently check if it beats the user's all-time best for that exercise (by weight, or by weight×reps volume) — if so, show an immediate celebration/badge
- Swap mid-workout: a swipe gesture on the current exercise card pulls the next-best alternative (same muscle group + equipment profile) — this only changes that session's log, not the underlying template
- End-of-workout summary: total weight lifted this session, any PRs hit, updated streak, and (only here, not mid-set) a plateau/deload nudge if an exercise hasn't progressed in several sessions

### 5. Tracking / Progress views (derived from logged data)
- Total weight lifted, all-time — sum of weight × reps across every logged set
- Gym visit streak / consistency — calendar heatmap of workout days (GitHub-contributions style)
- Per-exercise progress charts — weight/reps over time for any given exercise

## Data Model (scaffolded in Supabase — see `supabase/schema.sql`)
- `profiles` — user info, goal, equipment profile, days/week
- `exercises` — ~70 seeded exercises, each tagged with muscle group + required equipment tier (bodyweight/home/full_gym)
- `splits` — a user's chosen split (e.g. "Upper/Lower")
- `split_days` — the individual days within a split (e.g. "Upper A")
- `template_exercises` — the Template: which exercises live on which split day, with default sets/reps
- `workout_logs` — one row per completed workout session
- `logged_sets` — individual sets logged within a workout (exercise, weight, reps, timestamp, PR flag)

**Key principle: Template (planned) and Log (actual) are always separate.** The template says what a routine should look like; a log records what actually happened, and they can diverge (different weight used, an exercise swapped that day, a set skipped) without corrupting the plan.

Row-level security is on — each user can only see their own data.

### SQL files (run in this order in the Supabase SQL Editor)
1. `supabase/schema.sql` — core tables + RLS
2. `supabase/migrations/002_app_features.sql` — onboarding fields on `profiles` (`goal`, `equipment_profile`, `days_per_week`, `weight_unit`, `onboarding_complete`), `splits.is_active`, `split_days.muscle_groups`, `workout_logs.completed_at`, `logged_sets.is_pr`
3. `supabase/migrations/003_exercise_science.sql` — muscle-head metadata on `exercises` (`primary_muscles`, `secondary_muscles`, `movement_pattern`, `is_compound`, `is_unilateral`) and the coverage checklist on `split_days` (`required_muscles`, `optional_muscles`)
4. `supabase/seed_exercises.sql` — **generated**, 201 fully-tagged exercises. Idempotent: re-run any time.

> `supabase/seed_exercises.sql` is generated from `src/lib/exercise-library.ts` by `npm run seed:sql` — never edit it by hand. The TypeScript library is the single source of truth so the app and DB can't drift.

### Exercise science
The muscle-head tagging, day requirements, and substitution rules are grounded in
research summarised in [EXERCISE_SCIENCE.md](EXERCISE_SCIENCE.md). Read it before
changing any tagging — the distinctions (side delt vs front delt, triceps long
head, rectus femoris, the two hamstring functions, gastroc vs soleus) are
deliberate, not decorative.

### Equipment tiers are cumulative, not exclusive
`bodyweight` < `home` < `full_gym`. An exercise is shown when its required tier is **at or below** the user's profile tier — so bodyweight moves appear for everyone. Filter with the rank comparison in `src/lib/types.ts` (`isAvailable`), never an exact match.

### Next.js 16 note
Middleware was renamed to **Proxy** in Next 16 — the root file is `proxy.ts` (exporting `proxy`), not `middleware.ts`.

## Explicitly out of scope (don't build these)
- No food/nutrition tracking — no reliable free API for this (MyFitnessPal's public API is gone); it's a separate product
- No global "every gym's equipment inventory" database — replaced entirely by the 3 fixed equipment profiles
- No body measurement tracking — deprioritized
- No native Lock Screen / Live Activity feature — that's iOS-native-only (ActivityKit); accepted trade-off of going PWA. Could revisit in a future native rewrite.

## Build order
- [x] Project scaffold + Supabase schema/seed
- [x] Auth (sign up/log in via Supabase Auth) — `src/app/login/`, route protection in `proxy.ts`
- [x] Onboarding flow (days/goal/equipment → split recommendation) — `src/app/onboarding/`, rules in `src/lib/splits.ts`
- [x] Swipe-builder UI → writes to `template_exercises` — `src/app/build/`
- [x] Active Workout Mode (guided, one-exercise-at-a-time, rest timer, mid-session swap) — `src/app/workout/[logId]/`
- [x] Progressive overload suggestion logic — `src/lib/overload.ts`
- [x] PR detection — `detectPR` in `src/lib/overload.ts`, flagged on `logged_sets.is_pr` at log time
- [x] Plateau/deload detection — `detectPlateau`, surfaced only in the end-of-workout summary
- [x] Progress views: streak heatmap, total weight lifted, per-exercise charts — `src/app/progress/`
- [x] PWA manifest/install support — `src/app/manifest.ts` + generated icons in `public/`
- [ ] Deploy to Vercel

### Key file map
| Concern | File |
|---|---|
| Split recommendation rules, default sets/reps, rest times | `src/lib/splits.ts` |
| Overload suggestion, PR detection, plateau detection | `src/lib/overload.ts` |
| Streak, heatmap bucketing, volume formatting | `src/lib/stats.ts` |
| Auth-gated data access helpers | `src/lib/data.ts` |
| Supabase clients (browser / server / proxy) | `src/lib/supabase/` |

### Conventions worth keeping
- Every Server Action re-checks the user via `requireOnboarded()` and asserts ownership before writing — the proxy redirect is UX only, RLS + these checks are the real authorization.
- A mid-workout exercise swap is **client state only**; it changes what that session logs against and never touches `template_exercises`.
- Chart colors use a single-hue sequential purple ramp validated against the dark surface (`#4a41a3 → #b0a8ff`). Re-validate with the dataviz skill's `validate_palette.js` before changing them.
