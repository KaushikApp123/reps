import { describe, it, expect } from "vitest";
import {
  recommendSplits,
  getSplitTemplate,
  defaultsForGoal,
  restSecondsFor,
  requiredFor,
  groupsForDay,
} from "./splits";
import type { Goal } from "./types";

const GOALS: Goal[] = ["strength", "hypertrophy", "general"];
const DAYS = [2, 3, 4, 5, 6];

describe("recommendSplits", () => {
  it("only ever offers splits that fill the requested week", () => {
    // Regression: 5 days used to offer a 4-day Upper/Lower as the
    // alternative, leaving a day the app would never programme.
    for (const days of DAYS) {
      for (const goal of GOALS) {
        for (const split of recommendSplits(days, goal)) {
          expect(
            split.days.length,
            `${days} days/${goal} offered "${split.name}" with ${split.days.length} days`,
          ).toBe(days);
        }
      }
    }
  });

  it("always returns at least one option", () => {
    for (const days of DAYS) {
      for (const goal of GOALS) {
        expect(recommendSplits(days, goal).length).toBeGreaterThan(0);
      }
    }
  });

  it("clamps out-of-range day counts instead of returning nothing", () => {
    expect(recommendSplits(1, "general").length).toBeGreaterThan(0);
    expect(recommendSplits(99, "general").length).toBeGreaterThan(0);
    expect(recommendSplits(0, "general").length).toBeGreaterThan(0);
  });

  it("gives five-day users two genuine five-day choices", () => {
    const five = recommendSplits(5, "hypertrophy");
    expect(five.length).toBe(2);
    expect(new Set(five.map((s) => s.key)).size).toBe(2);
    for (const s of five) expect(s.days.length).toBe(5);
  });

  it("puts full body first for a three-day strength goal", () => {
    expect(recommendSplits(3, "strength")[0].key).toBe("full_body_3");
    expect(recommendSplits(3, "hypertrophy")[0].key).toBe("ppl_3");
  });

  it("never returns duplicate splits for one request", () => {
    for (const days of DAYS) {
      for (const goal of GOALS) {
        const keys = recommendSplits(days, goal).map((s) => s.key);
        expect(new Set(keys).size).toBe(keys.length);
      }
    }
  });

  it("gives every recommended day a non-empty required-muscle checklist", () => {
    for (const days of DAYS) {
      for (const goal of GOALS) {
        for (const split of recommendSplits(days, goal)) {
          for (const day of split.days) {
            expect(day.required.length, `${split.key}/${day.name}`).toBeGreaterThan(0);
          }
        }
      }
    }
  });

  it("gives every day a distinct name within a split", () => {
    for (const days of DAYS) {
      for (const split of recommendSplits(days, "general")) {
        const names = split.days.map((d) => d.name);
        expect(new Set(names).size, `${split.key} has repeated day names`).toBe(
          names.length,
        );
      }
    }
  });
});

describe("getSplitTemplate", () => {
  it("resolves every key a recommendation can return", () => {
    for (const days of DAYS) {
      for (const goal of GOALS) {
        for (const s of recommendSplits(days, goal)) {
          expect(getSplitTemplate(s.key), s.key).toBeDefined();
        }
      }
    }
  });

  it("returns undefined for an unknown key", () => {
    expect(getSplitTemplate("not_a_split")).toBeUndefined();
  });
});

describe("requiredFor", () => {
  it("never widens the checklist beyond what the day asks for", () => {
    const split = recommendSplits(3, "hypertrophy")[0];
    for (const day of split.days) {
      expect(requiredFor(day, "full_gym").length).toBeLessThanOrEqual(
        day.required.length,
      );
    }
  });

  it("narrows as equipment gets more limited", () => {
    const push = recommendSplits(3, "hypertrophy")[0].days[0];
    const gym = requiredFor(push, "full_gym").length;
    const body = requiredFor(push, "bodyweight").length;
    expect(body).toBeLessThanOrEqual(gym);
  });
});

describe("groupsForDay", () => {
  it("maps muscle heads up to coarse groups without duplicates", () => {
    const legs = recommendSplits(3, "general")[0].days[2];
    const groups = groupsForDay(legs);
    expect(groups.length).toBe(new Set(groups).size);
    expect(groups.length).toBeGreaterThan(0);
  });
});

describe("defaultsForGoal", () => {
  it("uses heavier low-rep work for strength and a range for hypertrophy", () => {
    expect(defaultsForGoal("strength")).toEqual({ sets: 4, reps: "5" });
    expect(defaultsForGoal("hypertrophy")).toEqual({ sets: 3, reps: "8-12" });
    expect(defaultsForGoal("general")).toEqual({ sets: 3, reps: "10" });
  });
});

describe("restSecondsFor", () => {
  it("rests longest for strength and shortest for general fitness", () => {
    expect(restSecondsFor("strength", true)).toBeGreaterThan(
      restSecondsFor("hypertrophy", true),
    );
    expect(restSecondsFor("hypertrophy", true)).toBeGreaterThan(
      restSecondsFor("general", true),
    );
  });

  it("rests less between isolation sets than compound sets", () => {
    for (const goal of GOALS) {
      expect(restSecondsFor(goal, false)).toBeLessThan(restSecondsFor(goal, true));
    }
  });

  it("never drops below a usable floor", () => {
    for (const goal of GOALS) {
      expect(restSecondsFor(goal, false)).toBeGreaterThanOrEqual(45);
    }
  });
});
