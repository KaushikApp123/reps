/**
 * Seeds the public demo account with ~10 weeks of realistic training history,
 * so anyone opening the demo link lands on a populated app rather than an
 * empty one.
 *
 *   npm run seed:demo
 *
 * Requires in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   DEMO_EMAIL, DEMO_PASSWORD
 *
 * It authenticates AS the demo user and writes through RLS like any other
 * client — no service-role key needed, so nothing privileged lives in the repo
 * or in CI. Safe to re-run: it wipes the demo user's own data first, which is
 * how you reset the demo after visitors have poked at it.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Minimal .env.local reader — avoids a dotenv dependency for one script.
function loadEnv() {
  try {
    const raw = readFileSync(join(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // Fall back to real environment variables (e.g. in CI).
  }
}
loadEnv();

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const EMAIL = process.env.DEMO_EMAIL!;
const PASSWORD = process.env.DEMO_PASSWORD!;

for (const [k, v] of Object.entries({ URL, ANON, EMAIL, PASSWORD })) {
  if (!v) {
    console.error(`Missing env var for ${k}. See the header of this file.`);
    process.exit(1);
  }
}

const supabase = createClient(URL, ANON);

/** The demo programme: Push / Pull / Legs, hypertrophy, full gym. */
const PLAN = [
  {
    day: "Push",
    exercises: [
      { name: "Incline Barbell Bench Press", start: 95, step: 5, sets: 3, reps: "8-12" },
      { name: "Barbell Bench Press", start: 135, step: 5, sets: 4, reps: "8-12" },
      { name: "Barbell Overhead Press", start: 85, step: 5, sets: 3, reps: "8-12", stalls: true },
      { name: "Cable Lateral Raise", start: 15, step: 2.5, sets: 3, reps: "12-15" },
      { name: "Overhead Cable Extension", start: 40, step: 5, sets: 3, reps: "10-12" },
      { name: "Rope Pushdown", start: 45, step: 5, sets: 3, reps: "10-12" },
    ],
  },
  {
    day: "Pull",
    exercises: [
      { name: "Lat Pulldown", start: 120, step: 5, sets: 4, reps: "8-12" },
      { name: "Barbell Row", start: 115, step: 5, sets: 3, reps: "8-12" },
      { name: "Face Pull", start: 35, step: 2.5, sets: 3, reps: "12-15" },
      { name: "Incline Dumbbell Curl", start: 25, step: 2.5, sets: 3, reps: "10-12" },
      { name: "Preacher Curl", start: 50, step: 5, sets: 3, reps: "10-12" },
    ],
  },
  {
    day: "Legs",
    exercises: [
      { name: "Barbell Back Squat", start: 185, step: 10, sets: 4, reps: "6-10" },
      { name: "Barbell Romanian Deadlift", start: 155, step: 10, sets: 3, reps: "8-12" },
      { name: "Leg Extension", start: 90, step: 5, sets: 3, reps: "12-15" },
      { name: "Lying Leg Curl", start: 70, step: 5, sets: 3, reps: "10-12" },
      { name: "Standing Calf Raise Machine", start: 110, step: 10, sets: 4, reps: "12-15" },
      { name: "Seated Calf Raise Machine", start: 70, step: 5, sets: 3, reps: "12-15" },
    ],
  },
];

const WEEKS = 10;
/** Mon / Wed / Fri, matching the three-day split. */
const DAY_OFFSETS = [0, 2, 4];

function parseTop(reps: string): number {
  const n = reps.match(/\d+/g)!;
  return parseInt(n[n.length - 1], 10);
}
function parseLow(reps: string): number {
  return parseInt(reps.match(/\d+/)![0], 10);
}

