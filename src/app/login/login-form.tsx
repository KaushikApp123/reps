"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { signIn, signUp, signInDemo, type AuthState } from "./actions";
import { Button } from "@/components/ui";

const initialState: AuthState = { error: null, notice: null };

export default function LoginForm({
  linkError,
  demoEnabled,
}: {
  linkError?: boolean;
  demoEnabled?: boolean;
}) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const action = mode === "signin" ? signIn : signUp;
  const [state, formAction] = useActionState(action, initialState);
  const [demoState, demoAction] = useActionState(
    async () => await signInDemo(),
    initialState,
  );

  return (
    <div className="animate-rise" style={{ animationDelay: "60ms" }}>
      {demoEnabled && (
        <div className="mb-6">
          <form action={demoAction}>
            <DemoButton />
          </form>
          {demoState.error && (
            <p role="alert" className="mt-2 text-center text-xs text-danger">
              {demoState.error}
            </p>
          )}
          <p className="mt-2.5 text-center text-xs leading-relaxed text-subtle">
            Loaded with 10 weeks of training history — no signup needed.
          </p>
          <div className="mt-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-subtle">
              or use your own account
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>
        </div>
      )}

      {/* Segmented control */}
      <div className="relative mb-5 grid grid-cols-2 rounded-[var(--radius-md)] border border-border bg-surface p-1">
        <span
          aria-hidden="true"
          className="absolute inset-y-1 w-[calc(50%-4px)] rounded-[10px] bg-accent transition-transform duration-300 ease-[var(--ease-out)]"
          style={{
            transform: mode === "signin" ? "translateX(4px)" : "translateX(calc(100% + 4px))",
          }}
        />
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`relative z-10 rounded-[10px] py-2.5 text-sm font-semibold transition-colors ${
              mode === m ? "text-white" : "text-muted hover:text-foreground"
            }`}
          >
            {m === "signin" ? "Sign in" : "Sign up"}
          </button>
        ))}
      </div>

      <form action={formAction} className="flex flex-col gap-3">
        {mode === "signup" && (
          <Field name="display_name" label="Name" type="text" autoComplete="name" placeholder="Alex" />
        )}
        <Field
          name="email"
          label="Email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
        />
        <Field
          name="password"
          label="Password"
          type="password"
          required
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          placeholder="••••••••"
        />

        {linkError && !state.error && !state.notice && (
          <p
            role="alert"
            className="rounded-[var(--radius-md)] border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-sm leading-relaxed text-danger"
          >
            That confirmation link didn&apos;t work — it may have expired.
            Sign in below, or sign up again to get a fresh one.
          </p>
        )}

        {state.error && (
          <p
            role="alert"
            className="animate-pop rounded-[var(--radius-md)] border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-sm leading-relaxed text-danger"
          >
            {state.error}
          </p>
        )}

        {state.notice && (
          <p
            role="status"
            className="animate-pop rounded-[var(--radius-md)] border border-success/40 bg-success/10 px-3.5 py-2.5 text-sm leading-relaxed text-success"
          >
            ✓ {state.notice}
          </p>
        )}

        <SubmitButton
          label={mode === "signin" ? "Sign in" : "Create account"}
          // The demo is the primary call to action when it's available, so the
          // real-account path steps down a level rather than competing.
          variant={demoEnabled ? "secondary" : "primary"}
        />
      </form>
    </div>
  );
}

function Field({
  name,
  label,
  ...props
}: { name: string; label: string } & React.ComponentProps<"input">) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-[0.08em] text-subtle">
        {label}
      </span>
      <input
        {...props}
        name={name}
        className="rounded-[var(--radius-md)] border border-border bg-surface px-3.5 py-3.5 text-foreground outline-none
                   transition-colors placeholder:text-subtle focus:border-accent focus:bg-surface-2"
      />
    </label>
  );
}

function SubmitButton({
  label,
  variant = "primary",
}: {
  label: string;
  variant?: "primary" | "secondary";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" variant={variant} full disabled={pending} className="mt-2">
      {pending ? <Spinner /> : label}
    </Button>
  );
}

function DemoButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" full disabled={pending}>
      {pending ? <Spinner /> : "▶  Try the live demo"}
    </Button>
  );
}

function Spinner() {
  return (
    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-label="Loading">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
