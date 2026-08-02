/**
 * Shown while a server-rendered route streams in. Mirrors the shape of the
 * real screens (header, stat row, list) so the layout doesn't jump.
 */
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-5 pt-7" aria-busy="true">
      <span className="sr-only">Loading…</span>

      <div className="mb-6">
        <Bar className="h-3.5 w-28" />
        <Bar className="mt-2 h-7 w-48" />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-2.5">
        <Block className="h-[86px]" />
        <Block className="h-[86px]" />
      </div>

      <Bar className="mb-3 h-3 w-24" />
      <div className="flex flex-col gap-2.5">
        <Block className="h-[74px]" />
        <Block className="h-[74px]" />
        <Block className="h-[74px]" />
      </div>
    </main>
  );
}

function Block({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-[var(--radius-lg)] border border-border bg-surface ${className}`}
    />
  );
}

function Bar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-surface-2 ${className}`} />;
}
