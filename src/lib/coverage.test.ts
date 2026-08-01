import { describe, it, expect } from "vitest";
import { analyzeCoverage, coverageSummary, overloadedMuscles } from "./coverage";
import type { SubstitutableExercise } from "./substitutions";
import { EXERCISE_LIBRARY } from "./exercise-library";
import type { Muscle } from "./muscles";

const ALL: SubstitutableExercise[] = EXERCISE_LIBRARY.map((e, i) => ({
  id: String(i),
  name: e.name,
  group: e.group,
  equipment: e.equipment,
  pattern: e.pattern,
  primary: e.primary,
  secondary: e.secondary ?? [],
  compound: e.compound ?? false,
  unilateral: e.unilateral ?? false,
}));

const pick = (...names: string[]): SubstitutableExercise[] =>
  names.map((n) => {
    const f = ALL.find((e) => e.name === n);
    if (!f) throw new Error(`missing fixture: ${n}`);
    return f;
  });

const PUSH_REQUIRED: Muscle[] = [
  "Upper Chest",
  "Mid Chest",
  "Front Delt",
  "Side Delt",
  "Triceps Long Head",
  "Triceps Lateral Head",
];

describe("analyzeCoverage", () => {
  it("catches the classic push day that skips side delts and triceps long head", () => {
    // Pressing only — the mistake this whole system exists to catch.
    const chosen = pick(
      "Barbell Bench Press",
      "Incline Barbell Bench Press",
      "Barbell Overhead Press",
      "Cable Tricep Pushdown",
    );
    const report = analyzeCoverage(PUSH_REQUIRED, chosen);

    expect(report.missing).toContain("Triceps Long Head");
    // Side delts are hit as a secondary by overhead press, never directly.
    expect(report.indirectOnly).toContain("Side Delt");
    expect(report.score).toBeLessThan(100);
  });

  it("passes a push day that includes a lateral raise and overhead extension", () => {
    const chosen = pick(
      "Barbell Bench Press",
      "Incline Barbell Bench Press",
      "Barbell Overhead Press",
      "Cable Lateral Raise",
      "Overhead Cable Extension",
      "Cable Tricep Pushdown",
    );
    const report = analyzeCoverage(PUSH_REQUIRED, chosen);

    expect(report.missing).toEqual([]);
    expect(report.indirectOnly).toEqual([]);
    expect(report.score).toBe(100);
  });

  it("does not count a secondary muscle as covered", () => {
    // Overhead press lists Side Delt as secondary only.
    const report = analyzeCoverage(["Side Delt"], pick("Barbell Overhead Press"));
    expect(report.entries[0].status).toBe("indirect");
    expect(report.missing).toEqual([]);
    expect(report.indirectOnly).toEqual(["Side Delt"]);
  });

  it("distinguishes the two hamstring functions", () => {
    const hingeOnly = analyzeCoverage(
      ["Hamstrings (Hip)", "Hamstrings (Knee)"],
      pick("Barbell Romanian Deadlift"),
    );
    expect(hingeOnly.missing).toEqual(["Hamstrings (Knee)"]);

    const both = analyzeCoverage(
      ["Hamstrings (Hip)", "Hamstrings (Knee)"],
      pick("Barbell Romanian Deadlift", "Lying Leg Curl"),
    );
    expect(both.missing).toEqual([]);
  });

  it("knows squats do not cover the rectus femoris", () => {
    const report = analyzeCoverage(
      ["Quads (Vastii)", "Rectus Femoris"],
      pick("Barbell Back Squat", "Leg Press"),
    );
    expect(report.missing).toEqual(["Rectus Femoris"]);

    const withExtension = analyzeCoverage(
      ["Quads (Vastii)", "Rectus Femoris"],
      pick("Barbell Back Squat", "Leg Extension"),
    );
    expect(withExtension.missing).toEqual([]);
  });

  it("separates gastrocnemius from soleus", () => {
    // A standing raise works the soleus a little, so it counts as indirect —
    // still a gap worth flagging, since isolating it needs a bent knee.
    const standing = analyzeCoverage(
      ["Gastrocnemius", "Soleus"],
      pick("Standing Calf Raise Machine"),
    );
    expect(standing.indirectOnly).toEqual(["Soleus"]);
    expect(standing.score).toBe(50);

    const both = analyzeCoverage(
      ["Gastrocnemius", "Soleus"],
      pick("Standing Calf Raise Machine", "Seated Calf Raise Machine"),
    );
    expect(both.indirectOnly).toEqual([]);
    expect(both.score).toBe(100);
  });

  it("scores an empty day as zero and an empty requirement list as complete", () => {
    expect(analyzeCoverage(PUSH_REQUIRED, []).score).toBe(0);
    expect(analyzeCoverage([], []).score).toBe(100);
  });
});

describe("coverageSummary", () => {
  it("returns null when nothing is missing", () => {
    const report = analyzeCoverage(["Mid Chest"], pick("Barbell Bench Press"));
    expect(coverageSummary(report)).toBeNull();
  });

  it("names the gaps in plain language", () => {
    const report = analyzeCoverage(["Side Delt", "Triceps Long Head"], []);
    const summary = coverageSummary(report)!;
    expect(summary).toContain("side delts");
    expect(summary).toContain("triceps long head");
  });

  it("summarises a long gap list without listing everything", () => {
    const report = analyzeCoverage(PUSH_REQUIRED, []);
    const summary = coverageSummary(report)!;
    expect(summary).toMatch(/plus \d+ more/);
  });
});

describe("overloadedMuscles", () => {
  it("flags swiping right on four mid-chest presses", () => {
    const chosen = pick(
      "Barbell Bench Press",
      "Dumbbell Bench Press",
      "Chest Press Machine",
      "Pec Deck Machine",
    );
    const over = overloadedMuscles(chosen);
    expect(over[0].muscle).toBe("Mid Chest");
    expect(over[0].count).toBe(4);
  });

  it("stays quiet for a balanced day", () => {
    const chosen = pick(
      "Barbell Bench Press",
      "Incline Barbell Bench Press",
      "Cable Lateral Raise",
      "Overhead Cable Extension",
    );
    expect(overloadedMuscles(chosen)).toEqual([]);
  });
});
