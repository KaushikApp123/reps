import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireOnboarded, getActiveSplit } from "@/lib/data";
import { EXERCISE_COLUMNS, toSubstitutable, type ExerciseRow } from "@/lib/exercises";
import { analyzeCoverage, overloadedMuscles } from "@/lib/coverage";
import { bestForMuscle } from "@/lib/substitutions";
import { isTrainable } from "@/lib/splits";
import { EQUIPMENT_RANK, type EquipmentTier } from "@/lib/types";
import type { Muscle } from "@/lib/muscles";
import SwipeBuilder from "./swipe-builder";

export default async function BuildPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>;
}) {
  const { userId, profile } = await requireOnboarded();
  const active = await getActiveSplit(userId);
  if (!active || active.days.length === 0) redirect("/onboarding");

  const params = await searchParams;
  const dayId = params.day ?? active.days[0].id;
  const day = active.days.find((d) => d.id === dayId) ?? active.days[0];

  const supabase = await createClient();
  const tier: EquipmentTier = profile.equipment_profile ?? "bodyweight";
  const allowedTiers = (
    Object.keys(EQUIPMENT_RANK) as EquipmentTier[]
  ).filter((t) => EQUIPMENT_RANK[t] <= EQUIPMENT_RANK[tier]);

  // Days created before migration 003 may have no group list; fall back to
  // the whole allowed library rather than showing an empty deck.
  const dayGroups = day.muscle_groups ?? [];
  const deckQuery = supabase
    .from("exercises")
    .select(EXERCISE_COLUMNS)
    .in("equipment", allowedTiers);

  const { data: exerciseRows } = await (dayGroups.length
    ? deckQuery.in("muscle_group", dayGroups)
    : deckQuery);

  const deck = ((exerciseRows ?? []) as ExerciseRow[]).map(toSubstitutable);

  const { data: pickedRows } = await supabase
    .from("template_exercises")
    .select(`id, exercise_id, order_index, target_sets, target_reps, exercises(${EXERCISE_COLUMNS})`)
    .eq("split_day_id", day.id)
    .order("order_index");

  const picked = (pickedRows ?? []).map((p) => {
    const ex = toSubstitutable(p.exercises as unknown as ExerciseRow);
    return {
      id: p.id,
      exercise: ex,
      targetSets: p.target_sets,
      targetReps: p.target_reps,
    };
  });

  // Only grade against muscles this user's equipment can actually reach.
  const required = ((day.required_muscles ?? []) as Muscle[]).filter((m) =>
    isTrainable(m, tier),
  );
  const unreachable = ((day.required_muscles ?? []) as Muscle[]).filter(
    (m) => !isTrainable(m, tier),
  );

  const chosen = picked.map((p) => p.exercise);
  const coverage = analyzeCoverage(required, chosen);
  const overloaded = overloadedMuscles(chosen);

  // For each gap, suggest concrete exercises that would close it.
  const alreadyPicked = new Set(chosen.map((e) => e.id));
  const suggestions = [...coverage.missing, ...coverage.indirectOnly].map(
    (muscle) => ({
      muscle,
      options: bestForMuscle(muscle, deck, tier, alreadyPicked, 3).map((e) => ({
        id: e.id,
        name: e.name,
        equipment: e.equipment,
      })),
    }),
  );

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-5 py-6">
      <SwipeBuilder
        splitName={active.split.name}
        days={active.days.map((d) => ({ id: d.id, name: d.name }))}
        currentDay={{ id: day.id, name: day.name }}
        exercises={deck}
        picked={picked}
        coverage={coverage}
        suggestions={suggestions}
        overloaded={overloaded}
        unreachable={unreachable}
      />
    </main>
  );
}
