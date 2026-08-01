/** Date helpers work in local time so "today" matches the user's calendar. */

export function toDayKey(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

/** Monday-based start of the week containing `d`. */
export function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  const dow = (copy.getDay() + 6) % 7; // Mon=0 … Sun=6
  copy.setHours(0, 0, 0, 0);
  return addDays(copy, -dow);
}

/**
 * Consecutive days with at least one workout, counting back from today.
 * Today not having a workout yet doesn't break the streak — we start from
 * yesterday in that case.
 */
export function currentDayStreak(workoutDays: Set<string>): number {
  const today = new Date();
  let cursor = workoutDays.has(toDayKey(today)) ? today : addDays(today, -1);
  let streak = 0;

  while (workoutDays.has(toDayKey(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/**
 * Consecutive weeks (including the current one) where the user hit their
 * weekly target. The current week only counts once the target is met, so an
 * in-progress week never breaks an existing streak.
 */
export function currentWeekStreak(
  workoutDays: Set<string>,
  daysPerWeek: number,
): number {
  if (daysPerWeek <= 0) return 0;

  let weekStart = startOfWeek(new Date());
  let streak = 0;

  // Current week: only counts if already met.
  if (countInWeek(workoutDays, weekStart) >= daysPerWeek) streak += 1;
  weekStart = addDays(weekStart, -7);

  while (countInWeek(workoutDays, weekStart) >= daysPerWeek) {
    streak += 1;
    weekStart = addDays(weekStart, -7);
  }
  return streak;
}

function countInWeek(workoutDays: Set<string>, weekStart: Date): number {
  let n = 0;
  for (let i = 0; i < 7; i++) {
    if (workoutDays.has(toDayKey(addDays(weekStart, i)))) n += 1;
  }
  return n;
}

export function workoutsThisWeek(workoutDays: Set<string>): number {
  return countInWeek(workoutDays, startOfWeek(new Date()));
}

export type HeatmapCell = {
  key: string;
  date: Date;
  /** 0 = no workout, 1–4 = increasing volume for that day. */
  level: 0 | 1 | 2 | 3 | 4;
  volume: number;
  future: boolean;
};

/**
 * Builds a GitHub-style grid of the last `weeks` weeks, oldest column first.
 * Each column is a Mon→Sun week. Intensity is the day's volume bucketed
 * against the quartiles of all non-zero days, so the ramp stays meaningful
 * whatever weights the user lifts.
 */
export function buildHeatmap(
  volumeByDay: Map<string, number>,
  weeks = 26,
): HeatmapCell[][] {
  const thisWeekStart = startOfWeek(new Date());
  const firstWeekStart = addDays(thisWeekStart, -7 * (weeks - 1));
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const values = [...volumeByDay.values()].filter((v) => v > 0).sort((a, b) => a - b);
  const q = (p: number) =>
    values.length ? values[Math.min(values.length - 1, Math.floor(values.length * p))] : 0;
  const q1 = q(0.25);
  const q2 = q(0.5);
  const q3 = q(0.75);

  return Array.from({ length: weeks }, (_, w) => {
    const colStart = addDays(firstWeekStart, w * 7);
    return Array.from({ length: 7 }, (_, d): HeatmapCell => {
      const date = addDays(colStart, d);
      const key = toDayKey(date);
      const volume = volumeByDay.get(key) ?? 0;

      let level: HeatmapCell["level"] = 0;
      if (volume > 0) {
        if (volume <= q1) level = 1;
        else if (volume <= q2) level = 2;
        else if (volume <= q3) level = 3;
        else level = 4;
      }

      return { key, date, level, volume, future: date > today };
    });
  });
}

export function formatVolume(n: number, unit: string): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M ${unit}`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k ${unit}`;
  return `${Math.round(n)} ${unit}`;
}
