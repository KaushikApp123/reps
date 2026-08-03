import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireOnboarded } from "@/lib/data";
import { detectPlateau, totalVolume, type HistorySet } from "@/lib/overload";
import { currentWeekStreak, toDayKey } from "@/lib/stats";
import { ButtonLink, Card, Stat, SectionTitle } from "@/components/ui";

export default async function SummaryPage({
  params,
}: {
  params: Promise<{ logId: string }>;
}) {
  const { logId } = await params;
  const { userId, profile } = await requireOnboarded();
  const supabase = await createClient();

  const { data: log } = await supabase
    .from("workout_logs")
    .select("id, user_id, performed_at, completed_at, split_days(name)")
    .eq("id", logId)
    .single();

  if (!log || log.user_id !== userId) redirect("/dashboard");
  if (!log.completed_at) redirect(`/workout/${logId}`);

  const dayName =
    (log.split_days as unknown as { name: string } | null)?.name ?? "Workout";

  const { data: sets } = await supabase
    .from("logged_sets")
    .select("exercise_id, weight, reps, is_pr, exercises(name, muscle_group)")
    .eq("workout_log_id", logId);

  const rows = sets ?? [];
  const volume = totalVolume(rows);
  const prs = rows.filter((s) => s.is_pr);
  const unit = profile.weight_unit;

  const { data: allLogs } = await supabase
    .from("workout_logs")
    .select("performed_at")
    .eq("user_id", userId)
    .not("completed_at", "is", null);

  const workoutDays = new Set((allLogs ?? []).map((l) => toDayKey(l.performed_at)));
  const streak = currentWeekStreak(workoutDays, profile.days_per_week ?? 0);

  const exerciseIds = [...new Set(rows.map((s) => s.exercise_id))];
  const { data: history } = exerciseIds.length
    ? await supabase
        .from("logged_sets")
        .select("exercise_id, weight, reps, workout_logs!inner(user_id, performed_at)")
        .in("exercise_id", exerciseIds)
        .eq("workout_logs.user_id", userId)
    : { data: [] };

  const byExercise = new Map<string, HistorySet[]>();
  for (const h of history ?? []) {
    const list = byExercise.get(h.exercise_id) ?? [];
    list.push({
      weight: Number(h.weight ?? 0),
      reps: Number(h.reps ?? 0),
      performedAt: (h.workout_logs as unknown as { performed_at: string }).performed_at,
    });
    byExercise.set(h.exercise_id, list);
  }

  const nameFor = new Map<string, string>();
  for (const s of rows) {
    const ex = s.exercises as unknown as { name: string } | null;
    if (ex) nameFor.set(s.exercise_id, ex.name);
  }

  const stalled = exerciseIds.filter((id) => detectPlateau(byExercise.get(id) ?? []));
  const duration = log.completed_at
    ? Math.max(1, Math.round(
        (new Date(log.completed_at).getTime() - new Date(log.performed_at).getTime()) / 60000,
      ))
    : null;

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-5 pb-10 pt-10">
      <div className="animate-pop mb-8 text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full border border-success/40 bg-success/12 text-4xl">
          ✓
        </div>
        <h1 className="text-[28px] font-bold leading-tight">{dayName} done</h1>
        <p className="mt-1.5 text-sm text-muted">
          {new Date(log.completed_at).toLocaleString(undefined, {
            weekday: "long",
            hour: "numeric",
            minute: "2-digit",
          })}
          {duration ? ` · ${duration} min` : ""}
        </p>
      </div>

      <div className="animate-rise mb-6 grid grid-cols-3 gap-2.5">
        <Stat label="Volume" value={Math.round(volume).toLocaleString()} sub={unit} />
        <Stat label="Sets" value={String(rows.length)} sub="logged" />
        <Stat
          label="Streak"
          value={`${streak}`}
          sub="weeks"
          tone={streak > 0 ? "accent" : "default"}
        />
      </div>

      {prs.length > 0 && (
        <section className="animate-rise mb-6">
          <Card className="border-gold/50 bg-gold/10">
            <h2 className="flex items-center gap-2 font-bold text-gold">
              🏆 {prs.length} personal record{prs.length === 1 ? "" : "s"}
            </h2>
            <ul className="mt-2.5 flex flex-col gap-1.5">
              {prs.map((p, i) => {
                const ex = p.exercises as unknown as { name: string } | null;
                return (
                  <li key={i} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate">{ex?.name}</span>
                    <span className="shrink-0 font-semibold num text-gold">
                      {p.weight}
                      {unit} × {p.reps}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>
        </section>
      )}

      {stalled.length > 0 && (
        <section className="animate-rise mb-6">
          <SectionTitle>Worth a look</SectionTitle>
          <Card>
            <p className="text-sm leading-relaxed text-muted">
              These haven&apos;t moved up in a few sessions. Consider a deload —
              drop to about 90% and build back, or swap in a variation.
            </p>
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {stalled.map((id) => (
                <li
                  key={id}
                  className="rounded-[var(--radius-sm)] bg-surface-3 px-2.5 py-1 text-xs text-muted"
                >
                  {nameFor.get(id) ?? "Exercise"}
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      <div className="flex flex-col gap-2.5">
        <ButtonLink href="/dashboard" size="lg" full>
          Back to dashboard
        </ButtonLink>
        <ButtonLink href="/progress" variant="secondary" full>
          View progress
        </ButtonLink>
      </div>
    </main>
  );
}
