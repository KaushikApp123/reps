import type { Muscle } from "./muscles";
import { MUSCLE_GROUP } from "./muscles";
import { EXERCISE_LIBRARY } from "./exercise-library";
import { EQUIPMENT_RANK, type EquipmentTier, type Goal } from "./types";

export type SplitDayTemplate = {
  name: string;
  /**
   * Muscle heads this day is responsible for training *directly*. This is the
   * checklist the coverage report grades against, which is why it's specified
   * at head level — "Shoulders" would let a day pass with pressing alone and
   * no side delt work.
   */
  required: Muscle[];
  /** Nice to have, not graded. */
  optional?: Muscle[];
};

export type SplitTemplate = {
  key: string;
  name: string;
  blurb: string;
  days: SplitDayTemplate[];
};

// Shared day definitions — the required lists encode the evidence summarised
// in src/lib/muscles.ts (side delts and rear delts need isolation; the
// triceps long head needs an overhead angle; the rectus femoris needs knee
// extension; hamstrings need both a hinge and a knee-flexion movement).

const PUSH: Muscle[] = [
  "Upper Chest",
  "Mid Chest",
  "Front Delt",
  "Side Delt",
  "Triceps Long Head",
  "Triceps Lateral Head",
];

const PULL: Muscle[] = [
  "Lats",
  "Rhomboids",
  "Mid Traps",
  "Rear Delt",
  "Biceps Long Head",
  "Biceps Short Head",
];

const LEGS: Muscle[] = [
  "Quads (Vastii)",
  "Rectus Femoris",
  "Hamstrings (Hip)",
  "Hamstrings (Knee)",
  "Glute Max",
  "Gastrocnemius",
  "Soleus",
];

const UPPER: Muscle[] = [
  "Upper Chest",
  "Mid Chest",
  "Lats",
  "Rhomboids",
  "Front Delt",
  "Side Delt",
  "Rear Delt",
  "Biceps Long Head",
  "Biceps Short Head",
  "Triceps Long Head",
  "Triceps Lateral Head",
];

const FULL_BODY_A: Muscle[] = [
  "Mid Chest",
  "Lats",
  "Quads (Vastii)",
  "Side Delt",
  "Triceps Long Head",
  "Rectus Abdominis",
];

const FULL_BODY_B: Muscle[] = [
  "Upper Chest",
  "Rhomboids",
  "Hamstrings (Hip)",
  "Hamstrings (Knee)",
  "Rear Delt",
  "Biceps Long Head",
];

const FULL_BODY_C: Muscle[] = [
  "Front Delt",
  "Lats",
  "Glute Max",
  "Rectus Femoris",
  "Triceps Lateral Head",
  "Gastrocnemius",
];

const SPLITS: Record<string, SplitTemplate> = {
  full_body_2: {
    key: "full_body_2",
    name: "Full Body",
    blurb: "Two full-body sessions a week — hits everything, twice.",
    days: [
      { name: "Full Body A", required: FULL_BODY_A, optional: ["Glute Max", "Rear Delt"] },
      { name: "Full Body B", required: FULL_BODY_B, optional: ["Quads (Vastii)", "Obliques"] },
    ],
  },
  full_body_3: {
    key: "full_body_3",
    name: "Full Body",
    blurb: "Three full-body sessions — the best return on three days a week.",
    days: [
      { name: "Full Body A", required: FULL_BODY_A },
      { name: "Full Body B", required: FULL_BODY_B },
      { name: "Full Body C", required: FULL_BODY_C },
    ],
  },
  ppl_3: {
    key: "ppl_3",
    name: "Push / Pull / Legs",
    blurb: "Classic PPL — each session focuses on one movement pattern.",
    days: [
      { name: "Push", required: PUSH, optional: ["Lower Chest", "Triceps Medial Head"] },
      { name: "Pull", required: PULL, optional: ["Upper Traps", "Brachialis", "Spinal Erectors"] },
      { name: "Legs", required: LEGS, optional: ["Glute Medius", "Rectus Abdominis", "Adductors"] },
    ],
  },
  upper_lower_4: {
    key: "upper_lower_4",
    name: "Upper / Lower",
    blurb: "Four days alternating upper and lower — great recovery balance.",
    days: [
      { name: "Upper A", required: UPPER, optional: ["Upper Traps", "Brachialis"] },
      { name: "Lower A", required: LEGS, optional: ["Glute Medius", "Rectus Abdominis"] },
      { name: "Upper B", required: UPPER, optional: ["Lower Chest", "Teres Major", "Rotator Cuff"] },
      { name: "Lower B", required: LEGS, optional: ["Adductors", "Obliques", "Spinal Erectors"] },
    ],
  },
  ppl_upper_lower_5: {
    key: "ppl_upper_lower_5",
    name: "PPL + Upper/Lower",
    blurb: "Five days: a full PPL rotation plus an extra upper and lower day.",
    days: [
      { name: "Push", required: PUSH, optional: ["Lower Chest"] },
      { name: "Pull", required: PULL, optional: ["Upper Traps", "Brachialis"] },
      { name: "Legs", required: LEGS, optional: ["Glute Medius"] },
      { name: "Upper", required: UPPER, optional: ["Rotator Cuff"] },
      { name: "Lower", required: LEGS, optional: ["Adductors", "Rectus Abdominis"] },
    ],
  },
  arnold_6: {
    key: "arnold_6",
    name: "Arnold Split",
    blurb: "Six days: chest/back, shoulders/arms, legs — run twice a week.",
    days: [
      {
        name: "Chest & Back A",
        required: ["Upper Chest", "Mid Chest", "Lats", "Rhomboids", "Mid Traps"],
        optional: ["Lower Chest", "Teres Major"],
      },
      {
        name: "Shoulders & Arms A",
        required: [
          "Front Delt", "Side Delt", "Rear Delt",
          "Biceps Long Head", "Biceps Short Head",
          "Triceps Long Head", "Triceps Lateral Head",
        ],
        optional: ["Brachialis", "Upper Traps"],
      },
      { name: "Legs A", required: LEGS, optional: ["Glute Medius", "Rectus Abdominis"] },
      {
        name: "Chest & Back B",
        required: ["Upper Chest", "Mid Chest", "Lats", "Rhomboids", "Upper Traps"],
        optional: ["Spinal Erectors"],
      },
      {
        name: "Shoulders & Arms B",
        required: [
          "Front Delt", "Side Delt", "Rear Delt",
          "Biceps Long Head", "Biceps Short Head",
          "Triceps Long Head", "Triceps Lateral Head",
        ],
        optional: ["Brachioradialis", "Forearm Flexors"],
      },
      { name: "Legs B", required: LEGS, optional: ["Adductors", "Obliques"] },
    ],
  },
  ppl_6: {
    key: "ppl_6",
    name: "Push / Pull / Legs ×2",
    blurb: "Six days running PPL twice — highest volume, needs good recovery.",
    days: [
      { name: "Push A", required: PUSH, optional: ["Lower Chest"] },
      { name: "Pull A", required: PULL, optional: ["Upper Traps"] },
      { name: "Legs A", required: LEGS, optional: ["Glute Medius"] },
      { name: "Push B", required: PUSH, optional: ["Triceps Medial Head"] },
      { name: "Pull B", required: PULL, optional: ["Brachialis", "Spinal Erectors"] },
      { name: "Legs B", required: LEGS, optional: ["Adductors", "Rectus Abdominis"] },
    ],
  },
};

