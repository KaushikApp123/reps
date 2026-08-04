import { createClient } from "@/lib/supabase/server";
import { requireOnboarded } from "@/lib/data";
import {
  buildHeatmap,
  currentDayStreak,
  currentWeekStreak,
  formatVolume,
  toDayKey,
} from "@/lib/stats";
import { ButtonLink, Card, Stat, SectionTitle } from "@/components/ui";
import Heatmap from "@/components/heatmap";
import ExerciseChart, { type ExerciseSeries } from "@/components/exercise-chart";

export default async function ProgressPage() {
  const { userId, profile } = await requireOnboarded();
  const supabase = await createClient();
  const unit = profile.weight_unit;

  const { data: rows } = await supabase
    .from("logged_sets")
    .select(
      "exercise_id, weight, reps, is_pr, exercises(name), workout_logs!inner(user_id, performed_at, completed_at)",
    )
    .eq("workout_logs.user_id", userId)
    .not("workout_logs.completed_at", "is", null);

  type Row = {
    exercise_id: string;
    weight: number | null;
    reps: number | null;
    is_pr: boolean;
    exercises: { name: string } | null;
    workout_logs: { performed_at: string };
  };

  const sets = (rows ?? []) as unknown as Row[];

  let totalVolume = 0;
  const volumeByDay = new Map<string, number>();
  // exerciseId -> dayKey -> { topWeight, volume, name, date }
  const perExercise = new Map<
    string,
    { name: string; days: Map<string, { topWeight: number; volume: number; date: string }> }
  >();

  for (const s of sets) {
    const w = Number(s.weight ?? 0);
    const r = Number(s.reps ?? 0);
    const vol = w * r;
    const day = toDayKey(s.workout_logs.performed_at);

    totalVolume += vol;
    volumeByDay.set(day, (volumeByDay.get(day) ?? 0) + vol);

    const entry =
      perExercise.get(s.exercise_id) ??
      { name: s.exercises?.name ?? "Exercise", days: new Map() };
    const dayEntry = entry.days.get(day) ?? {
      topWeight: 0,
      volume: 0,
      date: s.workout_logs.performed_at,
    };
    dayEntry.topWeight = Math.max(dayEntry.topWeight, w);
    dayEntry.volume += vol;
    entry.days.set(day, dayEntry);
    perExercise.set(s.exercise_id, entry);
  }

  const workoutDays = new Set(volumeByDay.keys());
  const totalPRs = sets.filter((s) => s.is_pr).length;

  const series: ExerciseSeries[] = [...perExercise.entries()]
    .map(([exerciseId, e]) => ({
      exerciseId,
      name: e.name,
      points: [...e.days.entries()]
        .sort((a, b) => (a[0] < b[0] ? -1 : 1))
        .map(([, v]) => ({
          date: v.date,
          topWeight: v.topWeight,
          volume: v.volume,
        })),
    }))
    // Most-trained exercises first — that's what people want to check.
    .sort((a, b) => b.points.length - a.points.length);

  const heatmap = buildHeatmap(volumeByDay, 26);

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-5 pb-8 pt-7">
      <header className="animate-rise mb-6">
        <h1 className="text-[26px] font-bold leading-tight">Progress</h1>
        <p className="mt-1 text-sm text-muted">
          {workoutDays.size === 0
            ? "Log your first workout to start building history."
            : `${workoutDays.size} workout${workoutDays.size === 1 ? "" : "s"} tracked so far.`}
        </p>
      </header>

      {/* Headline numbers belong in tiles, not a chart */}
      <div className="animate-rise mb-7 grid grid-cols-2 gap-2.5">
        <Stat
          label="Total lifted"
          value={formatVolume(totalVolume, unit)}
          sub="all time"
          tone="accent"
        />
        <Stat label="Workouts" value={String(workoutDays.size)} sub="completed" />
        <Stat
          label="Week streak"
          value={`${currentWeekStreak(workoutDays, profile.days_per_week ?? 0)}`}
          sub="weeks on target"
        />
        <Stat
          label="PRs"
          value={String(totalPRs)}
          sub="all time"
          tone={totalPRs > 0 ? "gold" : "default"}
        />
      </div>

      <section className="animate-rise mb-7" style={{ animationDelay: "40ms" }}>
        <SectionTitle>Consistency</SectionTitle>
        <Card>
          <Heatmap weeks={heatmap} unit={unit} />
          <p className="mt-3 text-xs text-subtle">
            {currentDayStreak(workoutDays)} day streak · last 26 weeks
          </p>
        </Card>
      </section>

      <section className="animate-rise" style={{ animationDelay: "80ms" }}>
        <SectionTitle>Per-exercise progress</SectionTitle>
        <ExerciseChart series={series} unit={unit} />
      </section>

      <section className="animate-rise mt-7" style={{ animationDelay: "120ms" }}>
        <SectionTitle>Progress photos</SectionTitle>
        <ButtonLink href="/photos" variant="secondary" full>
          📷 View progress photos
        </ButtonLink>
      </section>
    </main>
  );
}
