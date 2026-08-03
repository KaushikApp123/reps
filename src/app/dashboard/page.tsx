import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireOnboarded, getActiveSplit } from "@/lib/data";
import { totalVolume } from "@/lib/overload";
import {
  currentWeekStreak,
  formatVolume,
  toDayKey,
  workoutsThisWeek,
} from "@/lib/stats";
import { ButtonLink, Card, Stat, SectionTitle, Chip } from "@/components/ui";
import { signOut } from "@/app/login/actions";

export default async function DashboardPage() {
  const { userId, profile } = await requireOnboarded();
  const active = await getActiveSplit(userId);
  if (!active) redirect("/onboarding");

  const supabase = await createClient();

  const { data: logs } = await supabase
    .from("workout_logs")
    .select("id, performed_at, completed_at, split_day_id")
    .eq("user_id", userId)
    .order("performed_at", { ascending: false });

  const completed = (logs ?? []).filter((l) => l.completed_at);
  const inProgress = (logs ?? []).find((l) => !l.completed_at);

  const { data: sets } = await supabase
    .from("logged_sets")
    .select("weight, reps, workout_logs!inner(user_id)")
    .eq("workout_logs.user_id", userId);

  const volume = totalVolume(sets ?? []);
  const workoutDays = new Set(completed.map((l) => toDayKey(l.performed_at)));
  const unit = profile.weight_unit;
  const target = profile.days_per_week ?? 0;
  const thisWeek = workoutsThisWeek(workoutDays);

  const lastDayId = completed[0]?.split_day_id;
  const lastIdx = active.days.findIndex((d) => d.id === lastDayId);
  const suggested = active.days[(lastIdx + 1) % active.days.length] ?? active.days[0];

  const { data: counts } = await supabase
    .from("template_exercises")
    .select("split_day_id")
    .in("split_day_id", active.days.map((d) => d.id));

  const perDay = new Map<string, number>();
  for (const row of counts ?? []) {
    perDay.set(row.split_day_id, (perDay.get(row.split_day_id) ?? 0) + 1);
  }

  const greeting = getGreeting();

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-5 pb-8 pt-7">
      <header className="animate-rise mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-muted">
            {greeting}
            {profile.display_name ? `, ${profile.display_name}` : ""}
          </p>
          <h1 className="mt-0.5 truncate text-[26px] font-bold leading-tight">
            {active.split.name}
          </h1>
        </div>
        <form action={signOut}>
          <button className="tap rounded-[var(--radius-sm)] border border-border px-2.5 py-1.5 text-xs text-muted hover:text-foreground">
            Sign out
          </button>
        </form>
      </header>

      {inProgress && (
        <Card accent className="animate-pop mb-5">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
            <p className="text-sm font-semibold">Workout in progress</p>
          </div>
          <ButtonLink href={`/workout/${inProgress.id}`} full className="mt-3.5">
            Resume workout
          </ButtonLink>
        </Card>
      )}

      {/* Weekly goal ring + stats */}
      <section className="animate-rise mb-7" style={{ animationDelay: "40ms" }}>
        <Card>
          <div className="flex items-center gap-5">
            <WeekRing done={thisWeek} target={target} />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-subtle">
                This week
              </p>
              <p className="mt-0.5 text-2xl font-bold num">
                {thisWeek}
                <span className="text-muted"> / {target}</span>
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {thisWeek >= target && target > 0
                  ? "Target hit — everything else is a bonus."
                  : `${Math.max(0, target - thisWeek)} to go`}
              </p>
            </div>
          </div>
        </Card>

        <div className="mt-2.5 grid grid-cols-2 gap-2.5">
          <Stat
            label="Week streak"
            value={`${currentWeekStreak(workoutDays, target)}`}
            sub="weeks on target"
            tone={currentWeekStreak(workoutDays, target) > 0 ? "accent" : "default"}
          />
          <Stat
            label="Total lifted"
            value={formatVolume(volume, unit)}
            sub="all time"
          />
        </div>
      </section>

      <section className="animate-rise" style={{ animationDelay: "80ms" }}>
        <SectionTitle
          action={
            <a href="/build" className="text-xs font-medium text-accent-text hover:underline">
              Edit routine
            </a>
          }
        >
          Your split
        </SectionTitle>

        <ul className="flex flex-col gap-2.5">
          {active.days.map((day) => {
            const count = perDay.get(day.id) ?? 0;
            const isSuggested = day.id === suggested.id;
            const ready = count > 0;

            return (
              <li key={day.id}>
                <div
                  className={`card-glow flex items-center justify-between gap-3 rounded-[var(--radius-lg)] border p-4 ${
                    isSuggested
                      ? "border-accent/60 bg-accent-soft"
                      : "border-border bg-surface"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{day.name}</span>
                      {isSuggested && <Chip tone="accent">Up next</Chip>}
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {ready
                        ? `${count} exercise${count === 1 ? "" : "s"}`
                        : "Not built yet"}
                    </p>
                  </div>

                  <ButtonLink
                    href={ready ? `/workout/start/${day.id}` : `/build?day=${day.id}`}
                    variant={isSuggested && ready ? "primary" : "secondary"}
                    size="sm"
                    className="shrink-0"
                  >
                    {ready ? "Start" : "Build"}
                  </ButtonLink>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}

/** Circular weekly-goal indicator. */
function WeekRing({ done, target }: { done: number; target: number }) {
  const pct = target > 0 ? Math.min(1, done / target) : 0;
  const r = 26;
  const c = 2 * Math.PI * r;
  const complete = target > 0 && done >= target;

  return (
    <div className="relative h-[68px] w-[68px] shrink-0">
      <svg viewBox="0 0 68 68" className="h-full w-full -rotate-90">
        <circle cx="34" cy="34" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="6" />
        <circle
          cx="34"
          cy="34"
          r={r}
          fill="none"
          stroke={complete ? "var(--success)" : "var(--accent)"}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className="transition-[stroke-dashoffset] duration-700 ease-[var(--ease-out)]"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-lg">
        {complete ? "✓" : "💪"}
      </span>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
