import LoginForm from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="relative flex flex-1 flex-col justify-center overflow-hidden px-6 py-12">
      {/* Ambient brand glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full opacity-45 blur-[100px]"
        style={{
          background:
            "radial-gradient(circle, var(--accent) 0%, transparent 65%)",
        }}
      />

      <div className="relative mx-auto w-full max-w-sm">
        <div className="animate-rise mb-10 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[var(--radius-lg)] bg-accent shadow-[0_10px_40px_-10px_var(--accent-ring)]">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10"
                stroke="white"
                strokeWidth={2.3}
                strokeLinecap="round"
              />
            </svg>
          </div>
          <h1 className="text-4xl font-bold tracking-tight">Reps</h1>
          <p className="mx-auto mt-2 max-w-[28ch] text-[15px] leading-relaxed text-muted">
            Swipe to build your routine. Train. Track every rep.
          </p>
        </div>

        <LoginForm
          linkError={error === "confirm"}
          demoEnabled={Boolean(process.env.DEMO_EMAIL && process.env.DEMO_PASSWORD)}
        />

        <p className="mt-8 text-center text-xs leading-relaxed text-subtle">
          Built for the gym floor — add it to your home screen and it runs
          like an app.
        </p>
      </div>
    </main>
  );
}
