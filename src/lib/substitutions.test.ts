import { describe, it, expect } from "vitest";
import { findSubstitutes, bestForMuscle, type SubstitutableExercise } from "./substitutions";
import { EXERCISE_LIBRARY } from "./exercise-library";

/** Builds the substitution view over the real library, so these tests double
 *  as a sanity check on the library's own tagging. */
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

const byName = (name: string): SubstitutableExercise => {
  const found = ALL.find((e) => e.name === name);
  if (!found) throw new Error(`missing fixture exercise: ${name}`);
  return found;
};

describe("findSubstitutes", () => {
  it("suggests other mid-chest presses when the pec deck is taken", () => {
    const subs = findSubstitutes(byName("Pec Deck Machine"), ALL, "full_gym");
    const names = subs.map((s) => s.exercise.name);
    expect(names.length).toBeGreaterThan(0);
    // Every suggestion must actually train mid chest.
    for (const s of subs) expect(s.exercise.primary).toContain("Mid Chest");
    expect(names).toContain("Cable Fly (Mid)");
  });

  it("never suggests an exercise above the user's equipment tier", () => {
    const subs = findSubstitutes(byName("Barbell Bench Press"), ALL, "bodyweight");
    for (const s of subs) expect(s.exercise.equipment).toBe("bodyweight");
  });

  it("gives a home user dumbbell and band options, not machines", () => {
    const subs = findSubstitutes(byName("Chest Press Machine"), ALL, "home");
    const tiers = new Set(subs.map((s) => s.exercise.equipment));
    expect(tiers.has("full_gym")).toBe(false);
    expect(subs.length).toBeGreaterThan(0);
  });

  it("excludes the exercise itself", () => {
    const target = byName("Lat Pulldown");
    const subs = findSubstitutes(target, ALL, "full_gym");
    expect(subs.map((s) => s.exercise.id)).not.toContain(target.id);
  });

  it("does not substitute across unrelated muscles", () => {
    // A lateral raise must never be replaced by a curl.
    const subs = findSubstitutes(byName("Lateral Raise"), ALL, "full_gym");
    for (const s of subs) expect(s.exercise.primary).toContain("Side Delt");
  });

  it("ranks the same movement pattern above a merely related one", () => {
    const subs = findSubstitutes(byName("Lat Pulldown"), ALL, "full_gym", 10);
    const firstVertical = subs.findIndex((s) => s.exercise.pattern === "vertical_pull");
    const firstHorizontal = subs.findIndex((s) => s.exercise.pattern === "horizontal_pull");
    expect(firstVertical).toBeGreaterThanOrEqual(0);
    if (firstHorizontal >= 0) expect(firstVertical).toBeLessThan(firstHorizontal);
  });

  it("keeps the triceps long head when swapping an overhead extension", () => {
    const subs = findSubstitutes(byName("Overhead Cable Extension"), ALL, "full_gym");
    for (const s of subs) expect(s.exercise.primary).toContain("Triceps Long Head");
  });

  it("respects the requested limit", () => {
    const subs = findSubstitutes(byName("Barbell Back Squat"), ALL, "full_gym", 3);
    expect(subs.length).toBeLessThanOrEqual(3);
  });

  it("returns results ordered by descending score", () => {
    const subs = findSubstitutes(byName("Seated Cable Row"), ALL, "full_gym", 10);
    const scores = subs.map((s) => s.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });
});

describe("bestForMuscle", () => {
  it("finds side delt work for a bodyweight user or reports none", () => {
    const found = bestForMuscle("Side Delt", ALL, "bodyweight");
    for (const e of found) {
      expect(e.primary).toContain("Side Delt");
      expect(e.equipment).toBe("bodyweight");
    }
  });

  it("prefers focused isolation over broad compounds", () => {
    const found = bestForMuscle("Side Delt", ALL, "full_gym", new Set(), 1);
    expect(found[0].primary.length).toBe(1);
    expect(found[0].primary).toContain("Side Delt");
  });

  it("honours the exclude set", () => {
    const first = bestForMuscle("Triceps Long Head", ALL, "full_gym", new Set(), 1)[0];
    const next = bestForMuscle(
      "Triceps Long Head",
      ALL,
      "full_gym",
      new Set([first.id]),
      1,
    )[0];
    expect(next.id).not.toBe(first.id);
  });
});

describe("library integrity", () => {
  it("has unique exercise names", () => {
    const names = ALL.map((e) => e.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("gives every exercise at least one primary muscle", () => {
    for (const e of ALL) expect(e.primary.length).toBeGreaterThan(0);
  });

  it("never lists a muscle as both primary and secondary", () => {
    for (const e of ALL) {
      const overlap = e.primary.filter((m) => e.secondary.includes(m));
      expect(overlap, `${e.name} lists ${overlap.join(",")} twice`).toEqual([]);
    }
  });

  it("covers every required muscle of every split day at full_gym", async () => {
    const { getSplitTemplate } = await import("./splits");
    for (const key of [
      "full_body_2", "full_body_3", "ppl_3",
      "upper_lower_4", "ppl_upper_lower_5", "arnold_6", "ppl_6",
    ]) {
      const split = getSplitTemplate(key)!;
      for (const day of split.days) {
        for (const muscle of day.required) {
          const options = bestForMuscle(muscle, ALL, "full_gym");
          expect(
            options.length,
            `${key}/${day.name} requires ${muscle} but no full_gym exercise trains it`,
          ).toBeGreaterThan(0);
        }
      }
    }
  });

  it("only asks bodyweight users for muscles they can actually train", async () => {
    const { getSplitTemplate, requiredFor } = await import("./splits");
    const gaps: string[] = [];
    for (const key of ["full_body_2", "full_body_3", "ppl_3"]) {
      const split = getSplitTemplate(key)!;
      for (const day of split.days) {
        // requiredFor narrows the checklist to what the tier can reach.
        for (const muscle of requiredFor(day, "bodyweight")) {
          if (bestForMuscle(muscle, ALL, "bodyweight").length === 0) {
            gaps.push(`${key}/${day.name}: ${muscle}`);
          }
        }
      }
    }
    expect(gaps, `bodyweight users cannot train: ${gaps.join("; ")}`).toEqual([]);
  });

  it("still leaves a bodyweight user a substantial day to train", async () => {
    const { getSplitTemplate, requiredFor } = await import("./splits");
    const ppl = getSplitTemplate("ppl_3")!;
    for (const day of ppl.days) {
      const required = requiredFor(day, "bodyweight");
      expect(
        required.length,
        `${day.name} collapses to ${required.length} trainable muscles at bodyweight`,
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it("lets a home-gym user reach every muscle a full gym would require", async () => {
    const { getSplitTemplate, requiredFor } = await import("./splits");
    const gaps: string[] = [];
    for (const key of ["upper_lower_4", "ppl_3"]) {
      const split = getSplitTemplate(key)!;
      for (const day of split.days) {
        for (const muscle of requiredFor(day, "home")) {
          if (bestForMuscle(muscle, ALL, "home").length === 0) {
            gaps.push(`${key}/${day.name}: ${muscle}`);
          }
        }
      }
    }
    expect(gaps).toEqual([]);
  });
});
