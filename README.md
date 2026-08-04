# SetSwipe

A workout app that pairs Tinder-style exercise discovery with training logic grounded in
exercise-science research. Built as an installable PWA — add it to your home screen and it
runs fullscreen like a native app, no App Store required.

**[▶ Live demo — setswipe.vercel.app](https://setswipe.vercel.app)** — tap *Try the live
demo*, no signup needed. The demo account is preloaded with 10 weeks of training history so
the charts, streak and PRs are populated on arrival.

---

## What makes it different

Most workout trackers treat a muscle as one thing you either train or don't. That's not how
muscles work, and it's why so many self-built routines quietly skip the same things.

This app models muscles at the level of **individual heads**, which unlocks three features a
coarser data model can't express.

### 1. Coverage grading

Each day in your split carries a checklist of the muscle heads it's responsible for. Build a
push day out of bench, incline, overhead press and pushdowns and the app tells you:

> **No direct work for side delts and triceps long head.**

That's correct, and it's the most common gap in self-built push days. Pressing drives the
*front* delt; the side delt needs abduction (lateral raises). The triceps long head crosses
the shoulder, so it's only meaningfully loaded overhead — pushdowns bias the lateral head.

Crucially, a muscle worked only as a **secondary** counts as a gap, not a pass. Overhead
pressing brushes the side delts; it is not side delt training.

### 2. Substitutions for when the machine is taken

Tap "Machine taken?" mid-workout and you get ranked alternatives scored by shared primary
muscles, matching movement pattern, and your available equipment. The pec deck returns cable
flyes and dumbbell flyes — not an unrelated press. A candidate sharing no primary muscle is
never offered, because that isn't a substitute, it's a different exercise.

Swapping affects **only that session's log**. Your saved template is never mutated.

### 3. Progressive overload that reads your history

Every suggestion comes from your actual logged performance:

> Last: 135×8 → try 140×8

Weight climbs only once you've cleared the top of the rep range on every target set;
otherwise it holds and chases one more rep. PRs are detected at log time (by weight and by
single-set volume). Plateaus surface **only in the end-of-workout summary** — never mid-set,
where it would just be discouraging.

---

## The research behind it

The muscle tagging isn't decorative. A few of the distinctions it encodes:

| Distinction | Why it matters |
|---|---|
| Front / side / rear delt | Lateral raises hit the side delt at ~66% MVC vs ~28% for overhead press |
| Triceps long vs lateral head | Overhead extensions produced ~50% more long-head growth than pushdowns |
| Biceps long vs short head | Long head is lengthened by shoulder *extension*, short head by *flexion* |
| Upper vs mid chest | Upper-pec activation peaks near a 30° incline and *falls* past 45° |
| Quads vs rectus femoris | Squats grow the vastii but barely the rectus femoris, which crosses the hip |
| Hamstrings hip vs knee | Hinges grow the long head; leg curls grow the short head |
| Gastrocnemius vs soleus | Knee straight vs knee bent selects which one you train |

One caveat the app deliberately respects: **EMG activation is not hypertrophy.** Hip thrusts
out-activate squats at every glute site, yet a controlled trial found equivalent glute growth.
Where activation and growth data disagree, the tagging follows growth.

Full writeup with sources: **[docs/EXERCISE_SCIENCE.md](docs/EXERCISE_SCIENCE.md)**

---

### 4. A coach that reads your actual numbers

The **Coach** tab combines two things: a weekly digest written by a scheduled
AWS Lambda, and a short review from the Gemini API.

Everything factual in the model's prompt — total volume, which lifts have stalled,
which muscles the routine never trains, recent PRs — is **computed by the app**.
The model only phrases it, so the advice can't drift into invented training
history. The page also lists exactly which figures the review was based on.

The prompt forbids restating the data, praise without instruction, and vague verbs
like "optimise". An early version produced *"continue completing 12 sessions"*;
it now produces *"drop the overhead press to 90% and rebuild over three sessions,
and move it to the front of the day while your shoulders are fresh."*

### 5. Progress photos that stay private

Photos upload straight from the browser to a private S3 bucket via a one-minute
presigned `PUT`, so images never pass through the app server. Viewing uses a
separate five-minute presigned `GET`. Only the object key is stored in Postgres,
the bucket denies all public access, and content type and length are validated
*before* signing — a signature is a capability, so it shouldn't be minted for
something that would be rejected afterwards.

---

## Stack

- **Next.js 16** — App Router, Server Components, Server Actions
- **TypeScript** throughout
- **Supabase** — Postgres + Auth, row-level security on every table
- **AWS** — S3 for photo storage, Lambda on an EventBridge schedule for the
  weekly digest
- **Google Gemini API** — coaching review, grounded in app-computed facts
- **Tailwind CSS v4** — CSS-first config with custom design tokens
- **Vitest** — 74 unit tests over the training logic
- **Vercel** hosting, **GitHub Actions** keep-alive

### Why a keep-alive job

Supabase pauses free-tier projects after 7 days without database activity, which
would take the whole deployment down. A scheduled GitHub Action reads one row
every three days so the live demo doesn't quietly die.

## Architecture notes

**Template and Log are strictly separate.** The template is the plan; a log records what
actually happened. They can diverge — different weight, a swapped exercise, a skipped set —
without corrupting the plan. That separation is what makes mid-workout swaps safe.

**Equipment tiers are cumulative, not exclusive.** `bodyweight < home < full_gym`. An
exercise shows when its required tier is at or *below* yours, so bodyweight moves appear for
everyone. Filtering uses a rank comparison, never an exact match.

**Coverage requirements adapt to equipment.** A bodyweight-only user is never told they're
missing side-delt isolation that doesn't exist for them — `requiredFor()` narrows the
checklist to what the library can actually train at that tier.

**Authorization is enforced in depth.** The proxy redirect is UX only; the real guarantees
are Postgres RLS policies plus an explicit ownership re-check inside every Server Action.

**The exercise library is a single source of truth.** `src/lib/exercise-library.ts` is
TypeScript; `npm run seed:sql` generates the SQL seed from it, so app and database can't
drift.

### Key files

| Concern | File |
|---|---|
| Muscle taxonomy + the science behind it | `src/lib/muscles.ts` |
| 201 tagged exercises (source of truth) | `src/lib/exercise-library.ts` |
| Split recommendation, day requirements | `src/lib/splits.ts` |
| Overload, PR detection, plateau detection | `src/lib/overload.ts` |
| Substitution ranking | `src/lib/substitutions.ts` |
| Coverage grading | `src/lib/coverage.ts` |
| Streaks, heatmap bucketing | `src/lib/stats.ts` |
| Gemini client and prompt | `src/lib/gemini.ts` |
| S3 presigning | `src/lib/s3.ts` |
| Weekly digest Lambda | `aws/digest-lambda/index.mjs` |
| AWS provisioning | `aws/setup.sh` |

> Next.js 16 renamed Middleware to **Proxy** — the root file is `proxy.ts`, not
> `middleware.ts`. A `middleware.ts` in this version silently never runs.

---

## Running locally

```bash
git clone https://github.com/KaushikApp123/setswipe.git
cd setswipe
npm install
cp .env.example .env.local   # add your Supabase URL + anon key
```

Then in the Supabase SQL Editor, run in order:

1. `supabase/schema.sql` — tables + RLS policies
2. `supabase/migrations/002_app_features.sql` — onboarding fields, PR flags
3. `supabase/migrations/003_exercise_science.sql` — muscle-head metadata
4. `supabase/migrations/004_digests_and_photos.sql` — weekly digests, photos
5. `supabase/seed_exercises.sql` — 201 tagged exercises (generated, re-runnable)

```bash
npm run dev       # http://localhost:3000
npm test          # 74 unit tests
npm run seed:sql  # regenerate the exercise seed from TypeScript
```

### Optional: the public demo account

Set `DEMO_EMAIL` / `DEMO_PASSWORD` in `.env.local`, create that account in the app, then:

```bash
npm run seed:demo
```

This writes ~10 weeks of realistic history — progressive overload, PRs, and one deliberate
plateau — through the demo user's own session, so no service-role key is needed. Re-run any
time to reset the demo after visitors have poked at it.

### Optional: AWS and Gemini

Both features degrade gracefully — the app runs fine without either, showing an
explanatory empty state instead.

```bash
bash aws/setup.sh   # S3 bucket, scoped IAM user, Lambda, EventBridge schedule
```

Then set the function's own secrets (the service-role key bypasses RLS, so it
belongs only on the Lambda — never in the app or this repo):

```bash
aws lambda update-function-configuration \
  --function-name setswipe-weekly-digest \
  --environment "Variables={SUPABASE_URL=...,SUPABASE_SERVICE_ROLE_KEY=...}"
```

Add `GEMINI_API_KEY` (free tier, [aistudio.google.com/apikey](https://aistudio.google.com/apikey))
plus `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` and
`S3_PHOTOS_BUCKET` to `.env.local`.

---

## Deliberately out of scope

- **Nutrition tracking** — no reliable free food API since MyFitnessPal's closed; it's a
  separate product
- **Per-gym equipment inventory** — replaced by three fixed equipment tiers
- **Native Lock Screen / Live Activities** — iOS-native only (ActivityKit), an accepted
  trade-off of shipping as a PWA

## License

MIT
