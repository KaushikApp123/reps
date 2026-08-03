"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { logSet, finishWorkout, cancelWorkout } from "../actions";
import type { Suggestion } from "@/lib/overload";
import type { SubstitutableExercise } from "@/lib/substitutions";
import { muscleLabel } from "@/lib/muscles";
import { Button, Chip, EquipmentBadge } from "@/components/ui";

type Alternative = { exercise: SubstitutableExercise; reason: string };

export type WorkoutExercise = {
  templateId: string;
  exercise: SubstitutableExercise;
  targetSets: number;
  targetReps: string;
  restSeconds: number;
  suggestion: Suggestion;
  alternatives: Alternative[];
};

type LoggedSetView = {
  id?: string;
  exerciseId: string;
  setNumber: number;
  weight: number;
  reps: number;
  isPR: boolean;
};

export default function ActiveWorkout({
  logId,
  dayName,
  unit,
  exercises,
  initialSets,
}: {
  logId: string;
  dayName: string;
  unit: string;
  exercises: WorkoutExercise[];
  initialSets: LoggedSetView[];
}) {
  const [index, setIndex] = useState(0);
  const [sets, setSets] = useState<LoggedSetView[]>(initialSets);
  const [swaps, setSwaps] = useState<Record<string, SubstitutableExercise>>({});
  const [showSwap, setShowSwap] = useState(false);
  const [rest, setRest] = useState<number | null>(null);
  const [pr, setPr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const item = exercises[index];
  const swap = swaps[item.templateId];

  // The exercise actually being performed — a mid-workout swap only affects
  // this session's log, never the saved template.
  const current = swap ?? item.exercise;

  const doneSets = sets.filter((s) => s.exerciseId === current.id);
  const setNumber = doneSets.length + 1;
  const isLastExercise = index === exercises.length - 1;
  const exerciseComplete = doneSets.length >= item.targetSets;

  const [weight, setWeight] = useState(String(item.suggestion.weight));
  const [reps, setReps] = useState(String(item.suggestion.reps));

  // Reset inputs when moving to a new exercise. Adjusting state during render
  // is React's recommended pattern here — it avoids a cascading render.
  const [renderedIndex, setRenderedIndex] = useState(index);
  if (renderedIndex !== index) {
    setRenderedIndex(index);
    setWeight(String(item.suggestion.weight));
    setReps(String(item.suggestion.reps));
    setShowSwap(false);
    setError(null);
  }

  const goNext = useCallback(() => {
    setRest(null);
    setIndex((i) => Math.min(i + 1, exercises.length - 1));
  }, [exercises.length]);

  const completionRef = useRef({ exerciseComplete, isLastExercise });
  useEffect(() => {
    completionRef.current = { exerciseComplete, isLastExercise };
  }, [exerciseComplete, isLastExercise]);

  // Rest countdown. The tick — and the buzz/auto-advance on reaching zero —
  // run inside the timeout callback, never synchronously in the effect body.
  useEffect(() => {
    if (rest === null || rest <= 0) return;

    const t = setTimeout(() => {
      const next = rest - 1;
      if (next > 0) {
        setRest(next);
        return;
      }
      setRest(null);
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate?.(200);
      }
      const { exerciseComplete: done, isLastExercise: last } = completionRef.current;
      if (done && !last) goNext();
    }, 1000);

    return () => clearTimeout(t);
  }, [rest, goNext]);

  const prTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (prTimer.current) clearTimeout(prTimer.current); }, []);

  async function handleLogSet() {
    const w = Number(weight);
    const r = Number(reps);
    if (!Number.isFinite(w) || w < 0) return setError("Enter a valid weight.");
    if (!Number.isFinite(r) || r <= 0) return setError("Reps must be at least 1.");

    setError(null);
    setSaving(true);
    const optimistic: LoggedSetView = {
      exerciseId: current.id,
      setNumber,
      weight: w,
      reps: r,
      isPR: false,
    };
    setSets((s) => [...s, optimistic]);

    try {
      const result = await logSet({
        workoutLogId: logId,
        exerciseId: current.id,
        setNumber,
        weight: w,
        reps: r,
      });

      if (result.isPR) {
        setSets((s) => s.map((x) => (x === optimistic ? { ...x, isPR: true } : x)));
        setPr(result.prMessage);
        if (prTimer.current) clearTimeout(prTimer.current);
        prTimer.current = setTimeout(() => setPr(null), 3500);
      }
      setRest(item.restSeconds);
    } catch {
      setSets((s) => s.filter((x) => x !== optimistic));
      setError("Couldn't save that set. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleFinish() {
    setFinishing(true);
    try {
      await finishWorkout(logId);
    } catch {
      setFinishing(false);
      setError("Couldn't finish the workout. Try again.");
    }
  }

  const totalLogged = sets.length;
  const sessionVolume = sets.reduce((sum, s) => sum + s.weight * s.reps, 0);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-10 pt-6">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-subtle">
            {dayName}
          </p>
          <p className="text-sm text-muted">
            Exercise {index + 1} of {exercises.length}
          </p>
        </div>
        <button
          onClick={() => {
            if (confirm("Discard this workout and everything logged in it?")) {
              cancelWorkout(logId);
            }
          }}
          className="tap rounded-[var(--radius-sm)] border border-border px-2.5 py-1.5 text-xs text-muted hover:border-danger/50 hover:text-danger"
        >
          Cancel
        </button>
      </header>

      <div className="mb-6 flex gap-1">
        {exercises.map((e, i) => (
          <div
            key={e.templateId}
            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
              i < index ? "bg-success" : i === index ? "bg-accent" : "bg-surface-3"
            }`}
          />
        ))}
      </div>

      {pr && (
        <div
          role="status"
          className="animate-pop mb-4 flex items-center gap-3 rounded-[var(--radius-lg)] border border-gold/50 bg-gold/10 px-4 py-3.5"
        >
          <span className="text-2xl">🏆</span>
          <span className="font-bold text-gold">{pr}</span>
        </div>
      )}

      {/* Current exercise */}
      <section className="card-glow rounded-[var(--radius-xl)] border border-border bg-surface p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {current.primary.slice(0, 2).map((m) => (
              <Chip key={m} tone="accent">{muscleLabel(m)}</Chip>
            ))}
          </div>
          <EquipmentBadge tier={current.equipment} />
        </div>

        <h1 className="mt-3.5 text-[32px] font-bold leading-[1.1]">{current.name}</h1>

        {swap && (
          <p className="mt-1.5 text-xs text-muted">
            Swapped in for {item.exercise.name} — today only
          </p>
        )}

        <div className="mt-4 flex items-center gap-2 text-sm">
          <span className="rounded-[var(--radius-sm)] bg-surface-3 px-2.5 py-1.5 font-semibold num">
            {item.targetSets} × {item.targetReps}
          </span>
          <span className="text-muted">target</span>
        </div>

        <p className="mt-3 rounded-[var(--radius-md)] border border-border bg-surface-2 px-3.5 py-3 text-sm leading-relaxed">
          {item.suggestion.note}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <NumberField
            label={`Weight (${unit})`}
            value={weight}
            onChange={setWeight}
            step={2.5}
          />
          <NumberField label="Reps" value={reps} onChange={setReps} step={1} />
        </div>

        {error && (
          <p role="alert" className="animate-pop mt-3 text-sm text-danger">
            {error}
          </p>
        )}

        <Button
          onClick={handleLogSet}
          disabled={saving}
          size="lg"
          full
          className="mt-4"
        >
          {saving ? "Saving…" : `Log set ${setNumber}`}
        </Button>

        {doneSets.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2">
            {doneSets.map((s, i) => (
              <li
                key={i}
                className={`animate-pop rounded-[var(--radius-sm)] border px-2.5 py-1.5 text-sm num ${
                  s.isPR
                    ? "border-gold/50 bg-gold/10 text-gold"
                    : "border-border bg-surface-2 text-muted"
                }`}
              >
                {s.weight}
                {unit} × {s.reps}
                {s.isPR ? " 🏆" : ""}
              </li>
            ))}
            {Array.from({ length: Math.max(0, item.targetSets - doneSets.length) }, (_, i) => (
              <li
                key={`todo-${i}`}
                className="rounded-[var(--radius-sm)] border border-dashed border-border px-2.5 py-1.5 text-sm text-subtle"
              >
                —
              </li>
            ))}
          </ul>
        )}
      </section>

      {rest !== null && (
        <RestTimer
          remaining={rest}
          total={item.restSeconds}
          onAdd={() => setRest((r) => (r ?? 0) + 30)}
          onSkip={() => setRest(null)}
        />
      )}

      {/* Swap */}
      <div className="mt-4">
        {!showSwap ? (
          <button
            onClick={() => setShowSwap(true)}
            className="tap w-full rounded-[var(--radius-md)] border border-border bg-surface px-4 py-3.5 text-sm text-muted hover:border-border-strong hover:text-foreground"
          >
            ⇄ Machine taken? Swap this exercise
          </button>
        ) : (
          <div className="animate-pop rounded-[var(--radius-lg)] border border-border bg-surface p-4">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-sm font-semibold">Trains the same muscles</p>
              <button
                onClick={() => setShowSwap(false)}
                className="tap rounded px-2 py-1 text-sm text-muted"
              >
                Close
              </button>
            </div>
            <p className="mb-3 text-xs text-subtle">
              Today&apos;s session only — your saved routine stays as it is.
            </p>

            {item.alternatives.length === 0 ? (
              <p className="text-sm text-muted">
                No equivalent available with your equipment.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {item.alternatives.map((alt) => (
                  <li key={alt.exercise.id}>
                    <button
                      onClick={() => {
                        setSwaps((s) => ({ ...s, [item.templateId]: alt.exercise }));
                        setShowSwap(false);
                      }}
                      className="tap w-full rounded-[var(--radius-md)] border border-border bg-surface-2 px-3.5 py-3 text-left hover:border-accent"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium">
                          {alt.exercise.name}
                        </span>
                        <EquipmentBadge tier={alt.exercise.equipment} />
                      </div>
                      <p className="mt-1 truncate text-xs text-subtle">{alt.reason}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {swap && (
              <button
                onClick={() => {
                  setSwaps((s) => {
                    const next = { ...s };
                    delete next[item.templateId];
                    return next;
                  });
                  setShowSwap(false);
                }}
                className="tap mt-3 w-full rounded-[var(--radius-md)] border border-border px-3 py-2.5 text-sm text-muted"
              >
                Undo swap — back to {item.exercise.name}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 flex gap-2.5">
        <Button
          variant="secondary"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          className="flex-1"
        >
          ← Prev
        </Button>
        {isLastExercise ? (
          <Button
            onClick={handleFinish}
            disabled={finishing || totalLogged === 0}
            className="flex-1"
          >
            {finishing ? "Finishing…" : "Finish"}
          </Button>
        ) : (
          <Button onClick={goNext} className="flex-1">
            Next →
          </Button>
        )}
      </div>

      <p className="mt-5 text-center text-xs text-subtle">
        {totalLogged} set{totalLogged === 1 ? "" : "s"} ·{" "}
        {Math.round(sessionVolume).toLocaleString()} {unit} lifted
      </p>

      {!isLastExercise && totalLogged > 0 && (
        <button
          onClick={handleFinish}
          disabled={finishing}
          className="tap mx-auto mt-3 rounded px-3 py-1.5 text-sm text-muted underline hover:text-foreground"
        >
          Finish workout early
        </button>
      )}
    </main>
  );
}

function RestTimer({
  remaining,
  total,
  onAdd,
  onSkip,
}: {
  remaining: number;
  total: number;
  onAdd: () => void;
  onSkip: () => void;
}) {
  const pct = total > 0 ? remaining / total : 0;
  const r = 52;
  const c = 2 * Math.PI * r;

  return (
    <div className="animate-pop mt-4 rounded-[var(--radius-xl)] border border-accent/50 bg-accent-soft p-5">
      <div className="flex items-center gap-5">
        <div className="relative h-32 w-32 shrink-0">
          <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
            <circle cx="64" cy="64" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="8" />
            <circle
              cx="64"
              cy="64"
              r={r}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={c * (1 - pct)}
              style={{ transition: "stroke-dashoffset 1s linear" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold num">{formatTime(remaining)}</span>
            <span className="text-[10px] uppercase tracking-[0.12em] text-subtle">
              Rest
            </span>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="text-sm leading-relaxed text-muted">
            Catch your breath. We&apos;ll move you on automatically.
          </p>
          <div className="flex gap-2">
            <button
              onClick={onAdd}
              className="tap flex-1 rounded-[var(--radius-sm)] border border-border bg-surface px-3 py-2 text-sm font-medium"
            >
              +30s
            </button>
            <button
              onClick={onSkip}
              className="tap flex-1 rounded-[var(--radius-sm)] border border-border bg-surface px-3 py-2 text-sm font-medium"
            >
              Skip
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  step: number;
}) {
  const num = Number(value) || 0;
  return (
    <div>
      <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.1em] text-subtle">
        {label}
      </label>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onChange(String(Math.max(0, round(num - step))))}
          aria-label={`Decrease ${label}`}
          className="tap h-12 w-11 shrink-0 rounded-[var(--radius-sm)] border border-border bg-surface-3 text-xl font-medium"
        >
          −
        </button>
        <input
          type="number"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-12 w-full min-w-0 rounded-[var(--radius-sm)] border border-border bg-surface-2 text-center text-lg font-semibold num outline-none focus:border-accent"
        />
        <button
          type="button"
          onClick={() => onChange(String(round(num + step)))}
          aria-label={`Increase ${label}`}
          className="tap h-12 w-11 shrink-0 rounded-[var(--radius-sm)] border border-border bg-surface-3 text-xl font-medium"
        >
          +
        </button>
      </div>
    </div>
  );
}

/** Avoids 47.50000000000001 showing up after repeated 2.5 steps. */
function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}
