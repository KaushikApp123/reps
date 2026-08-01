import type { Muscle, Pattern } from "./muscles";
import type { SubstitutableExercise } from "./substitutions";
import type { EquipmentTier } from "./types";

/** Columns every query needs to build a SubstitutableExercise. */
export const EXERCISE_COLUMNS =
  "id, name, muscle_group, equipment, movement_pattern, primary_muscles, secondary_muscles, is_compound, is_unilateral";

export type ExerciseRow = {
  id: string;
  name: string;
  muscle_group: string;
  equipment: string;
  movement_pattern: string | null;
  primary_muscles: string[] | null;
  secondary_muscles: string[] | null;
  is_compound: boolean | null;
  is_unilateral: boolean | null;
};

/**
 * Maps a database row onto the shape the substitution and coverage engines
 * expect. Tolerates rows seeded before migration 003 (null metadata) by
 * falling back to empty arrays, so a partially-migrated database degrades
 * instead of crashing.
 */
export function toSubstitutable(row: ExerciseRow): SubstitutableExercise {
  return {
    id: row.id,
    name: row.name,
    group: row.muscle_group,
    equipment: row.equipment as EquipmentTier,
    pattern: (row.movement_pattern ?? "conditioning") as Pattern,
    primary: (row.primary_muscles ?? []) as Muscle[],
    secondary: (row.secondary_muscles ?? []) as Muscle[],
    compound: row.is_compound ?? false,
    unilateral: row.is_unilateral ?? false,
  };
}
