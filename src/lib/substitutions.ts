import type { Muscle, Pattern } from "./muscles";
import { EQUIPMENT_RANK, type EquipmentTier } from "./types";

export type SubstitutableExercise = {
  id: string;
  name: string;
  group: string;
  equipment: EquipmentTier;
  pattern: Pattern;
  primary: Muscle[];
  secondary: Muscle[];
  compound: boolean;
  unilateral: boolean;
};

/**
 * Patterns that load the target muscles through comparable joint actions.
 * A close pattern still makes a good substitute; an unrelated one does not,
 * even when the muscle lists happen to overlap.
 */
const RELATED_PATTERNS: Partial<Record<Pattern, Pattern[]>> = {
  horizontal_push: ["vertical_push"],
  vertical_push: ["horizontal_push"],
  horizontal_pull: ["vertical_pull"],
  vertical_pull: ["horizontal_pull"],
  squat: ["lunge", "knee_extension"],
  lunge: ["squat"],
  knee_extension: ["squat"],
  hinge: ["hip_thrust", "knee_flexion"],
  hip_thrust: ["hinge"],
  knee_flexion: ["hinge"],
  elbow_flexion: [],
  elbow_extension: [],
  shoulder_abduction: [],
  shoulder_horizontal_abduction: ["horizontal_pull"],
};

export type Substitute = {
  exercise: SubstitutableExercise;
  score: number;
  /** Why this was suggested, for display. */
  reason: string;
};

/**
 * Ranks replacements for an exercise — the "someone's on the machine" case.
 *
 * Scoring, highest weight first:
 *  - overlap of PRIMARY muscles (the thing you actually came to train)
 *  - same movement pattern, then a related one
 *  - overlap of secondary muscles
 *  - matching compound/isolation character
 * Candidates the user can't perform with their equipment are excluded, as is
 * the exercise itself.
 */
export function findSubstitutes(
  target: SubstitutableExercise,
  candidates: SubstitutableExercise[],
  userTier: EquipmentTier,
  limit = 6,
): Substitute[] {
  const targetPrimary = new Set(target.primary);
  const targetSecondary = new Set(target.secondary);
  const related = new Set(RELATED_PATTERNS[target.pattern] ?? []);

  const scored: Substitute[] = [];

  for (const c of candidates) {
    if (c.id === target.id) continue;
    if (EQUIPMENT_RANK[c.equipment] > EQUIPMENT_RANK[userTier]) continue;

    const primaryHits = c.primary.filter((m) => targetPrimary.has(m));
    // A substitute must train at least one of the same primary muscles,
    // otherwise it isn't a substitute — it's a different exercise.
    if (primaryHits.length === 0) continue;

    const primaryCoverage = primaryHits.length / targetPrimary.size;
    const secondaryHits = c.secondary.filter((m) => targetSecondary.has(m)).length;

    let score = primaryCoverage * 60;

    let patternNote = "";
    if (c.pattern === target.pattern) {
      score += 25;
      patternNote = "same movement pattern";
    } else if (related.has(c.pattern)) {
      score += 12;
      patternNote = "similar movement";
    } else {
      patternNote = "different angle";
    }

    score += Math.min(secondaryHits, 3) * 3;
    if (c.compound === target.compound) score += 5;
    // Prefer swapping a machine for free weights rather than another machine
    // that may also be busy.
    if (EQUIPMENT_RANK[c.equipment] < EQUIPMENT_RANK[target.equipment]) score += 4;

    const hitLabels = primaryHits.join(", ");
    scored.push({
      exercise: c,
      score,
      reason:
        primaryCoverage === 1
          ? `Same target (${hitLabels}) · ${patternNote}`
          : `Hits ${hitLabels} · ${patternNote}`,
    });
  }

  return scored
    .sort((a, b) => b.score - a.score || a.exercise.name.localeCompare(b.exercise.name))
    .slice(0, limit);
}

/**
 * Best exercise to add for a muscle that a day is missing. Prefers exercises
 * where the muscle is a primary target and, for isolation gaps like side
 * delts, avoids recommending yet another compound.
 */
export function bestForMuscle(
  muscle: Muscle,
  candidates: SubstitutableExercise[],
  userTier: EquipmentTier,
  exclude: Set<string> = new Set(),
  limit = 3,
): SubstitutableExercise[] {
  return candidates
    .filter(
      (c) =>
        !exclude.has(c.id) &&
        EQUIPMENT_RANK[c.equipment] <= EQUIPMENT_RANK[userTier] &&
        c.primary.includes(muscle),
    )
    .sort((a, b) => {
      // Fewer primary targets = more focused on the muscle we're missing.
      const focus = a.primary.length - b.primary.length;
      if (focus !== 0) return focus;
      return a.name.localeCompare(b.name);
    })
    .slice(0, limit);
}