/**
 * Rule-based split recommendation. Returns the best fit first, followed by
 * any reasonable alternatives for the same number of days.
 */
export function recommendSplits(daysPerWeek: number, goal: Goal): SplitTemplate[] {
  const d = Math.min(6, Math.max(2, daysPerWeek));

  switch (d) {
    case 2:
      return [SPLITS.full_body_2];
    case 3:
      // Strength benefits most from frequent full-body compound practice.
      return goal === "strength"
        ? [SPLITS.full_body_3, SPLITS.ppl_3]
        : [SPLITS.ppl_3, SPLITS.full_body_3];
    case 4:
      return [SPLITS.upper_lower_4];
    case 5:
      return [SPLITS.ppl_upper_lower_5, SPLITS.upper_lower_4];
    case 6:
      return goal === "hypertrophy"
        ? [SPLITS.arnold_6, SPLITS.ppl_6]
        : [SPLITS.ppl_6, SPLITS.arnold_6];
    default:
      return [SPLITS.full_body_3];
  }
}

export function getSplitTemplate(key: string): SplitTemplate | undefined {
  return SPLITS[key];
}

/** Coarse groups a day touches — used to filter the swipe deck. */
export function groupsForDay(day: SplitDayTemplate): string[] {
  const all = [...day.required, ...(day.optional ?? [])];
  return [...new Set(all.map((m) => MUSCLE_GROUP[m]))];
}

/**
 * Muscles that at least one exercise trains *directly* at a given equipment
 * tier. Derived from the library so it can never fall out of sync with it.
 */
const TRAINABLE_BY_TIER: Record<EquipmentTier, Set<Muscle>> = (() => {
  const tiers: EquipmentTier[] = ["bodyweight", "home", "full_gym"];
  const out = {} as Record<EquipmentTier, Set<Muscle>>;
  for (const tier of tiers) {
    const set = new Set<Muscle>();
    for (const e of EXERCISE_LIBRARY) {
      if (EQUIPMENT_RANK[e.equipment] <= EQUIPMENT_RANK[tier]) {
        for (const m of e.primary) set.add(m);
      }
    }
    out[tier] = set;
  }
  return out;
})();

export function isTrainable(muscle: Muscle, tier: EquipmentTier): boolean {
  return TRAINABLE_BY_TIER[tier].has(muscle);
}

/**
 * The required-muscle checklist for a day, narrowed to what the user can
 * actually train. Without this a bodyweight-only user would be permanently
 * told their Push day is "missing side delt work" with no exercise in
 * existence that would fix it.
 */
export function requiredFor(
  day: SplitDayTemplate,
  tier: EquipmentTier,
): Muscle[] {
  return day.required.filter((m) => isTrainable(m, tier));
}

/** Required muscles this user's equipment can't reach — shown as an honest
 *  caveat rather than a fixable gap. */
export function unreachableFor(
  day: SplitDayTemplate,
  tier: EquipmentTier,
): Muscle[] {
  return day.required.filter((m) => !isTrainable(m, tier));
}

/** Default sets/reps seeded onto a newly swiped-in exercise. */
export function defaultsForGoal(goal: Goal): { sets: number; reps: string } {
  switch (goal) {
    case "strength":
      return { sets: 4, reps: "5" };
    case "hypertrophy":
      return { sets: 3, reps: "8-12" };
    case "general":
    default:
      return { sets: 3, reps: "10" };
  }
}

/**
 * Rest between sets, in seconds. Heavy compounds need longer than isolation
 * work regardless of goal, so callers pass whether the lift is a compound.
 */
export function restSecondsFor(goal: Goal, isCompound = true): number {
  const base = goal === "strength" ? 180 : goal === "hypertrophy" ? 90 : 60;
  return isCompound ? base : Math.max(45, Math.round(base * 0.66));
}
