import { describe, it, expect } from "vitest";
import {
  parseRepRange,
  groupSessions,
  suggestNextSet,
  detectPR,
  detectPlateau,
  incrementFor,
  totalVolume,
  type HistorySet,
} from "./overload";

const day = (d: string) => `2026-07-${d}T10:00:00.000Z`;

function sets(
  entries: [weight: number, reps: number, date: string][],
): HistorySet[] {
  return entries.map(([weight, reps, performedAt]) => ({
    weight,
    reps,
    performedAt,
  }));
}

describe("parseRepRange", () => {
  it("parses a single number", () => {
    expect(parseRepRange("5")).toEqual({ low: 5, high: 5 });
  });

  it("parses a hyphenated range", () => {
    expect(parseRepRange("8-12")).toEqual({ low: 8, high: 12 });
  });

  it("parses an en-dash range", () => {
    expect(parseRepRange("8–12")).toEqual({ low: 8, high: 12 });
  });

  it("falls back for unparseable text like AMRAP", () => {
    expect(parseRepRange("AMRAP")).toEqual({ low: 8, high: 12 });
    expect(parseRepRange(null)).toEqual({ low: 8, high: 12 });
  });
});

describe("groupSessions", () => {
  it("groups by calendar day, newest session first", () => {
    const history = sets([
      [100, 8, day("01")],
      [100, 8, day("03")],
      [105, 8, day("03")],
    ]);
    const grouped = groupSessions(history);
    expect(grouped).toHaveLength(2);
    expect(grouped[0]).toHaveLength(2); // the 3rd is newest
    expect(grouped[1]).toHaveLength(1);
  });

  it("returns nothing for empty history", () => {
    expect(groupSessions([])).toEqual([]);
  });
});

describe("incrementFor", () => {
  it("uses bigger jumps for lower body", () => {
    expect(incrementFor("Quads (Vastii)", "lb")).toBe(10);
    expect(incrementFor("Mid Chest", "lb")).toBe(5);
  });

  it("uses metric jumps for kg", () => {
    expect(incrementFor("Hamstrings (Hip)", "kg")).toBe(5);
    expect(incrementFor("Side Delt", "kg")).toBe(2.5);
  });
});

describe("suggestNextSet", () => {
  it("asks the user to find a working weight the first time", () => {
    const s = suggestNextSet([], "8-12", 3, "Mid Chest", "lb");
    expect(s.isFirstTime).toBe(true);
    expect(s.weight).toBe(0);
    expect(s.reps).toBe(8);
  });

  it("adds weight once the top of the range is cleared on every set", () => {
    const history = sets([
      [100, 12, day("01")],
      [100, 12, day("01")],
      [100, 12, day("01")],
    ]);
    const s = suggestNextSet(history, "8-12", 3, "Mid Chest", "lb");
    expect(s.weight).toBe(105); // +5 upper body
    expect(s.reps).toBe(8); // back to the bottom of the range
  });

  it("holds weight and chases a rep when the range is not cleared", () => {
    const history = sets([
      [100, 9, day("01")],
      [100, 9, day("01")],
      [100, 9, day("01")],
    ]);
    const s = suggestNextSet(history, "8-12", 3, "Mid Chest", "lb");
    expect(s.weight).toBe(100);
    expect(s.reps).toBe(10);
  });

  it("does not add weight when the target set count was not completed", () => {
    // Hit 12 reps, but only for one set out of three.
    const history = sets([[100, 12, day("01")]]);
    const s = suggestNextSet(history, "8-12", 3, "Mid Chest", "lb");
    expect(s.weight).toBe(100);
  });

  it("never suggests more reps than the top of the range", () => {
    const history = sets([[100, 12, day("01")]]);
    const s = suggestNextSet(history, "8-12", 1, "Mid Chest", "lb");
    expect(s.reps).toBeLessThanOrEqual(12);
  });

  it("judges progress against the most recent session only", () => {
    const history = sets([
      [80, 12, day("01")], // old, cleared
      [100, 8, day("05")], // recent, not cleared
    ]);
    const s = suggestNextSet(history, "8-12", 1, "Mid Chest", "lb");
    expect(s.weight).toBe(100);
    expect(s.reps).toBe(9);
  });
});

describe("detectPR", () => {
  it("treats the first ever set as a PR", () => {
    const pr = detectPR([], { weight: 100, reps: 5 });
    expect(pr.isPR).toBe(true);
  });

  it("detects a heavier top-end weight", () => {
    const history = sets([[100, 5, day("01")]]);
    const pr = detectPR(history, { weight: 105, reps: 3 });
    expect(pr.isPR).toBe(true);
    expect(pr.kind).toBe("weight");
  });

  it("detects a volume PR at the same weight", () => {
    const history = sets([[100, 5, day("01")]]);
    const pr = detectPR(history, { weight: 100, reps: 8 });
    expect(pr.isPR).toBe(true);
    expect(pr.kind).toBe("volume");
  });

  it("is not a PR when it beats neither weight nor volume", () => {
    const history = sets([[100, 10, day("01")]]);
    const pr = detectPR(history, { weight: 90, reps: 8 });
    expect(pr.isPR).toBe(false);
  });

  it("ignores bodyweight/unloaded sets", () => {
    const pr = detectPR([], { weight: 0, reps: 20 });
    expect(pr.isPR).toBe(false);
  });
});

describe("detectPlateau", () => {
  it("needs a full window before judging", () => {
    const history = sets([
      [100, 8, day("01")],
      [100, 8, day("03")],
    ]);
    expect(detectPlateau(history, 3)).toBe(false);
  });

  it("flags three sessions with no increase in top weight", () => {
    const history = sets([
      [100, 8, day("01")],
      [100, 8, day("03")],
      [100, 8, day("05")],
    ]);
    expect(detectPlateau(history, 3)).toBe(true);
  });

  it("does not flag when the newest session is heavier", () => {
    const history = sets([
      [100, 8, day("01")],
      [100, 8, day("03")],
      [110, 8, day("05")],
    ]);
    expect(detectPlateau(history, 3)).toBe(false);
  });

  it("does not flag unloaded bodyweight work", () => {
    const history = sets([
      [0, 20, day("01")],
      [0, 20, day("03")],
      [0, 20, day("05")],
    ]);
    expect(detectPlateau(history, 3)).toBe(false);
  });
});

describe("totalVolume", () => {
  it("sums weight times reps and tolerates nulls", () => {
    expect(
      totalVolume([
        { weight: 100, reps: 10 },
        { weight: null, reps: 5 },
        { weight: 50, reps: null },
        { weight: 20, reps: 3 },
      ]),
    ).toBe(1060);
  });
});
