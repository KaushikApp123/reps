/**
 * Regenerates supabase/seed_exercises.sql from the TypeScript exercise
 * library, so the database can never drift from the app's own metadata.
 *
 *   npm run seed:sql
 *
 * The generated file is idempotent: re-running it in the Supabase SQL Editor
 * inserts new exercises and updates the tagging on existing ones.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { EXERCISE_LIBRARY } from "../src/lib/exercise-library";

function sqlString(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

function sqlArray(items: string[]): string {
  if (items.length === 0) return "'{}'";
  return `ARRAY[${items.map(sqlString).join(", ")}]`;
}

const rows = EXERCISE_LIBRARY.map((e) => {
  const cols = [
    sqlString(e.name),
    sqlString(e.group),
    sqlString(e.equipment),
    sqlString(e.pattern),
    sqlArray(e.primary),
    sqlArray(e.secondary ?? []),
    e.compound ? "true" : "false",
    e.unilateral ? "true" : "false",
  ];
  return `  (${cols.join(", ")})`;
}).join(",\n");

const sql = `-- GENERATED FILE — do not edit by hand.
-- Source: src/lib/exercise-library.ts   Regenerate: npm run seed:sql
--
-- Run this in the Supabase SQL Editor after 003_exercise_science.sql.
-- Idempotent: inserts new exercises, refreshes tagging on existing ones.
--
-- Equipment tiers are cumulative minimums: a 'bodyweight' exercise is
-- available to every user, 'home' to home + full_gym users, 'full_gym' only
-- at a full gym. Filter with a rank comparison, never an exact match.

insert into public.exercises
  (name, muscle_group, equipment, movement_pattern,
   primary_muscles, secondary_muscles, is_compound, is_unilateral)
values
${rows}
on conflict (name) where user_id is null do update set
  muscle_group      = excluded.muscle_group,
  equipment         = excluded.equipment,
  movement_pattern  = excluded.movement_pattern,
  primary_muscles   = excluded.primary_muscles,
  secondary_muscles = excluded.secondary_muscles,
  is_compound       = excluded.is_compound,
  is_unilateral     = excluded.is_unilateral;

-- Retire any exercise seeded by an older version of this file that is no
-- longer in the library, unless a user's template or log references it.
delete from public.exercises e
where e.user_id is null
  and e.name <> all (array[
${EXERCISE_LIBRARY.map((e) => `    ${sqlString(e.name)}`).join(",\n")}
  ])
  and not exists (select 1 from public.template_exercises t where t.exercise_id = e.id)
  and not exists (select 1 from public.logged_sets s where s.exercise_id = e.id);
`;

const out = join(process.cwd(), "supabase", "seed_exercises.sql");
writeFileSync(out, sql, "utf8");
console.log(
  `Wrote ${out} — ${EXERCISE_LIBRARY.length} exercises`,
);
