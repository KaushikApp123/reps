"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { addExerciseToDay, removeTemplateExercise } from "./actions";
import type { SubstitutableExercise } from "@/lib/substitutions";
import type { CoverageReport } from "@/lib/coverage";
import { coverageSummary } from "@/lib/coverage";
import { muscleLabel, type Muscle } from "@/lib/muscles";
import type { EquipmentTier } from "@/lib/types";
import {
  Button,
  ButtonLink,
  Chip,
  EquipmentBadge,
  ProgressBar,
  SectionTitle,
} from "@/components/ui";

type PickedExercise = {
  id: string;
  exercise: SubstitutableExercise;
  targetSets: number | null;
  targetReps: string | null;
};

type Day = { id: string; name: string };

type Suggestion = {
  muscle: Muscle;
  options: { id: string; name: string; equipment: EquipmentTier }[];
};

const SWIPE_THRESHOLD = 90;

export default function SwipeBuilder({
  splitName,
  days,
  currentDay,
  exercises,
  picked,
  coverage,
  suggestions,
  overloaded,
  unreachable,
}: {
  splitName: string;
  days: Day[];
  currentDay: Day;
  exercises: SubstitutableExercise[];
  picked: PickedExercise[];
  coverage: CoverageReport;
  suggestions: Suggestion[];
  overloaded: { muscle: Muscle; count: number }[];
  unreachable: Muscle[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const pickedIds = useMemo(
    () => new Set(picked.map((p) => p.exercise.id)),
    [picked],
  );

  const [queue, setQueue] = useState<SubstitutableExercise[]>(() =>
    prioritise(exercises.filter((e) => !pickedIds.has(e.id)), coverage),
  );
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const top = queue[0];
  const gapSummary = coverageSummary(coverage);
  const complete = coverage.score === 100;

  function add(exerciseId: string) {
    startTransition(async () => {
      await addExerciseToDay(currentDay.id, exerciseId);
      router.refresh();
    });
  }

  function decide(direction: "left" | "right" | "up") {
    if (!top) return;

    if (direction === "right") {
      setQueue((q) => q.slice(1));
      add(top.id);
    } else if (direction === "left") {
      setQueue((q) => q.slice(1));
    } else {
      setQueue((q) => {
        const [cur, ...rest] = q;
        const idx = rest.findIndex((e) => e.primary.some((m) => cur.primary.includes(m)));
        if (idx === -1) return [...rest, cur];
        return [rest[idx], ...rest.slice(0, idx), ...rest.slice(idx + 1), cur];
      });
      setFlash("Showing a similar move");
      setTimeout(() => setFlash(null), 1200);
    }
    setDrag({ x: 0, y: 0, active: false });
  }

  function onPointerDown(e: React.PointerEvent) {
    startRef.current = { x: e.clientX, y: e.clientY };
    setDrag({ x: 0, y: 0, active: true });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!startRef.current) return;
    setDrag({
      x: e.clientX - startRef.current.x,
      y: e.clientY - startRef.current.y,
      active: true,
    });
  }

  function onPointerUp() {
    if (!startRef.current) return;
    const { x, y } = drag;
    startRef.current = null;

    if (y < -SWIPE_THRESHOLD && Math.abs(y) > Math.abs(x)) decide("up");
    else if (x > SWIPE_THRESHOLD) decide("right");
    else if (x < -SWIPE_THRESHOLD) decide("left");
    else setDrag({ x: 0, y: 0, active: false });
  }

  function remove(id: string) {
    startTransition(async () => {
      await removeTemplateExercise(id);
      router.refresh();
    });
  }

  return (
    <div>
      <header className="animate-rise mb-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-subtle">
          {splitName}
        </p>
        <h1 className="mt-0.5 text-[26px] font-bold leading-tight">Build your routine</h1>
      </header>

      {/* Day switcher */}
      <div className="-mx-5 mb-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {days.map((d) => (
          <Link
            key={d.id}
            href={`/build?day=${d.id}`}
            className={`tap shrink-0 rounded-full border px-4 py-2 text-sm font-medium ${
              d.id === currentDay.id
                ? "border-accent bg-accent text-white"
                : "border-border bg-surface text-muted hover:text-foreground"
            }`}
          >
            {d.name}
          </Link>
        ))}
      </div>

      {/* Coverage */}
      <section className="card-glow animate-rise mb-5 rounded-[var(--radius-lg)] border border-border bg-surface p-4">
        <div className="mb-2.5 flex items-baseline justify-between">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.1em] text-subtle">
            Muscle coverage
          </h2>
          <span
            className={`text-lg font-bold num ${
              complete ? "text-success" : "text-foreground"
            }`}
          >
            {coverage.score}%
          </span>
        </div>

        <ProgressBar value={coverage.score} tone={complete ? "success" : "accent"} />

        <ul className="mt-3.5 flex flex-wrap gap-1.5">
          {coverage.entries.map((e) => (
            <li
              key={e.muscle}
              title={
                e.direct.length
                  ? `Covered by ${e.direct.join(", ")}`
                  : e.indirect.length
                    ? `Only worked indirectly by ${e.indirect.join(", ")}`
                    : "Nothing in this day trains it"
              }
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                e.status === "covered"
                  ? "border-success/30 bg-success/12 text-success"
                  : e.status === "indirect"
                    ? "border-gold/30 bg-gold/12 text-gold"
                    : "border-border bg-surface-2 text-subtle"
              }`}
            >
              {e.status === "covered" ? "✓" : e.status === "indirect" ? "~" : "○"}
              {muscleLabel(e.muscle)}
            </li>
          ))}
        </ul>

        {gapSummary && <p className="mt-3 text-sm text-muted">{gapSummary}</p>}
        {complete && picked.length > 0 && (
          <p className="mt-3 text-sm text-success">
            Every muscle this day owes you is covered.
          </p>
        )}

        {unreachable.length > 0 && (
          <p className="mt-2 text-xs text-subtle">
            {unreachable.map(muscleLabel).join(", ")} can&apos;t be trained directly
            with your equipment — not counted against you.
          </p>
        )}

        {overloaded.length > 0 && (
          <p className="mt-2 text-xs text-gold">
            {overloaded.length === 1
              ? `${overloaded[0].count} exercises all target ${muscleLabel(overloaded[0].muscle)} — consider swapping one out.`
              : "Several muscles have 3+ exercises each — this day may be lopsided."}
          </p>
        )}
      </section>

      {/* Fill the gaps */}
      {suggestions.some((s) => s.options.length > 0) && (
        <section className="animate-rise mb-5 rounded-[var(--radius-lg)] border border-accent/40 bg-accent-soft p-4">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.1em] text-accent-text">
            Fill the gaps
          </h2>
          <div className="mt-3 flex flex-col gap-3">
            {suggestions
              .filter((s) => s.options.length > 0)
              .map((s) => (
                <div key={s.muscle}>
                  <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-subtle">
                    {muscleLabel(s.muscle)}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {s.options.map((o) => (
                      <button
                        key={o.id}
                        onClick={() => add(o.id)}
                        className="tap rounded-[var(--radius-sm)] border border-border bg-surface px-3 py-2 text-xs font-medium hover:border-accent"
                      >
                        + {o.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* Card stack */}
      <div className="relative h-[340px] select-none">
        {queue.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center rounded-[var(--radius-xl)] border border-dashed border-border px-8 text-center">
            <span className="mb-2 text-3xl">🎉</span>
            <p className="font-semibold">That&apos;s every exercise</p>
            <p className="mt-1 text-sm text-muted">
              You&apos;ve seen all the moves for {currentDay.name}.
            </p>
          </div>
        ) : (
          queue
            .slice(0, 3)
            .map((ex, i) => {
              const isTop = i === 0;
              const rotate = isTop ? drag.x / 18 : 0;
              const style = isTop
                ? {
                    transform: `translate(${drag.x}px, ${drag.y}px) rotate(${rotate}deg)`,
                    transition: drag.active ? "none" : "transform 260ms var(--ease-spring)",
                  }
                : {
                    transform: `translateY(${i * 12}px) scale(${1 - i * 0.045})`,
                    transition: "transform 260ms var(--ease-out)",
                  };

              const fillsGap = ex.primary.some(
                (m) => coverage.missing.includes(m) || coverage.indirectOnly.includes(m),
              );

              return (
                <article
                  key={ex.id}
                  style={{ ...style, zIndex: 10 - i }}
                  onPointerDown={isTop ? onPointerDown : undefined}
                  onPointerMove={isTop ? onPointerMove : undefined}
                  onPointerUp={isTop ? onPointerUp : undefined}
                  onPointerCancel={isTop ? onPointerUp : undefined}
                  className={`card-glow absolute inset-0 flex flex-col justify-between rounded-[var(--radius-xl)] border bg-surface p-5 ${
                    fillsGap ? "border-accent/60" : "border-border"
                  } ${isTop ? "cursor-grab touch-none active:cursor-grabbing" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      {ex.primary.slice(0, 2).map((m) => (
                        <Chip key={m} tone="accent">{muscleLabel(m)}</Chip>
                      ))}
                    </div>
                    <EquipmentBadge tier={ex.equipment} />
                  </div>

                  <div>
                    {fillsGap && (
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-accent-text">
                        ★ Fills a gap
                      </p>
                    )}
                    <h2 className="text-[30px] font-bold leading-[1.08]">{ex.name}</h2>
                    {ex.secondary.length > 0 && (
                      <p className="mt-2.5 text-xs leading-relaxed text-subtle">
                        also works {ex.secondary.slice(0, 3).map(muscleLabel).join(", ")}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-subtle">
                    <span>← Skip</span>
                    <span>↑ Similar</span>
                    <span>Add →</span>
                  </div>

                  {isTop && drag.x > 40 && <Stamp label="ADD" tone="success" />}
                  {isTop && drag.x < -40 && <Stamp label="SKIP" tone="danger" />}
                </article>
              );
            })
            .reverse()
        )}
      </div>

      {flash && (
        <p className="animate-pop mt-3 text-center text-sm text-accent-text" role="status">
          {flash}
        </p>
      )}

      {top && (
        <div className="mt-6 flex items-center justify-center gap-4">
          <ActionButton onClick={() => decide("left")} label="Skip exercise">✕</ActionButton>
          <ActionButton onClick={() => decide("up")} label="Show similar exercise" small>↑</ActionButton>
          <ActionButton onClick={() => decide("right")} label="Add exercise" accent>✓</ActionButton>
        </div>
      )}

      {/* Chosen */}
      <section className="mt-9">
        <SectionTitle>
          {currentDay.name} · {picked.length} exercise{picked.length === 1 ? "" : "s"}
        </SectionTitle>

        {picked.length === 0 ? (
          <p className="rounded-[var(--radius-lg)] border border-dashed border-border p-5 text-center text-sm text-muted">
            Swipe right on exercises to add them to this day.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {picked.map((p, i) => (
              <li
                key={p.id}
                className="flex items-center gap-3 rounded-[var(--radius-md)] border border-border bg-surface px-3.5 py-3"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[11px] font-semibold num text-muted">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{p.exercise.name}</div>
                  <div className="truncate text-[11px] text-subtle">
                    {p.targetSets} × {p.targetReps} ·{" "}
                    {p.exercise.primary.map(muscleLabel).join(", ")}
                  </div>
                </div>
                <button
                  onClick={() => remove(p.id)}
                  aria-label={`Remove ${p.exercise.name}`}
                  className="tap shrink-0 rounded-[var(--radius-sm)] px-2 py-1.5 text-muted hover:bg-surface-3 hover:text-danger"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-8 flex flex-col gap-2.5">
        <ButtonLink href="/dashboard" size="lg" full>
          Done — go to dashboard
        </ButtonLink>
        {nextDay(days, currentDay) && (
          <Button
            variant="secondary"
            full
            onClick={() => router.push(`/build?day=${nextDay(days, currentDay)!.id}`)}
          >
            Next day: {nextDay(days, currentDay)!.name} →
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Shuffles the deck but floats gap-filling exercises to the top — the user
 * should meet what they're missing while they still have attention for it.
 */
function prioritise(
  list: SubstitutableExercise[],
  coverage: CoverageReport,
): SubstitutableExercise[] {
  const gaps = new Set<Muscle>([...coverage.missing, ...coverage.indirectOnly]);
  const shuffled = shuffle(list);
  const fills = shuffled.filter((e) => e.primary.some((m) => gaps.has(m)));
  const rest = shuffled.filter((e) => !e.primary.some((m) => gaps.has(m)));
  return [...fills, ...rest];
}

function nextDay(days: Day[], current: Day): Day | null {
  const i = days.findIndex((d) => d.id === current.id);
  return i >= 0 && i < days.length - 1 ? days[i + 1] : null;
}

function Stamp({ label, tone }: { label: string; tone: "success" | "danger" }) {
  return (
    <span
      className={`pointer-events-none absolute right-5 top-16 rotate-12 rounded-[var(--radius-sm)] border-[3px] px-3 py-1 text-2xl font-black tracking-wider ${
        tone === "success" ? "border-success text-success" : "border-danger text-danger"
      }`}
    >
      {label}
    </span>
  );
}

function ActionButton({
  onClick,
  label,
  accent,
  small,
  children,
}: {
  onClick: () => void;
  label: string;
  accent?: boolean;
  small?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`tap flex items-center justify-center rounded-full border font-bold ${
        small ? "h-12 w-12 text-lg" : "h-16 w-16 text-2xl"
      } ${
        accent
          ? "border-accent bg-accent text-white shadow-[0_8px_24px_-8px_var(--accent-ring)]"
          : "border-border bg-surface text-muted hover:border-border-strong hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
