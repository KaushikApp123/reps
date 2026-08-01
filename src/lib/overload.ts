import { MUSCLE_GROUP, type Muscle } from "./muscles";

export type HistorySet = {
  weight: number;
  reps: number;
  /** ISO timestamp of the workout the set belongs to. */
  performedAt: string;
};

/** Lower-body lifts add weight in bigger jumps than upper-body ones. */
const LOWER_BODY_GROUPS = new Set(["Quads", "Hamstrings", "Glutes", "Calves", "Legs"]);

/**
 * Accepts either a muscle head ("Quads (Vastii)") or a coarse group
 * ("Quads"), since callers have one or the other depending on context.
 */
export function incrementFor(muscle: string, unit: string): number {
  const group = MUSCLE_GROUP[muscle as Muscle] ?? muscle;
  const lower = LOWER_BODY_GROUPS.has(group);
  if (unit === "kg") return lower ? 5 : 2.5;
  return lower ? 10 : 5;
}

/**
 * Parses a target rep string into its range. Accepts "5", "8-12", "8–12",
 * and falls back to a sane default for anything unparseable (e.g. "AMRAP").
 */
export function parseRepRange(target: string | null): { low: number; high: number } {
  if (!target) return { low: 8, high: 12 };
  const nums = target.match(/\d+/g);
  if (!nums || nums.length === 0) return { low: 8, high: 12 };
  const low = parseInt(nums[0], 10);
  const high = nums.length > 1 ? parseInt(nums[1], 10) : low;
  return { low, high };
}

/** Groups a flat set history into sessions, newest session first. */
export function groupSessions(history: HistorySet[]): HistorySet[][] {
  const byDay = new Map<string, HistorySet[]>();
  for (const s of history) {
    const day = s.performedAt.slice(0, 10);
    const bucket = byDay.get(day);
    if (bucket) bucket.push(s);
    else byDay.set(day, [s]);
  }
  return [...byDay.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([, sets]) => sets);
}

export type Suggestion = {
  weight: number;
  reps: number;
  /** Human-readable rationale, e.g. "Last: 135×8 → try 140×8". */
  note: string;
  isFirstTime: boolean;
};

/**
 * Progressive overload: if the last session hit the top of the rep range on
 * every set, add weight and reset to the bottom of the range. Otherwise keep
 * the weight and chase one more rep.
 */
export function suggestNextSet(
  history: HistorySet[],
  targetReps: string | null,
  targetSets: number,
  muscleGroup: string,
  unit: string,
): Suggestion {
  const { low, high } = parseRepRange(targetReps);
  const sessions = groupSessions(history);

  if (sessions.length === 0) {
    return {
      weight: 0,
      reps: low,
      note: "First time — find a weight you can control for all sets.",
      isFirstTime: true,
    };
  }

  const last = sessions[0];
  const topWeight = Math.max(...last.map((s) => s.weight));
  const setsAtTop = last.filter((s) => s.weight === topWeight);
  const minRepsAtTop = Math.min(...setsAtTop.map((s) => s.reps));
  const bestReps = Math.max(...setsAtTop.map((s) => s.reps));

  const clearedRange = minRepsAtTop >= high && setsAtTop.length >= targetSets;

  if (clearedRange) {
    const step = incrementFor(muscleGroup, unit);
    const next = topWeight + step;
    return {
      weight: next,
      reps: low,
      note: `Last: ${fmt(topWeight)}×${bestReps} → try ${fmt(next)}×${low}`,
      isFirstTime: false,
    };
  }

  const targetRep = Math.min(high, minRepsAtTop + 1);
  return {
    weight: topWeight,
    reps: targetRep,
    note: `Last: ${fmt(topWeight)}×${bestReps} → try ${fmt(topWeight)}×${targetRep}`,
    isFirstTime: false,
  };
}

export type PRResult = {
  isPR: boolean;
  kind: "weight" | "volume" | null;
  message: string | null;
};

/**
 * A set is a PR if it beats the all-time best weight, or beats the all-time
 * best single-set volume (weight × reps). Weight PRs outrank volume PRs.
 */
export function detectPR(
  history: HistorySet[],
  candidate: { weight: number; reps: number },
): PRResult {
  if (candidate.weight <= 0 || candidate.reps <= 0) {
    return { isPR: false, kind: null, message: null };
  }

  if (history.length === 0) {
    return { isPR: true, kind: "weight", message: "First time logged 💪" };
  }

  const bestWeight = Math.max(...history.map((s) => s.weight));
  const bestVolume = Math.max(...history.map((s) => s.weight * s.reps));
  const volume = candidate.weight * candidate.reps;

  if (candidate.weight > bestWeight) {
    return {
      isPR: true,
      kind: "weight",
      message: `New weight PR — ${fmt(candidate.weight)}!`,
    };
  }
  if (volume > bestVolume) {
    return {
      isPR: true,
      kind: "volume",
      message: `New volume PR — ${fmt(candidate.weight)}×${candidate.reps}!`,
    };
  }
  return { isPR: false, kind: null, message: null };
}

/**
 * Flags a stall: the top-set weight hasn't increased across the last
 * `window` sessions (and there are at least that many to judge by).
 * Surfaced only in the end-of-workout summary, never mid-set.
 */
export function detectPlateau(history: HistorySet[], window = 3): boolean {
  const sessions = groupSessions(history).slice(0, window);
  if (sessions.length < window) return false;

  // sessions[0] is the newest. A plateau means the most recent top set is no
  // heavier than the oldest one in the window — no progress over that stretch.
  const tops = sessions.map((sets) => Math.max(...sets.map((s) => s.weight)));
  const newest = tops[0];
  const oldest = tops[tops.length - 1];
  return newest > 0 && newest <= oldest;
}

export function totalVolume(sets: { weight: number | null; reps: number | null }[]): number {
  return sets.reduce((sum, s) => sum + (s.weight ?? 0) * (s.reps ?? 0), 0);
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
