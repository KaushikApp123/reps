"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOnboarded } from "@/lib/data";
import { defaultsForGoal } from "@/lib/splits";

/** Verifies the split day belongs to the signed-in user. */
async function assertOwnsDay(splitDayId: string, userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("split_days")
    .select("id, splits!inner(user_id)")
    .eq("id", splitDayId)
    .single();

  const owner = (data as { splits?: { user_id: string } } | null)?.splits?.user_id;
  if (!data || owner !== userId) throw new Error("Not found");
}

export async function addExerciseToDay(splitDayId: string, exerciseId: string) {
  const { userId, profile } = await requireOnboarded();
  await assertOwnsDay(splitDayId, userId);

  const supabase = await createClient();
  const { count } = await supabase
    .from("template_exercises")
    .select("id", { count: "exact", head: true })
    .eq("split_day_id", splitDayId);

  const { sets, reps } = defaultsForGoal(profile.goal ?? "general");

  const { error } = await supabase.from("template_exercises").insert({
    split_day_id: splitDayId,
    exercise_id: exerciseId,
    order_index: count ?? 0,
    target_sets: sets,
    target_reps: reps,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/build");
}

export async function removeTemplateExercise(templateExerciseId: string) {
  const { userId } = await requireOnboarded();
  const supabase = await createClient();

  // RLS already scopes this to the owner; the check keeps the error explicit.
  const { data } = await supabase
    .from("template_exercises")
    .select("id, split_day_id")
    .eq("id", templateExerciseId)
    .single();

  if (!data) throw new Error("Not found");
  await assertOwnsDay(data.split_day_id, userId);

  const { error } = await supabase
    .from("template_exercises")
    .delete()
    .eq("id", templateExerciseId);

  if (error) throw new Error(error.message);
  revalidatePath("/build");
}

export async function updateTemplateExercise(
  templateExerciseId: string,
  targetSets: number,
  targetReps: string,
) {
  const { userId } = await requireOnboarded();
  const supabase = await createClient();

  const { data } = await supabase
    .from("template_exercises")
    .select("id, split_day_id")
    .eq("id", templateExerciseId)
    .single();

  if (!data) throw new Error("Not found");
  await assertOwnsDay(data.split_day_id, userId);

  const { error } = await supabase
    .from("template_exercises")
    .update({ target_sets: targetSets, target_reps: targetReps })
    .eq("id", templateExerciseId);

  if (error) throw new Error(error.message);
  revalidatePath("/build");
}
