import { detectPlateau, type HistorySet } from "./overload";

export type CoachLogRow = { performed_at: string };

export type CoachSetRow = {
  exercise_id: string;
  weight: number | null;
  reps: number | null;
  is_pr: boolean;
  exercises: { name: string } | null;
  workout_logs: { performed_at: string };
};

export type TrainingSummary = {
  weeksTrained: number;
  workoutsLast30: number;
  totalVolume: number;
  /** Exercises whose top set hasn't moved in several sessions. */
  stalled: string[];
  /** Exercise names that set a record in the last 30 days. */
  recentPRs: string[];
};

const DAY_MS = 86_400_000;

/**
 * Aggregates raw log rows into the figures the coaching brief is built from.
 *
 * `now` is injected so this is deterministic and unit-testable, and so the
 * page component doesn't have to call an impure clock during render.
 */
export function summariseTraining(
  logs: CoachLogRow[],
  sets: CoachSetRow[],
  now: number = Date.now(),
): TrainingSummary {
  const cutoff = now - 30 * DAY_MS;

  const workoutsLast30 = logs.filter(
    (l) => new Date(l.performed_at).getTime() >= cutoff,
  ).length;

  // logs arrive newest-first, so the last entry is the earliest session.
  const earliest = logs.length ? logs[logs.length - 1].performed_at : null;
  const weeksTrained = earliest
    ? Math.max(1, Math.ceil((now - new Date(earliest).getTime()) / (7 * DAY_MS)))
    : 0;

  let totalVolume = 0;
  const history = new Map<string, HistorySet[]>();
  const nameFor = new Map<string, string>();
  const prNames = new Set<string>();

  for (const s of sets) {
    const weight = Number(s.weight ?? 0);
    const reps = Number(s.reps ?? 0);
    totalVolume += weight * reps;

    const list = history.get(s.exercise_id) ?? [];
    list.push({ weight, reps, performedAt: s.workout_logs.performed_at });
    history.set(s.exercise_id, list);

    if (s.exercises?.name) nameFor.set(s.exercise_id, s.exercises.name);

    if (
      s.is_pr &&
      s.exercises?.name &&
      new Date(s.workout_logs.performed_at).getTime() >= cutoff
    ) {
      prNames.add(s.exercises.name);
    }
  }

  const stalled = [...history.entries()]
    .filter(([, h]) => detectPlateau(h))
    .map(([id]) => nameFor.get(id) ?? "")
    .filter(Boolean);

  return {
    weeksTrained,
    workoutsLast30,
    totalVolume,
    stalled,
    recentPRs: [...prNames],
  };
}
