import { ButtonLink } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-12 text-center">
      <p className="text-6xl font-bold tracking-tight text-accent">404</p>
      <h1 className="mt-3 text-2xl font-bold">Nothing here</h1>
      <p className="mx-auto mt-2 max-w-[30ch] text-sm leading-relaxed text-muted">
        That page doesn&apos;t exist — it may have moved, or the link was wrong.
      </p>

      <div className="mt-7">
        <ButtonLink href="/dashboard" size="lg" full>
          Back to dashboard
        </ButtonLink>
      </div>
    </main>
  );
}
