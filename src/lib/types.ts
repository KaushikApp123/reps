export type EquipmentTier = "bodyweight" | "home" | "full_gym";
export type Goal = "strength" | "hypertrophy" | "general";

/** Ordering used for "user's tier covers this exercise" checks. */
export const EQUIPMENT_RANK: Record<EquipmentTier, number> = {
  bodyweight: 0,
  home: 1,
  full_gym: 2,
};

export const EQUIPMENT_LABEL: Record<EquipmentTier, string> = {
  bodyweight: "Bodyweight only",
  home: "Home gym",
  full_gym: "Full gym",
};

export const GOAL_LABEL: Record<Goal, string> = {
  strength: "Strength",
  hypertrophy: "Muscle growth",
  general: "General fitness",
};

/**
 * An exercise is available to a user when its required tier is at or below
 * the user's tier — bodyweight exercises work everywhere, full_gym only
 * at a full gym.
 */
export function isAvailable(
  exerciseTier: EquipmentTier,
  userTier: EquipmentTier,
): boolean {
  return EQUIPMENT_RANK[exerciseTier] <= EQUIPMENT_RANK[userTier];
}

export type Profile = {
  id: string;
  display_name: string | null;
  goal: Goal | null;
  equipment_profile: EquipmentTier | null;
  days_per_week: number | null;
  weight_unit: string;
  onboarding_complete: boolean;
};

export type Exercise = {
  id: string;
  name: string;
  muscle_group: string;
  equipment: EquipmentTier;
};

export type SplitDay = {
  id: string;
  split_id: string;
  name: string;
  order_index: number;
  /** Coarse groups, used to filter the swipe deck. */
  muscle_groups: string[];
  /** Muscle heads this day must train directly — the coverage checklist. */
  required_muscles: string[];
  optional_muscles: string[];
};

export type TemplateExercise = {
  id: string;
  split_day_id: string;
  exercise_id: string;
  order_index: number;
  target_sets: number | null;
  target_reps: string | null;
};

export type LoggedSet = {
  id: string;
  workout_log_id: string;
  exercise_id: string;
  set_number: number;
  reps: number | null;
  weight: number | null;
  is_pr: boolean;
  created_at: string;
};
