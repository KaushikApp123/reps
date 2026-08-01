import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireOnboarded } from "@/lib/data";
import { restSecondsFor } from "@/lib/splits";
import { suggestNextSet, type HistorySet } from "@/lib/overload";
import { findSubstitutes } from "@/lib/substitutions";
import { EXERCISE_COLUMNS, toSubstitutable, type ExerciseRow } from "@/lib/exercises";
import { EQUIPMENT_RANK, type EquipmentTier } from "@/lib/types";
import ActiveWorkout, { type WorkoutExercise } from "./active-workout";

export default async function WorkoutPage({
  params,
}: {
  params: Promise<{ logId: string }>;
}) {
  const { logId } = await params;
  const { userId, profile } = await requireOnboarded();
  const supabase = await createClient();

  const { data: log } = await supabase
    .from("workout_logs")
    .select("id, user_id, split_day_id, completed_at, performed_at")
    .eq("id", logId)
    .single();

  if (!log || log.user_id !== userId) redirect("/dashboard");
  if (log.completed_at) redirect(`/workout/${logId}/summary`);
  if (!log.split_day_id) redirect("/dashboard");

  const { data: day } = await supabase
    .from("split_days")
    .select("id, name")
    .eq("id", log.split_day_id)
    .single();

  if (!day) redirect("/dashboard");

  const { data: template } = await supabase
    .from("template_exercises")
    .select(`id, exercise_id, order_index, target_sets, target_reps, exercises(${EXERCISE_COLUMNS})`)
    .eq("split_day_id", day.id)
    .order("order_index");

  const rows = template ?? [];
  if (rows.length === 0) redirect(`/build?day=${day.id}`);

  const exerciseIds = rows.map((r) => r.exercise_id);

  const { data: history } = await supabase
    .from("logged_sets")
    .select("exercise_id, weight, reps, workout_logs!inner(user_id, performed_at)")
    .in("exercise_id", exerciseIds)
    .eq("workout_logs.user_id", userId)
    .neq("workout_log_id", logId);

  const historyByExercise = new Map<string, HistorySet[]>();
  for (const h of history ?? []) {
    const list = historyByExercise.get(h.exercise_id) ?? [];
    list.push({
      weight: Number(h.weight ?? 0),
      reps: Number(h.reps ?? 0),
      performedAt: (h.workout_logs as unknown as { performed_at: string })
        .performed_at,
    });
    historyByExercise.set(h.exercise_id, list);
  }

  const { data: existingSets } = await supabase
    .from("logged_sets")
    .select("id, exercise_id, set_number, weight, reps, is_pr")
    .eq("workout_log_id", logId)
    .order("created_at");

  // Candidate pool for mid-workout swaps: everything this user can perform.
  const tier: EquipmentTier = profile.equipment_profile ?? "bodyweight";
  const allowedTiers = (
    Object.keys(EQUIPMENT_RANK) as EquipmentTier[]
  ).filter((t) => EQUIPMENT_RANK[t] <= EQUIPMENT_RANK[tier]);

  const { data: poolRows } = await supabase
    .from("exercises")
    .select(EXERCISE_COLUMNS)
    .in("equipment", allowedTiers);

  const pool = ((poolRows ?? []) as ExerciseRow[]).map(toSubstitutable);

  const unit = profile.weight_unit;
  const goal = profile.goal ?? "general";

  const exercises: WorkoutExercise[] = rows.map((r) => {
    const ex = toSubstitutable(r.exercises as unknown as ExerciseRow);
    const hist = historyByExercise.get(r.exercise_id) ?? [];
    const targetSets = r.target_sets ?? 3;

    const suggestion = suggestNextSet(
      hist,
      r.target_reps,
      targetSets,
      ex.primary[0] ?? ex.group,
      unit,
    );

    return {
      templateId: r.id,
      exercise: ex,
      targetSets,
      targetReps: r.target_reps ?? "10",
      restSeconds: restSecondsFor(goal, ex.compound),
      suggestion,
      alternatives: findSubstitutes(ex, pool, tier, 6).map((s) => ({
        exercise: s.exercise,
        reason: s.reason,
      })),
    };
  });

  return (
    <ActiveWorkout
      logId={logId}
      dayName={day.name}
      unit={unit}
      exercises={exercises}
      initialSets={(existingSets ?? []).map((s) => ({
        id: s.id,
        exerciseId: s.exercise_id,
        setNumber: s.set_number,
        weight: Number(s.weight ?? 0),
        reps: Number(s.reps ?? 0),
        isPR: s.is_pr,
      }))}
    />
  );
}
