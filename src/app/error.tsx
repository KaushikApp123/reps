"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surfaced in the Vercel function logs, keyed by digest.
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-12 text-center">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-[var(--radius-lg)] border border-border bg-surface text-2xl">
        ⚠️
      </div>
      <h1 className="text-2xl font-bold">Something broke</h1>
      <p className="mx-auto mt-2 max-w-[32ch] text-sm leading-relaxed text-muted">
        That&apos;s on us, not you. Try again — if it keeps happening, head back
        to the dashboard.
      </p>

      {error.digest && (
        <p className="mt-3 font-mono text-[11px] text-subtle">
          ref: {error.digest}
        </p>
      )}

      <div className="mt-7 flex flex-col gap-2.5">
        <Button onClick={reset} size="lg" full>
          Try again
        </Button>
        <ButtonLink href="/dashboard" variant="secondary" full>
          Back to dashboard
        </ButtonLink>
      </div>
    </main>
  );
}