async function main() {
  const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });
  if (authError || !auth.user) {
    console.error("Could not sign in as the demo user:", authError?.message);
    console.error("Create the account first (sign up in the app with DEMO_EMAIL/DEMO_PASSWORD).");
    process.exit(1);
  }
  const userId = auth.user.id;
  console.log("Signed in as demo user", userId);

  // --- reset -------------------------------------------------------------
  // Logs cascade to logged_sets; splits cascade to days and template rows.
  await supabase.from("workout_logs").delete().eq("user_id", userId);
  await supabase.from("splits").delete().eq("user_id", userId);
  console.log("Cleared previous demo data");

  // --- profile -----------------------------------------------------------
  await supabase
    .from("profiles")
    .update({
      display_name: "Demo",
      goal: "hypertrophy",
      equipment_profile: "full_gym",
      days_per_week: 3,
      weight_unit: "lb",
      onboarding_complete: true,
    })
    .eq("id", userId);

  // --- exercise lookup ---------------------------------------------------
  const names = PLAN.flatMap((d) => d.exercises.map((e) => e.name));
  const { data: exRows } = await supabase
    .from("exercises")
    .select("id, name, primary_muscles")
    .in("name", names);

  const byName = new Map((exRows ?? []).map((e) => [e.name, e]));
  const missing = names.filter((n) => !byName.has(n));
  if (missing.length) {
    console.error("Missing exercises (run seed_exercises.sql first):", missing.join(", "));
    process.exit(1);
  }

  // --- split + days + template ------------------------------------------
  const { data: split } = await supabase
    .from("splits")
    .insert({ user_id: userId, name: "Push / Pull / Legs", is_active: true })
    .select("id")
    .single();

  const dayIds: Record<string, string> = {};
  for (const [i, block] of PLAN.entries()) {
    const required = [...new Set(block.exercises.flatMap((e) => byName.get(e.name)!.primary_muscles ?? []))];
    const { data: day } = await supabase
      .from("split_days")
      .insert({
        split_id: split!.id,
        name: block.day,
        order_index: i,
        required_muscles: required,
        optional_muscles: [],
        muscle_groups: [],
      })
      .select("id")
      .single();

    dayIds[block.day] = day!.id;

    await supabase.from("template_exercises").insert(
      block.exercises.map((e, j) => ({
        split_day_id: day!.id,
        exercise_id: byName.get(e.name)!.id,
        order_index: j,
        target_sets: e.sets,
        target_reps: e.reps,
      })),
    );
  }
  console.log("Created split, days, and template");

  // --- history -----------------------------------------------------------
  // Weight climbs once the top of the rep range is cleared, mirroring the
  // app's own overload rule, so the suggestions look coherent on arrival.
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) - 7 * (WEEKS - 1));
  monday.setHours(18, 0, 0, 0);

  let logCount = 0;
  let setCount = 0;
  let prCount = 0;

  const bestSoFar = new Map<string, { weight: number; volume: number }>();

  for (let w = 0; w < WEEKS; w++) {
    for (const [d, block] of PLAN.entries()) {
      // Skip one session mid-way so the heatmap isn't unnaturally perfect.
      if (w === 5 && d === 2) continue;

      const performed = new Date(monday);
      performed.setDate(monday.getDate() + w * 7 + DAY_OFFSETS[d]);

      const { data: log } = await supabase
        .from("workout_logs")
        .insert({
          user_id: userId,
          split_day_id: dayIds[block.day],
          performed_at: performed.toISOString(),
          completed_at: new Date(performed.getTime() + 62 * 60000).toISOString(),
        })
        .select("id")
        .single();

      logCount++;
      const rows: Record<string, unknown>[] = [];

      for (const ex of block.exercises) {
        const id = byName.get(ex.name)!.id;
        // Progress every other week; a "stalls" lift stops climbing near the end.
        const cycles = Math.floor(w / 2);
        const capped = ex.stalls ? Math.min(cycles, 2) : cycles;
        const weight = ex.start + capped * ex.step;

        const low = parseLow(ex.reps);
        const top = parseTop(ex.reps);
        // Reps drift up within the range on odd weeks, resetting after a jump.
        const reps = w % 2 === 0 ? low + 1 : top;

        for (let s = 0; s < ex.sets; s++) {
          const setReps = Math.max(low, reps - (s > 1 ? 1 : 0));
          const best = bestSoFar.get(id) ?? { weight: 0, volume: 0 };
          const volume = weight * setReps;
          const isPR = weight > best.weight || volume > best.volume;
          if (isPR) {
            bestSoFar.set(id, {
              weight: Math.max(best.weight, weight),
              volume: Math.max(best.volume, volume),
            });
            prCount++;
          }

          rows.push({
            workout_log_id: log!.id,
            exercise_id: id,
            set_number: s + 1,
            weight,
            reps: setReps,
            is_pr: isPR,
            created_at: new Date(performed.getTime() + (rows.length + 1) * 150000).toISOString(),
          });
          setCount++;
        }
      }

      await supabase.from("logged_sets").insert(rows);
    }
    process.stdout.write(`  week ${w + 1}/${WEEKS}\r`);
  }

  console.log(`\nSeeded ${logCount} workouts, ${setCount} sets, ${prCount} PRs`);
  console.log("Demo account ready.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
