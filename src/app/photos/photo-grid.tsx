"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createUploadTicket, confirmUpload, deletePhoto } from "./actions";
import { Button, EmptyState } from "@/components/ui";

type Photo = {
  id: string;
  url: string;
  note: string | null;
  takenAt: string;
};

const MAX_BYTES = 8 * 1024 * 1024;

export default function PhotoGrid({ photos }: { photos: Photo[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function handleFile(file: File) {
    setError(null);

    if (file.size > MAX_BYTES) {
      setError("That image is over 8 MB. Try a smaller one.");
      return;
    }

    setBusy(true);
    try {
      setProgress("Preparing upload…");
      const ticket = await createUploadTicket(file.name, file.type, file.size);
      if (!ticket.ok) {
        setError(ticket.error);
        return;
      }

      setProgress("Uploading…");
      // Goes straight to S3 — never through the app server.
      const put = await fetch(ticket.url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!put.ok) {
        setError("Upload failed. Check your connection and try again.");
        return;
      }

      setProgress("Saving…");
      const saved = await confirmUpload(ticket.key, file.type, file.size);
      if (!saved.ok) {
        setError(saved.error ?? "Could not save the photo.");
        return;
      }

      router.refresh();
    } catch {
      setError("Something went wrong during upload.");
    } finally {
      setBusy(false);
      setProgress(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function remove(id: string) {
    if (!confirm("Delete this photo? This can't be undone.")) return;
    startTransition(async () => {
      const res = await deletePhoto(id);
      if (!res.ok) setError(res.error ?? "Could not delete the photo.");
      router.refresh();
    });
  }

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />

      <Button
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        size="lg"
        full
      >
        {busy ? (progress ?? "Working…") : "＋ Add a photo"}
      </Button>

      {error && (
        <p
          role="alert"
          className="animate-pop mt-3 rounded-[var(--radius-md)] border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-sm text-danger"
        >
          {error}
        </p>
      )}

      <div className="mt-6">
        {photos.length === 0 ? (
          <EmptyState
            icon="📷"
            title="No photos yet"
            body="Progress is easier to see side by side than day to day. Add one to start."
          />
        ) : (
          <ul className="grid grid-cols-2 gap-2.5">
            {photos.map((p) => (
              <li
                key={p.id}
                className="group relative overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface"
              >
                {/* Presigned S3 URLs are short-lived and host-varied, so the
                    Next image optimiser isn't a fit here. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url}
                  alt={p.note ?? `Progress photo from ${formatDate(p.takenAt)}`}
                  loading="lazy"
                  className="aspect-[3/4] w-full object-cover"
                />

                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-2.5 pb-2 pt-6">
                  <p className="text-[11px] font-medium text-white">
                    {formatDate(p.takenAt)}
                  </p>
                  {p.note && (
                    <p className="truncate text-[10px] text-white/70">{p.note}</p>
                  )}
                </div>

                <button
                  onClick={() => remove(p.id)}
                  aria-label={`Delete photo from ${formatDate(p.takenAt)}`}
                  className="tap absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-xs text-white backdrop-blur hover:bg-danger"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
