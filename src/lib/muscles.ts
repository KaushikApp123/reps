/**
 * Muscle taxonomy at the level of individual heads/regions, because that's
 * the level at which exercise selection actually matters.
 *
 * The evidence this is built on (see docs/EXERCISE_SCIENCE.md for detail):
 *  - Delts: pressing drives the front head; the side head needs abduction
 *    (raises) and the rear head needs horizontal abduction. Pressing alone
 *    leaves side/rear delts badly under-stimulated.
 *  - Triceps: the long head crosses the shoulder, so it's only loaded in a
 *    stretched position — overhead extensions produce markedly more long-head
 *    growth than pushdowns, which favour the lateral head.
 *  - Biceps: the long head is lengthened by shoulder extension (incline
 *    curls); the short head by shoulder flexion (preacher curls). Neutral and
 *    pronated grips shift work to brachialis/brachioradialis.
 *  - Chest: upper (clavicular) fibres peak around a 30° incline; flat
 *    pressing favours the sternal fibres; decline/dips the lower.
 *  - Back: vertical pulls bias lats and lower traps; horizontal pulls bias
 *    mid traps and rhomboids. Both planes are needed.
 *  - Quads: squats grow the vastii but barely the rectus femoris, which
 *    crosses the hip — leg extensions are needed to load it.
 *  - Hamstrings: hip hinges bias the long head of biceps femoris and
 *    semimembranosus; knee flexion biases the short head and semitendinosus.
 *  - Glutes: hip thrusts and squats grow glute max similarly; neither grows
 *    glute medius, which needs abduction work.
 */

export const MUSCLES = [
  // Chest
  "Upper Chest",
  "Mid Chest",
  "Lower Chest",
  // Back
  "Lats",
  "Rhomboids",
  "Mid Traps",
  "Lower Traps",
  "Upper Traps",
  "Teres Major",
  "Spinal Erectors",
  // Shoulders
  "Front Delt",
  "Side Delt",
  "Rear Delt",
  "Rotator Cuff",
  // Arms
  "Biceps Long Head",
  "Biceps Short Head",
  "Brachialis",
  "Brachioradialis",
  "Triceps Long Head",
  "Triceps Lateral Head",
  "Triceps Medial Head",
  "Forearm Flexors",
  // Legs
  "Quads (Vastii)",
  "Rectus Femoris",
  "Hamstrings (Hip)",
  "Hamstrings (Knee)",
  "Glute Max",
  "Glute Medius",
  "Adductors",
  "Gastrocnemius",
  "Soleus",
  // Core
  "Rectus Abdominis",
  "Obliques",
  "Deep Core",
] as const;

export type Muscle = (typeof MUSCLES)[number];

/**
 * Movement patterns. Two exercises sharing a pattern load the target through
 * the same joint actions, which is what makes them interchangeable.
 */
export const PATTERNS = [
  "horizontal_push",
  "vertical_push",
  "horizontal_pull",
  "vertical_pull",
  "squat",
  "hinge",
  "lunge",
  "knee_flexion",
  "knee_extension",
  "hip_thrust",
  "hip_abduction",
  "elbow_flexion",
  "elbow_extension",
  "shoulder_abduction",
  "shoulder_horizontal_abduction",
  "shrug",
  "calf_raise",
  "core_flexion",
  "core_anti_extension",
  "core_rotation",
  "carry",
  "conditioning",
] as const;

export type Pattern = (typeof PATTERNS)[number];

/** Coarse group each muscle rolls up to — used for filtering and display. */
export const MUSCLE_GROUP: Record<Muscle, string> = {
  "Upper Chest": "Chest",
  "Mid Chest": "Chest",
  "Lower Chest": "Chest",
  Lats: "Back",
  Rhomboids: "Back",
  "Mid Traps": "Back",
  "Lower Traps": "Back",
  "Upper Traps": "Traps",
  "Teres Major": "Back",
  "Spinal Erectors": "Back",
  "Front Delt": "Shoulders",
  "Side Delt": "Shoulders",
  "Rear Delt": "Shoulders",
  "Rotator Cuff": "Shoulders",
  "Biceps Long Head": "Biceps",
  "Biceps Short Head": "Biceps",
  Brachialis: "Biceps",
  Brachioradialis: "Forearms",
  "Triceps Long Head": "Triceps",
  "Triceps Lateral Head": "Triceps",
  "Triceps Medial Head": "Triceps",
  "Forearm Flexors": "Forearms",
  "Quads (Vastii)": "Quads",
  "Rectus Femoris": "Quads",
  "Hamstrings (Hip)": "Hamstrings",
  "Hamstrings (Knee)": "Hamstrings",
  "Glute Max": "Glutes",
  "Glute Medius": "Glutes",
  Adductors: "Legs",
  Gastrocnemius: "Calves",
  Soleus: "Calves",
  "Rectus Abdominis": "Core",
  Obliques: "Core",
  "Deep Core": "Core",
};

/** Short, human-friendly names for coaching copy. */
export const MUSCLE_LABEL: Partial<Record<Muscle, string>> = {
  "Quads (Vastii)": "quads",
  "Rectus Femoris": "rectus femoris",
  "Hamstrings (Hip)": "hamstrings (hip hinge)",
  "Hamstrings (Knee)": "hamstrings (knee curl)",
  "Triceps Long Head": "triceps long head",
  "Triceps Lateral Head": "triceps lateral head",
  "Biceps Long Head": "biceps long head",
  "Biceps Short Head": "biceps short head",
  "Front Delt": "front delts",
  "Side Delt": "side delts",
  "Rear Delt": "rear delts",
  "Glute Max": "glutes",
  "Glute Medius": "glute medius",
};

export function muscleLabel(m: Muscle): string {
  return MUSCLE_LABEL[m] ?? m.toLowerCase();
}

export function musclesInGroup(group: string): Muscle[] {
  return MUSCLES.filter((m) => MUSCLE_GROUP[m] === group);
}

/** All coarse groups, in a sensible display order. */
export const GROUP_ORDER = [
  "Chest",
  "Back",
  "Shoulders",
  "Traps",
  "Biceps",
  "Triceps",
  "Forearms",
  "Quads",
  "Hamstrings",
  "Glutes",
  "Calves",
  "Legs",
  "Core",
  "Full Body",
] as const;
