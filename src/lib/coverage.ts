import type { Muscle } from "./muscles";
import { muscleLabel } from "./muscles";
import type { SubstitutableExercise } from "./substitutions";

export type CoverageEntry = {
  muscle: Muscle;
  /** Exercises where this muscle is a primary target. */
  direct: string[];
  /** Exercises where it's only worked as a secondary. */
  indirect: string[];
  status: "covered" | "indirect" | "missing";
};

export type CoverageReport = {
  entries: CoverageEntry[];
  missing: Muscle[];
  indirectOnly: Muscle[];
  /** 0–100, share of required muscles trained directly. */
  score: number;
};

/**
 * Checks a day's chosen exercises against the muscles that day is supposed
 * to train.
 *
 * The distinction that matters: a muscle worked only as a *secondary* is not
 * covered. Pressing hits the side delts a little, but it is not side delt
 * training — that's exactly the gap this is here to catch.
 */
export function analyzeCoverage(
  required: Muscle[],
  chosen: SubstitutableExercise[],
): CoverageReport {
  const entries: CoverageEntry[] = required.map((muscle) => {
    const direct = chosen.filter((e) => e.primary.includes(muscle)).map((e) => e.name);
    const indirect = chosen.filter((e) => e.secondary.includes(muscle)).map((e) => e.name);

    return {
      muscle,
      direct,
      indirect,
      status: direct.length > 0 ? "covered" : indirect.length > 0 ? "indirect" : "missing",
    };
  });

  const missing = entries.filter((e) => e.status === "missing").map((e) => e.muscle);
  const indirectOnly = entries.filter((e) => e.status === "indirect").map((e) => e.muscle);
  const covered = entries.filter((e) => e.status === "covered").length;

  return {
    entries,
    missing,
    indirectOnly,
    score: required.length === 0 ? 100 : Math.round((covered / required.length) * 100),
  };
}

/** One-line coaching summary of what a day is missing. */
export function coverageSummary(report: CoverageReport): string | null {
  const gaps = [...report.missing, ...report.indirectOnly];
  if (gaps.length === 0) return null;

  const labels = gaps.slice(0, 3).map(muscleLabel);
  const rest = gaps.length - labels.length;
  const list =
    labels.length === 1
      ? labels[0]
      : `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;

  return rest > 0
    ? `No direct work for ${list}, plus ${rest} more.`
    : `No direct work for ${list}.`;
}

/**
 * Flags muscles that are getting a lot of direct work relative to the rest of
 * the day — usually a sign the user swiped right on five variations of the
 * same thing.
 */
export function overloadedMuscles(
  chosen: SubstitutableExercise[],
  threshold = 3,
): { muscle: Muscle; count: number }[] {
  const counts = new Map<Muscle, number>();
  for (const e of chosen) {
    for (const m of e.primary) counts.set(m, (counts.get(m) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, n]) => n >= threshold)
    .map(([muscle, count]) => ({ muscle, count }))
    .sort((a, b) => b.count - a.count);
}
