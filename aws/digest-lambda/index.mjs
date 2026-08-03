/**
 * Weekly digest — runs on an EventBridge schedule every Monday morning.
 *
 * For each user with completed workouts in the last 7 days it summarises the
 * week and upserts a row into public.weekly_digests, which the dashboard then
 * reads back through RLS.
 *
 * Deliberately dependency-free: Node 20 has global fetch, so PostgREST is
 * called directly and the deployment package stays a single file with no
 * npm install step.
 *
 * Environment variables (set on the function, never committed):
 *   SUPABASE_URL               https://<ref>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY  service_role key — bypasses RLS so one run can
 *                              summarise every user. Must never reach the
 *                              browser or the repository.
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function headers() {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
  };
}

async function rest(path, init = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...headers(), ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    throw new Error(`PostgREST ${res.status} on ${path}: ${await res.text()}`);
  }
  return res.status === 204 ? null : res.json();
}

/** Monday 00:00 UTC of the week containing `d`. */
function startOfWeek(d) {
  const copy = new Date(d);
  const dow = (copy.getUTCDay() + 6) % 7;
  copy.setUTCDate(copy.getUTCDate() - dow);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

export const handler = async () => {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  }

  // Summarise the week that just ended.
  const thisWeek = startOfWeek(new Date());
  const weekStart = new Date(thisWeek);
  weekStart.setUTCDate(weekStart.getUTCDate() - 7);
  const weekEnd = thisWeek;

  const from = weekStart.toISOString();
  const to = weekEnd.toISOString();

  const sets = await rest(
    "logged_sets?select=weight,reps,is_pr,exercises(name)," +
      "workout_logs!inner(user_id,performed_at,completed_at)" +
      `&workout_logs.completed_at=not.is.null` +
      `&workout_logs.performed_at=gte.${from}` +
      `&workout_logs.performed_at=lt.${to}`,
  );

  // user_id -> aggregate
  const byUser = new Map();

  for (const s of sets) {
    const uid = s.workout_logs.user_id;
    const agg =
      byUser.get(uid) ??
      { volume: 0, prs: 0, days: new Set(), perExercise: new Map() };

    const volume = Number(s.weight ?? 0) * Number(s.reps ?? 0);
    agg.volume += volume;
    if (s.is_pr) agg.prs += 1;
    agg.days.add(s.workout_logs.performed_at.slice(0, 10));

    const name = s.exercises?.name ?? "Unknown";
    agg.perExercise.set(name, (agg.perExercise.get(name) ?? 0) + volume);

    byUser.set(uid, agg);
  }

  const weekStartDate = weekStart.toISOString().slice(0, 10);
  const rows = [];

  for (const [userId, agg] of byUser) {
    const top = [...agg.perExercise.entries()].sort((a, b) => b[1] - a[1])[0];
    const workouts = agg.days.size;

    rows.push({
      user_id: userId,
      week_start: weekStartDate,
      workouts,
      total_volume: Math.round(agg.volume * 100) / 100,
      prs: agg.prs,
      top_exercise: top?.[0] ?? null,
      headline: buildHeadline(workouts, agg.volume, agg.prs),
    });
  }

  if (rows.length > 0) {
    // merge-duplicates makes the run idempotent against the unique
    // (user_id, week_start) constraint, so a retry can't create duplicates.
    await rest("weekly_digests?on_conflict=user_id,week_start", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(rows),
    });
  }

  console.log(
    JSON.stringify({ weekStart: weekStartDate, users: rows.length, sets: sets.length }),
  );
  return { statusCode: 200, users: rows.length, weekStart: weekStartDate };
};

function buildHeadline(workouts, volume, prs) {
  const vol = Math.round(volume).toLocaleString();
  if (workouts === 0) return "No sessions logged last week — an easy one to beat.";
  if (prs > 0) {
    return `${workouts} session${workouts === 1 ? "" : "s"}, ${vol} lb moved, and ${prs} personal record${prs === 1 ? "" : "s"}.`;
  }
  return `${workouts} session${workouts === 1 ? "" : "s"} and ${vol} lb moved. No PRs — a good week to push one.`;
}
