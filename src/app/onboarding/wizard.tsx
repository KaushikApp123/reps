"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { completeOnboarding } from "./actions";
import { recommendSplits } from "@/lib/splits";
import { EQUIPMENT_LABEL, GOAL_LABEL } from "@/lib/types";
import type { EquipmentTier, Goal } from "@/lib/types";
import { Button, Chip } from "@/components/ui";

const DAYS = [2, 3, 4, 5, 6];

export default function OnboardingWizard({ name }: { name: string | null }) {
  const [step, setStep] = useState(0);
  const [days, setDays] = useState<number | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [equipment, setEquipment] = useState<EquipmentTier | null>(null);
  const [splitKey, setSplitKey] = useState<string | null>(null);

  const recommendations = days && goal ? recommendSplits(days, goal) : [];

  return (
    <div>
      <Progress step={step} total={4} />

      {step === 0 && (
        <Step
          eyebrow="Step 1 of 4"
          title={name ? `Hey ${name}` : "Let's set you up"}
          subtitle="How many days a week can you realistically train?"
        >
          <div className="grid grid-cols-5 gap-2">
            {DAYS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setDays(d);
                  setSplitKey(null);
                  setStep(1);
                }}
                className={`tap flex flex-col items-center rounded-[var(--radius-md)] border py-4 transition-colors ${
                  days === d
                    ? "border-accent bg-accent text-white"
                    : "border-border bg-surface hover:border-border-strong"
                }`}
              >
                <span className="text-xl font-bold num">{d}</span>
                <span className="text-[10px] opacity-70">days</span>
              </button>
            ))}
          </div>
          <p className="mt-4 text-center text-xs text-subtle">
            Be honest — consistency beats ambition.
          </p>
        </Step>
      )}

      {step === 1 && (
        <Step
          eyebrow="Step 2 of 4"
          title="What are you training for?"
          onBack={() => setStep(0)}
        >
          <div className="flex flex-col gap-2.5">
            {(Object.keys(GOAL_LABEL) as Goal[]).map((g) => (
              <OptionRow
                key={g}
                emoji={GOAL_EMOJI[g]}
                label={GOAL_LABEL[g]}
                description={GOAL_BLURB[g]}
                selected={goal === g}
                onClick={() => {
                  setGoal(g);
                  setSplitKey(null);
                  setStep(2);
                }}
              />
            ))}
          </div>
        </Step>
      )}

      {step === 2 && (
        <Step
          eyebrow="Step 3 of 4"
          title="What can you train with?"
          subtitle="We'll only ever show exercises you can actually do."
          onBack={() => setStep(1)}
        >
          <div className="flex flex-col gap-2.5">
            {(Object.keys(EQUIPMENT_LABEL) as EquipmentTier[]).map((t) => (
              <OptionRow
                key={t}
                emoji={EQUIPMENT_EMOJI[t]}
                label={EQUIPMENT_LABEL[t]}
                description={EQUIPMENT_BLURB[t]}
                selected={equipment === t}
                onClick={() => {
                  setEquipment(t);
                  setStep(3);
                }}
              />
            ))}
          </div>
        </Step>
      )}

      {step === 3 && days && goal && equipment && (
        <Step
          eyebrow="Step 4 of 4"
          title="Your split"
          subtitle={`Built for ${days} days a week, focused on ${GOAL_LABEL[goal].toLowerCase()}.`}
          onBack={() => setStep(2)}
        >
          <form action={completeOnboarding} className="flex flex-col gap-3">
            <input type="hidden" name="days_per_week" value={days} />
            <input type="hidden" name="goal" value={goal} />
            <input type="hidden" name="equipment" value={equipment} />
            <input
              type="hidden"
              name="split_key"
              value={splitKey ?? recommendations[0]?.key ?? ""}
            />

            {recommendations.map((s, i) => {
              const selected = (splitKey ?? recommendations[0]?.key) === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSplitKey(s.key)}
                  className={`tap rounded-[var(--radius-lg)] border p-4 text-left transition-colors ${
                    selected
                      ? "border-accent bg-accent-soft"
                      : "border-border bg-surface hover:border-border-strong"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{s.name}</span>
                    {i === 0 && <Chip tone="accent">Recommended</Chip>}
                    {selected && (
                      <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[11px] text-white">
                        ✓
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.08em] text-subtle">
                    <span className="num">{s.days.length}</span> days a week
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.blurb}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {s.days.map((d) => (
                      <span
                        key={d.name}
                        className="rounded-[8px] bg-surface-3 px-2 py-1 text-[11px] text-muted"
                      >
                        {d.name}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}

            <SubmitButton />
          </form>
        </Step>
      )}
    </div>
  );
}

const GOAL_BLURB: Record<Goal, string> = {
  strength: "Heavier weight, lower reps, longer rest.",
  hypertrophy: "Moderate weight, 8–12 reps, steady volume.",
  general: "Balanced work to stay fit and healthy.",
};

const GOAL_EMOJI: Record<Goal, string> = {
  strength: "🏋️",
  hypertrophy: "💪",
  general: "⚡",
};

const EQUIPMENT_BLURB: Record<EquipmentTier, string> = {
  bodyweight: "No equipment at all — just you and the floor.",
  home: "Dumbbells, bands, a pull-up bar, that kind of thing.",
  full_gym: "Barbells, machines, cables — the works.",
};

const EQUIPMENT_EMOJI: Record<EquipmentTier, string> = {
  bodyweight: "🤸",
  home: "🏠",
  full_gym: "🏢",
};

function Progress({ step, total }: { step: number; total: number }) {
  return (
    <div className="mb-8 flex gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
            i <= step ? "bg-accent" : "bg-surface-3"
          }`}
        />
      ))}
    </div>
  );
}

function Step({
  eyebrow,
  title,
  subtitle,
  onBack,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  onBack?: () => void;
  children: React.ReactNode;
}) {
  return (
    <section key={title} className="animate-rise">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="tap mb-4 -ml-1 flex items-center gap-1 rounded-md px-1 py-1 text-sm text-muted hover:text-foreground"
        >
          ← Back
        </button>
      )}
      {eyebrow && (
        <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-subtle">
          {eyebrow}
        </p>
      )}
      <h1 className="text-[28px] font-bold leading-tight">{title}</h1>
      {subtitle && (
        <p className="mt-2 text-[15px] leading-relaxed text-muted">{subtitle}</p>
      )}
      <div className="mt-7">{children}</div>
    </section>
  );
}

function OptionRow({
  emoji,
  label,
  description,
  selected,
  onClick,
}: {
  emoji: string;
  label: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tap flex items-start gap-3.5 rounded-[var(--radius-lg)] border p-4 text-left transition-colors ${
        selected
          ? "border-accent bg-accent-soft"
          : "border-border bg-surface hover:border-border-strong"
      }`}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-surface-3 text-xl">
        {emoji}
      </span>
      <span className="min-w-0">
        <span className="block font-semibold">{label}</span>
        <span className="mt-0.5 block text-sm leading-relaxed text-muted">
          {description}
        </span>
      </span>
    </button>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" full disabled={pending} className="mt-3">
      {pending ? "Creating your plan…" : "Build my routine →"}
    </Button>
  );
}
