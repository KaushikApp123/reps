import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireOnboarded, getActiveSplit } from "@/lib/data";
import { summariseTraining, type CoachSetRow } from "@/lib/coaching";
import { geminiConfigured, getRecommendation, type CoachingBrief } from "@/lib/gemini";
import { isTrainable } from "@/lib/splits";
import { muscleLabel, type Muscle } from "@/lib/muscles";
import { EXERCISE_COLUMNS, toSubstitutable, type ExerciseRow } from "@/lib/exercises";
import { EQUIPMENT_LABEL, GOAL_LABEL, type EquipmentTier, type Goal } from "@/lib/types";
import { Card, EmptyState, SectionTitle, Stat } from "@/components/ui";

// The model call takes a couple of seconds; don't cache a stale answer but
// don't recompute on every navigation either.
export const revalidate = 300;

export default async function CoachPage() {
  const { userId, profile } = await requireOnboarded();
  const active = await getActiveSplit(userId);
  if (!active) redirect("/onboarding");

  const supabase = await createClient();
  const unit = profile.weight_unit;
  const tier: EquipmentTier = profile.equipment_profile ?? "bodyweight";

  // ---- the week's digest, written by the scheduled Lambda ----------------
  const { data: digest } = await supabase
    .from("weekly_digests")
    .select("week_start, workouts, total_volume, prs, top_exercise, headline")
    .eq("user_id", userId)
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();

  // ---- raw material for the brief ---------------------------------------
  const { data: logs } = await supabase
    .from("workout_logs")
    .select("id, performed_at")
    .eq("user_id", userId)
    .not("completed_at", "is", null)
    .order("performed_at", { ascending: false });

  const allLogs = logs ?? [];

  const { data: sets } = await supabase
    .from("logged_sets")
    .select(
      "exercise_id, weight, reps, is_pr, exercises(name)," +
        "workout_logs!inner(user_id, performed_at, completed_at)",
    )
    .eq("workout_logs.user_id", userId)
    .not("workout_logs.completed_at", "is", null);

  const summary = summariseTraining(
    allLogs,
    (sets ?? []) as unknown as CoachSetRow[],
  );

  // ---- coverage gaps across the whole template ---------------------------
  const dayIds = active.days.map((d) => d.id);
  const { data: templateRows } = dayIds.length
    ? await supabase
        .from("template_exercises")
        .select(`split_day_id, exercises(${EXERCISE_COLUMNS})`)
        .in("split_day_id", dayIds)
    : { data: [] };

  const chosenByDay = new Map<string, ReturnType<typeof toSubstitutable>[]>();
  for (const t of templateRows ?? []) {
    const list = chosenByDay.get(t.split_day_id) ?? [];
    list.push(toSubstitutable(t.exercises as unknown as ExerciseRow));
    chosenByDay.set(t.split_day_id, list);
  }

  const gapSet = new Set<Muscle>();
  for (const day of active.days) {
    const required = ((day.required_muscles ?? []) as Muscle[]).filter((m) =>
      isTrainable(m, tier),
    );
    const chosen = chosenByDay.get(day.id) ?? [];
    for (const m of required) {
      if (!chosen.some((e) => e.primary.includes(m))) gapSet.add(m);
    }
  }

  const brief: CoachingBrief = {
    splitName: active.split.name,
    goal: GOAL_LABEL[(profile.goal ?? "general") as Goal],
    equipment: EQUIPMENT_LABEL[tier],
    daysPerWeek: profile.days_per_week ?? 0,
    weeksTrained: summary.weeksTrained,
    workoutsLast30: summary.workoutsLast30,
    totalVolume: summary.totalVolume,
    unit,
    stalled: summary.stalled.slice(0, 5),
    gaps: [...gapSet].map(muscleLabel).slice(0, 5),
    recentPRs: summary.recentPRs.slice(0, 5),
  };

  const enoughData = allLogs.length >= 3;
  const recommendation =
    geminiConfigured() && enoughData ? await getRecommendation(brief) : null;

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-5 pb-8 pt-7">
      <header className="animate-rise mb-6">
        <h1 className="text-[26px] font-bold leading-tight">Coach</h1>
        <p className="mt-1 text-sm text-muted">
          A read on your training, from your own logged numbers.
        </p>
      </header>

      {/* Weekly digest — written by the scheduled AWS Lambda */}
      {digest && (
        <section className="animate-rise mb-6">
          <SectionTitle>Last week</SectionTitle>
          <Card>
            <p className="text-[15px] leading-relaxed">{digest.headline}</p>
            <div className="mt-3.5 grid grid-cols-3 gap-2.5">
              <Stat label="Sessions" value={String(digest.workouts)} />
              <Stat
                label="Volume"
                value={Math.round(Number(digest.total_volume)).toLocaleString()}
                sub={unit}
              />
              <Stat
                label="PRs"
                value={String(digest.prs)}
                tone={digest.prs > 0 ? "gold" : "default"}
              />
            </div>
            {digest.top_exercise && (
              <p className="mt-3 text-xs text-subtle">
                Most volume: {digest.top_exercise}
              </p>
            )}
          </Card>
        </section>
      )}

      {/* Gemini review */}
      <section className="animate-rise" style={{ animationDelay: "40ms" }}>
        <SectionTitle>Your review</SectionTitle>

        {!enoughData ? (
          <EmptyState
            icon="📋"
            title="Not enough to go on yet"
            body="Log three workouts and there'll be enough history for a useful read."
          />
        ) : recommendation ? (
          <Card>
            <h3 className="font-bold">{recommendation.headline}</h3>
            <ul className="mt-3 flex flex-col gap-2.5">
              {recommendation.points.map((p, i) => (
                <li key={i} className="flex gap-2.5 text-sm leading-relaxed">
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 border-t border-border pt-3 text-[11px] leading-relaxed text-subtle">
              Generated from your logged sessions. Every number in the prompt is
              computed by the app, not the model.
            </p>
          </Card>
        ) : (
          <EmptyState
            icon="⚡"
            title="Review unavailable"
            body="The coaching service didn't respond. Your training data is unaffected — try again shortly."
          />
        )}
      </section>

      {/* What the review was based on — keeps the AI honest and inspectable */}
      {enoughData && (
        <section className="animate-rise mt-6" style={{ animationDelay: "80ms" }}>
          <SectionTitle>What this is based on</SectionTitle>
          <Card>
            <dl className="flex flex-col gap-2 text-sm">
              <Row label="Sessions, last 30 days" value={String(brief.workoutsLast30)} />
              <Row label="Weeks training" value={String(brief.weeksTrained)} />
              <Row
                label="Total volume"
                value={`${Math.round(brief.totalVolume).toLocaleString()} ${unit}`}
              />
              <Row
                label="Stalled lifts"
                value={brief.stalled.length ? brief.stalled.join(", ") : "None"}
              />
              <Row
                label="Coverage gaps"
                value={brief.gaps.length ? brief.gaps.join(", ") : "None"}
              />
            </dl>
          </Card>
        </section>
      )}
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
