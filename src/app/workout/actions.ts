"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOnboarded } from "@/lib/data";
import { detectPR, type HistorySet } from "@/lib/overload";

/** Confirms the workout log belongs to the signed-in user. */
async function assertOwnsLog(workoutLogId: string, userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("workout_logs")
    .select("id, user_id, completed_at")
    .eq("id", workoutLogId)
    .single();

  if (!data || data.user_id !== userId) throw new Error("Workout not found");
  return data;
}

export type LogSetResult = {
  ok: boolean;
  isPR: boolean;
  prMessage: string | null;
};

export async function logSet(input: {
  workoutLogId: string;
  exerciseId: string;
  setNumber: number;
  weight: number;
  reps: number;
}): Promise<LogSetResult> {
  const { userId } = await requireOnboarded();
  const log = await assertOwnsLog(input.workoutLogId, userId);
  if (log.completed_at) throw new Error("Workout already finished");

  const supabase = await createClient();

  // All-time history for this exercise, excluding the current session so a
  // set can't set a PR against itself.
  const { data: history } = await supabase
    .from("logged_sets")
    .select("weight, reps, workout_logs!inner(user_id, performed_at)")
    .eq("exercise_id", input.exerciseId)
    .eq("workout_logs.user_id", userId)
    .neq("workout_log_id", input.workoutLogId);

  const past: HistorySet[] = (history ?? []).map((h) => ({
    weight: Number(h.weight ?? 0),
    reps: Number(h.reps ?? 0),
    performedAt: (h.workout_logs as unknown as { performed_at: string })
      .performed_at,
  }));

  const pr = detectPR(past, { weight: input.weight, reps: input.reps });

  const { error } = await supabase.from("logged_sets").insert({
    workout_log_id: input.workoutLogId,
    exercise_id: input.exerciseId,
    set_number: input.setNumber,
    weight: input.weight,
    reps: input.reps,
    is_pr: pr.isPR,
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/workout/${input.workoutLogId}`);
  return { ok: true, isPR: pr.isPR, prMessage: pr.message };
}

export async function deleteSet(setId: string, workoutLogId: string) {
  const { userId } = await requireOnboarded();
  await assertOwnsLog(workoutLogId, userId);

  const supabase = await createClient();
  const { error } = await supabase
    .from("logged_sets")
    .delete()
    .eq("id", setId)
    .eq("workout_log_id", workoutLogId);

  if (error) throw new Error(error.message);
  revalidatePath(`/workout/${workoutLogId}`);
}

export async function finishWorkout(workoutLogId: string, notes?: string) {
  const { userId } = await requireOnboarded();
  await assertOwnsLog(workoutLogId, userId);

  const supabase = await createClient();
  const { error } = await supabase
    .from("workout_logs")
    .update({ completed_at: new Date().toISOString(), notes: notes || null })
    .eq("id", workoutLogId);

  if (error) throw new Error(error.message);

  revalidatePath("/", "layout");
  redirect(`/workout/${workoutLogId}/summary`);
}

export async function cancelWorkout(workoutLogId: string) {
  const { userId } = await requireOnboarded();
  await assertOwnsLog(workoutLogId, userId);

  const supabase = await createClient();
  // Sets cascade-delete with the log.
  const { error } = await supabase
    .from("workout_logs")
    .delete()
    .eq("id", workoutLogId);

  if (error) throw new Error(error.message);

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
