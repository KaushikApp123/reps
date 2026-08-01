import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  toDayKey,
  startOfWeek,
  currentDayStreak,
  currentWeekStreak,
  workoutsThisWeek,
  buildHeatmap,
  formatVolume,
} from "./stats";

// Wednesday 2026-07-15, local time.
const NOW = new Date(2026, 6, 15, 12, 0, 0);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

const days = (...keys: string[]) => new Set(keys);

describe("toDayKey", () => {
  it("formats a local date as YYYY-MM-DD", () => {
    expect(toDayKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("uses local time, not UTC, so late-evening workouts stay on their day", () => {
    // 23:30 local on the 15th must not roll forward to the 16th.
    expect(toDayKey(new Date(2026, 6, 15, 23, 30))).toBe("2026-07-15");
  });
});

describe("startOfWeek", () => {
  it("returns the Monday of the containing week", () => {
    // 2026-07-15 is a Wednesday; that week's Monday is the 13th.
    expect(toDayKey(startOfWeek(NOW))).toBe("2026-07-13");
  });

  it("treats Sunday as the end of the week, not the start", () => {
    const sunday = new Date(2026, 6, 19, 12, 0, 0);
    expect(toDayKey(startOfWeek(sunday))).toBe("2026-07-13");
  });
});

describe("currentDayStreak", () => {
  it("counts consecutive days ending today", () => {
    expect(currentDayStreak(days("2026-07-15", "2026-07-14", "2026-07-13"))).toBe(3);
  });

  it("does not break the streak when today has no workout yet", () => {
    expect(currentDayStreak(days("2026-07-14", "2026-07-13"))).toBe(2);
  });

  it("stops at the first missed day", () => {
    expect(currentDayStreak(days("2026-07-15", "2026-07-13", "2026-07-12"))).toBe(1);
  });

  it("is zero with no workouts", () => {
    expect(currentDayStreak(days())).toBe(0);
  });
});

describe("workoutsThisWeek", () => {
  it("counts only Monday-to-Sunday of the current week", () => {
    const set = days(
      "2026-07-13", // Mon, this week
      "2026-07-15", // Wed, this week
      "2026-07-12", // Sun, previous week
      "2026-07-20", // next Monday
    );
    expect(workoutsThisWeek(set)).toBe(2);
  });
});

describe("currentWeekStreak", () => {
  it("does not count the current week until the target is met", () => {
    // Two of three done so far this week.
    const set = days("2026-07-13", "2026-07-14");
    expect(currentWeekStreak(set, 3)).toBe(0);
  });

  it("counts the current week once the target is met", () => {
    const set = days("2026-07-13", "2026-07-14", "2026-07-15");
    expect(currentWeekStreak(set, 3)).toBe(1);
  });

  it("an unfinished current week does not break a prior streak", () => {
    const set = days(
      "2026-07-13", // this week: only 1 of 3 so far
      // previous week (Jul 6–12): 3 workouts
      "2026-07-06", "2026-07-07", "2026-07-08",
      // week before (Jun 29–Jul 5): 3 workouts
      "2026-06-29", "2026-06-30", "2026-07-01",
    );
    expect(currentWeekStreak(set, 3)).toBe(2);
  });

  it("stops at the first week that missed the target", () => {
    const set = days(
      "2026-07-06", "2026-07-07", "2026-07-08", // last week: 3 ✓
      "2026-06-29", "2026-06-30",               // week before: 2 ✗
      "2026-06-22", "2026-06-23", "2026-06-24", // earlier: 3 (unreachable)
    );
    expect(currentWeekStreak(set, 3)).toBe(1);
  });

  it("is zero when the target is unset", () => {
    expect(currentWeekStreak(days("2026-07-13"), 0)).toBe(0);
  });
});

describe("buildHeatmap", () => {
  it("produces the requested number of Mon–Sun columns", () => {
    const grid = buildHeatmap(new Map(), 26);
    expect(grid).toHaveLength(26);
    for (const week of grid) expect(week).toHaveLength(7);
  });

  it("ends on the current week and marks later days as future", () => {
    const grid = buildHeatmap(new Map(), 4);
    const lastWeek = grid[grid.length - 1];
    expect(toDayKey(lastWeek[0].date)).toBe("2026-07-13");
    // Wednesday is today, so Thu–Sun are future.
    expect(lastWeek[2].future).toBe(false);
    expect(lastWeek[3].future).toBe(true);
  });

  it("assigns level 0 to rest days and non-zero to trained days", () => {
    const grid = buildHeatmap(new Map([["2026-07-13", 5000]]), 2);
    const cells = grid.flat();
    const trained = cells.find((c) => c.key === "2026-07-13")!;
    const rest = cells.find((c) => c.key === "2026-07-14")!;
    expect(trained.level).toBeGreaterThan(0);
    expect(rest.level).toBe(0);
  });

  it("buckets volume so heavier days read darker", () => {
    const grid = buildHeatmap(
      new Map([
        ["2026-07-06", 1000],
        ["2026-07-07", 5000],
        ["2026-07-08", 10000],
        ["2026-07-09", 20000],
      ]),
      4,
    );
    const cells = grid.flat();
    const level = (k: string) => cells.find((c) => c.key === k)!.level;
    expect(level("2026-07-06")).toBeLessThan(level("2026-07-09"));
  });
});

describe("formatVolume", () => {
  it("abbreviates thousands and millions", () => {
    expect(formatVolume(950, "lb")).toBe("950 lb");
    expect(formatVolume(12_500, "lb")).toBe("12.5k lb");
    expect(formatVolume(2_400_000, "kg")).toBe("2.4M kg");
  });
});
